# Generate clean SVG from DXF
with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\canto_curvo_simples_completo.dxf', 'r', encoding='utf-8') as f:
    lines = [line.strip() for line in f]

color_map = {
    'CORTE': '#ef4444',         # Vermelho (Corte passante)
    'USINAGEM': '#22c55e',      # Verde (Rasgos de encaixe)
    'FRESAGEM_DOBRA': '#eab308',# Amarelo (Canais de dobra)
    'FURACAO': '#3b82f6',       # Azul
    'COTAS': '#94a3b8'          # Cinza
}

paths_svg = []
min_x, min_y, max_x, max_y = 1e9, 1e9, -1e9, -1e9

i = 0
while i < len(lines):
    if lines[i] == '0' and i + 1 < len(lines) and lines[i+1] == 'POLYLINE':
        layer = 'CORTE'
        i += 2
        while i < len(lines) and not (lines[i] == '0' and lines[i+1] == 'VERTEX'):
            if lines[i] == '8': layer = lines[i+1]
            i += 1
        
        pts = []
        while i < len(lines) and not (lines[i] == '0' and lines[i+1] == 'SEQEND'):
            if lines[i] == '0' and lines[i+1] == 'VERTEX':
                vx, vy = 0.0, 0.0
                i += 2
                while i < len(lines) and not (lines[i] == '0'):
                    if lines[i] == '10': vx = float(lines[i+1])
                    elif lines[i] == '20': vy = float(lines[i+1])
                    i += 1
                pts.append((vx, vy))
                min_x = min(min_x, vx); min_y = min(min_y, vy)
                max_x = max(max_x, vx); max_y = max(max_y, vy)
            else:
                i += 1
        if pts:
            d = f"M {pts[0][0]:.2f} {pts[0][1]:.2f} " + " ".join(f"L {p[0]:.2f} {p[1]:.2f}" for p in pts[1:]) + " Z"
            c = color_map.get(layer, '#ef4444')
            paths_svg.append(f'<path d="{d}" stroke="{c}" stroke-width="2" fill="none" />')
    elif lines[i] == '0' and i + 1 < len(lines) and lines[i+1] == 'LINE':
        layer = 'CORTE'
        x1, y1, x2, y2 = 0.0, 0.0, 0.0, 0.0
        i += 2
        while i < len(lines) and not (lines[i] == '0'):
            if lines[i] == '8': layer = lines[i+1]
            elif lines[i] == '10': x1 = float(lines[i+1])
            elif lines[i] == '20': y1 = float(lines[i+1])
            elif lines[i] == '11': x2 = float(lines[i+1])
            elif lines[i] == '21': y2 = float(lines[i+1])
            i += 1
        min_x = min(min_x, x1, x2); min_y = min(min_y, y1, y2)
        max_x = max(max_x, x1, x2); max_y = max(max_y, y1, y2)
        c = color_map.get(layer, '#eab308')
        paths_svg.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{c}" stroke-width="1.5" stroke-dasharray="4,4" />')
    else:
        i += 1

pad = 40
w = (max_x - min_x) + pad * 2
h = (max_y - min_y) + pad * 2

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{min_x - pad} {min_y - pad} {w} {h}" width="1000" height="{int(1000 * h / w)}" style="background:#0b1120;">
  <g transform="scale(1, -1) translate(0, -{max_y + min_y})">
    {''.join(paths_svg)}
  </g>
</svg>'''

svg_path = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\dxf_corte_completo.svg'
with open(svg_path, 'w', encoding='utf-8') as f:
    f.write(svg)
print('Saved SVG to:', svg_path)
