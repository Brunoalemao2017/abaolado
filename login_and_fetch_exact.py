import requests
import json

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

r_login = s.post('https://centraldxf.com/login', data={
    'username': 'brunoalemao2025@gmail.com',
    'password': 'Bruno2017@'
}, allow_redirects=True)

print("Login status:", r_login.status_code, "URL:", r_login.url)
print("Cookies:", s.cookies.get_dict())

if 'session' in str(s.cookies.get_dict()) or r_login.url.endswith('/'):
    print("LOGGED IN SUCCESSFULLY!")
    
    # 1. Fetch curvo simples
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
        with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'w', encoding='utf-8') as f:
            f.write(r_simples.text)
        print("Saved official_curvo_simples.json!")

    # 2. Fetch curvo duplo
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
        with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_duplo.json', 'w', encoding='utf-8') as f:
            f.write(r_duplo.text)
        print("Saved official_curvo_duplo.json!")
