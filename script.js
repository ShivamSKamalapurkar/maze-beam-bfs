/* ---------- Maze & helpers ---------- */
const rows = 10;
const cols = 15;

let maze = [
  [0,0,0,1,0,0,0,0,0,1,0,0,0,0,0],
  [1,1,0,1,0,1,1,1,0,1,0,1,1,1,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,1,0],
  [0,1,1,1,1,1,0,1,1,1,1,1,0,1,0],
  [0,0,0,0,0,1,0,0,0,0,0,1,0,0,0],
  [0,1,1,1,0,1,1,1,1,1,0,1,1,1,0],
  [0,1,0,0,0,0,0,0,0,1,0,0,0,1,0],
  [0,1,0,1,1,1,1,1,0,1,1,1,0,1,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,1,0],
  [1,1,1,1,1,1,0,1,0,1,1,1,0,0,0]
];

const start = { r: 0, c: 0 };
const goal  = { r: 9, c: 14 };

const mazeDiv           = document.getElementById("maze");
const statusDiv         = document.getElementById("status");
const beamExploredSpan  = document.getElementById("beamExplored");
const beamPathLenSpan   = document.getElementById("beamPathLen");
const bfsExploredSpan   = document.getElementById("bfsExplored");
const bfsPathLenSpan    = document.getElementById("bfsPathLen");
const beamWidthInput    = document.getElementById("beamWidth");
const resetBtn          = document.getElementById("resetBtn");
const stepBtn           = document.getElementById("stepBtn");
const autoBtn           = document.getElementById("autoBtn");
const bfsBtn            = document.getElementById("bfsBtn");
const randomBtn         = document.getElementById("randomBtn");
const treeViewDiv       = document.getElementById("treeView");
const heuristicCanvas   = document.getElementById("heuristicChart");
const heuristicCtx      = heuristicCanvas.getContext("2d");

const serialize = (p) => `${p.r},${p.c}`;

function neighborsOf(pos, grid) {
  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 }
  ];
  const res = [];
  for (const d of dirs) {
    const nr = pos.r + d.dr;
    const nc = pos.c + d.dc;
    if (
      nr >= 0 && nr < grid.length &&
      nc >= 0 && nc < grid[0].length &&
      grid[nr][nc] === 0
    ) {
      res.push({ r: nr, c: nc });
    }
  }
  return res;
}

function manhattan(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/* ---------- Greedy “possible path” ---------- */
function computeGreedyPath(grid, s, g) {
  const path = [s];
  const visited = new Set([serialize(s)]);
  let current = s;
  let safety = rows * cols + 5;

  while (safety-- > 0) {
    if (current.r === g.r && current.c === g.c) break;

    const neighs = neighborsOf(current, grid)
      .filter(nb => !visited.has(serialize(nb)));
    if (neighs.length === 0) break;

    let best = neighs[0];
    let bestH = manhattan(best, g);
    for (let i = 1; i < neighs.length; i++) {
      const h = manhattan(neighs[i], g);
      if (h < bestH) { bestH = h; best = neighs[i]; }
    }

    current = best;
    visited.add(serialize(current));
    path.push(current);
  }
  return path;
}

/* ---------- Rendering ---------- */
let beamPathCells = new Set();
let bfsPathCells  = new Set();

function renderMaze(visitedSet = new Set(), frontierSet = new Set()) {
  mazeDiv.innerHTML = "";
  mazeDiv.style.gridTemplateColumns = `repeat(${cols}, 28px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      const key = `${r},${c}`;

      if (r === start.r && c === start.c) {
        cell.classList.add("start");
      } else if (r === goal.r && c === goal.c) {
        cell.classList.add("goal");
      } else if (maze[r][c] === 1) {
        cell.classList.add("wall");
      } else {
        const inBeam = beamPathCells.has(key);
        const inBfs  = bfsPathCells.has(key);

        if (inBeam && inBfs) {
          cell.classList.add("path-both");
        } else if (inBeam) {
          cell.classList.add("path-beam");
        } else if (inBfs) {
          cell.classList.add("path-bfs");
        } else if (frontierSet.has(key)) {
          cell.classList.add("frontier");
        } else if (visitedSet.has(key)) {
          cell.classList.add("visited");
        }
      }
      mazeDiv.appendChild(cell);
    }
  }
}

function setStatus(text) {
  statusDiv.textContent = text;
  if (text && text.trim().length > 0) {
    statusDiv.classList.add("has-text");
  } else {
    statusDiv.classList.remove("has-text");
  }
}

function setBeamStats(explored, pathLen) {
  beamExploredSpan.textContent = explored;
  beamPathLenSpan.textContent = pathLen != null ? pathLen : "–";
}

function setBfsStats(explored, pathLen) {
  bfsExploredSpan.textContent = explored != null ? explored : "–";
  bfsPathLenSpan.textContent  = pathLen != null ? pathLen : "–";
}

/* ---------- Tree / “graph” view ---------- */
function renderTree(beamStates, candidateStates, beamWidth) {
  if (!treeViewDiv) return;

  let html = "";

  // Expanded (current beam)
  html += '<div class="tree-section-label">Expanded (current beam)</div>';
  if (!beamStates || beamStates.length === 0) {
    html += '<div class="tree-empty">–</div>';
  } else {
    html += '<ul class="tree-list">';
    for (const s of beamStates) {
      const g = s.path.length;
      const h = manhattan(s.pos, goal);
      const f = g + h;
      html += `
        <li class="tree-row tree-expanded">
          <div class="tree-node">
            <div class="tree-circle">${String.fromCharCode(65 + s.pos.c % 6)}</div>
            <span class="tree-node-text">(${s.pos.r},${s.pos.c})</span>
          </div>
          <div class="tree-meta">g=${g}, h=${h}, f=${f}</div>
        </li>
      `;
    }
    html += "</ul>";
  }

  // Children
  html += '<div class="tree-section-label">Children (sorted by f = g + h)</div>';
  if (!candidateStates || candidateStates.length === 0) {
    html += '<div class="tree-empty">No children on this step.</div>';
  } else {
    const sorted = [...candidateStates].sort((a, b) => a.score - b.score);
    html += '<ul class="tree-list">';
    sorted.forEach((node, idx) => {
      const cls = idx < beamWidth ? "tree-next" : "tree-pruned";
      const g = node.path.length;
      const h = manhattan(node.pos, goal);
      const f = g + h;
      const label = idx < beamWidth ? "kept in beam" : "pruned";
      html += `
        <li class="tree-row ${cls}">
          <div class="tree-node">
            <div class="tree-circle">${String.fromCharCode(65 + node.pos.c % 6)}</div>
            <span class="tree-node-text">(${node.pos.r},${node.pos.c})</span>
          </div>
          <div class="tree-meta">g=${g}, h=${h}, f=${f} · ${label}</div>
        </li>
      `;
    });
    html += "</ul>";
  }

  treeViewDiv.innerHTML = html;
}

/* ---------- Heuristic graph (greedy vs beam) ---------- */
function drawHeuristicChart(greedyPath, beamPath) {
  const ctx = heuristicCtx;
  const w = heuristicCanvas.width;
  const h = heuristicCanvas.height;

  ctx.clearRect(0, 0, w, h);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, "#020617");
  bgGrad.addColorStop(1, "#020617");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const greedyHs = greedyPath ? greedyPath.map(p => manhattan(p, goal)) : [];
  const beamHs   = beamPath   ? beamPath.map(p   => manhattan(p, goal)) : [];

  if (!greedyHs.length && !beamHs.length) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px system-ui";
    ctx.fillText("Heuristic graph appears when beam path is computed.", 12, h / 2);
    return;
  }

  const maxH = Math.max(1, ...greedyHs, ...beamHs);
  const paddingLeft = 34;
  const paddingRight = 10;
  const paddingBottom = 18;
  const paddingTop = 10;
  const plotW = w - paddingLeft - paddingRight;
  const plotH = h - paddingTop - paddingBottom;

  // Axes
  ctx.strokeStyle = "#374151";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, paddingTop + plotH);
  ctx.lineTo(paddingLeft + plotW, paddingTop + plotH);
  ctx.stroke();

  ctx.fillStyle = "#9ca3af";
  ctx.font = "9px system-ui";
  ctx.fillText("h (Manhattan)", 4, paddingTop + 8);
  ctx.fillText("Step →", paddingLeft + 50, h - 4);

  function drawSeries(values, color) {
    if (!values.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const x = paddingLeft + (values.length === 1 ? 0 : (i / (values.length - 1)) * plotW);
      const y = paddingTop + plotH - (v / maxH) * (plotH - 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawSeries(greedyHs, "#a855f7");
  drawSeries(beamHs,   "#38bdf8");
}

/* ---------- Beam search engine (step-wise) ---------- */
const engine = {
  initialized: false,
  finished: false,
  beamWidth: 3,
  beam: [],
  visited: new Set(),
  frontierSet: new Set(),
  exploredCount: 0,
  finalPath: null,
  greedyPath: null
};

let autoPlaying = false;

function initEngine() {
  const bw = parseInt(beamWidthInput.value) || 3;
  engine.beamWidth = bw;
  engine.visited = new Set();
  engine.visited.add(serialize(start));
  engine.frontierSet = new Set([serialize(start)]);
  engine.beam = [{ pos: start, path: [start] }];
  engine.exploredCount = 1;
  engine.finished = false;
  engine.finalPath = null;
  engine.initialized = true;

  beamPathCells.clear(); // clear previous beam path; keep BFS path
  setBeamStats(engine.exploredCount, null);
  setStatus(`Beam engine ready. Beam width = ${bw}. Use Next Step or Auto-play.`);
  renderMaze(engine.visited, engine.frontierSet);
  renderTree(engine.beam, [], engine.beamWidth);

  engine.greedyPath = computeGreedyPath(maze, start, goal);
  drawHeuristicChart(engine.greedyPath, null);
}

function stepEngine() {
  if (!engine.initialized || engine.finished) return;

  const visited = engine.visited;
  const currentBeam = engine.beam;
  const beamWidth   = engine.beamWidth;
  let candidates = [];
  const newFrontier = new Set();

  for (const state of currentBeam) {
    const current = state.pos;

    if (current.r === goal.r && current.c === goal.c) {
      engine.finished = true;
      engine.finalPath = state.path;
      beamPathCells.clear();
      state.path.forEach(p => beamPathCells.add(serialize(p)));
      setBeamStats(engine.exploredCount, state.path.length);
      setStatus(`Goal reached! Beam path length = ${state.path.length}, nodes explored = ${engine.exploredCount}.`);
      renderMaze(visited, newFrontier);
      renderTree([state], [], beamWidth);
      drawHeuristicChart(engine.greedyPath, engine.finalPath);
      return;
    }

    const neighs = neighborsOf(current, maze);
    for (const nb of neighs) {
      const key = serialize(nb);
      if (visited.has(key)) continue;
      visited.add(key);
      engine.exploredCount++;

      const newPath = state.path.concat([nb]);
      const score   = newPath.length + manhattan(nb, goal);
      candidates.push({ pos: nb, path: newPath, score, parent: state.pos });
      newFrontier.add(key);
    }
  }

  engine.frontierSet = newFrontier;
  renderMaze(visited, engine.frontierSet);
  setBeamStats(engine.exploredCount, engine.finalPath ? engine.finalPath.length : null);
  renderTree(currentBeam, candidates, beamWidth);

  if (!candidates.length) {
    engine.finished = true;
    setStatus("Beam search finished: no path found for this beam width.");
    drawHeuristicChart(engine.greedyPath, null);
    return;
  }

  candidates.sort((a, b) => a.score - b.score);
  engine.beam = candidates.slice(0, beamWidth);
  setStatus(`Step complete. Beam size = ${engine.beam.length}, nodes explored = ${engine.exploredCount}.`);
}

/* ---------- BFS (non-animated, for comparison) ---------- */
function runBFSCompare() {
  const queue = [start];
  const visited = new Set([serialize(start)]);
  const parent  = new Map();
  let explored  = 1;
  let foundPath = null;

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.r === goal.r && current.c === goal.c) {
      foundPath = [];
      let cur = current;
      while (true) {
        foundPath.push(cur);
        const key = serialize(cur);
        const parentKey = parent.get(key);
        if (!parentKey) break;
        const [pr, pc] = parentKey.split(",").map(Number);
        cur = { r: pr, c: pc };
      }
      foundPath.reverse();
      break;
    }

    const neighs = neighborsOf(current, maze);
    for (const nb of neighs) {
      const key = serialize(nb);
      if (!visited.has(key)) {
        visited.add(key);
        explored++;
        parent.set(key, serialize(current));
        queue.push(nb);
      }
    }
  }

  bfsPathCells.clear();
  let pathLen = null;
  if (foundPath) {
    for (const p of foundPath) bfsPathCells.add(serialize(p));
    pathLen = foundPath.length;
  }
  setBfsStats(explored, pathLen);
  renderMaze(engine.visited, engine.frontierSet);
  setStatus(statusDiv.textContent + "  |  BFS run updated.");
}

/* ---------- UI handlers ---------- */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function toggleAutoPlay() {
  if (autoPlaying) {
    autoPlaying = false;
    autoBtn.innerHTML = "<span>⏵</span> Auto-play";
    beamWidthInput.disabled = false;
    resetBtn.disabled = false;
    randomBtn.disabled = false;
    bfsBtn.disabled = false;
    return;
  }

  if (!engine.initialized || engine.finished) {
    initEngine();
  }

  autoPlaying = true;
  autoBtn.innerHTML = "<span>⏸</span> Pause";
  beamWidthInput.disabled = true;
  resetBtn.disabled = true;
  randomBtn.disabled = true;
  bfsBtn.disabled = true;

  while (autoPlaying && !engine.finished) {
    stepEngine();
    if (engine.finished) break;
    await sleep(220);
  }

  autoPlaying = false;
  autoBtn.innerHTML = "<span>⏵</span> Auto-play";
  beamWidthInput.disabled = false;
  resetBtn.disabled = false;
  randomBtn.disabled = false;
  bfsBtn.disabled = false;
}

/* ---------- Button bindings ---------- */
resetBtn.addEventListener("click", () => {
  autoPlaying = false;
  autoBtn.innerHTML = "<span>⏵</span> Auto-play";
  setBfsStats(null, null);  // you can keep BFS result if you want; here we clear it
  initEngine();
});

stepBtn.addEventListener("click", () => {
  if (autoPlaying) return;
  if (!engine.initialized || engine.finished) {
    initEngine();
  } else {
    stepEngine();
  }
});

autoBtn.addEventListener("click", toggleAutoPlay);

bfsBtn.addEventListener("click", () => {
  if (autoPlaying) return;
  runBFSCompare();
});

randomBtn.addEventListener("click", () => {
  if (autoPlaying) return;
  const density = 0.3;
  const m = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      if ((r === start.r && c === start.c) || (r === goal.r && c === goal.c)) {
        row.push(0);
      } else {
        row.push(Math.random() < density ? 1 : 0);
      }
    }
    m.push(row);
  }
  maze = m;

  beamPathCells.clear();
  bfsPathCells.clear();
  engine.initialized = false;
  engine.finished = false;
  setBeamStats(0, null);
  setBfsStats(null, null);
  renderMaze(new Set(), new Set());
  treeViewDiv.innerHTML =
    '<div class="tree-empty">Click <strong>Reset Beam</strong> then Next Step or Auto-play.</div>';
  setStatus("Generated a new random maze.");
  drawHeuristicChart(null, null);
});

/* ---------- Initial render ---------- */
renderMaze(new Set(), new Set());
setBeamStats(0, null);
setBfsStats(null, null);
setStatus('Ready. Click "Reset Beam" then use Next Step or Auto-play. Run BFS to compare.');
drawHeuristicChart(null, null);
