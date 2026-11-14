import requests

r = requests.get('http://localhost:3000/pecas-personalizadas?mode=tampos_organicos')
print(r.text)
