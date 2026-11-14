with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('calcularCurvoSimples(')
idx2 = text.find('const curvoSimplesData', idx)
print(text[idx+1200:idx2])
