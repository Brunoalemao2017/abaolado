with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos = code.find('function proxyParaCentral')
print(code[pos:pos+1200])
