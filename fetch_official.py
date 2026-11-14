import requests
import json

try:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    # Test unauthenticated or see what happens
    r = requests.post('https://centraldxf.com/api/curvos/montado3d', data={
        'tipo_curvo': 'simples',
        'largura': '280',
        'profundidade': '350',
        'altura': '400',
        'raio': '80',
        'espessura_mdf': '18',
        'gerar_reforco': '1'
    }, headers=headers, timeout=10)
    print("Status code:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print("Keys:", list(data.keys()))
        with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\official_curvo_simples.json', 'w') as f_out:
            json.dump(data, f_out, indent=2)
        print("Saved official_curvo_simples.json!")
    else:
        print("Response text:", r.text[:300])
except Exception as e:
    print("Error:", e)
