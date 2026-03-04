/**
 * SEIXAS — Recorder Module
 * Gerencia a gravação combinada de tela + webcam + áudio.
 * Usa Canvas compositing para mesclar tela e webcam overlay.
 */

let mediaRecorder = null;
let chunks = [];
let compositeCanvas = null;
let compositeCtx = null;
let compositeAnimId = null;

/**
 * Cria a gravação combinada de tela + webcam.
 * Aguarda as dimensões reais da tela antes de iniciar — sem fallback hardcoded.
 * @param {MediaStream} screenStream
 * @param {HTMLCanvasElement} webcamCanvas
 * @param {MediaStream|null} micStream
 * @param {object} opts - { webcamEnabled, webcamSize, cropRegion, getWebcamPos }
 * @returns {MediaRecorder}
 */
export function createRecording(screenStream, webcamCanvas, micStream, opts = {}) {
    const screenVideo = document.createElement('video');
    screenVideo.srcObject = screenStream;
    screenVideo.muted = true;

    compositeCanvas = document.createElement('canvas');
    compositeCtx = compositeCanvas.getContext('2d');

    const webcamSize = opts.webcamSize || 200;
    const webcamEnabled = opts.webcamEnabled !== false;
    const crop = opts.cropRegion || null;
    const getWebcamPos = opts.getWebcamPos || (() => ({ posX: 1, posY: 1 }));
    const annotationCanvas = opts.annotationCanvas || null;
    const laserCanvas = opts.laserCanvas || null;
    const lensCanvas = opts.lensCanvas || null;
    const getLensPos = opts.getLensPos || null;
    const zoomContainer = opts.zoomContainer || null;

    // Composite loop — executa apenas quando o vídeo tem dimensões reais
    function composite() {
        if (!compositeCanvas) return;

        const sw = screenVideo.videoWidth;
        const sh = screenVideo.videoHeight;

        // Aguarda dimensões reais — evita gravar canvas vazio
        if (!sw || !sh) {
            compositeAnimId = requestAnimationFrame(composite);
            return;
        }

        // === Aplica crop region (seleção de área) ===
        let sx = 0, sy = 0, sw2 = sw, sh2 = sh;
        if (crop) {
            sx = Math.round(crop.x * sw);
            sy = Math.round(crop.y * sh);
            sw2 = Math.round(crop.w * sw);
            sh2 = Math.round(crop.h * sh);
        }

        // Sincroniza canvas com a área cropada
        if (compositeCanvas.width !== sw2) compositeCanvas.width = sw2;
        if (compositeCanvas.height !== sh2) compositeCanvas.height = sh2;

        // Desenha tela (só a região selecionada)
        compositeCtx.drawImage(screenVideo, sx, sy, sw2, sh2, 0, 0, sw2, sh2);

        // Overlay da webcam — posição segue o drag do usuário
        if (webcamEnabled && webcamCanvas.width > 0 && webcamCanvas.height > 0) {
            const wcSize = Math.round(sh2 * 0.18);
            const margin = Math.round(sh2 * 0.025);
            const { posX, posY } = getWebcamPos();
            const maxX = sw2 - wcSize - margin;
            const maxY = sh2 - wcSize - margin;
            const wx = Math.round(margin + posX * (maxX - margin));
            const wy = Math.round(margin + posY * (maxY - margin));
            compositeCtx.drawImage(webcamCanvas, wx, wy, wcSize, wcSize);
        }

        // Anotações (lousa) — desenhadas por cima de tudo
        // A resolução sw2/sh2 precisa esticar o dom content que tinha tamanho do Container
        if (annotationCanvas && annotationCanvas.width > 0) {
            compositeCtx.drawImage(annotationCanvas, 0, 0, sw2, sh2);
        }

        // Laser (lousa apagável)
        if (laserCanvas && laserCanvas.width > 0) {
            compositeCtx.drawImage(laserCanvas, 0, 0, sw2, sh2);
        }

        // Lupa (Zoom magnifier css-based rendering manual)
        if (lensCanvas && lensCanvas.style.display !== 'none' && getLensPos && zoomContainer) {
            const { x, y } = getLensPos();
            const lw = lensCanvas.width;
            const lh = lensCanvas.height;
            // A posição x/y está em relação ao zoomContainer (DOM), convertendo para matriz do gravador (sw2/sh2)
            const cw = zoomContainer.clientWidth;
            const ch = zoomContainer.clientHeight;
            const rx = (x / cw) * sw2 - (lw / 2);
            const ry = (y / ch) * sh2 - (lh / 2);
            compositeCtx.drawImage(lensCanvas, rx, ry, lw, lh);
        }

        compositeAnimId = requestAnimationFrame(composite);
    }

    // Aguarda dimensões reais antes de capturar o stream
    const startComposite = () => {
        // Define dimensão inicial com valores reais
        compositeCanvas.width = screenVideo.videoWidth || 1920;
        compositeCanvas.height = screenVideo.videoHeight || 1080;
        composite();
    };

    // Inicia play e aguarda loadedmetadata para ter dimensões corretas
    const ready = new Promise((resolve) => {
        if (screenVideo.readyState >= 1 && screenVideo.videoWidth > 0) {
            resolve();
        } else {
            screenVideo.addEventListener('loadedmetadata', resolve, { once: true });
        }
    });

    screenVideo.play().catch(() => { });
    ready.then(startComposite);

    // Mix de áudio
    const audioTracks = [];
    const screenAudio = screenStream.getAudioTracks();
    if (screenAudio.length > 0) audioTracks.push(...screenAudio);
    if (micStream) {
        const micAudio = micStream.getAudioTracks();
        if (micAudio.length > 0) audioTracks.push(...micAudio);
    }

    // Stream do canvas composito
    const canvasStream = compositeCanvas.captureStream(30);
    const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks
    ]);

    const mimeType = getSupportedMimeType();
    mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000 // 6 Mbps — qualidade boa para 1080p/4K
    });

    chunks = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    return mediaRecorder;
}

/**
 * Inicia a gravação.
 */
export function startRecording() {
    if (mediaRecorder && mediaRecorder.state === 'inactive') {
        mediaRecorder.start(1000); // Grava em chunks de 1s
    }
}

/**
 * Pausa a gravação.
 */
export function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
    }
}

/**
 * Retoma a gravação pausada.
 */
export function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
    }
}


/**
 * Para a gravação e retorna uma Promise com o Blob do vídeo.
 * @returns {Promise<Blob>}
 */
export function stopRecording() {
    return new Promise((resolve) => {
        if (!mediaRecorder) {
            resolve(null);
            return;
        }

        mediaRecorder.onstop = () => {
            const mimeType = mediaRecorder.mimeType;
            const blob = new Blob(chunks, { type: mimeType });
            chunks = [];
            cleanup();
            resolve(blob);
        };

        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        } else {
            cleanup();
            resolve(null);
        }
    });
}

/**
 * Retorna o estado atual do recorder.
 */
export function getRecorderState() {
    return mediaRecorder ? mediaRecorder.state : 'inactive';
}

/**
 * Detecta o melhor mimeType suportado pelo browser.
 */
function getSupportedMimeType() {
    // Priorizando video/mp4 e h264 para evitar gravação .webm com áudio OPUS
    // que quebra frequentemente em players no Windows/Mac.
    const types = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=h264', // H264 permite forçar download como mp4 para conversões fáceis
        'video/webm;codecs=vp8',
        'video/webm',
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

/**
 * Faz download do vídeo gravado.
 * @param {Blob} blob
 */
export function downloadRecording(blob) {
    // Se o mimetype usa h264, no Chrome a gente salva como mp4 para ampla compatibilidade (mesmo sendo webm container às vezes)
    const isMp4Capable = blob.type.includes('mp4') || blob.type.includes('h264');
    const ext = isMp4Capable ? 'mp4' : 'webm';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `seixas-${timestamp}.${ext}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Limpa recursos internos.
 */
function cleanup() {
    if (compositeAnimId) {
        cancelAnimationFrame(compositeAnimId);
        compositeAnimId = null;
    }
    compositeCanvas = null;
    compositeCtx = null;
    mediaRecorder = null;
}
