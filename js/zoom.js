/**
 * SEIXAS — Cursor Magnifier (Lupa)
 * Mostra uma lupa circular que segue o cursor sobre o preview da tela.
 * Ativa/desativa via toggle — nunca clica na tela do Seixas.
 */

let enabled = false;
let lensEl = null;
let lensCtx = null;
let videoEl = null;
let containerEl = null;
let rafId = null;
let mouseX = 0;
let mouseY = 0;

const LENS_SIZE = 160;   // diâmetro da lupa em px
const ZOOM_FACTOR = 3;   // 3× de zoom

/**
 * Inicializa a lupa sobre o container do preview.
 * @param {HTMLElement} container - previewContainer
 * @param {HTMLVideoElement} video - screenPreview
 */
export function initMagnifier(container, video) {
    containerEl = container;
    videoEl = video;

    // Canvas circular da lupa
    const canvas = document.createElement('canvas');
    canvas.width = LENS_SIZE;
    canvas.height = LENS_SIZE;
    canvas.style.cssText = `
    position: absolute;
    width: ${LENS_SIZE}px;
    height: ${LENS_SIZE}px;
    border-radius: 50%;
    border: 2.5px solid rgba(0,212,170,0.8);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5);
    pointer-events: none;
    display: none;
    z-index: 35;
    overflow: hidden;
    backdrop-filter: none;
  `;
    container.appendChild(canvas);
    lensEl = canvas;
    lensCtx = canvas.getContext('2d');

    // Cross-hair no centro da lupa
    // (desenhado a cada frame)

    // Rastreia cursor APENAS sobre o screenPreview
    video.addEventListener('mouseenter', () => { if (enabled) showLens(); });
    video.addEventListener('mouseleave', () => hideLens());
    video.addEventListener('mousemove', (e) => {
        if (!enabled) return;
        const rect = container.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        moveLens();
    });
}

function showLens() {
    if (!lensEl || !enabled) return;
    lensEl.style.display = 'block';
    startLoop();
}

function hideLens() {
    if (!lensEl) return;
    lensEl.style.display = 'none';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function moveLens() {
    if (!lensEl) return;
    const hw = LENS_SIZE / 2;
    lensEl.style.left = (mouseX - hw) + 'px';
    lensEl.style.top = (mouseY - hw) + 'px';
}

function startLoop() {
    if (rafId) return;
    function draw() {
        if (!enabled || !videoEl || videoEl.readyState < 2) {
            rafId = requestAnimationFrame(draw);
            return;
        }

        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const rect = containerEl.getBoundingClientRect();
        const videoRect = videoEl.getBoundingClientRect();

        // Posição do cursor como fração do vídeo real
        // (o vídeo pode ter letterboxing via object-fit:contain)
        const displayW = videoRect.width;
        const displayH = videoRect.height;

        // Área real do vídeo dentro do elemento (object-fit:contain)
        const videoAspect = vw / vh;
        const elemAspect = displayW / displayH;
        let vidDispW, vidDispH, vidOffX, vidOffY;

        if (videoAspect > elemAspect) {
            vidDispW = displayW;
            vidDispH = displayW / videoAspect;
            vidOffX = 0;
            vidOffY = (displayH - vidDispH) / 2;
        } else {
            vidDispH = displayH;
            vidDispW = displayH * videoAspect;
            vidOffX = (displayW - vidDispW) / 2;
            vidOffY = 0;
        }

        // Posição do cursor relativa ao container → relativa ao vídeo
        const relX = mouseX - (videoRect.left - rect.left) - vidOffX;
        const relY = mouseY - (videoRect.top - rect.top) - vidOffY;

        // Fração 0-1
        const fx = relX / vidDispW;
        const fy = relY / vidDispH;

        // Área do vídeo real a capturar (tamanho = LENS_SIZE/ZOOM_FACTOR em pixels de vídeo)
        const capW = (LENS_SIZE / ZOOM_FACTOR) * (vw / vidDispW);
        const capH = (LENS_SIZE / ZOOM_FACTOR) * (vh / vidDispH);
        const srcX = Math.round(fx * vw - capW / 2);
        const srcY = Math.round(fy * vh - capH / 2);

        // Clamp
        const clampedX = Math.max(0, Math.min(vw - capW, srcX));
        const clampedY = Math.max(0, Math.min(vh - capH, srcY));

        lensCtx.clearRect(0, 0, LENS_SIZE, LENS_SIZE);
        lensCtx.drawImage(videoEl, clampedX, clampedY, capW, capH, 0, 0, LENS_SIZE, LENS_SIZE);

        // Crosshair central
        lensCtx.save();
        lensCtx.strokeStyle = 'rgba(0,212,170,0.7)';
        lensCtx.lineWidth = 1;
        lensCtx.beginPath();
        lensCtx.moveTo(LENS_SIZE / 2, LENS_SIZE / 2 - 8);
        lensCtx.lineTo(LENS_SIZE / 2, LENS_SIZE / 2 + 8);
        lensCtx.moveTo(LENS_SIZE / 2 - 8, LENS_SIZE / 2);
        lensCtx.lineTo(LENS_SIZE / 2 + 8, LENS_SIZE / 2);
        lensCtx.stroke();
        lensCtx.restore();

        rafId = requestAnimationFrame(draw);
    }
    draw();
}

export function setMagnifierEnabled(active) {
    enabled = active;
    if (!active) hideLens();
}

export function isMagnifierEnabled() { return enabled; }
