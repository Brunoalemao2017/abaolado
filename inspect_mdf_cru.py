with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('MDF Cru')
if idx == -1:
    idx = text.find('mdf_cru')
if idx == -1:
    idx = text.find('mdf')
print('MDF found at:', idx)
if idx != -1:
    print(text[idx-50:idx+600])
