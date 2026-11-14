with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
scripts = re.findall(r'<script[^>]*src=[\'\"]([^\'\"]+)[\'\"][^>]*>', text)
print('Scripts in public/index.html:')
for s in scripts:
    print(' ', s)
