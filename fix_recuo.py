with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('const recuoBordo = 21.5;\n    const yDob1 = 100;', 'const recuoDobradica = 21.5;\n    const yDob1 = 100;')
text = text.replace('{ x: recuoBordo, y: yDob1, diametro: 35 }', '{ x: recuoDobradica, y: yDob1, diametro: 35 }')
text = text.replace('{ x: recuoBordo, y: yDob2, diametro: 35 }', '{ x: recuoDobradica, y: yDob2, diametro: 35 }')
text = text.replace('{ x: recuoBordo, y: H / 2, diametro: 35 }', '{ x: recuoDobradica, y: H / 2, diametro: 35 }')

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Fixed recuoDobradica in algorithms.js')
