with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('calcularCurvoDuplo(')
idx2 = text.find('const camadas', idx)
print(text[idx2:idx2+1200])
