with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect proxyParaCentral replacement
old_proxy = """      proxyRes.on('end', () => {
        if (answered) return;
        try {
          const parsed = JSON.parse(rawData);
          answered = true;
          res.json(parsed);
        } catch (e) {
          safeFallback();
        }
      });"""

new_proxy = """      proxyRes.on('end', () => {
        if (answered) return;
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && (parsed.erro || parsed.detail)) {
            console.warn(`Central DXF retornou aviso/erro (${parsed.erro || JSON.stringify(parsed.detail)}). Ativando motor CNC local.`);
            return safeFallback();
          }
          answered = true;
          res.json(parsed);
        } catch (e) {
          safeFallback();
        }
      });"""

if old_proxy in text:
    text = text.replace(old_proxy, new_proxy)
    print("Updated proxyParaCentral error handling!")
else:
    print("old_proxy not matched exactly")

# Let's check import of algorithms
old_import = """let AlgoritmosCNC = null;
import('./public/js/algorithms.js').then(mod => {
  AlgoritmosCNC = mod.AlgoritmosCNC;
  console.log('✅ Motor CNC Paramétrico Offline carregado com sucesso!');
}).catch(err => {
  console.error('Erro ao carregar algorithms.js:', err);
});"""

new_import = """let AlgoritmosCNC = null;
import('./public/js/algorithms.js').then(mod => {
  AlgoritmosCNC = mod.AlgoritmosCNC;
  if (AlgoritmosCNC && !AlgoritmosCNC.calcularRipado) {
    AlgoritmosCNC.calcularRipado = AlgoritmosCNC.calcularPainelRipado;
  }
  console.log('✅ Motor CNC Paramétrico Offline carregado com sucesso!');
}).catch(err => {
  console.error('Erro ao carregar algorithms.js:', err);
});"""

if old_import in text:
    text = text.replace(old_import, new_import)
    print("Updated algorithms import with safe alias!")

# Also ensure 2-step login in autenticarCentralDXF
old_login = """function autenticarCentralDXF() {
  return new Promise((resolve) => {
    const postData = 'username=brunoalemao2025%40gmail.com&password=Bruno2017%40';
    const req = https.request('https://centraldxf.com/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://centraldxf.com',
        'Referer': 'https://centraldxf.com/login'
      },
      timeout: 10000
    }, (res) => {
      const setCookies = res.headers['set-cookie'] || [];
      if (setCookies.length > 0) {
        centralSessionCookie = setCookies.map(c => c.split(';')[0]).join('; ');
        lastLoginTime = Date.now();
        console.log('✅ Autenticado com sucesso na Central DXF Oficial!');
        console.log('🔑 Cookie de Sessão:', centralSessionCookie.slice(0, 45) + '...');
      } else {
        console.warn('⚠️ Login Central DXF: nenhum cookie retornado.');
      }
      resolve(centralSessionCookie);
    });

    req.on('error', (err) => {
      console.warn('⚠️ Central DXF Offline ou Sem Conexão. Operando 100% offline localmente.');
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}"""

new_login = """function autenticarCentralDXF() {
  return new Promise((resolve) => {
    // 1. GET /login primeiro para capturar cookies de sessão iniciais
    const reqGet = https.request('https://centraldxf.com/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    }, (resGet) => {
      const initCookies = (resGet.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      const postData = 'username=brunoalemao2025%40gmail.com&password=Bruno2017%40';

      const reqPost = https.request('https://centraldxf.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://centraldxf.com',
          'Referer': 'https://centraldxf.com/login',
          'Cookie': initCookies
        },
        timeout: 10000
      }, (resPost) => {
        const postCookies = (resPost.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        centralSessionCookie = [initCookies, postCookies].filter(Boolean).join('; ');
        lastLoginTime = Date.now();
        console.log('✅ Sessão oficial sincronizada com a Central DXF!');
        resolve(centralSessionCookie);
      });

      reqPost.on('error', () => resolve(null));
      reqPost.on('timeout', () => { reqPost.destroy(); resolve(null); });
      reqPost.write(postData);
      reqPost.end();
    });

    reqGet.on('error', () => {
      console.warn('⚠️ Central DXF sem conexão externa. Modo Offline CNC ativo.');
      resolve(null);
    });
    reqGet.on('timeout', () => { reqGet.destroy(); resolve(null); });
    reqGet.end();
  });
}"""

if old_login in text:
    text = text.replace(old_login, new_login)
    print("Updated autenticarCentralDXF with 2-step login!")
else:
    print("old_login not matched exactly")

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Saved server.js successfully!")
