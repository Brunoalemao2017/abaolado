import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

scripts = re.findall(r'<script[^>]*src=[\'"]([^\'"]+)[\'"]', html)
links = re.findall(r'<link[^>]*href=[\'"]([^\'"]+)[\'"]', html)

print("External scripts:")
for s in scripts:
    print(" ", s)

print("\nExternal stylesheets:")
for l in links:
    if 'stylesheet' in l or '.css' in l:
        print(" ", l)

print(f"\nTotal length of HTML: {len(html)} chars")
