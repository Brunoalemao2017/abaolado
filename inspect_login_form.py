import requests
import re

s = requests.Session()
r = s.get('https://centraldxf.com/login')
print('Page status:', r.status_code)
inputs = re.findall(r'<input[^>]+>', r.text)
for inp in inputs:
    print(' ', inp)
forms = re.findall(r'<form[^>]+>', r.text)
for f in forms:
    print('form:', f)
