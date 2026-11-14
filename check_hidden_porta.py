with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

target = 'id="wrapper_porta"'
idx = code.find(target)
if idx != -1:
    print(code[idx:idx+800])
