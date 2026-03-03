/**
 * SEIXAS — Screen Capture Module
 * Gerencia a captura de tela via getDisplayMedia.
 */

let screenStream = null;

/**
 * Solicita ao usuário que selecione uma tela/janela/aba para captura.
 * @returns {Promise<MediaStream|null>}
 */
export async function requestScreen() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor'
            },
            audio: true // Captura áudio do sistema se disponível
        });
        return screenStream;
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            console.log('Seixas: Usuário cancelou a seleção de tela');
        } else {
            console.error('Seixas: Erro ao capturar tela:', err);
        }
        return null;
    }
}

/**
 * Retorna o stream de tela ativo.
 */
export function getScreenStream() {
    return screenStream;
}

/**
 * Para a captura de tela e libera os recursos.
 */
export function stopScreen() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
}

/**
 * Verifica se o browser suporta screen capture.
 */
export function isScreenCaptureSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
}
