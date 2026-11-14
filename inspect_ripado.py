import re

with open('public/index.html', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'<form id="form_painel_ripado"[^>]*>(.*?)</form>', text, re.DOTALL)
if match:
    fields = re.findall(r'name="([^"]+)"', match.group(1))
    print('form_painel_ripado fields:', fields)
    for line in match.group(1).splitlines():
        if '<input' in line or '<select' in line:
            print(line.strip())
