import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\page_pecas_personalizadas_organica.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

print("Length of pecas_personalizadas HTML:", len(html))

# Search for cambotas, divisores, modes
modes = re.findall(r'mode=([a-zA-Z0-9_-]+)', html)
print("Unique modes in pecas-personalizadas:", set(modes))

hrefs = re.findall(r'href=["\'](/[^"\']+)["\']', html)
print("\nUnique routes in page:")
for h in set(hrefs):
    if not h.startswith('/static') and not h.startswith('/#') and len(h) < 40:
        print(" ", h)
