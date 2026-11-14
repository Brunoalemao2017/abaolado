with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos1 = code.find('function addPortaCavaQuadrada')
print(code[pos1+1500:pos1+3000])
