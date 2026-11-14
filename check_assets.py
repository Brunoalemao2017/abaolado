import re
import os

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

srcs = re.findall(r'src=["\']([^"\']+)["\']', html)
static_files = [s for s in srcs if s.startswith('/static/')]

print("Static files referenced in HTML:")
missing = []
for s in set(static_files):
    clean = s.split('?')[0].replace('/static/', '')
    local_path = os.path.join(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static', clean)
    exists = os.path.exists(local_path)
    print(f"  {s} -> exists: {exists}")
    if not exists:
        missing.append((s, local_path))

print("\nMissing files:", len(missing))
