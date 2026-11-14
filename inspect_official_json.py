import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'r', encoding='utf-8') as f:
    duplo = json.load(f)

print('official_curvo_duplo keys:', list(duplo.keys()))
for k in duplo:
    if isinstance(duplo[k], (list, dict)):
        print(f'  {k}: length {len(duplo[k])}')
    else:
        print(f'  {k}: {duplo[k]}')
