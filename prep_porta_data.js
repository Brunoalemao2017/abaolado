const fs = require('fs');

let code = fs.readFileSync('public/js/algorithms.js', 'utf8');

// Check calcularPortaCava return
const portaDataCode = `
    const recuoBordo = 21.5;
    const yDob1 = 100;
    const yDob2 = H - 100;
    const furos_dobradica = [
      { x: recuoBordo, y: yDob1, diametro: 35 },
      { x: recuoBordo, y: yDob2, diametro: 35 }
    ];
    if (dobradicas > 2) {
      furos_dobradica.push({ x: recuoBordo, y: H / 2, diametro: 35 });
    }

    let kindPorta = 'porta_puxador_cava_quadrado';
    let cavaObj = null;

    if (tipoCava === 'redonda') {
      kindPorta = 'porta_cava_redonda';
      const cx = (params.puxador_lado && params.puxador_lado.includes('esquerda')) ? 40 : (W - 40);
      const cy = (params.puxador_lado && params.puxador_lado.includes('centralizado')) ? (H / 2) : (H - 60);
      cavaObj = {
        centro: { x: cx, y: cy },
        raio_inner: 20,
        raio_outer: 35,
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };
    } else if (tipoCava === 'longa') {
      kindPorta = 'porta_cava_longa';
      cavaObj = {
        outer: { x0: 0, y0: H - alturaCava, x1: W, y1: H },
        inner: { x0: 0, y0: H - alturaCava + 10, x1: W, y1: H },
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };
    } else if (tipoCava === 'sem_puxador') {
      kindPorta = 'porta_sem_puxador';
    } else {
      kindPorta = 'porta_cava_quadrada';
      const x0 = (params.puxador_lado && params.puxador_lado.includes('esquerda')) ? 20 : (W - larguraCava - 20);
      const y0 = H - alturaCava;
      cavaObj = {
        outer: { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(W, x0 + larguraCava), y1: H },
        inner: { x0: Math.max(0, x0 + 10), y0: Math.max(0, y0 + 10), x1: Math.min(W, x0 + larguraCava - 10), y1: H },
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };
    }

    const portaData = {
      kind: kindPorta,
      largura: W,
      altura: H,
      espessura_material: espessura,
      cava: cavaObj,
      furos_dobradica
    };
`;

console.log('portaDataCode ready');
