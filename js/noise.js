/**
 * SEIXAS — Noise Reduction Module
 * Aplica filtros de áudio via Web Audio API:
 * - noiseSuppression nativo do browser (Chromium) — o melhor sem biblioteca
 * - High-pass filter: corta frequências abaixo de 80Hz (ruído de ambiente)
 * - Compressor dinâmico: estabiliza volume
 *
 * Insight: Chrome/Edge já têm noise suppression por hardware via getUserMedia,
 * mas o AudioContext com filtros melhora ainda mais a qualidade.
 */

/**
 * Cria constraints de microfone com todas as otimizações nativas do browser.
 * @param {string|undefined} deviceId
 * @param {boolean} noiseEnabled
 * @returns {MediaStreamConstraints}
 */
export function buildMicConstraints(deviceId, noiseEnabled) {
    const audioConstraints = {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        // Ajustes nativos do Chromium — processados em hardware
        noiseSuppression: noiseEnabled,   // IA de supressão de ruído nativa
        echoCancellation: noiseEnabled,   // Remove eco de alto-falantes
        autoGainControl: noiseEnabled,    // Normaliza volume automaticamente
        channelCount: 1,                  // Mono — reduz artefatos
        sampleRate: 48000,                // Qualidade máxima
    };

    return { audio: audioConstraints };
}

/**
 * Processa um stream de microfone com filtros adicionais via Web Audio API.
 * Retorna um novo MediaStream com áudio processado.
 *
 * @param {MediaStream} micStream - Stream original do microfone
 * @param {boolean} noiseEnabled - Se filtros estão ativos
 * @returns {{ processedStream: MediaStream, audioContext: AudioContext }}
 */
export function processAudioStream(micStream, noiseEnabled) {
    const audioContext = new AudioContext({ sampleRate: 48000 });
    const source = audioContext.createMediaStreamSource(micStream);

    // --- High-pass filter: remove rumble e ruído de baixa frequência (<80 Hz)
    const highPass = audioContext.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 80;
    highPass.Q.value = 0.707;

    // --- Low-pass filter: suaviza chiados de alta frequência (>12 kHz)
    const lowPass = audioContext.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 12000;
    lowPass.Q.value = 0.707;

    // --- Compressor dinâmico: estabiliza fala (evita cortes ou picos)
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;  // dB — comprime acima deste nível
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // --- Destination: capturável via MediaStream
    const destination = audioContext.createMediaStreamDestination();

    if (noiseEnabled) {
        // Chain: source → highPass → lowPass → compressor → output
        source.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(compressor);
        compressor.connect(destination);
    } else {
        // Bypassa todos os filtros
        source.connect(destination);
    }

    return {
        processedStream: destination.stream,
        audioContext
    };
}

/**
 * Fecha o AudioContext e libera recursos.
 */
export function closeAudioContext(audioContext) {
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
}
