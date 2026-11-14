import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    simples = json.load(f)

print('=== SIMPLES KEYS & TYPES ===')
for k, v in simples.items():
    if isinstance(v, list):
        print(f'{k}: list of {len(v)} items. Item 0 sample: {v[0] if len(v)>0 else None}')
    elif isinstance(v, dict):
        print(f'{k}: dict with keys {list(v.keys())}')
    else:
        print(f'{k}: {type(v).__name__} = {v}')

print('\n=== SIMPLES RIPAS ===')
print(json.dumps(simples.get('ripas'), indent=2))

print('\n=== SIMPLES REFORCO_OUTLINE ===')
if 'reforco_outlines' in simples:
    print('reforco_outlines len:', len(simples['reforco_outlines']))
elif 'reforco_outline' in simples:
    print('reforco_outline len:', len(simples['reforco_outline']))

print('\n=== SIMPLES REFORCO_Z ===')
print(simples.get('reforco_z'))
