// Shared constants — loaded first, available to all scripts
const SUIT_NAMES   = ["Pique", "Coeur", "Carreau", "Trèfle"];
const SUIT_ABBREV  = ["Pi", "Co", "Ca", "Tr"];
const SUIT_SYMBOLS = ["s", "h", "d", "c"];
const CARD_VALUES  = ["7", "8", "9", "10", "V", "D", "R", "As"];
const CARD_FILESUF = ["7", "8", "9", "10", "11", "12", "13", "1"];
const PLAYER_NAMES = ["Sud", "Est", "Nord", "Ouest"];
const TOTAL_POINTS     = 152;
const CAPOT_BONUS      = 100;
const BELOTE_BONUS     = 20;
const LAST_TRICK_BONUS = 10;

class BtMain {
    // ── Static config (replaces BtMain.prototype.X and BtMain.c_X) ────────────
    static c_humanplayer  = BtAIParams?.game?.humanPlayer  ?? 0;
    static c_test_betloop = BtAIParams?.game?.testBetloop  ?? false;
    static BTDELAY        = 800;
    static BTSCOREFINAL   = BtAIParams?.game?.scoreFinal   ?? 1000;
    static BTSENSINVERSE  = false;
    static BTAUTOPLAYLAST = false;
    static BTAUTOPLAYUNIQ = false;
    static BTCOINCHE      = false;
    static BTFULLAUTO     = false;

    constructor() {
        // Event bindings
        document.addEventListener("btnouvellepartie",  () => this.nouvellepartie());
        document.addEventListener("btnouvelledonne",   () => this.nouvelledonne());
        document.addEventListener("btsecondedonne",    () => this.secondedonne());
        document.addEventListener("btfindedonne",      () => this.findedonne());
        document.addEventListener("btfindepli",        () => this.findepli());
        document.addEventListener("btplayloop",        () => this.playloop());
        document.addEventListener("btbetloop",         () => this.betloop());
        document.addEventListener("btbetloopcoinche",  () => this.betloopcoinche());
        document.addEventListener("btdemarrecoinche",  () => this.demarrecoinche());

        document.getElementById('btreplaydeal')  .addEventListener('click', () => this.replaydeal());
        document.getElementById('btplateauplis') .addEventListener('click', e  => this.clicktapis(e));
        document.getElementById('btcartessud')   .addEventListener('click', e  => this.clickcartesud(e));
        document.getElementById('btvalidateoptions').addEventListener('click', () => this.validateoptions());
        document.getElementById('btcoinche').addEventListener('change', function() {
            const row = document.getElementById('btdefensepointsrow');
            if (row) row.style.display = this.checked ? '' : 'none';
        });
        document.getElementById('btretourjeu')   .addEventListener('click', () => this.retourjeu());
        document.getElementById('btquitterpartie').addEventListener('click', () => { this.m_findepartie = true; this.retourjeu(); });
        document.getElementById('btrejouerdonne').addEventListener('click', () => this.replaydeal());
        document.getElementById('bthintbtn').addEventListener('click', () => {
            if (!this.m_hintcarte) return;
            const img = this.m_hintcarte.m_image;
            img.style.boxShadow = '0 0 0 4px gold, 0 0 16px 6px gold';
            setTimeout(() => { img.style.boxShadow = ''; }, 2000);
        });
        window.addEventListener('beforeunload', () => this.sauveretatdujeu());

        this.creationjeu();
        this.reprisedujeu();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    _scheduleEvent(name, delay) {
        const d = (delay !== undefined ? delay : BtMain.BTDELAY);
        setTimeout(() => document.dispatchEvent(new Event(name)), d);
    }

    _getBoardDimensions() {
        const el = document.getElementById('btplateauplis');
        return { w: el.clientWidth || el.offsetWidth, h: el.clientHeight || el.offsetHeight };
    }

    _getPlayerPosition(playerId, tapisw, tapish, elW, elH) {
        switch (playerId) {
            case 0: return { top: tapish - elH - 10,                        left: (tapisw + BtCarte.CARTEWIDTH) / 2 };
            case 1: return { top: (tapish - BtCarte.CARTEWIDTH * 1.45) / 2 - elH, left: tapisw - elW - 4 };
            case 2: return { top: 0,                                         left: (tapisw - BtCarte.CARTEWIDTH) / 2 - elW };
            case 3: return { top: (tapish + BtCarte.CARTEWIDTH * 1.45) / 2, left: 0 };
            default: return { top: 0, left: 0 };
        }
    }

    // ── Initialisation ─────────────────────────────────────────────────────────

    creationjeu() {
        this.m_cartes       = [];
        this.m_joueurs      = [];
        this.m_chargerdonne = false;
        this.m_waitforuser  = false;

        this.applyoptions();

        const version = BtAIParams?.game?.version ?? '';
        if (version) document.querySelectorAll('.bt-footer-text').forEach(el => el.textContent = version);

        for (let ind1 = 0; ind1 < 4; ind1++) {
            for (let ind2 = 0; ind2 < 8; ind2++) {
                this.m_cartes.push(new BtCarte(ind1, ind2));
            }
            this.m_joueurs.push(new BtJoueur(ind1));
        }

        const a = document.createElement('a');
        a.className = 'ui-btn ui-icon-user ui-btn-icon-notext';
        this.m_donneuricon = a;
        document.getElementById('btplateauplis').appendChild(this.m_donneuricon);
    }

    ishumanplayer() {
        return this.m_donne.playerid === BtMain.c_humanplayer;
    }

    // ── Game flow ──────────────────────────────────────────────────────────────

    nouvellepartie() {
        if (this.m_plis === undefined) {
            this.m_plis = [];
        } else {
            this.ramasserCartes();
        }
        this.melangerCartes(Math.floor(Math.random() * 30 + 3));
        this.m_totaux      = [0, 0];
        this.m_findepartie = false;
        this.m_donneurid   = Math.floor(Math.random() * 4);

        this.displaybulleinfo("Nouvelle partie");

        document.getElementById('btretourjeu').textContent  = 'Donne suivante';
        document.getElementById('btquitterpartie').style.display = '';

        this._scheduleEvent('btnouvelledonne');
    }

    ramasserCartes() {
        if (this.m_suggestionatout) {
            this.m_cartes.push(this.m_suggestionatout);
            this.m_suggestionatout = null;
        }
        this.m_joueurs.forEach(joueur => {
            joueur.m_cartesparcouleur.forEach(arclr => {
                while (arclr.length) this.m_cartes.push(arclr.pop());
            });
        });
        while (this.m_plis.length) {
            const pli = this.m_plis.pop();
            while (pli.m_cartes.length) this.m_cartes.push(pli.m_cartes.pop());
        }
        this.m_cartes.forEach(carte => carte.masquer());
        if (this.m_cartes.length !== 32) alert("La restauration a échoué !");
    }

    couperJeu() {
        const icoupe = Math.floor(6 + Math.random() * 20);
        this.m_cartes = this.m_cartes.slice(icoupe).concat(this.m_cartes.slice(0, icoupe));
    }

    nouvelledonne() {
        this.displaybulleinfo("Nouvelle donne");
        this.clearencherecourante();
        this.clearlogenchere();
        this.ramasserCartes();

        if (this.m_chargerdonne) {
            this.chargerdonne();
            this.m_chargerdonne = false;
        } else {
            this.couperJeu();
            this.sauverdonne();
        }

        if (this.m_preneuricon) this.m_preneuricon.remove();

        this.m_donne = { playerid: 2, points: [0, 0], betturn: 0, couleurjouees: [0, 0, 0, 0], fin: false };
        this.updatescores();
        this.m_pari = { point: -1, couleur: -1, doubled: 0 };

        this.m_donne.playerid = this.m_donneurid;
        this.joueursuivant();
        this.m_donneurid = this.m_donne.playerid;
        this.displaydonneuricon();

        let vtrigger;
        if (BtMain.BTCOINCHE) {
            // Standard Coinche dealing: 5 cards then 3 cards
            for (let indx = 0; indx < 4; indx++) { this.joueursuivant(); this.distribuer(5); }
            for (let indx = 0; indx < 4; indx++) { this.joueursuivant(); this.distribuer(3); }
            vtrigger = "btbetloopcoinche";
        } else {
            for (let nbcard = 3; nbcard >= 2; nbcard--) {
                for (let indx = 0; indx < 4; indx++) { this.joueursuivant(); this.distribuer(nbcard); }
            }
            this.m_suggestionatout = this.m_cartes.pop();
            this.m_suggestionatout.afficher(9);
            vtrigger = "btbetloop";
        }

        this.m_donne.playerid = this.m_donneurid;
        this.joueursuivant();
        this._scheduleEvent(vtrigger);
    }

    distribuer(nbcarte) {
        for (let idcrt = 0; idcrt < nbcarte; idcrt++) {
            this.m_joueurs[this.m_donne.playerid].addcarte(this.m_cartes.pop());
        }
        if (this.ishumanplayer()) {
            this.m_joueurs[this.m_donne.playerid].affichercartes();
        }
    }

    melangerCartes(nbiter) {
        if (this.c_trace & 4) {
            this.m_donneur = this.m_joueurs[BtMain.c_humanplayer];
        } else {
            for (let i = 0; i < nbiter; i++) {
                const cards = [];
                let lng;
                while ((lng = this.m_cartes.length)) {
                    cards.push(this.m_cartes.splice(Math.floor(Math.random() * lng), 1)[0]);
                }
                this.m_cartes = cards;
            }
        }
    }

    joueursuivant() {
        this.m_donne.playerid = BtMain.BTSENSINVERSE
            ? (this.m_donne.playerid + 3) % 4
            : (this.m_donne.playerid + 1) % 4;
    }

    // ── Display helpers ────────────────────────────────────────────────────────

    displaypreneuricon() {
        const elW    = this.m_donneuricon.offsetWidth;
        const elH    = this.m_donneuricon.offsetHeight;
        const { w: tapisw, h: tapish } = this._getBoardDimensions();

        const img = document.createElement('img');
        img.style.position = 'absolute';
        img.src    = `./cartes/att${this.m_pari.couleur}.png`;
        img.width  = elW;
        img.height = elH;
        img.style.left = (tapisw / 2) + 'px';
        img.style.top  = (tapish / 2) + 'px';
        document.getElementById('btplateauplis').appendChild(img);
        this.m_preneuricon = img;

        // Same as _getPlayerPosition but with donneur-offset adjustment
        let top, left;
        switch (this.m_preneurid) {
            case 0:
                left = (tapisw + BtCarte.CARTEWIDTH) / 2;
                top  = tapish - elH - 10 + (this.m_donneurid === 0 ? -elW : 0);
                break;
            case 1:
                left = tapisw - elW - 4 + (this.m_donneurid === 1 ? -elH : 0);
                top  = (tapish - BtCarte.CARTEWIDTH * 1.45) / 2 - elH;
                break;
            case 2:
                left = (tapisw - BtCarte.CARTEWIDTH) / 2 - elW;
                top  = 0 + (this.m_donneurid === 2 ? elW : 0);
                break;
            case 3:
                left = 0 + (this.m_donneurid === 2 ? elH : 0);
                top  = (tapish + BtCarte.CARTEWIDTH * 1.45) / 2;
                break;
            default:
                top = 0; left = 0;
        }
        img.animate(
            [{ top: img.style.top, left: img.style.left }, { top: top + 'px', left: left + 'px' }],
            { duration: 400, fill: 'forwards', easing: 'ease' }
        ).finished.then(() => { img.style.top = top + 'px'; img.style.left = left + 'px'; });
    }

    displaydonneuricon() {
        const elW = this.m_donneuricon.offsetWidth;
        const elH = this.m_donneuricon.offsetHeight;
        const { w: tapisw, h: tapish } = this._getBoardDimensions();
        const { top, left } = this._getPlayerPosition(this.m_donneurid, tapisw, tapish, elW, elH);
        this.m_donneuricon.animate(
            [{ top: (this.m_donneuricon.style.top  || '0px'), left: (this.m_donneuricon.style.left || '0px') },
             { top: top + 'px', left: left + 'px' }],
            { duration: 400, fill: 'forwards', easing: 'ease' }
        ).finished.then(() => { this.m_donneuricon.style.top = top + 'px'; this.m_donneuricon.style.left = left + 'px'; });
    }

    displaybulleinfo(msg) {
        const board = document.getElementById('btplateauplis');
        const tmpbtn = document.createElement('a');
        tmpbtn.style.cssText = 'position:absolute;z-index:99;background-color:orange';
        tmpbtn.className = 'ui-btn ui-corner-all';
        tmpbtn.textContent = msg;
        board.appendChild(tmpbtn);

        const tmpwdt = tmpbtn.offsetWidth;
        const tmphgt = tmpbtn.offsetHeight;
        const { w: tapisw, h: tapish } = this._getBoardDimensions();
        const jid = (this.m_donne ? this.m_donne.playerid : 2);

        tmpbtn.style.left = (jid % 2 === 0 ? (tapisw - tmpwdt) / 2 : jid === 1 ? tapisw - tmpwdt - 4 : 2) + 'px';
        tmpbtn.style.top  = (jid % 2 === 1 ? (tapish - tmphgt) / 2 : jid === 0 ? tapish - tmphgt - 10 : 0) + 'px';

        setTimeout(() => {
            tmpbtn.animate([{ opacity: 1 }, { opacity: 0 }],
                { duration: Math.round(0.2 * BtMain.BTDELAY), fill: 'forwards' }
            ).finished.then(() => tmpbtn.remove());
        }, Math.round(1.2 * BtMain.BTDELAY));
    }

    showactionbutton(msg, act) {
        const board     = document.getElementById('btplateauplis');
        const actionbtn = document.createElement('a');
        actionbtn.id    = 'btactionbutton';
        actionbtn.style.cssText = 'position:absolute;background-color:darkblue;';
        actionbtn.className = 'ui-btn ui-corner-all';
        actionbtn.textContent = msg;
        board.appendChild(actionbtn);

        const { w: tapisw, h: tapish } = this._getBoardDimensions();
        actionbtn.style.left = ((tapisw - actionbtn.offsetWidth)  / 2) + 'px';
        actionbtn.style.top  = (tapish  - actionbtn.offsetHeight - 10) + 'px';

        const pxyaction = act.bind(this);
        actionbtn.addEventListener('click', event => {
            actionbtn.remove();
            pxyaction();
            event.stopPropagation();
        });
    }

    // ── Bidding — Belote ───────────────────────────────────────────────────────

    betloop() {
        if (this.m_donne.betturn >= 8) {
            this._scheduleEvent('btnouvelledonne');
        } else if (this.ishumanplayer()) {
            this.m_waitforuser = true;
            const btest = this.m_joueurs[this.m_donne.playerid].acceptatout(this.m_suggestionatout, this.m_donne.betturn < 4) >= 0;
            let stest = this.m_donne.betturn > 3 ? "Deux ?" : "Passe ?";
            if (btest) stest += "*";
            this.showactionbutton(stest, this.parisudpasse);
        } else {
            if (BtMain.c_test_betloop)
                this.m_pari.couleur = -1;
            else
                this.m_pari.couleur = this.m_joueurs[this.m_donne.playerid].acceptatout(this.m_suggestionatout, this.m_donne.betturn < 4);
            if (this.m_pari.couleur >= 0) {
                this._scheduleEvent('btsecondedonne');
            } else {
                this.displaybulleinfo(this.m_donne.betturn > 3 ? "Deux" : "Passe");
                this.m_donne.betturn++;
                this.joueursuivant();
                this._scheduleEvent('btbetloop');
            }
        }
    }

    parisudpasse() {
        this.m_waitforuser = false;
        this.displaybulleinfo(this.m_donne.betturn > 3 ? "Deux" : "Passe");
        this.m_donne.betturn++;
        this.joueursuivant();
        this._scheduleEvent('btbetloop');
    }

    secondedonne() {
        if (this.m_pari.couleur < 0) {
            alert("this.m_pari.couleur should be set before second deal !!");
            return;
        }
        this.displaybulleinfo(`${SUIT_NAMES[this.m_pari.couleur]} !`);
        this.m_preneurid = this.m_donne.playerid;
        this.displaypreneuricon();
        this.m_joueurs[this.m_preneurid].addcarte(this.m_suggestionatout);

        setTimeout(() => {
            this.m_suggestionatout.masquer();
            this.m_suggestionatout = null;

            this.m_donne.playerid = this.m_donneurid;
            for (let indx = 0; indx < 4; indx++) {
                this.joueursuivant();
                const joueur = this.m_joueurs[this.m_donne.playerid];
                const ncart  = this.m_donne.playerid === this.m_preneurid ? 2 : 3;
                for (let idcrt = 0; idcrt < ncart; idcrt++) joueur.addcarte(this.m_cartes.pop());
                joueur.m_fournitcolor = [true, true, true, true];
                joueur.checkbelote(this.m_pari.couleur);
            }

            this._setupAtoutSequences();
            if (this.ishumanplayer())
                this.m_joueurs[BtMain.c_humanplayer].affichercartes(this.m_pari.couleur);

            this.m_donne.playerid = this.m_donneurid;
            this.joueursuivant();
            this.m_pliencours = new BtPli(this.m_donne.playerid);
            this.m_plis.push(this.m_pliencours);
            document.dispatchEvent(new Event('btplayloop'));
        }, Math.round(0.6 * BtMain.BTDELAY));
    }

    // ── Bidding — Coinche ──────────────────────────────────────────────────────

    betloopcoinche() {
        const enoughpasses = (this.m_pari.couleur >= 0) ? 3 : 4;
        if (this.m_donne.betturn >= enoughpasses) {
            this.clearlogenchere();
            if (this.m_pari.couleur < 0) {
                this._scheduleEvent('btnouvelledonne');
            } else {
                this._scheduleEvent('btdemarrecoinche');
            }
            return;
        }
        if (this.ishumanplayer()) {
            this.m_waitforuser = true;
            this.showbidpanelcoinche();
        } else {
            const joueur = this.m_joueurs[this.m_donne.playerid];
            const isOpponentOfPreneur = this.m_pari.couleur >= 0 && (this.m_donne.playerid % 2) !== (this.m_preneurid % 2);
            const isPartnerOfPreneur  = this.m_pari.couleur >= 0 && (this.m_donne.playerid % 2) === (this.m_preneurid % 2) && this.m_donne.playerid !== this.m_preneurid;

            if (isOpponentOfPreneur && this.m_pari.doubled === 0 && joueur.shouldcoinche(this)) {
                this.m_pari.doubled = 1;
                this.m_donne.betturn = 0;
                this.displaybulleinfo("Coinche !");
                this.addlogenchere(this.m_donne.playerid, "Coinche !");
            } else if (isPartnerOfPreneur && this.m_pari.doubled === 1 && joueur.shouldsurcoinche(this)) {
                this.m_pari.doubled = 2;
                this.m_donne.betturn = 0;
                this.displaybulleinfo("Surcoinche !");
                this.addlogenchere(this.m_donne.playerid, "Surcoinche !");
            } else if (this.m_pari.doubled === 0) {
                const pari = joueur.paricoinche(this);
                if (pari.couleur >= 0) {
                    this.m_pari    = { ...pari, doubled: 0 };
                    this.m_preneurid = this.m_donne.playerid;
                    this.m_donne.betturn = 0;
                    const label = `${SUIT_NAMES[pari.couleur]} ${pari.point}`;
                    this.displaybulleinfo(label);
                    this.displayencherecourante();
                    this.addlogenchere(this.m_donne.playerid, label);
                } else {
                    this.displaybulleinfo("Passe");
                    this.m_donne.betturn++;
                    this.addlogenchere(this.m_donne.playerid, "Passe");
                }
            } else {
                // doubled >= 1 and this player can't coinche/surcoinche: forced pass
                this.displaybulleinfo("Passe");
                this.m_donne.betturn++;
                this.addlogenchere(this.m_donne.playerid, "Passe");
            }
            this.joueursuivant();
            this._scheduleEvent('btbetloopcoinche');
        }
    }

    parisudpassecoinche() {
        this.m_waitforuser = false;
        this.addlogenchere(this.m_donne.playerid, "Passe");
        this.displaybulleinfo("Passe");
        this.m_donne.betturn++;
        this.joueursuivant();
        this._scheduleEvent('btbetloopcoinche');
    }

    showbidpanelcoinche() {
        const minbid = (this.m_pari.point > 0 ? this.m_pari.point + 10 : 80);
        const bids   = [80, 90, 100, 110, 120, 130, 140, 150, 160];
        const bidData = {};

        const panel = document.createElement('div');
        panel.id = 'btcoinchebidpanel';
        panel.style.cssText = 'position:absolute;z-index:100;background:rgba(0,0,50,0.92);border-radius:8px;padding:8px;color:white;font-size:13px;';
        document.getElementById('btplateauplis').appendChild(panel);

        // Suit and bid rows only make sense when the contract hasn't been doubled yet
        if (this.m_pari.doubled === 0) {
            // Suit buttons
            const suitrow = document.createElement('div');
            suitrow.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;justify-content:center';
            SUIT_NAMES.forEach((name, idx) => {
                const btn = document.createElement('button');
                btn.style.cssText = 'flex:1;padding:4px 6px;cursor:pointer;border-radius:4px;border:none;background:#336;color:white;font-weight:bold';
                btn.textContent = name;
                btn.className = 'btsuit-btn';
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    panel.querySelectorAll('.btsuit-btn').forEach(b => { b.style.background = '#336'; });
                    btn.style.background = '#c80';
                    bidData.selsuit = idx;
                });
                suitrow.appendChild(btn);
            });
            panel.appendChild(suitrow);

            // Bid value buttons
            const bidrow = document.createElement('div');
            bidrow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;justify-content:center';
            bids.forEach(val => {
                const disabled = val < minbid;
                const btn = document.createElement('button');
                btn.style.cssText = `padding:4px 8px;border-radius:4px;border:none;cursor:pointer;${disabled ? 'background:#444;color:#888;' : 'background:#336;color:white;'}`;
                btn.textContent = val;
                if (!disabled) {
                    btn.className = 'btbid-btn';
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        panel.querySelectorAll('.btbid-btn').forEach(b => { b.style.background = '#336'; });
                        btn.style.background = '#c80';
                        bidData.selbid = val;
                    });
                }
                bidrow.appendChild(btn);
            });
            panel.appendChild(bidrow);
        }

        // Confirm + Passe + optional Coinche/Surcoinche
        const actrow = document.createElement('div');
        actrow.style.cssText = 'display:flex;gap:6px;justify-content:center';

        const confirmbtn = document.createElement('button');
        confirmbtn.style.cssText = 'padding:5px 14px;border-radius:4px;border:none;background:#080;color:white;font-weight:bold;cursor:pointer';
        confirmbtn.textContent = 'Annoncer';
        confirmbtn.addEventListener('click', e => {
            e.stopPropagation();
            if (bidData.selsuit === undefined || bidData.selbid === undefined) return;
            panel.remove();
            this.m_waitforuser = false;
            this.m_pari      = { couleur: bidData.selsuit, point: bidData.selbid, doubled: 0 };
            this.m_preneurid = this.m_donne.playerid;
            this.m_donne.betturn = 0;
            const announced = `${SUIT_NAMES[bidData.selsuit]} ${bidData.selbid}`;
            this.addlogenchere(this.m_donne.playerid, announced);
            this.displaybulleinfo(announced);
            this.displayencherecourante();
            this.joueursuivant();
            this._scheduleEvent('btbetloopcoinche');
        });

        const passebtn = document.createElement('button');
        passebtn.style.cssText = 'padding:5px 14px;border-radius:4px;border:none;background:#800;color:white;font-weight:bold;cursor:pointer';
        passebtn.textContent = 'Passe';
        passebtn.addEventListener('click', e => { e.stopPropagation(); panel.remove(); this.parisudpassecoinche(); });

        actrow.appendChild(passebtn);

        // Confirm button only when no coinche has been announced yet
        if (this.m_pari.doubled === 0) actrow.appendChild(confirmbtn);

        // Coinche button: human is opponent of preneur and contract is not yet doubled
        const humanIsOpponent = this.m_pari.couleur >= 0 && (BtMain.c_humanplayer % 2) !== (this.m_preneurid % 2);
        if (humanIsOpponent && this.m_pari.doubled === 0) {
            const coinchebtn = document.createElement('button');
            coinchebtn.style.cssText = 'padding:5px 14px;border-radius:4px;border:none;background:#660;color:white;font-weight:bold;cursor:pointer';
            coinchebtn.textContent = 'Coinche !';
            coinchebtn.addEventListener('click', e => {
                e.stopPropagation();
                panel.remove();
                this.m_waitforuser = false;
                this.m_pari.doubled = 1;
                this.m_donne.betturn = 0;
                this.addlogenchere(this.m_donne.playerid, "Coinche !");
                this.displaybulleinfo("Coinche !");
                this.joueursuivant();
                this._scheduleEvent('btbetloopcoinche');
            });
            actrow.appendChild(coinchebtn);
        }

        // Surcoinche button: human is partner of preneur and contract is already doubled
        const humanIsPartner = this.m_pari.couleur >= 0 && BtMain.c_humanplayer !== this.m_preneurid && (BtMain.c_humanplayer % 2) === (this.m_preneurid % 2);
        if (humanIsPartner && this.m_pari.doubled === 1) {
            const surcoinchebtn = document.createElement('button');
            surcoinchebtn.style.cssText = 'padding:5px 14px;border-radius:4px;border:none;background:#660;color:white;font-weight:bold;cursor:pointer';
            surcoinchebtn.textContent = 'Surcoinche !';
            surcoinchebtn.addEventListener('click', e => {
                e.stopPropagation();
                panel.remove();
                this.m_waitforuser = false;
                this.m_pari.doubled = 2;
                this.m_donne.betturn = 0;
                this.addlogenchere(this.m_donne.playerid, "Surcoinche !");
                this.displaybulleinfo("Surcoinche !");
                this.joueursuivant();
                this._scheduleEvent('btbetloopcoinche');
            });
            actrow.appendChild(surcoinchebtn);
        }

        // Conseil ? hint button
        const hintbtn = document.createElement('button');
        hintbtn.style.cssText = 'padding:4px 9px;border-radius:50%;border:none;background:rgba(0,80,0,0.6);color:white;font-weight:bold;font-size:14px;cursor:pointer;opacity:0.7;';
        hintbtn.textContent = '?';
        hintbtn.addEventListener('click', e => {
            e.stopPropagation();
            const humanJoueur = this.m_joueurs[BtMain.c_humanplayer];
            let hint;
            const humanIsPartner = this.m_pari.couleur >= 0 && BtMain.c_humanplayer !== this.m_preneurid && (BtMain.c_humanplayer % 2) === (this.m_preneurid % 2);
            const humanIsOpponent = this.m_pari.couleur >= 0 && (BtMain.c_humanplayer % 2) !== (this.m_preneurid % 2);
            if (this.m_pari.doubled === 1 && humanIsPartner) {
                hint = humanJoueur.shouldsurcoinche(this) ? 'Surcoinche !' : 'Passe';
            } else if (this.m_pari.doubled === 0 && humanIsOpponent && humanJoueur.shouldcoinche(this)) {
                hint = 'Coinche !';
            } else if (this.m_pari.doubled === 0) {
                const pari = humanJoueur.paricoinche(this);
                hint = pari.couleur >= 0 ? `${SUIT_NAMES[pari.couleur]} ${pari.point}` : 'Passe';
            } else {
                hint = 'Passe';
            }
            let lbl = panel.querySelector('.bthintlabel');
            if (!lbl) {
                lbl = document.createElement('div');
                lbl.className = 'bthintlabel';
                lbl.style.cssText = 'text-align:center;color:#8f8;margin-top:6px;font-size:12px;font-weight:bold;';
                panel.appendChild(lbl);
            }
            lbl.textContent = 'IA : ' + hint;
            clearTimeout(lbl._t);
            lbl._t = setTimeout(() => { lbl.textContent = ''; }, 3000);
        });
        actrow.appendChild(hintbtn);

        panel.appendChild(actrow);

        const { w: tapisw, h: tapish } = this._getBoardDimensions();
        setTimeout(() => {
            panel.style.left = ((tapisw - panel.offsetWidth) / 2) + 'px';
            panel.style.top  = (tapish - panel.offsetHeight - 8) + 'px';
        }, 0);
    }

    demarrecoinche() {
        if (this.m_pari.couleur < 0) return;
        this.clearencherecourante();
        this.displaybulleinfo(`${SUIT_NAMES[this.m_pari.couleur]} ${this.m_pari.point} !`);
        this.displaypreneuricon();

        this.m_joueurs.forEach(joueur => {
            joueur.m_fournitcolor = [true, true, true, true];
            joueur.checkbelote(this.m_pari.couleur);
        });

        this._setupAtoutSequences();

        if (this.ishumanplayer())
            this.m_joueurs[BtMain.c_humanplayer].affichercartes(this.m_pari.couleur);

        this.m_donne.playerid = this.m_donneurid;
        this.joueursuivant();
        this.m_pliencours = new BtPli(this.m_donne.playerid);
        this.m_plis.push(this.m_pliencours);
        document.dispatchEvent(new Event('btplayloop'));
    }

    // Shared between secondedonne and demarrecoinche
    _setupAtoutSequences() {
        for (let clr = 0; clr < 4; clr++) {
            let cartes = [];
            this.m_joueurs.forEach(joueur => { cartes = cartes.concat(joueur.m_cartesparcouleur[clr]); });
            cartes.forEach(carte => { carte.m_isatout = (carte.m_couleur === this.m_pari.couleur); });
            cartes.sort((c1, c2) => c1.comparevaleur(c2));
            for (let i = 1; i < cartes.length; i++) {
                cartes[i].m_infcarte     = cartes[i - 1];
                cartes[i - 1].m_supcarte = cartes[i];
            }
            cartes[0].m_infcarte          = null;
            cartes[cartes.length - 1].m_supcarte = null;
        }
    }

    // ── Bid display ────────────────────────────────────────────────────────────

    addlogenchere(playerid, text) {
        if (!this.m_logenchere) {
            const div = document.createElement('div');
            div.id = 'btlogenchere';
            div.style.cssText = 'position:absolute;z-index:97;left:50%;top:30%;transform:translateX(-50%) translateY(-50%);background:rgba(0,0,0,0.65);color:white;font-size:11px;border-radius:4px;padding:4px 8px;line-height:1.8;white-space:nowrap;width:110px';
            document.getElementById('btplateauplis').appendChild(div);
            this.m_logenchere = div;
        }
        this.m_logenchere.insertAdjacentHTML('beforeend', `<div>${PLAYER_NAMES[playerid]} : ${text}</div>`);
    }

    clearlogenchere() {
        if (this.m_logenchere) { this.m_logenchere.remove(); this.m_logenchere = null; }
    }

    clearboard() {
        this.clearencherecourante();
        this.clearlogenchere();
        document.getElementById('btactionbutton')?.remove();
        document.getElementById('btcoinchebidpanel')?.remove();
        this.m_waitforuser = false;
    }

    displayencherecourante() {
        if (this.m_enchereicon) this.m_enchereicon.remove();
        if (this.m_pari.couleur < 0) return;

        const label = `${SUIT_NAMES[this.m_pari.couleur]} ${this.m_pari.point}`;
        const el = document.createElement('a');
        el.style.cssText = 'position:absolute;z-index:98;background-color:darkorange;font-size:12px';
        el.className = 'ui-btn ui-corner-all';
        el.textContent = label;
        document.getElementById('btplateauplis').appendChild(el);
        this.m_enchereicon = el;

        const { w: tapisw, h: tapish } = this._getBoardDimensions();
        const { top, left } = this._getPlayerPosition(this.m_preneurid, tapisw, tapish, el.offsetWidth, el.offsetHeight);
        el.style.top  = top  + 'px';
        el.style.left = left + 'px';
    }

    clearencherecourante() {
        if (this.m_enchereicon) { this.m_enchereicon.remove(); this.m_enchereicon = null; }
    }

    // ── Play loop ──────────────────────────────────────────────────────────────

    playloop() {
        if (this.m_pliencours.m_endofpli) {
            this._scheduleEvent('btfindepli');
        } else {
            let autoplay = !this.ishumanplayer() || BtMain.BTFULLAUTO;
            if (!autoplay && BtMain.BTAUTOPLAYLAST)
                autoplay = this.m_joueurs[BtMain.c_humanplayer].gethand().length === 1;
            if (!autoplay && BtMain.BTAUTOPLAYUNIQ) {
                const allowed = this.m_pliencours.cartesautorisees(this.m_joueurs[BtMain.c_humanplayer], this.m_pari.couleur);
                autoplay = allowed.length === 1;
            }
            if (!autoplay) {
                this.m_hintcarte = this.m_pliencours.meilleurecarte(this);
                document.getElementById('bthintbtn').style.display = '';
                this.m_waitforuser = true;
            } else {
                const bestcarte = this.m_pliencours.meilleurecarte(this);
                if (!bestcarte) { console.log("[playloop] meilleurecarte returned null"); return; }
                this.jouercarte(bestcarte);
                this._scheduleEvent('btplayloop');
            }
        }
    }

    findepli() {
        this.m_donne.points[this.m_pliencours.m_winnerid % 2] += this.m_pliencours.m_points;
        this.updatescores();
        this.m_pliencours.ramasser();
        if (this.m_plis.length === 8) {
            this.m_donne.fin = true;
            this._scheduleEvent('btfindedonne');
        } else {
            this.m_donne.playerid = this.m_pliencours.m_winnerid;
            this.m_pliencours     = new BtPli(this.m_donne.playerid);
            this.m_plis.push(this.m_pliencours);
            this._scheduleEvent('btplayloop');
        }
    }

    jouercarte(carte) {
        if (isNaN(this.m_donne.playerid) || this.m_pari.couleur < 0) return;
        const joueur = this.m_joueurs[this.m_donne.playerid];
        this.m_pliencours.pushcarte(joueur, carte, carte.m_couleur === this.m_pari.couleur);
        this.m_donne.couleurjouees[carte.m_couleur]++;
        if (joueur.m_belote > 0 && carte.m_couleur === this.m_pari.couleur && (carte.m_valeur === 5 || carte.m_valeur === 6)) {
            joueur.m_belote--;
            this.displaybulleinfo(joueur.m_belote ? "Belote" : "Rebelote");
        }
        if (this.ishumanplayer())
            this.m_joueurs[BtMain.c_humanplayer].affichercartes(this.m_pari.couleur);
        this.joueursuivant();
    }

    // ── Scoring ────────────────────────────────────────────────────────────────

    findedonne() {
        if (BtMain.BTCOINCHE) { this.findedonnecoinche(); return; }

        if (this.m_donne.points[0] + this.m_donne.points[1] !== TOTAL_POINTS) { console.log(" ??? "); return; }

        if      (this.m_donne.points[1] === 0) this.m_donne.points[0] += CAPOT_BONUS;
        else if (this.m_donne.points[0] === 0) this.m_donne.points[1] += CAPOT_BONUS;
        else    this.m_donne.points[this.m_pliencours.m_winnerid % 2] += LAST_TRICK_BONUS;

        let eqpbelote = -1;
        this.m_joueurs.forEach(joueur => { if (joueur.m_belote >= 0) eqpbelote = joueur.m_id % 2; });
        if (eqpbelote >= 0) this.m_donne.points[eqpbelote] += BELOTE_BONUS;

        this.m_donne.playerid = 2;
        let btmessage = PLAYER_NAMES[this.m_preneurid];
        const eqppreneur = this.m_preneurid % 2;

        if (this.m_donne.points[eqppreneur] > this.m_donne.points[1 - eqppreneur]) {
            this.m_totaux[0] += this.m_donne.points[0];
            this.m_totaux[1] += this.m_donne.points[1];
            if (this.m_litige > 0) { this.m_donne.points[eqppreneur] += this.m_litige; this.m_litige = -1; }
            btmessage += " a réussi son contrat";
        } else if (this.m_donne.points[eqppreneur] < this.m_donne.points[1 - eqppreneur]) {
            if (eqppreneur === eqpbelote) {
                this.m_totaux[1 - eqppreneur] += this.m_donne.points[1 - eqppreneur] + this.m_donne.points[eqppreneur] - BELOTE_BONUS;
                this.m_totaux[eqppreneur]     += BELOTE_BONUS;
            } else {
                this.m_totaux[1 - eqppreneur] += this.m_donne.points[1 - eqppreneur] + this.m_donne.points[eqppreneur];
            }
            if (this.m_litige > 0) { this.m_donne.points[1 - eqppreneur] += this.m_litige; this.m_litige = -1; }
            btmessage += " a chuté son contrat !";
        } else {
            this.m_totaux[1 - eqppreneur] += this.m_donne.points[1 - eqppreneur];
            this.m_litige = this.m_donne.points[eqppreneur];
            btmessage = "Les deux équipes sont à égalité (Litige)";
        }
        this.updatescores();
        this.affichepagescores(btmessage);
    }

    findedonnecoinche() {
        if (this.m_donne.points[0] + this.m_donne.points[1] !== TOTAL_POINTS) { console.log("findedonnecoinche: total points != 152"); return; }

        if      (this.m_donne.points[1] === 0) this.m_donne.points[0] += CAPOT_BONUS;
        else if (this.m_donne.points[0] === 0) this.m_donne.points[1] += CAPOT_BONUS;
        else    this.m_donne.points[this.m_pliencours.m_winnerid % 2] += LAST_TRICK_BONUS;

        let eqpbelote = -1;
        this.m_joueurs.forEach(joueur => { if (joueur.m_belote >= 0) eqpbelote = joueur.m_id % 2; });
        if (eqpbelote >= 0) this.m_donne.points[eqpbelote] += BELOTE_BONUS;

        const multiplier  = this.m_pari.doubled === 2 ? 4 : this.m_pari.doubled === 1 ? 2 : 1;
        const eqppreneur  = this.m_preneurid % 2;
        const contrat     = this.m_pari.point;
        const ptpreneur   = this.m_donne.points[eqppreneur];
        let btmessage     = PLAYER_NAMES[this.m_preneurid];
        const doubleSuffix = this.m_pari.doubled === 2 ? ' (surcoinché)' : this.m_pari.doubled === 1 ? ' (coinché)' : '';

        if (ptpreneur >= contrat) {
            this.m_totaux[eqppreneur]     += contrat * multiplier;
            if (BtMain.BTDEFENSEPOINTS)
                this.m_totaux[1 - eqppreneur] += this.m_donne.points[1 - eqppreneur] * multiplier;
            btmessage += ` a réussi son contrat (${contrat})${doubleSuffix}`;
        } else {
            const penalty = (160 + contrat) * multiplier;
            if (eqppreneur === eqpbelote) {
                this.m_totaux[1 - eqppreneur] += penalty;
                this.m_totaux[eqppreneur]     += BELOTE_BONUS;
            } else {
                this.m_totaux[1 - eqppreneur] += penalty;
            }
            btmessage += ` a chuté son contrat de ${contrat}${doubleSuffix} !`;
        }
        this.m_donne.playerid = 2;
        this.updatescores();
        this.affichepagescores(btmessage);
    }

    // ── Scores display ─────────────────────────────────────────────────────────

    updatescores() {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('btpnt0',  this.m_donne.points[0]);
        set('btpnt1',  this.m_donne.points[1]);
        set('bttot0',  this.m_totaux[0]);
        set('bttot1',  this.m_totaux[1]);
        set('btpnt0i', this.m_donne.points[0]);
        set('btpnt1i', this.m_donne.points[1]);
        set('bttot0i', this.m_totaux[0]);
        set('bttot1i', this.m_totaux[1]);
    }

    affichepagescores(msg) {
        this.m_findepartie = this.m_totaux[0] > BtMain.BTSCOREFINAL || this.m_totaux[1] > BtMain.BTSCOREFINAL;

        if (msg.length > 0) document.getElementById('btmsgresultat').innerHTML = `<h2>${msg}</h2>`;

        const msgel = document.getElementById('btmessagescores');
        msgel.innerHTML = '';
        if (this.m_findepartie) {
            msgel.insertAdjacentHTML('beforeend', '<h2>Partie terminée !</h2>');
            if      (this.m_totaux[0] > this.m_totaux[1]) msgel.insertAdjacentHTML('beforeend', "<h3>L'équipe Nord-Sud a gagné.</h3>");
            else if (this.m_totaux[0] < this.m_totaux[1]) msgel.insertAdjacentHTML('beforeend', "<h3>L'équipe Est-Ouest a gagné.</h3>");
            else                                           msgel.insertAdjacentHTML('beforeend', "<h3>Les deux équipes sont à égalité (!)</h3>");
            document.getElementById('btretourjeu').textContent         = 'Nouvelle partie';
            document.getElementById('btquitterpartie').style.display   = 'none';
        }
        const tbl = document.getElementById('btscoresfin');
        tbl.innerHTML = '';
        tbl.insertAdjacentHTML('beforeend', '<tr><th></th><th>Nord-Sud</th><th>Est-Ouest</th></tr>');
        tbl.insertAdjacentHTML('beforeend', `<tr><th>Partie</th><th>${this.m_donne.points[0]}</th><th>${this.m_donne.points[1]}</th></tr>`);
        tbl.insertAdjacentHTML('beforeend', `<tr><th>Total</th><th>${this.m_totaux[0]}</th><th>${this.m_totaux[1]}</th></tr>`);

        $(':mobile-pagecontainer').pagecontainer('change', '#btpage3', { transition: "pop" });
    }

    retourjeu() {
        setTimeout(() => {
            if (this.m_findepartie)       document.dispatchEvent(new Event('btnouvellepartie'));
            else if (this.m_donne.fin)    document.dispatchEvent(new Event('btnouvelledonne'));
            else                          this.displaybulleinfo('Retour au jeu');
        }, BtMain.BTDELAY);
        $(':mobile-pagecontainer').pagecontainer('change', '#btpage0', { transition: "fade" });
    }

    // ── Click handlers ─────────────────────────────────────────────────────────

    clicktapis(evt) {
        evt.stopPropagation();
        if (!this.m_waitforuser || !this.ishumanplayer() || this.m_donne.fin) return;
        if (this.m_suggestionatout) {
            if (evt.target === this.m_suggestionatout.m_image) {
                this.m_waitforuser = false;
                this.m_pari.couleur = this.m_suggestionatout.m_couleur;
                document.getElementById('btactionbutton')?.remove();
                document.dispatchEvent(new Event('btsecondedonne'));
            }
        } else {
            console.log(this.m_pliencours.meilleurecarte(this).displayname());
        }
    }

    clickcartesud(evt) {
        evt.stopPropagation();
        if (!this.m_waitforuser || !this.ishumanplayer()) return;
        const card = this.m_joueurs[BtMain.c_humanplayer].getclickedcard(evt.target);
        if (!card) return;
        if (this.m_joueurs[BtMain.c_humanplayer].m_cartesparcouleur[card.m_couleur].indexOf(card) < 0) return;

        if (this.m_suggestionatout) {
            if (this.m_donne.betturn < 4) { this.displaybulleinfo("Premier tour !"); this.m_waitforuser = true; return; }
            this.m_waitforuser = false;
            document.getElementById('btactionbutton')?.remove();
            this.m_pari.couleur = card.m_couleur;
            this._scheduleEvent('btsecondedonne');
        } else {
            const allowed = this.m_pliencours.cartesautorisees(this.m_joueurs[BtMain.c_humanplayer], this.m_pari.couleur);
            if (allowed.indexOf(card) < 0) { this.displaybulleinfo("Carte invalide !"); return; }
            this.m_waitforuser = false;
            this.m_hintcarte = null;
            document.getElementById('bthintbtn').style.display = 'none';
            this.jouercarte(card);
            this._scheduleEvent('btplayloop');
        }
    }

    // ── Options ────────────────────────────────────────────────────────────────

    applyoptions() {
        const oldcardwidth  = BtCarte.CARTEWIDTH;
        const olddirection  = BtMain.BTSENSINVERSE;
        const jsdata        = JSON.parse(localStorage.getItem('mlrdev.belote.btoptions') || 'null');

        if (jsdata) {
            BtCarte.CARTEWIDTH      = parseInt(jsdata.btcardwidth) || 100;
            BtMain.BTDELAY          = parseInt(jsdata.btdelay)     || 800;
            BtMain.BTSCOREFINAL     = BtAIParams?.game?.scoreFinal ?? 1000;
            BtMain.BTSENSINVERSE    = jsdata.btsenshoraire  || false;
            BtMain.BTAUTOPLAYLAST   = jsdata.btautolast     || false;
            BtMain.BTAUTOPLAYUNIQ   = jsdata.btautouniq     || false;
            BtMain.BTCOINCHE        = jsdata.btcoinche        || false;
            BtMain.BTDEFENSEPOINTS  = jsdata.btdefensepoints !== undefined ? jsdata.btdefensepoints : true;
            BtMain.BTFULLAUTO       = jsdata.btjeuauto        || false;
        } else {
            BtCarte.CARTEWIDTH      = 100;
            BtMain.BTDELAY          = 800;
            BtMain.BTSCOREFINAL     = BtAIParams?.game?.scoreFinal ?? 1000;
            BtMain.BTSENSINVERSE    = false;
            BtMain.BTAUTOPLAYLAST   = false;
            BtMain.BTAUTOPLAYUNIQ   = false;
            BtMain.BTCOINCHE        = false;
            BtMain.BTDEFENSEPOINTS  = true;
            BtMain.BTFULLAUTO       = false;
        }

        const g = id => document.getElementById(id);
        if (g('btdelay'))      g('btdelay').value      = BtMain.BTDELAY;
        if (g('btcardwidth'))  g('btcardwidth').value  = BtCarte.CARTEWIDTH;
        if (g('btsenshoraire')) g('btsenshoraire').checked = BtMain.BTSENSINVERSE;
        if (g('btautolast'))   g('btautolast').checked   = BtMain.BTAUTOPLAYLAST;
        if (g('btautouniq'))   g('btautouniq').checked   = BtMain.BTAUTOPLAYUNIQ;
        if (g('btjeuauto'))    g('btjeuauto').checked    = BtMain.BTFULLAUTO;
        if (g('btcoinche'))    g('btcoinche').checked    = BtMain.BTCOINCHE;
        if (g('btdefensepoints')) g('btdefensepoints').checked = BtMain.BTDEFENSEPOINTS;
        if (g('btdefensepointsrow')) g('btdefensepointsrow').style.display = BtMain.BTCOINCHE ? '' : 'none';

        if (olddirection !== undefined && BtMain.BTSENSINVERSE !== olddirection) {
            document.getElementById('btactionbutton')?.remove();
            this.m_donne.betturn = 8;
            this.m_findepartie   = true;
        }
        if (BtCarte.CARTEWIDTH !== oldcardwidth) this.setsize();

        if (BtMain.c_humanplayer < 0 || BtMain.c_humanplayer > 3) BtMain.BTDELAY = 100;
    }

    validateoptions() {
        const g = id => document.getElementById(id);
        const coincheBefore = BtMain.BTCOINCHE;
        const jsdata = {
            btdelay:      g('btdelay').value,
            btcardwidth:  g('btcardwidth').value,
            btsenshoraire: g('btsenshoraire').checked,
            btautolast:   g('btautolast').checked,
            btautouniq:   g('btautouniq').checked,
            btjeuauto:    g('btjeuauto').checked,
            btcoinche:    g('btcoinche').checked,
            btdefensepoints: g('btdefensepoints') ? g('btdefensepoints').checked : true
        };
        localStorage.setItem('mlrdev.belote.btoptions', JSON.stringify(jsdata));
        this.applyoptions();
        if (jsdata.btcoinche !== coincheBefore || !this.m_plis || !this.m_plis.length) {
            // Game type changed or no deal in progress yet: start fresh
            this.clearboard();
            $(':mobile-pagecontainer').pagecontainer('change', '#btpage0', { transition: "fade" });
            document.dispatchEvent(new Event('btnouvellepartie'));
        } else {
            this.retourjeu();
        }
    }

    // ── Sizing ─────────────────────────────────────────────────────────────────

    setsize() {
        const scorebarEl   = document.getElementById('btscorebar');
        const scorebarhgt  = scorebarEl ? (scorebarEl.offsetHeight || 28) : 0;
        const boardtop     = scorebarEl ? (scorebarEl.offsetTop + scorebarEl.offsetHeight) : scorebarhgt;
        const availh       = window.innerHeight - boardtop;
        let ivalue         = Math.min(availh, window.innerWidth);
        ivalue             = Math.min(3.5 * BtCarte.CARTEWIDTH, ivalue);

        const css = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val + 'px'; };
        css('btplateauplis', 'width',  ivalue);
        css('btplateauplis', 'height', ivalue);
        css('btplateauplis', 'left',   (window.innerWidth - ivalue) / 2);
        css('btplateauplis', 'top',    boardtop);
        css('btpliprecedent', 'width',  ivalue);
        css('btpliprecedent', 'height', ivalue);
        css('btpliprecedent', 'left',   (window.innerWidth - ivalue) / 2);

        const board = document.getElementById('btplateauplis');
        let sudtop  = ivalue + (board ? board.offsetTop : boardtop);
        sudtop      = Math.max(sudtop + 10, (window.innerHeight + sudtop - 50) / 2 - BtCarte.CARTEWIDTH * 1.45);
        css('btcartessud', 'top', sudtop);

        const ratio = (window.innerWidth - 10) / (8 * BtCarte.CARTEWIDTH);
        const sudw  = Math.min(window.innerWidth - (ratio < 0.25 ? 30 : 10), 8 * BtCarte.CARTEWIDTH);
        css('btcartessud', 'width',  sudw);
        css('btcartessud', 'left',   (window.innerWidth - sudw) / 2);
        css('btcartessud', 'height', BtCarte.CARTEWIDTH * 1.45);
    }

    // ── Persistence ────────────────────────────────────────────────────────────

    chargerdonne() {
        if (this.m_cartes.length !== 32) alert("[chargerdonne] Il manque des cartes !");
        const raw = localStorage.getItem('mlrdev.belote.sauverdonne');
        if (raw) {
            const jsobj = JSON.parse(raw);
            this.m_donneurid = jsobj.donneur;
            while (this.m_cartes.length) delete this.m_cartes.pop();
            jsobj.cartes.forEach(jscarte => this.m_cartes.push(new BtCarte(jscarte.clr, jscarte.val)));
        } else {
            console.log("Cannot load data from localStorage");
        }
    }

    sauverdonne() {
        if (this.m_cartes.length !== 32) alert("[sauverdonne] Il manque des cartes !");
        const jscartes = this.m_cartes.map(c => ({ val: c.m_valeur, clr: c.m_couleur }));
        localStorage.setItem('mlrdev.belote.sauverdonne', JSON.stringify({ donneur: this.m_donneurid, cartes: jscartes }));
    }

    replaydeal() {
        document.getElementById('btactionbutton')?.remove();
        this.m_chargerdonne = true;
        this.m_donne.fin    = true;
        this.retourjeu();
    }

    sauveretatdujeu() {
        // TODO: Rewrite Save/Load game part
    }

    reprisedujeu() {
        this.m_findepartie = false;
        // Show options first so the player can pick game type before the first deal
        const saved = localStorage.getItem('mlrdev.belote.btoptions');
        if (saved) {
            // Returning player: resume directly
            document.dispatchEvent(new Event('btnouvellepartie'));
        } else {
            // First launch (no saved prefs): go to options page
            $(':mobile-pagecontainer').pagecontainer('change', '#btpage2', { transition: "fade" });
        }
    }

    // ── Icon positioning ───────────────────────────────────────────────────────

    displaypreneuricon_fromid(playerId) {
        // Alias kept for external access if needed
        this.m_preneurid = playerId;
        this.displaypreneuricon();
    }
}

// Starts
document.addEventListener('DOMContentLoaded', () => new BtMain());
