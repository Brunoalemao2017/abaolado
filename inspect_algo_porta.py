with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('calcularPortaCava')
if idx != -1:
    print(text[idx:idx+2000])
else:
    print('Not found')
