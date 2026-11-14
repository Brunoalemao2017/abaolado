with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('var thickness = Number(data.espessura_mdf)')
print(text[idx:idx+3500])
