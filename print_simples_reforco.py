import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    simples = json.load(f)

print('reforco_outline points:', len(simples['reforco_outline']))
for i, p in enumerate(simples['reforco_outline']):
    print(f'{i:2d}: [{p[0]:.2f}, {p[1]:.2f}]')
