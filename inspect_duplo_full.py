import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'r', encoding='utf-8') as f:
    duplo = json.load(f)

print('=== DUPLO KEYS & TYPES ===')
for k, v in duplo.items():
    if isinstance(v, list):
        print(f'{k}: list of {len(v)} items. Item 0 sample: {v[0] if len(v)>0 else None}')
    elif isinstance(v, dict):
        print(f'{k}: dict with keys {list(v.keys())}')
    else:
        print(f'{k}: {type(v).__name__} = {v}')

print('\n=== DUPLO RIPAS ===')
print(json.dumps(duplo.get('ripas'), indent=2))

print('\n=== DUPLO REFORCO_Z ===')
print(duplo.get('reforco_z'))

print('\n=== DUPLO ESTRUTURA_Z ===')
print(duplo.get('estrutura_z'))
