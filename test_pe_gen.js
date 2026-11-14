function generatePeData(params, subtype) {
  let diamBase = 550, diamTopo = 350, alt = 700, esp = 18;
  let larguraBase = 550, profundBase = 550, larguraTopo = 350, profundTopo = 350;

  if (subtype === 'pe_redondo') {
    const diam = parseFloat(params.pr_diametro) || parseFloat(params.diametro) || 400;
    larguraBase = profundBase = larguraTopo = profundTopo = diam;
    alt = parseFloat(params.pr_altura) || parseFloat(params.altura) || 700;
    esp = parseFloat(params.pr_espessura_mdf) || parseFloat(params.espessura) || 18;
  } else if (subtype === 'pe_oval') {
    larguraBase = larguraTopo = parseFloat(params.po_largura_oval) || parseFloat(params.largura) || 600;
    profundBase = profundTopo = parseFloat(params.po_profundidade_oval) || parseFloat(params.profundidade) || 350;
    alt = parseFloat(params.po_altura) || parseFloat(params.altura) || 700;
    esp = parseFloat(params.po_espessura_mdf) || parseFloat(params.espessura) || 18;
  } else if (subtype === 'pe_oblongo') {
    larguraBase = larguraTopo = parseFloat(params.pob_comprimento) || parseFloat(params.largura) || 500;
    profundBase = profundTopo = parseFloat(params.pob_profundidade) || parseFloat(params.profundidade) || 300;
    alt = parseFloat(params.pob_altura) || parseFloat(params.altura) || 700;
    esp = parseFloat(params.pob_espessura_mdf) || parseFloat(params.espessura) || 18;
  } else if (subtype === 'revestimento_cone_eliptico') {
    larguraBase = parseFloat(params.rc_largura_base) || 600;
    profundBase = parseFloat(params.rc_profund_base) || 400;
    larguraTopo = parseFloat(params.rc_largura_topo) || 350;
    profundTopo = parseFloat(params.rc_profund_topo) || 250;
    alt = parseFloat(params.rc_altura) || parseFloat(params.altura) || 700;
    esp = parseFloat(params.rc_espessura_mdf) || parseFloat(params.espessura) || 18;
  } else {
    // pe_conico default
    diamBase = parseFloat(params.pc_diam_base) || parseFloat(params.diam_base) || 550;
    diamTopo = parseFloat(params.pc_diam_topo) || parseFloat(params.diam_topo) || 350;
    larguraBase = profundBase = diamBase;
    larguraTopo = profundTopo = diamTopo;
    alt = parseFloat(params.pc_altura) || parseFloat(params.altura) || 700;
    esp = parseFloat(params.pc_espessura_mdf) || parseFloat(params.espessura) || 18;
  }

  const baseA = larguraBase / 2;
  const baseB = profundBase / 2;
  const topA = larguraTopo / 2;
  const topB = profundTopo / 2;

  const sectors = [
    { theta_start: 0, theta_end: Math.PI, groove_thetas: [], vbit_thetas: [] },
    { theta_start: Math.PI, theta_end: Math.PI * 2, groove_thetas: [], vbit_thetas: [] }
  ];

  const midA = (baseA + topA) / 2;
  const midB = (baseB + topB) / 2;

  const rings = [
    {
      z: 0,
      outer_a: Math.max(10, baseA - esp),
      outer_b: Math.max(10, baseB - esp),
      inner_a: Math.max(5, baseA - esp - 45),
      inner_b: Math.max(5, baseB - esp - 45),
      label: 'BASE INT.'
    },
    {
      z: alt / 2,
      outer_a: Math.max(10, midA - esp),
      outer_b: Math.max(10, midB - esp),
      inner_a: Math.max(5, midA - esp - 45),
      inner_b: Math.max(5, midB - esp - 45),
      label: 'MEIO INT.'
    },
    {
      z: alt - esp,
      outer_a: Math.max(10, topA - esp),
      outer_b: Math.max(10, topB - esp),
      inner_a: Math.max(5, topA - esp - 45),
      inner_b: Math.max(5, topB - esp - 45),
      label: 'TOPO INT.'
    }
  ];

  return {
    kind: subtype || 'pe_conico',
    largura_base: larguraBase,
    profund_base: profundBase,
    largura_topo: larguraTopo,
    profund_topo: profundTopo,
    altura: alt,
    espessura_mdf: esp,
    sectors,
    rings
  };
}

const pe = generatePeData({ pc_diam_base: 550, pc_diam_topo: 350, pc_altura: 700 }, 'pe_conico');
console.log('Generated PeData:', JSON.stringify(pe, null, 2));
