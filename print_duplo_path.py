import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'r', encoding='utf-8') as f:
    duplo = json.load(f)

print('duplo front_path point 0 to 5:')
for p in duplo['front_path'][:5]: print(' ', p)
print('duplo front_path points around flex 1:')
for i in [28, 29, 30, 31]: print(f' {i}:', duplo['front_path'][i])
print('duplo front_path points at end:')
for p in duplo['front_path'][-5:]: print(' ', p)
