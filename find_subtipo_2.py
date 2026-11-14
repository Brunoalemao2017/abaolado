with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

target = 'function selecionarSubtipo'
idx = code.find(target)
if idx != -1:
    print(code[idx+1000:idx+3000])
