import requests

for name in ['pe_ripado_arredondado_redondo_thumb.svg', 'pe_ripado_arredondado_oval_thumb.svg']:
    url = f'https://centraldxf.com/static/{name}'
    r = requests.get(url)
    if r.status_code == 200:
        with open(rf'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\{name}', 'wb') as f:
            f.write(r.content)
        print(f"Downloaded {name}!")
    else:
        print(f"Failed to download {name}: {r.status_code}")
