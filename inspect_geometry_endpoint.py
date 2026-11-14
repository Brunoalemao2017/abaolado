with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('geometryEndpoint')
if idx != -1:
    print(text[max(0, idx-200):idx+800])
else:
    print('Not found')
