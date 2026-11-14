with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

import re
pos1 = code.find('id="wrapper_porta"')
pos2 = code.find('</form>', pos1)
porta_form_html = code[pos1:pos2]

inputs = re.findall(r'<input[^>]+>|<select[^>]+>', porta_form_html)
for inp in inputs:
    print(inp)
