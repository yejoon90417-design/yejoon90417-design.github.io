const EFFECTS = {
  rasengan: {
    label: "나선환",
    source: "assets/naruto.mp4",
    sound: "assets/rasengan.mp3",
    scale: 8.9,
    minSize: 420,
    maxRatio: 0.94,
    anchorX: 0.5,
    anchorY: 0.56,
    glow: "rgba(79, 220, 255, 0.95)",
    glowAlpha: 0.16,
  },
  chidori: {
    label: "치도리",
    source: "assets/sasuke.mp4",
    sound: "assets/chidori.mp3",
    scale: 14.2,
    minSize: 860,
    maxRatio: 1.34,
    anchorX: 0.45,
    anchorY: 0.52,
    glow: "rgba(140, 196, 255, 0.95)",
    glowAlpha: 0.18,
  },
};

const CAMERA_DPR_CAP = 1.1;
const CAMERA_TRACK_WIDTH = 640;
const CAMERA_TRACK_HEIGHT = 360;
const CAMERA_TRACK_INTERVAL_MS = 75;
const CAMERA_CAPTURE_WIDTH = 960;
const CAMERA_CAPTURE_HEIGHT = 540;
const CAMERA_CAPTURE_FPS = 24;
const EASY_OPEN_ARM_WINDOW_MS = 2200;
const EFFECT_EDGE_THRESHOLD = 18;
const EFFECT_EDGE_SOFTNESS = 54;
const EFFECT_MAX_WORK_PIXELS = 250000;

const dom = {
  launcher: document.getElementById("launcherScreen"),
  cameraScreen: document.getElementById("cameraScreen"),
  canvas: document.getElementById("cameraCanvas"),
  video: document.getElementById("cameraVideo"),
  effectLabel: document.getElementById("effectLabel"),
  trackingLabel: document.getElementById("trackingLabel"),
  backButton: document.getElementById("backButton"),
  errorToast: document.getElementById("errorToast"),
};

const ctx = dom.canvas.getContext("2d", { alpha: false });

const state = {
  selectedEffect: null,
  stream: null,
  hands: null,
  latestResults: null,
  running: false,
  processing: false,
  rafId: 0,
  lastHandSendAt: 0,
  gateArmedUntil: 0,
  effectVisible: false,
  smoothX: null,
  smoothY: null,
  smoothSize: null,
  effectVideos: {},
  effectAudios: {},
  effectAudioActive: false,
  trackCanvas: null,
  trackCtx: null,
  effectCanvas: null,
  effectCtx: null,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, ratio) {
  return from + (to - from) * ratio;
}

function setScreen(screenName) {
  const showCamera = screenName === "camera";
  dom.launcher.classList.toggle("screen-active", !showCamera);
  dom.cameraScreen.classList.toggle("screen-active", showCamera);
}

function showError(message) {
  dom.errorToast.textContent = message;
  dom.errorToast.hidden = !message;
}

function buildEffectVideos() {
  Object.entries(EFFECTS).forEach(([key, effect]) => {
    const video = document.createElement("video");
    video.src = effect.source;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    state.effectVideos[key] = video;

    const audio = document.createElement("audio");
    audio.src = effect.sound;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 1.0;
    state.effectAudios[key] = audio;
  });
}

async function ensureHands() {
  if (state.hands) {
    return state.hands;
  }

  const hands = new window.Hands({
    locateFile(file) {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    },
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results) => {
    state.latestResults = results;
  });

  state.hands = hands;
  return hands;
}

function resizeCanvas() {
  const dpr = Math.min(CAMERA_DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
  const width = window.innerWidth;
  const height = window.innerHeight;
  dom.canvas.width = Math.floor(width * dpr);
  dom.canvas.height = Math.floor(height * dpr);
  dom.canvas.style.width = `${width}px`;
  dom.canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
}

function getMirroredLandmarks(handLandmarks) {
  return handLandmarks.map((landmark) => ({
    x: 1 - landmark.x,
    y: landmark.y,
    z: landmark.z ?? 0,
  }));
}

function getBounds(landmarks) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  landmarks.forEach((landmark) => {
    minX = Math.min(minX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxX = Math.max(maxX, landmark.x);
    maxY = Math.max(maxY, landmark.y);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0.0001, maxX - minX),
    height: Math.max(0.0001, maxY - minY),
  };
}

function getPalmCenter(landmarks) {
  const ids = [0, 5, 9, 13, 17];
  const total = ids.reduce(
    (acc, id) => {
      acc.x += landmarks[id].x;
      acc.y += landmarks[id].y;
      return acc;
    },
    { x: 0, y: 0 },
  );
  return {
    x: total.x / ids.length,
    y: total.y / ids.length,
  };
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function isFingerExtended(landmarks, tipIndex, pipIndex, mcpIndex) {
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];
  return tip.y < pip.y - 0.012 && pip.y < mcp.y + 0.005;
}

function areMajorFingersExtended(landmarks) {
  return (
    isFingerExtended(landmarks, 8, 6, 5)
    && isFingerExtended(landmarks, 12, 10, 9)
    && isFingerExtended(landmarks, 16, 14, 13)
    && isFingerExtended(landmarks, 20, 18, 17)
  );
}

function isTwoSign(landmarks) {
  const wrist = landmarks[0];
  const indexUp = isFingerExtended(landmarks, 8, 6, 5);
  const middleUp = isFingerExtended(landmarks, 12, 10, 9);
  const ringDown = landmarks[16].y > landmarks[14].y - 0.01;
  const pinkyDown = landmarks[20].y > landmarks[18].y - 0.01;
  if (!(indexUp && middleUp && ringDown && pinkyDown)) {
    return false;
  }

  const guideReach = Math.max(dist(landmarks[8], wrist), dist(landmarks[12], wrist));
  const thumbFold = dist(landmarks[4], wrist) < guideReach * 1.32;
  return thumbFold;
}

function isOpenPalm(landmarks) {
  if (!areMajorFingersExtended(landmarks)) {
    return false;
  }

  const bounds = getBounds(landmarks);
  if (bounds.width < 0.09 || bounds.height < 0.13) {
    return false;
  }

  const wrist = landmarks[0];
  const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const avgTipY = tips.reduce((sum, tip) => sum + tip.y, 0) / tips.length;
  if (avgTipY > wrist.y - 0.06) {
    return false;
  }

  const tipSpan = Math.max(landmarks[8].x, landmarks[12].x, landmarks[16].x, landmarks[20].x)
    - Math.min(landmarks[8].x, landmarks[12].x, landmarks[16].x, landmarks[20].x);
  return tipSpan >= 0.08;
}

function classifyRightHandGesture(hand) {
  if (!hand) {
    return null;
  }
  if (isTwoSign(hand.landmarks)) {
    return "two";
  }
  if (isOpenPalm(hand.landmarks)) {
    return "open";
  }
  return "other";
}

function updateGestureState(hand) {
  const now = performance.now();
  if (state.gateArmedUntil > 0 && now > state.gateArmedUntil) {
    state.gateArmedUntil = 0;
  }

  const gesture = classifyRightHandGesture(hand);
  if (gesture === "two") {
    state.gateArmedUntil = now + EASY_OPEN_ARM_WINDOW_MS;
    state.effectVisible = false;
    return "검지+중지 인식";
  }

  if (gesture === "open") {
    if (state.gateArmedUntil > now || state.effectVisible) {
      state.effectVisible = true;
      return "손 펼침 발동중";
    }
    state.effectVisible = false;
    return "검지+중지 후 손펼침";
  }

  state.effectVisible = false;
  if (state.gateArmedUntil > now) {
    return "손 펼침 대기중";
  }
  return hand ? "검지+중지 대기중" : "오른손 대기중";
}

function getRightHand(results) {
  if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    return null;
  }

  const candidates = results.multiHandLandmarks.map((handLandmarks, index) => {
    const landmarks = getMirroredLandmarks(handLandmarks);
    const bounds = getBounds(landmarks);
    const palm = getPalmCenter(landmarks);
    const fingertip = {
      x: (landmarks[8].x + landmarks[12].x) * 0.5,
      y: (landmarks[8].y + landmarks[12].y) * 0.5,
    };
    const rawLabel = results.multiHandedness?.[index]?.label ?? "";
    const actualLabel = rawLabel === "Left" ? "Right" : rawLabel === "Right" ? "Left" : "";

    return {
      landmarks,
      bounds,
      palm,
      fingertip,
      label: actualLabel,
      score: palm.x * 4 + bounds.width * bounds.height,
    };
  });

  const rightLabelCandidates = candidates
    .filter((candidate) => candidate.label === "Right")
    .sort((a, b) => b.score - a.score);
  if (rightLabelCandidates.length > 0) {
    return rightLabelCandidates[0];
  }

  const screenRightCandidates = candidates
    .filter((candidate) => candidate.palm.x >= 0.5)
    .sort((a, b) => b.score - a.score);
  return screenRightCandidates[0] ?? null;
}

function resetSmoothing() {
  state.smoothX = null;
  state.smoothY = null;
  state.smoothSize = null;
}

function syncEffectAudio(isVisible) {
  const audio = state.effectAudios[state.selectedEffect];
  if (!audio) {
    return;
  }

  if (isVisible) {
    if (!state.effectAudioActive) {
      state.effectAudioActive = true;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    return;
  }

  if (state.effectAudioActive) {
    state.effectAudioActive = false;
    audio.pause();
    audio.currentTime = 0;
  }
}

function drawBackground(width, height) {
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(dom.video, 0, 0, width, height);
  ctx.restore();
}

function ensureEffectCanvas(workWidth, workHeight) {
  if (
    state.effectCanvas.width !== workWidth
    || state.effectCanvas.height !== workHeight
  ) {
    state.effectCanvas.width = workWidth;
    state.effectCanvas.height = workHeight;
  }
}

function drawMaskedEffectFrame(effectVideo, drawX, drawY, drawWidth, drawHeight, effect) {
  const area = drawWidth * drawHeight;
  let workScale = 1;
  if (area > EFFECT_MAX_WORK_PIXELS) {
    workScale = Math.sqrt(EFFECT_MAX_WORK_PIXELS / area);
  }

  const workWidth = Math.max(24, Math.round(drawWidth * workScale));
  const workHeight = Math.max(24, Math.round(drawHeight * workScale));
  ensureEffectCanvas(workWidth, workHeight);

  state.effectCtx.clearRect(0, 0, workWidth, workHeight);
  state.effectCtx.drawImage(effectVideo, 0, 0, workWidth, workHeight);
  const imageData = state.effectCtx.getImageData(0, 0, workWidth, workHeight);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const luma = Math.max(r, g, b);
    if (luma <= EFFECT_EDGE_THRESHOLD) {
      pixels[i + 3] = 0;
      continue;
    }

    const alpha = clamp((luma - EFFECT_EDGE_THRESHOLD) / EFFECT_EDGE_SOFTNESS, 0, 1);
    pixels[i + 3] = Math.round(alpha * 255);
  }

  state.effectCtx.putImageData(imageData, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.98;
  ctx.drawImage(state.effectCanvas, drawX, drawY, drawWidth, drawHeight);
  ctx.globalAlpha = effect.glowAlpha;
  ctx.drawImage(
    state.effectCanvas,
    drawX - drawWidth * 0.06,
    drawY - drawHeight * 0.06,
    drawWidth * 1.12,
    drawHeight * 1.12,
  );
  ctx.restore();
}

function drawEffectOverlay(hand, width, height) {
  const effect = EFFECTS[state.selectedEffect];
  const effectVideo = state.effectVideos[state.selectedEffect];
  if (!effect || !effectVideo || effectVideo.readyState < 2) {
    return;
  }

  const baseX = lerp(hand.palm.x, hand.fingertip.x, 0.12) * width;
  const baseY = lerp(hand.palm.y, hand.fingertip.y, 0.12) * height;
  const handSpan = Math.max(hand.bounds.width * width, hand.bounds.height * height);
  const nextSize = clamp(handSpan * effect.scale, effect.minSize, width * effect.maxRatio);

  state.smoothX = state.smoothX == null ? baseX : lerp(state.smoothX, baseX, 0.24);
  state.smoothY = state.smoothY == null ? baseY : lerp(state.smoothY, baseY, 0.22);
  state.smoothSize = state.smoothSize == null ? nextSize : lerp(state.smoothSize, nextSize, 0.2);

  const effectAspect = effectVideo.videoWidth > 0 && effectVideo.videoHeight > 0
    ? effectVideo.videoWidth / effectVideo.videoHeight
    : 1;

  const drawWidth = state.smoothSize;
  const drawHeight = drawWidth / effectAspect;
  const drawX = state.smoothX - drawWidth * effect.anchorX;
  const drawY = state.smoothY - drawHeight * effect.anchorY;
  drawMaskedEffectFrame(effectVideo, drawX, drawY, drawWidth, drawHeight, effect);
}

function drawFrame() {
  if (!state.running || dom.video.readyState < 2) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height);

  const rightHand = getRightHand(state.latestResults);
  const trackingText = updateGestureState(rightHand);
  dom.trackingLabel.textContent = trackingText;
  if (rightHand && state.effectVisible) {
    drawEffectOverlay(rightHand, width, height);
    syncEffectAudio(true);
  } else {
    resetSmoothing();
    syncEffectAudio(false);
  }
}

function renderLoop() {
  if (!state.running) {
    return;
  }

  drawFrame();

  const now = performance.now();
  if (
    state.hands
    && dom.video.readyState >= 2
    && !state.processing
    && now - state.lastHandSendAt >= CAMERA_TRACK_INTERVAL_MS
  ) {
    state.processing = true;
    state.lastHandSendAt = now;
    state.trackCtx.drawImage(dom.video, 0, 0, CAMERA_TRACK_WIDTH, CAMERA_TRACK_HEIGHT);
    state.hands
      .send({ image: state.trackCanvas })
      .catch((error) => {
        console.error(error);
        showError("손 추적을 다시 불러오지 못했습니다.");
      })
      .finally(() => {
        state.processing = false;
      });
  }

  state.rafId = window.requestAnimationFrame(renderLoop);
}

async function playSelectedEffect(resetTime = false) {
  Object.entries(state.effectVideos).forEach(([key, video]) => {
    if (key !== state.selectedEffect) {
      video.pause();
      return;
    }
    if (resetTime) {
      video.currentTime = 0;
    }
    video.play().catch(() => {});
  });
}

async function startCamera() {
  if (state.stream) {
    return;
  }

  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: CAMERA_CAPTURE_WIDTH, max: 1280 },
      height: { ideal: CAMERA_CAPTURE_HEIGHT, max: 720 },
      frameRate: { ideal: CAMERA_CAPTURE_FPS, max: 30 },
    },
  });

  dom.video.srcObject = state.stream;
  await dom.video.play();
}

async function startExperience(effectKey) {
  showError("");
  state.selectedEffect = effectKey;
  dom.effectLabel.textContent = EFFECTS[effectKey].label;
  dom.trackingLabel.textContent = "검지+중지 대기중";
  state.gateArmedUntil = 0;
  state.effectVisible = false;
  resetSmoothing();

  try {
    await ensureHands();
    await startCamera();
    await playSelectedEffect(true);
    state.running = true;
    setScreen("camera");
    resizeCanvas();
    window.cancelAnimationFrame(state.rafId);
    state.rafId = window.requestAnimationFrame(renderLoop);
  } catch (error) {
    console.error(error);
    state.running = false;
    showError("카메라를 열지 못했습니다. 브라우저에서 카메라 권한을 허용해 주세요.");
  }
}

function stopCamera() {
  if (!state.stream) {
    return;
  }
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  dom.video.srcObject = null;
}

function stopExperience() {
  state.running = false;
  window.cancelAnimationFrame(state.rafId);
  state.rafId = 0;
  state.latestResults = null;
  state.gateArmedUntil = 0;
  state.effectVisible = false;
  resetSmoothing();
  syncEffectAudio(false);
  Object.values(state.effectVideos).forEach((video) => video.pause());
  stopCamera();
  setScreen("launcher");
}

function bindEvents() {
  document.querySelectorAll("[data-effect]").forEach((button) => {
    button.addEventListener("click", () => {
      startExperience(button.dataset.effect);
    });
  });

  dom.backButton.addEventListener("click", () => {
    stopExperience();
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", stopCamera);
}

function boot() {
  const trackCanvas = document.createElement("canvas");
  trackCanvas.width = CAMERA_TRACK_WIDTH;
  trackCanvas.height = CAMERA_TRACK_HEIGHT;
  const trackCtx = trackCanvas.getContext("2d", { alpha: false });
  trackCtx.imageSmoothingEnabled = true;
  trackCtx.imageSmoothingQuality = "low";
  state.trackCanvas = trackCanvas;
  state.trackCtx = trackCtx;
  state.effectCanvas = document.createElement("canvas");
  state.effectCtx = state.effectCanvas.getContext("2d", { willReadFrequently: true });
  buildEffectVideos();
  bindEvents();
  resizeCanvas();
}

boot();
