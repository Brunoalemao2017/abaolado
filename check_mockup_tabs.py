with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index_old_mockup.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

import re
matches = [m.start() for m in re.finditer(r'mdf\s*cru|2D CAD', code, re.IGNORECASE)]
for idx in matches:
    print(code[max(0, idx-100):min(len(code), idx+400)])
