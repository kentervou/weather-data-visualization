// In this visualization, I'll be using the sample-weather.csv file I found on howtocsv.com.
// Other files will not work properly unless metrics are compatible -- keep that in mind!
//
// Here are the metrics used:
// temp_c           -- Temperature in Celsius
// humidity         -- Humidity in percentage
// precipitation_mm -- Precipitation in mm
// wind_kmh         -- Wind speed in km/h
//
// condition -- A metric used in the original csv that I won't be making use of in this project.

// Initializes the palioka font. It's loaded in this sketch as a .ttf file.
let palioka;

// DOM controls
let slider;
let sliderReadout;
let fileInput;
let metricSelect;

// I keep the original rows separate from the labels and averages so I can
// recalculate the visualization whenever someone changes the selected metric.
let records = [];
let labels = [];
let values = [];

let fileName = "";
let cv = "Current metric: ";
let metric = "temp_c";

let statusMessage =
  "This demonstration uses sample-weather.csv. Use any CSV file with correct metrics.";

// ---------- PALETTE ----------
const PAPER = [241, 238, 234]; // page
const INK = [74, 29, 29]; // body text + outlines
const CRIMSON = [217, 43, 75]; // headline + warnings
const PINK = [244, 85, 155]; // highest values
const BUTTER = [255, 224, 138]; // middle values
const MINT = [61, 240, 140]; // lowest values
const SALMON = [201, 120, 107]; // secondary text
const PEAR = [197, 224, 138]; // decoration only

// ---------- Layout ----------
const HONEST = { x: 30, y: 250, w: 430, h: 330 };
const LOUD = { x: 480, y: 30, w: 490, h: 550 };

// ---------- Motion ----------
// Respect people who've asked their system for less animation.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  .matches;

// Smoothing: the misleading chart eases toward the slider instead of jumping.
let shownBlend = 0.5;

// Frames since data loaded. The normal chart rises first, then the loud one.
let loadFrame = 0;

// Hover: remembers which city the mouse is over so BOTH charts can highlight it.
let hoverIndex = -1;
let pendingHover = -1;
let stickyHover = -1;
let ringAmount = 0;
let mouseInside = false;

// True while a file is being dragged over the canvas.
let isDraggingFile = false;

// Static paper texture, drawn once.
let paperLayer;

// Animated background ring clusters.
// Each cluster keeps its original position and has its own movement pattern.
let movingRings = [];

const RING_CONFIGS = [
  { x: 470, y: 250, radius: 82, color: PINK },
  { x: 30, y: 592, radius: 86, color: PEAR },
  { x: 975, y: 40, radius: 56, color: PEAR },
  { x: 12, y: 300, radius: 40, color: MINT },
  { x: 955, y: 604, radius: 24, color: PINK },
];

const metrics = {
  temp_c: cv + "Average temperature (°C)",
  humidity: cv + "Average humidity (%)",
  precipitation_mm: cv + "Average daily precipitation (mm/day)",
  wind_kmh: cv + "Average wind speed (km/h)",
};

const units = {
  temp_c: "°C",
  humidity: "%",
  precipitation_mm: "mm",
  wind_kmh: "km/h",
};

// Injects CSS so the DOM elements (slider labels, buttons, dropdown) can use
// Palioka and automatically contrast with the system's light/dark mode.
function injectStyles() {
  const style = document.createElement("style");

  style.textContent = `
    :root {
      color-scheme: light dark;
    }

    @font-face {
      font-family: 'PaliokaUI';
      src: url('palioka.ttf');
    }

    canvas {
      display: block;
      margin: 0 auto;
    }

    .ui-panel {
      color: CanvasText;
      font-family: 'PaliokaUI', sans-serif;
      font-size: 14px;
      width: 1000px;
      max-width: 100%;
      margin: 18px auto 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px 32px;
    }

    .ui-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ui-hint {
      opacity: 0.65;
    }

    .ui-panel button,
    .ui-panel select {
      font-family: inherit;
      font-size: inherit;
      color: #4a1d1d;
      background: #f1eeea;
      border: 1.5px solid #4a1d1d;
      border-radius: 12px;
      padding: 6px 16px;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s,
        border-color 0.15s;
    }

    .ui-panel button:hover,
    .ui-panel select:hover {
      background: #d92b4b;
      border-color: #d92b4b;
      color: #f1eeea;
    }

    .ui-panel button:focus-visible,
    .ui-panel select:focus-visible,
    .ui-panel input[type=range]:focus-visible {
      outline: 3px solid #d92b4b;
      outline-offset: 3px;
    }

    .ui-panel input[type=range] {
      width: 180px;
      cursor: pointer;
      accent-color: #d92b4b;
    }

    .ui-readout {
      min-width: 120px;
    }

    @media (prefers-reduced-motion: reduce) {
      .ui-panel button,
      .ui-panel select {
        transition: none;
      }
    }
  `;

  document.head.appendChild(style);
}

// Helper: wraps a label and its elements into one tidy row.
function makeGroup(parent, labelText) {
  const group = createDiv();
  group.addClass("ui-group");
  group.parent(parent);

  if (labelText) {
    createSpan(labelText).parent(group);
  }

  return group;
}

// I build the canvas and controls once here. setup() is async because I wait
// for the custom font to load before drawing text that depends on it.
async function setup() {
  createCanvas(1000, 620);
  injectStyles();

  // Load the custom font used by the canvas.
  palioka = await loadFont("palioka.ttf");
  textFont(palioka);

  // Paper: warm off-white with a faint speckle, like uncoated stock.
  // I draw the texture once into a buffer so it costs less per frame.
  randomSeed(11);

  paperLayer = createGraphics(width, height);
  paperLayer.background(...PAPER);
  paperLayer.noStroke();

  for (let i = 0; i < 1100; i++) {
    paperLayer.fill(...INK, random(5, 15));
    paperLayer.circle(random(width), random(height), random(0.8, 1.9));
  }

  // I initialize the moving ring clusters once.
  // Their positions won't be regenerated on every frame.
  initializeMovingRings();

  // One panel holds every control below the canvas.
  const panel = createDiv();
  panel.addClass("ui-panel");

  // --- Upload ---
  // The real file input is hidden; a styled button opens it instead.
  fileInput = createFileInput(handleFile);
  fileInput.hide();

  const uploadGroup = makeGroup(panel);
  const uploadButton = createButton("Upload CSV");
  uploadButton.parent(uploadGroup);
  uploadButton.mousePressed(() => fileInput.elt.click());

  createSpan("or drop a file on the chart")
    .addClass("ui-hint")
    .parent(uploadGroup);

  // --- Metric picker ---
  const metricGroup = makeGroup(panel, "Metric");

  metricSelect = createSelect();
  metricSelect.parent(metricGroup);
  metricSelect.option("Temperature (°C)", "temp_c");
  metricSelect.option("Humidity (%)", "humidity");
  metricSelect.option("Precipitation (mm)", "precipitation_mm");
  metricSelect.option("Wind speed (km/h)", "wind_kmh");

  metricSelect.changed(() => {
    metric = metricSelect.value();
    updateSummary();
  });

  // --- Truncation slider ---
  // 0 = maximum truncation; 1 = normal axis.
  const sliderGroup = makeGroup(panel, "Axis baseline");

  createSpan("Truncated").addClass("ui-hint").parent(sliderGroup);

  slider = createSlider(0, 1, 0.5, 0.05);
  slider.parent(sliderGroup);
  slider.attribute(
    "aria-label",
    "Axis baseline: 0 is maximum truncation, 1 is a normal axis"
  );

  createSpan("Normal").addClass("ui-hint").parent(sliderGroup);

  sliderReadout = createSpan("");
  sliderReadout.addClass("ui-readout");
  sliderReadout.parent(sliderGroup);

  slider.input(updateSliderReadout);
  updateSliderReadout();

  shownBlend = slider.value();

  // --- Drag and drop onto the canvas ---
  // I prevent the browser's default behavior so it won't open the file.
  const canvasElement = drawingContext.canvas;

  canvasElement.addEventListener("dragover", (event) => {
    event.preventDefault();
    isDraggingFile = true;
  });

  canvasElement.addEventListener("dragleave", () => {
    isDraggingFile = false;
  });

  canvasElement.addEventListener("drop", (event) => {
    event.preventDefault();
    isDraggingFile = false;

    const file = event.dataTransfer.files[0];
    if (!file) return;

    // Read the dropped file as text, then reuse the upload handler.
    file.text().then((text) => {
      handleFile({ data: text, name: file.name });
    });
  });
}

function updateSliderReadout() {
  sliderReadout.html("Value: " + Number(slider.value()).toFixed(2));
}

function draw() {
  // Ease the misleading chart toward the slider's value.
  if (slider) {
    shownBlend = lerp(shownBlend, Number(slider.value()), 0.15);

    if (Math.abs(shownBlend - slider.value()) < 0.001) {
      shownBlend = Number(slider.value());
    }
  }

  mouseInside = mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;

  image(paperLayer, 0, 0);

  // I draw the moving rings behind the text and chart panels.
  drawDecoration();
  drawHeader();

  drawPanel(HONEST, "Normal: Zero baseline");
  drawPanel(LOUD, "Misleading: Adjustable truncation");

  if (values.length === 0) {
    drawEmptyState();
    return;
  }

  // Rings bloom around a hovered city and fade when you leave.
  if (hoverIndex !== -1) {
    stickyHover = hoverIndex;
  }

  ringAmount = lerp(
    ringAmount,
    hoverIndex !== -1 ? 1 : 0,
    reduceMotion ? 1 : 0.14
  );

  loadFrame++;
  pendingHover = -1;

  // Normal chart: always starts at zero. It rises first.
  drawBarChart(HONEST, 1, 0);

  // Misleading chart: controlled by the slider. It rises second.
  drawBarChart(LOUD, shownBlend, 22 + values.length * 3);

  hoverIndex = pendingHover;
  cursor(hoverIndex === -1 ? ARROW : HAND);

  // Status line, centered under the poster.
  noStroke();
  fill(...INK, 170);
  textAlign(CENTER, CENTER);
  textSize(10);
  text(statusMessage, width / 2, 604);

  drawTooltip();
}
// ---------------------------------------------------------------
// PAGE: DECORATION, HEADER, PANELS
// ---------------------------------------------------------------

// I stack translucent circles to create the soft, layered ring effect.
function drawRings(cx, cy, radius, rgb, layers = 10, alpha = 10) {
  noStroke();

  for (let k = 0; k < layers; k++) {
    fill(...rgb, alpha);
    circle(cx, cy, 2 * radius * (1 - k / layers));
  }
}

// I give each background ring cluster its own speed, movement range, and phase.
// This makes the rings drift independently instead of moving in sync.
function initializeMovingRings() {
  movingRings = RING_CONFIGS.map((ring) => ({
    ...ring,

    // Different starting phases prevent the clusters from moving together.
    phaseX: random(TWO_PI),
    phaseY: random(TWO_PI),

    // Smaller numbers mean slower movement.
    speedX: random(0.012, 0.025),
    speedY: random(0.01, 0.022),

    // Maximum distance the cluster wanders from its original position.
    driftX: random(8, 22),
    driftY: random(7, 18),
  }));
}

// I use smooth sine and cosine paths to make the layered rings wander slowly.
// Reduced-motion preferences keep the clusters at their original positions.
function drawMovingRings() {
  for (const ring of movingRings) {
    let x = ring.x;
    let y = ring.y;

    if (!reduceMotion) {
      x += Math.sin(frameCount * ring.speedX + ring.phaseX) * ring.driftX;

      y += Math.cos(frameCount * ring.speedY + ring.phaseY) * ring.driftY;
    }

    drawRings(x, y, ring.radius, ring.color);
  }
}

// The original decorative ring clusters now move behind the panels.
function drawDecoration() {
  drawMovingRings();
}

function drawHeader() {
  const lines = ["How can a", "dataset tell two", "different stories?"];

  noStroke();
  textAlign(LEFT, TOP);

  // Fit the headline to the left column no matter how wide the font runs.
  textSize(44);
  let widest = 0;

  for (const line of lines) {
    widest = Math.max(widest, textWidth(line));
  }

  const size = constrain((44 * 410) / widest, 26, 42);
  const lead = size * 1.04;

  textSize(size);
  fill(...CRIMSON);

  lines.forEach((line, i) => {
    text(line, 30, 26 + i * lead);
  });

  const titleBottom = 26 + lines.length * lead;

  // Short explainer in maroon ink.
  textSize(11.5);
  textLeading(16);
  fill(...INK);

  text(
    "The same weather data, drawn twice. Only the starting point of the y-axis changes. " +
      "Slide it toward truncated and watch how small differences can create big miscommunications.",
    30,
    titleBottom + 7,
    330,
    60
  );

  // Current metric in salmon.
  textSize(13);
  fill(...SALMON);

  text(metrics[metric], 30, titleBottom + 12 + 50, 420, 20);
}

// A flat white sheet with a boxed tag straddling its top edge.
function drawPanel(box, title) {
  noStroke();
  fill(255, 255, 255, 220);
  rect(box.x, box.y, box.w, box.h, 22);

  textSize(12);
  const tagWidth = textWidth(title) + 22;

  stroke(...INK);
  strokeWeight(1);
  fill(...PAPER);
  rect(box.x + 16, box.y - 12, tagWidth, 24, 9);

  noStroke();
  fill(...INK);
  textAlign(LEFT, CENTER);
  text(title, box.x + 27, box.y + 1);
}

function drawEmptyState() {
  const zoneX = LOUD.x + 36;
  const zoneY = LOUD.y + 90;
  const zoneW = LOUD.w - 72;
  const zoneH = LOUD.h - 180;
  const centerX = zoneX + zoneW / 2;

  // Dashed drop zone; fills with mint while a file is dragged over it.
  push();
  strokeWeight(2);
  stroke(isDraggingFile ? CRIMSON : INK);

  if (isDraggingFile) {
    fill(...MINT, 50);
  } else {
    noFill();
  }

  drawingContext.setLineDash([9, 7]);
  rect(zoneX, zoneY, zoneW, zoneH, 5);
  pop();

  drawRings(centerX, zoneY + zoneH * 0.32, 70, PINK);

  noStroke();
  textAlign(CENTER, CENTER);

  fill(...CRIMSON);
  textSize(26);

  text(
    isDraggingFile ? "Drop it to load" : "Drop a CSV file here",
    centerX,
    zoneY + zoneH * 0.68
  );

  fill(...INK);
  textSize(12);

  text(
    "or press Upload CSV below the poster.",
    centerX,
    zoneY + zoneH * 0.68 + 30
  );

  fill(...SALMON);
  textSize(11);
  textAlign(CENTER, CENTER);

  // In this version, the status message is centered in its text box.
  text(
    statusMessage,
    centerX - (zoneW - 40) / 2,
    zoneY + zoneH * 0.68 + 54,
    zoneW - 40,
    40
  );
}

// A small boxed tag that follows the mouse, with the full city name.
function drawTooltip() {
  if (hoverIndex < 0 || hoverIndex >= values.length || !mouseInside) {
    return;
  }

  const message =
    labels[hoverIndex] +
    ": " +
    nf(values[hoverIndex], 1, 1) +
    " " +
    units[metric];

  textSize(12);

  const w = textWidth(message) + 24;
  const h = 26;

  const x = Math.min(mouseX + 16, width - w - 6);
  const y = Math.max(mouseY - 38, 6);

  stroke(...INK);
  strokeWeight(1);
  fill(...PAPER);
  rect(x, y, w, h, 24);

  noStroke();
  fill(...INK);
  textAlign(CENTER, CENTER);
  text(message, x + w / 2, y + h / 2 + 1);
}

// ---------------------------------------------------------------
// FILE HANDLING
// ---------------------------------------------------------------

function handleFile(file) {
  if (!file || typeof file.data !== "string") {
    statusMessage = "Please upload a text-based CSV file.";
    return;
  }

  try {
    // Remove a possible byte-order mark and extra whitespace.
    const content = file.data.replace(/^\uFEFF/, "").trim();

    if (!content) {
      throw new Error("The file is empty.");
    }

    const lines = content.split(/\r?\n/);

    const headers = lines
      .shift()
      .split(",")
      .map((column) => column.trim());

    const required = [
      "city",
      "temp_c",
      "humidity",
      "precipitation_mm",
      "wind_kmh",
    ];

    const missing = required.filter((column) => !headers.includes(column));

    if (missing.length > 0) {
      throw new Error("Missing columns: " + missing.join(", "));
    }

    // Convert CSV rows into objects.
    records = lines
      .map((line) => {
        const fields = line.split(",");
        const row = {};

        headers.forEach((header, index) => {
          row[header] = (fields[index] ?? "").trim();
        });

        return row;
      })
      .filter((row) => row.city);

    if (records.length === 0) {
      throw new Error("No data rows were found.");
    }

    fileName = file.name || "";
    updateSummary();
  } catch (error) {
    records = [];
    labels = [];
    values = [];

    statusMessage = "CSV error: " + error.message;
  }
}

function updateSummary() {
  // Nothing to summarize until a file has been loaded.
  if (records.length === 0) {
    return;
  }

  const totals = {};
  const counts = {};

  for (const row of records) {
    const city = row.city;
    const rawValue = row[metric];

    // Ignore blank or invalid numeric values.
    if (!city || rawValue === undefined || rawValue.trim() === "") {
      continue;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      continue;
    }

    if (!(city in totals)) {
      totals[city] = 0;
      counts[city] = 0;
    }

    totals[city] += value;
    counts[city]++;
  }

  // Sort cities so the order stays predictable.
  labels = Object.keys(totals).sort();

  values = labels.map((city) => totals[city] / counts[city]);

  // Replay the load sequence (or skip it if motion is reduced).
  loadFrame = reduceMotion ? 9999 : 0;

  statusMessage =
    (fileName ? fileName + ": " : "") +
    "loaded " +
    records.length +
    " rows; comparing " +
    labels.length +
    " cities.";
}
// ---------------------------------------------------------------
// CHART HELPERS
// ---------------------------------------------------------------

// I interpolate each RGB channel separately to create smooth color transitions.
function mixRGB(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Mint (low) -> butter (middle) -> hot pink (high).
function rampRGB(t) {
  return t < 0.5
    ? mixRGB(MINT, BUTTER, t * 2)
    : mixRGB(BUTTER, PINK, (t - 0.5) * 2);
}

// Convert an RGB array into a color string for canvas gradients.
function cssRGB(c, a = 1) {
  return (
    "rgba(" +
    Math.round(c[0]) +
    "," +
    Math.round(c[1]) +
    "," +
    Math.round(c[2]) +
    "," +
    a +
    ")"
  );
}

// Smooth ease-out with no bounce: calm, like a print reveal.
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Shortens long city names so tilted labels don't collide with anything.
function shorten(name, maxChars) {
  return name.length > maxChars ? name.slice(0, maxChars - 1) + ".." : name;
}

// Builds an arch: straight sides, fully rounded top.
function archPath(ctx, x, y, w, h) {
  const r = Math.min(w / 2, h);

  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// box = { x, y, w, h }. startFrame = when this chart's bars begin to rise.
function drawBarChart(box, zeroBaselineBlend, startFrame) {
  const ctx = drawingContext;
  const px = box.x;
  const py = box.y;
  const pw = box.w;
  const ph = box.h;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // The lowest the normal axis needs to go.
  const honestMin = Math.min(0, minValue);

  // 0 = axis starts at the smallest value.
  // 1 = axis starts at zero (or below, for negative data).
  const yMin = lerp(minValue, honestMin, zeroBaselineBlend);

  const yMax = Math.max(maxValue + (maxValue - yMin) * 0.12, yMin + 1);

  const plotLeft = px + 46;
  const plotRight = px + pw - 18;
  const plotTop = py + 40;
  const plotBottom = py + ph - 78;
  const plotWidth = plotRight - plotLeft;

  // Dashed gridlines and vertical-axis labels.
  textSize(10);
  textAlign(RIGHT, CENTER);

  for (let i = 0; i <= 5; i++) {
    const tick = yMin + ((yMax - yMin) * i) / 5;

    const y = map(tick, yMin, yMax, plotBottom, plotTop);

    push();
    stroke(...INK, 45);
    strokeWeight(1);
    ctx.setLineDash([3, 5]);
    line(plotLeft, y, plotRight, y);
    pop();

    noStroke();
    fill(...INK, 190);
    text(nf(tick, 1, 1), plotLeft - 8, y);
  }

  // Baseline.
  stroke(...INK);
  strokeWeight(1.5);
  line(plotLeft, plotBottom, plotRight, plotBottom);

  // Bars.
  const slotWidth = plotWidth / values.length;
  const barWidth = Math.min(40, slotWidth * 0.62);

  // If city names won't fit, tilt and shorten them.
  textSize(11);

  let widest = 0;

  for (const name of labels) {
    widest = Math.max(widest, textWidth(name));
  }

  const rotateLabels = widest > slotWidth - 6;

  for (let i = 0; i < values.length; i++) {
    const centerX = plotLeft + slotWidth * (i + 0.5);

    // Each bar starts a few frames after the previous bar.
    const progress = constrain((loadFrame - startFrame - i * 3) / 30, 0, 1);

    const shownValue = lerp(yMin, values[i], easeOutCubic(progress));

    const barTop = map(shownValue, yMin, yMax, plotBottom, plotTop);

    const barHeight = Math.max(0, plotBottom - barTop);

    // Check whether the mouse is over this city's column.
    const overThisBar =
      mouseInside &&
      mouseX > centerX - slotWidth / 2 &&
      mouseX < centerX + slotWidth / 2 &&
      mouseY > plotTop &&
      mouseY < plotBottom + 10;

    if (overThisBar) {
      pendingHover = i;
    }

    // Dim every other bar while one city is highlighted.
    const isDimmed = hoverIndex !== -1 && hoverIndex !== i;
    const isHighlighted = hoverIndex === i;

    // Normalize the value to a range from 0 to 1.
    const colorT =
      maxValue === minValue
        ? 0.5
        : (values[i] - minValue) / (maxValue - minValue);

    const baseRGB = rampRGB(colorT);
    const x = centerX - barWidth / 2;

    // Hover effect: rings bloom behind the selected bar's top.
    if (i === stickyHover && ringAmount > 0.01 && progress >= 1) {
      drawRings(centerX, barTop, 34 * ringAmount, baseRGB, 5, 34);

      push();
      stroke(...INK, 150 * ringAmount);
      strokeWeight(1);
      ctx.setLineDash([5, 5]);
      line(plotLeft, barTop, plotRight, barTop);
      pop();
    }

    if (barHeight > 0.5) {
      // Arch with a soft fade toward the baseline.
      push();
      ctx.globalAlpha = isDimmed ? 0.3 : 1;

      const fade = ctx.createLinearGradient(0, barTop, 0, plotBottom);

      fade.addColorStop(0, cssRGB(baseRGB));
      fade.addColorStop(1, cssRGB(mixRGB(baseRGB, PAPER, 0.6)));

      ctx.fillStyle = fade;

      archPath(ctx, x, barTop, barWidth, barHeight);
      ctx.fill();

      if (isHighlighted) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = cssRGB(INK);
        ctx.stroke();
      }

      pop();
    }

    // Actual numerical value, fading in as the bar rises.
    noStroke();
    fill(...INK, (isDimmed ? 90 : 255) * progress);
    textAlign(CENTER, BOTTOM);
    textSize(isHighlighted ? 13 : 11);
    text(nf(values[i], 1, 1), centerX, barTop - 5);

    // City name: flat if it fits, tilted and shortened if it doesn't.
    fill(...(isHighlighted ? CRIMSON : INK), isDimmed ? 110 : 255);

    textSize(11);

    if (rotateLabels) {
      push();
      translate(centerX + 4, plotBottom + 10);
      rotate(-QUARTER_PI);
      textAlign(RIGHT, CENTER);
      text(shorten(labels[i], 10), 0, 0);
      pop();
    } else {
      textAlign(CENTER, TOP);
      text(labels[i], centerX, plotBottom + 8);
    }
  }

  // Disclose the axis baseline in a boxed tag.
  // It turns crimson when the axis is truncated.
  const isTruncated = yMin > honestMin + 0.01;

  const note =
    "Y-axis starts at " + nf(yMin, 1, 1) + (isTruncated ? " (truncated)" : "");

  textSize(11);

  const noteWidth = textWidth(note) + 22;
  const noteX = px + pw - noteWidth - 16;
  const noteY = py + ph - 12;

  stroke(isTruncated ? CRIMSON : INK);
  strokeWeight(1);
  fill(isTruncated ? CRIMSON : PAPER);
  rect(noteX, noteY, noteWidth, 24);

  noStroke();
  fill(...(isTruncated ? PAPER : INK));
  textAlign(CENTER, CENTER);

  text(note, noteX + noteWidth / 2, noteY + 13);
}
