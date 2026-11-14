with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos2 = code.find('function addPortaCavaRedonda')
print(code[pos2:pos2+1800])
