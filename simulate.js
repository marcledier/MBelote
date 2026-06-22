/*
 * Coinche simulation — runs N deals headlessly and reports stats.
 * Usage: node simulate.js [--deals N] [--verbose] [--belote]
 */
"use strict";

var fs   = require('fs');
var path = require('path');
var vm   = require('vm');

// ── jQuery / DOM stub on global ───────────────────────────────────────────────

var _triggerStack = [];
var _docHandlers  = {};

var _noopPromise = { then: function () { return _noopPromise; } };
var _fakeEl = {
    addEventListener: function () {},
    removeEventListener: function () {},
    appendChild:   function () { return _fakeEl; },
    querySelector: function () { return _fakeEl; },
    querySelectorAll: function () { return { forEach: function () {} }; },
    cloneNode:     function () { return _fakeEl; },
    insertAdjacentHTML: function () {},
    animate: function () { return { finished: _noopPromise }; },
    getAnimations: function () { return []; },
    remove:  function () {},
    removeAttribute: function () {},
    setAttribute: function () {},
    getAttribute: function () { return null; },
    style:   {},
    classList: { add: function(){}, remove: function(){} },
    offsetWidth: 0, offsetHeight: 0, offsetTop: 0,
    clientWidth: 300, clientHeight: 300,
    innerHTML: '',
    textContent: '',
    checked: false,
    value: '',
    id: ''
};

var _docEl = {
    addEventListener: function (ev, fn) { _docHandlers[ev] = fn; },
    removeEventListener: function () {},
    dispatchEvent: function (e) { _triggerStack.push(e.type || e); },
    getElementById: function () { return _fakeEl; },
    createElement:  function () { return Object.assign({}, _fakeEl); },
    querySelectorAll: function () { return { forEach: function () {} }; }
};

function _$(sel) {
    if (sel === ':mobile-pagecontainer') return { pagecontainer: function () {} };
    return _fakeEl;
}
_$.proxy    = function (fn, ctx) { return fn.bind(ctx); };
_$.each     = function (arr, fn) {
    if (Array.isArray(arr)) { arr.forEach(function (v, i) { fn(i, v); }); }
    else { Object.keys(arr).forEach(function (k) { fn(k, arr[k]); }); }
};
_$.grep     = function (arr, fn) { return arr.filter(fn); };
_$.isNumeric = function (v) { return !isNaN(parseFloat(v)) && isFinite(v); };

// Expose on global so vm scripts can see it
global.$          = _$;
global.document   = _docEl;
global.window     = { innerWidth: 800, innerHeight: 600, addEventListener: function(){} };
global.alert      = function (msg) { console.warn('[alert]', msg); };
global.console    = console;

// localStorage stub
global.localStorage = {
    _data: {},
    getItem:  function (k) { return this._data[k] || null; },
    setItem:  function (k, v) { this._data[k] = String(v); }
};

// Override setTimeout to be synchronous — all delays are 0 in simulation anyway
global.setTimeout = function (fn) { fn(); };
global.clearTimeout = function () {};

function loadScript(file) {
    var code = fs.readFileSync(path.join(__dirname, 'scripts', file), 'utf8');
    if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1); // strip BOM
    // Remove $(document).ready(…) — we instantiate BtMain ourselves
    code = code.replace(/\$\s*\(\s*document\s*\)\s*\.ready\s*\([\s\S]*$/g, '');
    vm.runInThisContext(code, { filename: file });
}

loadScript('btcarte.js');
// Provide BtAIParams from the JSON file (btai.js uses XHR which doesn't work in Node)
global.BtAIParams = JSON.parse(fs.readFileSync(path.join(__dirname, 'scripts', 'btai-params.json'), 'utf8'));
global.window.BtAIParams = global.BtAIParams;
loadScript('btjoueur.js');
loadScript('btpli.js');
loadScript('BtMain.js');

// ── Synchronous event pump ────────────────────────────────────────────────────

function pump() {
    var limit = 200000;
    while (_triggerStack.length > 0 && limit-- > 0) {
        var ev = _triggerStack.shift();
        if (ev === '__done__') { _triggerStack.length = 0; return; }
        if (_docHandlers[ev]) _docHandlers[ev]();
    }
    if (limit <= 0) throw new Error('Event pump runaway — last event: ' + _triggerStack[0]);
}

// Stub Event constructor so dispatchEvent(new Event('name')) works
global.Event = function(type) { this.type = type; };

// ── CLI args ──────────────────────────────────────────────────────────────────

var cliArgs = process.argv.slice(2);
var N_DEALS = 500;
var VERBOSE = false;
var COINCHE = true;

for (var i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === '--deals' && cliArgs[i+1]) N_DEALS = parseInt(cliArgs[++i]);
    if (cliArgs[i] === '--verbose') VERBOSE = true;
    if (cliArgs[i] === '--belote')  COINCHE = false;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

var stats = {
    deals:      0,
    redeals:    0,
    successes:  0,
    failures:   0,
    bids:       {},
    chutes:     {},
    total_bid:  0,
    total_pts:  0
};

// ── Run ───────────────────────────────────────────────────────────────────────

BtMain.prototype.BTDELAY = 0;
BtMain.c_humanplayer     = -1;  // all-AI, fast mode
BtMain.c_test_betloop    = false;

global.localStorage.setItem('mlrdev.belote.btoptions', JSON.stringify({
    btdelay: 0, btcardwidth: 100,
    btjeuauto: true, btcoinche: COINCHE,
    btautolast: false, btautouniq: false, btsenshoraire: false
}));

var game = new BtMain();

// Patch affichepagescores to intercept results without page navigation
game.affichepagescores = function (msg) {
    if (COINCHE) {
        var hasBid = (game.m_pari && game.m_pari.couleur >= 0 && game.m_pari.point > 0);
        if (hasBid) {
            var eqp     = game.m_preneurid % 2;
            var pts     = game.m_donne.points[eqp];
            var contrat = game.m_pari.point;
            var ok      = (pts >= contrat);

            stats.deals++;
            stats.total_bid += contrat;
            stats.total_pts += pts;
            stats.bids[contrat]  = (stats.bids[contrat]  || 0) + 1;
            if (!ok) stats.chutes[contrat] = (stats.chutes[contrat] || 0) + 1;
            if (ok) stats.successes++; else stats.failures++;

            if (VERBOSE) {
                console.log('deal %d  %s bid=%d got=%d %s',
                    stats.deals, ['NS','EO'][eqp], contrat, pts, ok ? 'OK' : 'CHUTE');
            }
        } else {
            stats.redeals++;
        }
    } else {
        stats.deals++;
    }

    if (stats.deals < N_DEALS) {
        _triggerStack.push('btnouvelledonne');
    } else {
        _triggerStack.push('__done__');
    }
};

// Kick off
pump();

// Guard against getting stuck in all-pass loops
var guard = N_DEALS * 5;
while (stats.deals < N_DEALS && guard-- > 0) {
    _triggerStack.push('btnouvelledonne');
    pump();
}

// ── Report ────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════');
console.log(' Simulation  coinche=' + COINCHE + '  deals=' + stats.deals);
console.log('═══════════════════════════════════════════════');
if (COINCHE) {
    var pct = function (n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '-'; };
    console.log(' All-passed (redeal) : ' + stats.redeals);
    console.log(' Successful contracts: ' + stats.successes + ' (' + pct(stats.successes, stats.deals) + ')');
    console.log(' Failed (chutes)     : ' + stats.failures  + ' (' + pct(stats.failures,  stats.deals) + ')');
    console.log(' Avg bid level       : ' + (stats.total_bid / stats.deals).toFixed(1));
    console.log(' Avg pts for preneur : ' + (stats.total_pts / stats.deals).toFixed(1));
    console.log('\n Bid level  | count |  chutes | chute%  | bar');
    console.log(' -----------+-------+---------+---------+' + '-'.repeat(30));
    var levels = Object.keys(stats.bids).map(Number).sort(function (a, b) { return a - b; });
    levels.forEach(function (lvl) {
        var total  = stats.bids[lvl];
        var chute  = stats.chutes[lvl] || 0;
        var cpct   = (100 * chute / total).toFixed(1);
        var bar    = '█'.repeat(Math.round(total / stats.deals * 30));
        console.log(' ' + String(lvl).padStart(9) + '  | '
            + String(total).padStart(5) + ' | '
            + String(chute).padStart(7) + ' | '
            + String(cpct).padStart(6) + '% | '
            + bar);
    });
}
console.log('');
