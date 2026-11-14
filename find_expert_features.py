import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

for target in ['cambotas', 'tampos_organicos', 'pecas_personalizadas_organica', 'wrapper_']:
    matches = [m.start() for m in re.finditer(re.escape(target), html, re.IGNORECASE)]
    print(f"Target '{target}': {len(matches)} occurrences")

# Find all wrapper_ IDs
wrappers = re.findall(r'id=["\'](wrapper_[^"\']+)["\']', html)
print("\nAll Product Wrappers in HTML:")
for w in set(wrappers):
    print(" ", w)
