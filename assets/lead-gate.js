/* ==========================================================================
   lead-gate.js — Tally Desk (internal app) build.
   On the public website this shows a "who are you" form before a tool
   unlocks, for lead capture. Inside Tally Desk you're using your own tools
   internally, so we skip the gate entirely and unlock every tool on load.
   ========================================================================== */
(function () {
    function unlockTool(toolBody, gate) {
        toolBody.classList.remove('gate-active');
        if (gate) gate.style.display = 'none';
    }
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('#lead-gate').forEach((gate) => {
            const toolBody = gate.closest('.tool-body');
            if (toolBody) unlockTool(toolBody, gate);
        });
    });
})();
