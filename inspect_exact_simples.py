import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'r', encoding='utf-8') as f:
    simples = json.load(f)

print("=== OFFICIAL CURVO SIMPLES ===")
print("Keys:", list(simples.keys()))
print("espessura_mdf:", simples.get('espessura_mdf'))
print("altura:", simples.get('altura'))
print("estrutura_z:", simples.get('estrutura_z'))
print("reforco_z:", simples.get('reforco_z'))
print("reforco_outline length:", len(simples.get('reforco_outline', [])))
print("ripas:", simples.get('ripas'))
print("front_flex_start_idx:", simples.get('front_flex_start_idx'), "front_flex_end_idx:", simples.get('front_flex_end_idx'))
print("front_path length:", len(simples.get('front_path', [])))
print("top_outline length:", len(simples.get('top_outline', [])))
