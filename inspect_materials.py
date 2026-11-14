with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('materials:')
if idx != -1:
    print(text[idx-50:idx+1500])
else:
    idx2 = text.find('materials =')
    print(text[idx2-50:idx2+1500])
