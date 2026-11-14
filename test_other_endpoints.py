import requests

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/login'
})
s.get('https://centraldxf.com/login')
s.post('https://centraldxf.com/login', data={'username': 'brunoalemao2025@gmail.com', 'password': 'Bruno2017@'})

# Test portas
r_porta = s.post('https://centraldxf.com/api/portas/montado3d', data={
    'tipo_puxador': 'redonda',
    'largura': '400',
    'altura': '700',
    'espessura': '18'
})
print('/api/portas/montado3d status:', r_porta.status_code)
if r_porta.status_code == 200:
    print('Portas keys:', list(r_porta.json().keys()))
else:
    print('Portas response:', r_porta.text[:200])

# Test muxarabi
r_mux = s.post('https://centraldxf.com/api/muxarabi-encaixado/montado3d', data={
    'largura': '600',
    'altura': '800',
    'espessura': '18',
    'largura_ripa': '20',
    'espaco_ripa': '40'
})
print('/api/muxarabi-encaixado/montado3d status:', r_mux.status_code)
if r_mux.status_code == 200:
    print('Muxarabi keys:', list(r_mux.json().keys()))
else:
    print('Muxarabi response:', r_mux.text[:200])
