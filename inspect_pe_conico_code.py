with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos_start = code.find('calcularPeConico(params) {')
pos_end = code.find('calcularPeOval(params) {')
if pos_end == -1:
    pos_end = code.find('calcularTampoOrganico(params) {')

print(f'calcularPeConico length: {pos_end - pos_start}')
print(code[pos_start:pos_start+600])
