import re

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace variations
    content = content.replace('Central DXF PRO', 'fabrica 064')
    content = content.replace('Central DXF Pro', 'fabrica 064')
    content = content.replace('CENTRAL DXF PRO', 'FABRICA 064')
    content = content.replace('<span>CENTRAL</span><span>DXF PRO</span>', '<span>FABRICA</span><span>064</span>')
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {path}')

update_file('public/index.html')
update_file('public/pecas-personalizadas.html')
if True:
    try:
        update_file('public/test_original.html')
    except Exception as e:
        print(e)
