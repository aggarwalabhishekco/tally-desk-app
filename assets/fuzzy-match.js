// fuzzy-match.js
// Small, dependency-free fuzzy string matching helpers shared across the
// site's tools (GST-2B reconciliation, Audit Document Checklist). Pure
// client-side arithmetic — no AI/API call, so it's free and works offline.
//
// Exposes window.FuzzyMatch = { levenshtein, similarity, normalize, bestMatch }

(function (global) {
    'use strict';

    // Standard normalize: uppercase, strip everything except letters/digits,
    // collapse whitespace. Makes "M/s. Godesi & Co." and "GODESI AND CO"
    // compare sensibly.
    function normalize(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .toUpperCase()
            .replace(/\b(M\/S|MESSRS|PVT|PRIVATE|LTD|LIMITED|LLP|AND|CO|THE)\b\.?/g, '')
            .replace(/[^A-Z0-9]/g, '');
    }

    // Classic iterative Levenshtein edit distance (rows-only DP, O(n*m) time,
    // O(min(n,m)) space).
    function levenshtein(a, b) {
        if (a === b) return 0;
        const la = a.length, lb = b.length;
        if (la === 0) return lb;
        if (lb === 0) return la;
        // Ensure a is the shorter string for the smaller row buffer.
        if (la > lb) { const t = a; a = b; b = t; }
        let prev = new Array(a.length + 1);
        for (let i = 0; i <= a.length; i++) prev[i] = i;
        for (let j = 1; j <= b.length; j++) {
            const curr = new Array(a.length + 1);
            curr[0] = j;
            for (let i = 1; i <= a.length; i++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                curr[i] = Math.min(
                    prev[i] + 1,      // deletion
                    curr[i - 1] + 1,  // insertion
                    prev[i - 1] + cost // substitution
                );
            }
            prev = curr;
        }
        return prev[a.length];
    }

    // 0..1 similarity score (1 = identical) from edit distance, normalized
    // by the longer string's length.
    function similarity(a, b) {
        const na = normalize(a), nb = normalize(b);
        if (!na && !nb) return 1;
        if (!na || !nb) return 0;
        const dist = levenshtein(na, nb);
        const maxLen = Math.max(na.length, nb.length);
        return 1 - dist / maxLen;
    }

    // Given a target string and a list of candidate strings, returns the
    // best match { index, candidate, score } with score in [0,1], or null
    // if the list is empty. minScore filters out weak matches (default 0.6).
    function bestMatch(target, candidates, minScore) {
        minScore = minScore === undefined ? 0.6 : minScore;
        let best = null;
        for (let i = 0; i < candidates.length; i++) {
            const score = similarity(target, candidates[i]);
            if (score >= minScore && (!best || score > best.score)) {
                best = { index: i, candidate: candidates[i], score };
            }
        }
        return best;
    }

    global.FuzzyMatch = { levenshtein, similarity, normalize, bestMatch };
})(typeof window !== 'undefined' ? window : globalThis);
