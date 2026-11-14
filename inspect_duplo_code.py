with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos_start = code.find('calcularCurvoDuplo(params) {')
pos_end = code.find('calcularPortaCava(params) {')
print(f'calcularCurvoDuplo length: {pos_end - pos_start}')
print(code[pos_start:pos_start+600])
