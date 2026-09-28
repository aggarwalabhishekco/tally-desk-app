/* ==========================================================================
   A small hidden delight — the classic Konami code (↑ ↑ ↓ ↓ ← → ← → B A)
   reveals a friendly "secret ledger entry" overlay with a genuine, useful
   tax tip. Purely for fun; it stores nothing, sends nothing, and does not
   affect any tool's calculations.
   ========================================================================== */
(function () {
    const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let progress = 0;

    const TIPS = [
        'Rent receipts alone aren\'t always enough — if your annual rent exceeds ₹1,00,000, your landlord\'s PAN is mandatory for the HRA exemption to hold up.',
        'A capital loss you don\'t report in a return filed on time can\'t be carried forward — even if you had no tax to pay that year, it can still be worth filing.',
        'TDS being deducted doesn\'t mean you\'re done — you may still need to file a return to claim a refund, report other income, or carry forward a loss.',
        'Under the Income Tax Act, 2025, almost every non-salary TDS section you know by number (194C, 194J, 194H...) now lives under one place — Section 393.',
        'Switching tax regimes isn\'t always a once-a-year formality for everyone — business-income taxpayers face restrictions that salaried taxpayers don\'t.',
        'Gifts from specified relatives are tax-free at any amount — but from anyone else, over ₹50,000 in a year becomes taxable in your hands.',
        'GST registration isn\'t just for "big" businesses — cross ₹20 lakh in service turnover (₹40 lakh for goods, in most states) and it\'s mandatory.'
    ];

    function injectStyles() {
        if (document.getElementById('egg-styles')) return;
        const style = document.createElement('style');
        style.id = 'egg-styles';
        style.textContent = `
            @keyframes eggFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes eggPop { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes eggFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
            #egg-overlay {
                position: fixed; inset: 0; z-index: 99999;
                background: rgba(0, 20, 38, 0.88);
                display: flex; align-items: center; justify-content: center;
                animation: eggFadeIn 0.25s ease-out; padding: 20px;
            }
            #egg-card {
                background: linear-gradient(155deg, #002b49, #00385e);
                border: 1px solid rgba(212,175,55,0.5);
                border-radius: 14px; max-width: 480px; width: 100%;
                padding: 36px 32px; text-align: center; color: #fff;
                box-shadow: 0 20px 60px rgba(0,0,0,0.4);
                animation: eggPop 0.3s cubic-bezier(.2,1.4,.4,1);
                font-family: Inter, Arial, sans-serif;
            }
            #egg-card .egg-emoji { font-size: 2.6rem; display:block; margin-bottom: 10px; animation: eggFloat 2.2s ease-in-out infinite; }
            #egg-card h3 { font-family: Lora, Georgia, serif; color: #d4af37; margin: 0 0 12px; font-size: 1.4rem; }
            #egg-card p { color: #e6edf3; line-height: 1.6; font-size: 0.98rem; margin: 0 0 20px; }
            #egg-card button {
                background: #d4af37; color: #002b49; border: none; border-radius: 8px;
                padding: 10px 24px; font-weight: 700; cursor: pointer; font-size: 0.95rem;
            }
            #egg-card button:hover { background: #c49b2a; }
        `;
        document.head.appendChild(style);
    }

    function showEgg() {
        injectStyles();
        if (document.getElementById('egg-overlay')) return;
        const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
        const overlay = document.createElement('div');
        overlay.id = 'egg-overlay';
        overlay.innerHTML = `
            <div id="egg-card">
                <span class="egg-emoji">📖✨</span>
                <h3>You found our secret ledger entry!</h3>
                <p>Since you're clearly the detail-oriented type — here's one on the house:<br><br><strong>${tip}</strong></p>
                <button id="egg-close">Nice, thanks →</button>
            </div>
        `;
        document.body.appendChild(overlay);
        function close() { overlay.remove(); }
        document.getElementById('egg-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
        });
    }

    document.addEventListener('keydown', (e) => {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === SEQUENCE[progress]) {
            progress++;
            if (progress === SEQUENCE.length) {
                progress = 0;
                showEgg();
            }
        } else {
            progress = (key === SEQUENCE[0]) ? 1 : 0;
        }
    });
})();
