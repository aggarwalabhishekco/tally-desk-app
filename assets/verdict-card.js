/* ==========================================================================
   Shareable "Verdict Card" generator — draws a branded, social-friendly PNG
   (1080x1080) summarizing a calculator result, entirely client-side via
   Canvas. Nothing is uploaded; the image never leaves the visitor's browser
   except when they choose to download or share it themselves.
   ========================================================================== */
(function () {
    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (ctx.measureText(testLine).width > maxWidth && i > 0) {
                lines.push(line.trim());
                line = words[i] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line.trim());
        lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
        return lines.length;
    }

    // opts: { eyebrow, headline, resultLine, resultSub, footerNote, toolLabel }
    window.renderVerdictCard = function (canvas, opts) {
        const W = 1080, H = 1080;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Background — navy gradient with a subtle gold "rising bars" motif
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#002b49');
        bg.addColorStop(1, '#00385e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = '#d4af37';
        const barCount = 12;
        for (let i = 0; i < barCount; i++) {
            const bw = W / barCount;
            const bh = 120 + (i % 5) * 60;
            ctx.fillRect(i * bw, H - bh, bw - 6, bh);
        }
        ctx.restore();

        // Card panel
        const pad = 64;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2);
        ctx.strokeStyle = 'rgba(212,175,55,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

        // Firm name
        ctx.fillStyle = '#d4af37';
        ctx.font = '700 30px Georgia, "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.fillText('AGGARWAL ABHISHEK & CO.', W / 2, pad + 70);
        ctx.font = '400 18px Arial, sans-serif';
        ctx.fillStyle = '#c7d2dd';
        ctx.fillText('CHARTERED ACCOUNTANTS', W / 2, pad + 100);

        // Eyebrow
        ctx.font = '600 22px Arial, sans-serif';
        ctx.fillStyle = '#8fb4d4';
        ctx.fillText((opts.eyebrow || '').toUpperCase(), W / 2, pad + 175);

        // Headline
        ctx.font = '700 46px Georgia, "Times New Roman", serif';
        ctx.fillStyle = '#ffffff';
        wrapText(ctx, opts.headline || '', W / 2, pad + 250, W - pad * 2 - 60, 56);

        // Result — big number
        ctx.font = '800 88px Arial, sans-serif';
        ctx.fillStyle = '#d4af37';
        ctx.fillText(opts.resultLine || '', W / 2, H / 2 + 90);

        ctx.font = '500 26px Arial, sans-serif';
        ctx.fillStyle = '#e6edf3';
        wrapText(ctx, opts.resultSub || '', W / 2, H / 2 + 145, W - pad * 2 - 60, 34);

        // Divider
        ctx.strokeStyle = 'rgba(212,175,55,0.4)';
        ctx.beginPath();
        ctx.moveTo(W / 2 - 120, H - 220);
        ctx.lineTo(W / 2 + 120, H - 220);
        ctx.stroke();

        // Footer
        ctx.font = '400 20px Arial, sans-serif';
        ctx.fillStyle = '#c7d2dd';
        ctx.fillText(opts.footerNote || 'Estimate only — not tax advice.', W / 2, H - 175);

        ctx.font = '700 24px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Check your own numbers free at', W / 2, H - 130);
        ctx.font = '700 26px Arial, sans-serif';
        ctx.fillStyle = '#d4af37';
        ctx.fillText(opts.toolLabel || 'aggarwalabhishekco.com', W / 2, H - 90);
    };

    // Wires a "download card" button to a canvas + a result-supplier callback.
    // buttonId: button element id. getOpts: () => opts object (or null if no result yet).
    window.wireVerdictCardButton = function (buttonId, getOpts, filenamePrefix) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const opts = getOpts();
            if (!opts) return;
            const canvas = document.createElement('canvas');
            window.renderVerdictCard(canvas, opts);
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filenamePrefix || 'Result'}_${new Date().toISOString().slice(0, 10)}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        });
    };
})();
