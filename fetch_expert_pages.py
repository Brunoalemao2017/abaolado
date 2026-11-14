import requests

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

pages = [
    ('cambotas', 'https://centraldxf.com/cambotas'),
    ('pecas_personalizadas_organica', 'https://centraldxf.com/pecas-personalizadas?mode=organica'),
    ('tampos_organicos', 'https://centraldxf.com/pecas-personalizadas?mode=tampos_organicos'),
    ('divisores', 'https://centraldxf.com/divisores')
]

for name, url in pages:
    r = s.get(url)
    print(f"\nPage [{name}] URL: {url} -> Status: {r.status_code}, Length: {len(r.text)}")
    if r.status_code == 200:
        filename = rf'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\page_{name}.html'
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(r.text)
        print(f"  Saved to page_{name}.html")
    else:
        print(f"  Error/Redirect: {r.url}")
