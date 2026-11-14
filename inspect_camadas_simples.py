import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect where camadas is constructed in calcularCurvoSimples
idx = text.find('const camadas = [')
print(text[idx:idx+800])
