with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('MDF Cru')
print('MDF Cru in index.html:', idx)
if idx != -1:
    print(text[idx-100:idx+400])
