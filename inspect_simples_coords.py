import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    simples = json.load(f)

print('top_outline point count:', len(simples['top_outline']))
print('front_path point count:', len(simples['front_path']))
print('front_flex_start_idx:', simples.get('front_flex_start_idx'), 'end:', simples.get('front_flex_end_idx'))
print('reforco_outline point count:', len(simples.get('reforco_outline', [])))
print('reforco_z:', simples.get('reforco_z'))
print('ripas:', simples.get('ripas'))
