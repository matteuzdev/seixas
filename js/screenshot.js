/**
 * SEIXAS — Screenshot Module
 * Captura um frame do compositor: tela + webcam + anotações → PNG
 */

/**
 * Tira um screenshot do estado atual.
 * @param {HTMLVideoElement} screenVideo - Video da tela compartilhada
 * @param {HTMLCanvasElement} webcamCanvas - Canvas da webcam mascarada
 * @param {HTMLCanvasElement|null} annotationCanvas - Canvas de anotações (opcional)
 * @param {object} opts - { cropRegion, getWebcamPos, webcamEnabled }
 * @returns {Promise<void>} Baixa o PNG automaticamente
 */
export async function takeScreenshot(screenVideo, webcamCanvas, annotationCanvas, opts = {}) {
    const sw = screenVideo.videoWidth;
    const sh = screenVideo.videoHeight;

    if (!sw || !sh) {
        console.warn('Seixas: Nenhuma tela ativa para screenshot.');
        return null;
    }

    const crop = opts.cropRegion || null;
    const getWebcamPos = opts.getWebcamPos || (() => ({ posX: 1, posY: 1 }));
    const webcamEnabled = opts.webcamEnabled !== false;

    // Calcula região de crop
    const sx = crop ? Math.round(crop.x * sw) : 0;
    const sy = crop ? Math.round(crop.y * sh) : 0;
    const sw2 = crop ? Math.round(crop.w * sw) : sw;
    const sh2 = crop ? Math.round(crop.h * sh) : sh;

    // Cria canvas temporário com as dimensões finais
    const canvas = document.createElement('canvas');
    canvas.width = sw2;
    canvas.height = sh2;
    const ctx = canvas.getContext('2d');

    // 1. Desenha tela (com crop)
    ctx.drawImage(screenVideo, sx, sy, sw2, sh2, 0, 0, sw2, sh2);

    // 2. Overlay da webcam
    if (webcamEnabled && webcamCanvas && webcamCanvas.width > 0 && webcamCanvas.height > 0) {
        const wcSize = Math.round(sh2 * 0.18);
        const margin = Math.round(sh2 * 0.025);
        const { posX, posY } = getWebcamPos();
        const wx = Math.round(margin + posX * (sw2 - wcSize - margin * 2));
        const wy = Math.round(margin + posY * (sh2 - wcSize - margin * 2));
        ctx.drawImage(webcamCanvas, wx, wy, wcSize, wcSize);
    }

    // 3. Anotações por cima
    if (annotationCanvas && annotationCanvas.width > 0) {
        ctx.drawImage(annotationCanvas, 0, 0, sw2, sh2);
    }

    // 4. Download como PNG
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `seixas-${timestamp}.png`;

    canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');

    return canvas;
}
