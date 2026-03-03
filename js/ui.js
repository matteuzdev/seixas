/**
 * SEIXAS — UI Module
 * Gerencia o estado visual da interface: timer, status, botões.
 */

let timerInterval = null;
let totalSeconds = 0;

const $ = (sel) => document.querySelector(sel);

/**
 * Atualiza o timer visual.
 */
function updateTimerDisplay() {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    const timer = $('#timer');
    if (timer) timer.textContent = `${m}:${s}`;
}

/**
 * Inicia o timer.
 */
export function startTimer() {
    totalSeconds = 0;
    updateTimerDisplay();
    const timer = $('#timer');
    if (timer) timer.classList.add('recording');

    timerInterval = setInterval(() => {
        totalSeconds++;
        updateTimerDisplay();
    }, 1000);
}

/**
 * Pausa o timer.
 */
export function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

/**
 * Retoma o timer.
 */
export function resumeTimer() {
    timerInterval = setInterval(() => {
        totalSeconds++;
        updateTimerDisplay();
    }, 1000);
}

/**
 * Para e reseta o timer.
 */
export function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    totalSeconds = 0;
    updateTimerDisplay();
    const timer = $('#timer');
    if (timer) timer.classList.remove('recording');
}

/**
 * Atualiza o texto de status.
 */
export function setStatus(text, isRecording = false) {
    const el = $('#statusText');
    if (el) {
        el.textContent = text;
        el.classList.toggle('recording', isRecording);
    }
}

/**
 * Atualiza o info de qualidade.
 */
export function setQuality(text) {
    const el = $('#statusQuality');
    if (el) el.textContent = text;
}

/**
 * Atualiza estado dos botões para o modo dado.
 * @param {'idle'|'ready'|'recording'|'paused'} mode
 */
export function setButtonState(mode) {
    const btnRecord = $('#btnRecord');
    const btnPause = $('#btnPause');
    const btnStop = $('#btnStop');

    switch (mode) {
        case 'idle':
            btnRecord.disabled = true;
            btnPause.disabled = true;
            btnStop.disabled = true;
            btnRecord.classList.remove('recording');
            btnRecord.querySelector('.btn__label').textContent = 'Gravar';
            break;

        case 'ready':
            btnRecord.disabled = false;
            btnPause.disabled = true;
            btnStop.disabled = true;
            btnRecord.classList.remove('recording');
            btnRecord.querySelector('.btn__label').textContent = 'Gravar';
            break;

        case 'recording':
            btnRecord.disabled = true;
            btnPause.disabled = false;
            btnStop.disabled = false;
            btnRecord.classList.add('recording');
            btnRecord.querySelector('.btn__label').textContent = 'Gravando...';
            break;

        case 'paused':
            btnRecord.disabled = true;
            btnPause.disabled = false;
            btnStop.disabled = false;
            btnPause.querySelector('.btn__label').textContent = 'Retomar';
            break;
    }

    // Reset pause label when not paused
    if (mode !== 'paused' && btnPause) {
        btnPause.querySelector('.btn__label').textContent = 'Pausar';
    }
}

/**
 * Popula um dropdown com opções de devices.
 * @param {string} selectId - ID do select
 * @param {MediaDeviceInfo[]} devices - Lista de dispositivos
 */
export function populateDeviceDropdown(selectId, devices) {
    const select = $(`#${selectId}`);
    if (!select) return;

    select.innerHTML = '';
    devices.forEach((dev, i) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Dispositivo ${i + 1}`;
        select.appendChild(opt);
    });
}

/**
 * Mostra/esconde o placeholder.
 */
export function togglePlaceholder(show) {
    const el = $('#previewPlaceholder');
    if (el) el.classList.toggle('hidden', !show);
}

/**
 * Mostra/esconde a tela de preview.
 */
export function toggleScreenPreview(show) {
    const el = $('#screenPreview');
    if (el) el.classList.toggle('active', show);
}
