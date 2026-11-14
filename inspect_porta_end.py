with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('calcularPortaCava')
idx2 = text.find('calcularPrateleiraDupla', idx)
print(text[idx2-800:idx2])
