/**
 * SEIXAS — Masks Module
 * Define clip-paths para cada máscara da webcam.
 * Renderiza a webcam no Canvas com a máscara ativa.
 */

export const MASKS = {
    circle: (ctx, cx, cy, r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
    },

    squircle: (ctx, cx, cy, r) => {
        const n = 4; // superellipse power
        const steps = 200;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI * 2;
            const cosT = Math.cos(t);
            const sinT = Math.sin(t);
            const x = cx + r * Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n);
            const y = cy + r * Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    },

    hexagon: (ctx, cx, cy, r) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    },

    blob: (ctx, cx, cy, r) => {
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.9, cy - r * 0.1);
        ctx.bezierCurveTo(cx + r * 0.95, cy + r * 0.6, cx + r * 0.4, cy + r * 0.95, cx - r * 0.1, cy + r * 0.9);
        ctx.bezierCurveTo(cx - r * 0.65, cy + r * 0.85, cx - r * 0.95, cy + r * 0.35, cx - r * 0.85, cy - r * 0.15);
        ctx.bezierCurveTo(cx - r * 0.75, cy - r * 0.65, cx - r * 0.3, cy - r * 0.95, cx + r * 0.2, cy - r * 0.9);
        ctx.bezierCurveTo(cx + r * 0.65, cy - r * 0.85, cx + r * 0.85, cy - r * 0.55, cx + r * 0.9, cy - r * 0.1);
        ctx.closePath();
    },

    diamond: (ctx, cx, cy, r) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
    },

    none: (ctx, cx, cy, r) => {
        const pad = 4;
        const rr = 8;
        ctx.beginPath();
        ctx.roundRect(cx - r + pad, cy - r + pad, (r - pad) * 2, (r - pad) * 2, rr);
        ctx.closePath();
    }
};

/**
 * Desenha o frame da webcam no canvas com a máscara aplicada.
 */
export function drawMaskedFrame(ctx, video, canvas, maskName, borderOpts) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - (borderOpts.enabled ? borderOpts.width + 2 : 4);
    const maskFn = MASKS[maskName] || MASKS.circle;

    ctx.clearRect(0, 0, w, h);

    // Draw border first (behind the mask)
    if (borderOpts.enabled) {
        ctx.save();
        maskFn(ctx, cx, cy, r + borderOpts.width);
        ctx.fillStyle = borderOpts.color;
        ctx.fill();
        ctx.restore();
    }

    // Draw masked webcam
    ctx.save();
    maskFn(ctx, cx, cy, r);
    ctx.clip();

    // Fit video proportionally
    const vw = video.videoWidth || w;
    const vh = video.videoHeight || h;
    const scale = Math.max((r * 2) / vw, (r * 2) / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = cx - dw / 2;
    const dy = cy - dh / 2;

    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.restore();
}
