import json

with open(r'C:\Users\bruno\.gemini\antigravity\brain\f1517c1c-1370-46b6-b13e-949629e7f830\browser_sandbox\outputs\step_803.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
    print("Keys in step_803.json:", d.keys())
    if 'simplesSample' in d:
        print("simplesSample length:", len(d['simplesSample']))
    if 'duploSample' in d:
        print("duploSample length:", len(d['duploSample']))
