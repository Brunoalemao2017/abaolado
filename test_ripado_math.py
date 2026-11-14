def test_ripado():
    params = {
        'rip_comprimento': '1200',
        'rip_altura': '600',
        'rip_espessura': '15',
        'rip_largura': '40',
        'rip_quantidade': '10',
        'rip_cavilhas': '2',
        'rip_diametro': '8'
    }
    W = float(params.get('rip_comprimento', 1200))
    H = float(params.get('rip_altura', 600))
    espessura = float(params.get('rip_espessura', 15))
    larguraRipa = float(params.get('rip_largura', 40))
    afEsq = float(params.get('rip_af_esq', 0))
    afDir = float(params.get('rip_af_dir', 0))
    numCavilhas = int(params.get('rip_cavilhas', 2))
    diamCavilha = float(params.get('rip_diametro', 8))
    
    W_util = W - afEsq - afDir
    numRipas = int(params.get('rip_quantidade', 10))
    espacamento = (W_util - numRipas * larguraRipa) / (numRipas - 1) if numRipas > 1 else 0
    
    paineis = [{'x0': 0, 'x1': W, 'y0': 0, 'y1': H}]
    ripas = []
    cavilhas = []
    
    marginDowel = min(60.0, H * 0.15)
    for i in range(numRipas):
        rx0 = afEsq + i * (larguraRipa + espacamento)
        rx1 = rx0 + larguraRipa
        ripas.append({'x0': round(rx0, 2), 'x1': round(rx1, 2), 'y0': 0, 'y1': H})
        cx = (rx0 + rx1) / 2
        for k in range(numCavilhas):
            cy = marginDowel + k * ((H - 2 * marginDowel) / (numCavilhas - 1)) if numCavilhas > 1 else H / 2
            cavilhas.append({'x': round(cx, 2), 'y': round(cy, 2), 'diametro': diamCavilha})
            
    print(f'W={W}, H={H}, numRipas={numRipas}, espacamento={espacamento:.2f}mm')
    print(f'paineis={len(paineis)}, ripas={len(ripas)}, cavilhas={len(cavilhas)}')
    print('First ripa:', ripas[0], 'Last ripa:', ripas[-1])

test_ripado()
