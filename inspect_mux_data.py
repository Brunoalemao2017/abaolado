with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('muxarabiData')
if idx != -1:
    print(text[idx-50:idx+1500])
else:
    print('muxarabiData not found')
