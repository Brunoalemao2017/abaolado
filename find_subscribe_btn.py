import re

path = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

matches = [m.start() for m in re.finditer(r'btn-subscribe', html)]
print(f"Matches for btn-subscribe: {len(matches)}")
for idx in matches:
    start = max(0, idx - 100)
    end = min(len(html), idx + 150)
    print("----------------------------")
    print(html[start:end].strip())
