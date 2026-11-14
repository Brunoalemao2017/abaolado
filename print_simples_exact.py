import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    simples = json.load(f)

print('=== OFFICIAL CURVO SIMPLES ===')
print('largura:', simples.get('largura'), 'profundidade:', simples.get('profundidade'), 'altura:', simples.get('altura'), 'raio:', simples.get('raio'))
print('top_outline (first 5 and last 5):')
for p in simples['top_outline'][:5]: print(' ', p)
print(' ...')
for p in simples['top_outline'][-5:]: print(' ', p)

print('front_path (first 5 and last 5):')
for p in simples['front_path'][:5]: print(' ', p)
print(' ...')
for p in simples['front_path'][-5:]: print(' ', p)

print('front_flex_start_idx:', simples.get('front_flex_start_idx'), 'front_flex_end_idx:', simples.get('front_flex_end_idx'))

print('reforco_outline (first 5 and last 5):')
for p in simples['reforco_outline'][:5]: print(' ', p)
print(' ...')
for p in simples['reforco_outline'][-5:]: print(' ', p)

print('reforco_z:', simples.get('reforco_z'))
print('ripas:', json.dumps(simples.get('ripas'), indent=2))
