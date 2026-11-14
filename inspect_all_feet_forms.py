with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
matches = re.findall(r'<form\b[^>]*id=[\'\"]([^\'\"]*pe[^\'\"]*|revestimento[^\'\"]*)[\'\"][^>]*>', text)
print('Feet forms found:', matches)
