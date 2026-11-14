with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos_start = code.find('calcularPeConico(params) {')
pos_end = code.find('calcularPeOval(params) {')
print(code[pos_start+600:pos_start+2000])
