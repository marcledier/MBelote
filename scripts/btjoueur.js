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
        const p = BtAIParams?.coinche?.handScore ?? {};
        const atoutLengthBonuses = p.atoutLengthBonuses ?? [{ minLength: 6, bonus: 20 }, { minLength: 5, bonus: 12 }, { minLength: 4, bonus: 6 }];
        const nineBonus     = p.nineAtoutBonus       ?? 10;
        const jackBonus     = p.jackAtoutBonus        ?? 5;
        const singletonPts  = p.singletonBonus        ?? 4;
        const voidPts       = p.voidBonus             ?? 2;
        const minPtToCount  = p.minPointValueToCount  ?? 10;

        const atouts = this.m_cartesparcouleur[attcol];

        atouts.forEach(c => {
            score += c.pointcarte(true);
            if (c.m_valeur === 2) score += nineBonus;
            if (c.m_valeur === 4) score += jackBonus;
        });
        for (const { minLength, bonus } of atoutLengthBonuses) {
            if (atouts.length >= minLength) { score += bonus; break; }
        }

        for (let col = 0; col < 4; col++) {
            if (col === attcol) continue;
            const ncol = this.m_cartesparcouleur[col];
            ncol.forEach(c => {
                const pt = c.pointcarte(false);
                if (pt >= minPtToCount) score += pt;
            });
            if (ncol.length === 1) score += singletonPts;
            if (ncol.length === 0) score += voidPts;
        }
        return score;
    }

    _scoremaincomplement(attcol) {
        let score = 0;
        const p = BtAIParams?.coinche?.complementHandScore ?? {};
        const nineBonus    = p.nineAtoutBonus      ?? 10;
        const jackBonus    = p.jackAtoutBonus      ?? 5;
        const singletonPts = p.singletonBonus      ?? 5;
        const voidPts      = p.voidBonus           ?? 3;
        const minPtToCount = p.minPointValueToCount ?? 10;

        for (let col = 0; col < 4; col++) {
            const ncol = this.m_cartesparcouleur[col];
            if (col === attcol) {
                ncol.forEach(c => {
                    score += c.pointcarte(true);
                    if (c.m_valeur === 2) score += nineBonus;
                    if (c.m_valeur === 4) score += jackBonus;
                });
            } else {
                ncol.forEach(c => {
                    const pt = c.pointcarte(false);
                    if (pt >= minPtToCount) score += pt;
                });
                if (ncol.length === 1) score += singletonPts;
                if (ncol.length === 0) score += voidPts;
            }
        }
        return score;
    }

    paricoinche(game) {
        const p = BtAIParams?.coinche?.bid ?? {};
        const minBidValue      = p.minBidValue      ?? 80;
        const maxBidValue      = p.maxBidValue      ?? 130;
        const bidStep          = p.bidStep          ?? 10;
        const minScoreToOpen   = p.minScoreToOpenBid ?? 70;
        const scorePerStep     = p.scorePerBidStep  ?? 8;
        const maxBidCap        = p.maxBidCap        ?? 160;

        const pc = BtAIParams?.coinche?.complement ?? {};
        const raiseDivisor = pc.partnerRaiseDivisor ?? 30;
        const maxSteps     = pc.partnerMaxRaiseSteps ?? 2;
        const raiseCap     = pc.partnerRaiseCap      ?? 120;

        const partnerid    = (this.m_id + 2) % 4;
        const partnerleads = (game.m_pari.couleur >= 0 && game.m_preneurid === partnerid);
        let bid;

        if (partnerleads) {
            const compscore = this._scoremaincomplement(game.m_pari.couleur);
            const steps = Math.min(maxSteps, Math.floor(compscore / raiseDivisor));
            if (steps === 0) return { couleur: -1 };
            bid = Math.min(raiseCap, game.m_pari.point + steps * bidStep);
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

        const minbid = (game.m_pari.point > 0 ? game.m_pari.point + bidStep : minBidValue);
        if (minbid > maxBidCap || bestscore < minScoreToOpen) return { couleur: -1 };

        bid = Math.min(maxBidValue, minBidValue + Math.floor((bestscore - minScoreToOpen) / scorePerStep) * bidStep);
        if (bid < minbid) return { couleur: -1 };
        return { couleur: bestcouleur, point: bid };
    }

    acceptatout(carteatout, bfirstturn) {
        const p = BtAIParams?.belote?.acceptAtout ?? {};
        const firstTurnThreshold  = p.firstTurnThreshold  ?? 100;
        const secondTurnThreshold = p.secondTurnThreshold ?? 100;
        const beloteBonus         = p.beloteBonusPoints   ?? 15;
        const hc                  = p.highCardBonus       ?? {};
        const patoutDoubleAbove   = hc.patoutDoubleAbove  ?? 11;
        const pautreDoubleAbove   = hc.pautreDoubleAbove  ?? 10;
        const natoutBonuses       = p.natoutBonuses       ?? [{ minNatout: 3, bonus: 10 }, { minNatout: 4, bonus: 5 }];

        const compterpoint = (cartes, couleuratout) => {
            let natout = 0;
            let patout = 0, pautre = 0, pbelote = 0;
            cartes.forEach(carte => {
                const ncarte = carte.pointcarte(carte.m_couleur === couleuratout);
                if (carte.m_couleur === couleuratout) {
                    natout++;
                    if (ncarte === 3 || ncarte === 4) pbelote++;
                    patout += (ncarte > patoutDoubleAbove ? 2 * ncarte : ncarte);
                    patout += (ncarte > patoutDoubleAbove - 1 ? 2 * ncarte : ncarte);
                } else {
                    pautre += (ncarte > pautreDoubleAbove ? 2 * ncarte : ncarte);
                }
            });
            if (pbelote === 2) patout += beloteBonus;
            if (patout > 75) {
                for (const { minNatout, bonus } of natoutBonuses) {
                    if (natout > minNatout - 1) patout += bonus * natout;
                }
                if (pautre > 12) patout += pautre;
            }
            return patout;
        };

        if (bfirstturn) {
            const hand = this.gethand(carteatout.m_couleur);
            hand.push(carteatout);
            return (compterpoint(hand, carteatout.m_couleur) > firstTurnThreshold ? carteatout.m_couleur : -1);
        }

        let maxnpoint = -1;
        let maxattcol = -1;
        const hand2 = this.gethand(carteatout.m_couleur);
        hand2.push(carteatout);
        for (let attcol = 0; attcol < 4; attcol++) {
            if (attcol === carteatout.m_couleur) continue;
            const npoint = compterpoint(hand2, attcol);
            if (npoint > maxnpoint) { maxnpoint = npoint; maxattcol = attcol; }
        }
        return (maxnpoint > secondTurnThreshold ? maxattcol : -1);
    }
}
