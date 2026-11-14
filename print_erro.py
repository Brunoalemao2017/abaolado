import requests

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/login'
})
s.get('https://centraldxf.com/login')
s.post('https://centraldxf.com/login', data={'username': 'brunoalemao2025@gmail.com', 'password': 'Bruno2017@'})

r = s.post('https://centraldxf.com/api/curvos/montado3d', data={
    'tipo_curvo': 'duplo_vertical',
    'largura': '400',
    'profundidade': '300',
    'altura': '400',
    'raio': '80',
    'espessura_mdf': '18',
    'gerar_reforco': '1'
})
print('Status:', r.status_code)
print('JSON:', r.json())
