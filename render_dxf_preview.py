import matplotlib.pyplot as plt
import re

# Read the generated DXF
with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\canto_curvo_simples_completo.dxf', 'r', encoding='utf-8') as f:
    lines = [line.strip() for line in f]

fig, ax = plt.subplots(figsize=(12, 8), dpi=150)
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

color_map = {
    'CORTE': '#ef4444',         # Red
    'USINAGEM': '#22c55e',      # Green
    'FRESAGEM_DOBRA': '#eab308',# Yellow
    'FURACAO': '#3b82f6',       # Blue
    'COTAS': '#94a3b8'          # Slate
}

i = 0
while i < len(lines):
    if lines[i] == '0' and i + 1 < len(lines) and lines[i+1] == 'POLYLINE':
        layer = 'CORTE'
        i += 2
        while i < len(lines) and not (lines[i] == '0' and lines[i+1] == 'VERTEX'):
            if lines[i] == '8':
                layer = lines[i+1]
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
            else:
                i += 1
        if pts:
            pts.append(pts[0]) # closed
            xs, ys = zip(*pts)
            ax.plot(xs, ys, color=color_map.get(layer, '#ef4444'), linewidth=1.2)
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
        ax.plot([x1, x2], [y1, y2], color=color_map.get(layer, '#eab308'), linewidth=0.8, linestyle='--')
    else:
        i += 1

ax.set_aspect('equal')
ax.axis('off')
plt.title('Central DXF PRO - Plano de Corte Completo CNC (Nesting R12)', color='#f8fafc', fontsize=14, pad=15)
plt.tight_layout()

out_path = r'C:\Users\bruno\.gemini\antigravity\brain\72f4ef3d-599d-43cb-b3b2-c311ae600631\dxf_corte_completo_preview.png'
plt.savefig(out_path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
print('Saved rendered DXF to:', out_path)
