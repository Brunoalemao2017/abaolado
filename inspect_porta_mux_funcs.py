with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\static\curvo_preview3d.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

def show_func(name):
    idx = text.find('function ' + name)
    if idx != -1:
        print(f'=== {name} ===')
        print(text[idx:idx+1500])
        print('\n' + '='*40 + '\n')

show_func('addPortaCavaQuadrada')
show_func('addPortaCavaRedonda')
show_func('addPortaSemPuxador')
show_func('addMuxarabiPanel')
