const SIZE_CALIBRATION_STORAGE_KEY = "naruto-size-calibration:deidara";
const DEFAULT_SIZE_POINTS = [
  { handSize: 0.12, scale: 100 },
  { handSize: 0.2, scale: 100 },
  { handSize: 0.3, scale: 100 },
];
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
  trackCanvas: document.createElement("canvas"),
};
state.trackCanvas.width = 640;
state.trackCanvas.height = 360;
state.trackCtx = state.trackCanvas.getContext("2d", { alpha: false });

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

function renderLoop() {
  const width = dom.canvas.width;
  const height = dom.canvas.height;
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
  await ensureHands();
  await startCamera();
  renderLoop();
}

boot().catch((error) => {
  console.error(error);
});
