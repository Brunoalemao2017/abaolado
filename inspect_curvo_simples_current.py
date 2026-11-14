with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('calcularCurvoSimples(')
idx2 = text.find('calcularCurvoParafusado(')
print(text[idx:idx+1500])
