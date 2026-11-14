with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

print('Length of algorithms.js:', len(text))
idx = text.find('calcularPortaCava')
print('calcularPortaCava section:')
print(text[idx:idx+1500])
