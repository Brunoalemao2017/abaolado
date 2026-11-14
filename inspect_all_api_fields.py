import requests
import json

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/login'
})
s.get('https://centraldxf.com/login')
s.post('https://centraldxf.com/login', data={'username': 'brunoalemao2025@gmail.com', 'password': 'Bruno2017@'})

endpoints = [
    '/api/portas/montado3d',
    '/api/muxarabi-encaixado/montado3d',
    '/api/prateleiras/montado3d',
    '/api/painel-muxarabi/montado3d',
    '/api/painel-muxarabi-redondo/montado3d',
    '/api/painel-ripado/montado3d',
    '/api/revestimento-cone/montado3d',
    '/api/pe-conico/montado3d',
    '/api/pe-redondo/montado3d',
    '/api/pe-oval/montado3d',
    '/api/pe-oblongo/montado3d',
    '/api/pe-conico-quadrado/montado3d'
]

for ep in endpoints:
    r = s.post(f'https://centraldxf.com{ep}', data={})
    print(f'=== {ep} ({r.status_code}) ===')
    try:
        err = r.json()
        fields = [f['loc'][-1] for f in err.get('detail', []) if 'loc' in f]
        print('Required fields:', fields)
    except Exception as e:
        print('Error parsing:', e, r.text[:100])
