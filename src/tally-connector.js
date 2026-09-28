// tally-connector.js
// Talks to Tally's built-in ODBC/HTTP-XML server (Gateway of Tally > F1 Help >
// Settings > Connectivity > Client/Server configuration, usually port 9000).
// This is a LOCALHOST-ONLY interface by default -- this app must run on the
// same PC as Tally (or the same LAN with Tally's "Allow requests from other
// applications" turned on). It never exposes Tally to the public internet.

const http = require('http');
const fs = require('fs');
const path = require('path');

// Minimal dependency-free XML -> object parser. Tally's export XML is plain,
// non-namespaced markup, so a small regex-based reader is enough here and
// keeps the app from depending on an external XML library. Repeated sibling
// tags become arrays (mirrors how most XML-to-JSON libraries behave), a
// single occurrence becomes a plain value, and a leaf with no child elements
// becomes its trimmed text.
function parseXML(str) {
  str = String(str).replace(/<!--[\s\S]*?-->/g, '').replace(/<\?xml[^>]*\?>/g, '');
  const tagRe = /<(\/?)([A-Za-z0-9_:.-]+)([^>]*?)(\/?)>|([^<]+)/g;
  const root = { tag: '#root', children: {}, text: '' };
  const stack = [root];
  let m;
  while ((m = tagRe.exec(str))) {
    if (m[5] !== undefined) {
      const text = m[5];
      if (text.trim()) stack[stack.length - 1].text += text;
      continue;
    }
    const closing = m[1] === '/';
    const tagName = m[2];
    const selfClose = m[4] === '/';
    if (closing) {
      const node = stack.pop();
      if (!stack.length) continue;
      const value = Object.keys(node.children).length ? node.children : node.text.trim();
      addChild(stack[stack.length - 1].children, node.tag, value);
    } else if (selfClose) {
      addChild(stack[stack.length - 1].children, tagName, '');
    } else {
      stack.push({ tag: tagName, children: {}, text: '' });
    }
  }
  return root.children;
}

function addChild(children, tag, value) {
  if (children[tag] === undefined) children[tag] = value;
  else if (Array.isArray(children[tag])) children[tag].push(value);
  else children[tag] = [children[tag], value];
}

const parser = { parse: parseXML };

function postXML(host, port, xml, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host,
        port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(xml, 'utf8'),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('Tally did not respond in time. Is Tally open with the company loaded and the ODBC/HTTP server enabled (F1 > Settings > Connectivity)?'));
    });
    req.on('error', (err) => reject(err));
    req.write(xml, 'utf8');
    req.end();
  });
}

// ---- Tally XML request builders -------------------------------------------
// Tally's request language: ENVELOPE > HEADER (EXPORT/IMPORT data) > BODY > EXPORTDATA
// These use Tally's built-in reports so no TDL customisation is required on
// the Tally side -- works out of the box in TallyPrime / Tally.ERP 9.

function listOfCompaniesXML() {
  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Companies</REPORTNAME>
        <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function trialBalanceXML(companyName, fromDate, toDate) {
  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Trial Balance</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${escapeXML(companyName)}</SVCURRENTCOMPANY>
          <SVFROMDATE>${fromDate}</SVFROMDATE>
          <SVTODATE>${toDate}</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function dayBookXML(companyName, fromDate, toDate) {
  return `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVCURRENTCOMPANY>${escapeXML(companyName)}</SVCURRENTCOMPANY>
          <SVFROMDATE>${fromDate}</SVFROMDATE>
          <SVTODATE>${toDate}</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function escapeXML(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// ---- Response shaping -------------------------------------------------------
// Tally's XML is verbose and its exact tag names vary a little by version, so
// we normalise defensively rather than assume one fixed shape.

function asArray(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function num(v) {
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v).replace(/,/g, '').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseCompanies(xml) {
  const json = parser.parse(xml);
  const list = json?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY || json?.ENVELOPE?.COMPANY;
  return asArray(list).map((c) => (typeof c === 'string' ? c : c?.['@_NAME'] || c?.NAME || 'Unknown'));
}

// Heuristic classification of a ledger into the buckets the tools care about.
// Tally groups are user-editable, so this matches on common group/ledger name
// keywords rather than assuming a fixed chart of accounts.
function classifyLedger(name, group) {
  const n = `${name} ${group}`.toLowerCase();
  // Specific keyword buckets are checked BEFORE the generic Direct/Indirect
  // Expenses catch-alls, since most of these ledgers (interest, advertising,
  // tax provisions) live as sub-ledgers under "Indirect Expenses" in a
  // typical chart of accounts -- checking the generic group first would
  // swallow all of them into one undifferentiated bucket.
  if (/interest (paid|on|expense)/.test(n)) return 'interest';
  if (/income tax|advance tax|provision for tax/.test(n)) return 'incomeTax';
  if (/advertisement|marketing|sales promotion|brand/.test(n)) return 'marketingExpense';
  if (/sales account|sale account|revenue/.test(n)) return 'revenue';
  if (/purchase account/.test(n)) return 'cogs';
  if (/sundry debtor/.test(n)) return 'debtors';
  if (/sundry creditor/.test(n)) return 'creditors';
  if (/cash-in-hand|bank account|bank od/.test(n)) return 'cashBank';
  if (/duties.*tax|cgst|sgst|igst|gst/.test(n) && /output|payable|liab/.test(n)) return 'gstOutput';
  if (/duties.*tax|cgst|sgst|igst|gst/.test(n) && /input|receivable|credit/.test(n)) return 'gstInput';
  if (/loan.*liability|secured loan|unsecured loan|bank loan/.test(n)) return 'debt';
  if (/fixed asset/.test(n)) return 'fixedAssets';
  if (/stock-in-hand|closing stock|inventor/.test(n)) return 'inventory';
  // Word-boundary matters here: "indirect expenses" contains "direct expense"
  // as a plain substring, so an unanchored /direct expense/ would misfire on
  // every indirect-expense ledger. Check indirect first and anchor both with
  // \b so "in-direct" can never be mistaken for "direct".
  if (/\bindirect expenses?\b/.test(n)) return 'indirectExpense';
  if (/\bdirect expenses?\b/.test(n)) return 'directExpense';
  return 'other';
}

function parseTrialBalance(xml) {
  const json = parser.parse(xml);
  // Tally's Trial Balance XML nests ledgers under group collections; walk it
  // defensively and collect every LEDGER-ish node with a closing balance.
  const ledgers = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.LEDGERNAME || node.NAME) {
      const name = node.LEDGERNAME || node.NAME;
      const group = node.PARENT || node.GROUPNAME || '';
      const closing = num(node.CLOSINGBALANCE ?? node.CLOSBALANCE ?? node.AMOUNT);
      if (name && closing !== undefined) {
        ledgers.push({ name: String(name), group: String(group), closing, bucket: classifyLedger(name, group) });
      }
    }
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (Array.isArray(val)) val.forEach(walk);
      else if (typeof val === 'object') walk(val);
    }
  })(json);

  const totals = {};
  for (const l of ledgers) {
    totals[l.bucket] = (totals[l.bucket] || 0) + Math.abs(l.closing);
  }
  return { ledgers, totals };
}

// ---- Public API -------------------------------------------------------------

class TallyConnector {
  // mode: 'direct'  -- this PC (or an IP the cloud provider has whitelisted)
  //                    can reach Tally's XML/HTTP port directly, over the LAN
  //                    or a provider-opened firewall rule. Same protocol
  //                    whether Tally is local or a cloud/RDP server -- only
  //                    the host changes.
  // mode: 'folder'  -- the more common "Tally on Cloud" case: the provider's
  //                    RDP server keeps port 9000 closed to the outside for
  //                    security (same reason we'd never expose it ourselves).
  //                    A small companion script (tally-cloud-agent, installed
  //                    ON that Windows server with the provider/client's
  //                    permission) polls Tally on ITS localhost:9000 and drops
  //                    the raw XML into a folder synced by Google
  //                    Drive/OneDrive/Dropbox. This app reads the same files
  //                    back out of the LOCAL copy of that synced folder --
  //                    no inbound port is ever opened on the cloud server.
  constructor({ host = '127.0.0.1', port = 9000, mode = 'direct', folderPath = '' } = {}) {
    this.host = host;
    this.port = port;
    this.mode = mode;
    this.folderPath = folderPath;
  }

  configure({ host, port, mode, folderPath }) {
    if (host) this.host = host;
    if (port) this.port = port;
    if (mode) this.mode = mode;
    if (typeof folderPath === 'string') this.folderPath = folderPath;
  }

  _readSyncedFile(name, maxAgeMs = 24 * 60 * 60 * 1000) {
    const p = path.join(this.folderPath, name);
    if (!fs.existsSync(p)) {
      throw new Error(`Waiting for "${name}" to appear in the sync folder. Check that the cloud-agent script is running on the Tally server and that this folder is fully synced down (${this.folderPath}).`);
    }
    const stat = fs.statSync(p);
    const ageMs = Date.now() - stat.mtimeMs;
    const xml = fs.readFileSync(p, 'utf8');
    return { xml, ageMs, updatedAt: stat.mtimeMs };
  }

  async ping() {
    if (this.mode === 'folder') {
      try {
        const { xml, ageMs, updatedAt } = this._readSyncedFile('Companies.xml');
        const companies = parseCompanies(xml);
        const staleMins = Math.round(ageMs / 60000);
        const warning = ageMs > 20 * 60 * 1000
          ? ` (data is ${staleMins} min old — check the cloud-agent script and the folder sync are both still running)`
          : '';
        return { ok: true, companies, source: 'folder', updatedAt, warning };
      } catch (err) {
        return { ok: false, error: err.message || String(err), source: 'folder' };
      }
    }
    try {
      const xml = await postXML(this.host, this.port, listOfCompaniesXML(), 5000);
      const companies = parseCompanies(xml);
      return { ok: true, companies, source: 'direct' };
    } catch (err) {
      return { ok: false, error: err.message || String(err), source: 'direct' };
    }
  }

  async fetchTrialBalance(companyName, fromDate, toDate) {
    if (this.mode === 'folder') {
      const { xml } = this._readSyncedFile('TrialBalance.xml');
      return parseTrialBalance(xml);
    }
    const xml = await postXML(this.host, this.port, trialBalanceXML(companyName, fromDate, toDate));
    return parseTrialBalance(xml);
  }

  async fetchDayBookRaw(companyName, fromDate, toDate) {
    // Returned as raw XML text -- the day-book -> xlsx shaping is intentionally
    // left to a template-matching step rather than guessed here, since the
    // target tool validates column headers strictly.
    if (this.mode === 'folder') {
      return this._readSyncedFile('DayBook.xml').xml;
    }
    return postXML(this.host, this.port, dayBookXML(companyName, fromDate, toDate));
  }
}

module.exports = { TallyConnector, parseTrialBalance, parseCompanies, classifyLedger, num };
