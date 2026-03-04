/**
 * SEIXAS — App Orchestrator v1.1
 * Integrações: Background Blur (MediaPipe), Noise Reduction (Web Audio API),
 * Masks Elite (modal de pagamento), webcam size fix.
 */

import { requestScreen, stopScreen, getScreenStream } from './screen.js';
import {
    listCameras, listMicrophones,
    startWebcam, stopWebcam,
    startRenderLoop, setMask, setBorderOptions,
    getCurrentMask, getBorderOptions
} from './webcam.js';
import {
    createRecording, startRecording,
    pauseRecording, resumeRecording,
    stopRecording, downloadRecording,
    getRecorderState
} from './recorder.js';
import {
    startTimer, pauseTimer, resumeTimer, stopTimer,
    setStatus, setQuality, setButtonState,
    populateDeviceDropdown, togglePlaceholder, toggleScreenPreview
} from './ui.js';
import {
    initSegmenter, setBlurEnabled, setBlurRadius,
    setupSegmentationResults, isBlurReady, renderWithBlur
} from './bg-blur.js';
import { buildMicConstraints, processAudioStream, closeAudioContext } from './noise.js';
import { initDrag, getWebcamPosition } from './drag.js';
import { startAreaSelection, getCropRegion, resetCrop } from './crop.js';
import {
    initAnnotations, setAnnotationsEnabled, setTool, setColor, setSize,
    clearAnnotations, bindDrawingEvents, getDrawCanvas, getLaserCanvas
} from './annotate.js';
import { initMagnifier, setMagnifierEnabled, getLensCanvas, getLensPos, getZoomContainer } from './zoom.js';
import { takeScreenshot } from './screenshot.js';
import { MASKS } from './masks.js';

// ──────────────────────────────────────────────
// DOM
// ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const btnSelectScreen = $('btnSelectScreen');
const btnRecord = $('btnRecord');
const btnPause = $('btnPause');
const btnStop = $('btnStop');
const screenPreview = $('screenPreview');
const webcamCanvas = $('webcamCanvas');
const webcamVideo = $('webcamVideo');
const cameraSelect = $('cameraSource');
const micSelect = $('micSource');
const maskGrid = $('maskGrid');
const borderToggle = $('borderToggle');
const borderColor = $('borderColor');
const borderWidth = $('borderWidth');
const bgBlurToggle = $('bgBlurToggle');
const blurIntensity = $('blurIntensity');
const blurIntensityRow = $('blurIntensityRow');
const bgBlurStatus = $('bgBlurStatus');
const noiseToggle = $('noiseToggle');
const webcamToggle = $('webcamToggle');
const webcamSizeSlider = $('webcamSize');
const eliteModal = $('eliteModal');
const modalBackdrop = $('modalBackdrop');
const modalClose = $('modalClose');
const modalMaskName = $('modalMaskName');
const modalPrice = $('modalPrice');
const previewContainer = $('previewContainer');
const btnCropArea = $('btnCropArea');
const annotateBar = $('annotateBar');
const btnAnnotate = $('btnAnnotate');
const btnZoomToggle = $('btnZoomToggle');
const annotateClear = $('annotateClear');
const annotateSize = $('annotateSize');
const btnScreenshot = $('btnScreenshot');

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let micStream = null;
let processedMicStream = null;
let audioContext = null;
let webcamEnabled = true;
let webcamSize = 200;
let noiseEnabled = true;
let blurReady = false;
let blurEnabled = false;
let blurRadius = 10;

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────
async function init() {
    setButtonState('idle');
    setStatus('Pronto');

    // Pede permissão uma vez para popular os dropdowns
    try {
        const temp = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        temp.getTracks().forEach(t => t.stop());
    } catch (_) { }

    const [cameras, mics] = await Promise.all([listCameras(), listMicrophones()]);
    populateDeviceDropdown('cameraSource', cameras);
    populateDeviceDropdown('micSource', mics);

    if (cameras.length > 0) await initWebcam(cameras[0].deviceId);

    // Inicializa MediaPipe em background (não bloqueia UI)
    initSegmenter().then((ok) => {
        blurReady = ok;
        if (!ok) {
            bgBlurStatus.textContent = 'Não disponível neste browser';
            bgBlurToggle.disabled = true;
        } else {
            setupSegmentationResults(
                webcamVideo,
                webcamCanvas,
                () => {
                    return MASKS[getCurrentMask()] || MASKS.circle;
                },
                () => getBorderOptions()
            );
        }
    });

    // Inicializa anotações e lupa
    initAnnotations(previewContainer);
    bindDrawingEvents();
    initMagnifier(previewContainer, screenPreview);

    setQuality(`${window.screen.width}×${window.screen.height}`);
    bindEvents();
}

// ──────────────────────────────────────────────
// Webcam
// ──────────────────────────────────────────────
async function initWebcam(deviceId) {
    stopWebcam();
    const stream = await startWebcam(deviceId);
    if (!stream) return;

    webcamVideo.srcObject = stream;
    try { await webcamVideo.play(); } catch (_) { }

    // Atualiza canvas com tamanho atual do slider
    webcamCanvas.width = webcamSize;
    webcamCanvas.height = webcamSize;
    webcamCanvas.style.width = webcamSize + 'px';
    webcamCanvas.style.height = webcamSize + 'px';

    startRenderLoop(webcamVideo, webcamCanvas, () => ({
        enabled: blurEnabled,
        radius: blurRadius
    }));

    // Inicializa drag após webcam estar pronta
    initDrag(webcamCanvas, previewContainer);
}

// ──────────────────────────────────────────────
// Microfone (com noise reduction)
// ──────────────────────────────────────────────
async function initMic(deviceId) {
    // Limpa anterior
    if (audioContext) closeAudioContext(audioContext);
    if (micStream) micStream.getTracks().forEach(t => t.stop());

    try {
        const constraints = buildMicConstraints(deviceId, noiseEnabled);
        micStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Aplica filtros de áudio adicionais
        const result = processAudioStream(micStream, noiseEnabled);
        processedMicStream = result.processedStream;
        audioContext = result.audioContext;
    } catch (err) {
        console.error('Seixas: Erro ao acessar microfone:', err);
        micStream = null;
        processedMicStream = null;
    }
}

// ──────────────────────────────────────────────
// Eventos
// ──────────────────────────────────────────────
function bindEvents() {

    // ── Selecionar tela
    btnSelectScreen.addEventListener('click', async () => {
        const stream = await requestScreen();
        if (!stream) return;

        screenPreview.srcObject = stream;
        togglePlaceholder(false);
        toggleScreenPreview(true);
        setButtonState('ready');
        setStatus('Tela selecionada — pronto para gravar');
        btnSelectScreen.classList.add('has-source');

        await initMic(micSelect.value);

        stream.getVideoTracks()[0].addEventListener('ended', handleScreenEnd);
    });

    // ── Gravar
    btnRecord.addEventListener('click', async () => {
        const screenStream = getScreenStream();
        if (!screenStream) return;

        if (!processedMicStream) await initMic(micSelect.value);

        // Usa o stream de áudio processado (com noise reduction)
        const recorder = createRecording(screenStream, webcamCanvas, processedMicStream, {
            webcamEnabled,
            webcamSize,
            cropRegion: getCropRegion(),
            getWebcamPos: getWebcamPosition,
            annotationCanvas: getDrawCanvas(),
            laserCanvas: getLaserCanvas(),
            lensCanvas: getLensCanvas(),
            getLensPos: getLensPos,
            zoomContainer: getZoomContainer()
        });
        if (!recorder) return;

        startRecording();
        startTimer();
        setButtonState('recording');
        setStatus('Gravando...', true);
    });

    // ── Pausar / Retomar
    btnPause.addEventListener('click', () => {
        const state = getRecorderState();
        if (state === 'recording') {
            pauseRecording(); pauseTimer();
            setButtonState('paused'); setStatus('Pausado');
        } else if (state === 'paused') {
            resumeRecording(); resumeTimer();
            setButtonState('recording'); setStatus('Gravando...', true);
        }
    });

    // ── Parar
    btnStop.addEventListener('click', async () => {
        setStatus('Processando...');
        const blob = await stopRecording();
        stopTimer(); setButtonState('ready');
        if (blob) {
            downloadRecording(blob);
            setStatus(`Gravação salva (${formatBytes(blob.size)})`);
        } else {
            setStatus('Pronto');
        }
    });

    // ── Troca de câmera
    cameraSelect.addEventListener('change', e => initWebcam(e.target.value));

    // ── Troca de microfone
    micSelect.addEventListener('change', e => initMic(e.target.value));

    // ── Screenshot
    if (btnScreenshot) {
        btnScreenshot.addEventListener('click', async () => {
            const stream = getScreenStream();
            if (!stream) { setStatus('Selecione uma tela antes de tirar screenshot'); return; }

            // Usa o screenPreview como fonte (já está tocando)
            await takeScreenshot(screenPreview, webcamCanvas, getDrawCanvas(), {
                cropRegion: getCropRegion(),
                getWebcamPos: getWebcamPosition,
                webcamEnabled
            });

            // Flash visual de feedback
            btnScreenshot.textContent = '✓';
            btnScreenshot.style.color = 'var(--primary)';
            setTimeout(() => {
                btnScreenshot.innerHTML = '&#128247;';
                btnScreenshot.style.color = '';
            }, 800);
        });
    }

    // ── Lousa (Annotation)
    if (btnAnnotate) {
        btnAnnotate.addEventListener('click', () => {
            const active = !btnAnnotate.classList.contains('active');
            btnAnnotate.classList.toggle('active', active);
            annotateBar.style.display = active ? 'flex' : 'none';
            setAnnotationsEnabled(active);
        });
    }

    // Ferramentas
    document.querySelectorAll('.annotate-tool').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.annotate-tool').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTool(btn.dataset.tool);
        });
    });

    // Cores
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            setColor(dot.dataset.color);
        });
    });

    // Espessura
    if (annotateSize) annotateSize.addEventListener('input', () => setSize(parseInt(annotateSize.value)));

    // Limpar
    if (annotateClear) annotateClear.addEventListener('click', clearAnnotations);

    // ── Lupa Toggle
    if (btnZoomToggle) {
        btnZoomToggle.addEventListener('click', () => {
            const active = !btnZoomToggle.classList.contains('active');
            btnZoomToggle.classList.toggle('active', active);
            setMagnifierEnabled(active);
        });
    }

    // ── Seleção de área
    if (btnCropArea) {
        btnCropArea.addEventListener('click', async () => {
            const screenStream = getScreenStream();
            if (!screenStream) {
                setStatus('Selecione uma tela antes de escolher a área');
                return;
            }
            setStatus('Arraste para selecionar a área...');
            const region = await startAreaSelection(screenStream);
            if (region) {
                setStatus(`Área selecionada: ${Math.round(region.w * 100)}% × ${Math.round(region.h * 100)}%`);
                btnCropArea.classList.add('has-crop');
            } else {
                resetCrop();
                setStatus('Área resetada — gravando tela inteira');
                btnCropArea.classList.remove('has-crop');
            }
        });
    }

    // ── Máscaras (free + elite)
    maskGrid.addEventListener('click', e => {
        const btn = e.target.closest('.mask-option');
        if (!btn) return;

        if (btn.dataset.tier === 'elite') {
            // Abre modal de pagamento
            openEliteModal(btn.dataset.label, btn.dataset.price);
            return;
        }

        // Aplica mask free
        maskGrid.querySelectorAll('.mask-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setMask(btn.dataset.mask);
    });

    // ── Borda
    borderToggle.addEventListener('change', () => setBorderOptions({ enabled: borderToggle.checked }));
    borderColor.addEventListener('input', () => setBorderOptions({ color: borderColor.value }));
    borderWidth.addEventListener('input', () => setBorderOptions({ width: parseInt(borderWidth.value) }));

    // ── Blur de fundo
    bgBlurToggle.addEventListener('change', async () => {
        const enabled = bgBlurToggle.checked;
        blurEnabled = enabled; // Atualizando state local do app
        setBlurEnabled(enabled); // Repassando para o bg-blur.js
        blurIntensityRow.style.display = enabled ? 'flex' : 'none';
        if (enabled) {
            bgBlurStatus.textContent = 'Carregando modelo...';
            // Inicia loop de segmentação
            startBlurLoop();
            bgBlurStatus.textContent = 'Ativo';
        } else {
            bgBlurStatus.textContent = '';
        }
    });

    blurIntensity.addEventListener('input', () => {
        blurRadius = parseInt(blurIntensity.value) || 10; // Atualizando state local
        setBlurRadius(parseInt(blurIntensity.value) || 10);
    });

    // ── Noise reduction
    noiseToggle.addEventListener('change', async () => {
        noiseEnabled = noiseToggle.checked;
        // Reinicializa mic com nova configuração
        if (micStream) await initMic(micSelect.value);
    });

    // ── Webcam toggle
    webcamToggle.addEventListener('change', () => {
        webcamEnabled = webcamToggle.checked;
        webcamCanvas.style.display = webcamEnabled ? 'block' : 'none';
        if (webcamEnabled && !webcamVideo.srcObject) initWebcam(cameraSelect.value);
    });

    // ── Tamanho da webcam
    webcamSizeSlider.addEventListener('input', () => {
        webcamSize = parseInt(webcamSizeSlider.value);
        webcamCanvas.width = webcamSize;
        webcamCanvas.height = webcamSize;
        webcamCanvas.style.width = webcamSize + 'px';
        webcamCanvas.style.height = webcamSize + 'px';
    });

    // ── Modal elite
    modalBackdrop.addEventListener('click', closeEliteModal);
    modalClose.addEventListener('click', closeEliteModal);
    $('modalCta').addEventListener('click', () => {
        // Placeholder para integração com checkout
        alert('Em breve! Checkout será integrado em breve. 🚀');
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeEliteModal();
    });
}

// ──────────────────────────────────────────────
// Background Blur Loop
// ──────────────────────────────────────────────
function startBlurLoop() {
    async function loop() {
        if (!bgBlurToggle.checked) return;
        if (webcamVideo.readyState >= 2) {
            await renderWithBlur(null, webcamVideo, webcamCanvas);
        }
        requestAnimationFrame(loop);
    }
    loop();
}

// ──────────────────────────────────────────────
// Modal Elite
// ──────────────────────────────────────────────
function openEliteModal(name, price) {
    modalMaskName.textContent = name;
    modalPrice.textContent = price;
    eliteModal.classList.add('open');
    eliteModal.setAttribute('aria-hidden', 'false');
}

function closeEliteModal() {
    eliteModal.classList.remove('open');
    eliteModal.setAttribute('aria-hidden', 'true');
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function handleScreenEnd() {
    stopScreen();
    screenPreview.srcObject = null;
    togglePlaceholder(true);
    toggleScreenPreview(false);
    setButtonState('idle');
    setStatus('Compartilhamento encerrado');
    btnSelectScreen.classList.remove('has-source');
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────
init();
