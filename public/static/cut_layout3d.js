/* Central DXF Pro — visualizacao 3D dos planos de corte.
 *
 * Arquivo IRMAO de construtor_ambiente3d.js e curvo_preview3d.js (mesma
 * arquitetura: Three.js carregado sob demanda do vendor local, render
 * sob-demanda sem loop continuo de requestAnimationFrame, materiais
 * MeshStandardMaterial, luz ambiente + direcional). NAO e o mesmo arquivo
 * porque aqueles desenham UM produto; aqui existem N chapas agrupadas por
 * material/espessura, com pecas e usinagens com profundidade real.
 *
 * ESTE ARQUIVO SO DESENHA. Toda a posicao/rotacao/contorno ja vem pronta do
 * backend (`curvos/cutlist_layout3d.py`), que por sua vez le o resultado do
 * nesting com os MESMOS metodos usados pelo SVG atual e pelo DXF. Nenhuma
 * coordenada e recalculada aqui — se recalculasse, a tela poderia divergir do
 * arquivo que vai para a maquina.
 *
 * Convencao de eixos:
 *   payload (mm, 2D):  x -> direita, y -> cima, origem no canto inferior
 *                      esquerdo da chapa; z (espessura) 0 = face de baixo.
 *   mundo 3D:          X -> direita, Y -> altura (espessura das chapas),
 *                      Z -> profundidade da bancada (chapas se afastam em -Z).
 *   O grupo de cada chapa nasce com rotation.x = -PI/2, o que leva
 *   (x, y, z) do payload para (x, z, -y) no mundo. Ou seja: y da chapa cresce
 *   para o fundo da cena e z (espessura) cresce para cima.
 *
 * API publica:
 *   window.CutLayout3D.mount(canvas, payload, opts)
 *   window.CutLayout3D.dispose() / .resize()
 *   window.CutLayout3D.setVisibility(flags) / .getVisibility()
 *   window.CutLayout3D.setFilters(filters)
 *   window.CutLayout3D.setColorMode('material'|'peca')
 *   window.CutLayout3D.setView('geral'|'topo'|'isometrica'|'inclinada')
 *   window.CutLayout3D.frameAll() / .focusSheet(uid) / .focusPart(pieceId)
 *   window.CutLayout3D.isolateSheet(uid|null)
 *   window.CutLayout3D.getSheets() / .getGroups()
 */
(function () {
  'use strict';

  // ===================== Constantes de layout do ambiente =====================

  var GAP_SHEET_MIN = 160;      // folga entre chapas vizinhas (mm)
  var GAP_SHEET_RATIO = 0.06;   // ou 6% da largura da chapa, o que for maior
  var GAP_ROW = 420;            // folga entre linhas do MESMO agrupamento
  var GAP_GROUP = 1100;         // folga entre agrupamentos diferentes
  var MAX_PER_ROW_CAP = 8;
  var PART_LIFT = 0.0;          // peca e sobra sao complementares: nao ha sobreposicao
  // Espessura com que o material que SOBRA e desenhado. A chapa continua tendo a
  // espessura real — o que muda e so o desenho da sobra, fino de proposito: com
  // sobra e peca na mesma altura, o plano vira um bloco unico e nao da para ver
  // de relance o que foi cortado. Fina, so as pecas ficam salientes.
  var SCRAP_SLAB_THICKNESS = 1.2;
  // Raio MINIMO com que uma usinagem redonda e REALCADA (so com "Usinagem em
  // destaque" ligado). Um furo de 3 mm numa chapa de 2750 mm ocupa menos de um
  // pixel: sem um tamanho minimo, destacar nao destaca nada. O realce e uma
  // marcacao por cima da peca — o furo de verdade continua desenhado no tamanho
  // real embaixo dele, e a ficha da peca continua informando o diametro real.
  // NADA disto muda o que vai para a maquina.
  var HIGHLIGHT_MIN_RADIUS = 5;
  var MAX_SLAB_HOLES = 220;     // acima disso a chapa vira caixa simples (performance)
  var DETAIL_DISTANCE = 9000;   // acima dessa distancia de camera, usinagens somem
  var PART_LABEL_DISTANCE = 5200;
  var BUILD_CHUNK_MS = 26;      // orcamento de tempo por quadro na montagem progressiva
  var BACKGROUND_COLOR = 0xeef2f7;

  // Cores das usinagens: as MESMAS da visualizacao chapa-a-chapa (o SVG usa azul
  // para furacao, verde para rebaixo/pocket e laranja para corte), para quem
  // troca de modo nao precisar reaprender o desenho. Rosa e exclusivo do 3D:
  // marca a operacao que o projeto nao informou profundidade.
  var OP_COLORS = {
    furacao: 0x2563eb,
    rebaixo: 0x16a34a,
    corte: 0xea580c,
    marca: 0xdb2777
  };
  var OP_LABELS = {
    furacao: 'Furação',
    rebaixo: 'Rebaixo',
    corte: 'Corte / rasgo',
    marca: 'Sem profundidade'
  };

  // ===================== Estado do modulo =====================

  var state = null;
  var canvasEl = null, statusEl = null, infoEl = null;
  var onSelectCallback = null, onReadyCallback = null, onViewCallback = null;
  var canOpenEditorCallback = null;
  var onScrapPickCallback = null;
  // Angulos de camera dos botoes da barra. "De cima" e o padrao: o plano de
  // corte e um desenho de chapa, e a leitura natural dele e a de cima — quem
  // quiser ver espessura tem os outros tres botoes a um clique.
  var VIEW_ANGLES = {
    topo: { yaw: 0, pitch: 1.5 },
    isometrica: { yaw: -Math.PI / 4, pitch: 0.62 },
    inclinada: { yaw: -0.5, pitch: 0.22 }
  };
  var DEFAULT_VIEW = 'topo';
  var currentView = DEFAULT_VIEW;
  var view = { yaw: VIEW_ANGLES[DEFAULT_VIEW].yaw, pitch: VIEW_ANGLES[DEFAULT_VIEW].pitch, distance: 6000 };
  var target = null; // THREE.Vector3 — criado depois que o THREE existe
  var dragging = false, mode = '', lastX = 0, lastY = 0, downX = 0, downY = 0;
  var colorMode = 'material';
  var visibility = {
    nomesPecas: false,
    // Medida da peca sobre ela, no 3D. Desligada por padrao pelo mesmo motivo
    // do nome: com a chapa cheia, texto em toda peca vira uma mancha ilegivel.
    medidasPecas: false,
    idsChapas: true,
    usinagens: true,
    sobras: true,
    contornos: true,
    // Fita de borda pintada na lateral da peca. Ligada por padrao: e informacao
    // de producao, nao enfeite — e sem ela nao da para conferir a fitagem.
    fitaBorda: true,
    destacarUsinagens: true
  };
  // `grupo` combina material+espessura (group_key). `material` filtra so pelo
  // material, em qualquer espessura — e o que a barra de filtros unificada da
  // etapa de otimizacao usa, para que 3D e chapa-a-chapa filtrem igual.
  var filters = { grupo: '', material: '', espessura: '', ambiente: '', chapa: '' };
  var sizeObserver = null;
  var boundHandlers = {};
  var buildToken = 0;

  // ===================== Utilidades =====================

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.display = text ? 'block' : 'none';
    statusEl.classList.toggle('cl3d-status-error', !!isError);
  }

  function ensureThreeLoaded(callback) {
    if (window.THREE) { callback(); return; }
    var existing = document.querySelector('script[data-cl3d-three]');
    if (existing) { existing.addEventListener('load', function () { callback(); }, { once: true }); return; }
    var script = document.createElement('script');
    script.setAttribute('data-cl3d-three', '1');
    script.src = '/static/vendor/three.min.js';
    script.onload = function () { callback(); };
    script.onerror = function () { setStatus('Nao foi possivel carregar o motor 3D. Continue usando a visualizacao atual.', true); };
    document.head.appendChild(script);
  }

  function canvasSize() {
    var rect = canvasEl.getBoundingClientRect();
    return { width: Math.max(1, Math.round(rect.width || 800)), height: Math.max(1, Math.round(rect.height || 520)) };
  }

  /** O canvas ja esta com o tamanho de verdade na tela?
   *
   * Dentro de uma aba escondida (display:none) o getBoundingClientRect devolve
   * zero, e o renderer nasceria no tamanho de reserva (800x520) para depois ser
   * esticado pelo CSS — imagem borrada. Montar so quando ha medida real evita
   * isso na origem. */
  function canvasIsVisible(candidato) {
    // O canvas vem por parametro porque, ANTES do primeiro mount, `canvasEl`
    // ainda e null — quem pergunta "da para montar?" e justamente quem ainda
    // nao montou. Sem o parametro, a resposta seria sempre "nao" e a cena 3D
    // nunca chegaria a existir.
    var alvo = candidato || canvasEl;
    var rect = alvo && alvo.getBoundingClientRect ? alvo.getBoundingClientRect() : null;
    return !!(rect && rect.width > 1 && rect.height > 1);
  }

  function fmtMm(value) {
    var num = Number(value || 0);
    return (Math.abs(num - Math.round(num)) < 0.05 ? String(Math.round(num)) : num.toFixed(1)) + ' mm';
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- geometria auxiliar (poligonos planos, em mm) ----

  function ringArea(ring) {
    var area = 0;
    for (var i = 0, n = ring.length; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area / 2;
  }

  function ringBounds(ring) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < ring.length; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    return [minX, minY, maxX, maxY];
  }

  function pointInRing(point, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      var hit = ((yi > point[1]) !== (yj > point[1])) && (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-12) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function ringContains(outer, inner, outerBounds, innerBounds) {
    if (innerBounds[0] < outerBounds[0] - 0.01 || innerBounds[2] > outerBounds[2] + 0.01) return false;
    if (innerBounds[1] < outerBounds[1] - 0.01 || innerBounds[3] > outerBounds[3] + 0.01) return false;
    return pointInRing(inner[0], outer);
  }

  function orientRing(ring, wantCCW) {
    var copy = ring.slice();
    var isCCW = ringArea(copy) > 0;
    if (isCCW !== wantCCW) copy.reverse();
    return copy;
  }

  /** Anel circular para o realce. Vinte lados ja sao redondos o bastante no
   * tamanho em que este marcador aparece. */
  function circleRing(cx, cy, radius) {
    var ring = [];
    for (var i = 0; i < 20; i++) {
      var angulo = (i / 20) * Math.PI * 2;
      ring.push([cx + Math.cos(angulo) * radius, cy + Math.sin(angulo) * radius]);
    }
    return ring;
  }

  function toVec2(ring, offsetX, offsetY) {
    var out = [];
    for (var i = 0; i < ring.length; i++) out.push(new THREE.Vector2(ring[i][0] - offsetX, ring[i][1] - offsetY));
    return out;
  }

  /** Fita ("ribbon") em volta de uma polilinha: um anel unico e fechado, para
   * poder virar furo/rasgo de largura constante sem sobrepor retangulos por
   * segmento (aneis sobrepostos quebram a triangulacao). */
  function ribbonRing(points, halfWidth) {
    if (points.length < 2 || halfWidth <= 0) return null;
    var normals = [];
    var i;
    for (i = 0; i < points.length; i++) {
      var prev = points[Math.max(0, i - 1)];
      var next = points[Math.min(points.length - 1, i + 1)];
      var dx = next[0] - prev[0], dy = next[1] - prev[1];
      var len = Math.hypot(dx, dy) || 1;
      normals.push([-dy / len, dx / len]);
    }
    var left = [], right = [];
    for (i = 0; i < points.length; i++) {
      left.push([points[i][0] + normals[i][0] * halfWidth, points[i][1] + normals[i][1] * halfWidth]);
      right.push([points[i][0] - normals[i][0] * halfWidth, points[i][1] - normals[i][1] * halfWidth]);
    }
    right.reverse();
    return left.concat(right);
  }

  // ===================== Materiais e texturas =====================

  var textureCache = {};

  function grainTexture(colorHex, deitado) {
    var chaveTextura = colorHex + (deitado ? ':deitado' : '');
    if (textureCache[chaveTextura]) return textureCache[chaveTextura];
    var size = 256;
    var canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    var base = new THREE.Color(colorHex);
    ctx.fillStyle = '#' + base.getHexString();
    ctx.fillRect(0, 0, size, size);
    // Listras verticais suaves = veio no sentido do eixo Y da chapa (mesma
    // convencao do selo "COM VEIO" do SVG atual, que mostra a seta vertical).
    for (var i = 0; i < 150; i++) {
      var x = Math.random() * size;
      var w = 0.6 + Math.random() * 2.4;
      var shade = 0.86 + Math.random() * 0.22;
      var tint = base.clone().multiplyScalar(shade);
      ctx.strokeStyle = 'rgba(' + Math.round(tint.r * 255) + ',' + Math.round(tint.g * 255) + ',' + Math.round(tint.b * 255) + ',0.55)';
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.bezierCurveTo(x + 6, size * 0.3, x - 6, size * 0.7, x, size + 10);
      ctx.stroke();
    }
    var texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // As UVs da ExtrudeGeometry saem em milimetros, entao o repeat converte
    // mm -> ladrilho de textura (1 ladrilho a cada 420 mm).
    texture.repeat.set(1 / 420, 1 / 420);
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    // Veio deitado: as mesmas listras, viradas 90 graus.
    if (deitado) texture.rotation = Math.PI / 2;
    textureCache[chaveTextura] = texture;
    return texture;
  }

  function materialFor(key, factory) {
    if (!state.materials[key]) state.materials[key] = factory();
    return state.materials[key];
  }

  function hasTexture(group) {
    return !!(group.wood || group.has_grain);
  }

  /** Quando existe textura, a cor do material MULTIPLICA o mapa — usar a cor do
   * material junto com a textura da mesma cor escurece tudo (nogueira virava
   * quase preto). Com mapa, a cor vira apenas o fator de brilho. */
  function shadedMaterial(key, group, tint, roughness) {
    return materialFor(key, function () {
      var params = { roughness: roughness, metalness: 0.02, side: THREE.DoubleSide };
      if (hasTexture(group)) {
        params.map = grainTexture(group.color, group.veioDeitado);
        params.color = new THREE.Color(tint, tint, tint);
      } else {
        params.color = new THREE.Color(group.color).multiplyScalar(tint);
      }
      return new THREE.MeshStandardMaterial(params);
    });
  }

  /** A chapa (material bruto/sobra) sai mais apagada que as pecas: e o que faz
   * o plano de corte ser legivel de longe — peca clara, sobra opaca. */
  function slabMaterial(group) {
    return shadedMaterial('slab:' + group.key, group, 0.58, 0.9);
  }

  function partMaterial(group, part) {
    if (colorMode === 'peca') {
      return materialFor('part:peca:' + part.color, function () {
        return new THREE.MeshStandardMaterial({ color: new THREE.Color(part.color), roughness: 0.65, metalness: 0.02, side: THREE.DoubleSide });
      });
    }
    return shadedMaterial('part:material:' + group.key, group, 1.0, 0.68);
  }

  /** Peca retirada do plano: mesmo material, translucido. Ela nao vai ser
   * cortada, entao nao pode competir visualmente com as que vao. */
  function asideMaterial(group, part) {
    var base = partMaterial(group, part);
    return materialFor('part:aside:' + (base.uuid || part.color), function () {
      var copia = base.clone();
      copia.transparent = true;
      copia.opacity = 0.5;
      copia.depthWrite = false;
      return copia;
    });
  }

  /** Peca JA CORTADA: cinza-esverdeado fosco, sem brilho. Ela continua no
   * desenho (o plano inteiro precisa ser lido), mas para de disputar atencao
   * com o que ainda falta cortar. */
  function cutMaterial() {
    return materialFor('part:cortada', function () {
      return new THREE.MeshStandardMaterial({ color: 0x9aa8a0, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });
    });
  }

  /** Material de uma peca conforme a situacao dela no plano. Um lugar so, para
   * trocar a cor por peca/material nao apagar a marca de "ja cortada". */
  function materialDaPeca(group, part, foraDoPlano) {
    if (foraDoPlano) return asideMaterial(group, part);
    if (part && part.cut_done) return cutMaterial();
    return partMaterial(group, part);
  }

  function operationCategory(kind, shape) {
    if (shape === 'mark' || shape === 'mark_line') return 'marca';
    if (shape === 'through') return 'corte';
    if (kind === 'drill_circle') return 'furacao';
    if (kind === 'cut_line' || kind === 'cut_polyline' || kind === 'cut_rect' || kind === 'cut_circle') return 'corte';
    return 'rebaixo';
  }

  /** Material da usinagem. Com destaque ligado (padrao), cada tipo de operacao
   * ganha a cor do 2D e um leve brilho proprio — sem isso o fundo do rebaixo
   * some dentro da sombra da cavidade e a usinagem nao chama atencao de longe.
   * Desligando, volta o acabamento realista (tom escuro do proprio material). */
  function machinedMaterial(group, category) {
    if (visibility.destacarUsinagens) {
      var color = OP_COLORS[category || 'rebaixo'] || OP_COLORS.rebaixo;
      return materialFor('machined:destaque:' + color, function () {
        return new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          // Bem alto de proposito: com destaque ligado a usinagem tem que
          // saltar aos olhos de longe, e nao competir com a sombra da cavidade.
          emissiveIntensity: 0.85,
          roughness: 0.32,
          metalness: 0.0,
          side: THREE.DoubleSide,
          // As paredes da cavidade nascem coladas na parede do furo da peca;
          // o deslocamento constante garante que a cor da usinagem ganhe.
          polygonOffset: true,
          polygonOffsetFactor: 0,
          polygonOffsetUnits: -6
        });
      });
    }
    if (colorMode === 'peca') {
      return materialFor('machined:peca', function () {
        return new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95, metalness: 0.02, side: THREE.DoubleSide });
      });
    }
    return shadedMaterial('machined:material:' + group.key, group, 0.5, 0.97);
  }

  /** Contorno claro sobre material escuro e escuro sobre material claro: numa
   * chapa de nogueira o contorno preto simplesmente sumia, e sem ele nao da
   * para ver onde termina uma peca e comeca a sobra. */
  function outlineMaterial(group) {
    var dark = false;
    if (group) {
      var color = new THREE.Color(group.color);
      dark = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) < 0.45;
    }
    var key = 'outline:' + (dark ? 'claro' : 'escuro');
    return materialFor(key, function () {
      return new THREE.LineBasicMaterial({
        color: dark ? 0xf1f5f9 : 0x0f172a,
        transparent: true,
        opacity: dark ? 0.65 : 0.7
      });
    });
  }

  function markMaterial(category) {
    var color = OP_COLORS[category || 'marca'] || OP_COLORS.marca;
    return materialFor('markline:' + color, function () {
      return new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.95 });
    });
  }

  /** Mancha na superficie para a operacao sem profundidade no projeto: so a
   * linha de contorno passava despercebida num furo de 3 mm. */
  function markFillMaterial(category) {
    var color = OP_COLORS[category || 'marca'] || OP_COLORS.marca;
    return materialFor('markfill:' + color, function () {
      return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
    });
  }

  /** Mancha da usinagem na superficie da peca (so com destaque ligado). */
  function highlightFillMaterial(category) {
    var color = OP_COLORS[category || 'rebaixo'] || OP_COLORS.rebaixo;
    return materialFor('ophighlight:fill:' + color, function () {
      return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
    });
  }

  /** Contorno da usinagem na superficie: e ele que da a borda nitida que se ve
   * de cima, mesmo num rasgo estreito. */
  function highlightLineMaterial(category) {
    var color = OP_COLORS[category || 'rebaixo'] || OP_COLORS.rebaixo;
    return materialFor('ophighlight:line:' + color, function () {
      return new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.95 });
    });
  }

  /** Roxo da fita — a MESMA cor da legenda de fita do Plano de Corte e do
   * desenho no editor, para fita ter uma cor so no sistema inteiro. */
  function edgeBandingMaterial() {
    return materialFor('edgeband', function () {
      return new THREE.MeshBasicMaterial({ color: 0x7c3aed, side: THREE.DoubleSide });
    });
  }

  function scrapMaterial() {
    return materialFor('scrap', function () {
      return new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    });
  }

  /** Sobra ja marcada como reaproveitavel: verde, o mesmo sinal do desenho
   * chapa a chapa. Responde de longe "o que eu ja guardei nesta chapa?". */
  function reusableScrapMaterial() {
    return materialFor('scrapReusable', function () {
      return new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    });
  }

  /** Contorno da sobra. A mancha sozinha se perde em material escuro; a linha
   * fecha o desenho e diz onde a sobra comeca e acaba em qualquer cor. */
  function scrapOutlineMaterial(reaproveitavel) {
    return materialFor(reaproveitavel ? 'scrapEdgeReuse' : 'scrapEdge', function () {
      return new THREE.LineBasicMaterial({ color: reaproveitavel ? 0x15803d : 0xb45309 });
    });
  }

  /** Sobra escolhida: mesma mancha, mais forte, para o clique ter resposta
   * visual igual a da peca. */
  function selectedScrapMaterial() {
    return materialFor('scrapSelected', function () {
      return new THREE.MeshBasicMaterial({ color: 0xea580c, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false });
    });
  }

  function selectedMaterial() {
    return materialFor('selected', function () {
      return new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide });
    });
  }

  // ===================== Rotulos (sprites de canvas) =====================

  var labelCache = {};

  function labelSprite(text, options) {
    options = options || {};
    var fontSize = options.fontSize || 44;
    var bg = options.bg || 'rgba(255,255,255,0.94)';
    var fg = options.fg || '#0f172a';
    var cacheKey = text + '|' + fontSize + '|' + bg + '|' + fg;
    var texture = labelCache[cacheKey];
    var padding = 18;
    if (!texture) {
      var measure = document.createElement('canvas').getContext('2d');
      measure.font = '700 ' + fontSize + 'px system-ui, Segoe UI, sans-serif';
      var textWidth = Math.ceil(measure.measureText(text).width);
      var canvas = document.createElement('canvas');
      canvas.width = textWidth + padding * 2;
      canvas.height = fontSize + padding * 2;
      var ctx = canvas.getContext('2d');
      ctx.font = '700 ' + fontSize + 'px system-ui, Segoe UI, sans-serif';
      ctx.fillStyle = bg;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, 14); ctx.fill(); }
      else ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fg;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, padding, canvas.height / 2);
      texture = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData = { aspect: canvas.width / canvas.height };
      labelCache[cacheKey] = texture;
    }
    // sizeAttenuation:false => o rotulo tem tamanho constante em PIXELS. Com
    // tamanho em milimetros, o mesmo texto ficava ilegivel no enquadramento
    // geral e gigante ao aproximar de uma peca.
    // depthWrite:false: o rotulo nunca pode "tampar" a cena atras dele.
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, sizeAttenuation: false, depthWrite: false, depthTest: options.depthTest !== false }));
    sprite.userData.nonSelectable = true;
    sprite.userData.pixelHeight = options.pixelHeight || 24;
    sprite.userData.textureAspect = texture.userData.aspect;
    sprite.renderOrder = 5;
    scaleLabelSprite(sprite);
    if (state) state.labelSprites.push(sprite);
    return sprite;
  }

  /** Com sizeAttenuation:false o shader do sprite multiplica a escala pela
   * distancia (-z de camera), entao a altura na tela vale scale.y / tan(fov/2)
   * em meias-telas. Invertendo: scale.y = px * 2 * tan(fov/2) / altura_da_tela.
   * A largura acompanha o formato da textura (o fator de aspecto da camera ja
   * esta embutido na projecao). */
  function scaleLabelSprite(sprite) {
    var viewportHeight = canvasEl ? canvasSize().height : 760;
    var fov = state ? state.camera.fov : 40;
    var tanV = Math.tan((fov * Math.PI / 180) / 2);
    var scaleY = (sprite.userData.pixelHeight * 2 * tanV) / Math.max(viewportHeight, 1);
    sprite.scale.set(scaleY * sprite.userData.textureAspect, scaleY, 1);
  }

  function rescaleLabels() {
    if (!state) return;
    state.labelSprites.forEach(scaleLabelSprite);
  }

  // ===================== Montagem da geometria de uma peca =====================

  /** Organiza as usinagens em arvore de contencao: um furo passante dentro de um
   * rebaixo vira "filho" do rebaixo. Sem isso, dois aneis concentricos entrariam
   * como furos irmaos no mesmo contorno e quebrariam a triangulacao (e o caneco
   * de dobradica e exatamente esse caso: pocket_circle + cut_circle no mesmo
   * centro). */
  function buildOperationTree(operations) {
    var nodes = [];
    operations.forEach(function (op) {
      var ring = op.ring;
      if (!ring && (op.shape === 'groove' || op.shape === 'vgroove')) {
        ring = ribbonRing(op.points, op.half_width || 0);
      }
      if (!ring || ring.length < 3) { nodes.push({ op: op, ring: null, bounds: null, children: [] }); return; }
      nodes.push({ op: op, ring: ring, bounds: ringBounds(ring), area: Math.abs(ringArea(ring)), children: [] });
    });
    var carvable = nodes.filter(function (node) { return node.ring; });
    carvable.sort(function (a, b) { return b.area - a.area; });
    var roots = [];
    carvable.forEach(function (node) {
      var parent = null;
      for (var i = 0; i < carvable.length; i++) {
        var candidate = carvable[i];
        if (candidate === node || candidate.area <= node.area) continue;
        if (!ringContains(candidate.ring, node.ring, candidate.bounds, node.bounds)) continue;
        if (!parent || candidate.area < parent.area) parent = candidate;
      }
      if (parent) parent.children.push(node); else roots.push(node);
    });
    return {
      roots: roots,
      flat: carvable,
      loose: nodes.filter(function (node) { return !node.ring; })
    };
  }

  function extrudeRing(ring, holes, depth, offsetX, offsetY) {
    var shape = new THREE.Shape(toVec2(orientRing(ring, true), offsetX, offsetY));
    (holes || []).forEach(function (hole) {
      shape.holes.push(new THREE.Path(toVec2(orientRing(hole, false), offsetX, offsetY)));
    });
    return new THREE.ExtrudeGeometry(shape, { depth: Math.max(depth, 0.05), bevelEnabled: false, steps: 1 });
  }

  function shapePaths(ring, holes, offsetX, offsetY) {
    var contour = toVec2(orientRing(ring, true), offsetX, offsetY);
    var holePaths = (holes || []).map(function (hole) { return toVec2(orientRing(hole, false), offsetX, offsetY); });
    return { contour: contour, holes: holePaths };
  }

  /** Superficie USINADA de um rebaixo: o piso na profundidade cortada e as
   * paredes que sobem dele ate a face de cima da peca.
   *
   * So isto leva a cor da operacao, e a razao e a que o usuario ve: esta malha
   * ja desenhou tambem a tampa em z=0 e as paredes da espessura inteira, e como
   * a malha e uma so (uma cor so), um rebaixo de 8 mm aparecia pintado na face
   * DE BAIXO da chapa — como se a peca tivesse sido usinada do lado errado. O
   * material que sobra embaixo agora e outra malha (`cavityPlugGeometry`), com
   * a cor do proprio material.
   *
   * Por que nao usar ExtrudeGeometry: a extrusao para no piso, entao a PAREDE
   * da cavidade pertenceria ao corpo da peca e ficaria da cor do material — a
   * usinagem so teria o fundo colorido.
   */
  function cavityGeometry(ring, holes, floorZ, topZ, offsetX, offsetY) {
    var paths = shapePaths(ring, holes, offsetX, offsetY);
    var vertices = paths.contour.slice();
    paths.holes.forEach(function (hole) { vertices = vertices.concat(hole); });
    var positions = [];
    function pushPoint(point, z) { positions.push(point.x, point.y, z); }

    var faces = THREE.ShapeUtils.triangulateShape(paths.contour, paths.holes);
    for (var f = 0; f < faces.length; f++) {
      var a = vertices[faces[f][0]], b = vertices[faces[f][1]], c = vertices[faces[f][2]];
      pushPoint(a, floorZ); pushPoint(b, floorZ); pushPoint(c, floorZ);  // piso usinado
    }
    [paths.contour].concat(paths.holes).forEach(function (path) {
      for (var i = 0; i < path.length; i++) {
        var p1 = path[i], p2 = path[(i + 1) % path.length];
        pushPoint(p1, floorZ); pushPoint(p2, floorZ); pushPoint(p2, topZ);
        pushPoint(p1, floorZ); pushPoint(p2, topZ); pushPoint(p1, topZ);
      }
    });

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** O material que SOBRA embaixo de um rebaixo — a tampa da face de baixo.
   *
   * O corpo da peca e vazado de lado a lado no lugar da usinagem (e o que deixa
   * a cavidade aparecer, sem depender de CSG). Sem esta tampa o vazado
   * atravessaria a peca inteira e o rebaixo apareceria pela face de baixo.
   * `holes` recebe so os filhos PASSANTES: ali o material realmente acabou. */
  function cavityPlugGeometry(ring, holes, offsetX, offsetY) {
    var paths = shapePaths(ring, holes, offsetX, offsetY);
    var vertices = paths.contour.slice();
    paths.holes.forEach(function (hole) { vertices = vertices.concat(hole); });
    var positions = [];
    var faces = THREE.ShapeUtils.triangulateShape(paths.contour, paths.holes);
    for (var f = 0; f < faces.length; f++) {
      var a = vertices[faces[f][0]], b = vertices[faces[f][1]], c = vertices[faces[f][2]];
      // Ordem invertida: a normal aponta para baixo, que e para onde esta face olha.
      positions.push(a.x, a.y, 0, c.x, c.y, 0, b.x, b.y, 0);
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Parede de um corte passante: tubo aberto atravessando a chapa inteira.
   * Deixa o corte passante evidente mesmo visto de cima. */
  function throughWallGeometry(ring, bottomZ, topZ, offsetX, offsetY) {
    var path = toVec2(orientRing(ring, true), offsetX, offsetY);
    var positions = [];
    function pushPoint(point, z) { positions.push(point.x, point.y, z); }
    for (var i = 0; i < path.length; i++) {
      var p1 = path[i], p2 = path[(i + 1) % path.length];
      pushPoint(p1, bottomZ); pushPoint(p2, bottomZ); pushPoint(p2, topZ);
      pushPoint(p1, bottomZ); pushPoint(p2, topZ); pushPoint(p1, topZ);
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Cunha em V de um rasgo de fresa V-bit: paredes inclinadas do topo ate a
   * linha de fundo, com o angulo real da ferramenta. */
  function vWedgeGeometry(points, halfWidth, topZ, bottomZ, offsetX, offsetY, straightDepth) {
    var positions = [];
    function push(x, y, z) { positions.push(x - offsetX, y - offsetY, z); }
    // Quando o avanço horizontal é menor que a profundidade Z, a referência
    // deixa um trecho reto antes da parede inclinada. Modela essa parede como
    // uma faixa vertical, sem transformar o perfil em uma caixa inteira.
    var straight = Math.max(0, Math.min(topZ - bottomZ, Number(straightDepth) || 0));
    var slopeTopZ = bottomZ + straight;
    var i;
    var normals = [];
    for (i = 0; i < points.length; i++) {
      var prev = points[Math.max(0, i - 1)];
      var next = points[Math.min(points.length - 1, i + 1)];
      var dx = next[0] - prev[0], dy = next[1] - prev[1];
      var len = Math.hypot(dx, dy) || 1;
      normals.push([-dy / len, dx / len]);
    }
    for (i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1], na = normals[i], nb = normals[i + 1];
      var aL = [a[0] + na[0] * halfWidth, a[1] + na[1] * halfWidth];
      var bL = [b[0] + nb[0] * halfWidth, b[1] + nb[1] * halfWidth];
      var aR = [a[0] - na[0] * halfWidth, a[1] - na[1] * halfWidth];
      var bR = [b[0] - nb[0] * halfWidth, b[1] - nb[1] * halfWidth];
      if (straight > 1e-6) {
        // Parede esquerda vertical + face inclinada.
        push(aL[0], aL[1], topZ); push(bL[0], bL[1], topZ); push(bL[0], bL[1], slopeTopZ);
        push(aL[0], aL[1], topZ); push(bL[0], bL[1], slopeTopZ); push(aL[0], aL[1], slopeTopZ);
        push(aL[0], aL[1], slopeTopZ); push(bL[0], bL[1], slopeTopZ); push(b[0], b[1], bottomZ);
        push(aL[0], aL[1], slopeTopZ); push(b[0], b[1], bottomZ); push(a[0], a[1], bottomZ);
        // Parede direita vertical + face inclinada.
        push(aR[0], aR[1], topZ); push(bR[0], bR[1], topZ); push(bR[0], bR[1], slopeTopZ);
        push(aR[0], aR[1], topZ); push(bR[0], bR[1], slopeTopZ); push(aR[0], aR[1], slopeTopZ);
        push(aR[0], aR[1], slopeTopZ); push(a[0], a[1], bottomZ); push(b[0], b[1], bottomZ);
        push(aR[0], aR[1], slopeTopZ); push(b[0], b[1], bottomZ); push(bR[0], bR[1], slopeTopZ);
      } else {
        // Perfil 45° completo — mantém exatamente a malha anterior.
        push(aL[0], aL[1], topZ); push(bL[0], bL[1], topZ); push(b[0], b[1], bottomZ);
        push(aL[0], aL[1], topZ); push(b[0], b[1], bottomZ); push(a[0], a[1], bottomZ);
        push(aR[0], aR[1], topZ); push(a[0], a[1], bottomZ); push(b[0], b[1], bottomZ);
        push(aR[0], aR[1], topZ); push(b[0], b[1], bottomZ); push(bR[0], bR[1], topZ);
      }
    }
    // tampas das pontas
    var first = points[0], last = points[points.length - 1];
    var n0 = normals[0], nl = normals[points.length - 1];
    push(first[0] + n0[0] * halfWidth, first[1] + n0[1] * halfWidth, topZ);
    push(first[0], first[1], bottomZ);
    push(first[0] - n0[0] * halfWidth, first[1] - n0[1] * halfWidth, topZ);
    push(last[0] - nl[0] * halfWidth, last[1] - nl[1] * halfWidth, topZ);
    push(last[0], last[1], bottomZ);
    push(last[0] + nl[0] * halfWidth, last[1] + nl[1] * halfWidth, topZ);

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function lineLoopGeometry(ring, z, offsetX, offsetY) {
    var points = [];
    for (var i = 0; i < ring.length; i++) points.push(new THREE.Vector3(ring[i][0] - offsetX, ring[i][1] - offsetY, z));
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  function polylineGeometry(points, z, offsetX, offsetY) {
    var vectors = [];
    for (var i = 0; i < points.length; i++) vectors.push(new THREE.Vector3(points[i][0] - offsetX, points[i][1] - offsetY, z));
    return new THREE.BufferGeometry().setFromPoints(vectors);
  }

  /** Template de geometria de uma peca, em coordenadas relativas ao canto
   * inferior esquerdo do bounding box dela. Pecas identicas (mesmo codigo,
   * mesma rotacao, mesmas usinagens) reaproveitam o template — e o que segura
   * o desempenho em projeto grande, onde a mesma prateleira repete 20 vezes. */
  function buildPartTemplate(part) {
    var t = Math.max(Number(part.thickness) || 0, 0.6);
    var ox = part.bounds[0], oy = part.bounds[1];
    var tree = buildOperationTree(part.operations || []);
    var solidHoles = [];
    var detail = [];   // { geometry, kind, machined:bool }
    var plugs = [];    // { geometry } — material intacto embaixo de cada rebaixo
    var highlights = []; // { geometry, category, fill } — realce na superficie
    var marks = [];    // { geometry, kind } — desenhados como linha na superficie

    function depthOf(node) {
      var op = node.op;
      if (op.shape === 'through') return t;
      return Math.max(0.2, Math.min(t - 0.05, Number(op.depth) || 0));
    }

    /** Realce da usinagem na SUPERFICIE da peca: mancha translucida + contorno,
     * ligados junto com "Usinagem em destaque". Sem isto, um rasgo de 11 mm no
     * meio de uma chapa de 2750 mm so aparece quando se chega bem perto — o
     * fundo colorido da cavidade fica escondido pela propria sombra dela. */
    function addHighlight(node, category, vazado) {
      if (!node.ring || node.ring.length < 3) return;
      var op = node.op;
      // Furo pequeno demais para enxergar ganha um marcador redondo maior. O
      // furo de verdade continua desenhado no tamanho real embaixo, e o marcador
      // e translucido — da para ver o furo real dentro dele.
      var raio = Number(op.radius) || 0;
      var ampliado = raio > 0 && raio < HIGHLIGHT_MIN_RADIUS;
      var anel = ampliado ? circleRing(Number(op.cx) || 0, Number(op.cy) || 0, HIGHLIGHT_MIN_RADIUS) : node.ring;
      if (!vazado || ampliado) {
        try {
          var shape = new THREE.Shape(toVec2(orientRing(anel, true), ox, oy));
          if (!ampliado) {
            node.children.forEach(function (child) {
              if (child.ring && child.ring.length >= 3) shape.holes.push(new THREE.Path(toVec2(orientRing(child.ring, false), ox, oy)));
            });
            (op.islands || []).forEach(function (ilha) {
              if (ilha && ilha.length >= 3) shape.holes.push(new THREE.Path(toVec2(orientRing(ilha, false), ox, oy)));
            });
          }
          var fill = new THREE.ShapeGeometry(shape);
          fill.translate(0, 0, t + 0.24);
          highlights.push({ geometry: fill, category: category, fill: true });
        } catch (err) { /* contorno que a triangulacao recusou: fica so o traco */ }
      }
      highlights.push({ geometry: lineLoopGeometry(anel, t + 0.34, ox, oy), category: category });
    }

    function processNode(node, parentFloorZ, isRoot) {
      var op = node.op;
      var category = operationCategory(op.kind, op.shape);
      var childHoles = node.children.map(function (child) { return child.ring; });
      // Rebaixo em faixa (Frentes Especiais): a ilha do meio nao e usinada. Vira
      // furo no piso (com parede ate a face) e ganha a propria tampa no topo,
      // porque o corpo da peca foi vazado pelo contorno de fora inteiro.
      var ilhas = (op.islands || []).filter(function (ilha) { return ilha && ilha.length >= 3; });
      childHoles = childHoles.concat(ilhas);
      ilhas.forEach(function (ilha) {
        try {
          var tampa = new THREE.ShapeGeometry(new THREE.Shape(toVec2(orientRing(ilha, true), ox, oy)));
          tampa.translate(0, 0, t);
          plugs.push({ geometry: tampa });
        } catch (err) { /* sem tampa a ilha aparece oca, mas a peca continua */ }
      });
      addHighlight(node, category, op.shape === 'through');
      if (op.shape === 'through') {
        // Parede do vazado, do fundo ate a superficie da chapa.
        detail.push({
          geometry: throughWallGeometry(node.ring, 0, t, ox, oy),
          category: category,
          kind: op.kind
        });
        node.children.forEach(function (child) { processNode(child, parentFloorZ, false); });
        return;
      }
      var depth = depthOf(node);
      var floorZ = t - depth;
      if (op.shape === 'vgroove' && op.points && op.points.length >= 2 && (op.half_width || 0) > 0.05) {
        detail.push({ geometry: vWedgeGeometry(op.points, op.half_width, t, floorZ, ox, oy, op.straight_depth), category: category, kind: op.kind });
      } else {
        // Cavidade real (piso + paredes), sem depender de CSG: o furo no corpo
        // da peca abre o espaco e esta malha desenha a usinagem dentro dele.
        detail.push({
          geometry: cavityGeometry(node.ring, childHoles, Math.max(floorZ, 0.05), t, ox, oy),
          category: category,
          kind: op.kind,
          floorZ: floorZ
        });
      }
      if (isRoot) {
        // So a raiz vaza o corpo da peca (ver solidHoles abaixo), entao so ela
        // precisa da tampa. Filho passante volta a abrir o vazado.
        var passantes = node.children
          .filter(function (child) { return child.op.shape === 'through' && child.ring && child.ring.length >= 3; })
          .map(function (child) { return child.ring; });
        try {
          plugs.push({ geometry: cavityPlugGeometry(node.ring, passantes, ox, oy) });
        } catch (err) { /* sem tampa e melhor do que sem peca */ }
      }
      node.children.forEach(function (child) { processNode(child, floorZ, false); });
    }

    tree.roots.forEach(function (node) {
      solidHoles.push(node.ring);
      processNode(node, 0, true);
    });

    // Usinagens sem profundidade no projeto continuam visiveis, mas como
    // marcacao na superficie — nunca inventamos uma profundidade.
    function addMark(node) {
      var op = node.op;
      var category = operationCategory(op.kind, op.shape);
      if (op.shape === 'mark_line' && op.points && op.points.length >= 2) {
        marks.push({ geometry: polylineGeometry(op.points, t + 0.3, ox, oy), category: category, closed: false });
        return;
      }
      if (!node.ring) return;
      marks.push({ geometry: lineLoopGeometry(node.ring, t + 0.3, ox, oy), category: category, closed: true });
      var shape = new THREE.Shape(toVec2(orientRing(node.ring, true), ox, oy));
      var fill = new THREE.ShapeGeometry(shape);
      fill.translate(0, 0, t + 0.28);
      marks.push({ geometry: fill, category: category, fill: true });
    }

    tree.loose.forEach(addMark);
    tree.flat.forEach(function (node) {
      if (node.op.shape === 'mark') addMark(node);
    });

    var solid;
    try {
      solid = extrudeRing(part.outline, solidHoles, t, ox, oy);
    } catch (err) {
      // Contorno com usinagem que a triangulacao nao aceitou: a peca ainda
      // aparece inteira (melhor do que sumir), so sem os furos abertos.
      solid = extrudeRing(part.outline, [], t, ox, oy);
    }

    return {
      solid: solid,
      detail: detail,
      plugs: plugs,
      highlights: highlights,
      marks: marks,
      outline: lineLoopGeometry(part.outline, t + 0.2, ox, oy),
      thickness: t
    };
  }

  /** Fita de borda: uma faixa colada na LATERAL da peca, cobrindo a espessura.
   *
   * A fita e desenhada sobre a CAIXA da peca, e nao sobre o contorno real —
   * mesma convencao de `OrientedPiece.edge_segment` no Python: numa peca em L
   * ou organica, "o lado direito" e a lateral da peca inteira, que e o que o
   * operador encosta na coladeira.
   *
   * A espessura da fita real (0,45 a 1 mm) e menor que um pixel na maioria dos
   * enquadramentos, entao a faixa e desenhada como um plano colado por fora:
   * o que importa aqui e ENXERGAR em qual lado vai fita, nao medir a fita. */
  function buildEdgeBanding(part, sheetThickness) {
    var fita = part.edge_banding || {};
    var arestas = ['top', 'right', 'bottom', 'left'].filter(function (edge) {
      var valor = fita[edge];
      // Aceita tanto o booleano simples quanto o formato com descricao, que e o
      // que normalize_edge_banding devolve quando a fita tem tipo/cor.
      return valor && (typeof valor !== 'object' || valor.tem !== false);
    });
    if (!arestas.length) return [];

    var espessura = Math.max(Number(part.thickness) || sheetThickness || 0.6, 0.6);
    var minX = part.bounds[0], minY = part.bounds[1];
    var maxX = part.bounds[2], maxY = part.bounds[3];
    var largura = Math.max(maxX - minX, 0.1);
    var altura = Math.max(maxY - minY, 0.1);
    var fora = 0.35;   // encosta por fora, para nao brigar com a face da peca

    return arestas.map(function (edge) {
      var horizontal = (edge === 'top' || edge === 'bottom');
      var comprimento = horizontal ? largura : altura;
      var malha = new THREE.Mesh(
        new THREE.PlaneGeometry(comprimento, espessura),
        edgeBandingMaterial()
      );
      malha.rotation.x = Math.PI / 2;
      if (horizontal) {
        malha.position.set(
          (minX + maxX) / 2,
          edge === 'top' ? maxY + fora : minY - fora,
          espessura / 2
        );
      } else {
        malha.rotation.y = Math.PI / 2;
        malha.position.set(
          edge === 'right' ? maxX + fora : minX - fora,
          (minY + maxY) / 2,
          espessura / 2
        );
      }
      malha.renderOrder = 1;
      return malha;
    });
  }

  // ===================== Montagem de uma chapa =====================

  /** Mesmo grupo, com material proprio: a sobra com o veio deitado nao pode
   * trocar a textura das chapas em pe do mesmo material. */
  function grupoDoVeio(group, sheet) {
    if (!sheet.veio_deitado || group.veioDeitado) return group;
    var copia = Object.assign({}, group);
    copia.key = group.key + ':veio-deitado';
    copia.veioDeitado = true;
    return copia;
  }

  function buildSheet(sheet, group) {
    group = grupoDoVeio(group, sheet);
    var t = Math.max(Number(sheet.thickness) || 0, 0.6);
    var root = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    root.userData = { sheetUid: sheet.uid, nonSelectable: true };

    var partsRoot = new THREE.Group();
    var asideRoot = new THREE.Group();
    var detailRoot = new THREE.Group();
    var outlineRoot = new THREE.Group();
    var scrapRoot = new THREE.Group();
    var labelRoot = new THREE.Group();
    var edgeRoot = new THREE.Group();
    detailRoot.userData.nonSelectable = true;
    outlineRoot.userData.nonSelectable = true;
    scrapRoot.userData.nonSelectable = true;
    labelRoot.userData.nonSelectable = true;
    edgeRoot.userData.nonSelectable = true;

    var partRecords = [];
    var partOutlines = [];

    // Mesma montagem serve a peca do plano e a peca posta de lado: o que muda
    // e o grupo de destino, o material e o fato de a peca retirada NAO virar
    // furo na chapa (ela nao esta mais la para ser cortada).
    function montarPeca(part, destinoPecas, foraDoPlano) {
      var template = state.templates[part.geometry_key];
      if (!template) {
        template = buildPartTemplate(part);
        state.templates[part.geometry_key] = template;
      }
      var offsetX = part.bounds[0], offsetY = part.bounds[1];
      var partGroup = new THREE.Group();
      partGroup.position.set(offsetX, offsetY, PART_LIFT);

      var mesh = new THREE.Mesh(template.solid, materialDaPeca(group, part, foraDoPlano));
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData = { pieceId: part.piece_id, sheetUid: sheet.uid, part: part };
      partGroup.add(mesh);

      // Tampoes: material intacto embaixo dos rebaixos. Andam junto com a peca
      // (mesmo material, mesma selecao) porque sao a propria peca.
      var plugMeshes = [];
      (template.plugs || []).forEach(function (entry) {
        var plug = new THREE.Mesh(entry.geometry, mesh.material);
        plug.userData = { nonSelectable: true };
        partGroup.add(plug);
        plugMeshes.push(plug);
      });

      var detailGroup = new THREE.Group();
      detailGroup.userData.nonSelectable = true;
      template.detail.forEach(function (entry) {
        var detailMesh = new THREE.Mesh(entry.geometry, machinedMaterial(group, entry.category));
        detailMesh.userData = { nonSelectable: true, opCategory: entry.category };
        detailGroup.add(detailMesh);
      });
      (template.highlights || []).forEach(function (entry) {
        var object;
        if (entry.fill) {
          object = new THREE.Mesh(entry.geometry, highlightFillMaterial(entry.category));
        } else {
          object = new THREE.LineLoop(entry.geometry, highlightLineMaterial(entry.category));
        }
        object.visible = !!visibility.destacarUsinagens;
        // Desenhado depois das outras malhas de usinagem: o realce e a camada
        // que tem que ganhar, senao a parede da cavidade come a borda dele.
        object.renderOrder = 2;
        object.userData = { nonSelectable: true, opCategory: entry.category, highlight: true, markFill: !!entry.fill };
        detailGroup.add(object);
      });
      template.marks.forEach(function (entry) {
        var object;
        if (entry.fill) {
          object = new THREE.Mesh(entry.geometry, markFillMaterial(entry.category));
        } else {
          object = entry.closed
            ? new THREE.LineLoop(entry.geometry, markMaterial(entry.category))
            : new THREE.Line(entry.geometry, markMaterial(entry.category));
        }
        object.userData = { nonSelectable: true, opCategory: entry.category, markFill: !!entry.fill };
        detailGroup.add(object);
      });
      detailGroup.position.copy(partGroup.position);
      detailRoot.add(detailGroup);

      var outline = new THREE.LineLoop(template.outline, outlineMaterial(group));
      outline.position.copy(partGroup.position);
      outline.userData = { nonSelectable: true };
      outlineRoot.add(outline);

      // Cada faixa de fita fica anotada na peca, com a posicao de origem: no
      // arrasto do modo mover ela anda junto.
      var faixasDaPeca = [];
      buildEdgeBanding(part, t).forEach(function (faixa) {
        faixa.userData = { nonSelectable: true };
        edgeRoot.add(faixa);
        faixasDaPeca.push({ mesh: faixa, base: [faixa.position.x, faixa.position.y, faixa.position.z] });
      });

      if (!foraDoPlano) partOutlines.push(part.outline);

      destinoPecas.add(partGroup);
      partRecords.push({
        part: part,
        group: partGroup,
        mesh: mesh,
        detail: detailGroup,
        outline: outline,
        label: null,
        plugs: plugMeshes,
        edges: faixasDaPeca,
        setAside: !!foraDoPlano,
        baseMaterial: mesh.material,
        center: [(part.bounds[0] + part.bounds[2]) / 2, (part.bounds[1] + part.bounds[3]) / 2]
      });
    }

    (sheet.parts || []).forEach(function (part) { montarPeca(part, partsRoot, false); });
    (sheet.set_aside_parts || []).forEach(function (part) { montarPeca(part, asideRoot, true); });

    // A chapa desenhada aqui e o material que SOBRA: o retangulo da chapa menos
    // o contorno de cada peca. Antes ela era desenhada inteira por baixo das
    // pecas e, como a chapa e macica, a superficie dela tapava o fundo de todo
    // rebaixo — um rebaixo de 6 mm aparecia como uma mancha rasa. Agora peca e
    // sobra sao complementares (nao ocupam o mesmo espaco), entao a cavidade da
    // usinagem fica realmente visivel e ninguem briga no z-buffer.
    //
    // A sobra sai FINA (`slabT`): so as pecas cortadas ficam com a espessura
    // cheia, e e isso que faz o plano ser lido de relance — peca em relevo,
    // sobra e folga entre pecas rentes a mesa. Chapa de 6 mm nunca fica mais
    // fina do que ela mesma.
    var slabT = Math.min(t, SCRAP_SLAB_THICKNESS);
    // Chapa comum e um retangulo. A chapa que E uma sobra reaproveitada nao:
    // ela tem a forma que sobrou (L, degrau, faixa). Desenhar o retangulo cheio
    // mostrava material que nao existe.
    var contornoSobra = (sheet.scrap_backed && sheet.scrap_shape && (sheet.scrap_shape.outer || []).length >= 3)
      ? sheet.scrap_shape : null;
    var slabShape = contornoSobra
      ? new THREE.Shape(toVec2(orientRing(contornoSobra.outer, true), 0, 0))
      : new THREE.Shape([
          new THREE.Vector2(0, 0),
          new THREE.Vector2(sheet.width, 0),
          new THREE.Vector2(sheet.width, sheet.height),
          new THREE.Vector2(0, sheet.height)
        ]);
    if (contornoSobra) {
      (contornoSobra.holes || []).forEach(function (anel) {
        if (anel && anel.length >= 3) slabShape.holes.push(new THREE.Path(toVec2(orientRing(anel, false), 0, 0)));
      });
    }
    // So vira furo na sobra o contorno que cabe INTEIRO dentro da chapa: um
    // contorno que cruza a borda produziria uma triangulacao degenerada (a
    // chapa apareceria rasgada). Nesse caso a peca simplesmente fica por cima.
    var insideOutlines = partOutlines.filter(function (ring) {
      var bounds = ringBounds(ring);
      return bounds[0] >= -0.5 && bounds[1] >= -0.5 &&
        bounds[2] <= sheet.width + 0.5 && bounds[3] <= sheet.height + 0.5;
    });
    var slabHoles = dedupeContained(insideOutlines);
    if (slabHoles.length <= MAX_SLAB_HOLES) {
      slabHoles.forEach(function (ring) {
        slabShape.holes.push(new THREE.Path(toVec2(orientRing(ring, false), 0, 0)));
      });
    }
    var slabGeometry;
    try {
      slabGeometry = new THREE.ExtrudeGeometry(slabShape, { depth: slabT, bevelEnabled: false, steps: 1 });
    } catch (err) {
      slabGeometry = new THREE.ExtrudeGeometry(new THREE.Shape([
        new THREE.Vector2(0, 0), new THREE.Vector2(sheet.width, 0),
        new THREE.Vector2(sheet.width, sheet.height), new THREE.Vector2(0, sheet.height)
      ]), { depth: slabT, bevelEnabled: false, steps: 1 });
    }
    var slab = new THREE.Mesh(slabGeometry, slabMaterial(group));
    slab.receiveShadow = true;
    slab.userData = { nonSelectable: true, sheetUid: sheet.uid };

    // Contorno da chapa (borda preta) — ajuda a ler o limite do material. Fica na
    // superficie da SOBRA, nao na altura das pecas: senao flutuaria no ar depois
    // que a sobra ficou fina.
    var border = new THREE.LineLoop(
      lineLoopGeometry(
        contornoSobra ? contornoSobra.outer : [[0, 0], [sheet.width, 0], [sheet.width, sheet.height], [0, sheet.height]],
        slabT + 0.3, 0, 0
      ),
      outlineMaterial(group)
    );
    if (sheet.scrap_backed) {
      // Contorno laranja: a sobra reaproveitada se separa das chapas novas sem
      // precisar ler o rotulo de cada uma.
      border.material = materialFor('sheetEdgeScrap', function () {
        return new THREE.LineBasicMaterial({ color: 0xb45309 });
      });
    }
    border.userData = { nonSelectable: true };

    // Sobras aproveitaveis, como manchas na superficie da chapa.
    var scrapMeshes = buildScrapMeshes(sheet.scraps, slabT, sheet.uid);
    scrapMeshes.forEach(function (mesh) { scrapRoot.add(mesh); });
    // Margem especial (lado estragado): a faixa reservada fica a vista, para nao
    // haver duvida de qual lado da chapa e o ruim.
    // Grupo proprio: as faixas nao podem sumir junto com os rotulos quando a
    // pessoa desliga os rotulos na visibilidade.
    var marginRoot = new THREE.Group();
    marginRoot.userData.nonSelectable = true;
    buildMarginMeshes(sheet, slabT).forEach(function (mesh) { marginRoot.add(mesh); });

    root.add(slab);
    root.add(partsRoot);
    root.add(asideRoot);
    root.add(detailRoot);
    root.add(outlineRoot);
    root.add(scrapRoot);
    root.add(marginRoot);
    root.add(labelRoot);
    root.add(edgeRoot);

    return {
      sheet: sheet,
      group: group,
      root: root,
      slab: slab,
      border: border,
      partsRoot: partsRoot,
      asideRoot: asideRoot,
      detailRoot: detailRoot,
      outlineRoot: outlineRoot,
      scrapRoot: scrapRoot,
      scrapMeshes: scrapMeshes,
      slabT: slabT,
      labelRoot: labelRoot,
      edgeRoot: edgeRoot,
      parts: partRecords,
      thickness: t
    };
  }

  /** Faixas da margem especial de UMA chapa, nos lados da tela (esq, baixo,
   * dir, cima). Sem margem especial, nada e desenhado. */
  function buildMarginMeshes(sheet, slabT) {
    var m = sheet.special_margins;
    if (!m) return [];
    var w = Number(sheet.width) || 0, h = Number(sheet.height) || 0;
    var faixas = [
      [0, 0, Number(m.esq) || 0, h],
      [0, 0, w, Number(m.baixo) || 0],
      [w - (Number(m.dir) || 0), 0, w, h],
      [0, h - (Number(m.cima) || 0), w, h]
    ];
    var material = materialFor('margemEspecial', function () {
      return new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
    });
    var meshes = [];
    faixas.forEach(function (f) {
      if (f[2] - f[0] <= 0.5 || f[3] - f[1] <= 0.5) return;
      var forma = new THREE.Shape([
        new THREE.Vector2(f[0], f[1]), new THREE.Vector2(f[2], f[1]),
        new THREE.Vector2(f[2], f[3]), new THREE.Vector2(f[0], f[3])
      ]);
      var mesh = new THREE.Mesh(new THREE.ShapeGeometry(forma), material);
      mesh.position.z = slabT + 0.5;
      mesh.renderOrder = 2;
      mesh.userData = { nonSelectable: true, specialMargin: true };
      meshes.push(mesh);
    });
    return meshes;
  }

  /** Manchas das sobras de UMA chapa. Fica separada de buildSheet porque
   * unificar/agrupar troca so as sobras: remontar a cena inteira por causa
   * disso devolveria a camera para a vista inicial, no meio do trabalho. */
  function buildScrapMeshes(scraps, slabT, sheetUid) {
    var meshes = [];
    (scraps || []).forEach(function (scrap) {
      var polygons = scrap.type === 'waste_group' ? (scrap.polygons || []) : [scrap.polygon];
      polygons.forEach(function (polygon) {
        if (!polygon || polygon.length < 3) return;
        var shape = new THREE.Shape(toVec2(orientRing(polygon, true), 0, 0));
        if (scrap.type !== 'waste_group') {
          (scrap.holes || []).forEach(function (hole) {
            if (hole && hole.length >= 3) shape.holes.push(new THREE.Path(toVec2(orientRing(hole, false), 0, 0)));
          });
        }
        var reaproveitavel = !!scrap.is_reusable;
        var mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), reaproveitavel ? reusableScrapMaterial() : scrapMaterial());
        // A sobra aproveitavel e desenhada na superficie do material que sobrou,
        // que agora e fina — na altura das pecas ela ficaria pairando.
        mesh.position.z = slabT + 0.4;
        // Selecionavel de proposito: e o que deixa o clique no 3D abrir as mesmas
        // opcoes da sobra que existem no desenho chapa a chapa.
        mesh.userData = {
          scrapCode: scrap.scrap_code,
          scrapType: scrap.type || 'simple_waste',
          isReusable: reaproveitavel,
          sheetUid: sheetUid,
          scrapData: scrap
        };
        meshes.push(mesh);
        // Contorno por cima da mancha: e ele que faz a sobra aparecer numa chapa
        // de material escuro, onde a mancha sozinha se confunde com a chapa.
        var aneis = [polygon].concat(scrap.type !== 'waste_group' ? (scrap.holes || []) : []);
        aneis.forEach(function (anel) {
          if (!anel || anel.length < 3) return;
          var linha = new THREE.LineLoop(lineLoopGeometry(anel, slabT + 0.6, 0, 0), scrapOutlineMaterial(reaproveitavel));
          linha.userData = { nonSelectable: true, isScrapOutline: true };
          meshes.push(linha);
        });
      });
    });
    return meshes;
  }

  function dedupeContained(rings) {
    var entries = rings.map(function (ring) { return { ring: ring, bounds: ringBounds(ring), area: Math.abs(ringArea(ring)) }; });
    entries.sort(function (a, b) { return b.area - a.area; });
    var kept = [];
    entries.forEach(function (entry) {
      for (var i = 0; i < kept.length; i++) {
        if (ringContains(kept[i].ring, entry.ring, kept[i].bounds, entry.bounds)) return;
      }
      kept.push(entry);
    });
    return kept.map(function (entry) { return entry.ring; });
  }

  // ===================== Organizacao do ambiente =====================

  function planEnvironment(payload) {
    var groups = payload.groups || [];
    var sheetsByGroup = {};
    (payload.sheets || []).forEach(function (sheet) {
      (sheetsByGroup[sheet.group_key] = sheetsByGroup[sheet.group_key] || []).push(sheet);
    });
    var plan = [];
    var cursorZ = 0;
    groups.forEach(function (group) {
      var sheets = sheetsByGroup[group.key] || [];
      if (!sheets.length) return;
      var perRow = sheets.length <= 4 ? sheets.length : Math.min(MAX_PER_ROW_CAP, Math.max(4, Math.ceil(Math.sqrt(sheets.length * 1.25))));
      var rows = [];
      for (var i = 0; i < sheets.length; i += perRow) rows.push(sheets.slice(i, i + perRow));
      var groupStartZ = cursorZ;
      var maxWidth = 0;
      rows.forEach(function (row) {
        var cursorX = 0;
        var rowHeight = 0;
        row.forEach(function (sheet) {
          plan.push({ sheet: sheet, group: group, x: cursorX, z: cursorZ });
          cursorX += sheet.width + Math.max(GAP_SHEET_MIN, sheet.width * GAP_SHEET_RATIO);
          rowHeight = Math.max(rowHeight, sheet.height);
        });
        maxWidth = Math.max(maxWidth, cursorX);
        cursorZ -= rowHeight + GAP_ROW;
      });
      plan.push({ groupHeader: group, x: 0, z: groupStartZ, width: maxWidth, depth: groupStartZ - cursorZ });
      cursorZ -= GAP_GROUP - GAP_ROW;
    });
    return plan;
  }

  // ===================== Cena =====================

  function initScene() {
    if (state) return;
    var size = canvasSize();
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    } catch (e) {
      if (window.avisoWebGL) window.avisoWebGL(canvasEl, e);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(BACKGROUND_COLOR, 1);
    renderer.setSize(size.width, size.height, false);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, size.width / size.height, 20, 400000);
    var sheetsRoot = new THREE.Group();
    var helpersRoot = new THREE.Group();
    scene.add(sheetsRoot);
    scene.add(helpersRoot);
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));

    var mainLight = new THREE.DirectionalLight(0xffffff, 0.85);
    mainLight.position.set(3000, 6000, 3500);
    scene.add(mainLight);
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    fillLight.position.set(-3500, 4000, -2500);
    scene.add(fillLight);

    target = new THREE.Vector3();

    state = {
      renderer: renderer, scene: scene, camera: camera,
      sheetsRoot: sheetsRoot, helpersRoot: helpersRoot,
      materials: {}, templates: {},
      raycaster: new THREE.Raycaster(),
      sheets: [], groups: [], payload: null,
      partIndex: {}, sheetIndex: {}, scrapIndex: {}, selectedScraps: [],
      selected: null, selectedSheet: null, isolatedSheet: null,
      bounds: new THREE.Box3(), radius: 3000,
      detailVisible: true, partLabelsBuilt: false, labelSprites: []
    };
  }

  function clearScene() {
    if (!state) return;
    disposeObject(state.sheetsRoot);
    disposeObject(state.helpersRoot);
    while (state.sheetsRoot.children.length) state.sheetsRoot.remove(state.sheetsRoot.children[0]);
    while (state.helpersRoot.children.length) state.helpersRoot.remove(state.helpersRoot.children[0]);
    // Os materiais/texturas em cache pertenciam a cena que acabou de ser
    // descartada; manter as chaves faria a proxima montagem reusar recurso ja
    // liberado (material invisivel / textura preta).
    state.materials = {};
    Object.keys(textureCache).forEach(function (key) { delete textureCache[key]; });
    Object.keys(labelCache).forEach(function (key) { delete labelCache[key]; });
    state.labelSprites = [];
    state.sheets = [];
    state.partIndex = {};
    state.sheetIndex = {};
    state.scrapIndex = {};
    state.selectedScraps = [];
    state.templates = {};
    state.selected = null;
    state.partLabelsBuilt = false;
  }

  function buildScene(payload, done) {
    var token = ++buildToken;
    clearScene();
    state.payload = payload;
    state.groups = payload.groups || [];
    var plan = planEnvironment(payload);
    var index = 0;
    var totalSheets = (payload.sheets || []).length;
    var builtSheets = 0;

    function step() {
      if (token !== buildToken || !state) return;
      var started = performance.now();
      while (index < plan.length && performance.now() - started < BUILD_CHUNK_MS) {
        var entry = plan[index++];
        if (entry.groupHeader) {
          addGroupHeader(entry);
          continue;
        }
        var record = buildSheet(entry.sheet, entry.group);
        record.root.position.set(entry.x, 0, entry.z);
        record.border.position.set(0, 0, 0);
        record.root.add(record.border);
        addSheetLabel(record, entry);
        state.sheetsRoot.add(record.root);
        state.sheets.push(record);
        state.sheetIndex[entry.sheet.uid] = record;
        record.parts.forEach(function (partRecord) {
          state.partIndex[partRecord.part.piece_id] = { partRecord: partRecord, sheetRecord: record };
        });
        // Uma sobra pode ser mais de uma malha (o grupo tem varios poligonos),
        // entao o indice guarda a LISTA de malhas daquele codigo.
        (record.scrapMeshes || []).forEach(function (mesh) {
          var codigo = mesh.userData.scrapCode;
          if (!codigo) return;
          if (!state.scrapIndex[codigo]) state.scrapIndex[codigo] = { meshes: [], type: mesh.userData.scrapType, sheetRecord: record };
          state.scrapIndex[codigo].meshes.push(mesh);
        });
        builtSheets++;
      }
      if (index < plan.length) {
        setStatus('Montando o ambiente 3D… chapa ' + Math.min(builtSheets + 1, totalSheets) + ' de ' + totalSheets, false);
        render();
        window.requestAnimationFrame(step);
        return;
      }
      applyVisibility();
      applyFilters();
      // Abre sempre na vista de cima: e como o plano de corte e lido.
      view.yaw = VIEW_ANGLES[DEFAULT_VIEW].yaw;
      view.pitch = VIEW_ANGLES[DEFAULT_VIEW].pitch;
      notifyView(DEFAULT_VIEW);
      frameAll();
      setStatus('', false);
      if (typeof done === 'function') done();
    }
    step();
  }

  function addGroupHeader(entry) {
    var group = entry.groupHeader;
    var sheetsLabel = group.sheet_count === 1 ? '1 chapa' : group.sheet_count + ' chapas';
    var dimensions = group.sheet_width && group.sheet_height
      ? ' · ' + Math.round(group.sheet_width) + '×' + Math.round(group.sheet_height) + ' mm'
      : '';
    var text = group.material + ' ' + (Number(group.thickness) || 0) + ' mm · ' + sheetsLabel + dimensions + (group.has_grain ? ' · com veio' : '');
    var sprite = labelSprite(text, { pixelHeight: 30, fontSize: 46, bg: 'rgba(15,23,42,0.9)', fg: '#f8fafc' });
    sprite.position.set(entry.x + Math.min(entry.width, 1400) / 2, 260, entry.z + 320);
    sprite.userData.groupKey = group.key;
    sprite.userData.isGroupHeader = true;
    state.helpersRoot.add(sprite);

    // Faixa no piso delimitando o agrupamento — leitura rapida de "esta linha
    // toda e o mesmo material".
    var width = Math.max(entry.width, 500);
    var depth = Math.max(Math.abs(entry.depth), 500);
    var band = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 260, depth + 200),
      materialFor('band:' + group.key, function () {
        return new THREE.MeshBasicMaterial({ color: new THREE.Color(group.color).multiplyScalar(0.9), transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
      })
    );
    band.rotation.x = -Math.PI / 2;
    band.position.set(entry.x + width / 2, -2, entry.z - depth / 2 + 100);
    band.userData = { nonSelectable: true, groupKey: group.key, isGroupBand: true };
    state.helpersRoot.add(band);
  }

  function addSheetLabel(record, entry) {
    var sheet = record.sheet;
    var occupancy = Math.round((Number(sheet.occupancy_ratio) || 0) * 100);
    var text = 'Chapa ' + sheet.sheet_no + ' · ' + Math.round(sheet.width) + '×' + Math.round(sheet.height) +
      ' · ' + sheet.placed_parts_count + ' peças · ' + occupancy + '%';
    // O que ja foi cortado vai no proprio rotulo: e a informacao que decide se
    // a chapa entra ou nao na proxima reotimizacao.
    var cortadas = Number(sheet.cut_parts_count) || 0;
    if (sheet.cut_done) text += ' · ✔ cortada';
    else if (cortadas) text += ' · ✔ ' + cortadas + '/' + sheet.placed_parts_count + ' cortadas';
    // Chapa que e uma SOBRA reaproveitada do estoque: no 3D ela parecia uma
    // chapa nova como outra qualquer. O rotulo diz, e a cor separa de longe.
    if (sheet.scrap_backed) text = '♻ SOBRA · ' + text;
    if (sheet.special_margins) text += ' · margem especial';
    var sprite = labelSprite(text, cortadas
      ? { pixelHeight: 22, fontSize: 40, bg: 'rgba(22,101,52,0.92)', fg: '#ecfdf5' }
      : (sheet.scrap_backed
          ? { pixelHeight: 22, fontSize: 40, bg: 'rgba(180,83,9,0.94)', fg: '#fff7ed' }
          : { pixelHeight: 22, fontSize: 40 }));
    // O rotulo fica no helpersRoot (espaco do mundo) e nao dentro do grupo da
    // chapa: assim os filtros/isolamento controlam chapa e rotulo separadamente.
    sprite.position.set(entry.x + sheet.width / 2, record.thickness + 120, entry.z + 130);
    sprite.userData.sheetUid = sheet.uid;
    sprite.userData.isSheetLabel = true;
    state.helpersRoot.add(sprite);
    record.labelSprite = sprite;

    if (sheet.has_grain) {
      var grain = labelSprite((sheet.veio_deitado ? '↔' : '↕') + ' veio do material', { pixelHeight: 19, fontSize: 34, bg: 'rgba(254,243,199,0.95)', fg: '#92400e' });
      grain.position.set(entry.x + sheet.width - 260, record.thickness + 120, entry.z - sheet.height + 160);
      grain.userData.sheetUid = sheet.uid;
      grain.userData.isSheetLabel = true;
      state.helpersRoot.add(grain);
      record.grainSprite = grain;
    }
  }

  /** Rotulos por peca: identificacao e medida. Os dois sao construidos juntos,
   * e quem decide o que aparece e applyVisibility — assim ligar "Medidas" nao
   * remonta a cena. A medida sai como COMPRIMENTO x LARGURA: a primeira medida
   * e a do sentido do veio, que e a convencao da marcenaria e a mesma ordem do
   * editor de Pecas Retangulares. */
  function buildPartLabels() {
    if (!state || state.partLabelsBuilt) return;
    state.sheets.forEach(function (record) {
      record.parts.forEach(function (partRecord) {
        var part = partRecord.part;
        if (!partRecord.label) {
          var text = part.piece_id || part.part_code || '';
          if (text) {
            var sprite = labelSprite(text, { pixelHeight: 17, fontSize: 34, bg: 'rgba(255,255,255,0.9)', fg: '#0f172a' });
            // Dentro do grupo da chapa: posicao em (x, y) da chapa, z acima da peca.
            sprite.position.set(partRecord.center[0], partRecord.center[1], record.thickness + 38);
            sprite.userData.nonSelectable = true;
            record.labelRoot.add(sprite);
            partRecord.label = sprite;
          }
        }
        if (!partRecord.labelMedida) {
          // A medida e o dado que se le de relance nesta tela — vem no MESMO
          // corpo do nome. Menor que isso vira ruido cinza sobre a peca.
          var medida = formatMedida(part.height) + ' x ' + formatMedida(part.width);
          var spriteMedida = labelSprite(medida, { pixelHeight: 17, fontSize: 34, bg: 'rgba(255,255,255,0.92)', fg: '#1e293b' });
          spriteMedida.position.set(partRecord.center[0], partRecord.center[1], record.thickness + 20);
          spriteMedida.userData.nonSelectable = true;
          record.labelRoot.add(spriteMedida);
          partRecord.labelMedida = spriteMedida;
        }
      });
    });
    state.partLabelsBuilt = true;
  }

  function formatMedida(valor) {
    var n = Number(valor) || 0;
    return (Math.round(n * 10) / 10).toString();
  }

  // ===================== Visibilidade, filtros e LOD =====================

  function sheetPassesFilters(record) {
    var sheet = record.sheet;
    if (state.isolatedSheet && sheet.uid !== state.isolatedSheet) return false;
    if (filters.chapa && sheet.uid !== filters.chapa) return false;
    if (filters.grupo && sheet.group_key !== filters.grupo) return false;
    if (filters.material && String(sheet.material || '').trim().toLowerCase() !== filters.material) return false;
    if (filters.espessura && String(sheet.thickness) !== String(filters.espessura)) return false;
    if (filters.ambiente) {
      var found = (sheet.parts || []).some(function (part) {
        return (part.ambiente || part.projeto || '') === filters.ambiente;
      });
      if (!found) return false;
    }
    return true;
  }

  function applyFilters() {
    if (!state) return;
    var visibleGroups = {};
    state.sheets.forEach(function (record) {
      var visible = sheetPassesFilters(record);
      record.root.visible = visible;
      if (record.labelSprite) record.labelSprite.visible = visible && visibility.idsChapas;
      if (record.grainSprite) record.grainSprite.visible = visible && visibility.idsChapas;
      if (visible) visibleGroups[record.sheet.group_key] = true;
      if (visible && filters.ambiente) {
        record.parts.forEach(function (partRecord) {
          var value = partRecord.part.ambiente || partRecord.part.projeto || '';
          var match = value === filters.ambiente;
          partRecord.group.visible = match;
          partRecord.detail.visible = match && visibility.usinagens && state.detailVisible;
          partRecord.outline.visible = match && visibility.contornos;
        });
      } else if (visible) {
        record.parts.forEach(function (partRecord) {
          partRecord.group.visible = true;
          partRecord.detail.visible = visibility.usinagens && state.detailVisible;
          partRecord.outline.visible = visibility.contornos;
        });
      }
    });
    state.helpersRoot.children.forEach(function (child) {
      if (child.userData.isGroupHeader || child.userData.isGroupBand) {
        child.visible = !!visibleGroups[child.userData.groupKey] && visibility.idsChapas;
      }
    });
    render();
  }

  /** Troca o material das usinagens ja montadas (destaque colorido <-> tom do
   * material) sem precisar remontar a cena inteira. */
  function applyOperationHighlight() {
    if (!state) return;
    state.sheets.forEach(function (record) {
      record.detailRoot.traverse(function (node) {
        if (!node.isMesh && !node.isLine && !node.isLineLoop) return;
        var category = node.userData && node.userData.opCategory;
        if (!category) return;
        if (node.userData.highlight) {
          // O realce de superficie EXISTE por causa do destaque: sem ele ligado
          // some, em vez de virar mais uma camada de cor sobre a peca.
          node.visible = !!visibility.destacarUsinagens;
          node.material = node.userData.markFill ? highlightFillMaterial(category) : highlightLineMaterial(category);
          return;
        }
        if (node.isMesh) {
          node.material = node.userData.markFill ? markFillMaterial(category) : machinedMaterial(record.group, category);
        } else {
          node.material = markMaterial(category);
        }
      });
    });
  }

  function applyVisibility() {
    if (!state) return;
    applyOperationHighlight();
    var querRotulo = visibility.nomesPecas || visibility.medidasPecas;
    if (querRotulo) buildPartLabels();
    state.sheets.forEach(function (record) {
      record.detailRoot.visible = visibility.usinagens && state.detailVisible;
      record.outlineRoot.visible = visibility.contornos;
      record.scrapRoot.visible = visibility.sobras;
      // O root carrega nome e medida; cada sprite decide sozinho se aparece.
      record.labelRoot.visible = querRotulo && state.detailVisible;
      if (record.edgeRoot) record.edgeRoot.visible = visibility.fitaBorda;
      record.parts.forEach(function (partRecord) {
        if (partRecord.label) partRecord.label.visible = visibility.nomesPecas;
        if (partRecord.labelMedida) partRecord.labelMedida.visible = visibility.medidasPecas;
      });
      record.border.visible = visibility.contornos;
      if (record.labelSprite) record.labelSprite.visible = record.root.visible && visibility.idsChapas;
      if (record.grainSprite) record.grainSprite.visible = record.root.visible && visibility.idsChapas;
    });
    state.helpersRoot.children.forEach(function (child) {
      if (child.userData.isGroupHeader || child.userData.isGroupBand) child.visible = visibility.idsChapas;
    });
    render();
  }

  /** Simplificacao por distancia: de longe, so as chapas e as pecas; de perto,
   * as usinagens e os nomes. Evita pagar por milhares de malhas pequenas quando
   * elas nem aparecem na tela. */
  function updateLevelOfDetail() {
    if (!state) return false;
    var distance = view.distance;
    var wantDetail = distance < DETAIL_DISTANCE;
    var wantLabels = distance < PART_LABEL_DISTANCE;
    var changed = false;
    if (wantDetail !== state.detailVisible) {
      state.detailVisible = wantDetail;
      state.sheets.forEach(function (record) {
        record.detailRoot.visible = visibility.usinagens && wantDetail;
      });
      changed = true;
    }
    state.sheets.forEach(function (record) {
      var shouldShow = (visibility.nomesPecas || visibility.medidasPecas) && wantLabels;
      if (record.labelRoot.visible !== shouldShow) { record.labelRoot.visible = shouldShow; changed = true; }
    });
    return changed;
  }

  // ===================== Camera =====================

  function clampedPitch() {
    return Math.max(-1.52, Math.min(1.52, view.pitch));
  }

  /** Eixos da camera para o yaw/pitch atuais (forward = camera -> alvo). */
  function cameraBasis() {
    var pitch = clampedPitch();
    var forward = new THREE.Vector3(
      -Math.sin(view.yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(view.yaw) * Math.cos(pitch)
    ).normalize();
    var right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    var up = new THREE.Vector3().crossVectors(right, forward).normalize();
    return { forward: forward, right: right, up: up };
  }

  function applyCameraTransform() {
    var pitch = clampedPitch();
    state.camera.position.set(
      target.x + view.distance * Math.sin(view.yaw) * Math.cos(pitch),
      target.y + view.distance * Math.sin(pitch),
      target.z + view.distance * Math.cos(view.yaw) * Math.cos(pitch)
    );
    state.camera.up.set(0, 1, 0);
    state.camera.lookAt(target);
    state.camera.updateMatrixWorld(true);
  }

  function render() {
    if (!state) return;
    applyCameraTransform();
    state.renderer.render(state.scene, state.camera);
  }

  /** near/far proporcionais a distancia: com near muito pequeno a precisao do
   * z-buffer a metros de distancia fica pior que o desnivel entre a peca e a
   * chapa, e as duas superficies passam a piscar uma sobre a outra. */
  function updateClipPlanes(reference) {
    state.camera.near = Math.max(1, view.distance / 60);
    state.camera.far = view.distance * 4 + (reference || 0) * 4;
    state.camera.updateProjectionMatrix();
  }

  /** Enquadra uma caixa com ajuste iterativo: projeta os 8 cantos, recentraliza
   * o alvo e corrige a distancia ate a caixa ocupar a tela. Um calculo direto
   * (esfera envolvente) sobra muito num conjunto largo e raso visto de cima —
   * era o caso das chapas deitadas lado a lado. */
  function frameBox(box, fillRatio) {
    if (!state || box.isEmpty()) return;
    var center = box.getCenter(new THREE.Vector3());
    var sphere = box.getBoundingSphere(new THREE.Sphere());
    var corners = [];
    for (var i = 0; i < 8; i++) {
      corners.push(new THREE.Vector3(
        (i & 1) ? box.max.x : box.min.x,
        (i & 2) ? box.max.y : box.min.y,
        (i & 4) ? box.max.z : box.min.z
      ));
    }
    target.copy(center);
    view.distance = Math.max(400, sphere.radius * 3);
    var tanV = Math.tan((state.camera.fov * Math.PI / 180) / 2);
    var tanH = tanV * Math.max(state.camera.aspect, 0.35);
    var fill = fillRatio || 0.92; // deixa uma margem de respiro nas bordas
    // 12 passadas com tolerancia apertada: a conta e so matematica de camera
    // (nada e desenhado aqui), e afrouxar deixava a peca ate 50 px fora do
    // centro depois de um duplo clique.
    for (var iter = 0; iter < 12; iter++) {
      updateClipPlanes(sphere.radius);
      applyCameraTransform();
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var c = 0; c < corners.length; c++) {
        var projected = corners[c].clone().project(state.camera);
        if (!isFinite(projected.x) || !isFinite(projected.y)) { minX = -1; maxX = 1; minY = -1; maxY = 1; break; }
        minX = Math.min(minX, projected.x); maxX = Math.max(maxX, projected.x);
        minY = Math.min(minY, projected.y); maxY = Math.max(maxY, projected.y);
      }
      var offsetX = (minX + maxX) / 2, offsetY = (minY + maxY) / 2;
      var span = Math.max((maxX - minX) / 2, (maxY - minY) / 2);
      var basis = cameraBasis();
      target.addScaledVector(basis.right, offsetX * view.distance * tanH);
      target.addScaledVector(basis.up, offsetY * view.distance * tanV);
      if (span > 0 && isFinite(span)) view.distance = Math.max(300, view.distance * span / fill);
      if (Math.abs(span - fill) < 0.004 && Math.abs(offsetX) < 0.004 && Math.abs(offsetY) < 0.004) break;
    }
    updateClipPlanes(sphere.radius);
    updateLevelOfDetail();
    render();
  }

  /** Enquadra tudo o que esta visivel, SEM mexer no angulo da camera.
   *
   * Enquadrar e girar sao coisas diferentes: quem escolheu "De cima" e depois
   * pediu para enquadrar quer ver tudo de cima. Antes esta funcao tambem
   * reposicionava o angulo, e por isso a camera pulava para a perspectiva
   * antiga sozinha — inclusive ao voltar de "ver so uma chapa" para todas. */
  function frameAll() {
    if (!state) return;
    var box = new THREE.Box3();
    state.sheets.forEach(function (record) {
      if (!record.root.visible) return;
      box.expandByObject(record.root);
    });
    if (box.isEmpty()) box.expandByObject(state.sheetsRoot);
    frameBox(box);
  }

  // Centralizar NAO mexe no angulo de visao: o usuario acabou de escolher de
  // onde esta olhando. Tambem enquadra com folga (0.7 em vez do 0.92 do
  // "enquadrar tudo"), para a peca aparecer junto com a vizinhanca dela.
  var FOCUS_FILL = 0.7;

  function focusSheet(uid) {
    var record = state && state.sheetIndex[uid];
    if (!record) return;
    frameBox(new THREE.Box3().setFromObject(record.root), FOCUS_FILL);
  }

  function focusPart(pieceId) {
    var entry = state && state.partIndex[pieceId];
    if (!entry) return;
    frameBox(new THREE.Box3().setFromObject(entry.partRecord.group), FOCUS_FILL);
  }

  /** Avisa a pagina qual botao de vista esta valendo agora — '' quando o
   * usuario gira a cena com o mouse e a camera deixa de ser uma vista fixa. */
  function notifyView(nome) {
    currentView = nome || '';
    if (typeof onViewCallback === 'function') onViewCallback(currentView);
  }

  function setView(name) {
    if (!state) return;
    var angulo = VIEW_ANGLES[name];
    if (!angulo) { frameAll(); return; }
    view.yaw = angulo.yaw;
    view.pitch = angulo.pitch;
    notifyView(name);
    updateLevelOfDetail();
    render();
  }

  function watchCanvasSize() {
    if (sizeObserver || typeof ResizeObserver === 'undefined' || !canvasEl) return;
    // Um observador no proprio canvas cobre todos os casos de uma vez: trocar
    // de etapa, recolher as opcoes de arranjo, redimensionar a janela. Sem ele,
    // cada lugar que muda o layout precisaria lembrar de pedir um resize.
    sizeObserver = new ResizeObserver(function () {
      if (state && canvasIsVisible()) resizeRenderer();
    });
    try { sizeObserver.observe(canvasEl); } catch (err) { sizeObserver = null; }
  }

  function resizeRenderer() {
    if (!state) return;
    var size = canvasSize();
    state.renderer.setSize(size.width, size.height, false);
    state.camera.aspect = size.width / size.height;
    state.camera.updateProjectionMatrix();
    rescaleLabels();
    render();
  }

  // ===================== Controles =====================

  /** Gesto de navegacao a partir dos botoes pressionados. Mesmo padrao do
   * Construtor 3D (`construtor_ambiente3d.js`), que segue o Promob:
   *   botao do meio            -> mover (pan)
   *   botao do meio + direito  -> girar
   *   botao esquerdo           -> gira tambem, por compatibilidade
   * O clique esquerdo SEM arraste continua reservado para selecionar. */
  function navigationModeForButtons(buttons, eventButton) {
    var gesto = navigationModeBase(buttons, eventButton);
    // Modo mover: a camera fica travada de cima, porque e so nela que arrastar
    // a peca no plano da chapa e previsivel. O gesto de girar vira mover a vista.
    if (move3d.enabled && gesto === 'rotate') return 'pan';
    return gesto;
  }

  function navigationModeBase(buttons, eventButton) {
    var middle = (buttons & 4) !== 0;
    var right = (buttons & 2) !== 0;
    if (middle && right) return 'rotate';
    if (middle) return 'pan';
    // Em pointermove o navegador pode nao informar o botao (-1/undefined); sem
    // aceitar esses valores o arraste com o esquerdo pararia de girar no meio
    // do gesto.
    if ((buttons & 1) !== 0 && (eventButton === 0 || eventButton === -1 || eventButton === undefined)) return 'rotate';
    return '';
  }

  function isPromobRotationGesture(buttons) {
    return (buttons & 4) !== 0 && (buttons & 2) !== 0;
  }

  function pointerNdc(event) {
    var rect = canvasEl.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    );
  }

  /** Ponto do mundo sob o cursor: a superficie da chapa/peca, ou o plano do
   * chao quando o cursor esta no vazio. E o que faz a rotacao girar em volta
   * do que voce esta olhando, em vez de sempre em volta do centro geral. */
  function navigationPivotAt(event) {
    if (!state) return null;
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var hits = state.raycaster.intersectObjects(state.sheetsRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].object && hits[i].object.visible) return hits[i].point.clone();
    }
    var groundPoint = new THREE.Vector3();
    var ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (state.raycaster.ray.intersectPlane(ground, groundPoint)) return groundPoint;
    return null;
  }

  /** Troca o eixo da rotacao para o ponto sob o cursor SEM mexer a camera de
   * lugar: recalcula alvo, distancia, yaw e pitch a partir da posicao atual. */
  function beginRotation(event) {
    if (!state) return;
    var pivot = navigationPivotAt(event) || target.clone();
    var offset = state.camera.position.clone().sub(pivot);
    var distance = offset.length();
    if (!isFinite(distance) || distance < 10) return;
    target.copy(pivot);
    view.distance = distance;
    view.yaw = Math.atan2(offset.x, offset.z);
    view.pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / distance)));
    updateClipPlanes(state.radius);
  }

  function bindControls() {
    // A roda do mouse so e sequestrada para zoom DEPOIS de um clique no canvas.
    // Antes disso ela rola a pagina normalmente. Sem isso, o 3D ocupa a largura
    // toda e ate 720px de altura, e quem passava o mouse por cima ficava preso:
    // girar a roda so dava zoom, e para chegar na barra de visualizacao era
    // preciso tirar o mouse do canvas primeiro. Ctrl+roda sempre da zoom.
    var wheelArmed = false;
    boundHandlers.pointerdown = function (event) {
      wheelArmed = true;
      move3d.engolirClique = false;
      // Modo mover: botao esquerdo EM CIMA de uma peca arrasta a peca. No vazio
      // segue a navegacao normal (que, neste modo, so move a vista).
      if (move3d.enabled && event.button === 0 && !move3d.drag) {
        downX = event.clientX; downY = event.clientY;
        if (moveStart(event)) {
          // O clique que vem depois deste pointerdown ja foi tratado aqui. Se
          // ele passasse para handlePick, cairia noutro lugar: escolher a chapa
          // reenquadra a camera entre o apertar e o soltar do botao.
          move3d.engolirClique = true;
          event.preventDefault();
          try { canvasEl.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
          return;
        }
      }
      var buttons = event.buttons || (1 << event.button);
      var previousMode = mode;
      dragging = true;
      lastX = downX = event.clientX;
      lastY = downY = event.clientY;
      mode = navigationModeForButtons(buttons, event.button);
      if (mode === 'rotate' && previousMode !== 'rotate' && isPromobRotationGesture(buttons)) beginRotation(event);
      if (event.button === 1 || event.button === 2 || mode) event.preventDefault();
      try { canvasEl.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    };
    boundHandlers.pointermove = function (event) {
      if (move3d.drag) { event.preventDefault(); moveDragTo(event); return; }
      // Parado sobre um rotulo de chapa: cursor de mao, para o clique novo se
      // anunciar. So os rotulos entram nesta conta (helpersRoot tem poucos
      // objetos), entao nao pesa no movimento do mouse.
      if (!dragging && state && canvasEl) {
        canvasEl.style.cursor = sheetLabelAt(event) ? 'pointer' : '';
      }
      if (!dragging || !state) return;
      var currentMode = navigationModeForButtons(event.buttons || 0, event.button);
      if (!currentMode) return;
      var previousMode = mode;
      mode = currentMode;
      if (mode === 'rotate' && previousMode !== 'rotate' && isPromobRotationGesture(event.buttons || 0)) beginRotation(event);
      var dx = event.clientX - lastX, dy = event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
      if (mode === 'pan') {
        var factor = view.distance * 0.0016;
        var rightX = Math.cos(view.yaw), rightZ = -Math.sin(view.yaw);
        var upX = -Math.sin(view.yaw) * Math.sin(view.pitch);
        var upY = Math.cos(view.pitch);
        var upZ = -Math.cos(view.yaw) * Math.sin(view.pitch);
        // Os DOIS eixos acompanham o cursor: puxar para cima leva a cena para
        // cima, arrastar para o lado leva a cena para o lado — a sensacao de
        // agarrar a chapa e arrastar.
        //
        // Aqui esta tela difere DE PROPOSITO do Construtor de Armarios
        // (construtor_ambiente3d.js), que segue a convencao do Promob e mantem
        // o vertical invertido. Nao "uniformize" os dois sem perguntar: a
        // diferenca foi pedida, nao e descuido.
        //
        // Uma linha resolve os tres eixos porque verticalDrag multiplica
        // upX/upY/upZ — inclusive o que vaza para X e Z com a camera inclinada.
        var verticalDrag = dy;
        target.x -= (dx * rightX - verticalDrag * upX) * factor;
        target.y += verticalDrag * upY * factor;
        target.z -= (dx * rightZ - verticalDrag * upZ) * factor;
      } else {
        view.yaw += dx * 0.006;
        view.pitch += dy * 0.006;
        // Girou com o mouse: a camera nao e mais nenhuma das vistas fixas, e o
        // botao aceso na barra passaria a mentir.
        if (currentView && (dx || dy)) notifyView('');
      }
      render();
    };
    boundHandlers.pointerup = function (event) {
      if (move3d.drag) {
        event.preventDefault();
        if (event.type === 'pointercancel') moveCancelDrag(); else moveEnd();
        return;
      }
      var remaining = navigationModeForButtons(event.buttons || 0, event.button);
      if (remaining) {
        // Soltou um botao mas o outro continua pressionado: segue navegando.
        mode = remaining;
        lastX = event.clientX; lastY = event.clientY;
        return;
      }
      dragging = false; mode = '';
    };
    boundHandlers.wheel = function (event) {
      if (!wheelArmed && !event.ctrlKey) return;   // deixa a pagina rolar
      event.preventDefault();
      view.distance = Math.max(220, Math.min(400000, view.distance * (event.deltaY < 0 ? 1 / 1.12 : 1.12)));
      updateClipPlanes(state.radius);
      updateLevelOfDetail();
      render();
    };
    boundHandlers.contextmenu = function (event) { event.preventDefault(); };
    boundHandlers.click = function (event) {
      if (move3d.engolirClique) { move3d.engolirClique = false; return; }
      if (Math.abs(event.clientX - downX) > 3 || Math.abs(event.clientY - downY) > 3) return;
      handlePick(event);
    };
    // Duplo clique com o botao esquerdo: centraliza a peca na tela.
    boundHandlers.dblclick = function (event) {
      if (event.button !== 0) return;
      event.preventDefault();
      var pieceId = pieceIdAt(event);
      if (!pieceId) return;
      selectPiece(pieceId);
      focusPart(pieceId);
    };
    canvasEl.addEventListener('pointerdown', boundHandlers.pointerdown);
    canvasEl.addEventListener('pointermove', boundHandlers.pointermove);
    canvasEl.addEventListener('pointerup', boundHandlers.pointerup);
    canvasEl.addEventListener('pointercancel', boundHandlers.pointerup);
    boundHandlers.pointerleave = function () { wheelArmed = false; };
    canvasEl.addEventListener('pointerleave', boundHandlers.pointerleave);
    canvasEl.addEventListener('wheel', boundHandlers.wheel, { passive: false });
    canvasEl.addEventListener('contextmenu', boundHandlers.contextmenu);
    canvasEl.addEventListener('click', boundHandlers.click);
    canvasEl.addEventListener('dblclick', boundHandlers.dblclick);
    // Perda de contexto WebGL (troca de aba, GPU ocupada, driver reiniciado):
    // como a cena so redesenha sob demanda, sem tratar isso a tela ficaria
    // parada ate o proximo gesto — e o estado do renderer volta zerado, o que
    // fazia a tela ser limpa em PRETO no lugar da cor de fundo.
    boundHandlers.webglcontextlost = function (event) {
      event.preventDefault();
      setStatus('Reiniciando a visualização 3D (a placa de vídeo reiniciou o contexto)…', false);
    };
    boundHandlers.webglcontextrestored = function () {
      if (!state) return;
      if (state.renderer.resetState) state.renderer.resetState();
      state.renderer.setClearColor(BACKGROUND_COLOR, 1);
      resizeRenderer();
      setStatus('', false);
      render();
    };
    canvasEl.addEventListener('webglcontextlost', boundHandlers.webglcontextlost, false);
    canvasEl.addEventListener('webglcontextrestored', boundHandlers.webglcontextrestored, false);
  }

  function unbindControls() {
    if (!canvasEl) return;
    Object.keys(boundHandlers).forEach(function (key) {
      canvasEl.removeEventListener(key, boundHandlers[key]);
    });
    boundHandlers = {};
  }

  // ===================== Selecao =====================

  /** Os tampoes sao a propria peca: quando ela muda de cor (selecao ou modo de
   * cor), eles mudam junto — senao a face de baixo ficaria de outra cor. */
  function syncPlugMaterial(partRecord) {
    (partRecord.plugs || []).forEach(function (plug) { plug.material = partRecord.mesh.material; });
  }

  function clearSelection() {
    if (!state) return;
    if (state.selected) {
      state.selected.mesh.material = state.selected.baseMaterial;
      syncPlugMaterial(state.selected);
      state.selected = null;
    }
    state.selectedSheet = null;
    if (infoEl) { infoEl.innerHTML = ''; infoEl.style.display = 'none'; }
  }

  function selectPiece(pieceId, options) {
    options = options || {};
    if (!state) return;
    var entry = state.partIndex[pieceId];
    clearSelection();
    if (!entry) { render(); return; }
    var partRecord = entry.partRecord;
    partRecord.mesh.material = selectedMaterial();
    syncPlugMaterial(partRecord);
    state.selected = partRecord;
    renderInfo(partRecord.part, entry.sheetRecord.sheet);
    render();
    if (!options.silent && typeof onSelectCallback === 'function') {
      onSelectCallback(partRecord.part, entry.sheetRecord.sheet);
    }
  }

  /** Peca sob o cursor (ou vazio). Usado tanto pelo clique (selecionar) quanto
   * pelo duplo clique (centralizar). */
  function pieceIdAt(event) {
    if (!state) return '';
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var hits = state.raycaster.intersectObjects(state.sheetsRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      var object = hits[i].object;
      if (object && object.visible && object.userData && object.userData.pieceId) return object.userData.pieceId;
    }
    return '';
  }

  /** Chapa sob o cursor. O clique cai na sobra (o material que ainda esta
   * inteiro) ou na borda; os dois carregam o `sheetUid` no userData. */
  function sheetUidAt(event) {
    if (!state) return '';
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var hits = state.raycaster.intersectObjects(state.sheetsRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      var object = hits[i].object;
      if (!object || !object.visible) continue;
      while (object) {
        if (object.userData && object.userData.sheetUid) return object.userData.sheetUid;
        object = object.parent;
      }
    }
    return '';
  }

  function selectSheet(uid) {
    var record = state && state.sheetIndex[uid];
    clearSelection();
    if (!record) { render(); return; }
    state.selectedSheet = uid;
    renderSheetInfo(record);
    render();
  }

  /** Rotulo de chapa sob o cursor ("Chapa 3 · 1850×2750 · 6 peças · 82%").
   *
   * Os rotulos vivem no helpersRoot, fora do grupo da chapa, e o clique so
   * testava o sheetsRoot — ou seja, eles nunca eram alcancados. Pior: como o
   * rotulo flutua na frente, mirar nele acabava selecionando a PECA que estava
   * atras. Acertar a chapa para marcar como cortada virava pontaria.
   *
   * Clicar no rotulo nao tem outra leitura possivel: e a chapa daquele nome. */
  function sheetLabelAt(event) {
    if (!state || !state.helpersRoot) return '';
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var hits = state.raycaster.intersectObjects(state.helpersRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      var object = hits[i].object;
      if (object && object.visible && object.userData && object.userData.isSheetLabel && object.userData.sheetUid) {
        return object.userData.sheetUid;
      }
    }
    return '';
  }

  /** Sobra sob o cursor. Vem antes da chapa no clique: a sobra e desenhada
   * POR CIMA do material que sobrou, entao quem mira nela quer ela, nao a
   * chapa inteira. */
  function scrapAt(event) {
    if (!state) return null;
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var hits = state.raycaster.intersectObjects(state.sheetsRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      var object = hits[i].object;
      if (object && object.visible && object.userData && object.userData.scrapCode) {
        return {
          code: object.userData.scrapCode, type: object.userData.scrapType || 'simple_waste',
          data: object.userData.scrapData || null, sheetUid: object.userData.sheetUid
        };
      }
    }
    return null;
  }

  function paintScraps() {
    if (!state) return;
    Object.keys(state.scrapIndex).forEach(function (codigo) {
      var escolhida = state.selectedScraps.indexOf(codigo) >= 0;
      state.scrapIndex[codigo].meshes.forEach(function (mesh) {
        if (escolhida) mesh.material = selectedScrapMaterial();
        else mesh.material = mesh.userData.isReusable ? reusableScrapMaterial() : scrapMaterial();
      });
    });
  }

  /** Troca as sobras de UMA chapa (depois de unificar, agrupar, renomear ou
   * marcar como reaproveitavel). Nao remonta a cena: a camera, o zoom e a chapa
   * isolada continuam exatamente onde o usuario deixou. */
  function updateSheetScraps(sheetUid, scraps) {
    if (!state) return false;
    var record = state.sheetIndex[sheetUid];
    if (!record) return false;
    // tira do indice as sobras antigas desta chapa
    Object.keys(state.scrapIndex).forEach(function (codigo) {
      if (state.scrapIndex[codigo].sheetRecord === record) delete state.scrapIndex[codigo];
    });
    (record.scrapMeshes || []).forEach(function (mesh) {
      record.scrapRoot.remove(mesh);
      if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
    });
    record.sheet.scraps = scraps || [];
    var meshes = buildScrapMeshes(record.sheet.scraps, record.slabT, sheetUid);
    meshes.forEach(function (mesh) { record.scrapRoot.add(mesh); });
    record.scrapMeshes = meshes;
    meshes.forEach(function (mesh) {
      var codigo = mesh.userData.scrapCode;
      if (!codigo) return;
      if (!state.scrapIndex[codigo]) state.scrapIndex[codigo] = { meshes: [], type: mesh.userData.scrapType, sheetRecord: record };
      state.scrapIndex[codigo].meshes.push(mesh);
    });
    paintScraps();
    render();
    return true;
  }

  /** Escolhe as sobras por codigo. A pagina e dona da lista (ela vale para o
   * desenho chapa a chapa tambem); aqui so pintamos o que ela mandar. */
  function setScrapSelection(codes) {
    if (!state) return;
    state.selectedScraps = (codes || []).slice();
    paintScraps();
    render();
  }

  function handlePick(event) {
    if (!state) return;
    handlePickBase(event);
    moveSyncFromPick();
  }

  function handlePickBase(event) {
    // O rotulo vem ANTES de tudo: ele flutua na frente da cena e so pode
    // significar uma coisa — a chapa cujo nome esta escrito nele.
    var rotulo = sheetLabelAt(event);
    if (rotulo) { selectSheet(rotulo); return; }
    var pieceId = pieceIdAt(event);
    if (pieceId) { selectPiece(pieceId); return; }
    // Sobra antes da chapa: clicar na mancha da sobra abre as opcoes dela.
    var scrap = scrapAt(event);
    if (scrap && typeof onScrapPickCallback === 'function') {
      // A ficha da direita mostra as medidas da sobra: e o que responde
      // "aquela peca pequena cabe ali?" sem ter que medir na tela.
      clearSelection();
      if (scrap.data) renderScrapInfo(scrap.data, state.sheetIndex[scrap.sheetUid]);
      onScrapPickCallback({
        code: scrap.code, type: scrap.type,
        clientX: event.clientX, clientY: event.clientY,
        additive: !!(event.ctrlKey || event.metaKey || event.shiftKey)
      });
      return;
    }
    // Clicou na chapa e nao numa peca: a ficha que abre e a DA CHAPA — e de la
    // que se marca a chapa inteira como cortada.
    var sheetUid = sheetUidAt(event);
    if (sheetUid) { selectSheet(sheetUid); return; }
    clearSelection();
    if (typeof onScrapPickCallback === 'function') onScrapPickCallback(null);
    render();
  }

  function operationLine(op) {
    var depth;
    if (op.shape === 'through') depth = 'passante' + (op.depth_known ? ' (' + fmtMm(op.depth) + ')' : '');
    else if (op.shape === 'mark' || op.shape === 'mark_line') depth = 'profundidade não informada no projeto';
    else depth = fmtMm(op.depth);
    var extra = '';
    if (op.diameter) extra = ' · Ø' + fmtMm(op.diameter);
    else if (op.width && op.height) extra = ' · ' + fmtMm(op.width) + ' × ' + fmtMm(op.height);
    if (op.shape === 'vgroove' && op.angle_deg) extra += ' · fresa V ' + op.angle_deg + '°';
    return '<li>' + esc(op.label) + extra + ' — ' + esc(depth) + '</li>';
  }

  /** A peca aceita o atalho "Abrir no editor"? Quem sabe responder e a pagina
   * (so retangulo simples que seja o item inteiro entra no editor), entao ela
   * informa a regra no mount. Sem regra informada, o botao nao aparece. */
  function podeAbrirNoEditor(part) {
    if (typeof canOpenEditorCallback !== 'function') return false;
    try { return !!canOpenEditorCallback(part); } catch (err) { return false; }
  }

  function renderInfo(part, sheet) {
    if (!infoEl) return;
    var ops = (part.operations || []);
    var opsHtml = ops.length
      ? '<ul class="cl3d-op-list">' + ops.slice(0, 12).map(operationLine).join('') +
        (ops.length > 12 ? '<li>+ ' + (ops.length - 12) + ' operação(ões)</li>' : '') + '</ul>'
      : '<div class="cl3d-info-empty">Sem usinagens nesta peça.</div>';
    var origin = part.ambiente || part.projeto;
    infoEl.innerHTML =
      '<div class="cl3d-info-head"><strong>' + esc(part.part_name || 'Peça') + '</strong>' +
      '<span class="cl3d-info-id">' + esc(part.piece_id || part.part_code) + '</span></div>' +
      '<div class="cl3d-info-grid">' +
      '<div><label>Medidas</label><span>' + Math.round(part.width) + ' × ' + Math.round(part.height) + ' mm</span></div>' +
      '<div><label>Material</label><span>' + esc(part.material || sheet.material || '-') + '</span></div>' +
      '<div><label>Espessura</label><span>' + fmtMm(part.thickness) + '</span></div>' +
      '<div><label>Rotação</label><span>' + (part.rotation || 0) + '°</span></div>' +
      '<div><label>Chapa</label><span>Chapa ' + sheet.sheet_no + '</span></div>' +
      '<div><label>Situacao</label><span>' + (part.set_aside ? 'Fora do plano' : (part.cut_done ? 'Já cortada' : 'No plano')) + '</span></div>' +
      (origin ? '<div><label>Ambiente</label><span>' + esc(origin) + '</span></div>' : '') +
      '</div>' +
      (part.inside_cutout ? '<div class="cl3d-info-note">Peça aproveitada dentro do recorte de ' + esc(part.parent_part_name || part.parent_piece_id) + '.</div>' : '') +
      '<div class="cl3d-info-ops"><label>Usinagens (' + ops.length + ')</label>' + opsHtml + '</div>' +
      '<div class="cl3d-info-actions">' +
      // Centralizar saiu daqui: o duplo clique na peca ja aproxima, e o lugar
      // rende mais com o atalho que poupa um passo — abrir o editor direto,
      // sem ter que passar pela ficha antes.
      (podeAbrirNoEditor(part)
        ? '<button type="button" class="btn secondary sm" data-cl3d-action="editor">Abrir no editor</button>'
        : '') +
      '<button type="button" class="btn secondary sm" data-cl3d-action="detail">Ver detalhes</button>' +
      // Atalho para o modo mover AQUI no 3D, ja nesta chapa e com esta peca
      // escolhida. Peca fora do plano ou ja cortada nao tem o que mover.
      (part.set_aside || part.cut_done || typeof onSelectCallback !== 'function'
        ? ''
        : '<button type="button" class="btn secondary sm" data-cl3d-action="move" title="Liga o Mover pe&ccedil;as aqui no 3D, com esta pe&ccedil;a escolhida: &eacute; s&oacute; arrastar (R gira)">&#10021; Mover esta pe&ccedil;a</button>') +
      // Etiqueta de UMA peca: e a reimpressao de quem rasgou a etiqueta ou
      // refez a peca. Quem imprime o rolo inteiro usa a Exportacao.
      '<button type="button" class="btn secondary sm" data-cl3d-action="label">&#127991; Imprimir etiqueta</button>' +
      // Retirar do plano nasce AQUI, olhando a peca no 3D: e onde o usuario
      // decide "essa eu nao corto agora". A peca retirada continua visivel, na
      // mesa ao lado da chapa, e o mesmo painel oferece devolver.
      // Peca ja cortada nao pode ser retirada do plano: o material ja saiu da
      // chapa. O caminho e desmarcar primeiro.
      (part.set_aside
        ? '<button type="button" class="btn secondary sm" data-cl3d-action="restore-aside">&#8617; Devolver ao plano</button>'
        : (part.cut_done ? '' : '<button type="button" class="btn secondary sm" data-cl3d-action="set-aside">&#9986; Retirar do plano</button>')) +
      // Marcar como cortada: a peca continua no plano (ela existe, foi feita),
      // mas para de entrar em qualquer reotimizacao.
      (part.set_aside ? '' : (part.cut_done
        ? '<button type="button" class="btn secondary sm" data-cl3d-action="uncut">&#8634; Ainda n&atilde;o cortei</button>'
        : '<button type="button" class="btn secondary sm" data-cl3d-action="cut">&#10004; J&aacute; cortei esta pe&ccedil;a</button>')) +
      '</div>';
    infoEl.style.display = 'block';
    var editorBtn = infoEl.querySelector('[data-cl3d-action="editor"]');
    if (editorBtn) editorBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(part, sheet, { openEditor: true });
    });
    var labelBtn = infoEl.querySelector('[data-cl3d-action="label"]');
    if (labelBtn) labelBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(part, sheet, { printLabel: true });
    });
    var moveBtn = infoEl.querySelector('[data-cl3d-action="move"]');
    if (moveBtn) moveBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(part, sheet, { movePart: true });
    });
    var detailBtn = infoEl.querySelector('[data-cl3d-action="detail"]');
    if (detailBtn) detailBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(part, sheet, { openDetail: true });
    });
    // Sem API nova: o mesmo canal do botao "Ver detalhes". Quem fala com o
    // servidor e a pagina, nao este arquivo — aqui so se desenha.
    var asideBtn = infoEl.querySelector('[data-cl3d-action="set-aside"]');
    if (asideBtn) asideBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(part, sheet, { setAside: true });
    });
    var restoreBtn = infoEl.querySelector('[data-cl3d-action="restore-aside"]');
    if (restoreBtn) restoreBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(part, sheet, { restoreAside: true });
    });
    ['cut', 'uncut'].forEach(function (acao) {
      var botao = infoEl.querySelector('[data-cl3d-action="' + acao + '"]');
      if (!botao) return;
      botao.addEventListener('click', function () {
        if (typeof onSelectCallback === 'function') onSelectCallback(part, sheet, { markCut: acao === 'cut' });
      });
    });
  }

  /** Ficha da CHAPA — abre ao clicar na chapa fora de qualquer peca. E o
   * caminho curto para dizer "esta chapa inteira ja foi cortada" sem ter que
   * clicar peca por peca. */
  /** Margem desta chapa: padrao das Configuracoes ou especial (lado estragado).
   * Os quatro campos ficam em volta de um desenho da chapa, na mesma posicao em
   * que o lado aparece na tela — e o que tira a duvida de "qual e o esquerdo". */
  function margemDaChapaHtml(sheet, cortadas) {
    var padrao = state && state.payload ? Number(state.payload.margin_mm) || 0 : 0;
    var m = sheet.special_margins;
    // Sobra tambem: e nela que o lado estragado mais aparece (pedido do Leandro, 02/11/2026).
    var pode = !cortadas && typeof onSelectCallback === 'function';
    var atual = m
      ? 'Especial: esquerda ' + fmtMm(m.esq) + ' · embaixo ' + fmtMm(m.baixo) + ' · direita ' + fmtMm(m.dir) + ' · em cima ' + fmtMm(m.cima)
      : 'Padrão das Configurações (' + fmtMm(padrao) + ' em cada lado)';
    var valor = function (lado) { return m ? Number(m[lado]) || 0 : padrao; };
    var campo = function (lado, rotulo) {
      return '<label style="display:flex;flex-direction:column;gap:2px;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em">' + rotulo +
        '<input type="number" min="0" step="1" id="cl3d_margem_' + lado + '" value="' + valor(lado) + '" style="width:72px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-weight:600;color:#0f172a"></label>';
    };
    var form = pode
      ? '<div id="cl3d_margem_form" hidden style="margin-top:8px">' +
        '<div style="display:grid;grid-template-columns:auto auto auto;gap:6px;align-items:center;justify-items:center">' +
        '<span></span>' + campo('cima', 'Em cima') + '<span></span>' +
        campo('esq', 'Esquerda') +
        '<div aria-hidden="true" style="width:46px;height:68px;border:2px solid #475569;border-radius:3px;background:#cbd5e1"></div>' +
        campo('dir', 'Direita') +
        '<span></span>' + campo('baixo', 'Embaixo') + '<span></span>' +
        '</div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:6px">Em mm, com a chapa como ela aparece aqui na tela. Peça que invadir a margem nova muda de lugar nesta chapa; se não couber, sai do plano.</div>' +
        '<div id="cl3d_margem_erro" style="font-size:11px;color:#b91c1c;font-weight:700;margin-top:4px"></div>' +
        '<div class="cl3d-info-actions">' +
        '<button type="button" class="btn sm" data-cl3d-sheet="margin-save">Salvar margem</button>' +
        (m ? '<button type="button" class="btn secondary sm" data-cl3d-sheet="margin-reset">Voltar à margem padrão</button>' : '') +
        '</div></div>'
      : '';
    return '<div class="cl3d-info-ops"><label>Margem desta chapa</label>' +
      '<div style="font-size:12px;color:' + (m ? '#b91c1c' : '#334155') + ';font-weight:600">' + atual + '</div>' +
      (pode ? '<button type="button" class="btn secondary sm" data-cl3d-sheet="margin-open" style="margin-top:6px">Ajustar margem</button>' : '') +
      form + '</div>';
  }

  function ligarMargemDaChapa(sheet) {
    var abrir = infoEl.querySelector('[data-cl3d-sheet="margin-open"]');
    var form = infoEl.querySelector('#cl3d_margem_form');
    if (abrir && form) abrir.addEventListener('click', function () { form.hidden = !form.hidden; });
    var salvar = infoEl.querySelector('[data-cl3d-sheet="margin-save"]');
    if (salvar) salvar.addEventListener('click', function () {
      var margens = {};
      var invalido = false;
      ['esq', 'baixo', 'dir', 'cima'].forEach(function (lado) {
        var v = Number((infoEl.querySelector('#cl3d_margem_' + lado) || {}).value);
        if (!isFinite(v) || v < 0) invalido = true;
        margens[lado] = v;
      });
      var erro = infoEl.querySelector('#cl3d_margem_erro');
      if (invalido) {
        if (erro) erro.textContent = 'Preencha os quatro lados com um número de 0 para cima.';
        return;
      }
      if (erro) erro.textContent = '';
      if (typeof onSelectCallback === 'function') onSelectCallback(null, sheet, { sheetMargins: margens });
    });
    var voltar = infoEl.querySelector('[data-cl3d-sheet="margin-reset"]');
    if (voltar) voltar.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(null, sheet, { sheetMargins: 'padrao' });
    });
  }

  /** Caixa que envolve todos os contornos da sobra, como se ve na tela. As
   * medidas saem do desenho (e nao de width/height) porque o 3D recebe a sobra
   * ja girada pela orientacao da chapa. */
  function scrapRings(scrap) {
    var rings = scrap.type === 'waste_group' ? (scrap.polygons || []) : [scrap.polygon];
    return rings.filter(function (ring) { return ring && ring.length >= 3; });
  }

  function ringsBounds(rings) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    rings.forEach(function (ring) {
      ring.forEach(function (pt) {
        b.minX = Math.min(b.minX, pt[0]); b.maxX = Math.max(b.maxX, pt[0]);
        b.minY = Math.min(b.minY, pt[1]); b.maxY = Math.max(b.maxY, pt[1]);
      });
    });
    return b;
  }

  function ringIsRectilinear(ring) {
    for (var i = 0; i < ring.length; i++) {
      var a = ring[i], c = ring[(i + 1) % ring.length];
      if (Math.abs(a[0] - c[0]) > 0.01 && Math.abs(a[1] - c[1]) > 0.01) return false;
    }
    return true;
  }

  /** Maior retangulo inteiro dentro de uma sobra que nao e um retangulo so
   * (em L, com furo, ou um grupo). A sobra e feita de linhas retas em pe e
   * deitadas, entao uma grade pelos cantos dela basta para achar o exato.
   * Devolve null quando a sobra ja e um retangulo (ai as medidas bastam). */
  function largestRectInScrap(scrap) {
    var rings = scrapRings(scrap);
    var holes = scrap.type === 'waste_group' ? [] : (scrap.holes || []).filter(function (h) { return h && h.length >= 3; });
    if (!rings.length || !rings.concat(holes).every(ringIsRectilinear)) return null;
    var b = ringsBounds(rings);
    var area = 0;
    rings.forEach(function (ring) { area += Math.abs(ringArea(ring)); });
    holes.forEach(function (hole) { area -= Math.abs(ringArea(hole)); });
    if (area >= (b.maxX - b.minX) * (b.maxY - b.minY) - 1) return null;
    function unicos(eixo) {
      var vals = [];
      rings.concat(holes).forEach(function (ring) { ring.forEach(function (pt) { vals.push(Math.round(pt[eixo] * 100) / 100); }); });
      vals.sort(function (a, c) { return a - c; });
      return vals.filter(function (v, i) { return i === 0 || v - vals[i - 1] > 0.01; });
    }
    var xs = unicos(0), ys = unicos(1);
    if (xs.length > 80 || ys.length > 80) return null;
    var cheia = [];
    for (var i = 0; i < xs.length - 1; i++) {
      cheia.push([]);
      for (var j = 0; j < ys.length - 1; j++) {
        var cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
        var dentro = rings.some(function (ring) { return pointInRing([cx, cy], ring); }) &&
          !holes.some(function (hole) { return pointInRing([cx, cy], hole); });
        cheia[i].push(dentro);
      }
    }
    var melhor = null;
    for (var x0 = 0; x0 < xs.length - 1; x0++) {
      var coluna = cheia[x0].slice();
      for (var x1 = x0; x1 < xs.length - 1; x1++) {
        if (x1 > x0) for (var k = 0; k < coluna.length; k++) coluna[k] = coluna[k] && cheia[x1][k];
        var y0 = null;
        for (var y = 0; y <= coluna.length; y++) {
          if (y < coluna.length && coluna[y]) { if (y0 === null) y0 = y; continue; }
          if (y0 !== null) {
            var w = xs[x1 + 1] - xs[x0], h = ys[y] - ys[y0];
            if (!melhor || w * h > melhor.width * melhor.height) melhor = { width: w, height: h };
            y0 = null;
          }
        }
      }
    }
    return melhor;
  }

  function renderScrapInfo(scrap, record) {
    if (!infoEl) return;
    var rings = scrapRings(scrap);
    if (!rings.length) return;
    var b = ringsBounds(rings);
    var largura = b.maxX - b.minX, altura = b.maxY - b.minY;
    var maior = largestRectInScrap(scrap);
    var area = Number(scrap.area_mm2) || 0;
    var tipo = scrap.type === 'waste_group' ? 'Grupo de sobras'
      : (scrap.is_reusable ? 'Sobra reaproveitável' : 'Sobra');
    infoEl.innerHTML =
      '<div class="cl3d-info-head"><strong>' + esc(tipo) + '</strong>' +
      '<span class="cl3d-info-id">' + esc(scrap.name || scrap.scrap_code || '') + '</span></div>' +
      '<div class="cl3d-info-grid">' +
      '<div><label>Medidas</label><span>' + fmtMm(largura).replace(' mm', '') + ' × ' + fmtMm(altura) + '</span></div>' +
      (maior ? '<div><label>Maior retângulo inteiro</label><span>' + fmtMm(maior.width).replace(' mm', '') + ' × ' + fmtMm(maior.height) + '</span></div>' : '') +
      (area ? '<div><label>Área</label><span>' + (area / 1e6).toFixed(2).replace('.', ',') + ' m²</span></div>' : '') +
      (record && record.sheet ? '<div><label>Chapa</label><span>Chapa ' + record.sheet.sheet_no + '</span></div>' : '') +
      '</div>' +
      (maior ? '<div class="cl3d-info-note">A sobra não é um retângulo só: as medidas são a caixa que a envolve. Para ver se uma peça cabe, use o maior retângulo inteiro.</div>' : '');
    infoEl.style.display = 'block';
  }

  function renderSheetInfo(record) {
    if (!infoEl) return;
    var sheet = record.sheet;
    var total = Number(sheet.placed_parts_count) || 0;
    var cortadas = Number(sheet.cut_parts_count) || 0;
    var situacao = cortadas >= total && total ? 'Cortada' : (cortadas ? cortadas + ' de ' + total + ' cortadas' : 'A cortar');
    infoEl.innerHTML =
      '<div class="cl3d-info-head"><strong>' + (sheet.scrap_backed ? '♻ Sobra reaproveitada' : 'Chapa ' + sheet.sheet_no) + '</strong>' +
      '<span class="cl3d-info-id">' + esc(sheet.material || '') + '</span></div>' +
      '<div class="cl3d-info-grid">' +
      '<div><label>Medidas</label><span>' + Math.round(sheet.width) + ' × ' + Math.round(sheet.height) + ' mm</span></div>' +
      '<div><label>Espessura</label><span>' + fmtMm(sheet.thickness) + '</span></div>' +
      '<div><label>Peças</label><span>' + total + '</span></div>' +
      '<div><label>Aproveitamento</label><span>' + Math.round((Number(sheet.occupancy_ratio) || 0) * 100) + '%</span></div>' +
      '<div><label>Situacao</label><span>' + situacao + '</span></div>' +
      '</div>' +
      (cortadas ? '<div class="cl3d-info-note">Chapa marcada como cortada: ela e as peças dela ficam de fora da próxima reotimização.</div>' : '') +
      margemDaChapaHtml(sheet, cortadas) +
      '<div class="cl3d-info-actions">' +
      '<button type="button" class="btn secondary sm" data-cl3d-sheet="focus">Centralizar chapa</button>' +
      // Mesmo atalho da ficha da peca, para quem quer mexer na chapa inteira.
      (typeof onSelectCallback === 'function'
        ? '<button type="button" class="btn secondary sm" data-cl3d-sheet="move" title="Liga o Mover pe&ccedil;as aqui no 3D, nesta chapa">&#10021; Ajustar pe&ccedil;as desta chapa</button>'
        : '') +
      // Sobra virada de ponta-cabeca com todas as pecas: o canto cheio vai para
      // o zero da maquina (canto inferior esquerdo). Pedido do Leandro, 10/11/2026.
      (sheet.scrap_backed && !cortadas && typeof onSelectCallback === 'function'
        ? '<button type="button" class="btn secondary sm" data-cl3d-sheet="girar180" title="Vira a sobra de ponta-cabe&ccedil;a junto com as pe&ccedil;as, sem mudar o arranjo">&#10227; Girar sobra 180&deg;</button>'
        : '') +
      (cortadas
        ? '<button type="button" class="btn secondary sm" data-cl3d-sheet="uncut">&#8634; Ainda n&atilde;o cortei</button>'
        : '') +
      (cortadas >= total && total
        ? ''
        : '<button type="button" class="btn secondary sm" data-cl3d-sheet="cut">&#10004; J&aacute; cortei esta chapa</button>') +
      '</div>';
    infoEl.style.display = 'block';
    var focusBtn = infoEl.querySelector('[data-cl3d-sheet="focus"]');
    if (focusBtn) focusBtn.addEventListener('click', function () { focusSheet(sheet.uid); });
    ligarMargemDaChapa(sheet);
    var girarBtn = infoEl.querySelector('[data-cl3d-sheet="girar180"]');
    if (girarBtn) girarBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(null, sheet, { sheetGirar180: true });
    });
    var moveSheetBtn = infoEl.querySelector('[data-cl3d-sheet="move"]');
    if (moveSheetBtn) moveSheetBtn.addEventListener('click', function () {
      if (typeof onSelectCallback === 'function') onSelectCallback(null, sheet, { sheetMove: true });
    });
    ['cut', 'uncut'].forEach(function (acao) {
      var botao = infoEl.querySelector('[data-cl3d-sheet="' + acao + '"]');
      if (!botao) return;
      botao.addEventListener('click', function () {
        if (typeof onSelectCallback === 'function') {
          onSelectCallback(null, sheet, { sheetMarkCut: acao === 'cut' });
        }
      });
    });
  }

  // ===================== Dispose =====================

  function disposeMaterial(material) {
    if (!material) return;
    if (Array.isArray(material)) { material.forEach(disposeMaterial); return; }
    Object.keys(material).forEach(function (key) {
      var value = material[key];
      if (value && value.isTexture) value.dispose();
    });
    material.dispose();
  }

  function disposeObject(root) {
    if (!root) return;
    root.traverse(function (node) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) disposeMaterial(node.material);
    });
  }

  function dispose() {
    buildToken++;
    if (move3d.enabled) setMoveMode(false);
    unbindControls();
    if (sizeObserver) { try { sizeObserver.disconnect(); } catch (err) {} sizeObserver = null; }
    if (!state) { canvasEl = null; statusEl = null; infoEl = null; onSelectCallback = null; canOpenEditorCallback = null; onScrapPickCallback = null; return; }
    disposeObject(state.scene);
    Object.keys(state.materials).forEach(function (key) { disposeMaterial(state.materials[key]); });
    Object.keys(textureCache).forEach(function (key) { textureCache[key].dispose(); delete textureCache[key]; });
    Object.keys(labelCache).forEach(function (key) { labelCache[key].dispose(); delete labelCache[key]; });
    state.renderer.dispose();
    if (state.renderer.forceContextLoss) state.renderer.forceContextLoss();
    state = null;
    canvasEl = null; statusEl = null; infoEl = null; onSelectCallback = null; onReadyCallback = null; canOpenEditorCallback = null; onScrapPickCallback = null;
    dragging = false; mode = '';
  }

  // ===================== Mover pecas no 3D =====================
  //
  // Mesmo "Mover pecas" do desenho chapa a chapa, agora direto na cena. ESTE
  // ARQUIVO NAO TEM REGRA PROPRIA: folga, margem, colisao pelo contorno real e o
  // encaixe automatico vem de window.CutMovePecas.regras — as MESMAS funcoes do
  // arrasto no 2D — e o `move_model` da chapa vem da pagina (o mesmo do 2D). Quem
  // aprova a posicao continua sendo o servidor (POST /layout/move); se ele
  // recusar, a peca volta. Depois de aprovado, a pagina devolve a chapa
  // redesenhada e so ela e trocada na cena (replaceSheet): camera, zoom e
  // isolamento ficam onde estavam.
  //
  // A camera fica de cima enquanto o modo esta ligado: arrastar no plano da
  // chapa com a cena inclinada nao e previsivel.

  var MOVE_LIFT = 4; // mm que a peca arrastada sobe, para ler como "solta"
  var move3d = {
    enabled: false, handlers: {}, sheetUid: '', model: null, partIndex: {},
    drag: null, busy: false, selectedKey: '', history: []
  };

  function moveRegras() {
    return (window.CutMovePecas && window.CutMovePecas.regras) || null;
  }

  function moveReport(message, tone) {
    if (typeof move3d.handlers.onMessage === 'function') move3d.handlers.onMessage(message || '', tone || '');
  }

  /** Mesmo formato do onStateChange do CutMovePecas: a barra de botoes da
   * pagina (Desfazer, girar, o proprio Mover) nao precisa saber qual vista esta
   * mandando. */
  function moveNotify() {
    if (typeof move3d.handlers.onStateChange !== 'function') return;
    var escolhida = move3d.selectedKey ? move3d.partIndex[move3d.selectedKey] : null;
    move3d.handlers.onStateChange({
      enabled: move3d.enabled,
      busy: !!move3d.busy,
      canUndo: move3d.history.length > 0,
      moves: move3d.history.length,
      selectedKey: escolhida ? move3d.selectedKey : '',
      selectedLabel: escolhida ? (escolhida.piece_id || escolhida.label || '') : '',
      canRotate: !!(escolhida && !escolhida.locked && escolhida.can_rotate !== false),
      rotateReason: escolhida ? (escolhida.lock_reason || escolhida.rotate_reason || '') : '',
      sheetUid: move3d.sheetUid
    });
  }

  function moveIndexar(model) {
    var indice = {};
    ((model && model.parts) || []).forEach(function (parte) { indice[parte.key] = parte; });
    return indice;
  }

  function moveMaterial(valido) {
    return materialFor(valido ? 'moveValid' : 'moveInvalid', function () {
      return new THREE.MeshStandardMaterial({
        color: valido ? 0x16a34a : 0xdc2626, emissive: valido ? 0x15803d : 0xb91c1c,
        emissiveIntensity: 0.3, roughness: 0.55, side: THREE.DoubleSide
      });
    });
  }

  /** Cor da peca arrastada quando o gesto nao e "mover": ambar = vai sair da
   * chapa (fica de lado), roxo = vai trocar de lugar com a peca de baixo. */
  var MOVE_TONS = { aside: 0xf59e0b, swap: 0x7c3aed, swapTarget: 0xa78bfa };
  function moveMaterialTom(tom) {
    return materialFor('moveTom_' + tom, function () {
      return new THREE.MeshStandardMaterial({
        color: MOVE_TONS[tom], emissive: MOVE_TONS[tom], emissiveIntensity: 0.25,
        roughness: 0.55, side: THREE.DoubleSide
      });
    });
  }

  /** O objeto ainda esta na cena E tudo acima dele esta visivel. O raio do
   * Three acerta malha de chapa escondida pelo filtro (so o pai fica oculto). */
  function visivelNaCena(object) {
    while (object) {
      if (!object.visible) return false;
      object = object.parent;
    }
    return true;
  }

  function movePartHit(event) {
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var hits = state.raycaster.intersectObjects(state.sheetsRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      var object = hits[i].object;
      if (object && object.userData && object.userData.pieceId && object.userData.part && visivelNaCena(object)) {
        return { part: object.userData.part, sheetUid: object.userData.sheetUid };
      }
    }
    return null;
  }

  /** Peca da chapa (nao da mesa ao lado) embaixo do cursor, ignorando a que esta
   * sendo arrastada — e a peca com quem ela vai trocar de lugar. */
  function movePartHitExcept(event, key) {
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var hits = state.raycaster.intersectObjects(state.sheetsRoot.children, true);
    for (var i = 0; i < hits.length; i++) {
      var object = hits[i].object;
      var dados = object && object.userData;
      if (!dados || !dados.pieceId || !dados.part || !visivelNaCena(object)) continue;
      if (dados.part.part_key === key || dados.part.set_aside) continue;
      return { part: dados.part, sheetUid: dados.sheetUid };
    }
    return null;
  }

  /** Ponto sob o cursor no plano do TOPO das pecas, em mm da chapa. */
  function movePointOnSheet(event, record) {
    state.raycaster.setFromCamera(pointerNdc(event), state.camera);
    var plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -record.thickness);
    var ponto = new THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(plano, ponto)) return null;
    record.root.updateMatrixWorld(true);
    var local = record.root.worldToLocal(ponto);
    return [local.x, local.y];
  }

  /** Quantos pixels de tela vale 1 mm da chapa agora: o encaixe automatico e
   * medido em pixels, para "colar" do mesmo jeito com a chapa inteira na tela
   * ou com zoom. */
  function movePixelsPerMm(record, x, y) {
    var a = record.root.localToWorld(new THREE.Vector3(x, y, record.thickness)).project(state.camera);
    var b = record.root.localToWorld(new THREE.Vector3(x + 100, y, record.thickness)).project(state.camera);
    var rect = canvasEl.getBoundingClientRect();
    var dx = (b.x - a.x) * (rect.width || 1) / 2;
    var dy = (b.y - a.y) * (rect.height || 1) / 2;
    return Math.sqrt(dx * dx + dy * dy) / 100;
  }

  function moveRecordFor(key) {
    var record = state && state.sheetIndex[move3d.sheetUid];
    if (!record) return null;
    for (var i = 0; i < record.parts.length; i++) {
      if (record.parts[i].part.part_key === key) return record.parts[i];
    }
    return null;
  }

  /** Desenha a peca deslocada (dx, dy) do lugar dela. `ativo` = durante o
   * arrasto: sobe um pouco e pinta de verde (cabe) ou vermelho (nao cabe). */
  function moveSetVisual(rec, dx, dy, ativo, problema, tom) {
    if (!rec) return;
    var base = rec.part.bounds;
    var lift = ativo ? MOVE_LIFT : 0;
    rec.group.position.set(base[0] + dx, base[1] + dy, PART_LIFT + lift);
    rec.detail.position.copy(rec.group.position);
    rec.outline.position.copy(rec.group.position);
    (rec.edges || []).forEach(function (faixa) {
      faixa.mesh.position.set(faixa.base[0] + dx, faixa.base[1] + dy, faixa.base[2] + lift);
    });
    if (rec.label) rec.label.position.set(rec.center[0] + dx, rec.center[1] + dy, rec.label.position.z);
    if (rec.labelMedida) rec.labelMedida.position.set(rec.center[0] + dx, rec.center[1] + dy, rec.labelMedida.position.z);
    if (ativo && tom && !problema) rec.mesh.material = moveMaterialTom(tom);
    else if (ativo) rec.mesh.material = moveMaterial(!problema);
    else rec.mesh.material = state.selected === rec ? selectedMaterial() : rec.baseMaterial;
    syncPlugMaterial(rec);
  }

  /** Pinta (ou despinta) a peca com quem a arrastada vai trocar de lugar. */
  function moveMarcarAlvo(drag, rec) {
    if (drag.swapRec && drag.swapRec !== rec && drag.swapRec.group && drag.swapRec.group.parent) {
      drag.swapRec.mesh.material = state.selected === drag.swapRec ? selectedMaterial() : drag.swapRec.baseMaterial;
      syncPlugMaterial(drag.swapRec);
    }
    drag.swapRec = rec || null;
    if (rec) {
      rec.mesh.material = moveMaterialTom('swapTarget');
      syncPlugMaterial(rec);
    }
  }

  /** Passa a ajustar esta chapa: isola, poe de cima e enquadra. */
  function moveUseSheet(uid) {
    if (!state || !state.sheetIndex[uid]) return false;
    var model = typeof move3d.handlers.getModel === 'function' ? move3d.handlers.getModel(uid) : null;
    if (!model || !model.parts || !model.parts.length) {
      moveReport('Esta chapa nao tem pecas que possam ser movidas.', 'bad');
      return false;
    }
    // Desfazer e por chapa, como no 2D: trocar de chapa comeca do zero.
    if (move3d.sheetUid !== uid) { move3d.history = []; move3d.selectedKey = ''; }
    move3d.sheetUid = uid;
    move3d.model = model;
    move3d.partIndex = moveIndexar(model);
    // Quem isola e a pagina (o mesmo caminho do seletor de chapa), para o selo
    // "Vendo so a chapa N" e as setas ficarem certos.
    if (typeof move3d.handlers.onSheet === 'function') move3d.handlers.onSheet(uid);
    else { state.isolatedSheet = uid; applyFilters(); }
    setView('topo');
    focusSheet(uid);
    moveReport('Arraste uma peca para mudar de lugar. Solte em cima de outra para trocar as duas; arraste para fora da chapa para deixar de lado. R gira.', '');
    moveNotify();
    return true;
  }

  function moveSelect(key, pieceId) {
    move3d.selectedKey = move3d.partIndex[key] ? key : '';
    if (pieceId) selectPiece(pieceId, { silent: true });
    moveNotify();
  }

  function moveStart(event) {
    if (!state || move3d.busy) return false;
    var hit = movePartHit(event);
    if (!hit) return false;
    var part = hit.part;
    if (part.set_aside) return moveStartAside(event, hit);
    // Primeiro clique numa chapa que nao e a do ajuste: escolhe a chapa (isola e
    // enquadra). Arrastar ja nesse clique seria arrastar enquanto a camera muda.
    if (hit.sheetUid !== move3d.sheetUid) {
      if (moveUseSheet(hit.sheetUid)) moveSelect(part.part_key, part.piece_id);
      return true;
    }
    var parte = move3d.partIndex[part.part_key];
    var regras = moveRegras();
    if (!parte || !regras) {
      moveReport('Esta peca nao pode ser movida aqui.', 'bad');
      return true;
    }
    moveSelect(part.part_key, part.piece_id);
    if (parte.locked) {
      moveReport(parte.lock_reason || 'Esta peca nao pode ser movida.', 'bad');
      return true;
    }
    var entry = state.partIndex[part.piece_id];
    if (!entry) return true;
    var origem = movePointOnSheet(event, entry.sheetRecord);
    if (!origem) return true;
    move3d.drag = {
      key: part.part_key,
      part: parte,
      neighbors: regras.neighborsOf(move3d.model, part.part_key),
      record: entry.sheetRecord,
      rec: entry.partRecord,
      origin: origem,
      grab: [origem[0] - parte.x, origem[1] - parte.y],
      visBase: [parte.x, parte.y],
      x: parte.x, y: parte.y,
      moved: false, problem: '', mode: 'move'
    };
    canvasEl.style.cursor = 'grabbing';
    moveSetVisual(entry.partRecord, 0, 0, true, '');
    render();
    return true;
  }

  /** Comeca a arrastar uma peca que esta na mesa ao lado, para devolver a
   * chapa num ponto escolhido. O contorno de referencia e o do lugar de onde
   * ela SAIU (move_origin, na orientacao da vista): o servidor recebe o
   * deslocamento a partir de la, igual ao mover. */
  function moveStartAside(event, hit) {
    var part = hit.part;
    var regras = moveRegras();
    if (hit.sheetUid !== move3d.sheetUid) {
      moveUseSheet(hit.sheetUid);
      return true;
    }
    var origemModelo = part.move_origin;
    var entry = state.partIndex[part.piece_id];
    if (!regras || !origemModelo || !entry) {
      moveReport('Use o botao Devolver ao plano na ficha desta peca.', 'bad');
      return true;
    }
    var caixa = origemModelo.box;
    var parte = {
      key: part.part_key, piece_id: part.piece_id, label: part.part_name || part.piece_id,
      x: caixa[0], y: caixa[1], w: caixa[2] - caixa[0], h: caixa[3] - caixa[1], poly: origemModelo.poly
    };
    var ponto = movePointOnSheet(event, entry.sheetRecord);
    if (!ponto) return true;
    selectPiece(part.piece_id, { silent: true });
    move3d.drag = {
      key: part.part_key,
      aside: true,
      part: parte,
      neighbors: regras.neighborsOf(move3d.model, part.part_key),
      record: entry.sheetRecord,
      rec: entry.partRecord,
      origin: ponto,
      grab: [ponto[0] - part.bounds[0], ponto[1] - part.bounds[1]],
      visBase: [part.bounds[0], part.bounds[1]],
      x: parte.x, y: parte.y,
      moved: false, problem: '', mode: 'stay'
    };
    canvasEl.style.cursor = 'grabbing';
    moveSetVisual(entry.partRecord, 0, 0, true, '', 'aside');
    moveReport('Arraste a peca para cima da chapa e solte onde ela deve ficar.', '');
    render();
    return true;
  }

  function moveDragTo(event) {
    var drag = move3d.drag;
    var regras = moveRegras();
    if (!drag || !regras) return;
    var ponto = movePointOnSheet(event, drag.record);
    if (!ponto) return;
    if (Math.abs(ponto[0] - drag.origin[0]) > 0.2 || Math.abs(ponto[1] - drag.origin[1]) > 0.2) drag.moved = true;
    var rawX = ponto[0] - drag.grab[0];
    var rawY = ponto[1] - drag.grab[1];
    var modelo = move3d.model;
    var foraDaChapa = ponto[0] < 0 || ponto[1] < 0 || ponto[0] > modelo.sheet_width || ponto[1] > modelo.sheet_height;

    // 1) Cursor fora da chapa: a peca sai do plano (ou, vindo da mesa, fica la).
    if (foraDaChapa) {
      moveMarcarAlvo(drag, null);
      drag.mode = drag.aside ? 'stay' : 'aside';
      drag.x = rawX; drag.y = rawY; drag.problem = '';
      moveSetVisual(drag.rec, rawX - drag.visBase[0], rawY - drag.visBase[1], true, '', 'aside');
      moveReport(drag.aside
        ? 'Solte em cima da chapa para devolver a peca ao plano.'
        : 'Solte aqui para tirar a peca da chapa: ela fica de lado, fora do plano. Depois e so arrastar de volta.', drag.aside ? '' : 'ok');
      render();
      return;
    }

    // 2) Cursor em cima de outra peca: as duas trocam de lugar.
    if (!drag.aside) {
      var embaixo = movePartHitExcept(event, drag.key);
      if (embaixo && embaixo.sheetUid === move3d.sheetUid) {
        var outra = move3d.partIndex[embaixo.part.part_key];
        drag.mode = 'swap';
        drag.swapKey = embaixo.part.part_key;
        drag.x = rawX; drag.y = rawY;
        drag.problem = !outra ? 'Esta peca nao pode trocar de lugar.'
          : (outra.locked ? (outra.lock_reason || 'Esta peca nao pode trocar de lugar.') : '');
        moveMarcarAlvo(drag, drag.problem ? null : moveRecordFor(drag.swapKey));
        moveSetVisual(drag.rec, rawX - drag.visBase[0], rawY - drag.visBase[1], true, drag.problem, 'swap');
        moveReport(drag.problem || ('Solte para trocar de lugar com ' + (outra.piece_id || outra.label || 'esta peca') + '.'),
          drag.problem ? 'bad' : 'ok');
        render();
        return;
      }
    }

    // 3) Posicao livre na chapa: mover (ou devolver) com encaixe automatico.
    moveMarcarAlvo(drag, null);
    drag.mode = drag.aside ? 'restore' : 'move';
    var tol = regras.snapToleranceForPixelsPerMm(movePixelsPerMm(drag.record, drag.part.x, drag.part.y));
    var alvo = regras.resolvePosition(move3d.model, drag, rawX, rawY, tol);
    drag.x = alvo.x;
    drag.y = alvo.y;
    drag.problem = alvo.problem;
    moveSetVisual(drag.rec, alvo.x - drag.visBase[0], alvo.y - drag.visBase[1], true, alvo.problem);
    moveReport(alvo.problem || ((drag.aside ? 'Solte para devolver a peca em X ' : 'Solte para posicionar em X ') +
      Math.round(alvo.x) + ' / Y ' + Math.round(alvo.y) + ' mm'), alvo.problem ? 'bad' : 'ok');
    render();
  }

  function moveCancelDrag() {
    var drag = move3d.drag;
    if (!drag) return;
    move3d.drag = null;
    if (canvasEl) canvasEl.style.cursor = '';
    moveMarcarAlvo(drag, null);
    moveSetVisual(drag.rec, 0, 0, false, '');
    render();
  }

  function moveEnd() {
    var drag = move3d.drag;
    if (!drag) return;
    move3d.drag = null;
    if (canvasEl) canvasEl.style.cursor = '';
    moveMarcarAlvo(drag, null);
    var modo = drag.mode || 'move';
    function voltarAoLugar(texto, tom) {
      moveSetVisual(drag.rec, 0, 0, false, '');
      render();
      moveReport(texto, tom || '');
    }
    if (!drag.moved || modo === 'stay') {
      voltarAoLugar(drag.aside ? 'Peca fora do plano: arraste ela para cima da chapa para devolver.'
        : 'Peca escolhida: arraste para mudar de lugar, ou use R para girar.');
      return;
    }
    if (modo === 'aside') {
      // Fica onde foi solta (fora da chapa) enquanto o servidor tira do plano.
      moveSetVisual(drag.rec, drag.x - drag.visBase[0], drag.y - drag.visBase[1], false, '');
      render();
      moveExecutar({ kind: 'aside', key: drag.key }, false, drag.rec);
      return;
    }
    if (modo === 'swap') {
      if (drag.problem) { voltarAoLugar(drag.problem, 'bad'); return; }
      voltarAoLugar('', '');
      moveExecutar({ kind: 'swap', a: drag.key, b: drag.swapKey }, false, null);
      return;
    }
    var dx = drag.x - drag.part.x;
    var dy = drag.y - drag.part.y;
    if (drag.problem) {
      // Mesma regra do 2D: soltar em lugar invalido nao grava nada, e a peca
      // volta para onde estava ANTES do arrasto — nunca para "quase la".
      voltarAoLugar(drag.aside ? 'Posicao invalida: a peca voltou para a mesa ao lado.'
        : 'Posicao invalida: a peca voltou para o lugar de origem.', 'bad');
      return;
    }
    if (modo === 'restore') {
      moveSetVisual(drag.rec, drag.x - drag.visBase[0], drag.y - drag.visBase[1], false, '');
      render();
      moveExecutar({ kind: 'restore', key: drag.key, dx: dx, dy: dy }, false, drag.rec);
      return;
    }
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      voltarAoLugar('Peca escolhida: arraste para mudar de lugar, ou use R para girar.');
      return;
    }
    // Fica onde foi solta enquanto o servidor confere; se ele recusar, volta.
    moveSetVisual(drag.rec, dx, dy, false, '');
    render();
    moveExecutar({ kind: 'move', key: drag.key, dx: dx, dy: dy }, false, drag.rec);
  }

  /** Cada gesto do modo mover: quem grava (handler da pagina), com que
   * argumentos e o que dizer. Tirar da chapa, devolver e trocar entram no
   * mesmo Desfazer do mover e do girar. */
  var MOVE_ACOES = {
    move: { fn: 'commit', args: function (a) { return [a.key, a.dx, a.dy]; },
      ida: 'Conferindo a nova posicao…', ok: 'Peca movida.', desfeito: 'Movimento desfeito.', erro: 'Nao foi possivel mover a peca.' },
    rotate: { fn: 'rotate', args: function (a) { return [a.key, a.dir]; },
      ida: 'Girando a peca…', ok: 'Peca girada.', desfeito: 'Giro desfeito.', erro: 'Nao foi possivel girar a peca.' },
    aside: { fn: 'setAside', args: function (a) { return [a.key]; },
      ida: 'Tirando a peca da chapa…', ok: 'Peca fora da chapa: ela ficou na mesa ao lado. Arraste de volta quando quiser.',
      desfeito: 'Peca tirada da chapa de novo.', erro: 'Nao foi possivel tirar a peca da chapa.' },
    restore: { fn: 'restore', args: function (a) { return [a.key, a.dx, a.dy]; },
      ida: 'Devolvendo a peca a chapa…', ok: 'Peca de volta na chapa.', desfeito: 'Peca devolvida a chapa.', erro: 'Nao foi possivel devolver a peca.' },
    swap: { fn: 'swap', args: function (a) { return [a.a, a.b]; },
      ida: 'Trocando as duas pecas de lugar…', ok: 'Pecas trocadas de lugar.', desfeito: 'Troca desfeita.', erro: 'Nao foi possivel trocar as pecas.' }
  };

  function moveInverso(acao) {
    if (acao.kind === 'move') return { kind: 'move', key: acao.key, dx: -acao.dx, dy: -acao.dy };
    if (acao.kind === 'rotate') return { kind: 'rotate', key: acao.key, dir: -acao.dir };
    // Desfazer o "tirar da chapa" devolve ao lugar de onde saiu (sem ponto).
    if (acao.kind === 'aside') return { kind: 'restore', key: acao.key };
    if (acao.kind === 'restore') return { kind: 'aside', key: acao.key };
    // Trocar o mesmo par de novo: o servidor lembra a troca e volta exato.
    return { kind: 'swap', a: acao.a, b: acao.b };
  }

  function moveExecutar(acao, isUndo, rec) {
    var cfg = MOVE_ACOES[acao.kind];
    var fn = cfg ? move3d.handlers[cfg.fn] : null;
    function voltar() {
      if (rec && rec.group && rec.group.parent) { moveSetVisual(rec, 0, 0, false, ''); render(); }
    }
    if (typeof fn !== 'function') {
      voltar();
      moveReport('Esta acao ainda nao esta disponivel aqui.', 'bad');
      return Promise.resolve();
    }
    move3d.busy = true;
    moveNotify();
    moveReport(cfg.ida, '');
    var pedido;
    try {
      pedido = fn.apply(null, cfg.args(acao));
    } catch (err) {
      pedido = Promise.reject(err);
    }
    return Promise.resolve(pedido).then(function (resposta) {
      move3d.busy = false;
      if (!resposta || !resposta.ok) {
        voltar();
        moveReport((resposta && resposta.erro) || cfg.erro, 'bad');
        moveNotify();
        return resposta;
      }
      // O historico so guarda o que o servidor aceitou.
      if (isUndo) move3d.history.pop();
      else move3d.history.push(acao);
      moveReport(isUndo ? cfg.desfeito : cfg.ok, 'ok');
      moveNotify();
      return resposta;
    }, function (err) {
      move3d.busy = false;
      voltar();
      moveReport((err && err.message) || 'Falha ao gravar no servidor.', 'bad');
      moveNotify();
    });
  }

  function moveRotateSelected(direction) {
    if (!move3d.enabled || move3d.busy || move3d.drag) return Promise.resolve();
    var parte = move3d.selectedKey ? move3d.partIndex[move3d.selectedKey] : null;
    if (!parte) { moveReport('Clique numa peca antes de girar.', ''); return Promise.resolve(); }
    if (parte.locked) { moveReport(parte.lock_reason || 'Esta peca nao pode ser girada.', 'bad'); return Promise.resolve(); }
    if (parte.can_rotate === false) { moveReport(parte.rotate_reason || 'Esta peca nao pode girar nesta chapa.', 'bad'); return Promise.resolve(); }
    return moveExecutar({ kind: 'rotate', key: move3d.selectedKey, dir: direction < 0 ? -1 : 1 }, false, null);
  }

  function moveUndo() {
    if (!move3d.enabled || !move3d.history.length || move3d.busy || move3d.drag) return Promise.resolve();
    var ultimo = move3d.history[move3d.history.length - 1];
    return moveExecutar(moveInverso(ultimo), true, null);
  }

  function moveKeyDown(evt) {
    if (!move3d.enabled || !canvasEl || !canvasIsVisible()) return;
    var alvo = evt.target;
    if (alvo && alvo.closest && alvo.closest('input,textarea,[contenteditable=true]')) return;
    if (evt.key === 'Escape') {
      if (move3d.drag) { moveCancelDrag(); moveReport('Movimento cancelado.', ''); evt.preventDefault(); return; }
      if (move3d.selectedKey) { move3d.selectedKey = ''; clearSelection(); render(); moveReport('', ''); moveNotify(); }
      return;
    }
    if ((evt.key === 'r' || evt.key === 'R') && !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
      if (move3d.drag) return;
      evt.preventDefault();
      moveRotateSelected(evt.shiftKey ? -1 : 1);
    }
  }

  /** Depois de um clique (sem arrasto) a peca/chapa escolhida na cena vira a do
   * modo mover: clicar noutra chapa passa a ajustar aquela. */
  function moveSyncFromPick() {
    if (!move3d.enabled || !state) return;
    if (state.selectedSheet && state.selectedSheet !== move3d.sheetUid) { moveUseSheet(state.selectedSheet); return; }
    var sel = state.selected;
    var antes = move3d.selectedKey;
    if (sel && sel.part && !sel.setAside && moveRecordFor(sel.part.part_key) === sel) {
      move3d.selectedKey = move3d.partIndex[sel.part.part_key] ? sel.part.part_key : '';
    } else {
      move3d.selectedKey = '';
    }
    if (antes !== move3d.selectedKey) moveNotify();
  }

  /** Liga/desliga o modo. `inicio` (opcional): { sheetUid, partKey } para abrir
   * ja numa chapa, com uma peca escolhida — e o que o botao da ficha usa. */
  function setMoveMode(ligar, handlers, inicio) {
    if (handlers) move3d.handlers = handlers;
    ligar = !!ligar;
    if (!ligar) {
      moveCancelDrag();
      var estava = move3d.enabled;
      move3d.enabled = false;
      move3d.sheetUid = ''; move3d.model = null; move3d.partIndex = {};
      move3d.selectedKey = ''; move3d.history = []; move3d.busy = false;
      window.removeEventListener('keydown', moveKeyDown);
      if (estava) moveReport('', '');
      moveNotify();
      return false;
    }
    if (!state) return false;
    if (!move3d.enabled) {
      move3d.enabled = true;
      window.addEventListener('keydown', moveKeyDown);
    }
    inicio = inicio || {};
    var uid = inicio.sheetUid || state.isolatedSheet || '';
    if (!uid && state.selected && state.selected.part) {
      var entrada = state.partIndex[state.selected.part.piece_id];
      if (entrada) uid = entrada.sheetRecord.sheet.uid;
    }
    if (uid && moveUseSheet(uid)) {
      var chave = inicio.partKey || (state.selected && state.selected.part ? state.selected.part.part_key : '');
      var rec = chave ? moveRecordFor(chave) : null;
      if (rec) {
        moveSelect(chave, rec.part.piece_id);
        var parte = move3d.partIndex[chave];
        if (parte && parte.locked) moveReport(parte.lock_reason || 'Esta peca nao pode ser movida.', 'bad');
        else moveReport('Peca escolhida: arraste para mudar de lugar, ou use R para girar.', 'ok');
      }
    } else {
      setView('topo');
      moveReport('Modo mover ligado: clique na chapa (ou numa peca) que vai ajustar.', '');
    }
    moveNotify();
    return true;
  }

  /** Modelo de arrasto novo para uma chapa (vem do servidor depois de cada
   * movimento aprovado — as posicoes mudaram). */
  function setMoveModel(uid, model) {
    if (!move3d.enabled || uid !== move3d.sheetUid || !model) return;
    move3d.model = model;
    move3d.partIndex = moveIndexar(model);
    if (move3d.selectedKey && !move3d.partIndex[move3d.selectedKey]) move3d.selectedKey = '';
    moveNotify();
  }

  /** Troca UMA chapa da cena pela versao nova vinda do servidor (depois de
   * mover/girar). Nao remonta o resto: camera, zoom, filtros e isolamento ficam
   * como estao. As geometrias de molde (state.templates) sao compartilhadas
   * entre chapas e NAO sao descartadas aqui — so o que e exclusivo da chapa. */
  function replaceSheet(sheet) {
    if (!state || !sheet || !sheet.uid) return false;
    var antigo = state.sheetIndex[sheet.uid];
    if (!antigo) return false;
    var selecionada = state.selected && state.selected.part ? state.selected.part.part_key : '';
    var selecionadaAqui = !!(state.selected && antigo.parts.indexOf(state.selected) >= 0);
    if (selecionadaAqui) state.selected = null;

    var record = buildSheet(sheet, antigo.group);
    record.root.position.copy(antigo.root.position);
    record.border.position.set(0, 0, 0);
    record.root.add(record.border);
    record.labelSprite = antigo.labelSprite;
    record.grainSprite = antigo.grainSprite;
    // O rotulo diz "cortada" e quantas pecas: marcar a chapa muda o texto, entao
    // ele e refeito no mesmo lugar (a posicao vem do rotulo antigo).
    if (antigo.labelSprite) {
      var rotuloVelho = antigo.labelSprite;
      state.helpersRoot.remove(rotuloVelho);
      state.labelSprites = state.labelSprites.filter(function (s) { return s !== rotuloVelho; });
      addSheetLabel(record, {
        x: rotuloVelho.position.x - (Number(sheet.width) || 0) / 2,
        z: rotuloVelho.position.z - 130
      });
      record.labelSprite.visible = rotuloVelho.visible;
      scaleLabelSprite(record.labelSprite);
    }

    state.sheetsRoot.remove(antigo.root);
    [antigo.slab, antigo.border].forEach(function (obj) { if (obj && obj.geometry) obj.geometry.dispose(); });
    (antigo.scrapMeshes || []).forEach(function (mesh) { if (mesh.geometry) mesh.geometry.dispose(); });
    antigo.parts.forEach(function (rec) {
      (rec.edges || []).forEach(function (faixa) { if (faixa.mesh.geometry) faixa.mesh.geometry.dispose(); });
      delete state.partIndex[rec.part.piece_id];
    });
    Object.keys(state.scrapIndex).forEach(function (codigo) {
      if (state.scrapIndex[codigo].sheetRecord === antigo) delete state.scrapIndex[codigo];
    });

    state.sheetsRoot.add(record.root);
    var posicao = state.sheets.indexOf(antigo);
    if (posicao >= 0) state.sheets[posicao] = record; else state.sheets.push(record);
    state.sheetIndex[sheet.uid] = record;
    record.parts.forEach(function (rec) {
      state.partIndex[rec.part.piece_id] = { partRecord: rec, sheetRecord: record };
    });
    (record.scrapMeshes || []).forEach(function (mesh) {
      var codigo = mesh.userData.scrapCode;
      if (!codigo) return;
      if (!state.scrapIndex[codigo]) state.scrapIndex[codigo] = { meshes: [], type: mesh.userData.scrapType, sheetRecord: record };
      state.scrapIndex[codigo].meshes.push(mesh);
    });
    // Rotulos de peca sao feitos sob demanda: a chapa nova ainda nao tem.
    state.partLabelsBuilt = false;
    applyVisibility();
    applyFilters();
    paintScraps();
    if (selecionadaAqui && selecionada) {
      for (var i = 0; i < record.parts.length; i++) {
        if (record.parts[i].part.part_key === selecionada) { selectPiece(record.parts[i].part.piece_id, { silent: true }); break; }
      }
    } else if (state.selectedSheet === sheet.uid) {
      // Ficha da chapa aberta (ex.: "Ja cortei esta chapa"): mostra a situacao nova.
      renderSheetInfo(record);
    }
    render();
    return true;
  }

  // ===================== API publica =====================

  function mount(canvas, payload, opts) {
    opts = opts || {};
    canvasEl = canvas;
    statusEl = opts.statusEl || null;
    infoEl = opts.infoEl || null;
    onSelectCallback = opts.onSelect || null;
    onReadyCallback = opts.onReady || null;
    onViewCallback = opts.onViewChange || null;
    canOpenEditorCallback = opts.canOpenEditor || null;
    onScrapPickCallback = opts.onScrapPick || null;
    if (opts.visibility) Object.assign(visibility, opts.visibility);
    if (opts.colorMode) colorMode = opts.colorMode;
    setStatus('Carregando visualização 3D…', false);
    ensureThreeLoaded(function () {
      try {
        initScene();
        watchCanvasSize();
        resizeRenderer();
        bindControls();
        buildScene(payload, function () {
          if (typeof onReadyCallback === 'function') onReadyCallback({
            sheets: (payload.sheets || []).length,
            groups: (payload.groups || []).length
          });
        });
      } catch (err) {
        setStatus('Não foi possível montar a visualização 3D: ' + (err && err.message ? err.message : err) +
          ' — a visualização atual continua disponível.', true);
      }
    });
  }

  window.CutLayout3D = {
    mount: mount,
    dispose: dispose,
    resize: resizeRenderer,
    render: render,
    isActive: function () { return !!state; },
    // O canvas informado ja tem tamanho de verdade na tela? Montar escondido
    // produziria uma imagem de reserva esticada depois pelo CSS.
    canMount: function (canvas) { return canvasIsVisible(canvas); },
    setVisibility: function (flags) { Object.assign(visibility, flags || {}); applyVisibility(); applyFilters(); },
    getVisibility: function () { return Object.assign({}, visibility); },
    setFilters: function (next) { Object.assign(filters, next || {}); applyFilters(); },
    getFilters: function () { return Object.assign({}, filters); },
    setColorMode: function (nextMode) {
      if (nextMode !== 'material' && nextMode !== 'peca') return;
      if (nextMode === colorMode || !state) { colorMode = nextMode; return; }
      colorMode = nextMode;
      state.sheets.forEach(function (record) {
        record.parts.forEach(function (partRecord) {
          var material = materialDaPeca(record.group, partRecord.part, partRecord.setAside);
          partRecord.baseMaterial = material;
          if (state.selected !== partRecord) partRecord.mesh.material = material;
          syncPlugMaterial(partRecord);
        });
        record.detailRoot.traverse(function (node) {
          if (node.isMesh && node.userData && node.userData.opCategory && !node.userData.markFill) {
            node.material = machinedMaterial(record.group, node.userData.opCategory);
          }
        });
      });
      render();
    },
    getColorMode: function () { return colorMode; },
    isolateSheet: function (uid) { if (!state) return; state.isolatedSheet = uid || null; applyFilters(); if (uid) focusSheet(uid); else frameAll(); },
    frameAll: frameAll,
    focusSheet: focusSheet,
    focusPart: focusPart,
    selectPiece: function (pieceId) { selectPiece(pieceId, { silent: true }); },
    clearSelection: function () { clearSelection(); render(); },
    setView: setView,
    /** Qual vista fixa esta valendo ('' se o usuario girou a cena na mao). */
    getView: function () { return currentView; },
    selectSheet: function (uid) { selectSheet(uid); },
    /** Pinta no 3D as sobras que a pagina escolheu (lista de codigos). */
    setScrapSelection: setScrapSelection,
    /** Redesenha as sobras de uma chapa sem remontar a cena. */
    updateSheetScraps: updateSheetScraps,
    /** Quantas sobras o 3D conhece — serve para a pagina saber se vale a pena
     * avisar que nao ha sobra nenhuma nesta chapa. */
    getScrapCodes: function () { return state ? Object.keys(state.scrapIndex) : []; },
    /** Modo "Mover pecas" direto na cena. handlers: { getModel(uid), onSheet(uid),
     * commit(key, dx, dy) -> Promise<{ok, erro}>, rotate(key, dir) -> Promise,
     * onMessage(texto, tom), onStateChange(estado) }. */
    setMoveMode: setMoveMode,
    isMoveMode: function () { return move3d.enabled; },
    setMoveModel: setMoveModel,
    moveUndo: moveUndo,
    moveRotateSelected: moveRotateSelected,
    moveSheetUid: function () { return move3d.sheetUid; },
    replaceSheet: replaceSheet,
    /** Caixa 3D de uma peca no mundo, em mm. Serve para conferir que o que esta
     * na tela bate com o plano de corte (x/y do payload viram X/-Z no mundo). */
    /** Onde o centro do topo de uma peca aparece na tela (coordenadas do
     * navegador). Serve para conferencia automatica do modo mover: o robo
     * precisa saber onde clicar para arrastar a peca de verdade. */
    partScreenPoint: function (pieceId) {
      var entry = state && state.partIndex[pieceId];
      if (!entry || !canvasEl) return null;
      var rec = entry.partRecord, record = entry.sheetRecord;
      record.root.updateMatrixWorld(true);
      var p = record.root.localToWorld(new THREE.Vector3(rec.center[0], rec.center[1], record.thickness)).project(state.camera);
      var rect = canvasEl.getBoundingClientRect();
      return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height };
    },
    getPartBounds: function (pieceId) {
      var entry = state && state.partIndex[pieceId];
      if (!entry) return null;
      var box = new THREE.Box3().setFromObject(entry.partRecord.group);
      return {
        sheetUid: entry.sheetRecord.sheet.uid,
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z }
      };
    },
    getCamera: function () { return state ? state.camera : null; },
    getSheetOrigin: function (uid) {
      var record = state && state.sheetIndex[uid];
      return record ? { x: record.root.position.x, y: record.root.position.y, z: record.root.position.z } : null;
    },
    /** Legenda das cores das usinagens, para a pagina montar o rodape sem
     * repetir as cores em dois lugares. */
    getOperationLegend: function () {
      return Object.keys(OP_COLORS).map(function (key) {
        // Hex montado na mao de proposito: a legenda pode ser pedida antes de o
        // Three.js terminar de carregar.
        var hex = ('000000' + OP_COLORS[key].toString(16)).slice(-6);
        return { key: key, label: OP_LABELS[key] || key, color: '#' + hex };
      });
    },
    getSheets: function () { return state ? state.sheets.map(function (record) { return record.sheet; }) : []; },
    getGroups: function () { return state ? state.groups.slice() : []; }
  };
})();
