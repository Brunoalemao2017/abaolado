with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_pes = """rotasPes.forEach(nome => {
  app.post(`/api/${nome}/montado3d`, (req, res) => {
    const body = req.body || {};
    proxyParaCentral(`/api/${nome}/montado3d`, body, res, () => {
      if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
      const tipo = nome.replace(/-/g, '_');
      const calculo = AlgoritmosCNC.calcularPeConico ? AlgoritmosCNC.calcularPeConico(body) : {};
      res.json(calculo.peData || { kind: tipo, largura: body.largura, altura: body.altura });
    });
  });
});"""

new_pes = """rotasPes.forEach(nome => {
  app.post(`/api/${nome}/montado3d`, (req, res) => {
    const body = req.body || {};
    proxyParaCentral(`/api/${nome}/montado3d`, body, res, () => {
      if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
      const tipo = nome.replace(/-/g, '_');
      body.produto = tipo;
      const calculo = AlgoritmosCNC.calcularPeConico ? AlgoritmosCNC.calcularPeConico(body) : {};
      res.json(calculo.peData || { kind: tipo, largura_base: 550, profund_base: 550, largura_topo: 350, profund_topo: 350, altura: 700, espessura_mdf: 18, sectors: [{ theta_start: 0, theta_end: Math.PI }, { theta_start: Math.PI, theta_end: Math.PI * 2 }] });
    });
  });
});"""

if old_pes in text:
    text = text.replace(old_pes, new_pes)
    print("Updated rotasPes in server.js!")

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Saved server.js!")
