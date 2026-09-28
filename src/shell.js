(function () {
  const sidebar = document.getElementById('sidebar');
  const toolFrame = document.getElementById('toolFrame');
  const placeholder = document.getElementById('placeholder');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const companyLine = document.getElementById('companyLine');
  const tbList = document.getElementById('tbList');
  const fillBtn = document.getElementById('fillBtn');
  const noteBox = document.getElementById('noteBox');

  let currentTool = null;
  let latestTrialBalance = null;
  let latestStatus = null;
  let fyMonthsElapsed = monthsSinceAprilFirst();

  function monthsSinceAprilFirst() {
    const d = new Date();
    const fyStartMonth = 3; // April, 0-indexed
    let months = d.getMonth() - fyStartMonth;
    if (months < 0) months += 12;
    return Math.max(1, months + 1);
  }

  // ---- Sidebar -------------------------------------------------------
  function renderSidebar() {
    sidebar.innerHTML = '';
    TOOL_CATEGORIES.forEach((cat) => {
      const catEl = document.createElement('div');
      catEl.className = 'cat';
      catEl.textContent = cat.label;
      sidebar.appendChild(catEl);
      cat.tools.forEach((tool) => {
        const a = document.createElement('a');
        a.href = '#';
        a.dataset.id = tool.id;
        a.innerHTML = tool.title + (tool.tally === 'direct' ? '<span class="badge">Tally auto-fill</span>' : '');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          openTool(tool);
        });
        sidebar.appendChild(a);
      });
    });
  }

  function openTool(tool) {
    currentTool = tool;
    document.querySelectorAll('nav.sidebar a').forEach((a) => a.classList.toggle('active', a.dataset.id === tool.id));
    placeholder.style.display = 'none';
    toolFrame.style.display = 'block';
    toolFrame.setAttribute('src', `../tools/${tool.file}`);
    renderTallyPanelForTool();
  }

  // ---- Tally panel -----------------------------------------------------
  function fmtINR(n) {
    if (!n && n !== 0) return '—';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  function bucketValue(totals, bucket, mode) {
    const buckets = Array.isArray(bucket) ? bucket : [bucket];
    let sum = 0;
    buckets.forEach((b) => (sum += totals[b] || 0));
    if (mode === 'monthly') return sum / fyMonthsElapsed;
    return sum;
  }

  function renderTallyPanelForTool() {
    noteBox.innerHTML = '';
    if (!currentTool) {
      fillBtn.disabled = true;
      fillBtn.textContent = 'Open a tool to auto-fill';
      return;
    }
    if (currentTool.tally === 'direct') {
      fillBtn.disabled = !latestTrialBalance;
      fillBtn.textContent = `Auto-fill from Tally into "${currentTool.title}"`;
    } else if (currentTool.tally === 'file-2') {
      fillBtn.disabled = true;
      fillBtn.textContent = 'Direct auto-fill not available for this tool';
      if (currentTool.note) {
        const box = document.createElement('div');
        box.className = 'note-box';
        box.textContent = currentTool.note;
        noteBox.appendChild(box);
      }
    } else {
      fillBtn.disabled = true;
      fillBtn.textContent = 'This tool has no Tally data mapping';
    }
  }

  function renderTrialBalance(tb) {
    latestTrialBalance = tb;
    if (!tb) {
      tbList.innerHTML = '<div class="muted">No Trial Balance data yet.</div>';
      return;
    }
    const rows = [
      ['Revenue (Sales)', tb.totals.revenue],
      ['Cost of Goods / Purchases', tb.totals.cogs],
      ['Direct Expenses', tb.totals.directExpense],
      ['Indirect Expenses', tb.totals.indirectExpense],
      ['Cash & Bank', tb.totals.cashBank],
      ['Sundry Debtors', tb.totals.debtors],
      ['Sundry Creditors', tb.totals.creditors],
      ['Fixed Assets', tb.totals.fixedAssets],
      ['Inventory', tb.totals.inventory],
      ['Interest', tb.totals.interest],
      ['Income Tax', tb.totals.incomeTax],
      ['Marketing/Advt. Expense', tb.totals.marketingExpense],
    ];
    tbList.innerHTML = rows
      .map(([label, val]) => `<div class="tb-row"><span>${label}</span><span class="v">${fmtINR(val)}</span></div>`)
      .join('');
    renderTallyPanelForTool();
  }

  // ---- Fill button ------------------------------------------------------
  fillBtn.addEventListener('click', async () => {
    if (!currentTool || currentTool.tally !== 'direct' || !latestTrialBalance) return;
    const totals = latestTrialBalance.totals;
    const assignments = Object.entries(currentTool.fields).map(([fieldId, spec]) => {
      const val = Math.round(bucketValue(totals, spec.bucket, spec.mode));
      return { fieldId, val };
    });

    const script = `
      (function() {
        const assignments = ${JSON.stringify(assignments)};
        let filled = 0;
        assignments.forEach(function(a) {
          const el = document.getElementById(a.fieldId);
          if (el && a.val) {
            el.value = a.val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            filled++;
          }
        });
        return filled;
      })();
    `;
    try {
      const filled = await toolFrame.executeJavaScript(script);
      fillBtn.textContent = `Filled ${filled} field${filled === 1 ? '' : 's'} from Tally — check before relying on it`;
      setTimeout(() => renderTallyPanelForTool(), 3000);
    } catch (err) {
      fillBtn.textContent = 'Could not auto-fill — open the tool first';
    }
  });

  // ---- Status ------------------------------------------------------------
  function renderStatus(status) {
    latestStatus = status;
    if (status.ok) {
      statusDot.classList.add('ok');
      const modeLabel = status.source === 'folder' ? 'cloud folder' : 'direct';
      statusText.textContent = `Connected (${modeLabel})${status.warning ? ' — ' + status.warning : ''}`;
      companyLine.textContent = status.companies && status.companies.length
        ? `Company: ${status.companies[0]}${status.companies.length > 1 ? ` (+${status.companies.length - 1} more)` : ''}`
        : 'Connected — waiting for company data.';
    } else {
      statusDot.classList.remove('ok');
      statusText.textContent = status.error || 'Not connected';
      companyLine.textContent = 'Not connected. Open Settings to check your Tally connection.';
    }
  }

  // ---- Settings modal ------------------------------------------------------
  const modal = document.getElementById('settingsModal');
  const directFields = document.getElementById('directFields');
  const folderFields = document.getElementById('folderFields');

  function toggleModeFields(mode) {
    directFields.style.display = mode === 'direct' ? 'block' : 'none';
    folderFields.style.display = mode === 'folder' ? 'block' : 'none';
  }

  document.querySelectorAll('input[name="syncMode"]').forEach((r) => {
    r.addEventListener('change', (e) => toggleModeFields(e.target.value));
  });

  document.getElementById('settingsBtn').addEventListener('click', async () => {
    const s = await window.tallyDesk.getSettings();
    document.querySelector(`input[name="syncMode"][value="${s.syncMode}"]`).checked = true;
    toggleModeFields(s.syncMode);
    document.getElementById('fHost').value = s.tallyHost;
    document.getElementById('fPort').value = s.tallyPort;
    document.getElementById('fFolder').value = s.folderPath || '';
    document.getElementById('fCompany').value = s.companyName || '';
    document.getElementById('fInterval').value = s.pollIntervalSec;
    modal.style.display = 'flex';
  });

  document.getElementById('cancelSettings').addEventListener('click', () => (modal.style.display = 'none'));

  document.getElementById('browseFolderBtn').addEventListener('click', async () => {
    const folder = await window.tallyDesk.pickFolder();
    if (folder) document.getElementById('fFolder').value = folder;
  });

  document.getElementById('saveSettings').addEventListener('click', async () => {
    const mode = document.querySelector('input[name="syncMode"]:checked').value;
    await window.tallyDesk.setSettings({
      syncMode: mode,
      tallyHost: document.getElementById('fHost').value.trim(),
      tallyPort: document.getElementById('fPort').value.trim(),
      folderPath: document.getElementById('fFolder').value.trim(),
      companyName: document.getElementById('fCompany').value.trim(),
      pollIntervalSec: document.getElementById('fInterval').value.trim(),
    });
    modal.style.display = 'none';
  });

  document.getElementById('syncNowBtn').addEventListener('click', () => window.tallyDesk.syncNow());

  // ---- Wire up -------------------------------------------------------------
  window.tallyDesk.onStatus(renderStatus);
  window.tallyDesk.onTrialBalance(renderTrialBalance);
  window.tallyDesk.getLast().then((last) => {
    if (last.status) renderStatus(last.status);
    if (last.trialBalance) renderTrialBalance(last.trialBalance);
  });

  renderSidebar();
})();
