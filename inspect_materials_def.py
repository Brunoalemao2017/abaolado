with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('var materials =')
if idx != -1:
    print(text[idx:idx+1000])
else:
    idx2 = text.find('materials = {')
    print(text[idx2:idx2+1000])
