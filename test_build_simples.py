import math

def build_curvo_simples(W=280.0, D=350.0, H=400.0, R=80.0, T=18.0, gerarReforco=True):
    num_arc = 28
    
    # 1. front_path
    front_path = [[W, 0.0], [R, 0.0]]
    for s in range(1, num_arc):
        ang = 1.5 * math.pi - (0.5 * math.pi) * (s / num_arc)
        px = R + R * math.cos(ang)
        py = R + R * math.sin(ang)
        front_path.append([round(px, 4), round(py, 4)])
    front_path.append([0.0, R])
    front_path.append([0.0, D])

    # 2. top_outline
    top_outline = []
    for s in range(num_arc + 1):
        ang = 1.5 * math.pi - (0.5 * math.pi) * (s / num_arc)
        px = R + R * math.cos(ang)
        py = R + R * math.sin(ang)
        top_outline.append([round(px, 4), round(py, 4)])

    top_outline.append([T - 1.0, R])
    top_outline.append([T - 1.0, D])
    top_outline.append([0.0, D])
    top_outline.append([0.0, D - T])
    top_outline.append([70.0, D - T])
    top_outline.append([70.0, D])
    top_outline.append([W, D])

    y_ripa1_top = min(D, D * 0.8)
    y_ripa1_bot = max(0, D * 0.6)
    y_ripa2_top = min(D, D * 0.4)
    y_ripa2_bot = max(0, D * 0.2)

    top_outline.append([W, y_ripa1_top])
    top_outline.append([W - T, y_ripa1_top])
    top_outline.append([W - T, y_ripa1_bot])
    top_outline.append([W, y_ripa1_bot])

    top_outline.append([W, y_ripa2_top])
    top_outline.append([W - T, y_ripa2_top])
    top_outline.append([W - T, y_ripa2_bot])
    top_outline.append([W, y_ripa2_bot])

    top_outline.append([W, T - 1.0])
    top_outline.append([R, T - 1.0])
    top_outline.append([R, 0.0])

    # 3. ripas
    ripas = [
        {"x0": W - T, "x1": W, "y0": y_ripa1_bot, "y1": y_ripa1_top},
        {"x0": W - T, "x1": W, "y0": y_ripa2_bot, "y1": y_ripa2_top},
        {"x0": 0.0, "x1": 70.0, "y0": D - T, "y1": D}
    ]

    # 4. reforco_outline (Costela curva paramétrica)
    R_int = max(10.0, R - 40.5)
    reforco_outline = []
    # Start tab
    reforco_outline.append([T + 0.55, 122.0])
    reforco_outline.append([T + 0.55, 62.0])
    reforco_outline.append([2.05, 62.0])
    # Outer arc
    for s in range(1, num_arc):
        ang = math.pi - (0.5 * math.pi) * (s / num_arc)
        # from py=62 to py=0, px from ~2 to R
        px = R + R * math.cos(1.5 * math.pi - (0.5 * math.pi) * ((num_arc - s) / num_arc))
        py = R + R * math.sin(1.5 * math.pi - (0.5 * math.pi) * ((num_arc - s) / num_arc))
        reforco_outline.append([round(px, 4), round(py, 4)])
    reforco_outline.append([R, 0.0])
    reforco_outline.append([R, R_int])
    # Inner arc
    for s in range(num_arc - 1, 0, -1):
        ang = 1.5 * math.pi - (0.5 * math.pi) * (s / num_arc)
        px = R + R_int * math.cos(ang)
        py = R + R_int * math.sin(ang)
        reforco_outline.append([round(px, 4), round(py, 4)])
    reforco_outline.append([36.55, 66.5])
    reforco_outline.append([36.55, 122.0])
    reforco_outline.append([T + 0.55, 122.0])

    reforco_z = [
        round((H - T) * 0.25, 1),
        round((H - T) * 0.45, 1),
        round((H - T) * 0.65, 1),
        round((H - T) * 0.85, 1)
    ]

    return {
        "kind": "curvo_simples",
        "altura": H,
        "espessura_mdf": T,
        "espessura_flex": 1.0,
        "largura": W,
        "profundidade": D,
        "raio_nominal": R,
        "raio_max_permitido": min(W - 10, D - 10),
        "estrutura_z": [0.0, H - T],
        "estrutura_kind": ["bottom", "top"],
        "reforco_z": reforco_z if gerarReforco else [],
        "reforco_ativo": gerarReforco,
        "reforco_auto_desativado": False,
        "top_outline": top_outline,
        "front_path": front_path,
        "front_flex_start_idx": 1,
        "front_flex_end_idx": len(front_path) - 2,
        "reforco_outline": reforco_outline,
        "reforco_outlines": [reforco_outline],
        "ripas": ripas
    }

simples = build_curvo_simples()
print("Built simples keys:", list(simples.keys()))
print("top_outline count:", len(simples["top_outline"]))
print("front_path count:", len(simples["front_path"]))
print("reforco_outline count:", len(simples["reforco_outline"]))
