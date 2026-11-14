import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\pecas-personalizadas.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

fetches = re.findall(r'fetch\([\'"`]([^\'"`]+)[\'"`]', html)
actions = re.findall(r'action=[\'"]([^\'"]+)[\'"]', html)

print("Fetches in pecas-personalizadas.html:")
for f in set(fetches):
    print(" ", f)

print("\nForm Actions in pecas-personalizadas.html:")
for a in set(actions):
    print(" ", a)
