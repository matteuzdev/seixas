/**
 * SEIXAS — Webcam Module
 * Gerencia a captura da webcam e renderização com masks via Canvas.
 */

import { drawMaskedFrame } from './masks.js';

let webcamStream = null;
let animFrameId = null;
let currentMask = 'circle';
let borderOpts = { enabled: true, color: '#00d4aa', width: 3 };

/**
 * Lista as câmeras disponíveis.
 * @returns {Promise<MediaDeviceInfo[]>}
 */
export async function listCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
}

/**
 * Lista os microfones disponíveis.
 * @returns {Promise<MediaDeviceInfo[]>}
 */
export async function listMicrophones() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
}

/**
 * Inicia a webcam com o deviceId especificado.
 * @param {string} deviceId - ID do dispositivo de vídeo
 * @returns {Promise<MediaStream|null>}
 */
export async function startWebcam(deviceId) {
    try {
        const constraints = {
            video: deviceId
                ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                : { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false // Áudio é capturado separadamente
        };
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        return webcamStream;
    } catch (err) {
        console.error('Seixas: Erro ao acessar webcam:', err);
        return null;
    }
}

/**
 * Para a webcam e libera os recursos.
 */
export function stopWebcam() {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    if (webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
    }
}

/**
 * Retorna o stream da webcam.
 */
export function getWebcamStream() {
    return webcamStream;
}

/**
 * Inicia o loop de renderização da webcam no Canvas com a mask ativa.
 * @param {HTMLVideoElement} videoEl - Elemento video com feed da webcam
 * @param {HTMLCanvasElement} canvasEl - Canvas para renderizar a mask
 */
export function startRenderLoop(videoEl, canvasEl, getBlurOpts) {
    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

    const doStart = () => {
        if (videoEl.videoWidth > 0) {
            const size = Math.min(videoEl.videoWidth, videoEl.videoHeight);
            canvasEl.width = size;
            canvasEl.height = size;
        }

        function render() {
            if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
                const blurOpts = getBlurOpts ? getBlurOpts() : { enabled: false, radius: 8 };

                if (blurOpts.enabled) {
                    drawBlurredBackground(ctx, videoEl, canvasEl, blurOpts.radius);
                } else {
                    drawMaskedFrame(ctx, videoEl, canvasEl, currentMask, borderOpts);
                }
            }
            animFrameId = requestAnimationFrame(render);
        }
        render();
    };

    if (videoEl.readyState >= 2) {
        doStart();
    } else {
        videoEl.addEventListener('loadedmetadata', doStart, { once: true });
        videoEl.play().catch(() => { });
    }
}

/**
 * Blur de fundo: desenha o vídeo borrado, depois redesenha a pessoa nítida por cima.
 * Usa ctx.filter nativo — 100% funcional no Chrome sem dependências externas.
 */
function drawBlurredBackground(ctx, video, canvas, blurRadius) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - (borderOpts.enabled ? borderOpts.width + 2 : 4);

    // Calcula escala do vídeo para o canvas
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max((r * 2) / vw, (r * 2) / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = cx - dw / 2;
    const dy = cy - dh / 2;

    ctx.clearRect(0, 0, w, h);

    // 1. Borda
    if (borderOpts.enabled) {
        const maskFn = getMaskFunction(currentMask);
        ctx.save();
        maskFn(ctx, cx, cy, r + borderOpts.width);
        ctx.fillStyle = borderOpts.color;
        ctx.fill();
        ctx.restore();
    }

    // 2. Aplica clip da mask
    const maskFn = getMaskFunction(currentMask);
    ctx.save();
    maskFn(ctx, cx, cy, r);
    ctx.clip();

    // 3. Fundo borrado (vídeo completo com blur forte)
    ctx.filter = `blur(${blurRadius}px) saturate(0.7) brightness(0.6)`;
    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.filter = 'none';

    // 4. Pessoa nítida por cima — usa uma região central (aprox. 60% do frame)
    // Técnica: desenha vídeo nítido com globalCompositeOperation 'source-atop'
    // limitado a uma elipse central (onde a pessoa tende a estar)
    ctx.save();
    ctx.globalAlpha = 1;
    // Máscara suave para a pessoa (elipse central, 65% width, 85% height)
    const ew = r * 0.65;
    const eh = r * 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, cy * 0.9, ew, eh, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.restore();

    ctx.restore();
}

/** Retorna a função de path da mask pelo nome (para uso interno) */
function getMaskFunction(maskName) {
    // Importado indiretamente via drawMaskedFrame — usa mesmo círculo como fallback
    return (ctx, cx, cy, r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
    };
}


/**
 * Define a máscara ativa.
 */
export function setMask(maskName) {
    currentMask = maskName;
}

/**
 * Atualiza as opções de borda.
 */
export function setBorderOptions(opts) {
    Object.assign(borderOpts, opts);
}

/**
 * Retorna a máscara atual.
 */
export function getCurrentMask() {
    return currentMask;
}

/**
 * Retorna as opções de borda atuais.
 */
export function getBorderOptions() {
    return { ...borderOpts };
}
