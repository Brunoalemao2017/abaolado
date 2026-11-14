with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function proxyParaCentral')
idx2 = text.find('// 2. IMPORTAÇÃO DOS ALGORITMOS')
print(text[idx:idx2])
