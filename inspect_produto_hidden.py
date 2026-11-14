with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('id="produto_hidden"')
if idx != -1:
    print(text[idx-50:idx+200])
else:
    print('id="produto_hidden" not found')
