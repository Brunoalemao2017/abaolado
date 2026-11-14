import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

fetches = re.findall(r'fetch\([\'"`]([^\'"`]+)[\'"`]', html)
actions = re.findall(r'action=[\'"]([^\'"]+)[\'"]', html)
urls = re.findall(r'url\s*:\s*[\'"]([^\'"]+)[\'"]', html)

print("Fetches:")
for f in set(fetches):
    print(" ", f)

print("\nForm Actions:")
for a in set(actions):
    print(" ", a)

print("\nAjax URLs:")
for u in set(urls):
    if '/' in u:
        print(" ", u)
