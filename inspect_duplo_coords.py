import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'r', encoding='utf-8') as f:
    duplo = json.load(f)

print('top_outline point count:', len(duplo['top_outline']))
print('front_path point count:', len(duplo['front_path']))
print('front_flex_ranges:', duplo['front_flex_ranges'])
print('reforco_outlines count:', len(duplo['reforco_outlines']))
for i, ro in enumerate(duplo['reforco_outlines']):
    print(f'  reforco {i} point count: {len(ro)}, start: {ro[0]}, end: {ro[-1]}')
print('reforco_z:', duplo['reforco_z'])
print('ripas:', duplo['ripas'])
