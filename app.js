const EFFECTS = {
  rasengan: {
    label: "나선환",
    mode: "overlay",
    source: "assets/naruto.mp4",
    sound: "assets/rasengan.mp3",
    loopStart: 4.0,
    minRatio: 0.5,
    baseRatio: 0.5,
    handRatioScale: 2.55,
    maxRatio: 1.38,
    anchorX: 0.5,
    anchorY: 0.56,
    glowAlpha: 0.16,
  },
  chidori: {
    label: "치도리",
    mode: "overlay",
    source: "assets/sasuke.mp4",
    sound: "assets/chidori.mp3",
    loopStart: 0.0,
    minRatio: 0.36,
    baseRatio: 0.36,
    handRatioScale: 2.05,
    maxRatio: 1.18,
    anchorX: 0.45,
    anchorY: 0.52,
    glowAlpha: 0.18,
  },
  deidara: {
    label: "데이다라",
    mode: "deidara",
    handSource: "assets/손.mp4?v=20260406-2359",
    spiderSource: "assets/거미.mp4?v=20260407-0023",
    blastSource: "assets/폭발.mp4?v=20260407-0014",
    handLeadSeconds: 0.55,
    spiderTransitionMs: 420,
    spiderOriginScale: 0.76,
    thumbMinRatio: 0.16,
    thumbBaseRatio: 0.18,
    thumbHandRatioScale: 1.0,
    thumbMaxRatio: 0.5,
    anchorX: 0.5,
    anchorY: 0.52,
    glowAlpha: 0.1,
  },
  amaterasu: {
    label: "아마테라스",
    mode: "amaterasu",
    source: "assets/%EC%95%84%EB%A7%88%ED%85%8C%EB%9D%BC%EC%8A%A4.mp4?v=20260408-1530",
    baseRatio: 0.7,
    minRatio: 0.32,
    maxRatio: 0.92,
    anchorX: 0.5,
    anchorY: 0.5,
    glowAlpha: 0.18,
  },
};

const READY_SOUND = "assets/ready.mp3";
const GAZE_PROFILE_STORAGE_KEY = "naruto-gaze-profile";
const EASY_OPEN_ARM_WINDOW_MS = 2200;
const EFFECT_MAX_WORK_PIXELS = 700000;
const FULLSCREEN_EFFECT_MAX_WORK_PIXELS = 1600000;
const FULLSCREEN_STAGE_FILL = 1.0;
const LUMA_EDGE_THRESHOLD = 30;
const LUMA_EDGE_SOFTNESS = 36;
const LUMA_ALPHA_POWER = 1.4;
const TUNING_STORAGE_PREFIX = "naruto-effect-tuning:";
const VIDEO_TUNING_STORAGE_PREFIX = "naruto-video-tuning:";
const DEFAULT_EFFECT_TUNING = {
  scale: 100,
  edgeThreshold: 30,
  edgeSoftness: 36,
  alphaPower: 140,
  fullscreenScale: 100,
};
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
  spider: {
    edgeThreshold: 30,
    edgeSoftness: 59,
    alphaPower: 295,
    greenMin: 0,
    greenBias: 5,
    despill: 84,
  },
  blast: {
    edgeThreshold: 30,
    edgeSoftness: 59,
    alphaPower: 295,
    greenMin: 0,
    greenBias: 5,
    despill: 84,
  },
  amaterasu: {
    edgeThreshold: 0,
    edgeSoftness: 1,
    alphaPower: 59,
    greenMin: 0,
    greenBias: 0,
    despill: 0,
  },
};
const SIZE_CALIBRATION_STORAGE_KEY = "naruto-size-calibration:deidara";
const GAZE_TRACK_INTERVAL_MS = 66;
const GAZE_FACE_TIMEOUT_MS = 700;
const GAZE_SMOOTHING_X = 0.18;
const GAZE_SMOOTHING_Y = 0.16;
const AMATERASU_MAX_BURSTS = 8;
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_UPPER_LID = [386, 385, 384];
const LEFT_LOWER_LID = [374, 380, 381];
const RIGHT_UPPER_LID = [159, 158, 157];
const RIGHT_LOWER_LID = [145, 153, 154];
const DEFAULT_DEIDARA_SIZE_POINTS = [
  { handSize: 0.3855, scale: 26 },
  { handSize: 0.4168, scale: 30 },
  { handSize: 0.6346, scale: 41 },
];
const TUNING_LIMITS = {
  scale: { min: 5, max: 240 },
  edgeThreshold: { min: 0, max: 120 },
  edgeSoftness: { min: 1, max: 120 },
  alphaPower: { min: 50, max: 300 },
  fullscreenScale: { min: 70, max: 180 },
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
  launcher: document.getElementById("launcherScreen"),
  cameraScreen: document.getElementById("cameraScreen"),
  canvas: document.getElementById("cameraCanvas"),
  video: document.getElementById("cameraVideo"),
  backButton: document.getElementById("backButton"),
  amaterasuTriggerButton: document.getElementById("amaterasuTriggerButton"),
  tuningScale: document.getElementById("tuningScale"),
  tuningScaleValue: document.getElementById("tuningScaleValue"),
  tuningEdgeThreshold: document.getElementById("tuningEdgeThreshold"),
  tuningEdgeThresholdValue: document.getElementById("tuningEdgeThresholdValue"),
  tuningEdgeSoftness: document.getElementById("tuningEdgeSoftness"),
  tuningEdgeSoftnessValue: document.getElementById("tuningEdgeSoftnessValue"),
  tuningAlphaPower: document.getElementById("tuningAlphaPower"),
  tuningAlphaPowerValue: document.getElementById("tuningAlphaPowerValue"),
  tuningFullscreenScale: document.getElementById("tuningFullscreenScale"),
  tuningFullscreenScaleValue: document.getElementById("tuningFullscreenScaleValue"),
  tuningResetButton: document.getElementById("tuningResetButton"),
  errorToast: document.getElementById("errorToast"),
};

const ctx = dom.canvas?.getContext("2d", { alpha: false });

const state = {
  selectedEffect: null,
  stream: null,
  hands: null,
  latestResults: null,
  latestGazeFeatures: null,
  running: false,
  starting: false,
  processing: false,
  faceProcessing: false,
  rafId: 0,
  lastHandSendAt: 0,
  lastFaceSendAt: 0,
  gateArmedUntil: 0,
  effectVisible: false,
  effectPlaybackActive: false,
  lastGesture: null,
  runtime: null,
  cachedRightHand: null,
  cachedRightHandAt: 0,
  cachedDeidaraRoles: null,
  cachedDeidaraRolesAt: 0,
  smoothX: null,
  smoothY: null,
  smoothSize: null,
  effectVideos: {},
  effectAudios: {},
  readyAudio: null,
  effectTunings: {},
  effectAudioActive: false,
  effectAudioFinished: false,
  trackCanvas: null,
  trackCtx: null,
  faceCanvas: null,
  faceCtx: null,
  faceMesh: null,
  maskedFrameCaches: new WeakMap(),
  deidaraVideos: {
    hand: null,
    spider: null,
    blast: null,
  },
  deidara: {
    stage: "idle",
    triggerHeld: false,
    smoothX: null,
    smoothY: null,
    smoothSize: null,
    spiderStartedAt: 0,
    spiderOriginX: null,
    spiderOriginY: null,
    spiderOriginSize: null,
  },
  amaterasu: {
    markerX: 0.5,
    markerY: 0.5,
    burstX: 0.5,
    burstY: 0.5,
    bursts: [],
    visible: false,
    active: false,
    triggerHeld: false,
    faceSeenAt: 0,
    profile: null,
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from, to, ratio) {
  return from + (to - from) * ratio;
}

function createVideoElement(src, options = {}) {
  const {
    muted = true,
    volume = 1.0,
    loop = false,
    pauseOnLoad = true,
  } = options;
  const video = document.createElement("video");
  video.src = src;
  video.loop = loop;
  video.defaultMuted = muted;
  video.muted = muted;
  video.volume = volume;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  if (pauseOnLoad) {
    video.addEventListener("loadeddata", () => {
      if (video.currentTime !== 0) {
        try {
          video.currentTime = 0;
        } catch (_error) {
          // ignore
        }
      }
      video.pause();
    });
  }
  return video;
}

function createAudioElement(src, onEnded) {
  const audio = document.createElement("audio");
  audio.src = src;
  audio.loop = false;
  audio.preload = "auto";
  audio.volume = 1.0;
  if (onEnded) {
    audio.addEventListener("ended", onEnded);
  }
  return audio;
}

function isLikelyMobile() {
  const ua = navigator.userAgent || "";
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
    || window.innerWidth <= 900
  );
}

function buildRuntimeConfig() {
  const mobile = isLikelyMobile();
  return {
    mobile,
    dprCap: mobile ? 1.0 : 1.1,
    trackWidth: mobile ? 768 : 640,
    trackHeight: mobile ? 432 : 360,
    trackIntervalMs: mobile ? 42 : 75,
    captureWidth: mobile ? 1280 : 960,
    captureHeight: mobile ? 720 : 540,
    captureFps: mobile ? 30 : 24,
    modelComplexity: 0,
    minDetectionConfidence: mobile ? 0.34 : 0.55,
    minTrackingConfidence: mobile ? 0.28 : 0.5,
    handLostGraceMs: mobile ? 380 : 140,
  };
}

function getGestureTuning() {
  const mobile = state.runtime?.mobile;
  return {
    fingerTipLift: mobile ? 0.004 : 0.008,
    fingerPipSlack: mobile ? 0.02 : 0.012,
    foldedFingerSlack: mobile ? 0.045 : 0.025,
    openMinWidth: mobile ? 0.055 : 0.07,
    openMinHeight: mobile ? 0.085 : 0.1,
    openAvgTipLift: mobile ? 0.03 : 0.045,
    openTipSpan: mobile ? 0.05 : 0.06,
    thumbFoldRatio: mobile ? 1.58 : 1.42,
  };
}

function getSelectedEffectFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const effect = params.get("effect");
  return Object.hasOwn(EFFECTS, effect) ? effect : "rasengan";
}

function clampTuningValue(key, value) {
  const limits = TUNING_LIMITS[key];
  if (!limits) {
    return value;
  }
  return clamp(value, limits.min, limits.max);
}

function getEffectTuningKey(effectKey) {
  return `${TUNING_STORAGE_PREFIX}${effectKey}`;
}

function sanitizeEffectTuning(value) {
  return {
    scale: clampTuningValue("scale", Number(value?.scale ?? DEFAULT_EFFECT_TUNING.scale)),
    edgeThreshold: clampTuningValue("edgeThreshold", Number(value?.edgeThreshold ?? DEFAULT_EFFECT_TUNING.edgeThreshold)),
    edgeSoftness: clampTuningValue("edgeSoftness", Number(value?.edgeSoftness ?? DEFAULT_EFFECT_TUNING.edgeSoftness)),
    alphaPower: clampTuningValue("alphaPower", Number(value?.alphaPower ?? DEFAULT_EFFECT_TUNING.alphaPower)),
    fullscreenScale: clampTuningValue("fullscreenScale", Number(value?.fullscreenScale ?? DEFAULT_EFFECT_TUNING.fullscreenScale)),
  };
}

function readSavedEffectTuning(effectKey) {
  try {
    const saved = window.localStorage.getItem(getEffectTuningKey(effectKey));
    if (!saved) {
      return { ...DEFAULT_EFFECT_TUNING };
    }
    return sanitizeEffectTuning(JSON.parse(saved));
  } catch (_error) {
    return { ...DEFAULT_EFFECT_TUNING };
  }
}

function getVideoTuningKey(videoKey) {
  return `${VIDEO_TUNING_STORAGE_PREFIX}${videoKey}`;
}

function getDefaultVideoTuning(videoKey) {
  return {
    ...DEFAULT_VIDEO_TUNING,
    ...(DEFAULT_VIDEO_TUNING_BY_ASSET[videoKey] ?? {}),
  };
}

function sanitizeVideoTuning(value, defaults = DEFAULT_VIDEO_TUNING) {
  return {
    edgeThreshold: Number.isFinite(Number(value?.edgeThreshold)) ? Number(value.edgeThreshold) : defaults.edgeThreshold,
    edgeSoftness: Number.isFinite(Number(value?.edgeSoftness)) ? Number(value.edgeSoftness) : defaults.edgeSoftness,
    alphaPower: Number.isFinite(Number(value?.alphaPower)) ? Number(value.alphaPower) : defaults.alphaPower,
    greenMin: Number.isFinite(Number(value?.greenMin)) ? Number(value.greenMin) : defaults.greenMin,
    greenBias: Number.isFinite(Number(value?.greenBias)) ? Number(value.greenBias) : defaults.greenBias,
    despill: Number.isFinite(Number(value?.despill)) ? Number(value.despill) : defaults.despill,
  };
}

function readSavedVideoTuning(videoKey) {
  const defaults = getDefaultVideoTuning(videoKey);
  try {
    const saved = window.localStorage.getItem(getVideoTuningKey(videoKey));
    if (!saved) {
      return defaults;
    }
    return sanitizeVideoTuning(JSON.parse(saved), defaults);
  } catch (_error) {
    return defaults;
  }
}

function readSavedGazeProfile() {
  try {
    const raw = window.localStorage.getItem(GAZE_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const model = parsed?.model;
    const bias = parsed?.bias ?? {};
    if (
      !model
      || !Array.isArray(model.mean)
      || !Array.isArray(model.deviation)
      || !Array.isArray(model.weightsX)
      || !Array.isArray(model.weightsY)
    ) {
      return null;
    }

    return {
      model,
      bias: {
        x: Number.isFinite(Number(bias.x)) ? Number(bias.x) : 0,
        y: Number.isFinite(Number(bias.y)) ? Number(bias.y) : 0,
      },
    };
  } catch (_error) {
    return null;
  }
}

function averageFacePoint(landmarks, indices) {
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

function subtractPoint(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function dotPoint(a, b) {
  return a.x * b.x + a.y * b.y;
}

function normalizePoint(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    length,
  };
}

function buildEyeFeatureSet(landmarks, config) {
  const outer = landmarks[config.outer];
  const inner = landmarks[config.inner];
  const top = averageFacePoint(landmarks, config.top);
  const bottom = averageFacePoint(landmarks, config.bottom);
  const iris = averageFacePoint(landmarks, config.iris);
  const eyeCenter = {
    x: (outer.x + inner.x + top.x + bottom.x) * 0.25,
    y: (outer.y + inner.y + top.y + bottom.y) * 0.25,
  };

  const horizontalVector = subtractPoint(inner, outer);
  const verticalVector = subtractPoint(bottom, top);
  const horizontalAxis = normalizePoint(horizontalVector);
  const verticalAxis = normalizePoint(verticalVector);

  if (horizontalAxis.length < 0.01 || verticalAxis.length < 0.003) {
    return null;
  }

  const irisOffset = subtractPoint(iris, eyeCenter);
  return {
    center: eyeCenter,
    horizontal: dotPoint(irisOffset, horizontalAxis) / (horizontalAxis.length * 0.5),
    vertical: dotPoint(irisOffset, verticalAxis) / (verticalAxis.length * 0.5),
    openness: verticalAxis.length / horizontalAxis.length,
  };
}

function buildGazeFeatureVector(landmarks) {
  const leftEye = buildEyeFeatureSet(landmarks, {
    outer: 263,
    inner: 362,
    top: LEFT_UPPER_LID,
    bottom: LEFT_LOWER_LID,
    iris: LEFT_IRIS,
  });
  const rightEye = buildEyeFeatureSet(landmarks, {
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
  const betweenEyes = averageFacePoint(landmarks, [168]);
  const interocular = dist(leftEye.center, rightEye.center);
  if (interocular < 0.03) {
    return null;
  }

  const avgHorizontal = (leftEye.horizontal + rightEye.horizontal) * 0.5;
  const avgVertical = (leftEye.vertical + rightEye.vertical) * 0.5;
  const headX = (nose.x - betweenEyes.x) / interocular;
  const headY = (nose.y - betweenEyes.y) / interocular;

  return [
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
  ];
}

function predictSavedGaze(profile, features) {
  const { model, bias } = profile ?? {};
  if (!model || !Array.isArray(features) || !features.length) {
    return null;
  }

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
    x: clamp(x + (bias?.x ?? 0), 0.02, 0.98),
    y: clamp(y + (bias?.y ?? 0), 0.02, 0.98),
  };
}

function readSavedDeidaraSizePoints() {
  try {
    const raw = window.localStorage.getItem(SIZE_CALIBRATION_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_DEIDARA_SIZE_POINTS.map((point) => ({ ...point }));
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return DEFAULT_DEIDARA_SIZE_POINTS.map((point) => ({ ...point }));
    }

    return parsed
      .map((point) => ({
        handSize: Number(point?.handSize),
        scale: Number(point?.scale),
      }))
      .filter((point) => Number.isFinite(point.handSize) && Number.isFinite(point.scale))
      .sort((a, b) => a.handSize - b.handSize);
  } catch (_error) {
    return DEFAULT_DEIDARA_SIZE_POINTS.map((point) => ({ ...point }));
  }
}

function getInterpolatedDeidaraScale(handSize) {
  const points = readSavedDeidaraSizePoints();
  if (!Number.isFinite(handSize) || points.length === 0) {
    return 1;
  }

  if (handSize <= points[0].handSize) {
    return points[0].scale / 100;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (handSize <= right.handSize) {
      const span = Math.max(0.0001, right.handSize - left.handSize);
      const ratio = clamp((handSize - left.handSize) / span, 0, 1);
      return lerp(left.scale, right.scale, ratio) / 100;
    }
  }

  return points[points.length - 1].scale / 100;
}

function getEffectTuning(effectKey = state.selectedEffect) {
  if (!effectKey) {
    return { ...DEFAULT_EFFECT_TUNING };
  }

  if (!Object.hasOwn(state.effectTunings, effectKey)) {
    state.effectTunings[effectKey] = readSavedEffectTuning(effectKey);
  }
  return state.effectTunings[effectKey];
}

function persistEffectTuning(effectKey) {
  try {
    window.localStorage.setItem(
      getEffectTuningKey(effectKey),
      JSON.stringify(getEffectTuning(effectKey)),
    );
  } catch (_error) {
    // ignore storage failures
  }
}

function formatTuningValue(key, value) {
  if (key === "alphaPower") {
    return (value / 100).toFixed(2);
  }
  if (key === "scale" || key === "fullscreenScale") {
    return `${Math.round(value)}%`;
  }
  return String(Math.round(value));
}

function updateTuningUi() {
  if (!state.selectedEffect) {
    return;
  }

  const tuning = getEffectTuning(state.selectedEffect);
  const fields = [
    ["scale", dom.tuningScale, dom.tuningScaleValue],
    ["edgeThreshold", dom.tuningEdgeThreshold, dom.tuningEdgeThresholdValue],
    ["edgeSoftness", dom.tuningEdgeSoftness, dom.tuningEdgeSoftnessValue],
    ["alphaPower", dom.tuningAlphaPower, dom.tuningAlphaPowerValue],
    ["fullscreenScale", dom.tuningFullscreenScale, dom.tuningFullscreenScaleValue],
  ];

  fields.forEach(([key, input, output]) => {
    if (input) {
      input.value = String(Math.round(tuning[key]));
    }
    if (output) {
      output.textContent = formatTuningValue(key, tuning[key]);
    }
  });
}

function setTuningValue(key, value, effectKey = state.selectedEffect) {
  if (!effectKey) {
    return;
  }

  const current = getEffectTuning(effectKey);
  state.effectTunings[effectKey] = {
    ...current,
    [key]: clampTuningValue(key, Number(value)),
  };
  persistEffectTuning(effectKey);
  if (effectKey === state.selectedEffect) {
    updateTuningUi();
  }
}

function resetEffectTuning(effectKey = state.selectedEffect) {
  if (!effectKey) {
    return;
  }

  state.effectTunings[effectKey] = { ...DEFAULT_EFFECT_TUNING };
  persistEffectTuning(effectKey);
  if (effectKey === state.selectedEffect) {
    updateTuningUi();
  }
}

function setScreen(screenName) {
  const showCamera = screenName === "camera";
  dom.launcher?.classList.toggle("screen-active", !showCamera);
  dom.cameraScreen?.classList.toggle("screen-active", showCamera);
}

function showError(message) {
  if (!dom.errorToast) {
    return;
  }
  dom.errorToast.textContent = message;
  dom.errorToast.hidden = !message;
}

function buildEffectVideos() {
  Object.entries(EFFECTS).forEach(([key, effect]) => {
    if ((effect.mode === "overlay" || effect.mode === "amaterasu") && effect.source) {
      state.effectVideos[key] = createVideoElement(effect.source);
    }

    if (effect.mode === "overlay" && effect.sound) {
      state.effectAudios[key] = createAudioElement(effect.sound, () => {
        if (state.selectedEffect === key) {
          state.effectAudioActive = false;
          state.effectAudioFinished = true;
          state.effectVisible = false;
        }
      });
    }

  });

  const deidara = EFFECTS.deidara;
  state.deidaraVideos.hand = createVideoElement(deidara.handSource, { muted: false, volume: 1.0 });
  state.deidaraVideos.spider = createVideoElement(deidara.spiderSource, { muted: false, volume: 1.0 });
  state.deidaraVideos.blast = null;

  state.deidaraVideos.hand.addEventListener("ended", () => {
    if (state.selectedEffect === "deidara" && state.deidara.stage === "hand") {
      startDeidaraStage("spider");
    }
  });
  state.deidaraVideos.spider.addEventListener("ended", () => {
    if (state.selectedEffect === "deidara" && state.deidara.stage === "spider") {
      resetDeidaraSequence();
    }
  });

  state.readyAudio = createAudioElement(READY_SOUND);
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
    modelComplexity: state.runtime.modelComplexity,
    minDetectionConfidence: state.runtime.minDetectionConfidence,
    minTrackingConfidence: state.runtime.minTrackingConfidence,
  });

  hands.onResults((results) => {
    state.latestResults = results;
  });

  state.hands = hands;
  return hands;
}

async function ensureFaceMesh() {
  if (state.faceMesh) {
    return state.faceMesh;
  }

  if (typeof window.FaceMesh !== "function") {
    throw new Error("FaceMesh is unavailable");
  }

  const faceMesh = new window.FaceMesh({
    locateFile(file) {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    },
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: state.runtime.mobile ? 0.45 : 0.6,
    minTrackingConfidence: state.runtime.mobile ? 0.4 : 0.55,
  });

  faceMesh.onResults((results) => {
    const landmarks = results.multiFaceLandmarks?.[0];
    if (!landmarks) {
      state.latestGazeFeatures = null;
      return;
    }

    const vector = buildGazeFeatureVector(landmarks);
    state.latestGazeFeatures = vector;
    if (vector) {
      state.amaterasu.faceSeenAt = performance.now();
    }
  });

  state.faceMesh = faceMesh;
  return faceMesh;
}

function resizeCanvas() {
  const dpr = Math.min(state.runtime.dprCap, Math.max(1, window.devicePixelRatio || 1));
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
  const tuning = getGestureTuning();
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];
  return tip.y < pip.y - tuning.fingerTipLift && pip.y < mcp.y + tuning.fingerPipSlack;
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
  const tuning = getGestureTuning();
  const wrist = landmarks[0];
  const indexUp = isFingerExtended(landmarks, 8, 6, 5);
  const middleUp = isFingerExtended(landmarks, 12, 10, 9);
  const ringDown = landmarks[16].y > landmarks[14].y - tuning.foldedFingerSlack;
  const pinkyDown = landmarks[20].y > landmarks[18].y - tuning.foldedFingerSlack;
  if (!(indexUp && middleUp && ringDown && pinkyDown)) {
    return false;
  }

  const guideReach = Math.max(dist(landmarks[8], wrist), dist(landmarks[12], wrist));
  return dist(landmarks[4], wrist) < guideReach * tuning.thumbFoldRatio;
}

function isOpenPalm(landmarks) {
  const tuning = getGestureTuning();
  if (!areMajorFingersExtended(landmarks)) {
    return false;
  }

  const bounds = getBounds(landmarks);
  if (bounds.width < tuning.openMinWidth || bounds.height < tuning.openMinHeight) {
    return false;
  }

  const wrist = landmarks[0];
  const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  const avgTipY = tips.reduce((sum, tip) => sum + tip.y, 0) / tips.length;
  if (avgTipY > wrist.y - tuning.openAvgTipLift) {
    return false;
  }

  const tipSpan = Math.max(landmarks[8].x, landmarks[12].x, landmarks[16].x, landmarks[20].x)
    - Math.min(landmarks[8].x, landmarks[12].x, landmarks[16].x, landmarks[20].x);
  return tipSpan >= tuning.openTipSpan;
}

function classifyHandGesture(hand) {
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

function getDetectedHands(results) {
  if (!results?.multiHandLandmarks?.length) {
    return [];
  }

  return results.multiHandLandmarks
    .map((handLandmarks, index) => {
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
        area: bounds.width * bounds.height,
      };
    })
    .sort((a, b) => a.palm.x - b.palm.x);
}

function pickRightHand(hands) {
  if (!hands.length) {
    return null;
  }

  const labeled = hands
    .filter((hand) => hand.label === "Right")
    .sort((a, b) => b.area - a.area);
  if (labeled.length) {
    return labeled[0];
  }

  return hands[hands.length - 1];
}

function pickDeidaraRoles(hands) {
  const holder = hands[0] ?? null;
  const trigger = hands.length > 1 ? hands[hands.length - 1] : null;
  return {
    holder,
    trigger,
    hasTwoHands: hands.length >= 2,
  };
}

function drawHandsDebug(hands, width, height) {
  hands.forEach((hand, index) => {
    const points = hand.landmarks.map((landmark) => ({
      x: landmark.x * width,
      y: landmark.y * height,
    }));

    ctx.save();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = index === 0
      ? "rgba(255, 213, 140, 0.9)"
      : "rgba(112, 214, 255, 0.9)";
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
      ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function playReadyAudio() {
  if (!state.readyAudio) {
    return;
  }
  try {
    state.readyAudio.pause();
    state.readyAudio.currentTime = 0;
    state.readyAudio.play().catch(() => {});
  } catch (_error) {
    // ignore playback errors
  }
}

function stopReadyAudio() {
  if (!state.readyAudio) {
    return;
  }
  try {
    state.readyAudio.pause();
    state.readyAudio.currentTime = 0;
  } catch (_error) {
    // ignore playback errors
  }
}

function resetSmoothing() {
  state.smoothX = null;
  state.smoothY = null;
  state.smoothSize = null;
}

function disposeAmaterasuBurst(burst) {
  const video = burst?.video;
  if (!video) {
    return;
  }

  video.pause();
  video.removeAttribute("src");
  if (typeof video.load === "function") {
    try {
      video.load();
    } catch (_error) {
      // ignore cleanup failures
    }
  }
}

function stopAmaterasuPlayback() {
  state.amaterasu.active = false;
  state.amaterasu.bursts.forEach((burst) => {
    disposeAmaterasuBurst(burst);
  });
  state.amaterasu.bursts = [];
  const video = state.effectVideos.amaterasu;
  if (!video) {
    return;
  }

  video.pause();
  try {
    video.currentTime = 0;
  } catch (_error) {
    // ignore seek errors
  }
}

function updateAmaterasuTriggerButton() {
  if (!dom.amaterasuTriggerButton) {
    return;
  }

  dom.amaterasuTriggerButton.hidden = true;
  dom.amaterasuTriggerButton.disabled = true;
}

function resetAmaterasuState() {
  state.amaterasu.markerX = 0.5;
  state.amaterasu.markerY = 0.5;
  state.amaterasu.burstX = 0.5;
  state.amaterasu.burstY = 0.5;
  state.amaterasu.visible = false;
  state.amaterasu.active = false;
  state.amaterasu.triggerHeld = false;
  state.amaterasu.faceSeenAt = 0;
  state.amaterasu.profile = null;
  state.latestGazeFeatures = null;
  state.faceProcessing = false;
  state.lastFaceSendAt = 0;
  stopAmaterasuPlayback();
  state.amaterasu.bursts = [];
}

function resetDeidaraAnchor() {
  state.deidara.smoothX = null;
  state.deidara.smoothY = null;
  state.deidara.smoothSize = null;
  state.deidara.spiderStartedAt = 0;
  state.deidara.spiderOriginX = null;
  state.deidara.spiderOriginY = null;
  state.deidara.spiderOriginSize = null;
}

function resetDeidaraSequence() {
  state.deidara.stage = "idle";
  pauseAllDeidaraVideos();
  resetDeidaraAnchor();
}

function pauseAllDeidaraVideos() {
  Object.values(state.deidaraVideos).forEach((video) => {
    if (!video) {
      return;
    }
    video.pause();
    try {
      video.currentTime = 0;
    } catch (_error) {
      // ignore seek errors
    }
  });
}

function startDeidaraStage(stage) {
  state.deidara.stage = stage;

  if (stage === "idle") {
    pauseAllDeidaraVideos();
    return;
  }

  if (stage === "hand") {
    pauseAllDeidaraVideos();
  } else if (stage === "spider") {
    state.deidara.spiderStartedAt = performance.now();
    state.deidara.spiderOriginX = state.deidara.smoothX;
    state.deidara.spiderOriginY = state.deidara.smoothY;
    state.deidara.spiderOriginSize = state.deidara.smoothSize;
  } else {
    pauseAllDeidaraVideos();
  }

  const video = state.deidaraVideos[stage];
  if (!video) {
    return;
  }

  try {
    video.currentTime = 0;
  } catch (_error) {
    // ignore seek errors until metadata is ready
  }
  video.play().catch(() => {});
}

function syncEffectAudio(isVisible) {
  const audio = state.effectAudios[state.selectedEffect];
  if (!audio) {
    return;
  }

  if (isVisible) {
    if (!state.effectAudioActive) {
      state.effectAudioActive = true;
      state.effectAudioFinished = false;
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

function syncEffectPlayback(isVisible) {
  const effect = EFFECTS[state.selectedEffect];
  const video = state.effectVideos[state.selectedEffect];
  if (!effect || !video) {
    return;
  }

  if (isVisible) {
    if (!state.effectPlaybackActive) {
      state.effectPlaybackActive = true;
      try {
        video.currentTime = 0;
      } catch (_error) {
        // ignore seek failures until metadata is ready
      }
      video.play().catch(() => {});
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration > 0.1 && video.currentTime >= duration - 0.08) {
      const loopStart = clamp(effect.loopStart ?? 0, 0, Math.max(0, duration - 0.1));
      try {
        video.currentTime = loopStart;
      } catch (_error) {
        // ignore seek failures
      }
    }

    if (video.paused) {
      video.play().catch(() => {});
    }
    return;
  }

  if (state.effectPlaybackActive) {
    state.effectPlaybackActive = false;
    video.pause();
    try {
      video.currentTime = 0;
    } catch (_error) {
      // ignore seek failures
    }
  }
}

function updateOverlayGestureState(hand) {
  const now = performance.now();
  if (state.gateArmedUntil > 0 && now > state.gateArmedUntil) {
    state.gateArmedUntil = 0;
  }

  const gesture = classifyHandGesture(hand);
  if (gesture === "two" && state.lastGesture !== "two") {
    playReadyAudio();
  }
  state.lastGesture = gesture;

  if (gesture === "two") {
    state.gateArmedUntil = now + EASY_OPEN_ARM_WINDOW_MS;
    state.effectAudioFinished = false;
    state.effectVisible = false;
    return;
  }

  if (gesture === "open") {
    if ((state.gateArmedUntil > now || state.effectVisible) && !state.effectAudioFinished) {
      state.effectVisible = true;
      return;
    }
    state.effectVisible = false;
    return;
  }

  state.effectVisible = false;
}

function drawBackground(width, height) {
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(dom.video, 0, 0, width, height);
  ctx.restore();
}

function getMaskedFrameCache(video) {
  let cache = state.maskedFrameCaches.get(video);
  if (cache) {
    return cache;
  }

  const canvas = document.createElement("canvas");
  const cacheCtx = canvas.getContext("2d", { willReadFrequently: true });
  cache = {
    canvas,
    ctx: cacheCtx,
    frameToken: -1,
    workWidth: 0,
    workHeight: 0,
    keyMode: "",
    tuningSignature: "",
  };
  state.maskedFrameCaches.set(video, cache);
  return cache;
}

function getTuningSignature(tuning, keyMode) {
  return [
    keyMode,
    Math.round(tuning.edgeThreshold),
    Math.round(tuning.edgeSoftness),
    Math.round(tuning.alphaPower),
    Math.round(tuning.greenMin ?? 0),
    Math.round(tuning.greenBias ?? 0),
    Math.round(tuning.despill ?? 0),
  ].join("|");
}

function getVideoFrameToken(video) {
  return Math.round((video.currentTime || 0) * 30);
}

function getWorkPixelBudget(maxWorkPixels) {
  if (!state.runtime?.mobile) {
    return maxWorkPixels;
  }
  return Math.round(maxWorkPixels * 0.72);
}

function drawMaskedEffectFrame(video, drawX, drawY, drawWidth, drawHeight, options = {}) {
  const {
    glowAlpha = 0,
    baseAlpha = 0.98,
    blendMode = "lighter",
    glowScale = 1.12,
    keyMode = "luma",
    maxWorkPixels = EFFECT_MAX_WORK_PIXELS,
    tuningOverride = null,
  } = options;
  const tuning = tuningOverride ?? getEffectTuning();
  const area = drawWidth * drawHeight;
  const pixelBudget = getWorkPixelBudget(maxWorkPixels);
  let workScale = 1;
  if (area > pixelBudget) {
    workScale = Math.sqrt(pixelBudget / area);
  }

  const workWidth = Math.max(24, Math.round((drawWidth * workScale) / 4) * 4);
  const workHeight = Math.max(24, Math.round((drawHeight * workScale) / 4) * 4);
  const cache = getMaskedFrameCache(video);
  const frameToken = getVideoFrameToken(video);
  const tuningSignature = getTuningSignature(tuning, keyMode);
  const cacheValid = (
    cache.frameToken === frameToken
    && cache.workWidth === workWidth
    && cache.workHeight === workHeight
    && cache.keyMode === keyMode
    && cache.tuningSignature === tuningSignature
  );

  if (!cacheValid) {
    if (cache.canvas.width !== workWidth || cache.canvas.height !== workHeight) {
      cache.canvas.width = workWidth;
      cache.canvas.height = workHeight;
    }

    cache.ctx.imageSmoothingEnabled = true;
    cache.ctx.imageSmoothingQuality = "medium";
    cache.ctx.clearRect(0, 0, workWidth, workHeight);
    cache.ctx.drawImage(video, 0, 0, workWidth, workHeight);
    const imageData = cache.ctx.getImageData(0, 0, workWidth, workHeight);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (keyMode === "chromaGreen") {
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
        continue;
      }

      const luma = Math.max(r, g, b);
      if (luma <= LUMA_EDGE_THRESHOLD) {
        pixels[i + 3] = 0;
        continue;
      }

      const alpha = clamp((luma - LUMA_EDGE_THRESHOLD) / LUMA_EDGE_SOFTNESS, 0, 1);
      pixels[i + 3] = Math.round(Math.pow(alpha, LUMA_ALPHA_POWER) * 255);
    }

    cache.ctx.putImageData(imageData, 0, 0);
    cache.frameToken = frameToken;
    cache.workWidth = workWidth;
    cache.workHeight = workHeight;
    cache.keyMode = keyMode;
    cache.tuningSignature = tuningSignature;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = baseAlpha;
  ctx.drawImage(cache.canvas, drawX, drawY, drawWidth, drawHeight);
  if (glowAlpha > 0) {
    ctx.globalAlpha = glowAlpha;
    ctx.drawImage(
      cache.canvas,
      drawX - drawWidth * 0.06,
      drawY - drawHeight * 0.06,
      drawWidth * glowScale,
      drawHeight * glowScale,
    );
  }
  ctx.restore();
}

function drawOverlayEffect(hand, width, height, effect, video) {
  if (!video || video.readyState < 2) {
    return;
  }

  const baseX = lerp(hand.palm.x, hand.fingertip.x, 0.12) * width;
  const baseY = lerp(hand.palm.y, hand.fingertip.y, 0.12) * height;
  const handRatio = Math.max(hand.bounds.width, hand.bounds.height);
  const targetRatio = clamp(
    effect.baseRatio + handRatio * effect.handRatioScale,
    effect.minRatio,
    effect.maxRatio,
  );
  const viewportBase = state.runtime.mobile ? Math.max(width, height) : width;
  const nextSize = viewportBase * targetRatio;

  state.smoothX = state.smoothX == null ? baseX : lerp(state.smoothX, baseX, 0.24);
  state.smoothY = state.smoothY == null ? baseY : lerp(state.smoothY, baseY, 0.22);
  state.smoothSize = state.smoothSize == null ? nextSize : lerp(state.smoothSize, nextSize, 0.2);

  const aspect = video.videoWidth > 0 && video.videoHeight > 0
    ? video.videoWidth / video.videoHeight
    : 1;
  const drawWidth = state.smoothSize;
  const drawHeight = drawWidth / aspect;
  const drawX = state.smoothX - drawWidth * effect.anchorX;
  const drawY = state.smoothY - drawHeight * effect.anchorY;

  drawMaskedEffectFrame(video, drawX, drawY, drawWidth, drawHeight, {
    glowAlpha: effect.glowAlpha,
    baseAlpha: 0.98,
    blendMode: "lighter",
    glowScale: 1.12,
    keyMode: "luma",
  });
}

function updateAmaterasuMarker(width, height, now) {
  const profile = state.amaterasu.profile;
  if (!profile) {
    state.amaterasu.visible = true;
    return;
  }

  if (!state.latestGazeFeatures || now - state.amaterasu.faceSeenAt > GAZE_FACE_TIMEOUT_MS) {
    state.amaterasu.visible = true;
    return;
  }

  const prediction = predictSavedGaze(profile, state.latestGazeFeatures);
  if (!prediction) {
    state.amaterasu.visible = true;
    return;
  }

  state.amaterasu.markerX = lerp(state.amaterasu.markerX, prediction.x, GAZE_SMOOTHING_X);
  state.amaterasu.markerY = lerp(state.amaterasu.markerY, prediction.y, GAZE_SMOOTHING_Y);
  state.amaterasu.visible = true;
}

function drawAmaterasuMarker(width, height) {
  if (!state.amaterasu.visible) {
    return;
  }

  const x = state.amaterasu.markerX * width;
  const y = state.amaterasu.markerY * height;
  const isActive = state.amaterasu.active || state.amaterasu.bursts.length > 0;
  const radius = isActive ? 30 : 22;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowBlur = isActive ? 38 : 26;
  ctx.shadowColor = isActive
    ? "rgba(255, 96, 86, 0.9)"
    : "rgba(255, 110, 92, 0.6)";

  ctx.beginPath();
  ctx.fillStyle = isActive
    ? "rgba(255, 98, 88, 0.2)"
    : "rgba(255, 255, 255, 0.08)";
  ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 210, 196, 0.92)";
  ctx.lineWidth = 2.5;
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = 1.2;
  ctx.moveTo(-radius - 12, 0);
  ctx.lineTo(radius + 12, 0);
  ctx.moveTo(0, -radius - 12);
  ctx.lineTo(0, radius + 12);
  ctx.stroke();
  ctx.restore();
}

function startAmaterasuBurst() {
  const effect = EFFECTS.amaterasu;
  if (!effect?.source) {
    return;
  }

  state.amaterasu.burstX = state.amaterasu.markerX;
  state.amaterasu.burstY = state.amaterasu.markerY;
  const burstVideo = createVideoElement(effect.source, {
    loop: true,
    pauseOnLoad: false,
  });
  const burst = {
    x: state.amaterasu.burstX,
    y: state.amaterasu.burstY,
    video: burstVideo,
  };
  state.amaterasu.bursts.push(burst);
  if (state.amaterasu.bursts.length > AMATERASU_MAX_BURSTS) {
    const oldestBurst = state.amaterasu.bursts.shift();
    disposeAmaterasuBurst(oldestBurst);
  }
  state.amaterasu.active = true;
  playReadyAudio();

  try {
    burstVideo.currentTime = 0;
  } catch (_error) {
    // ignore seek errors
  }
  burstVideo.play().catch(() => {});
}

function triggerAmaterasuAtMarker() {
  if (state.selectedEffect !== "amaterasu") {
    return;
  }

  if (!state.amaterasu.visible) {
    showError("시선 표식이 아직 준비되지 않았습니다.");
    return;
  }

  showError("");
  startAmaterasuBurst();
}

function drawAmaterasuEffect(width, height, effect) {
  if (!state.amaterasu.bursts.length) {
    state.amaterasu.active = false;
    return;
  }

  state.amaterasu.active = true;
  const scaleMultiplier = clamp(getEffectTuning("amaterasu").scale / 100, 0.08, 2.4);
  const drawWidth = Math.min(width, height) * effect.baseRatio * scaleMultiplier;
  const tuning = readSavedVideoTuning("amaterasu");

  state.amaterasu.bursts.forEach((burst) => {
    const video = burst.video;
    if (!video) {
      return;
    }

    const aspect = video.videoWidth > 0 && video.videoHeight > 0
      ? video.videoWidth / video.videoHeight
      : 1;
    const drawHeight = drawWidth / aspect;
    const drawX = burst.x * width - drawWidth * effect.anchorX;
    const drawY = burst.y * height - drawHeight * effect.anchorY;

    if (video.readyState >= 2) {
      drawMaskedEffectFrame(video, drawX, drawY, drawWidth, drawHeight, {
        glowAlpha: effect.glowAlpha,
        baseAlpha: 1,
        blendMode: "source-over",
        glowScale: 1.12,
        keyMode: "chromaGreen",
        tuningOverride: tuning,
      });
    }

    if (video.readyState >= 2 && video.paused) {
      video.play().catch(() => {});
    }
  });
}

function drawAmaterasuScene(hands, width, height, now) {
  let rightHand = pickRightHand(hands);
  if (rightHand) {
    state.cachedRightHand = rightHand;
    state.cachedRightHandAt = now;
  } else if (state.cachedRightHand && now - state.cachedRightHandAt <= state.runtime.handLostGraceMs) {
    rightHand = state.cachedRightHand;
  } else {
    state.cachedRightHand = null;
  }

  updateAmaterasuMarker(width, height, now);
  const triggerIsTwo = classifyHandGesture(rightHand) === "two";
  if (triggerIsTwo && !state.amaterasu.triggerHeld && state.amaterasu.visible) {
    showError("");
    startAmaterasuBurst();
  }
  state.amaterasu.triggerHeld = triggerIsTwo;

  drawAmaterasuEffect(width, height, EFFECTS.amaterasu);
  drawAmaterasuMarker(width, height);
  drawHandsDebug(hands, width, height);
}

function updateDeidaraAnchor(holderHand, width, height) {
  if (!holderHand) {
    return;
  }

  const effect = EFFECTS.deidara;
  const baseX = holderHand.palm.x * width;
  const baseY = holderHand.palm.y * height;
  const handRatio = Math.max(holderHand.bounds.width, holderHand.bounds.height);
  const targetRatio = clamp(
    effect.thumbBaseRatio + handRatio * effect.thumbHandRatioScale,
    effect.thumbMinRatio,
    effect.thumbMaxRatio,
  );
  const viewportBase = state.runtime.mobile ? Math.max(width, height) : width;
  const nextSize = viewportBase * targetRatio * getInterpolatedDeidaraScale(handRatio);

  state.deidara.smoothX = state.deidara.smoothX == null ? baseX : lerp(state.deidara.smoothX, baseX, 0.28);
  state.deidara.smoothY = state.deidara.smoothY == null ? baseY : lerp(state.deidara.smoothY, baseY, 0.24);
  state.deidara.smoothSize = state.deidara.smoothSize == null
    ? nextSize
    : lerp(state.deidara.smoothSize, nextSize, 0.2);
}

function drawDeidaraHandVideo(video, videoKey, options = {}) {
  const baseAlpha = typeof options.baseAlpha === "number" ? options.baseAlpha : 1;
  if (!video || video.readyState < 2 || state.deidara.smoothSize == null) {
    return;
  }

  const effect = EFFECTS.deidara;
  const tuning = readSavedVideoTuning(videoKey);
  const aspect = video.videoWidth > 0 && video.videoHeight > 0
    ? video.videoWidth / video.videoHeight
    : 1;
  const drawWidth = state.deidara.smoothSize;
  const drawHeight = drawWidth / aspect;
  const drawX = state.deidara.smoothX - drawWidth * effect.anchorX;
  const drawY = state.deidara.smoothY - drawHeight * effect.anchorY;
  drawMaskedEffectFrame(video, drawX, drawY, drawWidth, drawHeight, {
    glowAlpha: 0,
    baseAlpha,
    blendMode: "source-over",
    glowScale: 1,
    keyMode: "chromaGreen",
    tuningOverride: tuning,
  });
}

function getFullscreenVideoRect(video, width, height, scaleMultiplier) {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight) * FULLSCREEN_STAGE_FILL * scaleMultiplier;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (width - drawWidth) * 0.5;
  const drawY = (height - drawHeight) * 0.5;
  return {
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  };
}

function drawFullscreenVideo(video, width, height, videoKey, options = {}) {
  if (!video || video.readyState < 2) {
    return;
  }

  const {
    baseAlpha = 1,
    tuningKey = videoKey,
  } = options;
  const tuning = readSavedVideoTuning(tuningKey);
  const scaleMultiplier = clamp(getEffectTuning("deidara").fullscreenScale / 100, 0.7, 1.8);
  const { drawX, drawY, drawWidth, drawHeight } = getFullscreenVideoRect(
    video,
    width,
    height,
    scaleMultiplier,
  );
  drawMaskedEffectFrame(video, drawX, drawY, drawWidth, drawHeight, {
    glowAlpha: 0,
    baseAlpha,
    blendMode: "source-over",
    glowScale: 1,
    keyMode: "chromaGreen",
    maxWorkPixels: FULLSCREEN_EFFECT_MAX_WORK_PIXELS,
    tuningOverride: tuning,
  });
}

function getDeidaraSpiderProgress(now) {
  const duration = Math.max(1, EFFECTS.deidara.spiderTransitionMs);
  const raw = clamp((now - state.deidara.spiderStartedAt) / duration, 0, 1);
  return 1 - Math.pow(1 - raw, 3);
}

function drawDeidaraSpiderVideo(video, width, height, now) {
  if (!video || video.readyState < 2) {
    return;
  }

  const tuning = readSavedVideoTuning("spider");
  const scaleMultiplier = clamp(getEffectTuning("deidara").fullscreenScale / 100, 0.7, 1.8);
  const fullscreenRect = getFullscreenVideoRect(video, width, height, scaleMultiplier);
  const progress = getDeidaraSpiderProgress(now);
  const aspect = video.videoWidth > 0 && video.videoHeight > 0
    ? video.videoWidth / video.videoHeight
    : 1;
  const originWidth = Math.max(
    80,
    (state.deidara.spiderOriginSize ?? Math.min(width, height) * 0.22) * EFFECTS.deidara.spiderOriginScale,
  );
  const originHeight = originWidth / aspect;
  const originX = (state.deidara.spiderOriginX ?? width * 0.5) - originWidth * 0.5;
  const originY = (state.deidara.spiderOriginY ?? height * 0.5) - originHeight * 0.48;
  const drawX = lerp(originX, fullscreenRect.drawX, progress);
  const drawY = lerp(originY, fullscreenRect.drawY, progress);
  const drawWidth = lerp(originWidth, fullscreenRect.drawWidth, progress);
  const drawHeight = lerp(originHeight, fullscreenRect.drawHeight, progress);
  drawMaskedEffectFrame(video, drawX, drawY, drawWidth, drawHeight, {
    glowAlpha: 0,
    baseAlpha: 1,
    blendMode: "source-over",
    glowScale: 1,
    keyMode: "chromaGreen",
    maxWorkPixels: FULLSCREEN_EFFECT_MAX_WORK_PIXELS,
    tuningOverride: tuning,
  });
}

function keepVideoPlaying(video) {
  if (video && video.paused) {
    video.play().catch(() => {});
  }
}

function shouldTrackHands() {
  if (!state.selectedEffect) {
    return true;
  }

  if (state.selectedEffect === "deidara" && state.deidara.stage === "spider") {
    return false;
  }

  return true;
}

function advanceDeidaraSequence() {
  const effect = EFFECTS.deidara;

  if (state.deidara.stage === "hand") {
    const video = state.deidaraVideos.hand;
    keepVideoPlaying(video);
    const duration = Number.isFinite(video?.duration) ? video.duration : 0;
    if (duration > 0.1 && video.currentTime >= Math.max(0, duration - effect.handLeadSeconds)) {
      startDeidaraStage("spider");
    }
    return;
  }

  if (state.deidara.stage === "spider") {
    const handVideo = state.deidaraVideos.hand;
    const handDuration = Number.isFinite(handVideo?.duration) ? handVideo.duration : 0;
    if (handVideo && (handDuration <= 0 || handVideo.currentTime < handDuration - 0.03)) {
      keepVideoPlaying(handVideo);
    }
    const video = state.deidaraVideos.spider;
    keepVideoPlaying(video);
    const duration = Number.isFinite(video?.duration) ? video.duration : 0;
    if (duration > 0.1 && video.currentTime >= duration - 0.05) {
      resetDeidaraSequence();
    }
    return;
  }
}

function drawOverlayScene(hands, width, height, now) {
  let rightHand = pickRightHand(hands);
  if (rightHand) {
    state.cachedRightHand = rightHand;
    state.cachedRightHandAt = now;
  } else if (state.cachedRightHand && now - state.cachedRightHandAt <= state.runtime.handLostGraceMs) {
    rightHand = state.cachedRightHand;
  } else {
    state.cachedRightHand = null;
  }

  updateOverlayGestureState(rightHand);
  drawHandsDebug(hands, width, height);

  if (rightHand && state.effectVisible) {
    syncEffectPlayback(true);
    syncEffectAudio(true);
    drawOverlayEffect(
      rightHand,
      width,
      height,
      EFFECTS[state.selectedEffect],
      state.effectVideos[state.selectedEffect],
    );
  } else {
    resetSmoothing();
    syncEffectPlayback(false);
    syncEffectAudio(false);
  }
}

function drawDeidaraScene(hands, width, height, now) {
  let roles = pickDeidaraRoles(hands);
  if (roles.holder || roles.trigger) {
    state.cachedDeidaraRoles = roles;
    state.cachedDeidaraRolesAt = now;
  } else if (state.cachedDeidaraRoles && now - state.cachedDeidaraRolesAt <= state.runtime.handLostGraceMs) {
    roles = state.cachedDeidaraRoles;
  } else {
    state.cachedDeidaraRoles = null;
  }

  if (state.deidara.stage !== "spider") {
    updateDeidaraAnchor(roles.holder, width, height);
  }

  const triggerIsTwo = classifyHandGesture(roles.trigger) === "two";
  if (
    state.deidara.stage === "idle"
    && roles.hasTwoHands
    && roles.holder
    && roles.trigger
    && triggerIsTwo
    && !state.deidara.triggerHeld
  ) {
    playReadyAudio();
    startDeidaraStage("hand");
  }
  state.deidara.triggerHeld = Boolean(triggerIsTwo);

  advanceDeidaraSequence();

  if (state.deidara.stage === "spider") {
    const transitionProgress = getDeidaraSpiderProgress(now);
    const handAlpha = clamp(1 - transitionProgress / 0.78, 0, 1);
    if (handAlpha > 0.02) {
      drawDeidaraHandVideo(state.deidaraVideos.hand, "hand", { baseAlpha: handAlpha });
    }
    drawDeidaraSpiderVideo(state.deidaraVideos.spider, width, height, now);
    return;
  }

  drawHandsDebug(hands, width, height);
  const handVideo = state.deidaraVideos.hand;
  if (roles.holder || state.deidara.stage === "hand") {
    drawDeidaraHandVideo(handVideo, "hand");
  } else {
    resetDeidaraAnchor();
  }
}

function drawFrame() {
  if (!state.running || dom.video.readyState < 2) {
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const now = performance.now();
  const hands = getDetectedHands(state.latestResults);

  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height);

  const effect = EFFECTS[state.selectedEffect];
  if (!effect) {
    return;
  }

  if (effect.mode === "deidara") {
    syncEffectPlayback(false);
    syncEffectAudio(false);
    drawDeidaraScene(hands, width, height, now);
    return;
  }

  if (effect.mode === "amaterasu") {
    syncEffectPlayback(false);
    syncEffectAudio(false);
    drawAmaterasuScene(hands, width, height, now);
    return;
  }

  drawOverlayScene(hands, width, height, now);
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
    && !state.faceProcessing
    && shouldTrackHands()
    && now - state.lastHandSendAt >= state.runtime.trackIntervalMs
  ) {
    state.processing = true;
    state.lastHandSendAt = now;
    state.trackCtx.drawImage(dom.video, 0, 0, state.runtime.trackWidth, state.runtime.trackHeight);
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

  if (
    state.faceMesh
    && dom.video.readyState >= 2
    && !state.faceProcessing
    && !state.processing
    && state.faceCanvas
    && state.faceCtx
    && now - state.lastFaceSendAt >= GAZE_TRACK_INTERVAL_MS
  ) {
    state.faceProcessing = true;
    state.lastFaceSendAt = now;
    state.faceCtx.drawImage(dom.video, 0, 0, state.faceCanvas.width, state.faceCanvas.height);
    state.faceMesh
      .send({ image: state.faceCanvas })
      .catch((error) => {
        console.error(error);
        showError("시선 추적이 중단되었습니다. 아마테라스를 다시 열어주세요.");
        stopFaceTracking();
      })
      .finally(() => {
        state.faceProcessing = false;
      });
  }

  state.rafId = window.requestAnimationFrame(renderLoop);
}

async function startCamera() {
  if (state.stream) {
    return;
  }

  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: state.runtime.captureWidth, max: 1280 },
      height: { ideal: state.runtime.captureHeight, max: 720 },
      frameRate: { ideal: state.runtime.captureFps, max: 30 },
    },
  });

  dom.video.srcObject = state.stream;
  await dom.video.play();
}

function stopFaceTracking() {
  state.faceProcessing = false;
  state.lastFaceSendAt = 0;
  state.latestGazeFeatures = null;
  if (!state.faceMesh) {
    return;
  }

  if (typeof state.faceMesh.close === "function") {
    state.faceMesh.close();
  }
  state.faceMesh = null;
}

async function warmSelectedMedia() {
  const effect = EFFECTS[state.selectedEffect];
  if (!effect) {
    return;
  }

  if (effect.mode === "overlay" || effect.mode === "amaterasu") {
    const video = state.effectVideos[state.selectedEffect];
    if (video) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (_error) {
        // ignore seek errors
      }
    }
    return;
  }

  pauseAllDeidaraVideos();
}

async function startExperience(effectKey) {
  if (state.starting) {
    return;
  }

  state.starting = true;
  showError("");
  state.selectedEffect = effectKey;
  getEffectTuning(effectKey);
  state.gateArmedUntil = 0;
  state.effectVisible = false;
  state.effectPlaybackActive = false;
  state.effectAudioActive = false;
  state.effectAudioFinished = false;
  state.lastGesture = null;
  state.cachedRightHand = null;
  state.cachedRightHandAt = 0;
  state.cachedDeidaraRoles = null;
  state.cachedDeidaraRolesAt = 0;
  state.maskedFrameCaches = new WeakMap();
  stopReadyAudio();
  resetSmoothing();
  resetDeidaraSequence();
  resetAmaterasuState();
  state.deidara.triggerHeld = false;
  updateTuningUi();
  updateAmaterasuTriggerButton();
  setScreen("camera");
  resizeCanvas();

  if (effectKey === "amaterasu") {
    state.amaterasu.profile = readSavedGazeProfile();
    if (!state.amaterasu.profile) {
      showError("시선 테스트를 먼저 완료하세요. 저장된 보정값이 없습니다.");
    } else {
      showError("");
    }
  }

  try {
    await ensureHands();
    if (effectKey === "amaterasu") {
      await ensureFaceMesh();
    } else {
      stopFaceTracking();
    }
    await startCamera();
    await warmSelectedMedia();
    state.running = true;
    resizeCanvas();
    window.cancelAnimationFrame(state.rafId);
    state.rafId = window.requestAnimationFrame(renderLoop);
  } catch (error) {
    console.error(error);
    state.running = false;
    showError("카메라를 열지 못했습니다.");
  } finally {
    state.starting = false;
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
  state.starting = false;
  window.cancelAnimationFrame(state.rafId);
  state.rafId = 0;
  state.latestResults = null;
  state.processing = false;
  state.lastHandSendAt = 0;
  state.gateArmedUntil = 0;
  state.effectVisible = false;
  state.effectPlaybackActive = false;
  state.effectAudioActive = false;
  state.effectAudioFinished = false;
  state.lastGesture = null;
  state.cachedRightHand = null;
  state.cachedRightHandAt = 0;
  state.cachedDeidaraRoles = null;
  state.cachedDeidaraRolesAt = 0;
  state.maskedFrameCaches = new WeakMap();
  stopReadyAudio();
  resetSmoothing();
  resetDeidaraSequence();
  resetAmaterasuState();
  state.deidara.triggerHeld = false;
  syncEffectPlayback(false);
  syncEffectAudio(false);
  updateAmaterasuTriggerButton();
  Object.values(state.effectVideos).forEach((video) => video.pause());
  pauseAllDeidaraVideos();
  stopFaceTracking();
  stopCamera();
  window.location.href = "./";
}

function bindEvents() {
  dom.backButton?.addEventListener("click", () => {
    stopExperience();
  });

  dom.amaterasuTriggerButton?.addEventListener("click", () => {
    triggerAmaterasuAtMarker();
  });

  [
    ["scale", dom.tuningScale],
    ["edgeThreshold", dom.tuningEdgeThreshold],
    ["edgeSoftness", dom.tuningEdgeSoftness],
    ["alphaPower", dom.tuningAlphaPower],
    ["fullscreenScale", dom.tuningFullscreenScale],
  ].forEach(([key, input]) => {
    input?.addEventListener("input", (event) => {
      const value = Number(event.currentTarget.value);
      if (!Number.isFinite(value)) {
        return;
      }
      setTuningValue(key, value);
    });
  });

  dom.tuningResetButton?.addEventListener("click", () => {
    resetEffectTuning();
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", () => {
    stopFaceTracking();
    stopCamera();
  });
}

function boot() {
  if (!dom.cameraScreen || !dom.canvas || !dom.video || !ctx) {
    return;
  }

  state.runtime = buildRuntimeConfig();

  const trackCanvas = document.createElement("canvas");
  trackCanvas.width = state.runtime.trackWidth;
  trackCanvas.height = state.runtime.trackHeight;
  const trackCtx = trackCanvas.getContext("2d", { alpha: false });
  trackCtx.imageSmoothingEnabled = true;
  trackCtx.imageSmoothingQuality = "low";
  state.trackCanvas = trackCanvas;
  state.trackCtx = trackCtx;

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = state.runtime.trackWidth;
  faceCanvas.height = state.runtime.trackHeight;
  const faceCtx = faceCanvas.getContext("2d", { alpha: false });
  faceCtx.imageSmoothingEnabled = true;
  faceCtx.imageSmoothingQuality = "low";
  state.faceCanvas = faceCanvas;
  state.faceCtx = faceCtx;

  buildEffectVideos();
  bindEvents();
  resizeCanvas();
  startExperience(getSelectedEffectFromUrl());
}

boot();
