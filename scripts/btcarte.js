class BtCarte {
    static CARTEWIDTH = 0;

    constructor(clr, val) {
        this.m_couleur  = clr;
        this.m_valeur   = val;
        this.m_isatout  = false;
        this.m_pertinence = 0;

        this.m_image = document.createElement('img');
        this.m_image.src    = `./cartes/${SUIT_SYMBOLS[clr]}${CARD_FILESUF[val]}.png`;
        this.m_image.width  = BtCarte.CARTEWIDTH;
        this.m_image.height = Math.round(BtCarte.CARTEWIDTH * 1.45);

        this.m_supcarte = null;
        this.m_infcarte = null;
        this.m_debugname = this.displayname();
    }

    masquer() {
        this.m_image.getAnimations().forEach(a => a.cancel());
        this.m_image.removeAttribute('style');
        this.m_image.remove();
    }

    shortdisplayname() {
        return `${CARD_VALUES[this.m_valeur]}-${SUIT_ABBREV[this.m_couleur]}`;
    }

    displayname() {
        return `${CARD_VALUES[this.m_valeur]} de ${SUIT_NAMES[this.m_couleur]}`;
    }

    pointcarte(isatout) {
        const local_is_atout = (isatout === undefined ? this.m_isatout : isatout);
        if (local_is_atout)
            return [0, 0, 14, 10, 20, 3, 4, 11][this.m_valeur];
        else
            return [0, 0, 0, 10, 2, 3, 4, 11][this.m_valeur];
    }

    comparevaleur(carteb) {
        const point1 = this.pointcarte();
        const point2 = carteb.pointcarte();
        if (point1 > point2) return 1;
        if (point1 < point2) return -1;
        if (this.m_valeur > carteb.m_valeur) return 1;
        if (this.m_valeur < carteb.m_valeur) return -1;
        console.log("BtCarte.comparevaleur returns 0 !!");
        return 0;
    }

    comparecarte(carteb) {
        if (this.m_couleur === carteb.m_couleur) return this.comparevaleur(carteb);
        if (carteb.m_isatout) return -1;
        return 1;
    }

    afficher(context) {
        this.masquer();
        const crtwdt = BtCarte.CARTEWIDTH;
        const crthgt = Math.round(BtCarte.CARTEWIDTH * 1.45);
        const domcontainer = context < 10
            ? document.getElementById('btplateauplis')
            : document.getElementById('btcartessud');
        const tapisw = domcontainer.clientWidth  || domcontainer.offsetWidth;
        const tapish = domcontainer.clientHeight || domcontainer.offsetHeight;
        let topleft = [0, 0];

        domcontainer.appendChild(this.m_image);
        this.m_image.style.position = 'absolute';

        switch (context) {
            case 0:
                this.m_image.style.top  = tapish + 'px';
                this.m_image.style.left = ((tapisw - crtwdt) / 2) + 'px';
                topleft = [tapish - crthgt, (tapisw - crtwdt) / 2];
                break;
            case 1:
                this.m_image.style.top  = ((tapish - crthgt) / 2) + 'px';
                this.m_image.style.left = tapisw + 'px';
                topleft = [(tapish - crthgt) / 2, tapisw - crtwdt];
                break;
            case 2:
                this.m_image.style.top  = (-crthgt) + 'px';
                this.m_image.style.left = ((tapisw - crtwdt) / 2) + 'px';
                topleft = [0, (tapisw - crtwdt) / 2];
                break;
            case 3:
                this.m_image.style.top  = ((tapish - crthgt) / 2) + 'px';
                this.m_image.style.left = (-crtwdt) + 'px';
                topleft = [(tapish - crthgt) / 2, 0];
                break;
            case 9:
                this.m_image.style.top  = '0px';
                this.m_image.style.left = '0px';
                topleft = [(tapish - crthgt) / 2, (tapisw - crtwdt) / 2];
                break;
            default: { // 10 to 87
                const nbcarte = Math.floor(context / 10);
                const idcarte = context % 10;
                topleft[0] = 0;
                if (BtCarte.CARTEWIDTH * nbcarte < tapisw) {
                    topleft[1] = (tapisw - BtCarte.CARTEWIDTH * nbcarte) / 2
                               + Math.floor(idcarte * BtCarte.CARTEWIDTH);
                } else {
                    topleft[1] = Math.floor(idcarte * tapisw / nbcarte);
                }
                this.m_image.style.top  = topleft[0] + 'px';
                this.m_image.style.left = topleft[1] + 'px';
                break;
            }
        }

        if (context < 10) {
            // Inline style owns position — set destination now, animate as pure visual
            const fromTop  = this.m_image.style.top;
            const fromLeft = this.m_image.style.left;
            this.m_image.style.top  = topleft[0] + 'px';
            this.m_image.style.left = topleft[1] + 'px';
            this.m_image.animate(
                [{ top: fromTop, left: fromLeft },
                 { top: topleft[0] + 'px', left: topleft[1] + 'px' }],
                { duration: Math.round(0.8 * BtMain.BTDELAY), easing: 'ease' }
            );
        }
    }
}
