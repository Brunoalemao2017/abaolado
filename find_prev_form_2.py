with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos = code.find('function previewActiveForm')
print(code[pos+300:pos+1000])
