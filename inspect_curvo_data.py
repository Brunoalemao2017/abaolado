with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('curvoSimplesData')
while idx != -1:
    print(text[idx-50:idx+300])
    print('---')
    idx = text.find('curvoSimplesData', idx+1)
