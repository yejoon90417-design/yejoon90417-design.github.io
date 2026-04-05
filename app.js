const EFFECTS = {
  rasengan: {
    label: "나선환",
    source: "assets/naruto.mp4",
    scale: 6.8,
    minSize: 260,
    maxRatio: 0.72,
    anchorX: 0.5,
    anchorY: 0.56,
    glow: "rgba(79, 220, 255, 0.95)",
  },
  chidori: {
    label: "치도리",
    source: "assets/sasuke.mp4",
    scale: 9.2,
    minSize: 420,
    maxRatio: 1.05,
    anchorX: 0.45,
    anchorY: 0.52,
    glow: "rgba(140, 196, 255, 0.95)",
  },
};

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
  smoothX: null,
  smoothY: null,
  smoothSize: null,
  effectVideos: {},
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
    maxNumHands: 2,
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
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  dom.canvas.width = Math.floor(width * dpr);
  dom.canvas.height = Math.floor(height * dpr);
  dom.canvas.style.width = `${width}px`;
  dom.canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function drawBackground(width, height) {
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(dom.video, 0, 0, width, height);
  ctx.restore();

  const wash = ctx.createLinearGradient(0, 0, 0, height);
  wash.addColorStop(0, "rgba(0, 8, 18, 0.10)");
  wash.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
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

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `drop-shadow(0 0 36px ${effect.glow})`;
  ctx.globalAlpha = 0.98;
  ctx.drawImage(effectVideo, drawX, drawY, drawWidth, drawHeight);

  ctx.globalAlpha = 0.28;
  ctx.drawImage(
    effectVideo,
    drawX - drawWidth * 0.08,
    drawY - drawHeight * 0.08,
    drawWidth * 1.16,
    drawHeight * 1.16,
  );
  ctx.restore();
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
  if (rightHand) {
    dom.trackingLabel.textContent = "오른손 추적중";
    drawEffectOverlay(rightHand, width, height);
  } else {
    dom.trackingLabel.textContent = "오른손 대기중";
    resetSmoothing();
  }
}

function renderLoop() {
  if (!state.running) {
    return;
  }

  drawFrame();

  if (state.hands && dom.video.readyState >= 2 && !state.processing) {
    state.processing = true;
    state.hands
      .send({ image: dom.video })
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
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  dom.video.srcObject = state.stream;
  await dom.video.play();
}

async function startExperience(effectKey) {
  showError("");
  state.selectedEffect = effectKey;
  dom.effectLabel.textContent = EFFECTS[effectKey].label;
  dom.trackingLabel.textContent = "오른손 대기중";
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
  resetSmoothing();
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
  buildEffectVideos();
  bindEvents();
  resizeCanvas();
}

boot();
