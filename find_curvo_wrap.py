with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

pos = code.find('id="curvo_preview_wrap"')
print(code[max(0, pos-200):pos+1200])
