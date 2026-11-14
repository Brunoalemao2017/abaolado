import requests

r = requests.get('http://localhost:3000/pecas-personalizadas?mode=tampos_organicos')
print("Status code:", r.status_code)
print("Content-Type:", r.headers.get('Content-Type'))
print("Content length:", len(r.text))
print("Starts with:", r.text[:100])
