with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

target = 'data-sub="porta_puxador_cava_quadrado"'
idx = code.find(target)
if idx != -1:
    print('Found at', idx)
    print(code[max(0, idx-100):min(len(code), idx+800)])
else:
    print('Not found')
