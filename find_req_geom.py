with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

target = 'function requestGeometry'
idx = code.find(target)
if idx != -1:
    print(code[idx:idx+1500])
