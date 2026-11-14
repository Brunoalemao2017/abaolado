with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'app.post(\'/api/curvos/montado3d' in l:
        print(''.join(lines[i:i+90]))
        break
