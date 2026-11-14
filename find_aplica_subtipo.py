with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

target = 'function _aplicarSubtipo'
idx = code.find(target)
if idx != -1:
    print(code[idx:idx+1500])
