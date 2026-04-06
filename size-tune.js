const SIZE_CALIBRATION_STORAGE_KEY = "naruto-size-calibration:deidara";
const VIDEO_TUNING_STORAGE_PREFIX = "naruto-video-tuning:";
const DEIDARA_HAND_EFFECT = {
  source: "assets/손.mp4?v=20260406-2333",
  thumbMinRatio: 0.16,
  thumbBaseRatio: 0.18,
  thumbHandRatioScale: 1.0,
  thumbMaxRatio: 0.5,
  anchorX: 0.5,
  anchorY: 0.52,
};
const DEFAULT_SIZE_POINTS = [
  { handSize: 0.3855, scale: 26 },
  { handSize: 0.4168, scale: 30 },
  { handSize: 0.6346, scale: 41 },
];
const DEFAULT_VIDEO_TUNING = {
  edgeThreshold: 30,
  edgeSoftness: 36,
  alphaPower: 140,
  greenMin: 28,
  greenBias: 20,
  despill: 92,
};
const DEFAULT_VIDEO_TUNING_BY_ASSET = {
  hand: {
    edgeThreshold: 0,
    edgeSoftness: 1,
    alphaPower: 100,
    greenMin: 13,
    greenBias: 9,
    despill: 72,
  },
};
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const dom = {
  canvas: document.getElementById("sizeCanvas"),
  video: document.getElementById("sizeVideo"),
  readout: document.getElementById("sizeReadout"),
  scaleSlider: document.getElementById("scaleSlider"),
  scaleSliderValue: document.getElementById("scaleSliderValue"),
  pointDump: document.getElementById("pointDump"),
  saveSlot1: document.getElementById("saveSlot1"),
  saveSlot2: document.getElementById("saveSlot2"),
  saveSlot3: document.getElementById("saveSlot3"),
  resetButton: document.getElementById("resetSizePoints"),
};

const ctx = dom.canvas.getContext("2d", { alpha: false });
const state = {
  hands: null,
  latestResults: null,
  stream: null,
  rafId: 0,
  processing: false,
  currentHandSize: null,
  effectCanvas: document.createElement("canvas"),
  effectVideo: null,
  trackCanvas: document.createElement("canvas"),
};
state.trackCanvas.width = 640;
state.trackCanvas.height = 360;
state.trackCtx = state.trackCanvas.getContext("2d", { alpha: false });
state.effectCtx = state.effectCanvas.getContext("2d", { willReadFrequently: true });

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSavedPoints() {
  try {
    const raw = window.localStorage.getItem(SIZE_CALIBRATION_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SIZE_POINTS.map((point) => ({ ...point }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 3) {
      return DEFAULT_SIZE_POINTS.map((point) => ({ ...point }));
    }
    return parsed.map((point, index) => ({
      handSize: Number.isFinite(Number(point?.handSize)) ? Number(point.handSize) : DEFAULT_SIZE_POINTS[index].handSize,
      scale: Number.isFinite(Number(point?.scale)) ? clamp(Number(point.scale), 5, 240) : DEFAULT_SIZE_POINTS[index].scale,
    }));
  } catch (_error) {
    return DEFAULT_SIZE_POINTS.map((point) => ({ ...point }));
  }
}

function getVideoTuningKey(assetKey) {
  return `${VIDEO_TUNING_STORAGE_PREFIX}${assetKey}`;
}

function getDefaultVideoTuning(assetKey) {
  return {
    ...DEFAULT_VIDEO_TUNING,
    ...(DEFAULT_VIDEO_TUNING_BY_ASSET[assetKey] ?? {}),
  };
}

function readSavedVideoTuning(assetKey) {
  const defaults = getDefaultVideoTuning(assetKey);
  try {
    const raw = window.localStorage.getItem(getVideoTuningKey(assetKey));
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return {
      edgeThreshold: Number.isFinite(Number(parsed?.edgeThreshold)) ? Number(parsed.edgeThreshold) : defaults.edgeThreshold,
      edgeSoftness: Number.isFinite(Number(parsed?.edgeSoftness)) ? Number(parsed.edgeSoftness) : defaults.edgeSoftness,
      alphaPower: Number.isFinite(Number(parsed?.alphaPower)) ? Number(parsed.alphaPower) : defaults.alphaPower,
      greenMin: Number.isFinite(Number(parsed?.greenMin)) ? Number(parsed.greenMin) : defaults.greenMin,
      greenBias: Number.isFinite(Number(parsed?.greenBias)) ? Number(parsed.greenBias) : defaults.greenBias,
      despill: Number.isFinite(Number(parsed?.despill)) ? Number(parsed.despill) : defaults.despill,
    };
  } catch (_error) {
    return defaults;
  }
}

function savePoints(points) {
  window.localStorage.setItem(SIZE_CALIBRATION_STORAGE_KEY, JSON.stringify(points));
}

function updatePointDump() {
  const points = getSavedPoints();
  dom.pointDump.textContent = JSON.stringify(points, null, 2);
}

function updateSliderUi() {
  dom.scaleSliderValue.textContent = `${Math.round(Number(dom.scaleSlider.value))}%`;
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

function getLargestHand(results) {
  if (!results?.multiHandLandmarks?.length) {
    return null;
  }

  return results.multiHandLandmarks
    .map((handLandmarks) => {
      const landmarks = getMirroredLandmarks(handLandmarks);
      const bounds = getBounds(landmarks);
      return {
        landmarks,
        bounds,
        handSize: Math.max(bounds.width, bounds.height),
      };
    })
    .sort((a, b) => b.handSize - a.handSize)[0];
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

function drawHand(hand, width, height) {
  if (!hand) {
    return;
  }

  const points = hand.landmarks.map((landmark) => ({
    x: landmark.x * width,
    y: landmark.y * height,
  }));

  ctx.save();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(255, 213, 140, 0.95)";
  ctx.fillStyle = "rgba(248, 252, 255, 0.95)";
  for (const [from, to] of HAND_CONNECTIONS) {
    const a = points[from];
    const b = points[to];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ensureEffectCanvas(workWidth, workHeight) {
  if (state.effectCanvas.width !== workWidth || state.effectCanvas.height !== workHeight) {
    state.effectCanvas.width = workWidth;
    state.effectCanvas.height = workHeight;
  }
}

function drawHandOverlay(hand, width, height) {
  if (!hand || !state.effectVideo || state.effectVideo.readyState < 2) {
    return;
  }

  const palm = getPalmCenter(hand.landmarks);
  const handRatio = hand.handSize;
  const targetRatio = clamp(
    DEIDARA_HAND_EFFECT.thumbBaseRatio + handRatio * DEIDARA_HAND_EFFECT.thumbHandRatioScale,
    DEIDARA_HAND_EFFECT.thumbMinRatio,
    DEIDARA_HAND_EFFECT.thumbMaxRatio,
  );
  const drawWidth = width * targetRatio * (Number(dom.scaleSlider.value) / 100);
  const aspect = state.effectVideo.videoWidth > 0 && state.effectVideo.videoHeight > 0
    ? state.effectVideo.videoWidth / state.effectVideo.videoHeight
    : 1;
  const drawHeight = drawWidth / aspect;
  const drawX = palm.x * width - drawWidth * DEIDARA_HAND_EFFECT.anchorX;
  const drawY = palm.y * height - drawHeight * DEIDARA_HAND_EFFECT.anchorY;

  const workWidth = Math.max(24, Math.round(drawWidth));
  const workHeight = Math.max(24, Math.round(drawHeight));
  ensureEffectCanvas(workWidth, workHeight);
  state.effectCtx.clearRect(0, 0, workWidth, workHeight);
  state.effectCtx.drawImage(state.effectVideo, 0, 0, workWidth, workHeight);

  const tuning = readSavedVideoTuning("hand");
  const imageData = state.effectCtx.getImageData(0, 0, workWidth, workHeight);
  const pixels = imageData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const maxOther = Math.max(r, b);
    const greenSignal = g - maxOther;
    const greenGate = g > tuning.greenMin && g > r + tuning.greenBias && g > b + tuning.greenBias;

    if (!greenGate || greenSignal <= tuning.edgeThreshold) {
      pixels[i + 3] = 255;
      continue;
    }

    const cut = clamp(
      (greenSignal - tuning.edgeThreshold) / Math.max(1, tuning.edgeSoftness),
      0,
      1,
    );
    const alpha = Math.pow(1 - cut, tuning.alphaPower / 100);
    pixels[i + 3] = Math.round(alpha * 255);

    if (g > maxOther) {
      const despill = cut * (tuning.despill / 100);
      pixels[i + 1] = Math.round(g - (g - maxOther) * despill);
    }
  }

  state.effectCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(state.effectCanvas, drawX, drawY, drawWidth, drawHeight);
}

function renderLoop() {
  const width = dom.canvas.width;
  const height = dom.canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(dom.video, 0, 0, width, height);
  ctx.restore();

  const hand = getLargestHand(state.latestResults);
  state.currentHandSize = hand?.handSize ?? null;
  dom.readout.textContent = hand
    ? `손 크기: ${hand.handSize.toFixed(4)}`
    : "손 크기: -";
  drawHandOverlay(hand, width, height);
  drawHand(hand, width, height);

  if (!state.processing && state.hands && dom.video.readyState >= 2) {
    state.processing = true;
    state.trackCtx.drawImage(dom.video, 0, 0, state.trackCanvas.width, state.trackCanvas.height);
    state.hands.send({ image: state.trackCanvas }).finally(() => {
      state.processing = false;
    });
  }

  state.rafId = requestAnimationFrame(renderLoop);
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
    minDetectionConfidence: 0.4,
    minTrackingConfidence: 0.3,
  });

  hands.onResults((results) => {
    state.latestResults = results;
  });

  state.hands = hands;
  return hands;
}

async function startCamera() {
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
  });
  dom.video.srcObject = state.stream;
  await dom.video.play();
}

function buildEffectVideo() {
  const video = document.createElement("video");
  video.src = DEIDARA_HAND_EFFECT.source;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  state.effectVideo = video;
  video.play().catch(() => {});
}

function saveSlot(index) {
  if (!Number.isFinite(state.currentHandSize)) {
    return;
  }
  const points = getSavedPoints();
  points[index] = {
    handSize: Number(state.currentHandSize.toFixed(4)),
    scale: Number(dom.scaleSlider.value),
  };
  savePoints(points);
  updatePointDump();
}

function bindEvents() {
  dom.scaleSlider.addEventListener("input", updateSliderUi);
  dom.saveSlot1.addEventListener("click", () => saveSlot(0));
  dom.saveSlot2.addEventListener("click", () => saveSlot(1));
  dom.saveSlot3.addEventListener("click", () => saveSlot(2));
  dom.resetButton.addEventListener("click", () => {
    savePoints(DEFAULT_SIZE_POINTS.map((point) => ({ ...point })));
    updatePointDump();
  });
  window.addEventListener("beforeunload", () => {
    state.stream?.getTracks().forEach((track) => track.stop());
    cancelAnimationFrame(state.rafId);
  });
}

async function boot() {
  updateSliderUi();
  updatePointDump();
  bindEvents();
  buildEffectVideo();
  await ensureHands();
  await startCamera();
  renderLoop();
}

boot().catch((error) => {
  console.error(error);
});
