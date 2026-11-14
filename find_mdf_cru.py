import os

target = "MDF Cru"
for root, dirs, files in os.walk(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro'):
    if 'node_modules' in root: continue
    for f in files:
        if f.endswith(('.js', '.html', '.css', '.json')):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    if target.lower() in content.lower():
                        print(f'Found in {f}')
            except:
                pass
