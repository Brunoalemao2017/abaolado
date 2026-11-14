with open('server.js', 'r', encoding='utf-8') as f:
    c = f.read()

target = "app.get('/presets', (req, res) => {"
addition = "app.get('/history', (req, res) => { res.json([]); });\n\n" + target

if target in c and "app.get('/history'" not in c:
    c = c.replace(target, addition, 1)
    with open('server.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Added /history successfully!")
else:
    print("Already present or target not found")
