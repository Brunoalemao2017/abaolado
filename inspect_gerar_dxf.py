with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function gerarConteudoDXF')
print(text[idx:idx+2500])
