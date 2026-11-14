with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'recuoBordo', text)]
for m in matches:
    print(text[max(0, m-50):m+150])
    print('---')
