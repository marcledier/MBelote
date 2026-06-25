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
        const p = BtAIParams?.coinche?.handScore ?? {};
        const jackBonus         = p.jackBonus           ?? 30;
        const nineBonus         = p.nineBonus           ?? 18;
        const topControlBonus   = p.topControlBonus     ?? 10;
        const atoutLengthBonuses = p.atoutLengthBonuses ?? [{ minLength: 7, bonus: 25 }, { minLength: 6, bonus: 18 }, { minLength: 5, bonus: 12 }, { minLength: 4, bonus: 6 }];
        const voidBonus         = p.voidBonus           ?? 8;
        const singletonBonus    = p.singletonBonus      ?? 5;
        const sideAceBonus      = p.sideAceBonus        ?? 8;
        const sideTenBonus      = p.sideTenBonus        ?? 3;
        const longSuitBonus     = p.longSuitBonus       ?? 4;
        const longSuitMinLen    = p.longSuitMinLength   ?? 4;

        const atouts = this.m_cartesparcouleur[attcol];
        let trumpScore = 0;
        let hasJack = false, hasNine = false;
        atouts.forEach(c => {
            if (c.m_valeur === 4) { trumpScore += jackBonus; hasJack = true; }
            else if (c.m_valeur === 2) { trumpScore += nineBonus; hasNine = true; }
            else trumpScore += c.pointcarte(true);
        });
        if (hasJack && hasNine) trumpScore += topControlBonus;
        for (const { minLength, bonus } of atoutLengthBonuses) {
            if (atouts.length >= minLength) { trumpScore += bonus; break; }
        }

        let sideScore = 0;
        for (let col = 0; col < 4; col++) {
            if (col === attcol) continue;
            const ncol = this.m_cartesparcouleur[col];
            if (ncol.length === 0) { sideScore += voidBonus; continue; }
            if (ncol.length === 1) sideScore += singletonBonus;
            ncol.forEach(c => {
                if (c.m_valeur === 7) sideScore += sideAceBonus;
                else if (c.m_valeur === 3) sideScore += sideTenBonus;
            });
            if (ncol.length >= longSuitMinLen) sideScore += longSuitBonus;
        }
        return trumpScore + sideScore;
    }

    _scoremaincomplement(attcol) {
        const p = BtAIParams?.coinche?.complementHandScore ?? {};
        const trumpSupportPts      = p.trumpSupportPts         ?? 12;
        const jackSupportBonus     = p.jackSupportBonus        ?? 25;
        const nineSupportBonus     = p.nineSupportBonus        ?? 14;
        const sideAceSupportBonus  = p.sideAceSupportBonus    ?? 8;
        const sideVoidBonus        = p.sideVoidSupportBonus   ?? 6;
        const sideSingletonBonus   = p.sideSingletonSupportBonus ?? 4;

        const atouts = this.m_cartesparcouleur[attcol];
        if (atouts.length === 0) return 0;

        let score = atouts.length * trumpSupportPts;
        atouts.forEach(c => {
            if (c.m_valeur === 4) score += jackSupportBonus;
            else if (c.m_valeur === 2) score += nineSupportBonus;
        });

        for (let col = 0; col < 4; col++) {
            if (col === attcol) continue;
            const ncol = this.m_cartesparcouleur[col];
            if (ncol.length === 0) { score += sideVoidBonus; continue; }
            if (ncol.length === 1) score += sideSingletonBonus;
            ncol.forEach(c => { if (c.m_valeur === 7) score += sideAceSupportBonus; });
        }
        return score;
    }

    paricoinche(game, forced = false) {
        const p  = BtAIParams?.coinche?.bid        ?? {};
        const pc = BtAIParams?.coinche?.complement ?? {};
        const blitzMin              = BtMain.BTBLITZ ? 120 : 80;
        const minBidValue           = p.minBidValue           ?? blitzMin;
        const effectiveMin          = Math.max(minBidValue, blitzMin);
        const bidStep               = p.bidStep               ?? 10;
        const minScoreToOpen        = p.minScoreToOpen        ?? 55;
        const scorePerStep          = p.scorePerStep          ?? 12;
        const maxOpeningBid         = p.maxOpeningBid         ?? 180;
        const capotThreshold        = p.capotThreshold        ?? 120;
        const opponentPressureFactor = p.opponentPressureFactor ?? 1.5;
        const partnerPassPenalty    = p.partnerPassPenalty    ?? 8;
        const raiseDivisor          = pc.raiseDivisor         ?? 20;
        const maxRaiseSteps         = pc.maxRaiseSteps        ?? 3;
        const raiseCap              = pc.raiseCap             ?? 150;
        const partnerBidBonus       = pc.partnerBidBonus      ?? 10;
        const switchThreshold       = pc.suitSwitchThreshold  ?? 60;
        const switchMargin          = pc.suitSwitchMargin     ?? 15;

        const partnerid    = (this.m_id + 2) % 4;
        const partnerleads = game.m_pari.couleur >= 0 && game.m_preneurid === partnerid;
        const opponentleads = game.m_pari.couleur >= 0 && !partnerleads;
        const minbid       = game.m_pari.point > 0 ? game.m_pari.point + bidStep : effectiveMin;

        // Did our partner already pass (before any bid was made)?
        const partnerPassed = !partnerleads && game.m_pari.couleur >= 0
                              && game.m_preneurid !== partnerid;

        if (partnerleads) {
            const supportScore = this._scoremaincomplement(game.m_pari.couleur);

            // Consider switching to own suit if significantly stronger
            let ownBestCol = -1, ownBestScore = -1;
            for (let col = 0; col < 4; col++) {
                if (col === game.m_pari.couleur) continue;
                const s = this._scoremaincoinche(col);
                if (s > ownBestScore) { ownBestScore = s; ownBestCol = col; }
            }
            if (ownBestScore >= switchThreshold && ownBestScore > supportScore + switchMargin) {
                const bid = Math.min(maxOpeningBid, effectiveMin + Math.floor((ownBestScore - minScoreToOpen) / scorePerStep) * bidStep);
                if (bid >= minbid) return { couleur: ownBestCol, point: bid };
            }

            // Dynamic raise cap: higher partner bid → more room to raise
            const partnerBidLevel = Math.max(0, game.m_pari.point - effectiveMin);
            const dynamicRaiseCap = raiseCap + Math.floor(partnerBidLevel / bidStep) * partnerBidBonus;
            const steps = Math.min(maxRaiseSteps, Math.floor(supportScore / raiseDivisor));
            if (steps === 0) return { couleur: -1 };
            const bid = Math.min(dynamicRaiseCap, game.m_pari.point + steps * bidStep);
            if (bid < minbid) return { couleur: -1 };
            // Capot support
            if (supportScore >= capotThreshold && bid >= maxOpeningBid)
                return { couleur: game.m_pari.couleur, point: CAPOT_CONTRACT };
            return { couleur: game.m_pari.couleur, point: bid };
        }

        const opponentcouleur = opponentleads ? game.m_pari.couleur : -1;
        let bestcouleur = -1, bestscore = -1;
        for (let attcol = 0; attcol < 4; attcol++) {
            if (attcol === opponentcouleur) continue;
            const score = this._scoremaincoinche(attcol);
            if (score > bestscore) { bestscore = score; bestcouleur = attcol; }
        }

        // Extra score required to enter against opponent pressure
        const pressureExtra = opponentleads
            ? Math.round((game.m_pari.point - effectiveMin) * opponentPressureFactor)
            : 0;
        // Malus if partner already passed without bidding
        const passeMalus = partnerPassed ? partnerPassPenalty : 0;
        const effectiveMinScore = minScoreToOpen + pressureExtra + passeMalus;

        if (!forced && (minbid > maxOpeningBid || bestscore < effectiveMinScore)) return { couleur: -1 };

        // Capot on exceptional hand
        if (bestscore >= capotThreshold && !opponentleads)
            return { couleur: bestcouleur, point: CAPOT_CONTRACT };

        const bid = Math.min(maxOpeningBid, effectiveMin + Math.floor((bestscore - minScoreToOpen) / scorePerStep) * bidStep);
        if (!forced && bid < minbid) return { couleur: -1 };
        return { couleur: bestcouleur, point: Math.max(minbid, bid) };
    }

    shouldcoinche(game) {
        const pd = BtAIParams?.coinche?.doubling ?? {};
        const minScore = pd.minScoreToCoinche ?? 65;
        // Score our hand as if opponent's trump were ours — measures defensive control
        const score = this._scoremaincoinche(game.m_pari.couleur);
        return score >= minScore;
    }

    shouldsurcoinche(game) {
        const pd = BtAIParams?.coinche?.doubling ?? {};
        const minScore = pd.minScoreToSurcoinche ?? 55;
        const score = this._scoremaincomplement(game.m_pari.couleur);
        return score >= minScore;
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
