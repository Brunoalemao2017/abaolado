with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

import re
matches = [m.start() for m in re.finditer(r'<canvas', code)]
for idx in matches:
    print(code[max(0, idx-300):min(len(code), idx+500)])
