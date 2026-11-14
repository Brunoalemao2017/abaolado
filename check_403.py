import requests

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

r_login = s.post('https://centraldxf.com/login', data={
    'username': 'brunoalemao2025@gmail.com',
    'password': 'Bruno2017@'
})

r_simples = s.post('https://centraldxf.com/api/curvos/montado3d', data={
    'tipo_curvo': 'simples',
    'largura': '280',
    'profundidade': '350',
    'altura': '400',
    'raio': '80',
    'espessura_mdf': '18',
    'gerar_reforco': '1'
})
print("403 body:", r_simples.text)
