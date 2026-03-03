/**
 * SEIXAS — Annotation/Drawing Overlay Module
 * Ferramentas: Lápis, Laser (fade real), Highlight, Texto, Borracha
 * Laser usa canvas separado com rAF para o fade.
 */

// Canvas permanente (lápis, highlight, texto)
let drawCanvas = null;
let drawCtx = null;

// Canvas temporário do laser (limpo a cada frame)
let laserCanvas = null;
let laserCtx = null;
let laserStrokes = []; // { points: [{x,y}], startTime: number }
let laserRafId = null;

let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#00d4aa';
let currentSize = 4;
let enabled = false;
let textInputEl = null;

const LASER_FADE_MS = 1600;

const TOOLS = {
    pen: { cursor: 'crosshair' },
    laser: { cursor: 'crosshair' },
    highlight: { cursor: 'crosshair' },
    text: { cursor: 'text' },
    eraser: { cursor: 'cell' },
};

export const COLORS = ['#00d4aa', '#ff3344', '#ffcc00', '#ffffff', '#ff44cc', '#44aaff'];

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
export function initAnnotations(container) {
    // Canvas permanente
    drawCanvas = document.createElement('canvas');
    drawCanvas.id = 'drawCanvas';
    drawCanvas.style.cssText = `
    position:absolute; inset:0; z-index:21;
    width:100%; height:100%;
    pointer-events:none; border-radius:16px;
  `;
    container.appendChild(drawCanvas);
    drawCtx = drawCanvas.getContext('2d');

    // Canvas laser (temporário, desenhado por cima)
    laserCanvas = document.createElement('canvas');
    laserCanvas.id = 'laserCanvas';
    laserCanvas.style.cssText = `
    position:absolute; inset:0; z-index:22;
    width:100%; height:100%;
    pointer-events:none; border-radius:16px;
  `;
    container.appendChild(laserCanvas);
    laserCtx = laserCanvas.getContext('2d');

    syncSize(container);
    new ResizeObserver(() => syncSize(container)).observe(container);

    // Loop de render do laser
    startLaserLoop();
}

function syncSize(container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    // Guard: só reseta se realmente mudou (evita apagar rascunhos)
    if (drawCanvas && (drawCanvas.width !== w || drawCanvas.height !== h)) {
        drawCanvas.width = w; drawCanvas.height = h;
    }
    if (laserCanvas && (laserCanvas.width !== w || laserCanvas.height !== h)) {
        laserCanvas.width = w; laserCanvas.height = h;
    }
}

// ──────────────────────────────────────────────
// Laser Render Loop
// ──────────────────────────────────────────────
function startLaserLoop() {
    function loop() {
        if (!laserCanvas) return;
        laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);

        const now = Date.now();
        // Remove strokes expirados
        laserStrokes = laserStrokes.filter(s => now - s.startTime < LASER_FADE_MS);

        laserStrokes.forEach(stroke => {
            const age = now - stroke.startTime;
            const opacity = Math.max(0, 1 - age / LASER_FADE_MS);
            const points = stroke.points;
            if (points.length < 2) return;

            laserCtx.save();
            laserCtx.globalAlpha = opacity;
            laserCtx.strokeStyle = '#ff2244';
            laserCtx.lineWidth = currentSize + 2;
            laserCtx.lineCap = 'round';
            laserCtx.lineJoin = 'round';
            laserCtx.shadowColor = '#ff0000';
            laserCtx.shadowBlur = 12;

            laserCtx.beginPath();
            laserCtx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                laserCtx.lineTo(points[i].x, points[i].y);
            }
            laserCtx.stroke();
            laserCtx.restore();
        });

        laserRafId = requestAnimationFrame(loop);
    }
    loop();
}

// ──────────────────────────────────────────────
// Controls
// ──────────────────────────────────────────────
export function setAnnotationsEnabled(active) {
    enabled = active;
    if (drawCanvas) {
        drawCanvas.style.pointerEvents = active ? 'auto' : 'none';
        drawCanvas.style.cursor = active ? (TOOLS[currentTool]?.cursor || 'crosshair') : 'default';
    }
}
export function isAnnotationsEnabled() { return enabled; }
export function setTool(tool) {
    currentTool = tool;
    if (drawCanvas && enabled) drawCanvas.style.cursor = TOOLS[tool]?.cursor || 'crosshair';
}
export function getCurrentTool() { return currentTool; }
export function setColor(color) { currentColor = color; }
export function setSize(size) { currentSize = size; }

export function clearAnnotations() {
    drawCtx?.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    laserStrokes = [];
}

export function getDrawCanvas() { return drawCanvas; }
export function getLaserCanvas() { return laserCanvas; }

// ──────────────────────────────────────────────
// Drawing Events
// ──────────────────────────────────────────────
let currentPath = [];
let activeStroke = null; // referência ao stroke do laser atual

export function bindDrawingEvents() {
    if (!drawCanvas) return;
    drawCanvas.addEventListener('mousedown', onStart);
    drawCanvas.addEventListener('mousemove', onMove);
    drawCanvas.addEventListener('mouseup', onEnd);
    drawCanvas.addEventListener('mouseleave', onEnd);
    drawCanvas.addEventListener('touchstart', e => onStart(e.touches[0]), { passive: true });
    drawCanvas.addEventListener('touchmove', e => { e.preventDefault(); onMove(e.touches[0]); }, { passive: false });
    drawCanvas.addEventListener('touchend', onEnd);
}

function getPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function onStart(e) {
    if (!enabled) return;
    const pos = getPos(e);

    if (currentTool === 'text') { spawnTextInput(pos); return; }

    isDrawing = true;
    currentPath = [pos];

    if (currentTool === 'laser') {
        // Cria novo stroke no array
        activeStroke = { points: [pos], startTime: Date.now() };
        laserStrokes.push(activeStroke);
        return;
    }

    drawCtx.save();
    applyToolStyle();
    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);
}

function onMove(e) {
    if (!enabled || !isDrawing) return;
    const pos = getPos(e);

    if (currentTool === 'eraser') {
        const s = currentSize * 4;
        drawCtx.clearRect(pos.x - s / 2, pos.y - s / 2, s, s);
        return;
    }

    if (currentTool === 'laser') {
        if (activeStroke) {
            activeStroke.points.push(pos);
            activeStroke.startTime = Date.now(); // renova o tempo enquanto move
        }
        return;
    }

    drawCtx.lineTo(pos.x, pos.y);
    drawCtx.stroke();
}

function onEnd() {
    if (!isDrawing) return;
    isDrawing = false;
    activeStroke = null;

    if (currentTool !== 'laser' && currentTool !== 'eraser' && currentTool !== 'text') {
        drawCtx.restore();
    }
}

function applyToolStyle() {
    if (currentTool === 'pen') {
        drawCtx.globalAlpha = 1;
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = currentColor;
        drawCtx.lineWidth = currentSize;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
    } else if (currentTool === 'highlight') {
        drawCtx.globalAlpha = 0.35;
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = currentColor;
        drawCtx.lineWidth = currentSize * 5;
        drawCtx.lineCap = 'square';
        drawCtx.lineJoin = 'round';
    }
}

// ──────────────────────────────────────────────
// Text Input
// ──────────────────────────────────────────────
function spawnTextInput(pos) {
    if (textInputEl) { commitText(); return; }
    textInputEl = document.createElement('textarea');
    textInputEl.style.cssText = `
    position:absolute; left:${pos.x}px; top:${pos.y}px;
    min-width:140px; max-width:400px;
    background:rgba(0,0,0,0.75);
    border:none; border-bottom:2px solid ${currentColor};
    border-radius:4px 4px 0 0;
    color:${currentColor}; font-size:${14 + currentSize}px;
    font-family:Inter,sans-serif; font-weight:600;
    resize:none; outline:none; z-index:30;
    caret-color:${currentColor}; padding:4px 8px;
    white-space:pre;
  `;
    drawCanvas.parentElement.appendChild(textInputEl);
    setTimeout(() => textInputEl.focus(), 10);
    textInputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
        if (e.key === 'Escape') { textInputEl.remove(); textInputEl = null; }
    });
    // Commit ao clicar FORA (não imediato)
    const onOut = (e) => {
        if (!textInputEl) return;
        if (!textInputEl.contains(e.target)) {
            document.removeEventListener('mousedown', onOut);
            commitText();
        }
    };
    setTimeout(() => document.addEventListener('mousedown', onOut), 250);
}

function commitText() {
    if (!textInputEl) return;
    const text = textInputEl.value.trim();
    const left = parseFloat(textInputEl.style.left);
    const top = parseFloat(textInputEl.style.top);
    if (text) {
        drawCtx.save();
        drawCtx.font = `600 ${14 + currentSize}px Inter, sans-serif`;
        drawCtx.fillStyle = currentColor;
        drawCtx.globalAlpha = 1;
        drawCtx.shadowColor = 'rgba(0,0,0,0.6)';
        drawCtx.shadowBlur = 4;
        drawCtx.fillText(text, left + 4, top + 14 + currentSize);
        drawCtx.restore();
    }
    textInputEl.remove();
    textInputEl = null;
}

export function destroyAnnotations() {
    if (laserRafId) cancelAnimationFrame(laserRafId);
    drawCanvas?.remove(); laserCanvas?.remove();
    drawCanvas = laserCanvas = null;
}

export { TOOLS };
