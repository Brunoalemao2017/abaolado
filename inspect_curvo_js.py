import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

fetch_calls = re.findall(r'fetch\([^\)]+\)', text)
print('fetch count:', len(fetch_calls))
for fc in fetch_calls[:10]:
    print(fc)

endpoints = re.findall(r'[\'\"](/[a-zA-Z0-9_\-\./]+)[\'\"]', text)
print('unique endpoints in curvo_preview3d.js:')
for ep in sorted(set(endpoints)):
    if len(ep) > 2:
        print(' ', ep)
