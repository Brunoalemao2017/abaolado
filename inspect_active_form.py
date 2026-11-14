with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('requestedForm =')
if idx == -1:
    idx = text.find('activeForm(')
print(text[idx-50:idx+600])
