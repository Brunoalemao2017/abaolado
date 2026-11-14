import json

with open(r'C:\Users\bruno\.gemini\antigravity\brain\f1517c1c-1370-46b6-b13e-949629e7f830\browser_sandbox\outputs\step_803.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

val = d.get('value', {})
print("--- SIMPLES SAMPLE (first 1000 chars) ---")
print(val.get('simplesSample', '')[:1000])

print("\n--- DUPLO SAMPLE (first 1000 chars) ---")
print(val.get('duploSample', '')[:1000])
