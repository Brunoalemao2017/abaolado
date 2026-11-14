import requests
import json

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/'
})

r_login = s.post('https://centraldxf.com/login', data={
    'username': 'brunoalemao2025@gmail.com',
    'password': 'Bruno2017@'
})
print("Login status:", r_login.status_code)

r_simples = s.post('https://centraldxf.com/api/curvos/montado3d', data={
    'tipo_curvo': 'simples',
    'largura': '280',
    'profundidade': '350',
    'altura': '400',
    'raio': '80',
    'espessura_mdf': '18',
    'gerar_reforco': '1',
    'gerar_encaixe_superior': '1'
})
print("Simples status:", r_simples.status_code)
if r_simples.status_code == 200:
    data_simples = r_simples.json()
    with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'w', encoding='utf-8') as f:
        json.dump(data_simples, f, indent=2)
    print("SUCCESS! Saved official_curvo_simples.json! Keys:", list(data_simples.keys()))

r_duplo = s.post('https://centraldxf.com/api/curvos/montado3d', data={
    'tipo_curvo': 'duplo_vertical',
    'largura': '400',
    'profundidade': '300',
    'altura': '400',
    'raio': '80',
    'espessura_mdf': '18',
    'gerar_reforco': '1'
})
print("Duplo status:", r_duplo.status_code)
if r_duplo.status_code == 200:
    data_duplo = r_duplo.json()
    with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'w', encoding='utf-8') as f:
        json.dump(data_duplo, f, indent=2)
    print("SUCCESS! Saved official_curvo_duplo.json! Keys:", list(data_duplo.keys()))
