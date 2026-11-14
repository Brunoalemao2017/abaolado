import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

for target in ['cambotas', 'tampos_organicos', 'pp_organica', 'pp_tampos', 'simularPlano']:
    print(f"\n=================== SEARCH: {target} ===================")
    for m in re.finditer(re.escape(target), html):
        idx = m.start()
        start = max(0, idx - 150)
        end = min(len(html), idx + 250)
        print(html[start:end].strip())
        print("-" * 40)
