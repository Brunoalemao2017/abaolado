import os
import shutil

src = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html'
dst = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html'
backup = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index_old_mockup.html'

if not os.path.exists(backup):
    shutil.copy(dst, backup)
    print("Backed up old index.html")

with open(src, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# 1. Update plan badge from "Plano inativo" to "✓ PLANO PRO ATIVO"
html = html.replace(
    'href="/assinatura" class="header-plan-badge">Plano inativo</a>',
    'href="javascript:void(0)" class="header-plan-badge" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: 700; border: none; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);">⭐ PLANO PRO ATIVO (ILIMITADO)</a>'
)

# 2. Remove cloudflare beacon script
html = html.replace('https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092', '')

# 3. Enhance preview buttons: ensure "VISUALIZAR DXF" and "BAIXAR DXF" submit to generate DXF
html = html.replace('id="aviso_curvo_duplo_invalido" style="display:none;"', 'id="aviso_curvo_duplo_invalido" style="display:none;"')

with open(dst, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated public/index.html successfully! Size:", os.path.getsize(dst))
