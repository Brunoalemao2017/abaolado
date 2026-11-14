with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('const isPorta =')
print(text[idx+500:idx+2000])
