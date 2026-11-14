import requests

s = requests.Session()
s.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/login'
})
r = s.get('https://centraldxf.com/login')
r2 = s.post('https://centraldxf.com/login', data={'username': 'brunoalemao2025@gmail.com', 'password': 'Bruno2017@'})
print('Status:', r2.status_code)
print('Text:', r2.text[:500])
