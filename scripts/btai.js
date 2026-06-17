// Loads btai-params.json before the game starts and exposes window.BtAIParams.
// All other scripts read from BtAIParams — never from the JSON directly.

window.BtAIParams = null;

(function () {
    const script = document.currentScript;
    const base = script ? script.src.replace(/[^/]+$/, '') : 'scripts/';

    const req = new XMLHttpRequest();
    req.open('GET', base + 'btai-params.json', false); // synchronous so classes below can use it immediately
    req.send();
    if (req.status === 200) {
        window.BtAIParams = JSON.parse(req.responseText);
    } else {
        console.warn('[btai] Could not load btai-params.json (status ' + req.status + ') — using built-in defaults.');
    }
})();
