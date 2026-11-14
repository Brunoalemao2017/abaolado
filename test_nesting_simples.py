import math

def build_complete_camadas_simples(W=280.0, D=350.0, H=400.0, R=80.0, T=18.0, top_outline=[], reforco_outline=[], ripas=[]):
    camadas = []
    gap = 25.0

    # 1. Tampo Superior (Posição X=0, Y=0)
    camadas.append({
        'layer': 'CORTE',
        'tipo': 'polyline',
        'fechada': True,
        'pontos': [{'x': p[0], 'y': p[1]} for p in top_outline]
    })

    # 2. Base Inferior (Posição X=0, Y = D + gap)
    offset_base_y = D + gap
    camadas.append({
        'layer': 'CORTE',
        'tipo': 'polyline',
        'fechada': True,
        'pontos': [{'x': p[0], 'y': p[1] + offset_base_y} for p in top_outline]
    })

    # 3. 4 Costelas Curvas de Reforço (Coluna X = W + gap)
    costela_x = W + gap
    costela_h = 130.0  # bounding box height of reforco_outline
    for k in range(4):
        offset_costela_y = k * (costela_h + gap)
        camadas.append({
            'layer': 'CORTE',
            'tipo': 'polyline',
            'fechada': True,
            'pontos': [{'x': p[0] + costela_x, 'y': p[1] + offset_costela_y} for p in reforco_outline]
        })

    # 4. As 3 Ripas Verticais Estruturais (Altura H)
    ripa_col_x = costela_x + R + 60.0
    ripa_largura = 70.0
    for idx, r in enumerate(ripas):
        rx0 = ripa_col_x + idx * (ripa_largura + gap)
        # Contorno retangular de corte da ripa
        camadas.append({
            'layer': 'CORTE',
            'tipo': 'polyline',
            'fechada': True,
            'pontos': [
                {'x': rx0, 'y': 0.0},
                {'x': rx0 + ripa_largura, 'y': 0.0},
                {'x': rx0 + ripa_largura, 'y': H},
                {'x': rx0, 'y': H}
            ]
        })
        # Rasgos de encaixe (USINAGEM em verde) onde as 4 costelas e as 2 tampas encaixam
        z_niveis = [0.0, (H - T) * 0.25, (H - T) * 0.45, (H - T) * 0.65, (H - T) * 0.85, H - T]
        for z in z_niveis:
            camadas.append({
                'layer': 'USINAGEM',
                'tipo': 'polyline',
                'fechada': True,
                'pontos': [
                    {'x': rx0 + 10.0, 'y': z},
                    {'x': rx0 + 10.0 + 35.0, 'y': z},
                    {'x': rx0 + 10.0 + 35.0, 'y': z + T},
                    {'x': rx0 + 10.0, 'y': z + T}
                ]
            })

    # 5. Casca Curvada Desenvolvida (Painel Flexível)
    # Comprimento desenvolvido:
    aba_frontal = W - R
    aba_lateral = max(0.0, D - R)
    arco_desenvolvido = (math.pi * R) / 2.0
    comp_total_casca = aba_frontal + arco_desenvolvido + aba_lateral

    casca_x = ripa_col_x + len(ripas) * (ripa_largura + gap) + gap
    # Contorno de corte da chapa desenvolvida
    camadas.append({
        'layer': 'CORTE',
        'tipo': 'polyline',
        'fechada': True,
        'pontos': [
            {'x': casca_x, 'y': 0.0},
            {'x': casca_x + comp_total_casca, 'y': 0.0},
            {'x': casca_x + comp_total_casca, 'y': H},
            {'x': casca_x, 'y': H}
        ]
    })

    # Canais de fresagem de dobra (FRESAGEM_DOBRA em amarelo) na zona da curva
    # Linhas verticais paralelas a cada 8 mm
    inicio_curva_x = casca_x + aba_frontal
    fim_curva_x = inicio_curva_x + arco_desenvolvido
    passo_dobra = 8.0
    num_fresagens = int(arco_desenvolvido / passo_dobra)
    for i in range(1, num_fresagens + 1):
        fx = inicio_curva_x + i * passo_dobra
        if fx < fim_curva_x:
            camadas.append({
                'layer': 'FRESAGEM_DOBRA',
                'tipo': 'line',
                'x1': fx,
                'y1': 0.0,
                'x2': fx,
                'y2': H
            })

    return camadas

print("Function ready.")
