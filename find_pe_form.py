with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

import re
pos = code.find('wrapper_pe_conico')
if pos != -1:
    print(code[pos:pos+1500])
else:
    # search for pe-conico or pe_conico forms
    matches = [m.start() for m in re.finditer(r'pe_conico|pe-conico', code)]
    for idx in matches[:5]:
        print(code[max(0, idx-100):min(len(code), idx+300)])
