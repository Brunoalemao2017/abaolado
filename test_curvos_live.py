import requests

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/login'
})
s.get('https://centraldxf.com/login')
r2 = s.post('https://centraldxf.com/login', data={'username': 'brunoalemao2025@gmail.com', 'password': 'Bruno2017@'})
print('Cookies after login:', s.cookies.get_dict())

# Now test /api/curvos/montado3d with duplo_vertical
r3 = s.post('https://centraldxf.com/api/curvos/montado3d', data={
    'tipo_curvo': 'duplo_vertical',
    'largura': '400',
    'profundidade': '300',
    'altura': '400',
    'raio': '80',
    'espessura_mdf': '18',
    'gerar_reforco': '1'
})
print('/api/curvos/montado3d status:', r3.status_code)
if r3.status_code == 200:
    data = r3.json()
    print('Keys:', list(data.keys()))
    print('Estrutura Z:', data.get('estrutura_z'))
    print('Reforco Z:', data.get('reforco_z'))
    print('Ripas count:', len(data.get('ripas', [])))
else:
    print('Error:', r3.text[:300])
