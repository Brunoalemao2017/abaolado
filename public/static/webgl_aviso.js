/* Aviso amigável quando o preview 3D não consegue abrir.
 *
 * Por que existe: quando o navegador do cliente está sem aceleração de vídeo,
 * o three.js estoura "Error creating WebGL context." — uma frase técnica, em
 * inglês, solta no meio da tela, que não diz o que fazer nem que o resto da
 * página continua funcionando. Um cliente abriu chamado por causa dela.
 *
 * Como usar, em volta da criação do renderer:
 *
 *     var renderer;
 *     try {
 *       renderer = new THREE.WebGLRenderer({ canvas: canvas });
 *     } catch (e) {
 *       window.avisoWebGL(canvas, e);
 *       return;
 *     }
 *
 * O aviso entra no lugar do canvas e o canvas é escondido. Nada mais da página
 * é tocado: gerar peça, DXF e plano de corte seguem funcionando.
 */
(function () {
  'use strict';
  if (window.avisoWebGL) return;

  var MARCA = 'data-aviso-webgl';

  function suportaWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function painel() {
    var box = document.createElement('div');
    box.setAttribute(MARCA, '1');
    box.style.cssText = [
      'display:flex', 'flex-direction:column', 'gap:10px',
      'padding:20px', 'margin:8px 0', 'border-radius:10px',
      'border:1px solid #fcd34d', 'background:#fffbeb', 'color:#78350f',
      'font-size:13px', 'line-height:1.55', 'text-align:left'
    ].join(';');
    box.innerHTML =
      '<div style="font-weight:700;font-size:14px">🖥️ O preview 3D não pôde ser aberto</div>' +
      '<div>Seu navegador está sem aceleração de vídeo. <strong>O resto da página funciona ' +
      'normalmente</strong> — você pode gerar a peça e baixar o DXF sem problema.</div>' +
      '<div style="font-weight:700;margin-top:2px">Como resolver (leva 2 minutos):</div>' +
      '<ol style="margin:0;padding-left:18px">' +
      '<li>No Chrome, clique nos três pontinhos (⋮) no canto superior direito → <strong>Configurações</strong></li>' +
      '<li>No menu da esquerda, clique em <strong>Sistema</strong></li>' +
      '<li>Ligue <strong>“Usar aceleração de hardware quando disponível”</strong></li>' +
      '<li>Feche o Chrome por completo, abra de novo e recarregue esta página</li>' +
      '</ol>' +
      '<div style="font-size:12px;opacity:.85">Se continuar assim, o driver da placa de vídeo ' +
      'pode estar desatualizado — ou há abas 3D demais abertas ao mesmo tempo.</div>';
    return box;
  }

  /* el: o <canvas> que receberia o 3D, ou o container onde ele seria montado.
   * Canvas: fica escondido e o aviso entra ao lado, no pai. Container: o aviso
   * entra dentro dele. erro: opcional, só para o console. */
  window.avisoWebGL = function (el, erro) {
    if (erro && window.console) console.warn('[3D] preview indisponivel:', erro);
    try {
      if (!el) return false;
      var ehCanvas = String(el.tagName || '').toUpperCase() === 'CANVAS';
      var alvo = ehCanvas ? el.parentNode : el;
      if (!alvo) return false;
      // Um aviso por container, mesmo que a cena tente iniciar várias vezes.
      if (alvo.querySelector && alvo.querySelector('[' + MARCA + ']')) return true;
      if (ehCanvas) el.style.display = 'none';
      alvo.appendChild(painel());
      return true;
    } catch (e) {
      return false;
    }
  };

  window.avisoWebGL.suportado = suportaWebGL;
})();
