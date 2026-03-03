/**
 * SEIXAS — Draggable Webcam Module
 * Permite arrastar a janela da webcam dentro do preview da tela.
 * Sincroniza posição visual (CSS) e posição de compositing (px no canvas gravado).
 */

// Posição normalizada (0-1) dentro do preview container
// Default: canto inferior direito
let posX = 1;  // 0 = esquerda, 1 = direita
let posY = 1;  // 0 = topo, 1 = baixo
let isDragging = false;

/** Retorna a posição atual normalizada */
export function getWebcamPosition() {
    return { posX, posY };
}

/**
 * Inicializa drag-and-drop no canvas da webcam.
 * @param {HTMLCanvasElement} canvas - O canvas da webcam
 * @param {HTMLElement} container   - O container do preview
 */
export function initDrag(canvas, container) {
    // Habilita interação
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'grab';
    canvas.style.position = 'absolute';
    canvas.style.userSelect = 'none';

    applyPosition(canvas, container);

    // Mouse
    canvas.addEventListener('mousedown', onDown);
    // Touch
    canvas.addEventListener('touchstart', onDown, { passive: true });

    function onDown(e) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        canvas.style.transition = 'none';
        e.stopPropagation();
    }

    function onMove(e) {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        const cw = canvas.offsetWidth;
        const ch = canvas.offsetHeight;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Centro do canvas segue o cursor
        let x = clientX - rect.left - cw / 2;
        let y = clientY - rect.top - ch / 2;

        // Clamp dentro do container
        x = Math.max(0, Math.min(rect.width - cw, x));
        y = Math.max(0, Math.min(rect.height - ch, y));

        canvas.style.left = x + 'px';
        canvas.style.top = y + 'px';
        canvas.style.right = 'auto';
        canvas.style.bottom = 'auto';

        // Normaliza posição para o compositor de gravação
        posX = x / (rect.width - cw);
        posY = y / (rect.height - ch);
    }

    function onUp() {
        if (!isDragging) return;
        isDragging = false;
        canvas.style.cursor = 'grab';
        canvas.style.transition = '';
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
}

/**
 * Aplica a posição normalizada ao estilo do canvas.
 */
function applyPosition(canvas, container) {
    const cw = canvas.offsetWidth || 200;
    const ch = canvas.offsetHeight || 200;
    const rw = container.clientWidth;
    const rh = container.clientHeight;

    const margin = 20;
    const x = posX * (rw - cw - margin * 2) + margin;
    const y = posY * (rh - ch - margin * 2) + margin;

    canvas.style.left = x + 'px';
    canvas.style.top = y + 'px';
    canvas.style.right = 'auto';
    canvas.style.bottom = 'auto';
}
