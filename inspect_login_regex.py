import requests
import re

r = requests.get('https://centraldxf.com/login')
print("HTML slice containing input:")
inputs = re.findall(r'<input[^>]+>', r.text)
for inp in inputs:
    print(" ", inp)
