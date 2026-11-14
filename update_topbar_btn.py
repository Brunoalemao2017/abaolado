path = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

html = html.replace(
    '<a href="/assinatura" class="btn sm btn-subscribe">Plano inativo</a>',
    '<span class="btn sm btn-subscribe" style="background: linear-gradient(135deg, #7c3aed, #4f46e5) !important; color: #fff !important; font-weight: 800; border-radius: 9999px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.45) !important; cursor: default; letter-spacing: 0.5px; padding: 6px 16px;">⭐ PLANO EXPERT ATIVO</span>'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated topbar button in public/index.html!")
