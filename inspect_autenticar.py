with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function autenticarCentralDXF')
print(text[idx:idx+1500])
