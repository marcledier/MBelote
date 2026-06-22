/*
 * Coinche parameter sweep — grids bid/raise/suit-switch params, scores each by
 * expected net coinche points per deal, reports the top results.
 *
 * Usage: node sweep.js [--deals N] [--top K] [--write]
 *   --deals N   deals per combination (default 300)
 *   --top K     show top K results    (default 10)
 *   --write     update btai-params.json with best params
 */
"use strict";

var fs   = require('fs');
var path = require('path');
var vm   = require('vm');

// ── DOM / jQuery stub ─────────────────────────────────────────────────────────

var _triggerStack = [];
var _docHandlers  = {};

var _noopPromise = { then: function () { return _noopPromise; } };
var _fakeEl = {
    addEventListener: function () {},
    removeEventListener: function () {},
    appendChild:     function () { return _fakeEl; },
    querySelector:   function () { return _fakeEl; },
    querySelectorAll: function () { return { forEach: function () {} }; },
    cloneNode:       function () { return _fakeEl; },
    insertAdjacentHTML: function () {},
    animate:         function () { return { finished: _noopPromise }; },
    getAnimations:   function () { return []; },
    remove: function () {}, removeAttribute: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
    style: {}, classList: { add: function(){}, remove: function(){} },
    offsetWidth: 0, offsetHeight: 0, offsetTop: 0,
    clientWidth: 300, clientHeight: 300,
    innerHTML: '', textContent: '', checked: false, value: '', id: ''
};

var _docEl = {
    addEventListener:  function (ev, fn) { _docHandlers[ev] = fn; },
    removeEventListener: function () {},
    dispatchEvent:     function (e) { _triggerStack.push(e.type || e); },
    getElementById:    function () { return _fakeEl; },
    createElement:     function () { return _fakeEl; },   // reuse singleton — no accumulation
    querySelectorAll:  function () { return { forEach: function () {} }; }
};

function _$(sel) {
    if (sel === ':mobile-pagecontainer') return { pagecontainer: function () {} };
    return _fakeEl;
}
_$.proxy    = function (fn, ctx) { return fn.bind(ctx); };
_$.each     = function (arr, fn) {
    if (Array.isArray(arr)) arr.forEach(function (v, i) { fn(i, v); });
    else Object.keys(arr).forEach(function (k) { fn(k, arr[k]); });
};
_$.grep     = function (arr, fn) { return arr.filter(fn); };
_$.isNumeric = function (v) { return !isNaN(parseFloat(v)) && isFinite(v); };

global.$          = _$;
global.document   = _docEl;
global.window     = { innerWidth: 800, innerHeight: 600, addEventListener: function(){} };
global.alert      = function () {};    // suppress play-loop warnings
global.console    = { log: function(){}, warn: function(){} };

global.localStorage = {
    _data: {},
    getItem:  function (k) { return this._data[k] || null; },
    setItem:  function (k, v) { this._data[k] = String(v); }
};

global.setTimeout  = function (fn) { fn(); };
global.clearTimeout = function () {};
global.Event       = function (type) { this.type = type; };

function loadScript(file) {
    var code = fs.readFileSync(path.join(__dirname, 'scripts', file), 'utf8');
    if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1);
    code = code.replace(/\$\s*\(\s*document\s*\)\s*\.ready\s*\([\s\S]*$/g, '');
    vm.runInThisContext(code, { filename: file });
}

// ── Load game scripts once ────────────────────────────────────────────────────

loadScript('btcarte.js');
global.BtAIParams = JSON.parse(fs.readFileSync(path.join(__dirname, 'scripts', 'btai-params.json'), 'utf8'));
global.window.BtAIParams = global.BtAIParams;
loadScript('btjoueur.js');
loadScript('btpli.js');
loadScript('BtMain.js');

// Capture original params before the sweep mutates BtAIParams in place
var _origParams = {
    minScoreToOpen:      global.BtAIParams.coinche.bid.minScoreToOpen,
    scorePerStep:        global.BtAIParams.coinche.bid.scorePerStep,
    raiseDivisor:        global.BtAIParams.coinche.complement.raiseDivisor,
    raiseCap:            global.BtAIParams.coinche.complement.raiseCap,
    suitSwitchThreshold: global.BtAIParams.coinche.complement.suitSwitchThreshold,
    suitSwitchMargin:    global.BtAIParams.coinche.complement.suitSwitchMargin,
};

BtMain.c_humanplayer  = -1;
BtMain.c_test_betloop = false;

// ── Event pump ────────────────────────────────────────────────────────────────

function pump() {
    var limit = 400000;
    while (_triggerStack.length > 0 && limit-- > 0) {
        var ev = _triggerStack.shift();
        if (ev === '__done__') { _triggerStack.length = 0; return; }
        if (_docHandlers[ev]) _docHandlers[ev]();
    }
    if (limit <= 0) throw new Error('Event pump runaway');
}

// ── CLI args ──────────────────────────────────────────────────────────────────

var cliArgs = process.argv.slice(2);
var N_DEALS  = 300;
var TOP_K    = 10;
var DO_WRITE = false;

for (var i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === '--deals' && cliArgs[i+1]) N_DEALS = parseInt(cliArgs[++i]);
    if (cliArgs[i] === '--top'   && cliArgs[i+1]) TOP_K   = parseInt(cliArgs[++i]);
    if (cliArgs[i] === '--write') DO_WRITE = true;
}

// ── Parameter grid ────────────────────────────────────────────────────────────

var GRID = {
    minScoreToOpen:      [50, 54, 58, 62, 66],
    scorePerStep:        [10, 12, 14, 16, 18],
    raiseDivisor:        [22, 26, 30, 34, 38],
    raiseCap:            [100, 110, 120, 130],
    suitSwitchThreshold: [60, 65, 70],
    suitSwitchMargin:    [12, 16, 20, 24],
};

var combos = [{}];
Object.keys(GRID).forEach(function (key) {
    var vals = GRID[key];
    combos = combos.flatMap(function (c) {
        return vals.map(function (v) {
            var nc = Object.assign({}, c);
            nc[key] = v;
            return nc;
        });
    });
});

// ── Scoring metric ────────────────────────────────────────────────────────────
//
// Expected coinche points for the preneur team per deal:
//   success  → earn contrat points
//   failure  → lose (160 + contrat) points

function metric(successes, deals, total_bid) {
    if (deals === 0) return -Infinity;
    var avg = total_bid / deals;
    var sr  = successes / deals;
    var fr  = 1 - sr;
    return avg * sr - (avg + 160) * fr;
}

// ── Create ONE game instance, reused across all combos ────────────────────────

global.setTimeout = function () {};   // suppress constructor's auto-start
global.localStorage._data = {};
global.localStorage.setItem('mlrdev.belote.btoptions', JSON.stringify({
    btdelay: 0, btcardwidth: 100,
    btjeuauto: true, btcoinche: true,
    btautolast: false, btautouniq: false, btsenshoraire: false
}));
var _sharedGame = new BtMain();
_sharedGame.sauveretatdujeu = function () {};
global.setTimeout = function (fn) { fn(); };   // restore for the pump
_triggerStack.length = 0;
_sharedGame.nouvellepartie();          // initialise m_plis, m_cartes, m_totaux …
_triggerStack.length = 0;

// ── Run one combination (reuses _sharedGame) ──────────────────────────────────

function runCombo(params, nDeals) {
    var bp = global.BtAIParams;
    bp.coinche.bid.minScoreToOpen             = params.minScoreToOpen;
    bp.coinche.bid.scorePerStep               = params.scorePerStep;
    bp.coinche.complement.raiseDivisor        = params.raiseDivisor;
    bp.coinche.complement.raiseCap            = params.raiseCap;
    bp.coinche.complement.suitSwitchThreshold = params.suitSwitchThreshold;
    bp.coinche.complement.suitSwitchMargin    = params.suitSwitchMargin;

    var game = _sharedGame;
    // Reset score totals so m_findepartie never triggers
    game.m_totaux      = [0, 0];
    game.m_findepartie = false;

    var deals = 0, successes = 0, total_bid = 0;

    game.affichepagescores = function () {
        var hasBid = game.m_pari && game.m_pari.couleur >= 0 && game.m_pari.point > 0;
        if (hasBid) {
            var eqp     = game.m_preneurid % 2;
            var pts     = game.m_donne.points[eqp];
            var contrat = game.m_pari.point;
            deals++;
            total_bid += contrat;
            if (pts >= contrat) successes++;
        }
        game.m_totaux      = [0, 0];
        game.m_findepartie = false;
        _triggerStack.push('__done__');
    };

    var guard = nDeals * 6;
    while (deals < nDeals && guard-- > 0) {
        _triggerStack.length = 0;
        _triggerStack.push('btnouvelledonne');
        pump();
    }

    return {
        deals:       deals,
        successes:   successes,
        total_bid:   total_bid,
        net:         metric(successes, deals, total_bid),
        success_pct: deals > 0 ? 100 * successes / deals : 0,
        avg_bid:     deals > 0 ? total_bid / deals : 0,
    };
}

// ── Sweep ─────────────────────────────────────────────────────────────────────

var RC = require('console');   // real console (game scripts shadowed global.console above)

RC.log('═══════════════════════════════════════════════════════════════');
RC.log(' Coinche parameter sweep  combos=' + combos.length + '  deals/combo=' + N_DEALS);
RC.log('═══════════════════════════════════════════════════════════════');

// Keep only top-K results in memory to avoid accumulation
var results = [];
var t0 = process.hrtime.bigint();

combos.forEach(function (params, i) {
    var r = runCombo(params, N_DEALS);
    var item = { params: params, result: r };
    results.push(item);
    // Prune to top 2*TOP_K every 500 combos to cap memory
    if (results.length > TOP_K * 2 && (i + 1) % 500 === 0) {
        results.sort(function (a, b) { return b.result.net - a.result.net; });
        results = results.slice(0, TOP_K * 2);
    }

    if ((i + 1) % 500 === 0 || i + 1 === combos.length) {
        var elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
        var eta     = elapsed / (i + 1) * (combos.length - i - 1);
        process.stderr.write(
            '  ' + (i + 1) + '/' + combos.length +
            '  elapsed ' + elapsed.toFixed(1) + 's' +
            (eta > 0.5 ? '  eta ~' + eta.toFixed(0) + 's' : '') +
            '          \r'
        );
    }
});

process.stderr.write('\n');
results.sort(function (a, b) { return b.result.net - a.result.net; });

// ── Baseline with current (unmodified) params ─────────────────────────────────

var origResult = runCombo(_origParams, N_DEALS * 5);

RC.log('\n Baseline (current btai-params.json):');
RC.log('   net=' + origResult.net.toFixed(2) +
    '  success=' + origResult.success_pct.toFixed(1) + '%' +
    '  avg_bid=' + origResult.avg_bid.toFixed(1));

// ── Top K report ──────────────────────────────────────────────────────────────

RC.log('\n Top ' + TOP_K + ' combinations:');
RC.log(
    ' ' + 'rank'.padStart(4) +
    '  ' + 'net'.padStart(6) +
    '  ' + 'ok%'.padStart(5) +
    '  avg_bid' +
    '  minOpen' +
    '  scStep' +
    '  raisDiv' +
    '  raisCap' +
    '  swThr' +
    '  swMrg'
);
RC.log(' ' + '-'.repeat(80));

results.slice(0, TOP_K).forEach(function (item, rank) {
    var p = item.params;
    var r = item.result;
    RC.log(
        ' ' + String(rank + 1).padStart(4) +
        '  ' + r.net.toFixed(2).padStart(6) +
        '  ' + r.success_pct.toFixed(1).padStart(4) + '%' +
        '  ' + r.avg_bid.toFixed(1).padStart(7) +
        '  ' + String(p.minScoreToOpen).padStart(7) +
        '  ' + String(p.scorePerStep).padStart(6) +
        '  ' + String(p.raiseDivisor).padStart(7) +
        '  ' + String(p.raiseCap).padStart(7) +
        '  ' + String(p.suitSwitchThreshold).padStart(5) +
        '  ' + String(p.suitSwitchMargin).padStart(5)
    );
});

// ── Validate winner with more deals ───────────────────────────────────────────

var best = results[0];
RC.log('\n Validating best params with ' + (N_DEALS * 5) + ' deals...');
var validation = runCombo(best.params, N_DEALS * 5);
RC.log('   net=' + validation.net.toFixed(2) +
    '  success=' + validation.success_pct.toFixed(1) + '%' +
    '  avg_bid=' + validation.avg_bid.toFixed(1));

var delta = validation.net - origResult.net;
RC.log('   delta vs baseline: ' + (delta >= 0 ? '+' : '') + delta.toFixed(2) + ' pts/deal');

// ── Write if requested ────────────────────────────────────────────────────────

if (DO_WRITE) {
    var jsonPath = path.join(__dirname, 'scripts', 'btai-params.json');
    var raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    raw.coinche.bid.minScoreToOpen             = best.params.minScoreToOpen;
    raw.coinche.bid.scorePerStep               = best.params.scorePerStep;
    raw.coinche.complement.raiseDivisor        = best.params.raiseDivisor;
    raw.coinche.complement.raiseCap            = best.params.raiseCap;
    raw.coinche.complement.suitSwitchThreshold = best.params.suitSwitchThreshold;
    raw.coinche.complement.suitSwitchMargin    = best.params.suitSwitchMargin;
    fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 4) + '\n');
    RC.log('\n btai-params.json updated.');
}

RC.log('\n Best params:');
Object.keys(best.params).forEach(function (k) { RC.log('   ' + k + ' = ' + best.params[k]); });
RC.log('');
