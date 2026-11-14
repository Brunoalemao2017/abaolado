with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos1 = code.find('function addPeOblongo')
pos2 = code.find('function addPeConicoQuadrado')
pos3 = code.find('function addPePorticoU')

print('=== addPeOblongo ===')
print(code[pos1:pos1+800])
print('=== addPeConicoQuadrado ===')
print(code[pos2:pos2+800])
print('=== addPePorticoU ===')
print(code[pos3:pos3+800])
