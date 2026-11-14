import json

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'r', encoding='utf-8') as f:
    duplo = json.load(f)

print("=== OFFICIAL CURVO DUPLO ===")
print("Keys:", list(duplo.keys()))
print("espessura_mdf:", duplo.get('espessura_mdf'))
print("altura:", duplo.get('altura'))
print("estrutura_z:", duplo.get('estrutura_z'))
print("estrutura_kind:", duplo.get('estrutura_kind'))
print("reforco_z:", duplo.get('reforco_z'))
print("reforco_outlines count:", len(duplo.get('reforco_outlines', [])))
for i, o in enumerate(duplo.get('reforco_outlines', [])):
    print(f"  outline {i} length: {len(o)}, first 3 pts: {o[:3]}")

print("\nripas count:", len(duplo.get('ripas', [])))
for r in duplo.get('ripas', []):
    print("  ripa:", r)

print("\nfront_flex_ranges:", duplo.get('front_flex_ranges'))
print("front_path length:", len(duplo.get('front_path', [])))
print("  front_path first 3:", duplo.get('front_path', [])[:3])
print("  front_path last 3:", duplo.get('front_path', [])[-3:])
print("top_outline length:", len(duplo.get('top_outline', [])))
print("  top_outline first 3:", duplo.get('top_outline', [])[:3])
print("  top_outline last 3:", duplo.get('top_outline', [])[-3:])
