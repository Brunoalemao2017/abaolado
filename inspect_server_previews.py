with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'app\.(?:post|get)\([\'\"](/[^\'\"]*preview[^\'\"]*)[\'\"]', text)
print('Preview routes in server.js:')
for m in matches:
    print(' ', m)
