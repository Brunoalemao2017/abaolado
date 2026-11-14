import json

with open(r'C:\Users\bruno\.gemini\antigravity\brain\f1517c1c-1370-46b6-b13e-949629e7f830\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        idx = data.get('step_index')
        if idx in [800, 801, 802, 803, 804, 805, 806, 807]:
            print(f"Step {idx}: type={data.get('type')}, source={data.get('source')}")
            if 'tool_calls' in data:
                print("  Tool calls:", data['tool_calls'])
            if 'content' in data:
                print("  Content preview:", str(data['content'])[:200])
