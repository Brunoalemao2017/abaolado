with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'const camadas\s*=', text)]
for idx in matches:
    print('camadas at index', idx)
    print(text[idx-40:idx+200])
    print('---')
