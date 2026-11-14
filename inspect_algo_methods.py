with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
methods = re.findall(r'^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{', text, re.MULTILINE)
print('Methods in algorithms.js:')
for m in methods:
    print(' ', m)
