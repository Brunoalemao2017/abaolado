import re

path = r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html'

with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# 1. Update PLAN_SIM initial to expert
html = re.sub(
    r'"inicial":\s*"pro"',
    '"inicial": "expert"',
    html
)

# 2. Update simulator button active state
html = re.sub(
    r'<button type="button" class="plan-sim-card[^"]*" data-plan="pro"[^>]*>',
    '<button type="button" class="plan-sim-card" data-plan="pro" aria-pressed="false" onclick="simularPlano(\'pro\')">',
    html
)
html = re.sub(
    r'<button type="button" class="plan-sim-card[^"]*" data-plan="expert"[^>]*>',
    '<button type="button" class="plan-sim-card active" data-plan="expert" aria-pressed="true" onclick="simularPlano(\'expert\')">',
    html
)

# 3. Update header plan badge to Expert
html = re.sub(
    r'<span class="header-plan-badge"[^>]*>.*?</span>',
    '<span class="header-plan-badge" style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: #ffffff; font-weight: 800; border: none; padding: 5px 14px; border-radius: 9999px; box-shadow: 0 2px 10px rgba(124, 58, 237, 0.45); font-size: 11px; letter-spacing: 0.5px;">⭐ PLANO EXPERT ILIMITADO (TODOS OS RECURSOS)</span>',
    html
)

# 4. Make Category buttons for Cambotas, Divisores, Peças Personalizadas visible
html = html.replace('data-cat="cambotas" onclick="abrirCambotas()" style="display:none"', 'data-cat="cambotas" onclick="abrirCambotas()" style="display:inline-flex"')
html = html.replace('data-cat="divisores" onclick="abrirDivisores()" style="display:none"', 'data-cat="divisores" onclick="abrirDivisores()" style="display:inline-flex"')

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated index.html with Expert features unlocked!")
