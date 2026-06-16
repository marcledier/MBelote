class BtJoueur {
    constructor(id) {
        this.m_id = id;
        this.m_cartesparcouleur = [[], [], [], []];
    }

    addcarte(carte) {
        this.m_cartesparcouleur[carte.m_couleur].push(carte);
    }

    gethand(attcolor) {
        const valueSort = (a, b) => -a.comparevaleur(b);
        const ac = Number.isFinite(Number(attcolor)) ? Number(attcolor) : -1;
        let lhand = [];
        if (ac >= 0) {
            lhand = lhand.concat(this.m_cartesparcouleur[ac].sort(valueSort));
        }
        this.m_cartesparcouleur.forEach((arclr, idclr) => {
            if (idclr !== ac) lhand = lhand.concat(arclr.sort(valueSort));
        });
        return lhand;
    }

    getclickedcard(clicktarget) {
        for (const hcarte of this.gethand()) {
            if (hcarte.m_image === clicktarget) return hcarte;
        }
        return null;
    }

    checkbelote(atout) {
        const isQueenOrKing = value => (value === 5 || value === 6);
        let blte, colr;
        if (atout instanceof BtCarte) {
            colr = atout.m_couleur;
            blte = isQueenOrKing(atout.m_valeur) ? 1 : 0;
        } else {
            colr = atout;
            blte = 0;
        }
        for (const c of this.m_cartesparcouleur[colr]) {
            if (isQueenOrKing(c.m_valeur)) blte++;
        }
        this.m_belote = (blte === 2 ? 2 : -1);
    }

    affichercartes(atout) {
        const jhand  = this.gethand(atout);
        let nbcard = 10 * jhand.length;
        jhand.forEach(carte => carte.afficher(nbcard++));
    }

    takecarte(carte) {
        const idx = this.m_cartesparcouleur[carte.m_couleur].indexOf(carte);
        if (idx < 0) alert(`oops... Pas ma carte : ${carte.displayname()}`);
        this.m_cartesparcouleur[carte.m_couleur].splice(idx, 1);
    }

    _scoremaincoinche(attcol) {
        let score = 0;
        const atouts = this.m_cartesparcouleur[attcol];

        atouts.forEach(c => {
            score += c.pointcarte(true);
            if (c.m_valeur === 4) score += 10;
            if (c.m_valeur === 2) score += 5;
        });
        if      (atouts.length >= 6) score += 20;
        else if (atouts.length >= 5) score += 12;
        else if (atouts.length >= 4) score += 6;

        for (let col = 0; col < 4; col++) {
            if (col === attcol) continue;
            const ncol = this.m_cartesparcouleur[col];
            ncol.forEach(c => {
                const pt = c.pointcarte(false);
                if (pt >= 10) score += pt;
            });
            if (ncol.length === 1) score += 4;
            if (ncol.length === 0) score += 2;
        }
        return score;
    }

    _scoremaincomplement(attcol) {
        let score = 0;
        for (let col = 0; col < 4; col++) {
            const ncol = this.m_cartesparcouleur[col];
            if (col === attcol) {
                ncol.forEach(c => {
                    score += c.pointcarte(true);
                    if (c.m_valeur === 4) score += 10;
                });
            } else {
                ncol.forEach(c => {
                    const pt = c.pointcarte(false);
                    if (pt >= 10) score += pt;
                });
                if (ncol.length === 1) score += 5;
                if (ncol.length === 0) score += 3;
            }
        }
        return score;
    }

    paricoinche(game) {
        const partnerid    = (this.m_id + 2) % 4;
        const partnerleads = (game.m_pari.couleur >= 0 && game.m_preneurid === partnerid);
        let bid;

        if (partnerleads) {
            const compscore = this._scoremaincomplement(game.m_pari.couleur);
            const steps = Math.min(2, Math.floor(compscore / 30));
            if (steps === 0) return { couleur: -1 };
            bid = Math.min(120, game.m_pari.point + steps * 10);
            if (bid <= game.m_pari.point) return { couleur: -1 };
            return { couleur: game.m_pari.couleur, point: bid };
        }

        const opponentcouleur = (game.m_pari.couleur >= 0 && !partnerleads) ? game.m_pari.couleur : -1;
        let bestcouleur = -1;
        let bestscore   = -1;
        for (let attcol = 0; attcol < 4; attcol++) {
            if (attcol === opponentcouleur) continue;
            const score = this._scoremaincoinche(attcol);
            if (score > bestscore) { bestscore = score; bestcouleur = attcol; }
        }

        const minbid = (game.m_pari.point > 0 ? game.m_pari.point + 10 : 80);
        if (minbid > 160 || bestscore < 70) return { couleur: -1 };

        bid = Math.min(130, 80 + Math.floor((bestscore - 70) / 8) * 10);
        if (bid < minbid) return { couleur: -1 };
        return { couleur: bestcouleur, point: bid };
    }

    acceptatout(carteatout, bfirstturn) {
        const compterpoint = (cartes, couleuratout) => {
            let natout = 0;
            let patout = 0, pautre = 0, pbelote = 0;
            cartes.forEach(carte => {
                const ncarte = carte.pointcarte(carte.m_couleur === couleuratout);
                if (carte.m_couleur === couleuratout) {
                    natout++;
                    if (ncarte === 3 || ncarte === 4) pbelote++;
                    patout += (ncarte > 11 ? 2 * ncarte : ncarte);
                    patout += (ncarte > 10 ? 2 * ncarte : ncarte);
                } else {
                    pautre += (ncarte > 10 ? 2 * ncarte : ncarte);
                }
            });
            if (pbelote === 2) patout += 15;
            if (patout > 75) {
                if (natout > 2) patout += 10 * natout;
                if (natout > 3) patout += 5  * natout;
                if (pautre > 12) patout += pautre;
            }
            return patout;
        };

        if (bfirstturn) {
            const hand = this.gethand(carteatout.m_couleur);
            hand.push(carteatout);
            return (compterpoint(hand, carteatout.m_couleur) > 100 ? carteatout.m_couleur : -1);
        }

        let maxnpoint = -1;
        let maxattcol = -1;
        for (let attcol = 0; attcol < 4; attcol++) {
            if (attcol === carteatout.m_couleur) continue;
            const hand = this.gethand(carteatout.m_couleur);
            hand.push(carteatout);
            const npoint = compterpoint(hand, attcol);
            if (npoint > maxnpoint) { maxnpoint = npoint; maxattcol = attcol; }
        }
        return (maxnpoint > 100 ? maxattcol : -1);
    }
}
