import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

submits = re.findall(r'<button[^>]*type=["\']submit["\'][^>]*>.*?</button>', html, re.DOTALL)
print(f"Total submit buttons: {len(submits)}")
for b in submits[:5]:
    print(" ", repr(b.strip()[:100]))
