with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos1 = code.find('function addPortaCavaQuadrada')
pos2 = code.find('function addPortaCavaRedonda')

print('=== addPortaCavaQuadrada ===')
print(code[pos1:pos1+1800])
