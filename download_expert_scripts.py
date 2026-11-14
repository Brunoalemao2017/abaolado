import requests

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/'
})

r_login = s.post('https://centraldxf.com/login', data={
    'username': 'brunoalemao2025@gmail.com',
    'password': 'Bruno2017@'
})
print("Login status:", r_login.status_code)

scripts = [
    'peca_organica_preview3d.js',
    'cut_layout3d.js'
]

for sc in scripts:
    url = f'https://centraldxf.com/static/{sc}'
    r = s.get(url)
    print(f"Script {sc} -> Status: {r.status_code}, Length: {len(r.text)}")
    if r.status_code == 200:
        path = rf'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\{sc}'
        with open(path, 'w', encoding='utf-8') as f:
            f.write(r.text)
        print(f"  Saved to public/static/{sc}!")
