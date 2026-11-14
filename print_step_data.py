import json

with open(r'C:\Users\bruno\.gemini\antigravity\brain\f1517c1c-1370-46b6-b13e-949629e7f830\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('step_index') == 803:
            print("=== STEP 803 VALUE ===")
            content = data.get('content')
            print(content)
        elif data.get('step_index') == 805:
            print("=== STEP 805 VALUE ===")
            content = data.get('content')
            print(content)
