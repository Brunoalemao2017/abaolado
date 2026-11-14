import requests
from bs4 import BeautifulSoup

r = requests.get('https://centraldxf.com/login')
soup = BeautifulSoup(r.text, 'html.parser')
form = soup.find('form')
if form:
    print("Form action:", form.get('action'))
    print("Form method:", form.get('method'))
    for inp in form.find_all(['input', 'button']):
        print("  input:", inp.get('name'), inp.get('type'), inp.get('value'))
else:
    print("No form found!")
