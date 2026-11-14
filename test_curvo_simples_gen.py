import math

def generate_curvo_simples(W=280, D=350, H=400, R=80, T=18, gerar_reforco=True):
    # Top outline of Simples (L-shape with rounded outside corner or curved corner)
    # The curve is at x in [0, R], y in [0, R] or similar
    # In official_curvo_simples:
    # W=280, D=350, R=80
    top_outline = []
    num_pts = 32
    
    # Outer contour:
    # from (R, 0) straight to (W, 0)
    top_outline.append([float(R), 0.0])
    top_outline.append([float(W), 0.0])
    top_outline.append([float(W), float(D)])
    top_outline.append([0.0, float(D)])
    top_outline.append([0.0, float(R)])
    # Arc from (0, R) to (R, 0) centered at (R, R)
    for i in range(1, num_pts):
        angle = math.pi + (math.pi / 2.0) * (i / num_pts)
        px = R + R * math.cos(angle)
        py = R + R * math.sin(angle)
        top_outline.append([round(px, 2), round(py, 2)])
    top_outline.append([float(R), 0.0])

    # Reforço rib (costela interna curva com largura ~50mm)
    largura_costela = min(50.0, R - 10.0)
    r_int = R - largura_costela
    reforco_outline = []
    # Arc exterior (along curve)
    for i in range(num_pts + 1):
        angle = math.pi + (math.pi / 2.0) * (i / num_pts)
        px = R + (R - 2.0) * math.cos(angle)
        py = R + (R - 2.0) * math.sin(angle)
        reforco_outline.append([round(px, 2), round(py, 2)])
    # Straight segment back
    reforco_outline.append([round(R, 2), round(largura_costela + 20, 2)])
    # Arc interior
    for i in range(num_pts, -1, -1):
        angle = math.pi + (math.pi / 2.0) * (i / num_pts)
        px = R + r_int * math.cos(angle)
        py = R + r_int * math.sin(angle)
        reforco_outline.append([round(px, 2), round(py, 2)])
    reforco_outline.append([reforco_outline[0][0], reforco_outline[0][1]])

    # Reforço Z heights
    reforco_z = [
        round((H - T) * 0.25, 1),
        round((H - T) * 0.45, 1),
        round((H - T) * 0.65, 1),
        round((H - T) * 0.85, 1)
    ]

    # Uprights / ripas
    ripas = [
        {"x0": float(W - T), "x1": float(W), "y0": float(D * 0.6), "y1": float(D * 0.8)},
        {"x0": float(W - T), "x1": float(W), "y0": float(D * 0.2), "y1": float(D * 0.4)},
        {"x0": 0.0, "x1": 70.0, "y0": float(D - T), "y1": float(D)}
    ]

    # Front path for flexible skin
    front_path = []
    front_path.append([float(W), 0.0])
    front_path.append([float(R), 0.0])
    for i in range(1, num_pts):
        angle = (3 * math.pi / 2) - (math.pi / 2) * (i / num_pts)
        px = R + R * math.cos(angle)
        py = R + R * math.sin(angle)
        front_path.append([round(px, 2), round(py, 2)])
    front_path.append([0.0, float(R)])
    front_path.append([0.0, float(D)])

    return {
        "kind": "curvo_simples",
        "top_outline": top_outline,
        "front_path": front_path,
        "front_flex_start_idx": 1,
        "front_flex_end_idx": len(front_path) - 2,
        "espessura_flex": 1.0,
        "espessura_mdf": float(T),
        "altura": float(H),
        "largura": float(W),
        "profundidade": float(D),
        "raio_nominal": float(R),
        "estrutura_z": [0.0, float(H - T)],
        "estrutura_kind": ["bottom", "top"],
        "reforco_outline": reforco_outline,
        "reforco_z": reforco_z if gerar_reforco else [],
        "ripas": ripas,
        "reforco_ativo": gerar_reforco,
        "reforco_auto_desativado": False
    }

res = generate_curvo_simples()
print("Generated curvo_simples keys:", list(res.keys()))
print("top_outline len:", len(res["top_outline"]))
print("reforco_outline len:", len(res["reforco_outline"]))
print("front_path len:", len(res["front_path"]))
print("ripas:", res["ripas"])
