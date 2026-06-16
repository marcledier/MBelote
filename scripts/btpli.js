class BtPli {
    constructor(idpremierjoueur) {
        this.m_lanceurid      = idpremierjoueur;
        this.m_cartes         = [];
        this.m_winnerid       = -1;
        this.m_wincarte       = null;
        this.m_endofpli       = false;
        this.m_couleurdemandee = -1;
        this.m_points         = 0;
        this.m_status         = [0, 0, 0, 0];
    }

    pushcarte(joueur, carte, isatout) {
        joueur.takecarte(carte);
        carte.afficher(joueur.m_id);

        if (carte.m_infcarte) carte.m_infcarte.m_supcarte = carte.m_supcarte;
        if (carte.m_supcarte) carte.m_supcarte.m_infcarte = carte.m_infcarte;
        carte.m_infcarte = null;
        carte.m_supcarte = null;

        if (this.m_cartes.length === 0) {
            this.m_status[0] = 0;
        } else {
            if (carte.m_couleur === this.m_couleurdemandee) {
                this.m_status[this.m_cartes.length] = 1;
            } else {
                joueur.m_fournitcolor[this.m_couleurdemandee] = false;
                this.m_status[this.m_cartes.length] = isatout ? 2 : 3;
            }
        }

        this.m_cartes.push(carte);

        if (this.m_wincarte === null) {
            this.m_wincarte        = carte;
            this.m_winnerid        = joueur.m_id;
            this.m_couleurdemandee = carte.m_couleur;
        } else if (this.m_wincarte.comparecarte(carte) < 0) {
            this.m_wincarte = carte;
            this.m_winnerid = joueur.m_id;
        }

        this.m_points += carte.pointcarte();
        if (this.m_cartes.length === 4) this.m_endofpli = true;
    }

    ramasser() {
        const dst = document.getElementById('btpliprecedent');
        const src = document.getElementById('btplateauplis');
        dst.querySelectorAll('img').forEach(el => el.remove());
        src.querySelectorAll('img').forEach(img => dst.appendChild(img.cloneNode(true)));

        const winnerid = this.m_winnerid;
        this.m_cartes.forEach(carte => {
            const crtwdt = BtCarte.CARTEWIDTH;
            const crthgt = Math.round(BtCarte.CARTEWIDTH * 1.45);
            const domcontainer = document.getElementById('btplateauplis');
            const tapisw = domcontainer.clientWidth  || domcontainer.offsetWidth;
            const tapish = domcontainer.clientHeight || domcontainer.offsetHeight;
            let topleft;
            switch (winnerid) {
                case 0: topleft = [tapish,               (tapisw - crtwdt) / 2]; break;
                case 1: topleft = [(tapish - crthgt) / 2, tapisw             ]; break;
                case 2: topleft = [-crthgt,              (tapisw - crtwdt) / 2]; break;
                case 3: topleft = [(tapish - crthgt) / 2, -crtwdt            ]; break;
                default: topleft = [0, 0];
            }
            // Cancel any running animation, capture current rendered position
            carte.m_image.getAnimations().forEach(a => a.cancel());
            const fromTop  = carte.m_image.style.top;
            const fromLeft = carte.m_image.style.left;
            // Set destination in inline style, then animate as pure visual
            carte.m_image.style.top  = topleft[0] + 'px';
            carte.m_image.style.left = topleft[1] + 'px';
            carte.m_image.animate(
                [{ top: fromTop, left: fromLeft },
                 { top: topleft[0] + 'px', left: topleft[1] + 'px' }],
                { duration: Math.round(0.8 * BtMain.BTDELAY), easing: 'ease-in-out' }
            ).finished.then(() => carte.masquer());
        });
    }

    risquedecoupe(game, couleur) {
        const joueur = game.m_joueurs[game.m_donne.playerid];
        const nbatt  = joueur.m_cartesparcouleur[game.m_pari.couleur].length
                     + game.m_donne.couleurjouees[game.m_pari.couleur];
        if (nbatt === 8) return 0;

        let result = 0;
        switch (this.m_cartes.length) {
            case 0: {
                const joueur0 = game.m_joueurs[(game.m_donne.playerid + 3) % 4];
                if (joueur0.m_fournitcolor[game.m_pari.couleur]) {
                    result += 3;
                    if (!joueur0.m_fournitcolor[couleur]) result += 10;
                }
            }
            // falls through
            case 1:
            case 2: {
                const joueur1 = game.m_joueurs[(game.m_donne.playerid + 1) % 4];
                if (joueur1.m_fournitcolor[game.m_pari.couleur]) {
                    result += 3;
                    if (!joueur1.m_fournitcolor[couleur]) result += 10;
                }
                break;
            }
            case 3:
                result = 0;
                break;
        }
        return result;
    }

    cartesautorisees(joueur, atoutclr) {
        if (this.m_cartes.length === 0) return joueur.gethand();

        if (joueur.m_cartesparcouleur[this.m_couleurdemandee].length > 0) {
            if (this.m_couleurdemandee === atoutclr) {
                const atouts = joueur.m_cartesparcouleur[atoutclr].filter(
                    card => card.comparevaleur(this.m_wincarte) > 0
                );
                if (atouts.length > 0) return atouts;
            }
            return joueur.m_cartesparcouleur[this.m_couleurdemandee];
        }

        if (this.m_winnerid % 2 === joueur.m_id % 2) return joueur.gethand();

        if (joueur.m_cartesparcouleur[atoutclr].length > 0) {
            if (this.m_wincarte.m_couleur === atoutclr) {
                const atouts = joueur.m_cartesparcouleur[atoutclr].filter(
                    card => card.comparevaleur(this.m_wincarte) > 0
                );
                if (atouts.length > 0) return atouts;
            }
            return joueur.m_cartesparcouleur[atoutclr];
        }

        return joueur.gethand();
    }

    meilleurecarte(game) {
        const hand = this.cartesautorisees(game.m_joueurs[game.m_donne.playerid], game.m_pari.couleur);
        if (hand.length === 1) return hand[0];

        let carte = null;
        switch (this.m_cartes.length) {
            case 0: carte = this.meilleurecarte0(game, hand); break;
            case 1: carte = this.meilleurecarte1(game, hand); break;
            case 2: carte = this.meilleurecarte2(game, hand); break;
            case 3: carte = this.meilleurecarte3(game, hand); break;
            default: alert("trop de cartes dans le pli");
        }
        return carte ?? hand[0];
    }

    cartesgagnantes(cartes) {
        if (this.m_cartes.length === 0) return cartes;
        const wincarte = this.m_wincarte;
        return cartes.filter(carte => wincarte.comparecarte(carte) < 0);
    }

    cartesimprenables(cartes) {
        return cartes.filter(carte => {
            let scard = carte;
            while ((scard = scard.m_supcarte)) {
                if (cartes.indexOf(scard) < 0) return false;
            }
            return true;
        });
    }

    lamoinschere(cartes) {
        if (cartes.length === 1) return cartes[0];
        return [...cartes].sort((c1, c2) => c1.pointcarte() - c2.pointcarte())[0];
    }

    lapluschere(cartes) {
        if (cartes.length === 1) return cartes[0];
        return [...cartes].sort((c1, c2) => c2.pointcarte() - c1.pointcarte())[0];
    }

    meilleurecarte0(game, hand) {
        const clratout = game.m_pari.couleur;
        let couleurentame = -1;

        let h = hand.filter(carte => carte.m_couleur !== clratout);
        if (h.length === 0) couleurentame = 10 + clratout;

        if (couleurentame >= 0 || game.m_preneurid % 2 === game.m_donne.playerid % 2) {
            const nbatout = game.m_joueurs[game.m_donne.playerid].m_cartesparcouleur[clratout].length;
            if (nbatout > 0) {
                const dehors = 8 - (game.m_donne.couleurjouees[clratout] + nbatout);
                if (dehors > 0) {
                    for (let iter = 1; iter < 3; iter += 2) {
                        const joueur = game.m_joueurs[(game.m_donne.playerid + iter) % 4];
                        if (joueur.m_fournitcolor[clratout]) { couleurentame = clratout; break; }
                    }
                }
                if (couleurentame >= 0) {
                    let g = this.cartesimprenables(game.m_joueurs[game.m_donne.playerid].m_cartesparcouleur[clratout]);
                    if (g.length > 0) return this.lapluschere(g);
                    g = game.m_joueurs[game.m_donne.playerid].m_cartesparcouleur[clratout];
                    const moinschere = this.lamoinschere(g);
                    if (moinschere.pointcarte() < 10 || couleurentame >= 10) return moinschere;
                }
            }
        }

        h = hand.filter(carte => carte.m_couleur !== clratout);
        if (h.length === 0) alert("Probleme : je ne devrais pas avoir que de l'atout");

        let g = this.cartesimprenables(h);
        if (g.length > 0) {
            g.sort((c1, c2) => this.risquedecoupe(game, c1.m_couleur) < this.risquedecoupe(game, c2.m_couleur) ? -1 : 1);
            h = g.filter(carte => carte.m_couleur === g[0].m_couleur);
            return this.lapluschere(h);
        }

        g = h.filter(carte => h.filter(c2 => c2.m_couleur === carte.m_couleur).length === 1);
        if (g.length > 0) return this.lamoinschere(g);

        g = h.filter(carte => h.filter(c2 => c2.m_couleur === carte.m_couleur).length > 3);
        if (g.length > 0) return this.lamoinschere(g);

        return this.lamoinschere(h);
    }

    meilleurecarte1(game, hand) {
        return this.meilleurecarte2(game, hand);
    }

    meilleurecarte2(game, hand) {
        let g, h;

        if (this.m_winnerid % 2 === game.m_donne.playerid % 2) {
            g = hand.filter(c => c.m_couleur !== game.m_pari.couleur);
            if (g.length > 0) {
                h = g.filter(c => c.m_couleur !== this.m_couleurdemandee);
                if (h.length > 0) {
                    if (this.risquedecoupe(game, this.m_couleurdemandee) > 10) return this.lamoinschere(h);
                    g = this.cartesimprenables(h);
                    if (g.length > 0) {
                        const nonimpr = h.filter(c => g.indexOf(c) < 0);
                        if (nonimpr.length > 0) return this.lapluschere(nonimpr);
                        return this.lapluschere(hand);
                    }
                    return this.lamoinschere(h);
                }
                if (this.risquedecoupe(game, this.m_couleurdemandee) > 10) return this.lamoinschere(g);
                return this.lapluschere(g);
            }
            h = this.cartesgagnantes(hand);
            if (h.length > 0) {
                g = this.cartesimprenables(h);
                if (g.length > 0) {
                    if (this.risquedecoupe(game, this.m_couleurdemandee) > 10) return this.lamoinschere(g);
                    const nonimpr = hand.filter(c => g.indexOf(c) < 0);
                    if (nonimpr.length > 0) return this.lapluschere(nonimpr);
                    return this.lapluschere(g);
                }
            }
            g = this.cartesimprenables(hand);
            if (g.length > 0) {
                const nonimpr = hand.filter(c => g.indexOf(c) < 0);
                if (nonimpr.length > 0) return this.lapluschere(nonimpr);
            }
            return this.lapluschere(hand);
        }

        h = this.cartesgagnantes(hand);
        if (h.length > 0) {
            g = h.filter(c => c.m_couleur !== game.m_pari.couleur);
            if (g.length > 0) {
                g = this.cartesimprenables(h);
                if (g.length > 0) {
                    g.sort((c1, c2) => this.risquedecoupe(game, c1.m_couleur) < this.risquedecoupe(game, c2.m_couleur) ? -1 : 1);
                    return g[0];
                }
                const c = this.lamoinschere(h);
                if (c.pointcarte() < 10) return c;
            } else {
                g = this.cartesimprenables(h);
                if (g.length > 0) {
                    h = h.filter(c => g.indexOf(c) < 0);
                    if (h.length === 0) return this.lapluschere(g);
                }
                return this.lapluschere(h);
            }
        }
        return this.lamoinschere(hand);
    }

    meilleurecarte3(game, hand) {
        const clratout = game.m_pari.couleur;
        let g, h;

        if (this.m_winnerid % 2 === game.m_donne.playerid % 2) {
            g = hand.filter(carte => carte.m_couleur !== clratout);
            if (g.length > 0) {
                h = this.cartesimprenables(g);
                if (h.length < g.length) {
                    const nonimpr = g.filter(c => h.indexOf(c) < 0);
                    if (nonimpr.length > 0) return this.lapluschere(nonimpr);
                }
                return this.lapluschere(g);
            }
            h = this.cartesimprenables(hand);
            if (h.length < hand.length) {
                const nonimpr = hand.filter(c => h.indexOf(c) < 0);
                if (nonimpr.length > 0) return this.lapluschere(nonimpr);
            }
            return this.lapluschere(hand);
        }

        g = this.cartesgagnantes(hand);
        if (g.length === 1) return g[0];

        if (g.length > 1) {
            h = g.filter(c => c.m_couleur !== clratout);
            if (h.length === 0) {
                const impr = this.cartesimprenables(g);
                const nonimpr = g.filter(c => impr.indexOf(c) < 0);
                if (nonimpr.length > 0) return this.lapluschere(nonimpr);
                return this.lapluschere(g);
            }
            const impr = this.cartesimprenables(g);
            if (impr.length < g.length) {
                if (game.m_donne.couleurjouees[clratout] > 5 && game.m_donne.couleurjouees[this.m_couleurdemandee] < 5) {
                    return this.lapluschere(g.filter(c => impr.indexOf(c) < 0));
                }
            }
            return this.lapluschere(g);
        }

        return this.lamoinschere(hand);
    }
}
