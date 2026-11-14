with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos = code.find('id="wrapper_pe_conico"')
print(code[pos:pos+1500])
