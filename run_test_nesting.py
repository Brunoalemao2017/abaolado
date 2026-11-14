import json
import math

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    simples = json.load(f)

from test_nesting_simples import build_complete_camadas_simples

camadas = build_complete_camadas_simples(
    W=280.0, D=350.0, H=400.0, R=80.0, T=18.0,
    top_outline=simples['top_outline'],
    reforco_outline=simples['reforco_outline'],
    ripas=simples['ripas']
)

print('Total entities generated in camadas:', len(camadas))
layers = set(c['layer'] for c in camadas)
print('Layers present:', layers)
by_layer = {}
for c in camadas:
    by_layer[c['layer']] = by_layer.get(c['layer'], 0) + 1
print('Entities by layer:', by_layer)
