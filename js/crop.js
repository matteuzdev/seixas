/**
 * SEIXAS — Area Crop Module (Full-Screen Selection)
 * Abre um modal fullscreen com o stream da tela para o usuário
 * arrastar e selecionar a região a gravar — estilo oCam.
 */

let cropRegion = null;

export function getCropRegion() { return cropRegion; }
export function resetCrop() { cropRegion = null; }

/**
 * Abre seleção fullscreen sobre o stream de tela.
 * @param {MediaStream} screenStream - O stream de tela ativo
 * @returns {Promise<{x,y,w,h}|null>} Região normalizada ou null se cancelado
 */
export function startAreaSelection(screenStream) {
    return new Promise((resolve) => {
        // Cria overlay fullscreen
        const overlay = document.createElement('div');
        overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.15);
      cursor: crosshair;
      user-select: none;
    `;

        // Vídeo do stream da tela como fundo do overlay
        const bgVideo = document.createElement('video');
        bgVideo.srcObject = screenStream;
        bgVideo.autoplay = true;
        bgVideo.muted = true;
        bgVideo.style.cssText = `
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: contain;
      opacity: 0.55;
      pointer-events: none;
    `;
        overlay.appendChild(bgVideo);

        // Canvas de seleção
        const selCanvas = document.createElement('canvas');
        selCanvas.style.cssText = `
      position: absolute; inset: 0;
      width: 100%; height: 100%;
    `;
        overlay.appendChild(selCanvas);

        // Hint
        const hint = document.createElement('div');
        hint.textContent = 'Arraste para selecionar a área · ESC para cancelar';
        hint.style.cssText = `
      position: absolute; top: 20px; left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.85);
      color: #00d4aa; font: 600 13px Inter,sans-serif;
      padding: 8px 20px; border-radius: 100px;
      border: 1px solid rgba(0,212,170,0.3);
      backdrop-filter: blur(8px);
      pointer-events: none; z-index: 10001;
    `;
        overlay.appendChild(hint);

        document.body.appendChild(overlay);
        bgVideo.play().catch(() => { });

        // Resize canvas
        const resize = () => {
            selCanvas.width = window.innerWidth;
            selCanvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const ctx = selCanvas.getContext('2d');
        let start = null;

        function draw(current) {
            ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);

            // Escurece tudo
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, selCanvas.width, selCanvas.height);

            if (!start || !current) return;

            const x = Math.min(start.x, current.x);
            const y = Math.min(start.y, current.y);
            const w = Math.abs(current.x - start.x);
            const h = Math.abs(current.y - start.y);

            // "Apaga" a seleção
            ctx.clearRect(x, y, w, h);

            // Borda
            ctx.strokeStyle = '#00d4aa';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);

            // Handles nos cantos
            ctx.fillStyle = '#00d4aa';
            [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => {
                ctx.beginPath();
                ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                ctx.fill();
            });

            // Label de dimensões
            const vw = bgVideo.videoWidth || selCanvas.width;
            const vh = bgVideo.videoHeight || selCanvas.height;
            const px = Math.round(w * (vw / selCanvas.width));
            const py = Math.round(h * (vh / selCanvas.height));
            ctx.font = '600 12px Inter,sans-serif';
            ctx.fillStyle = '#00d4aa';
            ctx.fillText(`${px}×${py}px`, x + 6, y > 22 ? y - 6 : y + 16);
        }

        function getPos(e) {
            return { x: e.clientX, y: e.clientY };
        }

        function onDown(e) {
            start = getPos(e);
            draw(start);
        }

        function onMove(e) {
            if (!start) return;
            draw(getPos(e));
        }

        function onUp(e) {
            if (!start) return;
            const end = getPos(e);
            cleanup();

            const x = Math.min(start.x, end.x);
            const y = Math.min(start.y, end.y);
            const w = Math.abs(end.x - start.x);
            const h = Math.abs(end.y - start.y);

            if (w < 30 || h < 30) { resolve(null); return; }

            // Normaliza em relação à janela
            cropRegion = {
                x: x / selCanvas.width,
                y: y / selCanvas.height,
                w: w / selCanvas.width,
                h: h / selCanvas.height
            };
            resolve(cropRegion);
        }

        function cleanup() {
            window.removeEventListener('resize', resize);
            overlay.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.removeEventListener('keydown', onKey);
            bgVideo.srcObject = null;
            overlay.remove();
        }

        function onKey(e) {
            if (e.key === 'Escape') {
                cleanup();
                resolve(null);
            }
        }

        overlay.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        document.addEventListener('keydown', onKey);
    });
}
