with open('public/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

target_idx = None
for i, l in enumerate(lines):
    if 'function selecionarCategoria(cat) {' in l:
        target_idx = i
        break

if target_idx is not None:
    lines[target_idx + 2] = '    abrirPecaPersonalizada("rect");\n'
    del lines[target_idx + 3]
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Updated successfully at line', target_idx)
else:
    print('Target not found')
