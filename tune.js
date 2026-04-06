const VIDEO_TUNING_STORAGE_PREFIX = "naruto-video-tuning:";
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
};

const TUNING_LIMITS = {
  edgeThreshold: { min: 0, max: 120 },
  edgeSoftness: { min: 1, max: 120 },
  alphaPower: { min: 50, max: 300 },
  greenMin: { min: 0, max: 180 },
  greenBias: { min: 0, max: 120 },
  despill: { min: 0, max: 100 },
};

const ASSETS = {
  hand: { label: "손", src: "assets/손.mp4?v=20260406-2359" },
  spider: { label: "거미", src: "assets/거미.mp4?v=20260406-2359" },
  blast: { label: "폭발", src: "assets/폭발.mp4" },
};

const dom = {
  assetSelect: document.getElementById("assetSelect"),
  sourceCanvas: document.getElementById("sourceCanvas"),
  resultCanvas: document.getElementById("resultCanvas"),
  edgeThreshold: document.getElementById("edgeThreshold"),
  edgeThresholdValue: document.getElementById("edgeThresholdValue"),
  edgeSoftness: document.getElementById("edgeSoftness"),
  edgeSoftnessValue: document.getElementById("edgeSoftnessValue"),
  alphaPower: document.getElementById("alphaPower"),
  alphaPowerValue: document.getElementById("alphaPowerValue"),
  greenMin: document.getElementById("greenMin"),
  greenMinValue: document.getElementById("greenMinValue"),
  greenBias: document.getElementById("greenBias"),
  greenBiasValue: document.getElementById("greenBiasValue"),
  despill: document.getElementById("despill"),
  despillValue: document.getElementById("despillValue"),
  resetButton: document.getElementById("resetButton"),
  valueDump: document.getElementById("valueDump"),
  video: document.getElementById("tuneVideo"),
};

const sourceCtx = dom.sourceCanvas.getContext("2d", { alpha: false });
const resultCtx = dom.resultCanvas.getContext("2d", { willReadFrequently: true });
const workCanvas = document.createElement("canvas");
const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });

let selectedAsset = dom.assetSelect.value;
let rafId = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampTuningValue(key, value) {
  const limits = TUNING_LIMITS[key];
  return clamp(value, limits.min, limits.max);
}

function getStorageKey(assetKey) {
  return `${VIDEO_TUNING_STORAGE_PREFIX}${assetKey}`;
}

function getDefaultTuning(assetKey) {
  return {
    ...DEFAULT_VIDEO_TUNING,
    ...(DEFAULT_VIDEO_TUNING_BY_ASSET[assetKey] ?? {}),
  };
}

function sanitizeTuning(value, defaults = DEFAULT_VIDEO_TUNING) {
  return {
    edgeThreshold: clampTuningValue("edgeThreshold", Number(value?.edgeThreshold ?? defaults.edgeThreshold)),
    edgeSoftness: clampTuningValue("edgeSoftness", Number(value?.edgeSoftness ?? defaults.edgeSoftness)),
    alphaPower: clampTuningValue("alphaPower", Number(value?.alphaPower ?? defaults.alphaPower)),
    greenMin: clampTuningValue("greenMin", Number(value?.greenMin ?? defaults.greenMin)),
    greenBias: clampTuningValue("greenBias", Number(value?.greenBias ?? defaults.greenBias)),
    despill: clampTuningValue("despill", Number(value?.despill ?? defaults.despill)),
  };
}

function readTuning(assetKey) {
  const defaults = getDefaultTuning(assetKey);
  try {
    const raw = window.localStorage.getItem(getStorageKey(assetKey));
    if (!raw) {
      return defaults;
    }
    return sanitizeTuning(JSON.parse(raw), defaults);
  } catch (_error) {
    return defaults;
  }
}

function writeTuning(assetKey, tuning) {
  try {
    window.localStorage.setItem(getStorageKey(assetKey), JSON.stringify(tuning));
  } catch (_error) {
    // ignore
  }
}

function formatValue(key, value) {
  if (key === "alphaPower") {
    return (value / 100).toFixed(2);
  }
  if (key === "despill") {
    return `${Math.round(value)}%`;
  }
  return String(Math.round(value));
}

function getCurrentTuning() {
  return readTuning(selectedAsset);
}

function updateControls() {
  const tuning = getCurrentTuning();
  const fields = [
    ["edgeThreshold", dom.edgeThreshold, dom.edgeThresholdValue],
    ["edgeSoftness", dom.edgeSoftness, dom.edgeSoftnessValue],
    ["alphaPower", dom.alphaPower, dom.alphaPowerValue],
    ["greenMin", dom.greenMin, dom.greenMinValue],
    ["greenBias", dom.greenBias, dom.greenBiasValue],
    ["despill", dom.despill, dom.despillValue],
  ];

  fields.forEach(([key, input, output]) => {
    input.value = String(Math.round(tuning[key]));
    output.textContent = formatValue(key, tuning[key]);
  });

  dom.valueDump.textContent = JSON.stringify({
    asset: selectedAsset,
    ...tuning,
  }, null, 2);
}

function setTuning(key, value) {
  const tuning = {
    ...getCurrentTuning(),
    [key]: clampTuningValue(key, Number(value)),
  };
  writeTuning(selectedAsset, tuning);
  updateControls();
}

function resetTuning() {
  writeTuning(selectedAsset, getDefaultTuning(selectedAsset));
  updateControls();
}

function drawCheckerboard(ctx, width, height) {
  const cell = 18;
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? "#1a1d24" : "#2b303a";
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function renderFrame() {
  rafId = window.requestAnimationFrame(renderFrame);
  if (dom.video.readyState < 2) {
    return;
  }

  const width = dom.sourceCanvas.width;
  const height = dom.sourceCanvas.height;
  const tuning = getCurrentTuning();

  sourceCtx.clearRect(0, 0, width, height);
  sourceCtx.drawImage(dom.video, 0, 0, width, height);

  if (workCanvas.width !== width || workCanvas.height !== height) {
    workCanvas.width = width;
    workCanvas.height = height;
  }

  workCtx.clearRect(0, 0, width, height);
  workCtx.drawImage(dom.video, 0, 0, width, height);
  const imageData = workCtx.getImageData(0, 0, width, height);
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

  workCtx.putImageData(imageData, 0, 0);
  resultCtx.clearRect(0, 0, width, height);
  drawCheckerboard(resultCtx, width, height);
  resultCtx.drawImage(workCanvas, 0, 0);
}

function loadAsset(assetKey) {
  selectedAsset = assetKey;
  dom.video.src = ASSETS[assetKey].src;
  dom.video.currentTime = 0;
  dom.video.play().catch(() => {});
  updateControls();
}

function bindEvents() {
  dom.assetSelect.addEventListener("change", (event) => {
    loadAsset(event.currentTarget.value);
  });

  [
    ["edgeThreshold", dom.edgeThreshold],
    ["edgeSoftness", dom.edgeSoftness],
    ["alphaPower", dom.alphaPower],
    ["greenMin", dom.greenMin],
    ["greenBias", dom.greenBias],
    ["despill", dom.despill],
  ].forEach(([key, input]) => {
    input.addEventListener("input", (event) => {
      setTuning(key, event.currentTarget.value);
    });
  });

  dom.resetButton.addEventListener("click", () => {
    resetTuning();
  });
}

function boot() {
  bindEvents();
  loadAsset(selectedAsset);
  renderFrame();
}

boot();
