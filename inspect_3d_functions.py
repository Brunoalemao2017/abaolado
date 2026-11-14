with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
funcs = re.findall(r'function\s+([a-zA-Z0-9_]+)\s*\(', text)
print('Functions in curvo_preview3d.js:')
for fn in funcs:
    if any(k in fn.lower() for k in ['add', 'build', 'porta', 'ripa', 'muxarabi', 'curvo', 'panel', 'shelf']):
        print(' ', fn)
