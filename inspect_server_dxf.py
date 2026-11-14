with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines[460:510], 461):
    print(f'{i}: {l}', end='')
