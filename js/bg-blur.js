/**
 * SEIXAS — Background Blur Module
 * Usa MediaPipe SelfieSegmentation para separar pessoa do fundo
 * e aplicar blur apenas no background.
 */

let segmenter = null;
let blurRadius = 8;
let blurEnabled = false;
let segCanvas = null;
let segCtx = null;

/**
 * Inicializa o segmentador MediaPipe.
 * @returns {Promise<boolean>} true se inicializou com sucesso
 */
export async function initSegmenter() {
    try {
        // Verifica se a biblioteca MediaPipe está disponível no window
        if (typeof SelfieSegmentation === 'undefined') {
            console.warn('Seixas: MediaPipe SelfieSegmentation não disponível');
            return false;
        }

        segmenter = new SelfieSegmentation({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });

        segmenter.setOptions({ modelSelection: 1 }); // 1 = landscape model (mais preciso)

        await segmenter.initialize();
        segCanvas = document.getElementById('segCanvas');
        segCtx = segCanvas.getContext('2d');

        return true;
    } catch (err) {
        console.error('Seixas: Erro ao inicializar segmentador:', err);
        return false;
    }
}

/**
 * Ativa ou desativa o blur de fundo.
 */
export function setBlurEnabled(enabled) {
    blurEnabled = enabled;
}

/**
 * Define a intensidade do blur (2–20).
 */
export function setBlurRadius(radius) {
    blurRadius = radius;
}

/**
 * Verifica se o blur está ativo e inicializado.
 */
export function isBlurReady() {
    return blurEnabled && segmenter !== null;
}

/**
 * Renderiza um frame com background blur no canvas de destino.
 * Se o segmentador não estiver pronto, renderiza normalmente.
 * @param {CanvasRenderingContext2D} ctx - ctx do canvas de destino (webcam canvas)
 * @param {HTMLVideoElement} video - Feed da webcam
 * @param {HTMLCanvasElement} destCanvas - Canvas onde desenhar
 */
export async function renderWithBlur(ctx, video, destCanvas) {
    if (!segmenter || !blurEnabled) return false;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return false;

    // Ajusta canvas de segmentação ao tamanho do vídeo
    if (segCanvas.width !== w) segCanvas.width = w;
    if (segCanvas.height !== h) segCanvas.height = h;

    // Atualiza o segmentador com o frame atual
    await segmenter.send({ image: video });

    return true; // O resultado chega via onResults callback
}

/**
 * Registra o callback de resultados — chame isso uma vez.
 * O callback recebe o segmentation mask e redesenha o canvas.
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} destCanvas
 * @param {Function} maskClipFn - Função da mask ativa (masks.js)
 * @param {object} borderOpts
 */
export function setupSegmentationResults(video, destCanvas, getMaskFn, getBorderFn) {
    if (!segmenter) return;

    segmenter.onResults((results) => {
        if (!blurEnabled) return;

        const w = destCanvas.width;
        const h = destCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(cx, cy) - 4;
        const ctx = destCanvas.getContext('2d');
        const maskFn = getMaskFn();
        const borderOpts = getBorderFn();

        // 1. Draw border
        if (borderOpts.enabled) {
            ctx.save();
            maskFn(ctx, cx, cy, r + borderOpts.width);
            ctx.fillStyle = borderOpts.color;
            ctx.fill();
            ctx.restore();
        }

        // 2. Apply mask clip
        ctx.save();
        maskFn(ctx, cx, cy, r);
        ctx.clip();

        // 3. Escala do vídeo para o canvas
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const scale = Math.max((r * 2) / vw, (r * 2) / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = cx - dw / 2;
        const dy = cy - dh / 2;

        // 4. Fundo borrado: desenha vídeo, aplica blur CSS via offscreen
        ctx.save();
        ctx.filter = `blur(${blurRadius}px)`;
        ctx.drawImage(video, dx, dy, dw, dh);
        ctx.filter = 'none';
        ctx.restore();

        // 5. Máscara de segmentação: apaga o fundo onde há pessoa
        // A segmantation mask é branca onde há pessoa
        const mask = results.segmentationMask;
        if (mask) {
            // Usa globalCompositeOperation para pintar apenas a pessoa sobre o fundo borrado
            ctx.save();
            // Desenha o vídeo original sobre a máscara da pessoa
            // Usa 'destination-over' para colocar embaixo não, então vamos usar diferente abordagem:
            // Cria um canvas temporário com a pessoa recortada
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = dw;
            tempCanvas.height = dh;
            const tCtx = tempCanvas.getContext('2d');

            // Desenha vídeo original no temp
            tCtx.drawImage(video, 0, 0, vw, vh, 0, 0, dw, dh);

            // Aplica máscara: onde há pessoa (branco no mask) mantém pixels
            tCtx.globalCompositeOperation = 'destination-in';
            tCtx.drawImage(mask, 0, 0, vw, vh, 0, 0, dw, dh);

            // Desenha resultado sobre o fundo borrado
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(tempCanvas, dx, dy);
            ctx.restore();
        } else {
            // Sem mask: só vídeo normal sobre blur
            ctx.drawImage(video, dx, dy, dw, dh);
        }

        ctx.restore();
    });
}

/**
 * Destrói o segmentador e libera recursos.
 */
export function destroySegmenter() {
    if (segmenter) {
        segmenter.close();
        segmenter = null;
    }
}
