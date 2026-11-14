import requests

r = requests.get('http://localhost:3000/')
print("Status code:", r.status_code)
print("Contains 'PLANO EXPERT ATIVO':", 'PLANO EXPERT ATIVO' in r.text)
print("Contains 'Plano inativo':", 'Plano inativo' in r.text)
