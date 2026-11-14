/**
 * CENTRAL DXF PRO - GERADOR DXF NO CLIENTE
 * Gera arquivos DXF puros e compatíveis com Aspire, Vectric, ArtCAM, SheetCAM e Fusion 360.
 */

export function gerarDXFTexto(geometria) {
  const { camadas = [] } = geometria;

  let dxf = '';
  dxf += '0\nSECTION\n';
  dxf += '2\nHEADER\n';
  dxf += '9\n$ACADVER\n1\nAC1009\n'; // AutoCAD R12 (Compatibilidade CNC Universal)
  dxf += '9\n$INSUNITS\n70\n4\n';    // 4 = Milímetros
  dxf += '0\nENDSEC\n';

  dxf += '0\nSECTION\n';
  dxf += '2\nTABLES\n';

  // Linetype
  dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n';
  dxf += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
  dxf += '0\nENDTAB\n';

  // Layers com cores ACI
  const layerDefs = [
    { name: 'CORTE', color: 1 },         // 1 = Vermelho (Corte passante)
    { name: 'USINAGEM', color: 3 },      // 3 = Verde (Rebaixo / cavas)
    { name: 'FRESAGEM_DOBRA', color: 2 },// 2 = Amarelo (Dobra / kerfing)
    { name: 'FURACAO', color: 5 },       // 5 = Azul (Furos e cavilhas)
    { name: 'COTAS', color: 7 }          // 7 = Branco
  ];

  dxf += `0\nTABLE\n2\nLAYER\n70\n${layerDefs.length}\n`;
  for (const l of layerDefs) {
    dxf += '0\nLAYER\n';
    dxf += `2\n${l.name}\n`;
    dxf += '70\n0\n';
    dxf += `62\n${l.color}\n`;
    dxf += '6\nCONTINUOUS\n';
  }
  dxf += '0\nENDTAB\n';
  dxf += '0\nENDSEC\n';

  // BLOCKS
  dxf += '0\nSECTION\n';
  dxf += '2\nBLOCKS\n';
  dxf += '0\nENDSEC\n';

  // ENTITIES
  dxf += '0\nSECTION\n';
  dxf += '2\nENTITIES\n';

  for (const item of camadas) {
    const layer = item.layer || 'CORTE';

    if (item.tipo === 'polyline' && item.pontos && item.pontos.length > 0) {
      dxf += '0\nPOLYLINE\n';
      dxf += `8\n${layer}\n`;
      dxf += '66\n1\n';
      dxf += `70\n${item.fechada ? 1 : 0}\n`;
      dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';

      for (const pt of item.pontos) {
        dxf += '0\nVERTEX\n';
        dxf += `8\n${layer}\n`;
        dxf += `10\n${Number(pt.x).toFixed(4)}\n`;
        dxf += `20\n${Number(pt.y).toFixed(4)}\n`;
        dxf += '30\n0.0\n';
      }
      dxf += '0\nSEQEND\n';
      dxf += `8\n${layer}\n`;
    } else if (item.tipo === 'line') {
      dxf += '0\nLINE\n';
      dxf += `8\n${layer}\n`;
      dxf += `10\n${Number(item.x1).toFixed(4)}\n`;
      dxf += `20\n${Number(item.y1).toFixed(4)}\n`;
      dxf += '30\n0.0\n';
      dxf += `11\n${Number(item.x2).toFixed(4)}\n`;
      dxf += `21\n${Number(item.y2).toFixed(4)}\n`;
      dxf += '31\n0.0\n';
    } else if (item.tipo === 'circle') {
      dxf += '0\nCIRCLE\n';
      dxf += `8\n${layer}\n`;
      dxf += `10\n${Number(item.cx).toFixed(4)}\n`;
      dxf += `20\n${Number(item.cy).toFixed(4)}\n`;
      dxf += '30\n0.0\n';
      dxf += `40\n${Number(item.r).toFixed(4)}\n`;
    }
  }

  dxf += '0\nENDSEC\n';
  dxf += '0\nEOF\n';

  return dxf;
}

export function baixarArquivoDXF(nomeArquivo, conteudoDXF) {
  const blob = new Blob([conteudoDXF], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
