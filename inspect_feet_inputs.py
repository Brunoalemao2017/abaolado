with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
forms = ['form_pe_conico', 'form_pe_redondo', 'form_pe_oval', 'form_pe_oblongo']
for fid in forms:
    idx = text.find(f'id="{fid}"')
    if idx != -1:
        inputs = re.findall(r'<input\b[^>]*name=[\'\"]([^\'\"]+)[\'\"][^>]*>', text[idx:idx+1500])
        print(f'{fid} inputs: {inputs}')
