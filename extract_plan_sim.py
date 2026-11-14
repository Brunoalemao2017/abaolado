import re
import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\original_logged_dashboard.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

m = re.search(r'var PLAN_SIM = ({.*?});', html)
if m:
    data = json.loads(m.group(1))
    print("=== PLAN_SIM ===")
    print("Planos:", data.get('planos'))
    for plan, items in data.get('matriz', {}).items():
        print(f"\nPlano [{plan}] ({len(items)} itens):")
        for it in items:
            print(f"  - {it}")
else:
    print("PLAN_SIM not found!")
