import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

matches = [m.start() for m in re.finditer(r'expert', html, re.IGNORECASE)]
print(f"Total matches for 'expert': {len(matches)}")

for idx in matches[:10]:
    start = max(0, idx - 200)
    end = min(len(html), idx + 200)
    print("--------------------------------------------------")
    print(html[start:end].strip())
