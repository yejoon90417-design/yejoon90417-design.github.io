const CALIBRATION_TARGETS = [
  { x: 0.5, y: 0.5 },
  { x: 0.16, y: 0.18 },
  { x: 0.5, y: 0.18 },
  { x: 0.84, y: 0.18 },
  { x: 0.16, y: 0.5 },
  { x: 0.84, y: 0.5 },
  { x: 0.16, y: 0.82 },
  { x: 0.5, y: 0.82 },
  { x: 0.84, y: 0.82 },
];

const CALIBRATION_SETTLE_MS = 1000;
const CALIBRATION_SAMPLE_MS = 1800;
const CALIBRATION_SAMPLE_INTERVAL_MS = 50;
const MIN_SAMPLES_PER_TARGET = 8;
const LIVE_SMOOTHING = 0.2;
const MODEL_LAMBDA = 0.16;
const FACE_TIMEOUT_MS = 500;
const GAZE_PROFILE_STORAGE_KEY = "naruto-gaze-profile";

const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_UPPER_LID = [386, 385, 384];
const LEFT_LOWER_LID = [374, 380, 381];
const RIGHT_UPPER_LID = [159, 158, 157];
const RIGHT_LOWER_LID = [145, 153, 154];
const LEFT_EYE_RING = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const RIGHT_EYE_RING = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];

const dom = {
  video: document.getElementById("gazeVideo"),
  stage: document.getElementById("gazeStage"),
  startButton: document.getElementById("gazeStartButton"),
  resetButton: document.getElementById("gazeResetButton"),
  status: document.getElementById("gazeStatus"),
  metrics: document.getElementById("gazeMetrics"),
};

const stageCtx = dom.stage.getContext("2d");

const state = {
  calibration: null,
  faceMesh: null,
  frameBusy: false,
  latestFeatures: null,
  latestLandmarks: null,
  lastFaceSeenAt: 0,
  model: null,
  bias: {
    x: 0,
    y: 0,
  },
  pointer: {
    x: 0.5,
    y: 0.5,
    visible: false,
  },
  rafId: 0,
  running: false,
  starting: false,
  stream: null,
  trackingRafId: 0,
  trainingSamples: [],
  trail: [],
};

function persistGazeProfile() {
  if (!state.model) {
    return;
  }

  try {
    window.localStorage.setItem(
      GAZE_PROFILE_STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        model: state.model,
        bias: state.bias,
      }),
    );
  } catch (_error) {
    // ignore
  }
}

function setStatus(message) {
  dom.status.textContent = message;
}

function setMetrics(message) {
  dom.metrics.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, ratio) {
  return from + (to - from) * ratio;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function averagePoint(landmarks, indices) {
  const point = { x: 0, y: 0, z: 0 };
  for (const index of indices) {
    point.x += landmarks[index].x;
    point.y += landmarks[index].y;
    point.z += landmarks[index].z ?? 0;
  }

  const scale = 1 / indices.length;
  point.x *= scale;
  point.y *= scale;
  point.z *= scale;
  return point;
}

function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    length,
  };
}

function computeEyeFeatureSet(landmarks, config) {
  const outer = landmarks[config.outer];
  const inner = landmarks[config.inner];
  const top = averagePoint(landmarks, config.top);
  const bottom = averagePoint(landmarks, config.bottom);
  const iris = averagePoint(landmarks, config.iris);
  const eyeCenter = {
    x: (outer.x + inner.x + top.x + bottom.x) * 0.25,
    y: (outer.y + inner.y + top.y + bottom.y) * 0.25,
  };

  const horizontalVector = subtract(inner, outer);
  const verticalVector = subtract(bottom, top);
  const horizontalAxis = normalize(horizontalVector);
  const verticalAxis = normalize(verticalVector);

  if (horizontalAxis.length < 0.01 || verticalAxis.length < 0.003) {
    return null;
  }

  const irisOffset = subtract(iris, eyeCenter);

  return {
    center: eyeCenter,
    horizontal: dot(irisOffset, horizontalAxis) / (horizontalAxis.length * 0.5),
    vertical: dot(irisOffset, verticalAxis) / (verticalAxis.length * 0.5),
    openness: verticalAxis.length / horizontalAxis.length,
    iris,
  };
}

function computeFaceBounds(landmarks) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function buildFeatureVector(landmarks) {
  const leftEye = computeEyeFeatureSet(landmarks, {
    outer: 263,
    inner: 362,
    top: LEFT_UPPER_LID,
    bottom: LEFT_LOWER_LID,
    iris: LEFT_IRIS,
  });
  const rightEye = computeEyeFeatureSet(landmarks, {
    outer: 33,
    inner: 133,
    top: RIGHT_UPPER_LID,
    bottom: RIGHT_LOWER_LID,
    iris: RIGHT_IRIS,
  });

  if (!leftEye || !rightEye) {
    return null;
  }

  const nose = landmarks[1];
  const betweenEyes = averagePoint(landmarks, [168]);
  const interocular = distance(leftEye.center, rightEye.center);
  if (interocular < 0.03) {
    return null;
  }

  const avgHorizontal = (leftEye.horizontal + rightEye.horizontal) * 0.5;
  const avgVertical = (leftEye.vertical + rightEye.vertical) * 0.5;
  const headX = (nose.x - betweenEyes.x) / interocular;
  const headY = (nose.y - betweenEyes.y) / interocular;

  return {
    bounds: computeFaceBounds(landmarks),
    leftEye,
    rightEye,
    vector: [
      avgHorizontal,
      avgVertical,
      leftEye.horizontal,
      rightEye.horizontal,
      leftEye.vertical,
      rightEye.vertical,
      headX,
      headY,
      interocular,
      leftEye.openness,
      rightEye.openness,
      avgHorizontal * avgVertical,
      avgHorizontal * headX,
      avgVertical * headY,
      headX * headY,
    ],
  };
}

function solveLinearSystem(matrix, vector) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => row.slice().concat(vector[index]));

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < 1e-8) {
      return null;
    }

    if (pivotRow !== column) {
      [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
    }

    const pivot = augmented[column][column];
    for (let current = column; current <= size; current += 1) {
      augmented[column][current] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmented[row][column];
      if (!factor) {
        continue;
      }

      for (let current = column; current <= size; current += 1) {
        augmented[row][current] -= factor * augmented[column][current];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function buildModel(samples) {
  const featureCount = samples[0]?.features.length ?? 0;
  if (!featureCount) {
    return null;
  }

  const mean = Array(featureCount).fill(0);
  const deviation = Array(featureCount).fill(0);

  for (const sample of samples) {
    for (let index = 0; index < featureCount; index += 1) {
      mean[index] += sample.features[index];
    }
  }

  for (let index = 0; index < featureCount; index += 1) {
    mean[index] /= samples.length;
  }

  for (const sample of samples) {
    for (let index = 0; index < featureCount; index += 1) {
      const delta = sample.features[index] - mean[index];
      deviation[index] += delta * delta;
    }
  }

  for (let index = 0; index < featureCount; index += 1) {
    deviation[index] = Math.sqrt(deviation[index] / samples.length) || 1;
  }

  const designSize = featureCount + 1;
  const xtx = Array.from({ length: designSize }, () => Array(designSize).fill(0));
  const xtyX = Array(designSize).fill(0);
  const xtyY = Array(designSize).fill(0);

  for (const sample of samples) {
    const row = [1];
    for (let index = 0; index < featureCount; index += 1) {
      row.push((sample.features[index] - mean[index]) / deviation[index]);
    }

    for (let left = 0; left < designSize; left += 1) {
      xtyX[left] += row[left] * sample.targetX;
      xtyY[left] += row[left] * sample.targetY;
      for (let right = 0; right < designSize; right += 1) {
        xtx[left][right] += row[left] * row[right];
      }
    }
  }

  for (let index = 1; index < designSize; index += 1) {
    xtx[index][index] += MODEL_LAMBDA;
  }

  const weightsX = solveLinearSystem(xtx.map((row) => row.slice()), xtyX);
  const weightsY = solveLinearSystem(xtx.map((row) => row.slice()), xtyY);
  if (!weightsX || !weightsY) {
    return null;
  }

  return { deviation, mean, weightsX, weightsY };
}

function predict(model, features) {
  const row = [1];
  for (let index = 0; index < features.length; index += 1) {
    row.push((features[index] - model.mean[index]) / model.deviation[index]);
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < row.length; index += 1) {
    x += row[index] * model.weightsX[index];
    y += row[index] * model.weightsY[index];
  }

  return {
    x: clamp(x, 0.02, 0.98),
    y: clamp(y, 0.02, 0.98),
  };
}

function predictWithBias(features) {
  if (!state.model) {
    return null;
  }

  const raw = predict(state.model, features);
  return {
    x: clamp(raw.x + state.bias.x, 0.02, 0.98),
    y: clamp(raw.y + state.bias.y, 0.02, 0.98),
    raw,
  };
}

function resizeCanvas(canvas, context) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function syncCanvasSizes() {
  resizeCanvas(dom.stage, stageCtx);
}

function projectToStage(normalizedPoint) {
  return {
    x: normalizedPoint.x * dom.stage.clientWidth,
    y: normalizedPoint.y * dom.stage.clientHeight,
  };
}

function pushTrail(now) {
  state.trail.push({
    time: now,
    x: state.pointer.x,
    y: state.pointer.y,
  });
  state.trail = state.trail.filter((entry) => now - entry.time < 320);
}

function publishGazePoint() {
  const width = dom.stage.clientWidth || window.innerWidth;
  const height = dom.stage.clientHeight || window.innerHeight;

  window.__narutoGaze = {
    calibrated: Boolean(state.model),
    faceDetected: Boolean(state.latestFeatures),
    timestamp: Date.now(),
    x: state.pointer.visible ? state.pointer.x * width : null,
    y: state.pointer.visible ? state.pointer.y * height : null,
    xNorm: state.pointer.visible ? state.pointer.x : null,
    yNorm: state.pointer.visible ? state.pointer.y : null,
  };
}

function beginCalibration() {
  state.calibration = {
    index: 0,
    phase: "settle",
    phaseStartedAt: performance.now(),
    pointSamples: [],
    sampleClock: 0,
  };
  state.model = null;
  state.bias.x = 0;
  state.bias.y = 0;
  state.pointer.visible = false;
  state.trainingSamples = [];
  state.trail = [];
  dom.startButton.disabled = true;
  dom.resetButton.disabled = true;
  setStatus("머리를 최대한 고정하고 주황 점을 눈으로 따라가세요.");
  setMetrics(`보정 1 / ${CALIBRATION_TARGETS.length}`);
  publishGazePoint();
}

function completeCalibration() {
  const model = buildModel(state.trainingSamples);
  if (!model) {
    state.calibration = null;
    dom.startButton.disabled = false;
    dom.resetButton.disabled = false;
    setStatus("보정에 실패했습니다. 얼굴 데이터가 너무 불안정합니다. 다시 시도하세요.");
    setMetrics("모델 계산에 실패했습니다.");
    return;
  }

  state.model = model;
  state.calibration = null;
  dom.startButton.disabled = true;
  dom.resetButton.disabled = false;
  persistGazeProfile();
  setStatus("보정이 끝났습니다. 화면을 보며 포인터를 확인하세요.");
  setMetrics(`실시간 추적 | 샘플 ${state.trainingSamples.length}개`);
}

function updateCalibration(now) {
  if (!state.calibration) {
    return;
  }

  const currentTarget = CALIBRATION_TARGETS[state.calibration.index];
  if (!currentTarget) {
    completeCalibration();
    return;
  }

  if (state.calibration.phase === "settle") {
    const remaining = Math.max(0, CALIBRATION_SETTLE_MS - (now - state.calibration.phaseStartedAt));
    setMetrics(`보정 ${state.calibration.index + 1} / ${CALIBRATION_TARGETS.length} | 준비 ${Math.ceil(remaining / 100)} / 10`);
    if (now - state.calibration.phaseStartedAt >= CALIBRATION_SETTLE_MS) {
      state.calibration.phase = "collect";
      state.calibration.phaseStartedAt = now;
      state.calibration.sampleClock = 0;
      state.calibration.pointSamples = [];
    }
    return;
  }

  if (!state.latestFeatures) {
    setMetrics(`보정 ${state.calibration.index + 1} / ${CALIBRATION_TARGETS.length} | 얼굴 인식 안 됨`);
  } else if (now - state.calibration.sampleClock >= CALIBRATION_SAMPLE_INTERVAL_MS) {
    state.calibration.sampleClock = now;
    state.calibration.pointSamples.push({
      features: state.latestFeatures.vector.slice(),
      targetX: currentTarget.x,
      targetY: currentTarget.y,
    });
    setMetrics(`보정 ${state.calibration.index + 1} / ${CALIBRATION_TARGETS.length} | 샘플 ${state.calibration.pointSamples.length}개`);
  }

  if (now - state.calibration.phaseStartedAt < CALIBRATION_SAMPLE_MS) {
    return;
  }

  if (state.calibration.pointSamples.length < MIN_SAMPLES_PER_TARGET) {
    state.calibration.phase = "settle";
    state.calibration.phaseStartedAt = now;
    state.calibration.pointSamples = [];
    setStatus("얼굴 데이터가 끊겨서 현재 점을 다시 측정합니다.");
    return;
  }

  state.trainingSamples.push(...state.calibration.pointSamples);
  state.calibration.index += 1;
  state.calibration.phase = "settle";
  state.calibration.phaseStartedAt = now;
  state.calibration.pointSamples = [];

  if (state.calibration.index >= CALIBRATION_TARGETS.length) {
    completeCalibration();
  }
}

function drawStageGrid(width, height) {
  const gridSize = Math.max(64, Math.floor(width / 12));
  stageCtx.save();
  stageCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  stageCtx.lineWidth = 1;

  for (let x = gridSize; x < width; x += gridSize) {
    stageCtx.beginPath();
    stageCtx.moveTo(x, 0);
    stageCtx.lineTo(x, height);
    stageCtx.stroke();
  }

  for (let y = gridSize; y < height; y += gridSize) {
    stageCtx.beginPath();
    stageCtx.moveTo(0, y);
    stageCtx.lineTo(width, y);
    stageCtx.stroke();
  }

  stageCtx.restore();
}

function drawCalibrationTarget(now) {
  if (!state.calibration) {
    return;
  }

  const target = CALIBRATION_TARGETS[state.calibration.index];
  if (!target) {
    return;
  }

  const point = projectToStage(target);
  const phaseDuration = state.calibration.phase === "settle" ? CALIBRATION_SETTLE_MS : CALIBRATION_SAMPLE_MS;
  const phaseProgress = clamp((now - state.calibration.phaseStartedAt) / phaseDuration, 0, 1);
  const pulse = 1 + Math.sin(now * 0.012) * 0.08;

  stageCtx.save();
  stageCtx.translate(point.x, point.y);
  stageCtx.shadowBlur = 40;
  stageCtx.shadowColor = "rgba(255, 100, 48, 0.55)";

  stageCtx.beginPath();
  stageCtx.fillStyle = "rgba(255, 86, 48, 0.8)";
  stageCtx.arc(0, 0, 10 * pulse, 0, Math.PI * 2);
  stageCtx.fill();

  stageCtx.beginPath();
  stageCtx.lineWidth = 3;
  stageCtx.strokeStyle = state.calibration.phase === "settle"
    ? "rgba(255, 194, 145, 0.88)"
    : "rgba(255, 110, 72, 0.95)";
  stageCtx.arc(0, 0, 34 - phaseProgress * 12, 0, Math.PI * 2);
  stageCtx.stroke();

  stageCtx.beginPath();
  stageCtx.lineWidth = 1;
  stageCtx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  stageCtx.moveTo(-18, 0);
  stageCtx.lineTo(18, 0);
  stageCtx.moveTo(0, -18);
  stageCtx.lineTo(0, 18);
  stageCtx.stroke();
  stageCtx.restore();
}

function drawPointer(now) {
  if (!state.pointer.visible) {
    return;
  }

  for (const entry of state.trail) {
    const age = clamp((now - entry.time) / 320, 0, 1);
    const point = projectToStage(entry);
    const radius = lerp(5, 18, age);
    const alpha = 0.25 * (1 - age);

    stageCtx.beginPath();
    stageCtx.fillStyle = `rgba(255, 112, 84, ${alpha})`;
    stageCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    stageCtx.fill();
  }

  const point = projectToStage(state.pointer);
  stageCtx.save();
  stageCtx.translate(point.x, point.y);
  stageCtx.shadowBlur = 42;
  stageCtx.shadowColor = "rgba(255, 72, 58, 0.8)";

  stageCtx.beginPath();
  stageCtx.fillStyle = "rgba(255, 92, 72, 0.92)";
  stageCtx.arc(0, 0, 13, 0, Math.PI * 2);
  stageCtx.fill();

  stageCtx.beginPath();
  stageCtx.lineWidth = 3;
  stageCtx.strokeStyle = "rgba(255, 198, 174, 0.9)";
  stageCtx.arc(0, 0, 26, 0, Math.PI * 2);
  stageCtx.stroke();

  stageCtx.beginPath();
  stageCtx.lineWidth = 1.5;
  stageCtx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  stageCtx.moveTo(-18, 0);
  stageCtx.lineTo(18, 0);
  stageCtx.moveTo(0, -18);
  stageCtx.lineTo(0, 18);
  stageCtx.stroke();
  stageCtx.restore();
}

function render(now) {
  syncCanvasSizes();

  const width = dom.stage.clientWidth;
  const height = dom.stage.clientHeight;
  stageCtx.clearRect(0, 0, width, height);
  drawStageGrid(width, height);

  updateCalibration(now);

  const faceRecentlySeen = now - state.lastFaceSeenAt < FACE_TIMEOUT_MS;
  if (state.model && state.latestFeatures && faceRecentlySeen) {
    const nextPrediction = predictWithBias(state.latestFeatures.vector);
    const nextPoint = nextPrediction ?? { x: 0.5, y: 0.5 };
    if (!state.pointer.visible) {
      state.pointer.x = nextPoint.x;
      state.pointer.y = nextPoint.y;
    } else {
      state.pointer.x = lerp(state.pointer.x, nextPoint.x, LIVE_SMOOTHING);
      state.pointer.y = lerp(state.pointer.y, nextPoint.y, LIVE_SMOOTHING);
    }

    state.pointer.visible = true;
    pushTrail(now);

    const screenX = Math.round(state.pointer.x * width);
    const screenY = Math.round(state.pointer.y * height);
    setMetrics(`실시간 추적 | ${screenX}px, ${screenY}px | 샘플 ${state.trainingSamples.length}개`);
  } else if (!state.calibration) {
    state.pointer.visible = false;
    state.trail = [];
    setMetrics(faceRecentlySeen ? "보정이 끝날 때까지 추적을 잠시 멈춥니다." : "얼굴을 다시 화면 중앙에 맞춰주세요.");
  }

  drawCalibrationTarget(now);
  drawPointer(now);
  publishGazePoint();
  state.rafId = requestAnimationFrame(render);
}

function handleFaceResults(results) {
  const face = results.multiFaceLandmarks?.[0];
  if (!face) {
    state.latestLandmarks = null;
    state.latestFeatures = null;
    return;
  }

  const features = buildFeatureVector(face);
  state.latestLandmarks = face;
  state.latestFeatures = features;
  if (features) {
    state.lastFaceSeenAt = performance.now();
  }
}

function centerAlign() {
  if (!state.model || !state.latestFeatures) {
    setStatus("중앙 정렬은 보정 완료 상태에서 얼굴이 보여야 사용할 수 있습니다.");
    return;
  }

  const prediction = predict(state.model, state.latestFeatures.vector);
  state.bias.x = clamp(state.bias.x + (0.5 - prediction.x), -0.3, 0.3);
  state.bias.y = clamp(state.bias.y + (0.5 - prediction.y), -0.3, 0.3);
  persistGazeProfile();
  setStatus("중앙 오프셋을 갱신했습니다. 화면 가운데를 보며 다시 확인하세요.");
  setMetrics(`오프셋 | x ${state.bias.x.toFixed(3)} | y ${state.bias.y.toFixed(3)}`);
}

function pumpFaceMesh() {
  if (!state.running || !state.faceMesh) {
    state.trackingRafId = 0;
    return;
  }

  state.trackingRafId = requestAnimationFrame(pumpFaceMesh);
  if (state.frameBusy || dom.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  state.frameBusy = true;
  state.faceMesh.send({ image: dom.video })
    .catch(() => {
      setStatus("얼굴 추적 프레임 처리에 실패했습니다. 세션은 유지합니다.");
    })
    .finally(() => {
      state.frameBusy = false;
    });
}

async function startCamera() {
  if (state.running || state.starting) {
    return;
  }

  if (typeof FaceMesh !== "function") {
    setStatus("추적 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도하세요.");
    return;
  }

  state.starting = true;
  setStatus("카메라 권한 요청 중...");
  setMetrics("권한을 기다리는 중입니다.");

  try {
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

    state.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    state.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    state.faceMesh.onResults(handleFaceResults);
    state.running = true;
    pumpFaceMesh();
    dom.resetButton.disabled = false;
    beginCalibration();
  } catch (error) {
    setStatus("웹캠을 시작하지 못했습니다. 카메라 권한을 허용하고 다시 시도하세요.");
    setMetrics(error instanceof Error ? error.message : String(error));
    dom.startButton.disabled = false;
    dom.resetButton.disabled = false;
  } finally {
    state.starting = false;
  }
}

function restartCalibration() {
  if (!state.running) {
    void startCamera();
    return;
  }

  beginCalibration();
}

function stopStream() {
  state.running = false;
  if (!state.stream) {
    return;
  }

  for (const track of state.stream.getTracks()) {
    track.stop();
  }

  state.stream = null;
}

function cleanup() {
  cancelAnimationFrame(state.rafId);
  cancelAnimationFrame(state.trackingRafId);
  if (typeof state.faceMesh?.close === "function") {
    state.faceMesh.close();
  }
  stopStream();
}

dom.startButton.addEventListener("click", () => {
  void startCamera();
});

dom.resetButton.addEventListener("click", () => {
  restartCalibration();
});

window.addEventListener("beforeunload", cleanup);
window.addEventListener("resize", syncCanvasSizes);

syncCanvasSizes();
publishGazePoint();
state.rafId = requestAnimationFrame(render);
