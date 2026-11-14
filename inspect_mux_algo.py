with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('calcularMuxarabiEncaixado')
idx2 = text.find('calcularMuxarabi(', idx)
print(text[idx:idx2])
