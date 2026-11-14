with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

import re
matches = [m.start() for m in re.finditer(r'preview', code)]
for idx in matches[:10]:
    print(code[max(0, idx-50):min(len(code), idx+150)])
