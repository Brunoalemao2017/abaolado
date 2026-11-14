with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
forms = re.findall(r'<form\b[^>]*>', text)
print('Forms in public/index.html count:', len(forms))
for f in forms:
    print(' ', f[:120])
