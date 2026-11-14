with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
forms = re.findall(r'<form[^>]+id=[\'\"]([^\'\"]*porta[^\'\"]*)[\'\"][^>]*>', text, re.IGNORECASE)
print('Porta forms:', forms)

idx = text.find('id="formPorta')
if idx == -1:
    idx = text.find('cava')
print('Index:', idx)
if idx != -1:
    print(text[max(0, idx-100):idx+800])
