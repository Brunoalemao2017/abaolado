with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('/api/curvos/montado3d')
print(text[idx:idx+2500])
