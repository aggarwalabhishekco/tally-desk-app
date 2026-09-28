/* ==========================================================================
   GST 2B vs Books Reconciliation — matching engine
   Pure functions, no DOM access, so they can be unit-tested with Node
   and reused unchanged in the browser. Loaded by tools/gst-2b-reconciliation.html.
   ========================================================================== */

function gstNormalizeGstin(s) {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, '');
}

// Strips everything except letters/digits, uppercases, and strips leading
// zeros from a purely numeric string — handles "INV-045" vs "inv045" vs "045".
function gstNormalizeInvNo(s) {
    let v = String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^\d+$/.test(v)) v = v.replace(/^0+(?=\d)/, '');
    return v;
}

function gstMakeKey(gstin, invNo) {
    return gstNormalizeGstin(gstin) + '|' + gstNormalizeInvNo(invNo);
}

function gstParseAmount(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
}

// Amounts are "close enough" if within ₹2 or 1%, whichever is larger.
function gstAmountsMatch(a, b, tolAbs, tolPct) {
    tolAbs = tolAbs === undefined ? 2 : tolAbs;
    tolPct = tolPct === undefined ? 0.01 : tolPct;
    const diff = Math.abs(a - b);
    const tol = Math.max(tolAbs, tolPct * Math.max(Math.abs(a), Math.abs(b)));
    return diff <= tol;
}

function gstParseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    // Excel serial date number
    if (typeof v === 'number') {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        return new Date(epoch.getTime() + v * 86400000);
    }
    const s = String(v).trim();
    // DD-MM-YYYY or DD/MM/YYYY
    let m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    // YYYY-MM-DD
    m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Reconcile normalized 2B rows against normalized Books rows.
 * Each row: { gstin, name, invNo, invDate (Date|null), taxable, igst, cgst, sgst, cess,
 *             itcAvailable (bool|null), itcReason (string), type ('Invoice'|'Note'), noteType }
 *
 * Invoices and Notes (credit/debit notes) are matched in two separate passes —
 * a row never matches across category, even if an invoice number and a note
 * number happen to coincide, since they come from different document series
 * and different GSTR-2B sheets (B2B vs B2B-CDNR).
 * Returns { matched, variance, onlyIn2B, onlyInBooks, probable }
 */
function gstReconcile(twoBRows, booksRows) {
    const isNote = r => r.type === 'Note';
    const invoiceResult = gstReconcileCategory(twoBRows.filter(r => !isNote(r)), booksRows.filter(r => !isNote(r)));
    const noteResult = gstReconcileCategory(twoBRows.filter(isNote), booksRows.filter(isNote));
    return {
        matched: invoiceResult.matched.concat(noteResult.matched),
        variance: invoiceResult.variance.concat(noteResult.variance),
        onlyIn2B: invoiceResult.onlyIn2B.concat(noteResult.onlyIn2B),
        onlyInBooks: invoiceResult.onlyInBooks.concat(noteResult.onlyInBooks),
        probable: invoiceResult.probable.concat(noteResult.probable)
    };
}

// Matches within a single category (either all Invoices or all Notes). This is
// the original single-pass matching algorithm, now called once per category.
function gstReconcileCategory(twoBRows, booksRows) {
    const booksByKey = new Map();
    booksRows.forEach(row => {
        const key = gstMakeKey(row.gstin, row.invNo);
        if (!booksByKey.has(key)) booksByKey.set(key, []);
        booksByKey.get(key).push(row);
    });

    // Secondary index for probable matching: gstin -> list of {row, taxable, date}
    const booksByGstin = new Map();
    booksRows.forEach(row => {
        const g = gstNormalizeGstin(row.gstin);
        if (!booksByGstin.has(g)) booksByGstin.set(g, []);
        booksByGstin.get(g).push(row);
    });

    const usedBooksRows = new Set();
    const matched = [];
    const variance = [];
    const onlyIn2B = [];
    const probable = [];

    twoBRows.forEach(r2b => {
        const key = gstMakeKey(r2b.gstin, r2b.invNo);
        const candidates = (booksByKey.get(key) || []).filter(b => !usedBooksRows.has(b));

        if (candidates.length > 0) {
            const book = candidates[0];
            usedBooksRows.add(book);
            const taxableOk = gstAmountsMatch(r2b.taxable, book.taxable);
            const totalTax2b = r2b.igst + r2b.cgst + r2b.sgst + r2b.cess;
            const totalTaxBook = book.igst + book.cgst + book.sgst + book.cess;
            const taxOk = gstAmountsMatch(totalTax2b, totalTaxBook);
            const pair = { twoB: r2b, book: book };
            if (taxableOk && taxOk) {
                matched.push(pair);
            } else {
                pair.taxableDiff = r2b.taxable - book.taxable;
                pair.taxDiff = totalTax2b - totalTaxBook;
                variance.push(pair);
            }
            return;
        }

        // Fallback: same GSTIN, close taxable value and same date -> probable match
        const sameGstin = (booksByGstin.get(gstNormalizeGstin(r2b.gstin)) || []).filter(b => !usedBooksRows.has(b));
        const probableMatch = sameGstin.find(b => {
            const dateMatch = r2b.invDate && b.invDate &&
                r2b.invDate.getTime() === b.invDate.getTime();
            return dateMatch && gstAmountsMatch(r2b.taxable, b.taxable, 5, 0.01);
        });
        if (probableMatch) {
            usedBooksRows.add(probableMatch);
            probable.push({ twoB: r2b, book: probableMatch, matchType: 'date+amount' });
            return;
        }

        // Second-tier fuzzy fallback: same GSTIN, invoice number typo'd
        // (e.g. "INV-26-27-12390" entered as "INV-26-27-l2390" or with a
        // digit dropped/transposed) but still close taxable value, and
        // date within a couple of days (covers invoice-date vs entry-date
        // slips). Uses FuzzyMatch when the shared helper is loaded (in the
        // browser and in tests that require it); silently skipped if not
        // present (still leaves the row in onlyIn2B, which is safe).
        if (typeof FuzzyMatch !== 'undefined' && sameGstin.length) {
            const candidates = sameGstin.filter(b => {
                const amountOk = gstAmountsMatch(r2b.taxable, b.taxable, 5, 0.02);
                if (!amountOk) return false;
                if (r2b.invDate && b.invDate) {
                    const dayDiff = Math.abs(r2b.invDate.getTime() - b.invDate.getTime()) / 86400000;
                    if (dayDiff > 3) return false;
                }
                return true;
            });
            if (candidates.length) {
                const best = FuzzyMatch.bestMatch(r2b.invNo, candidates.map(c => c.invNo), 0.72);
                if (best) {
                    const fuzzyMatch = candidates[best.index];
                    usedBooksRows.add(fuzzyMatch);
                    probable.push({ twoB: r2b, book: fuzzyMatch, matchType: 'fuzzy-invno', fuzzyScore: best.score });
                    return;
                }
            }
        }

        onlyIn2B.push(r2b);
    });

    const onlyInBooks = booksRows.filter(b => !usedBooksRows.has(b));

    return { matched, variance, onlyIn2B, onlyInBooks, probable };
}

function gstSumTax(rows, field) {
    return rows.reduce((acc, r) => acc + (r[field] || 0), 0);
}

// Universal export guard: does nothing in the browser (module is undefined there),
// lets Node's test harness `require()` this file directly.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        gstNormalizeGstin, gstNormalizeInvNo, gstMakeKey, gstParseAmount,
        gstAmountsMatch, gstParseDate, gstReconcile, gstReconcileCategory, gstSumTax
    };
}
