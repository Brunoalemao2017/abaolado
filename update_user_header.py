import re

path = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# 1. Update user email greeting
html = html.replace('brunoantonio837@gmail.com', 'brunoalemao2025@gmail.com')

# 2. Update plan badge
html = re.sub(
    r'<a[^>]*class=["\']header-plan-badge["\'][^>]*>.*?</a>',
    '<span class="header-plan-badge" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: 700; border: none; padding: 4px 12px; border-radius: 9999px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35); font-size: 11px; letter-spacing: 0.5px;">✓ PLANO PRO ILIMITADO ATIVO</span>',
    html,
    flags=re.IGNORECASE
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated email and plan badge in public/index.html!")
