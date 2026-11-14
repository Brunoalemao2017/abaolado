import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\page_pecas_personalizadas_organica.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

titles = re.findall(r'<title>(.*?)</title>', html, re.IGNORECASE)
print("Title:", titles)

h1s = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', html, re.IGNORECASE)
print("Headings:")
for h in h1s[:10]:
    print(" ", h.strip())

scripts = re.findall(r'<script[^>]*src=[\'"]([^\'"]+)[\'"]', html)
print("\nScripts in pecas_personalizadas:")
for s in scripts:
    print(" ", s)
