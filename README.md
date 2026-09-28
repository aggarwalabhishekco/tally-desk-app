# Tally Desk — Aggarwal Abhishek & Co.

A Windows/Mac desktop app that bundles all 18 of your firm's free tools and
keeps them fed with live data from Tally in the background.

## What it does

- Runs quietly in the system tray, polling Tally in the background (default
  every 30 seconds) — no need to keep it in focus.
- All 18 tools are built into the app itself (works offline, no dependency
  on the live website).
- For the tools that actually consume ledger-style data, a **"Auto-fill from
  Tally"** button appears and fills the tool's inputs from your live Trial
  Balance: Financial Health Screener, GST & Tax Cash Flow Forecaster, Unit
  Economics Calculator, Breakeven & Runway Calculator.
- A live Tally Data panel on the right always shows the current company,
  connection status, and a running set of Trial Balance totals — useful even
  for tools without a direct auto-fill button, as a quick cross-check.

## Two ways it connects to Tally

**1. Direct (Tally on your own PC, or on a LAN/cloud server that allows it)**
Settings → Sync mode → Direct. Enter the host (127.0.0.1 if Tally is on this
same PC) and port (9000 by default — check Tally's F1 → Settings →
Connectivity). This uses Tally's own built-in XML/HTTP export interface, the
same one ODBC tools use — nothing is exposed beyond that.

**2. Cloud folder sync (most "Tally on Cloud" providers)**
Almost all Indian Tally-on-Cloud providers run Tally on a remote Windows/RDP
server with port 9000 closed to the outside world, for the same security
reason we'd never recommend opening it ourselves. For that case:

1. On the **cloud server itself** (with your provider's permission), copy
   the `tally-cloud-agent/` folder there and run `install-agent.ps1` once —
   see that folder's comments for exact steps. It talks to Tally on the
   server's own localhost:9000 (nothing opened externally) and writes the
   results into a folder you point at your Google Drive / OneDrive / Dropbox
   sync folder, also installed on that server.
2. On **your own PC**, install that same Drive/OneDrive/Dropbox account so
   the folder syncs down locally.
3. In Tally Desk → Settings → Sync mode → "Cloud folder sync", point it at
   the **local** copy of that synced folder.

Either way, no inbound port is ever opened on the cloud server — data only
flows outward, the same direction a normal file sync already works in.

## Building the installers (do this on your own PC — see note below)

```
cd electron-app
npm install
npm run dist:win     # → dist/*.exe  (Windows installer)
npm run dist:mac     # → dist/*.zip  (Mac app, run on a Mac or via CI)
```

**Why I didn't hand you a finished .exe/.dmg directly:** this build was done
in a sandboxed workspace with no access to the npm package registry, so I
could not download Electron itself here to compile and test the actual
binaries. Everything else — the Tally connector, the field-mapping logic,
the settings store, the tray icon — I wrote dependency-free specifically so
I could unit-test it for real in this sandbox (see `test-tally-parser.js`;
all assertions pass). The remaining step, `npm install && npm run dist:win`,
needs a machine with normal internet access — takes about 5 minutes on a
regular PC or laptop.

**Unsigned builds:** without a paid code-signing certificate (~$100–400/yr),
Windows SmartScreen and Mac Gatekeeper will both warn that the app is from
an "unknown publisher" the first time it's opened. That's expected for an
internal tool — Windows: "More info" → "Run anyway"; Mac: right-click the
app → "Open" → confirm. This isn't something I can remove without you
buying a certificate; happy to help set one up later if it becomes worth it.

## What's auto-filled vs. what still needs a real Tally test

I built the field mappings from the actual input IDs in each tool's code, and
verified the Tally-XML parsing and bucket classification logic against a
realistic sample (`test-tally-parser.js`). What I could **not** do without a
live Tally instance in front of me:
- Confirm the exact XML your specific Tally version/company returns (field
  names have drifted slightly across Tally.ERP 9 / TallyPrime versions).
- Auto-generate the import files for **GST 2B Reconciliation** and **Audit
  Document Checklist** — both expect an *unedited* Trial Balance/Day Book
  **Excel** export from Tally's own "Export" menu, which has a different,
  stricter layout than the XML API. Rather than guess that layout and risk
  handing you a file that silently fails validation, those two tools keep
  using your existing manual Excel-export workflow for now (the Tally panel
  still shows live totals alongside, so you can sanity-check the numbers).

First time you run this against your real Tally data, treat the auto-filled
numbers as a draft to check, not a final answer — and let me know what
doesn't line up so I can tighten the mapping.
