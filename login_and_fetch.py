import requests
import json
import re

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

# 1. GET login page
r1 = s.get('https://centraldxf.com/login')
print("Login page status:", r1.status_code)

# Check for CSRF token if any
csrf = None
m = re.search(r'name=["\']csrf[_-]?token["\']\s+value=["\']([^"\']+)["\']', r1.text)
if m:
    csrf = m.group(1)
    print("Found CSRF:", csrf)

# 2. POST login
login_data = {
    'email': 'brunoalemao2025@gmail.com',
    'senha': 'Bruno2017@',
    'password': 'Bruno2017@'
}
if csrf:
    login_data['csrf_token'] = csrf

r2 = s.post('https://centraldxf.com/login', data=login_data, allow_redirects=True)
print("Login post status:", r2.status_code, "URL:", r2.url)
print("Cookies:", s.cookies.get_dict())

# 3. Test /api/curvos/montado3d
r3 = s.post('https://centraldxf.com/api/curvos/montado3d', data={
    'tipo_curvo': 'simples',
    'largura': '280',
    'profundidade': '350',
    'altura': '400',
    'raio': '80',
    'espessura_mdf': '18',
    'gerar_reforco': '1'
})
print("/api/curvos/montado3d (simples) status:", r3.status_code)
if r3.status_code == 200:
    data_simples = r3.json()
    with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'w', encoding='utf-8') as f:
        json.dump(data_simples, f, indent=2)
    print("SUCCESS! Saved official_curvo_simples.json with keys:", list(data_simples.keys()))

# 4. Test curvo duplo
r4 = s.post('https://centraldxf.com/api/curvos/montado3d', data={
    'tipo_curvo': 'duplo_vertical',
    'largura': '400',
    'profundidade': '300',
    'altura': '400',
    'raio': '80',
    'espessura_mdf': '18',
    'gerar_reforco': '1'
})
print("/api/curvos/montado3d (duplo) status:", r4.status_code)
if r4.status_code == 200:
    data_duplo = r4.json()
    with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'w', encoding='utf-8') as f:
        json.dump(data_duplo, f, indent=2)
    print("SUCCESS! Saved official_curvo_duplo.json with keys:", list(data_duplo.keys()))
