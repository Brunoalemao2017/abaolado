(function () {
  'use strict';

  var wrap = document.getElementById('curvo_preview_wrap');
  var canvas = document.getElementById('curvoPreviewCanvas');
  var statusEl = document.getElementById('curvoPreviewStatus');
  var curvoForm = document.querySelector('#wrapper_canto_curvo form');
  var portaForm = document.querySelector('#wrapper_porta form');
  var prateleiraForm = document.getElementById('form_prateleira');
  var muxarabiEncaixadoForm = document.getElementById('form_muxarabi_encaixado');
  var painelMuxarabiForm = document.getElementById('form_painel_muxarabi');
  var painelMuxarabiRedondoForm = document.getElementById('form_painel_muxarabi_redondo');
  var painelRipadoForm = document.getElementById('form_painel_ripado');
  var revestimentoConeForm = document.getElementById('form_revestimento_cone');
  var peConicoForm = document.getElementById('form_pe_conico');
  var peRedondoForm = document.getElementById('form_pe_redondo');
  var peRedondoEstruturadoForm = document.getElementById('form_pe_redondo_estruturado');
  var peOvalForm = document.getElementById('form_pe_oval');
  var peOblongoForm = document.getElementById('form_pe_oblongo');
  var peConicoQuadradoForm = document.getElementById('form_pe_conico_quadrado');
  var peRipadoRedondoForm = document.getElementById('form_pe_ripado_arredondado_redondo');
  var peRipadoOvalForm = document.getElementById('form_pe_ripado_arredondado_oval');
  var pePorticoUForm = document.getElementById('form_pe_portico_u');

  // Uma lista só, lida em dois lugares: a guarda de saída daqui de cima e o
  // registro dos listeners que atualizam o 3D ao vivo (ver scheduleRefresh).
  // Enquanto eram duas listas soltas, um produto novo entrava na guarda e ficava
  // de fora dos listeners: o desenho só se mexia depois de abrir o preview e
  // voltar. Foi o que aconteceu com o Pé Cônico Quadrado e com o Pé Redondo Estruturado.
  var allForms = [
    curvoForm, portaForm, prateleiraForm, muxarabiEncaixadoForm,
    painelMuxarabiForm, painelMuxarabiRedondoForm, painelRipadoForm, revestimentoConeForm, peConicoForm,
    peRedondoForm, peRedondoEstruturadoForm, peOvalForm, peOblongoForm,
    peConicoQuadradoForm, peRipadoRedondoForm, peRipadoOvalForm, pePorticoUForm
  ];
  if (!wrap || !canvas || !allForms.some(function (form) { return !!form; })) return;

  var state = null;
  var dataBySubtype = {};
  var refreshTimer = null;
  var requestController = null;
  var view = { yaw: -0.55, pitch: 0.42 };
  var zoom = 1;
  var xray = false;
  // "Estrutura interna": esconde a casca e os anéis externos e deixa só os
  // anéis internos e as ripas de ligação. Só liga/desliga a visibilidade das
  // peças já desenhadas; nunca refaz geometria. Pode ficar ligado junto com o
  // raio-X: aí o esqueleto que sobrou fica transparente.
  var estruturaInterna = false;
  var expanded = false;
  var originalParent = null;
  var originalNextSibling = null;
  // Botões que flutuam dentro do quadro na tela cheia (XR e EI), com o lugar
  // de onde saíram para voltarem ao fechar.
  var floatingButtonsHome = [];
  var lastSelectedSubtype = null;
  var geometryRequestSeq = 0;

  // Nos curvos, "Gerar reforço" pode ser desmarcado/remarcado sozinho pelo
  // servidor (geometria sem espaço / medidas voltaram a caber). Um
  // clique real do usuário no checkbox (nunca disparado por atribuição via
  // script, só por interação humana) zera o campo oculto
  // reforco_auto_desativado — é isso que faz a escolha manual do usuário
  // ser respeitada mesmo depois de novas requisições de geometria.
  var chkGerarReforco = curvoForm ? curvoForm.querySelector('[name="gerar_reforco"]') : null;
  if (chkGerarReforco) {
    chkGerarReforco.addEventListener('change', function () {
      var hiddenAuto = curvoForm.querySelector('[name="reforco_auto_desativado"]');
      if (hiddenAuto) hiddenAuto.value = '0';
    });
  }

  function currentSubtype() {
    var portaWrap = document.getElementById('wrapper_porta');
    if (portaWrap && portaWrap.style.display !== 'none') {
      var portaKind = document.getElementById('produto_hidden');
      return portaKind ? portaKind.value : 'porta_puxador_cava_quadrado';
    }
    var prateleiraWrap = document.getElementById('wrapper_prateleira');
    if (prateleiraWrap && prateleiraWrap.style.display !== 'none') return 'prateleira_dupla';
    var muxarabiWrap = document.getElementById('wrapper_muxarabi_encaixado');
    if (muxarabiWrap && muxarabiWrap.style.display !== 'none') return 'muxarabi_encaixado';
    var painelMuxarabiWrap = document.getElementById('wrapper_painel_muxarabi');
    if (painelMuxarabiWrap && painelMuxarabiWrap.style.display !== 'none') return 'painel_muxarabi';
    var painelMuxarabiRedondoWrap = document.getElementById('wrapper_painel_muxarabi_redondo');
    if (painelMuxarabiRedondoWrap && painelMuxarabiRedondoWrap.style.display !== 'none') return 'painel_muxarabi_redondo';
    var painelRipadoWrap = document.getElementById('wrapper_painel_ripado');
    if (painelRipadoWrap && painelRipadoWrap.style.display !== 'none') return 'painel_ripado_cavilhado';
    var revestimentoConeWrap = document.getElementById('wrapper_revestimento_cone');
    if (revestimentoConeWrap && revestimentoConeWrap.style.display !== 'none') return 'revestimento_cone_eliptico';
    var peConicoWrap = document.getElementById('wrapper_pe_conico');
    if (peConicoWrap && peConicoWrap.style.display !== 'none') return 'pe_conico';
    var peRedondoWrap = document.getElementById('wrapper_pe_redondo');
    if (peRedondoWrap && peRedondoWrap.style.display !== 'none') return 'pe_redondo';
    var peRedondoEstruturadoWrap = document.getElementById('wrapper_pe_redondo_estruturado');
    if (peRedondoEstruturadoWrap && peRedondoEstruturadoWrap.style.display !== 'none') return 'pe_redondo_estruturado';
    var peOvalWrap = document.getElementById('wrapper_pe_oval');
    if (peOvalWrap && peOvalWrap.style.display !== 'none') return 'pe_oval';
    var peOblongoWrap = document.getElementById('wrapper_pe_oblongo');
    if (peOblongoWrap && peOblongoWrap.style.display !== 'none') return 'pe_oblongo';
    var peConicoQuadradoWrap = document.getElementById('wrapper_pe_conico_quadrado');
    if (peConicoQuadradoWrap && peConicoQuadradoWrap.style.display !== 'none') return 'pe_conico_quadrado';
    var peRipadoRedondoWrap = document.getElementById('wrapper_pe_ripado_arredondado_redondo');
    if (peRipadoRedondoWrap && peRipadoRedondoWrap.style.display !== 'none') return 'pe_ripado_arredondado_redondo';
    var peRipadoOvalWrap = document.getElementById('wrapper_pe_ripado_arredondado_oval');
    if (peRipadoOvalWrap && peRipadoOvalWrap.style.display !== 'none') return 'pe_ripado_arredondado_oval';
    var pePorticoUWrap = document.getElementById('wrapper_pe_portico_u');
    if (pePorticoUWrap && pePorticoUWrap.style.display !== 'none') return 'pe_portico_u';
    var input = document.getElementById('tipo_curvo_hidden');
    return input ? input.value : 'simples';
  }

  function supports3d(subtype) {
    return subtype === 'simples' || subtype === 'simples_v3' || subtype === 'duplo_vertical' || subtype === 'curvo_duplo_180' || subtype === 'duplo_parafusado' || subtype === 'porta_puxador_cava_quadrado' || subtype === 'porta_puxador_cava_longa' || subtype === 'porta_puxador_cava_redonda' || subtype === 'porta_sem_puxador' || subtype === 'prateleira_dupla' || subtype === 'muxarabi_encaixado' || subtype === 'painel_muxarabi' || subtype === 'painel_muxarabi_redondo' || subtype === 'painel_ripado_cavilhado' || subtype === 'revestimento_cone_eliptico' || subtype === 'pe_conico' || subtype === 'pe_redondo' || subtype === 'pe_redondo_estruturado' || subtype === 'pe_oval' || subtype === 'pe_oblongo' || subtype === 'pe_conico_quadrado' || subtype === 'pe_ripado_arredondado_redondo' || subtype === 'pe_ripado_arredondado_oval' || subtype === 'pe_portico_u';
  }

  function activeForm(subtype) {
    if (subtype === 'porta_puxador_cava_quadrado' || subtype === 'porta_puxador_cava_longa' || subtype === 'porta_puxador_cava_redonda' || subtype === 'porta_sem_puxador') return portaForm;
    if (subtype === 'prateleira_dupla') return prateleiraForm;
    if (subtype === 'muxarabi_encaixado') return muxarabiEncaixadoForm;
    if (subtype === 'painel_muxarabi') return painelMuxarabiForm;
    if (subtype === 'painel_muxarabi_redondo') return painelMuxarabiRedondoForm;
    if (subtype === 'painel_ripado_cavilhado') return painelRipadoForm;
    if (subtype === 'revestimento_cone_eliptico') return revestimentoConeForm;
    if (subtype === 'pe_conico') return peConicoForm;
    if (subtype === 'pe_redondo') return peRedondoForm;
    if (subtype === 'pe_redondo_estruturado') return peRedondoEstruturadoForm;
    if (subtype === 'pe_oval') return peOvalForm;
    if (subtype === 'pe_oblongo') return peOblongoForm;
    if (subtype === 'pe_conico_quadrado') return peConicoQuadradoForm;
    if (subtype === 'pe_ripado_arredondado_redondo') return peRipadoRedondoForm;
    if (subtype === 'pe_ripado_arredondado_oval') return peRipadoOvalForm;
    if (subtype === 'pe_portico_u') return pePorticoUForm;
    return curvoForm;
  }

  function geometryEndpoint(subtype) {
    if (subtype === 'porta_puxador_cava_quadrado' || subtype === 'porta_puxador_cava_longa' || subtype === 'porta_puxador_cava_redonda' || subtype === 'porta_sem_puxador') return '/api/portas/montado3d';
    if (subtype === 'prateleira_dupla') return '/api/prateleiras/montado3d';
    if (subtype === 'muxarabi_encaixado') return '/api/muxarabi-encaixado/montado3d';
    if (subtype === 'painel_muxarabi') return '/api/painel-muxarabi/montado3d';
    if (subtype === 'painel_muxarabi_redondo') return '/api/painel-muxarabi-redondo/montado3d';
    if (subtype === 'painel_ripado_cavilhado') return '/api/painel-ripado/montado3d';
    if (subtype === 'revestimento_cone_eliptico') return '/api/revestimento-cone/montado3d';
    if (subtype === 'pe_conico') return '/api/pe-conico/montado3d';
    if (subtype === 'pe_redondo') return '/api/pe-redondo/montado3d';
    if (subtype === 'pe_redondo_estruturado') return '/api/pe-redondo-estruturado/montado3d';
    if (subtype === 'pe_oval') return '/api/pe-oval/montado3d';
    if (subtype === 'pe_oblongo') return '/api/pe-oblongo/montado3d';
    if (subtype === 'pe_conico_quadrado') return '/api/pe-conico-quadrado/montado3d';
    if (subtype === 'pe_ripado_arredondado_redondo') return '/api/pe-ripado-arredondado-redondo/montado3d';
    if (subtype === 'pe_ripado_arredondado_oval') return '/api/pe-ripado-arredondado-oval/montado3d';
    if (subtype === 'pe_portico_u') return '/api/pe-portico-u/montado3d';
    return '/api/curvos/montado3d';
  }

  function isActive() {
    return supports3d(currentSubtype()) && wrap.style.display !== 'none';
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
    statusEl.style.display = text ? 'block' : 'none';
  }

  function ensureThreeLoaded(callback) {
    if (window.THREE) { callback(); return; }
    var existing = document.querySelector('script[src="/static/vendor/three.min.js"]');
    if (existing) {
      existing.addEventListener('load', callback, { once: true });
      return;
    }
    var script = document.createElement('script');
    script.id = 'curvoThreeScript';
    script.src = '/static/vendor/three.min.js';
    script.onload = callback;
    script.onerror = function () { setStatus('Não foi possível carregar o preview 3D.', true); };
    document.head.appendChild(script);
  }

  function canvasSize() {
    var rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width || 340)),
      height: Math.max(1, Math.round(rect.height || 280))
    };
  }

  function initScene() {
    if (state || !window.THREE) return;
    var size = canvasSize();
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      if (window.avisoWebGL) window.avisoWebGL(canvas, e);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(size.width, size.height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if ('toneMapping' in renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, size.width / size.height, 1, 100000);
    var model = new THREE.Group();
    scene.add(model);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    var mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(600, 900, 500);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);
    mainLight.shadow.bias = -0.0015;
    scene.add(mainLight);
    scene.add(mainLight.target);

    var fillLight = new THREE.DirectionalLight(0xffffff, 0.28);
    fillLight.position.set(-500, 300, -400);
    scene.add(fillLight);

    var materials = {
      estrutura: new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
      curva: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      flex: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      reforco: new THREE.MeshStandardMaterial({ color: 0x00ffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
      ripa: new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
      ripaAmadeirada: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      flexMiolo: new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
      fresagemDobra: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
      prateleira: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      prateleiraEspelhada: new THREE.MeshStandardMaterial({ color: 0xb7794d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      furoCego: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6, metalness: 0, side: THREE.DoubleSide }),
      usinagem: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65, metalness: 0, side: THREE.DoubleSide }),
      alivio: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65, metalness: 0, side: THREE.DoubleSide }),
      muxVertical: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.FrontSide }),
      muxHorizontal: new THREE.MeshStandardMaterial({ color: 0xc48a5a, roughness: 0.7, metalness: 0, side: THREE.FrontSide }),
      muxMoldura: new THREE.MeshStandardMaterial({ color: 0x75452b, roughness: 0.76, metalness: 0, side: THREE.FrontSide }),
      painelMuxarabi: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      ripadoFundo: new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
      ripadoRipa: new THREE.MeshStandardMaterial({ color: 0xb7794d, roughness: 0.7, metalness: 0, side: THREE.DoubleSide }),
      cavilha: new THREE.MeshStandardMaterial({ color: 0xe4b875, roughness: 0.65, metalness: 0, side: THREE.DoubleSide }),
      portaCasca: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      portaMiolo: new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
      portaFuro: new THREE.MeshStandardMaterial({ color: 0x6f4a2f, roughness: 0.96, metalness: 0, side: THREE.DoubleSide }),
      portaVbit: new THREE.MeshStandardMaterial({ color: 0xc89a63, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
      coneCasca: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.7, metalness: 0, side: THREE.DoubleSide }),
      coneMiolo: new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
      coneAnel: new THREE.MeshStandardMaterial({ color: 0x6f3f25, roughness: 0.76, metalness: 0, side: THREE.DoubleSide }),
      // Alerta: aparece através da casca (o toque fica dentro da parede).
      coneInterferencia: new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }),
      anelDentado: new THREE.MeshStandardMaterial({ color: 0x6f3f25, roughness: 0.76, metalness: 0, side: THREE.DoubleSide }),
      ripaEstruturada: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
      fresagemCone: new THREE.MeshStandardMaterial({ color: 0xb48252, roughness: 0.94, metalness: 0, side: THREE.DoubleSide }),
      vbitEstruturado: new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
      porticoCasca: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.7, metalness: 0, side: THREE.DoubleSide }),
      porticoMiolo: new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
      porticoEmenda: new THREE.MeshStandardMaterial({ color: 0x9b633d, roughness: 0.7, metalness: 0, side: THREE.DoubleSide }),
      emendaCone: new THREE.LineBasicMaterial({ color: 0x111827 }),
      // Emenda da casca dos curvos: mesma cor das arestas do desenho. É uma
      // tira rasa (não uma barra), com polygonOffset mais forte que o da
      // própria casca — senão a casca ganha no z-buffer e a marca some.
      emendaParede: new THREE.MeshBasicMaterial({
        color: 0x0f172a, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12
      })
    };
    [materials.curva, materials.flex].forEach(function (material) {
      material.polygonOffset = true;
      material.polygonOffsetFactor = -4;
      material.polygonOffsetUnits = -4;
    });
    materials.muxHorizontal.polygonOffset = true;
    materials.muxHorizontal.polygonOffsetFactor = -2;
    materials.muxHorizontal.polygonOffsetUnits = -2;

    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    state = {
      renderer: renderer,
      scene: scene,
      camera: camera,
      model: model,
      floor: floor,
      mainLight: mainLight,
      materials: materials,
      edgeMaterial: new THREE.LineBasicMaterial({ color: 0x0f172a }),
      center: new THREE.Vector3(),
      radius: 100,
      fitDistance: 500
    };
    bindCanvasControls();
    resizeRenderer();
  }

  function disposeModel() {
    if (!state) return;
    while (state.model.children.length) {
      var child = state.model.children[0];
      state.model.remove(child);
      child.traverse(function (node) {
        if (node.geometry) node.geometry.dispose();
      });
    }
  }

  // Etiqueta do anel para o modo "Estrutura interna". O Pé Cônico Quadrado
  // manda `interno` pronto; Redondo, Oblongo e Oval só dizem pelo rótulo
  // ("TOPO EXT." / "BASE INT."...). O rótulo é lido aqui, e não acrescentado
  // no gerador, para o payload desses pés (congelado nos testes) não mudar.
  function parteDoAnel(ring) {
    if (!ring) return 'anelExterno';
    if (typeof ring.interno === 'boolean') return ring.interno ? 'anelInterno' : 'anelExterno';
    return /\bINT\./.test(String(ring.label || '')) ? 'anelInterno' : 'anelExterno';
  }

  function addMesh(mesh, geometry, showEdges) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (showEdges !== false) {
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), state.edgeMaterial);
      mesh.add(edges);
    }
    state.model.add(mesh);
  }

  function applyWoodTexture(material, repeatX, repeatY) {
    if (!state || !material || material.userData.woodTextureRequested) return;
    material.userData.woodTextureRequested = true;
    state.woodTextureQueue = state.woodTextureQueue || [];

    function applyTexture(source, target, x, y) {
      var texture = source.clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(x, y);
      texture.needsUpdate = true;
      target.map = texture;
      target.color.setHex(0xffffff);
      target.needsUpdate = true;
    }

    if (state.woodTexture) {
      applyTexture(state.woodTexture, material, repeatX, repeatY);
      return;
    }
    state.woodTextureQueue.push({ material: material, repeatX: repeatX, repeatY: repeatY });
    if (state.woodTextureLoading) return;

    state.woodTextureLoading = true;
    new THREE.TextureLoader().load(
      '/static/textura_melamina_nogueira.jpg?v=1',
      function (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, state.renderer.capabilities.getMaxAnisotropy());
        state.woodTexture = texture;
        state.woodTextureLoading = false;
        var queue = state.woodTextureQueue.splice(0);
        queue.forEach(function (entry) {
          applyTexture(texture, entry.material, entry.repeatX, entry.repeatY);
        });
        render();
      },
      undefined,
      function () {
        state.woodTextureLoading = false;
        state.woodTextureQueue.splice(0).forEach(function (entry) {
          entry.material.userData.woodTextureRequested = false;
        });
      }
    );
  }

  function addFlatPanel(outline, zBottom, thickness, material, holes) {
    if (!outline || outline.length < 3) return;
    var points = outline.map(function (point) { return new THREE.Vector2(point[0], point[1]); });
    var shape = new THREE.Shape(points);
    // Aberturas internas do painel (hoje: "Vazar Estrutura" do Curvo Duplo
    // 180°). O three.js quer o furo no sentido oposto ao do contorno, por isso
    // o sentido e conferido pela area antes de entrar. Sem furo nada muda.
    (holes || []).forEach(function (hole) {
      if (!hole || hole.length < 3) return;
      var pontos = hole.map(function (point) { return new THREE.Vector2(point[0], point[1]); });
      if (THREE.ShapeUtils.area(pontos) * THREE.ShapeUtils.area(points) > 0) pontos.reverse();
      shape.holes.push(new THREE.Path(pontos));
    });
    var geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 1
    });
    geometry.rotateX(-Math.PI / 2);
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = zBottom;
    addMesh(mesh, geometry);
  }

  function addRipa(rect, height, material, faceMaterial, faceName) {
    var width = rect.x1 - rect.x0;
    var depth = rect.y1 - rect.y0;
    if (!(width > 0 && depth > 0 && height > 0)) return;
    var geometry = new THREE.BoxGeometry(width, height, depth);
    var meshMaterial = material;
    if (faceMaterial && faceName) {
      // Ordem dos grupos do BoxGeometry: +X, -X, +Y, -Y, +Z, -Z.
      // A ripa esquerda encosta na parede curva pela face -X; somente essa
      // superfície recebe o acabamento externo amadeirado.
      meshMaterial = [material, material, material, material, material, material];
      if (faceName === 'esquerda') meshMaterial[1] = faceMaterial;
      if (faceName === 'direita') meshMaterial[0] = faceMaterial;
      if (faceName === 'frente') meshMaterial[4] = faceMaterial;
      if (faceName === 'fundo') meshMaterial[5] = faceMaterial;
    }
    var mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.position.set(rect.x0 + width / 2, height / 2, -(rect.y0 + depth / 2));
    addMesh(mesh, geometry);
  }

  function addWall(data) {
    var path = data.front_path || [];
    var count = path.length;
    if (count < 2) return;
    var thickness = data.espessura_mdf;
    var flexThickness = Math.max(0.1, Math.min(thickness, Number(data.espessura_flex) || 1));
    var height = data.altura;
    var normals = [];
    var pathDistances = [0];
    var i;
    for (i = 0; i < count; i++) {
      var previous = path[Math.max(0, i - 1)];
      var next = path[Math.min(count - 1, i + 1)];
      var tx = next[0] - previous[0];
      var ty = next[1] - previous[1];
      var length = Math.hypot(tx, ty) || 1;
      normals.push([-ty / length, tx / length]);
      if (i > 0) {
        pathDistances.push(pathDistances[i - 1] + Math.hypot(
          path[i][0] - path[i - 1][0],
          path[i][1] - path[i - 1][1]
        ));
      }
    }
    var totalPathLength = Math.max(pathDistances[pathDistances.length - 1], 1);

    var mainPositions = [], mainIndices = [];
    var flexPositions = [], flexIndices = [];
    var mainUvs = [], flexUvs = [];
    var flexRanges = data.front_flex_ranges || [[data.front_flex_start_idx, data.front_flex_end_idx]];
    function segmentIsFlex(index) {
      return flexRanges.some(function (range) {
        return range && index >= range[0] && index < range[1];
      });
    }
    function quad(a, b, c, d, positions, indices, uvs, uvCoords) {
      var base = positions.length / 3;
      [a, b, c, d].forEach(function (point) { positions.push(point[0], point[1], point[2]); });
      uvCoords.forEach(function (uv) { uvs.push(uv[0], uv[1]); });
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    for (i = 0; i < count - 1; i++) {
      var p0 = path[i], p1 = path[i + 1];
      var n0 = normals[i], n1 = normals[i + 1];
      var isFlex = segmentIsFlex(i);
      var localThickness = isFlex ? flexThickness : thickness;
      var outerBottom0 = [p0[0], 0, -p0[1]], outerTop0 = [p0[0], height, -p0[1]];
      var outerBottom1 = [p1[0], 0, -p1[1]], outerTop1 = [p1[0], height, -p1[1]];
      var innerBottom0 = [p0[0] - n0[0] * localThickness, 0, -(p0[1] - n0[1] * localThickness)];
      var innerTop0 = [p0[0] - n0[0] * localThickness, height, -(p0[1] - n0[1] * localThickness)];
      var innerBottom1 = [p1[0] - n1[0] * localThickness, 0, -(p1[1] - n1[1] * localThickness)];
      var innerTop1 = [p1[0] - n1[0] * localThickness, height, -(p1[1] - n1[1] * localThickness)];
      var positions = isFlex ? flexPositions : mainPositions;
      var indices = isFlex ? flexIndices : mainIndices;
      var uvs = isFlex ? flexUvs : mainUvs;
      var u0 = pathDistances[i] / totalPathLength;
      var u1 = pathDistances[i + 1] / totalPathLength;
      quad(outerBottom0, outerTop0, outerTop1, outerBottom1, positions, indices, uvs, [
        [u0, 0], [u0, 1], [u1, 1], [u1, 0]
      ]);
      quad(innerBottom1, innerTop1, innerTop0, innerBottom0, positions, indices, uvs, [
        [u1, 0], [u1, 1], [u0, 1], [u0, 0]
      ]);
      quad(outerTop0, innerTop0, innerTop1, outerTop1, positions, indices, uvs, [
        [u0, 0], [u0, 1], [u1, 1], [u1, 0]
      ]);
    }

    function wallMesh(positions, indices, uvs, material) {
      if (!positions.length) return;
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, material), geometry);
    }
    applyWoodTexture(state.materials.curva, 1, 1);
    applyWoodTexture(state.materials.flex, 1, 1);
    wallMesh(mainPositions, mainIndices, mainUvs, state.materials.curva);
    wallMesh(flexPositions, flexIndices, flexUvs, state.materials.flex);

    // Nas duas extremidades de cada flexzone, mostra o degrau real entre o
    // MDF cheio e a casquinha restante após a fresagem.
    var transitionPositions = [];
    for (i = 1; i < count - 1; i++) {
      if (segmentIsFlex(i - 1) === segmentIsFlex(i)) continue;
      var point = path[i];
      var normal = normals[i];
      var flexInnerBottom = [point[0] - normal[0] * flexThickness, 0, -(point[1] - normal[1] * flexThickness)];
      var flexInnerTop = [flexInnerBottom[0], height, flexInnerBottom[2]];
      var fullInnerBottom = [point[0] - normal[0] * thickness, 0, -(point[1] - normal[1] * thickness)];
      var fullInnerTop = [fullInnerBottom[0], height, fullInnerBottom[2]];
      [flexInnerBottom, flexInnerTop, fullInnerTop, flexInnerBottom, fullInnerTop, fullInnerBottom].forEach(function (vertex) {
        transitionPositions.push(vertex[0], vertex[1], vertex[2]);
      });
    }
    if (transitionPositions.length) {
      var transitionGeometry = new THREE.BufferGeometry();
      transitionGeometry.setAttribute('position', new THREE.Float32BufferAttribute(transitionPositions, 3));
      transitionGeometry.computeVertexNormals();
      addMesh(new THREE.Mesh(transitionGeometry, state.materials.flexMiolo), transitionGeometry);
    }

    // Emenda: onde as duas pontas da peça de dobrar se encontram. Só existe
    // quando a casca fecha a volta inteira (Curvo Duplo 180° espelhado). Um
    // risco fino rente à face de fora e à de dentro, como nas emendas dos Pés
    // Especiais — sem relevo nenhum, é só marcação.
    var seamPositions = [];
    (data.emendas_parede || []).forEach(function (indiceBruto) {
      var seamIndex = Math.max(0, Math.min(count - 1, Math.round(Number(indiceBruto) || 0)));
      var seamPoint = path[seamIndex];
      var seamNormal = normals[seamIndex];
      var seamThickness = segmentIsFlex(seamIndex) ? flexThickness : thickness;
      var seamDir = [seamNormal[1], -seamNormal[0]];
      var seamHalf = 0.6;
      [0, seamThickness].forEach(function (depth) {
        var cx = seamPoint[0] - seamNormal[0] * depth;
        var cy = seamPoint[1] - seamNormal[1] * depth;
        var ax = cx - seamDir[0] * seamHalf, ay = cy - seamDir[1] * seamHalf;
        var bx = cx + seamDir[0] * seamHalf, by = cy + seamDir[1] * seamHalf;
        seamPositions.push(
          ax, 0, -ay, ax, height, -ay, bx, height, -by,
          ax, 0, -ay, bx, height, -by, bx, 0, -by
        );
      });
    });
    if (seamPositions.length) {
      var seamGeometry = new THREE.BufferGeometry();
      seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seamPositions, 3));
      seamGeometry.computeVertexNormals();
      addMesh(new THREE.Mesh(seamGeometry, state.materials.emendaParede), seamGeometry, false);
    }
  }

  function addKerfedWall(data) {
    var path = data.front_path || [];
    if (path.length < 2) return;
    var height = Number(data.altura);
    var thickness = Number(data.espessura_peca);
    var depth = Number(data.profundidade_fresagem);
    var remaining = Number(data.espessura_restante);
    if (!(height > 0 && thickness > 0 && depth > 0 && remaining > 0)) return;

    var distances = (data.front_path_distances || []).map(Number);
    if (distances.length !== path.length) {
      distances = [0];
      for (var di = 1; di < path.length; di++) {
        distances.push(distances[di - 1] + Math.hypot(
          path[di][0] - path[di - 1][0], path[di][1] - path[di - 1][1]
        ));
      }
    }
    var total = distances[distances.length - 1];
    var normals = [];
    for (var ni = 0; ni < path.length; ni++) {
      var before = path[Math.max(0, ni - 1)];
      var after = path[Math.min(path.length - 1, ni + 1)];
      var tx = Number(after[0]) - Number(before[0]);
      var ty = Number(after[1]) - Number(before[1]);
      var size = Math.hypot(tx, ty) || 1;
      normals.push([-ty / size, tx / size]);
    }

    function sampleAt(rawDistance) {
      var distance = Math.max(0, Math.min(total, Number(rawDistance)));
      var index = 0;
      while (index < distances.length - 2 && distances[index + 1] < distance - 1e-9) index++;
      var span = distances[index + 1] - distances[index];
      var ratio = span > 1e-9 ? (distance - distances[index]) / span : 0;
      var px = Number(path[index][0]) + (Number(path[index + 1][0]) - Number(path[index][0])) * ratio;
      var py = Number(path[index][1]) + (Number(path[index + 1][1]) - Number(path[index][1])) * ratio;
      var nx = normals[index][0] + (normals[index + 1][0] - normals[index][0]) * ratio;
      var ny = normals[index][1] + (normals[index + 1][1] - normals[index][1]) * ratio;
      var nl = Math.hypot(nx, ny) || 1;
      return { distance: distance, x: px, y: py, nx: nx / nl, ny: ny / nl };
    }

    function pointAt(sample, bandDepth, y) {
      return [
        sample.x - sample.nx * bandDepth,
        y,
        -(sample.y - sample.ny * bandDepth)
      ];
    }

    function triangle(target, a, b, c) {
      [a, b, c].forEach(function (point) { target.push(point[0], point[1], point[2]); });
    }
    function quad(target, a, b, c, d) {
      triangle(target, a, b, c);
      triangle(target, a, c, d);
    }
    function quadUv(target, a, b, c, d) {
      [a, b, c, a, c, d].forEach(function (item) {
        target.push(item[0], item[1]);
      });
    }
    function meshPositions(positions, material, edges, uvs) {
      if (!positions.length) return;
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      // As faces da peça fresada também recebem UVs. Sem este atributo o
      // material com textura amadeirada amostra sempre o mesmo texel e a
      // parede aparece como uma cor sólida, especialmente na parte curva.
      if (uvs && uvs.length === (positions.length / 3) * 2) {
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      }
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, material), geometry, edges);
    }
    function samplesBetween(start, end) {
      var result = [sampleAt(start)];
      for (var index = 1; index < distances.length - 1; index++) {
        if (distances[index] > start + 1e-9 && distances[index] < end - 1e-9) {
          result.push(sampleAt(distances[index]));
        }
      }
      result.push(sampleAt(end));
      return result;
    }

    // Faixa fechada entre duas profundidades: superfícies externa/interna,
    // topo, base e tampas nas duas extremidades. A casca residual é uma faixa
    // contínua; cada intervalo entre canais recebe outra faixa até completar
    // a espessura original.
    function addBand(start, end, depth0, depth1, material) {
      if (!(end > start && depth1 > depth0)) return;
      var samples = samplesBetween(start, end);
      var positions = [];
      var uvs = [];
      function uv(sample, y) {
        // U acompanha o desenvolvimento da parede e V acompanha a altura,
        // mantendo o veio vertical tanto nos trechos retos quanto no arco.
        return [sample.distance / Math.max(total, 1), y / Math.max(height, 1)];
      }
      for (var index = 0; index < samples.length - 1; index++) {
        var a = samples[index], b = samples[index + 1];
        var a00 = pointAt(a, depth0, 0), a01 = pointAt(a, depth0, height);
        var a10 = pointAt(a, depth1, 0), a11 = pointAt(a, depth1, height);
        var b00 = pointAt(b, depth0, 0), b01 = pointAt(b, depth0, height);
        var b10 = pointAt(b, depth1, 0), b11 = pointAt(b, depth1, height);
        quad(positions, a00, a01, b01, b00);
        quadUv(uvs, uv(a, 0), uv(a, height), uv(b, height), uv(b, 0));
        quad(positions, b10, b11, a11, a10);
        quadUv(uvs, uv(b, 0), uv(b, height), uv(a, height), uv(a, 0));
        quad(positions, a01, a11, b11, b01);
        quadUv(uvs, uv(a, height), uv(a, height), uv(b, height), uv(b, height));
        quad(positions, b00, b10, a10, a00);
        quadUv(uvs, uv(b, 0), uv(b, 0), uv(a, 0), uv(a, 0));
      }
      var first = samples[0], last = samples[samples.length - 1];
      quad(positions, pointAt(first, depth0, 0), pointAt(first, depth1, 0), pointAt(first, depth1, height), pointAt(first, depth0, height));
      quadUv(uvs, uv(first, 0), uv(first, 0), uv(first, height), uv(first, height));
      quad(positions, pointAt(last, depth1, 0), pointAt(last, depth0, 0), pointAt(last, depth0, height), pointAt(last, depth1, height));
      quadUv(uvs, uv(last, 0), uv(last, 0), uv(last, height), uv(last, height));
      meshPositions(positions, material, true, uvs);
    }

    function addGrooveFloor(start, end, floorDepth) {
      var samples = samplesBetween(start, end);
      var positions = [];
      for (var index = 0; index < samples.length - 1; index++) {
        var a = samples[index], b = samples[index + 1];
        quad(
          positions,
          pointAt(a, floorDepth, 0), pointAt(a, floorDepth, height),
          pointAt(b, floorDepth, height), pointAt(b, floorDepth, 0)
        );
      }
      meshPositions(positions, state.materials.fresagemDobra, false);
    }

    function addGrooveSide(distance, depth0, depth1) {
      var sample = sampleAt(distance);
      var positions = [];
      quad(
        positions,
        pointAt(sample, depth0, 0), pointAt(sample, depth1, 0),
        pointAt(sample, depth1, height), pointAt(sample, depth0, height)
      );
      meshPositions(positions, state.materials.fresagemDobra, false);
    }

    var ranges = (data.fresagens_caminho || []).map(function (range) {
      return [Math.max(0, Number(range[0])), Math.min(total, Number(range[1]))];
    }).filter(function (range) { return range[1] > range[0]; });
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var materialRanges = [];
    var cursor = 0;
    ranges.forEach(function (range) {
      if (range[0] > cursor + 1e-9) materialRanges.push([cursor, range[0]]);
      cursor = Math.max(cursor, range[1]);
    });
    if (cursor < total - 1e-9) materialRanges.push([cursor, total]);

    applyWoodTexture(state.materials.curva, 1, 1);
    var externalFace = data.lado_fresagem === 'externa';
    var skinDepth0 = externalFace ? depth : 0;
    var skinDepth1 = externalFace ? thickness : remaining;
    var ribDepth0 = externalFace ? 0 : remaining;
    var ribDepth1 = externalFace ? depth : thickness;
    var floorDepth = externalFace ? depth : remaining;
    addBand(0, total, skinDepth0, skinDepth1, state.materials.curva);
    materialRanges.forEach(function (range) {
      addBand(range[0], range[1], ribDepth0, ribDepth1, state.materials.curva);
    });
    ranges.forEach(function (range) {
      addGrooveFloor(range[0], range[1], floorDepth);
      addGrooveSide(range[0], ribDepth0, ribDepth1);
      addGrooveSide(range[1], ribDepth0, ribDepth1);
    });
  }

  function addShelfPanel(data) {
    var outline = data.outline || [];
    if (outline.length < 3) return;
    var shape = new THREE.Shape();
    outline.forEach(function (point, index) {
      if (index === 0) shape.moveTo(point[0], point[1]);
      else shape.lineTo(point[0], point[1]);
    });
    shape.closePath();
    var thickness = Number(data.espessura) || 18;
    var geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 24
    });
    geometry.rotateX(-Math.PI / 2);
    var firstLayer = new THREE.Mesh(geometry, state.materials.prateleira);
    addMesh(firstLayer, geometry);
    if (data.segunda_peca_espelhada !== false || Number(data.quantidade_pecas) >= 2) {
      var secondGeometry = geometry.clone();
      var secondLayer = new THREE.Mesh(secondGeometry, state.materials.prateleiraEspelhada);
      secondLayer.position.y = thickness;
      addMesh(secondLayer, secondGeometry);
    }

    // As cavilhas sao furadas pelas faces de colagem e nao atravessam o MDF.
    // Os cilindros abaixo representam as duas cavidades cegas e ficam ocultos
    // no modo normal; o raio X os revela dentro das chapas.
    var blindDepth = Math.min(
      Math.max(1, Number(data.profundidade_furo_preview) || 10),
      Math.max(1, thickness - 0.5)
    );
    (data.furos || []).forEach(function (hole) {
      var radius = Number(hole.diametro) / 2;
      if (!(radius > 0)) return;
      [thickness - blindDepth / 2, thickness + blindDepth / 2].forEach(function (centerY) {
        var holeGeometry = new THREE.CylinderGeometry(radius, radius, blindDepth, 24, 1, false);
        var holeMarker = new THREE.Mesh(holeGeometry, state.materials.furoCego);
        holeMarker.position.set(Number(hole.x), centerY, -Number(hole.y));
        holeMarker.userData.xrayOnly = true;
        holeMarker.visible = xray;
        addMesh(holeMarker, holeGeometry);
      });
    });

    function addMachining(rect, material) {
      var x0 = Math.max(0, Number(rect.x0));
      var x1 = Math.min(Number(data.largura), Number(rect.x1));
      var y0 = Math.max(0, Number(rect.y0));
      var y1 = Math.min(Number(data.profundidade), Number(rect.y1));
      var width = x1 - x0, depth = y1 - y0;
      if (!(width > 0 && depth > 0)) return;
      var markerGeometry = new THREE.PlaneGeometry(width, depth);
      var marker = new THREE.Mesh(markerGeometry, material);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x0 + width / 2, thickness + 0.15, -(y0 + depth / 2));
      addMesh(marker, markerGeometry);
    }
    (data.rebaixos || []).forEach(function (rect) { addMachining(rect, state.materials.usinagem); });
    (data.alivios || []).forEach(function (rect) { addMachining(rect, state.materials.alivio); });
  }

  function addMuxarabiPanel(data) {
    function addPart(width, height, depth, centerX, centerY, material, z0) {
      if (!(width > 0 && height > 0 && depth > 0)) return;
      var geometry = new THREE.BoxGeometry(width, height, depth);
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(centerX, centerY, -(Number(z0) || 0) - depth / 2);
      // Cada ripa pode ser dividida em blocos para formar os meios-encaixes.
      // EdgesGeometry nesses blocos desenharia as unioes internas como emendas.
      addMesh(mesh, geometry, false);
    }

    function complementSegments(total, slots, startKey, endKey) {
      var cursor = 0, result = [];
      (slots || []).slice().sort(function (a, b) {
        return Number(a[startKey]) - Number(b[startKey]);
      }).forEach(function (slot) {
        var start = Math.max(0, Math.min(total, Number(slot[startKey])));
        var end = Math.max(start, Math.min(total, Number(slot[endKey])));
        if (start > cursor) result.push([cursor, start]);
        cursor = Math.max(cursor, end);
      });
      if (cursor < total) result.push([cursor, total]);
      return result;
    }

    var verticalSlotDepth = Number(data.profundidade_rasgo_v);
    var horizontalSlotDepth = Number(data.profundidade_rasgo_h);
    var horizontalOffset = Number(data.deslocamento_ripas_h) || 0;
    var verticalDepth = Number(data.largura_ripa_v);
    var horizontalDepth = Number(data.largura_ripa_h);
    var verticalFrontSegments = complementSegments(
      Number(data.altura), data.rasgos_verticais, 'y0', 'y1'
    );
    var horizontalBackSegments = complementSegments(
      Number(data.largura), data.rasgos_horizontais, 'x0', 'x1'
    );
    var detailedJoints = (data.verticais || []).length * (data.horizontais || []).length <= 400;

    (data.verticais || []).forEach(function (part) {
      var partWidth = Number(part.width), partHeight = Number(part.height);
      var centerX = Number(part.x0) + partWidth / 2;
      if (!detailedJoints) {
        addPart(partWidth, partHeight, verticalDepth, centerX, partHeight / 2, state.materials.muxVertical, 0);
        return;
      }
      // Fundo continuo da ripa vertical; os dentes frontais param nos rasgos H.
      addPart(
        partWidth, partHeight, verticalDepth - verticalSlotDepth,
        centerX, partHeight / 2,
        state.materials.muxVertical, verticalSlotDepth
      );
      verticalFrontSegments.forEach(function (segment) {
        addPart(
          partWidth, segment[1] - segment[0], verticalSlotDepth,
          centerX, (segment[0] + segment[1]) / 2,
          state.materials.muxVertical, 0
        );
      });
    });
    (data.horizontais || []).forEach(function (part) {
      var partWidth = Number(part.width), partHeight = Number(part.height);
      var centerY = Number(part.y0) + partHeight / 2;
      var horizontalFrontDepth = horizontalDepth - horizontalSlotDepth;
      if (!detailedJoints) {
        addPart(partWidth, partHeight, horizontalDepth, partWidth / 2, centerY, state.materials.muxHorizontal, horizontalOffset);
        return;
      }
      // Frente continua da ripa horizontal; os dentes traseiros param nos rasgos V.
      addPart(
        partWidth, partHeight, horizontalFrontDepth,
        partWidth / 2, centerY,
        state.materials.muxHorizontal, horizontalOffset
      );
      horizontalBackSegments.forEach(function (segment) {
        addPart(
          segment[1] - segment[0], partHeight, horizontalSlotDepth,
          (segment[0] + segment[1]) / 2, centerY,
          state.materials.muxHorizontal, horizontalOffset + horizontalFrontDepth
        );
      });
    });
    if (data.moldura_ativa) {
      var width = Number(data.largura), height = Number(data.altura);
      var face = Number(data.espessura_material);
      var horizontalDepth = Number(data.largura_ripa_h);
      var verticalDepth = Number(data.largura_ripa_v);
      addPart(width, face, horizontalDepth, width / 2, face / 2, state.materials.muxMoldura, 0);
      addPart(width, face, horizontalDepth, width / 2, height - face / 2, state.materials.muxMoldura, 0);
      addPart(face, height, verticalDepth, face / 2, height / 2, state.materials.muxMoldura, 0);
      addPart(face, height, verticalDepth, width - face / 2, height / 2, state.materials.muxMoldura, 0);
    }
  }

  function addPainelMuxarabi(data) {
    var width = Number(data.largura);
    var height = Number(data.altura);
    var thickness = Number(data.espessura) || 18;
    if (!(width > 0 && height > 0 && thickness > 0)) return;

    var shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, height);
    shape.lineTo(0, height);
    shape.closePath();

    var temCirculo = false;
    (data.holes || []).forEach(function (hole) {
      if (hole.tipo === 'circulo') {
        // Muxarabi Usinado Redondo: furo redondo, horário como o retângulo.
        var r = Number(hole.r);
        if (!(r > 0)) return;
        var circulo = new THREE.Path();
        circulo.absarc(Number(hole.cx), Number(hole.cy), r, 0, Math.PI * 2, true);
        shape.holes.push(circulo);
        temCirculo = true;
        return;
      }
      var x0 = Number(hole.x0), y0 = Number(hole.y0);
      var x1 = Number(hole.x1), y1 = Number(hole.y1);
      if (!(x1 > x0 && y1 > y0)) return;
      // Sentido horário: o Three.js reconhece o retângulo como vazado passante.
      var opening = new THREE.Path();
      opening.moveTo(x0, y0);
      opening.lineTo(x0, y1);
      opening.lineTo(x1, y1);
      opening.lineTo(x1, y0);
      opening.closePath();
      shape.holes.push(opening);
    });

    var geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      // Retângulo não precisa de divisão; círculo precisa para não virar polígono.
      curveSegments: temCirculo ? 24 : 1
    });
    var mesh = new THREE.Mesh(geometry, state.materials.painelMuxarabi);
    mesh.position.z = -thickness;
    addMesh(mesh, geometry);
  }

  function addPainelRipado(data) {
    var thickness = Number(data.espessura) || 15;
    applyWoodTexture(state.materials.ripadoFundo, 2, 1);
    applyWoodTexture(state.materials.ripadoRipa, 0.18, 1);

    function addBox(rect, zCenter, material) {
      var width = Number(rect.x1) - Number(rect.x0);
      var height = Number(rect.y1) - Number(rect.y0);
      if (!(width > 0 && height > 0 && thickness > 0)) return;
      var geometry = new THREE.BoxGeometry(width, height, thickness);
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        Number(rect.x0) + width / 2,
        Number(rect.y0) + height / 2,
        zCenter
      );
      addMesh(mesh, geometry);
    }

    // Fundo atrás do plano de montagem; cada caixa corresponde a uma peça do DXF.
    (data.paineis || []).forEach(function (panel) {
      addBox(panel, -thickness / 2, state.materials.ripadoFundo);
    });
    // As ripas são inteiras mesmo quando o painel de fundo foi dividido.
    (data.ripas || []).forEach(function (slat) {
      addBox(slat, thickness / 2, state.materials.ripadoRipa);
    });

    var blindDepth = Math.min(
      Math.max(1, Number(data.profundidade_cavilha_preview) || 10),
      Math.max(1, thickness - 0.5)
    );
    (data.cavilhas || []).forEach(function (dowel) {
      var radius = Number(dowel.diametro) / 2;
      if (!(radius > 0)) return;
      var geometry = new THREE.CylinderGeometry(radius, radius, blindDepth * 2, 24, 1, false);
      var mesh = new THREE.Mesh(geometry, state.materials.cavilha);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(Number(dowel.x), Number(dowel.y), 0);
      mesh.userData.xrayOnly = true;
      mesh.visible = xray;
      addMesh(mesh, geometry);
    });
  }

  function addRevestimentoCone(data) {
    var baseA = Number(data.largura_base) / 2;
    var baseB = Number(data.profund_base) / 2;
    var topA = Number(data.largura_topo) / 2;
    var topB = Number(data.profund_topo) / 2;
    var height = Number(data.altura);
    var thickness = Number(data.espessura_mdf) || 18;
    var cutterDiameter = Math.max(0.1, Number(data.diametro_fresa_preview) || 6);
    var grooveDepth = Math.max(0, Math.min(thickness - 0.5, Number(data.profundidade_fresagem_preview) || 0));
    var vbitDepth = Math.max(0, Math.min(thickness - 0.5, Number(data.profundidade_vbit_preview) || 0));
    var vbitAngle = Math.max(1, Math.min(179, Number(data.angulo_vbit_preview) || 90));
    var vbitReach = vbitDepth * Math.tan((vbitAngle / 2) * Math.PI / 180);
    var resolution = Math.max(24, Number(data.resolucao) || 240);
    var innerBaseA = Math.max(0.5, baseA - thickness);
    var innerBaseB = Math.max(0.5, baseB - thickness);
    var innerTopA = Math.max(0.5, topA - thickness);
    var innerTopB = Math.max(0.5, topB - thickness);
    if (!(baseA > 0 && baseB > 0 && topA > 0 && topB > 0 && height > 0)) return;

    applyWoodTexture(state.materials.coneCasca, 1, 1);

    function point(a, b, theta, y) {
      return [a * Math.cos(theta), y, b * Math.sin(theta)];
    }

    function addSector(sector) {
      var start = Number(sector.theta_start);
      var end = Number(sector.theta_end);
      var span = end - start;
      var segments = Math.max(4, Math.round(resolution * Math.abs(span) / (Math.PI * 2)));
      var positions = [];
      var outerUvs = [];
      var corePositions = [];
      var groovePositions = [];
      var vbitPositions = [];
      function triangle(target, a, b, c) {
        [a, b, c].forEach(function (p) { target.push(p[0], p[1], p[2]); });
      }
      function quad(target, a, b, c, d) {
        triangle(target, a, b, c);
        triangle(target, a, c, d);
      }
      function outerQuad(a, b, c, d, u0, u1) {
        quad(positions, a, b, c, d);
        outerUvs.push(
          u0, 0, u0, 1, u1, 1,
          u0, 0, u1, 1, u1, 0
        );
      }

      var avgInnerA = (innerBaseA + innerTopA) / 2;
      var avgInnerB = (innerBaseB + innerTopB) / 2;
      var grooveRanges = (sector.groove_thetas || []).map(function (thetaValue) {
        var theta = Number(thetaValue);
        var arcSpeed = Math.hypot(avgInnerA * Math.sin(theta), avgInnerB * Math.cos(theta)) || 1;
        var halfAngle = cutterDiameter / (2 * arcSpeed);
        return {
          start: Math.max(start, theta - halfAngle),
          end: Math.min(end, theta + halfAngle)
        };
      }).filter(function (range) { return range.end > range.start; });

      var vbitRanges = (sector.vbit_thetas || []).map(function (thetaValue) {
        var theta = Number(thetaValue);
        var arcSpeed = Math.hypot(avgInnerA * Math.sin(theta), avgInnerB * Math.cos(theta)) || 1;
        var halfAngle = vbitReach / arcSpeed;
        return {
          center: theta,
          start: Math.max(start, theta - halfAngle),
          end: Math.min(end, theta + halfAngle),
          arcSpeed: arcSpeed
        };
      }).filter(function (range) { return range.end > range.start; });

      var breakpoints = [];
      for (var step = 0; step <= segments; step++) {
        breakpoints.push(start + span * step / segments);
      }
      grooveRanges.forEach(function (range) {
        breakpoints.push(range.start, range.end);
      });
      vbitRanges.forEach(function (range) {
        breakpoints.push(range.start, range.center, range.end);
      });
      breakpoints.sort(function (a, b) { return a - b; });
      breakpoints = breakpoints.filter(function (value, index, values) {
        return index === 0 || Math.abs(value - values[index - 1]) > 1e-7;
      });

      function routerDepthAt(theta) {
        return grooveRanges.some(function (range) {
          return theta > range.start + 1e-8 && theta < range.end - 1e-8;
        }) ? grooveDepth : 0;
      }

      function vbitDepthAt(theta) {
        var depth = 0;
        vbitRanges.forEach(function (range) {
          if (!(theta >= range.start - 1e-8 && theta <= range.end + 1e-8)) return;
          var distance = Math.abs(theta - range.center) * range.arcSpeed;
          depth = Math.max(depth, vbitDepth - distance / Math.max(1e-9, Math.tan((vbitAngle / 2) * Math.PI / 180)));
        });
        return Math.max(0, depth);
      }

      var previousRouterActive = null;
      for (var index = 0; index < breakpoints.length - 1; index++) {
        var t0 = breakpoints[index];
        var t1 = breakpoints[index + 1];
        var tm = (t0 + t1) / 2;
        var routerDepth = routerDepthAt(tm);
        var vbitMidDepth = vbitDepthAt(tm);
        var currentDepth = Math.max(routerDepth, vbitMidDepth);
        // No V-bit há uma rampa: a profundidade vai de zero até o centro e
        // volta a zero. Nos canais da fresa principal a profundidade fica
        // constante e as paredes verticais continuam sendo preservadas.
        var depth0 = routerDepth > 0 ? routerDepth : vbitDepthAt(t0);
        var depth1 = routerDepth > 0 ? routerDepth : vbitDepthAt(t1);
        var ob0 = point(baseA, baseB, t0, 0);
        var ob1 = point(baseA, baseB, t1, 0);
        var ot0 = point(topA, topB, t0, height);
        var ot1 = point(topA, topB, t1, height);
        var ib0 = point(innerBaseA + depth0, innerBaseB + depth0, t0, 0);
        var ib1 = point(innerBaseA + depth1, innerBaseB + depth1, t1, 0);
        var it0 = point(innerTopA + depth0, innerTopB + depth0, t0, height);
        var it1 = point(innerTopA + depth1, innerTopB + depth1, t1, height);
        var textureOrigin = Number((data.sectors || [sector])[0].theta_start);
        var u0 = (t0 - textureOrigin) / (Math.PI * 2);
        var u1 = (t1 - textureOrigin) / (Math.PI * 2);
        outerQuad(ob0, ot0, ot1, ob1, u0, u1);
        var innerTarget = routerDepth > 0
          ? groovePositions
          : (vbitMidDepth > 0 ? vbitPositions : corePositions);
        quad(innerTarget, ib0, ib1, it1, it0);
        // As bordas cortadas revelam o mesmo miolo claro da face interna.
        quad(corePositions, ob0, ob1, ib1, ib0);
        quad(corePositions, ot0, it0, it1, ot1);

        var routerActive = routerDepth > 0;
        if (previousRouterActive !== null && previousRouterActive !== routerActive) {
          var shallowDepth = routerActive ? 0 : grooveDepth;
          var deepDepth = routerActive ? grooveDepth : 0;
          var shallowBase = point(innerBaseA + shallowDepth, innerBaseB + shallowDepth, t0, 0);
          var shallowTop = point(innerTopA + shallowDepth, innerTopB + shallowDepth, t0, height);
          var deepBase = point(innerBaseA + deepDepth, innerBaseB + deepDepth, t0, 0);
          var deepTop = point(innerTopA + deepDepth, innerTopB + deepDepth, t0, height);
          quad(groovePositions, shallowBase, deepBase, deepTop, shallowTop);
        }
        previousRouterActive = routerActive;
      }

      // As faixas se encontram exatamente nas emendas. Nao fechamos essas
      // faces com tampas coplanares duplicadas para evitar listras no raio X.

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(outerUvs, 2));
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, state.materials.coneCasca), geometry);

      if (corePositions.length) {
        var coreGeometry = new THREE.BufferGeometry();
        coreGeometry.setAttribute('position', new THREE.Float32BufferAttribute(corePositions, 3));
        coreGeometry.computeVertexNormals();
        addMesh(new THREE.Mesh(coreGeometry, state.materials.coneMiolo), coreGeometry, false);
      }

      if (groovePositions.length) {
        var grooveGeometry = new THREE.BufferGeometry();
        grooveGeometry.setAttribute('position', new THREE.Float32BufferAttribute(groovePositions, 3));
        grooveGeometry.computeVertexNormals();
        // Fundo e paredes reais do canal: 6 mm de largura e profundidade ate
        // restar a pele externa definida pelo payload.
        addMesh(new THREE.Mesh(grooveGeometry, state.materials.fresagemCone), grooveGeometry, false);
      }
      if (vbitPositions.length) {
        var vbitGeometry = new THREE.BufferGeometry();
        vbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vbitPositions, 3));
        vbitGeometry.computeVertexNormals();
        addMesh(new THREE.Mesh(vbitGeometry, state.materials.vbitEstruturado), vbitGeometry, false);
      }
    }

    (data.sectors || []).forEach(addSector);

    // Cada inicio de setor corresponde a uma emenda real entre pecas do DXF.
    // Marcamos os dois lados da parede para ela aparecer tanto por fora quanto
    // ao olhar pela abertura do cone.
    var seamPositions = [];
    (data.sectors || []).forEach(function (sector) {
      var theta = Number(sector.theta_start);
      var outerBase = point(baseA + 0.35, baseB + 0.35, theta, 0);
      var outerTop = point(topA + 0.35, topB + 0.35, theta, height);
      var innerBase = point(
        Math.max(0.1, innerBaseA - 0.35), Math.max(0.1, innerBaseB - 0.35), theta, 0
      );
      var innerTop = point(
        Math.max(0.1, innerTopA - 0.35), Math.max(0.1, innerTopB - 0.35), theta, height
      );
      seamPositions.push(
        outerBase[0], outerBase[1], outerBase[2],
        outerTop[0], outerTop[1], outerTop[2],
        innerBase[0], innerBase[1], innerBase[2],
        innerTop[0], innerTop[1], innerTop[2]
      );
    });
    if (seamPositions.length) {
      var seamGeometry = new THREE.BufferGeometry();
      seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seamPositions, 3));
      state.model.add(new THREE.LineSegments(seamGeometry, state.materials.emendaCone));
    }

    function addRing(ring) {
      var outerA = Number(ring.outer_a), outerB = Number(ring.outer_b);
      var innerA = Number(ring.inner_a), innerB = Number(ring.inner_b);
      if (!(outerA > innerA && outerB > innerB && innerA > 0 && innerB > 0)) return;
      var shape = new THREE.Shape();
      shape.absellipse(0, 0, outerA, outerB, 0, Math.PI * 2, false, 0);
      var opening = new THREE.Path();
      if (ring.inner_pts && ring.inner_pts.length >= 3) {
        var pts = ring.inner_pts.map(function (p) { return new THREE.Vector2(Number(p[0]), Number(p[1])); });
        if (THREE.ShapeUtils.area(pts) > 0) pts.reverse();
        opening.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) {
          opening.lineTo(pts[i].x, pts[i].y);
        }
        opening.closePath();
      } else {
        opening.absellipse(0, 0, innerA, innerB, 0, Math.PI * 2, true, 0);
      }
      shape.holes.push(opening);
      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 64
      });
      geometry.rotateX(-Math.PI / 2);
      var mesh = new THREE.Mesh(geometry, state.materials.coneAnel);
      var label = String(ring.label || '');
      mesh.position.y = typeof ring.z === 'number' ? ring.z : (label.indexOf('TOPO') >= 0
        ? height - thickness
        : (label.indexOf('MEIO') >= 0 ? height / 2 - thickness / 2 : 0));
      mesh.userData.parte = parteDoAnel(ring);
      addMesh(mesh, geometry);
    }
    (data.rings || []).forEach(addRing);

    // Ripas de ligacao do esqueleto interno
    (data.ripas || []).forEach(function (ripa) {
      var espessuraRipa = Number(ripa.espessura) || thickness;
      var rInt = Number(ripa.raio_int);
      var angle = Number(ripa.angle) || 0;
      var outline = ripa.outline || [];
      if (outline.length < 3) return;

      var shape = new THREE.Shape();
      shape.moveTo(rInt + Number(outline[0][0]), Number(outline[0][1]));
      for (var i = 1; i < outline.length; i++) {
        shape.lineTo(rInt + Number(outline[i][0]), Number(outline[i][1]));
      }
      shape.closePath();

      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: espessuraRipa,
        bevelEnabled: false
      });
      // "deslocamento": plano da ripa que passa ao lado do centro (ripas do
      // meio do caminho no cone elíptico). Sem ele, a ripa passa pelo centro.
      geometry.translate(0, 0, -espessuraRipa / 2 + (Number(ripa.deslocamento) || 0));

      var mesh = new THREE.Mesh(geometry, state.materials.ripaEstruturada);
      mesh.rotation.y = -angle;
      mesh.userData.parte = 'ripaLigacao';
      addMesh(mesh, geometry);
    });

    function addToothedRing(ring) {
      var rootRadius = Number(ring.root_outer_radius);
      var tipRadius = Number(ring.tip_outer_radius);
      var innerRadius = Number(ring.inner_radius);
      var teeth = Math.max(8, Math.round(Number(ring.teeth) || 0));
      var toothWidth = Math.max(0.5, Number(ring.tooth_width) || cutterDiameter);
      var ringZ = Number(ring.z);
      var toothPhase = Number(data.fase_dente) || 0;
      if (!(tipRadius > rootRadius && rootRadius > innerRadius && innerRadius > 0 && ringZ >= 0)) return;

      var pitchAngle = Math.PI * 2 / teeth;
      var toothHalfAngle = Math.min(
        pitchAngle * 0.45,
        Math.max(1e-6, toothWidth / (2 * tipRadius))
      );
      var shape = new THREE.Shape();
      function point(radius, angle) {
        return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
      }
      for (var index = 0; index < teeth; index++) {
        var center = (index + toothPhase) * pitchAngle;
        var start = center - pitchAngle / 2;
        var toothStart = center - toothHalfAngle;
        var toothEnd = center + toothHalfAngle;
        var end = center + pitchAngle / 2;
        var points = [
          point(rootRadius, start),
          point(rootRadius, toothStart),
          point(tipRadius, toothStart),
          point(tipRadius, toothEnd),
          point(rootRadius, toothEnd),
          point(rootRadius, end)
        ];
        if (index === 0) shape.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(function (p) { shape.lineTo(p.x, p.y); });
      }
      shape.closePath();
      var opening = new THREE.Path();
      opening.absellipse(0, 0, innerRadius, innerRadius, 0, Math.PI * 2, true, 0);
      shape.holes.push(opening);
      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 64
      });
      geometry.rotateX(-Math.PI / 2);
      var mesh = new THREE.Mesh(geometry, state.materials.anelDentado);
      mesh.position.y = ringZ - thickness / 2;
      // Os anéis dentados ficam por dentro da casca, com os dentes nos canais.
      mesh.userData.parte = 'anelInterno';
      addMesh(mesh, geometry);
    }
    (data.toothed_rings || []).forEach(addToothedRing);
  }

  function addPeRedondoEstruturado(data) {
    addRevestimentoCone(data);
    (data.ripas_estruturais || []).forEach(function (ripa) {
      var width = Number(ripa.width);
      var height = Number(ripa.height);
      var thickness = Number(ripa.thickness) || Number(data.espessura_mdf) || 18;
      var radius = Number(ripa.radius);
      var angle = Number(ripa.angle);
      if (!(width > 0 && height > 0 && radius > 0)) return;
      var geometry = new THREE.BoxGeometry(width, height, thickness);
      var mesh = new THREE.Mesh(geometry, state.materials.ripaEstruturada);
      mesh.position.set(radius * Math.cos(angle), (Number(ripa.z0) + Number(ripa.z1)) / 2, radius * Math.sin(angle));
      // A largura fica tangente ao cilindro; a espessura ocupa o sentido radial.
      mesh.rotation.y = Math.PI / 2 - angle;
      mesh.userData.parte = 'ripaLigacao';
      addMesh(mesh, geometry);
    });
  }

  function addPeRipadoArredondado(data) {
    var height = Number(data.altura);
    var thickness = Number(data.espessura_mdf) || 18;
    var a = Number(data.a);
    var b = Number(data.b);
    if (!(height > 0 && thickness > 0 && a > 0 && b > 0)) return;

    applyWoodTexture(state.materials.ripadoRipa, 0.18, 1);

    function toShape(points) {
      var converted = (points || []).map(function (point) {
        // O payload usa x/y como planta; depois da rotação do extrude o y
        // da planta vira z. A inversão mantém a mesma tangente das ripas.
        return new THREE.Vector2(Number(point[0]), -Number(point[1]));
      });
      return converted;
    }

    function addRing(ring) {
      var outer = toShape(ring.outer_points);
      var inner = toShape(ring.inner_points);
      if (outer.length < 3 || inner.length < 3) return;
      var shape = new THREE.Shape(outer);
      if (THREE.ShapeUtils.area(outer) * THREE.ShapeUtils.area(inner) > 0) inner.reverse();
      var hole = new THREE.Path(inner);
      shape.holes.push(hole);
      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: Number(ring.height) || thickness,
        bevelEnabled: false,
        curveSegments: 1
      });
      geometry.rotateX(-Math.PI / 2);
      var mesh = new THREE.Mesh(geometry, state.materials.coneAnel);
      mesh.position.y = Number(ring.z) || 0;
      addMesh(mesh, geometry);
    }

    function addCap(cap) {
      var outline = toShape(cap.outer_points);
      if (outline.length < 3) return;
      var shape = new THREE.Shape(outline);
      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: Number(cap.height) || thickness,
        bevelEnabled: false,
        curveSegments: 1
      });
      geometry.rotateX(-Math.PI / 2);
      var mesh = new THREE.Mesh(geometry, state.materials.ripadoFundo);
      mesh.position.y = Number(cap.z) || 0;
      addMesh(mesh, geometry);
    }

    (data.rings || data.aneis || []).forEach(addRing);
    (data.caps || data.tampas || []).forEach(addCap);

    (data.ripas || []).forEach(function (ripa) {
      var width = Number(ripa.width);
      var tabWidth = Number(ripa.tab_width);
      var tabHeight = Number(ripa.tab_height);
      var ripaHeight = Number(ripa.height);
      var ripaThickness = Number(ripa.thickness) || thickness;
      var x = Number(ripa.x);
      var z = Number(ripa.y);
      var angle = Number(ripa.rotation_y);
      if (!(width > 0 && tabWidth > 0 && tabHeight > 0 && ripaHeight > tabHeight * 2 && ripaThickness > 0)) return;

      function addSlatBox(boxWidth, boxHeight, centerY) {
        var geometry = new THREE.BoxGeometry(boxWidth, boxHeight, ripaThickness);
        var mesh = new THREE.Mesh(geometry, state.materials.ripadoRipa);
        mesh.position.set(x, centerY, z);
        mesh.rotation.y = angle;
        addMesh(mesh, geometry);
      }
      addSlatBox(tabWidth, tabHeight, tabHeight / 2);
      addSlatBox(width, ripaHeight - tabHeight * 2, tabHeight + (ripaHeight - tabHeight * 2) / 2);
      addSlatBox(tabWidth, tabHeight, ripaHeight - tabHeight / 2);
    });
  }

  function addPeOblongo(data) {
    var length = Number(data.comprimento);
    var depth = Number(data.profundidade);
    var height = Number(data.altura);
    var thickness = Number(data.espessura_mdf) || 18;
    var perimeter = Number(data.perimetro);
    var straight = Number(data.trecho_reto);
    var arcHalf = Number(data.arc_half);
    var radius = depth / 2;
    var halfStraight = straight / 2;
    var cutterDiameter = Math.max(0.1, Number(data.diametro_fresa_preview) || 6);
    var grooveDepth = Math.max(0, Math.min(thickness - 0.5, Number(data.profundidade_fresagem_preview) || 0));
    var resolution = Math.max(48, Number(data.resolucao) || 240);
    if (!(length > depth && depth > 0 && height > 0 && perimeter > 0 && straight > 0 && arcHalf > 0)) return;

    applyWoodTexture(state.materials.coneCasca, 1, 1);

    function normalizedS(value) {
      return ((value % perimeter) + perimeter) % perimeter;
    }

    // O parametro s segue exatamente o contorno aberto usado pelo DXF:
    // reta superior, semicirculo direito, reta inferior e semicirculo esquerdo.
    function pointAt(value, inset, y) {
      var s = normalizedS(value);
      var localRadius = Math.max(0.5, radius - inset);
      if (s <= straight) {
        return [-halfStraight + s, y, -localRadius];
      }
      s -= straight;
      if (s <= arcHalf) {
        var rightAngle = -Math.PI / 2 + Math.PI * s / arcHalf;
        return [halfStraight + localRadius * Math.cos(rightAngle), y, localRadius * Math.sin(rightAngle)];
      }
      s -= arcHalf;
      if (s <= straight) {
        return [halfStraight - s, y, localRadius];
      }
      s -= straight;
      var leftAngle = Math.PI / 2 + Math.PI * s / arcHalf;
      return [-halfStraight + localRadius * Math.cos(leftAngle), y, localRadius * Math.sin(leftAngle)];
    }

    function triangle(target, a, b, c) {
      [a, b, c].forEach(function (p) { target.push(p[0], p[1], p[2]); });
    }
    function quad(target, a, b, c, d) {
      triangle(target, a, b, c);
      triangle(target, a, c, d);
    }

    function addSector(sector) {
      var start = Number(sector.s_start);
      var end = Number(sector.s_end);
      var span = end - start;
      var positions = [];
      var outerUvs = [];
      var corePositions = [];
      var groovePositions = [];
      var grooveRanges = (sector.groove_s || []).map(function (value) {
        var center = Number(value);
        return {
          start: Math.max(start, center - cutterDiameter / 2),
          end: Math.min(end, center + cutterDiameter / 2)
        };
      }).filter(function (range) { return range.end > range.start; });

      var segments = Math.max(12, Math.round(resolution * span / perimeter));
      var breakpoints = [];
      for (var step = 0; step <= segments; step++) {
        breakpoints.push(start + span * step / segments);
      }
      // Inclui as quatro transicoes exatas entre retas e curvas para que as
      // laterais permaneçam planas, sem arredondamento por triangulacao.
      var firstCycle = Math.floor(start / perimeter) - 1;
      var lastCycle = Math.ceil(end / perimeter) + 1;
      for (var cycle = firstCycle; cycle <= lastCycle; cycle++) {
        var origin = cycle * perimeter;
        [0, straight, straight + arcHalf, 2 * straight + arcHalf, perimeter].forEach(function (offset) {
          var boundary = origin + offset;
          if (boundary > start && boundary < end) breakpoints.push(boundary);
        });
      }
      grooveRanges.forEach(function (range) { breakpoints.push(range.start, range.end); });
      breakpoints.sort(function (a, b) { return a - b; });
      breakpoints = breakpoints.filter(function (value, index, values) {
        return index === 0 || Math.abs(value - values[index - 1]) > 1e-7;
      });

      function depthAt(value) {
        return grooveRanges.some(function (range) {
          return value > range.start + 1e-8 && value < range.end - 1e-8;
        }) ? grooveDepth : 0;
      }

      var previousDepth = null;
      for (var index = 0; index < breakpoints.length - 1; index++) {
        var s0 = breakpoints[index];
        var s1 = breakpoints[index + 1];
        var currentDepth = depthAt((s0 + s1) / 2);
        var ob0 = pointAt(s0, 0, 0);
        var ob1 = pointAt(s1, 0, 0);
        var ot0 = pointAt(s0, 0, height);
        var ot1 = pointAt(s1, 0, height);
        var innerInset = Math.max(0.5, thickness - currentDepth);
        var ib0 = pointAt(s0, innerInset, 0);
        var ib1 = pointAt(s1, innerInset, 0);
        var it0 = pointAt(s0, innerInset, height);
        var it1 = pointAt(s1, innerInset, height);
        quad(positions, ob0, ot0, ot1, ob1);
        var u0 = (s0 - Number((data.sectors || [sector])[0].s_start)) / perimeter;
        var u1 = (s1 - Number((data.sectors || [sector])[0].s_start)) / perimeter;
        outerUvs.push(u0, 0, u0, 1, u1, 1, u0, 0, u1, 1, u1, 0);
        quad(currentDepth > 0 ? groovePositions : corePositions, ib0, ib1, it1, it0);
        quad(corePositions, ob0, ob1, ib1, ib0);
        quad(corePositions, ot0, it0, it1, ot1);

        if (previousDepth !== null && Math.abs(previousDepth - currentDepth) > 1e-7) {
          var previousInset = Math.max(0.5, thickness - previousDepth);
          var previousBase = pointAt(s0, previousInset, 0);
          var previousTop = pointAt(s0, previousInset, height);
          var currentBase = pointAt(s0, innerInset, 0);
          var currentTop = pointAt(s0, innerInset, height);
          quad(groovePositions, previousBase, currentBase, currentTop, previousTop);
        }
        previousDepth = currentDepth;
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(outerUvs, 2));
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, state.materials.coneCasca), geometry);

      if (corePositions.length) {
        var coreGeometry = new THREE.BufferGeometry();
        coreGeometry.setAttribute('position', new THREE.Float32BufferAttribute(corePositions, 3));
        coreGeometry.computeVertexNormals();
        addMesh(new THREE.Mesh(coreGeometry, state.materials.coneMiolo), coreGeometry, false);
      }
      if (groovePositions.length) {
        var grooveGeometry = new THREE.BufferGeometry();
        grooveGeometry.setAttribute('position', new THREE.Float32BufferAttribute(groovePositions, 3));
        grooveGeometry.computeVertexNormals();
        addMesh(new THREE.Mesh(grooveGeometry, state.materials.fresagemCone), grooveGeometry, false);
      }
    }

    (data.sectors || []).forEach(addSector);

    var seamPositions = [];
    (data.sectors || []).forEach(function (sector) {
      var s = Number(sector.s_start);
      var outerBase = pointAt(s, -0.35, 0);
      var outerTop = pointAt(s, -0.35, height);
      var innerBase = pointAt(s, thickness + 0.35, 0);
      var innerTop = pointAt(s, thickness + 0.35, height);
      seamPositions.push(
        outerBase[0], outerBase[1], outerBase[2], outerTop[0], outerTop[1], outerTop[2],
        innerBase[0], innerBase[1], innerBase[2], innerTop[0], innerTop[1], innerTop[2]
      );
    });
    if (seamPositions.length) {
      var seamGeometry = new THREE.BufferGeometry();
      seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seamPositions, 3));
      state.model.add(new THREE.LineSegments(seamGeometry, state.materials.emendaCone));
    }

    function stadiumPoints(totalLength, totalDepth) {
      var r = totalDepth / 2;
      var center = (totalLength - totalDepth) / 2;
      var points = [new THREE.Vector2(-center, -r), new THREE.Vector2(center, -r)];
      for (var i = 1; i <= 32; i++) {
        var rightAngle = -Math.PI / 2 + Math.PI * i / 32;
        points.push(new THREE.Vector2(center + r * Math.cos(rightAngle), r * Math.sin(rightAngle)));
      }
      points.push(new THREE.Vector2(-center, r));
      for (var j = 1; j <= 32; j++) {
        var leftAngle = Math.PI / 2 + Math.PI * j / 32;
        points.push(new THREE.Vector2(-center + r * Math.cos(leftAngle), r * Math.sin(leftAngle)));
      }
      return points;
    }

    function addRing(ring) {
      var outerC = Number(ring.outer_C), outerL = Number(ring.outer_L);
      var innerC = Number(ring.inner_C), innerL = Number(ring.inner_L);
      if (!(outerC > innerC && outerL > innerL && innerC > innerL && innerL > 0)) return;
      var shape = new THREE.Shape(stadiumPoints(outerC, outerL));
      shape.closePath();
      var hole;
      if (ring.inner_pts && ring.inner_pts.length >= 3) {
        // Anel com os rasgos das ripas de ligacao: o furo segue o contorno do DXF.
        var innerPts = ring.inner_pts.map(function (p) { return new THREE.Vector2(Number(p[0]), Number(p[1])); });
        if (THREE.ShapeUtils.area(innerPts) > 0) innerPts.reverse();
        hole = new THREE.Path(innerPts);
      } else {
        hole = new THREE.Path(stadiumPoints(innerC, innerL).reverse());
      }
      hole.closePath();
      shape.holes.push(hole);
      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 32
      });
      geometry.rotateX(-Math.PI / 2);
      var mesh = new THREE.Mesh(geometry, state.materials.coneAnel);
      mesh.position.y = typeof ring.z === 'number'
        ? ring.z
        : (String(ring.label || '').indexOf('TOPO') >= 0 ? height - thickness : 0);
      mesh.userData.parte = parteDoAnel(ring);
      addMesh(mesh, geometry);
    }
    (data.rings || []).forEach(addRing);

    // Ripas de ligacao: ficam por dentro dos aneis internos, uma em cada ponta
    // e as outras nos lados retos. O contorno vem da chapa como (u, altura), com
    // u correndo da borda de dentro (x, y) na direcao da parede (nx, ny). A
    // planta (x, y) vira (x, -z) no mundo, a mesma troca do anel acima, para a
    // ripa cair dentro do rasgo.
    (data.ripas || []).forEach(function (ripa) {
      var outline = ripa.outline || [];
      if (outline.length < 3) return;
      var espessuraRipa = Number(ripa.espessura) || thickness;
      var ripaShape = new THREE.Shape();
      ripaShape.moveTo(Number(outline[0][0]), Number(outline[0][1]));
      for (var i = 1; i < outline.length; i++) {
        ripaShape.lineTo(Number(outline[i][0]), Number(outline[i][1]));
      }
      ripaShape.closePath();
      var ripaGeometry = new THREE.ExtrudeGeometry(ripaShape, {
        depth: espessuraRipa,
        bevelEnabled: false
      });
      ripaGeometry.translate(0, 0, -espessuraRipa / 2);
      var ripaMesh = new THREE.Mesh(ripaGeometry, state.materials.ripaEstruturada);
      ripaMesh.rotation.y = Math.atan2(Number(ripa.ny) || 0, Number(ripa.nx) || 0);
      ripaMesh.position.set(Number(ripa.x) || 0, 0, -(Number(ripa.y) || 0));
      ripaMesh.userData.parte = 'ripaLigacao';
      addMesh(ripaMesh, ripaGeometry);
    });
  }

  function addPeConicoQuadrado(data) {
    var height = Number(data.altura);
    var thickness = Number(data.espessura_mdf) || 18;
    var perimeter = Number(data.perimetro);
    var segLens = data.seg_lens || [];
    var nucleoX = Number(data.nucleo_x);
    var nucleoY = Number(data.nucleo_y);
    var nucleoTopoX = Number(data.nucleo_topo_x);
    var nucleoTopoY = Number(data.nucleo_topo_y);
    var rBase = Number(data.raio_base);
    var rTopoX = Number(data.raio_topo_x);
    var rTopoY = Number(data.raio_topo_y);
    var cutterDiameter = Math.max(0.1, Number(data.diametro_fresa_preview) || 6);
    var grooveDepth = Math.max(0, Math.min(thickness - 0.5, Number(data.profundidade_fresagem_preview) || 0));
    var resolution = Math.max(48, Number(data.resolucao) || 240);
    if (!(height > 0 && perimeter > 0 && segLens.length === 8 && rBase > 0)) return;

    applyWoodTexture(state.materials.coneCasca, 1, 1);

    var segCum = [0];
    for (var i = 0; i < 8; i++) segCum.push(segCum[i] + Number(segLens[i]));

    function normalizedS(value) {
      return ((value % perimeter) + perimeter) % perimeter;
    }

    // A regua do parametro s e o perimetro da BASE, igual ao gerador: trecho k
    // da base corresponde ao trecho k do topo. Indice impar = arco de canto.
    function segAt(value) {
      var s = normalizedS(value);
      for (var k = 0; k < 8; k++) {
        if (s < segCum[k + 1] - 1e-9) {
          var len = Number(segLens[k]);
          return [k, len > 1e-12 ? (s - segCum[k]) / len : 0];
        }
      }
      return [7, 1];
    }

    // Ordem CCW do gerador: reta direita, arco TR, reta topo, arco TL, reta
    // esquerda, arco BL, reta baixo, arco BR.
    function sectionPoint(seg, t, rx, ry, nx, ny) {
      var ax = nx + rx, by = ny + ry;
      var ang;
      if (seg === 0) return [ax, -ny + t * 2 * ny];
      if (seg === 1) {
        ang = t * Math.PI / 2;
        return [nx + rx * Math.cos(ang), ny + ry * Math.sin(ang)];
      }
      if (seg === 2) return [nx - t * 2 * nx, by];
      if (seg === 3) {
        ang = Math.PI / 2 + t * Math.PI / 2;
        return [-nx + rx * Math.cos(ang), ny + ry * Math.sin(ang)];
      }
      if (seg === 4) return [-ax, ny - t * 2 * ny];
      if (seg === 5) {
        ang = Math.PI + t * Math.PI / 2;
        return [-nx + rx * Math.cos(ang), -ny + ry * Math.sin(ang)];
      }
      if (seg === 6) return [-nx + t * 2 * nx, -by];
      ang = 3 * Math.PI / 2 + t * Math.PI / 2;
      return [nx + rx * Math.cos(ang), -ny + ry * Math.sin(ang)];
    }

    // Cone puro: raio E nucleo encolhem da base ao topo, entao os dois sao
    // interpolados pela altura. O inset (parede, canal) recua so o raio, porque
    // a meia-largura e sempre nucleo + raio.
    function pointAt(value, inset, y) {
      var frac = y / height;
      var rx = Math.max(0.5, rBase + (rTopoX - rBase) * frac - inset);
      var ry = Math.max(0.5, rBase + (rTopoY - rBase) * frac - inset);
      var nx = nucleoX + (nucleoTopoX - nucleoX) * frac;
      var ny = nucleoY + (nucleoTopoY - nucleoY) * frac;
      var sg = segAt(value);
      var p = sectionPoint(sg[0], sg[1], rx, ry, nx, ny);
      return [p[0], y, p[1]];
    }

    function triangle(target, a, b, c) {
      [a, b, c].forEach(function (p) { target.push(p[0], p[1], p[2]); });
    }
    function quad(target, a, b, c, d) {
      triangle(target, a, b, c);
      triangle(target, a, c, d);
    }

    function addSector(sector) {
      var start = Number(sector.s_start);
      var end = Number(sector.s_end);
      var span = end - start;
      var positions = [];
      var outerUvs = [];
      var corePositions = [];
      var groovePositions = [];
      var grooveRanges = (sector.groove_s || []).map(function (value) {
        var center = Number(value);
        return {
          start: Math.max(start, center - cutterDiameter / 2),
          end: Math.min(end, center + cutterDiameter / 2)
        };
      }).filter(function (range) { return range.end > range.start; });

      var segments = Math.max(12, Math.round(resolution * span / perimeter));
      var breakpoints = [];
      for (var step = 0; step <= segments; step++) {
        breakpoints.push(start + span * step / segments);
      }
      // As oito transicoes reta/arco entram exatas para as faces ficarem planas,
      // sem arredondamento vindo da triangulacao.
      var firstCycle = Math.floor(start / perimeter) - 1;
      var lastCycle = Math.ceil(end / perimeter) + 1;
      for (var cycle = firstCycle; cycle <= lastCycle; cycle++) {
        var origin = cycle * perimeter;
        segCum.forEach(function (offset) {
          var boundary = origin + offset;
          if (boundary > start && boundary < end) breakpoints.push(boundary);
        });
      }
      grooveRanges.forEach(function (range) { breakpoints.push(range.start, range.end); });
      breakpoints.sort(function (a, b) { return a - b; });
      breakpoints = breakpoints.filter(function (value, index, values) {
        return index === 0 || Math.abs(value - values[index - 1]) > 1e-7;
      });

      function depthAt(value) {
        return grooveRanges.some(function (range) {
          return value > range.start + 1e-8 && value < range.end - 1e-8;
        }) ? grooveDepth : 0;
      }

      var previousDepth = null;
      for (var index = 0; index < breakpoints.length - 1; index++) {
        var s0 = breakpoints[index];
        var s1 = breakpoints[index + 1];
        var currentDepth = depthAt((s0 + s1) / 2);
        var ob0 = pointAt(s0, 0, 0);
        var ob1 = pointAt(s1, 0, 0);
        var ot0 = pointAt(s0, 0, height);
        var ot1 = pointAt(s1, 0, height);
        var innerInset = Math.max(0.5, thickness - currentDepth);
        var ib0 = pointAt(s0, innerInset, 0);
        var ib1 = pointAt(s1, innerInset, 0);
        var it0 = pointAt(s0, innerInset, height);
        var it1 = pointAt(s1, innerInset, height);
        quad(positions, ob0, ot0, ot1, ob1);
        var u0 = (s0 - start) / perimeter;
        var u1 = (s1 - start) / perimeter;
        outerUvs.push(u0, 0, u0, 1, u1, 1, u0, 0, u1, 1, u1, 0);
        quad(currentDepth > 0 ? groovePositions : corePositions, ib0, ib1, it1, it0);
        quad(corePositions, ob0, ob1, ib1, ib0);
        quad(corePositions, ot0, it0, it1, ot1);

        if (previousDepth !== null && Math.abs(previousDepth - currentDepth) > 1e-7) {
          var previousInset = Math.max(0.5, thickness - previousDepth);
          var previousBase = pointAt(s0, previousInset, 0);
          var previousTop = pointAt(s0, previousInset, height);
          var currentBase = pointAt(s0, innerInset, 0);
          var currentTop = pointAt(s0, innerInset, height);
          quad(groovePositions, previousBase, currentBase, currentTop, previousTop);
        }
        previousDepth = currentDepth;
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(outerUvs, 2));
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, state.materials.coneCasca), geometry);

      if (corePositions.length) {
        var coreGeometry = new THREE.BufferGeometry();
        coreGeometry.setAttribute('position', new THREE.Float32BufferAttribute(corePositions, 3));
        coreGeometry.computeVertexNormals();
        addMesh(new THREE.Mesh(coreGeometry, state.materials.coneMiolo), coreGeometry, false);
      }
      if (groovePositions.length) {
        var grooveGeometry = new THREE.BufferGeometry();
        grooveGeometry.setAttribute('position', new THREE.Float32BufferAttribute(groovePositions, 3));
        grooveGeometry.computeVertexNormals();
        addMesh(new THREE.Mesh(grooveGeometry, state.materials.fresagemCone), grooveGeometry, false);
      }
    }

    (data.sectors || []).forEach(addSector);

    var seamPositions = [];
    (data.sectors || []).forEach(function (sector) {
      var s = Number(sector.s_start);
      var outerBase = pointAt(s, -0.35, 0);
      var outerTop = pointAt(s, -0.35, height);
      var innerBase = pointAt(s, thickness + 0.35, 0);
      var innerTop = pointAt(s, thickness + 0.35, height);
      seamPositions.push(
        outerBase[0], outerBase[1], outerBase[2], outerTop[0], outerTop[1], outerTop[2],
        innerBase[0], innerBase[1], innerBase[2], innerTop[0], innerTop[1], innerTop[2]
      );
    });
    if (seamPositions.length) {
      var seamGeometry = new THREE.BufferGeometry();
      seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seamPositions, 3));
      state.model.add(new THREE.LineSegments(seamGeometry, state.materials.emendaCone));
    }

    // Mesmo percurso CCW da secao: quatro retas e quatro arcos de 90 graus.
    function roundedRectPoints(larg, prof, rx, ry) {
      var ax = larg / 2, by = prof / 2;
      var nx = Math.max(0, ax - rx), ny = Math.max(0, by - ry);
      var points = [new THREE.Vector2(ax, -ny), new THREE.Vector2(ax, ny)];

      function arc(cx, cy, from) {
        for (var i = 1; i <= 12; i++) {
          var ang = from + (i / 12) * Math.PI / 2;
          points.push(new THREE.Vector2(cx + rx * Math.cos(ang), cy + ry * Math.sin(ang)));
        }
      }

      arc(nx, ny, 0);                       // canto superior direito
      points.push(new THREE.Vector2(-nx, by));
      arc(-nx, ny, Math.PI / 2);            // canto superior esquerdo
      points.push(new THREE.Vector2(-ax, -ny));
      arc(-nx, -ny, Math.PI);               // canto inferior esquerdo
      points.push(new THREE.Vector2(nx, -by));
      arc(nx, -ny, 3 * Math.PI / 2);        // canto inferior direito
      return points;
    }

    function addRing(ring) {
      var outerLarg = Number(ring.outer_larg), outerProf = Number(ring.outer_prof);
      var innerLarg = Number(ring.inner_larg), innerProf = Number(ring.inner_prof);
      if (!(outerLarg > innerLarg && outerProf > innerProf && innerLarg > 0 && innerProf > 0)) return;
      var shape = new THREE.Shape(roundedRectPoints(outerLarg, outerProf, Number(ring.outer_rx), Number(ring.outer_ry)));
      shape.closePath();
      var hole = new THREE.Path(roundedRectPoints(innerLarg, innerProf, Number(ring.inner_rx), Number(ring.inner_ry)).reverse());
      hole.closePath();
      shape.holes.push(hole);
      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 24
      });
      geometry.rotateX(-Math.PI / 2);
      var mesh = new THREE.Mesh(geometry, state.materials.coneAnel);
      // O payload traz a altura pronta; antes isso era deduzido lendo o rótulo.
      mesh.position.y = typeof ring.z === 'number' ? ring.z : 0;
      mesh.userData.parte = parteDoAnel(ring);
      addMesh(mesh, geometry);
    }
    (data.rings || []).forEach(addRing);

    // Ripas: o esqueleto que liga um anel ao outro. O perfil da peça é o mesmo
    // que vai para a chapa (u = distância radial, v = altura), extrudado na
    // espessura e girado para ficar perpendicular à face.
    (data.ripas || []).forEach(function (ripa) {
      var espessuraRipa = Number(ripa.espessura) || thickness;
      var largura = Number(ripa.largura);
      var z0 = Number(ripa.z0), z1 = Number(ripa.z1);
      var extBase = Number(ripa.x_ext_base), extTopo = Number(ripa.x_ext_topo);
      if (!(z1 > z0 && largura > 0)) return;

      // A borda externa segue a reta dos anéis; a interna é paralela a ela.
      function externaEm(z) {
        return extBase + (extTopo - extBase) * (z - z0) / (z1 - z0);
      }

      // Coordenadas da peça são (raio, altura), sem distorção: o plano da ripa
      // contém o eixo do pé.
      var shape = new THREE.Shape();
      shape.moveTo(externaEm(z0) - largura, z0);
      var entalhes = (ripa.entalhes || []).slice().sort(function (a, b) {
        return Number(a.z0) - Number(b.z0);
      });
      entalhes.forEach(function (entalhe) {
        var ez0 = Number(entalhe.z0), ez1 = Number(entalhe.z1);
        var fundo = Number(entalhe.raio_fundo);
        if (!(fundo > externaEm(ez0) - largura)) return;
        shape.lineTo(externaEm(ez0) - largura, ez0);
        shape.lineTo(fundo, ez0);
        shape.lineTo(fundo, ez1);
        if (ez1 < z1 - 1e-9) shape.lineTo(externaEm(ez1) - largura, ez1);
      });
      if (!entalhes.length || Number(entalhes[entalhes.length - 1].z1) < z1 - 1e-9) {
        shape.lineTo(externaEm(z1) - largura, z1);
      }
      shape.lineTo(externaEm(z1), z1);
      shape.lineTo(externaEm(z0), z0);
      shape.closePath();

      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: espessuraRipa, bevelEnabled: false
      });
      // Com mais de uma ripa por face, elas ficam paralelas à do meio:
      // `deslocamento` corre ao longo da face, no sentido anti-horário.
      geometry.translate(0, 0, -espessuraRipa / 2 + (Number(ripa.deslocamento) || 0));

      var mesh = new THREE.Mesh(geometry, state.materials.ripaEstruturada);
      // Gira para a face onde a ripa mora; `s` é o meio dessa face no perímetro.
      var ponto = pointAt(Number(ripa.s), 0, 0);
      mesh.rotation.y = -Math.atan2(ponto[2], ponto[0]);
      mesh.userData.parte = 'ripaLigacao';
      addMesh(mesh, geometry);
    });
  }

  function addPePorticoU(data) {
    if (!data) return;
    var pecas = data.pecas_3d || data.pecas || [];
    if (!pecas.length) return;

    applyWoodTexture(state.materials.coneCasca, 1, 1);
    applyWoodTexture(state.materials.porticoEmenda, 1, 1);

    var widthTotal = Math.max(100, Number(data.largura) || 700);
    var heightTotal = Math.max(100, Number(data.altura) || 730);

    pecas.forEach(function (peca) {
      var outline = peca.contorno;
      if (!outline || outline.length < 3) return;
      var points = outline.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
      var shape = new THREE.Shape(points);

      (peca.buracos || []).forEach(function (hole) {
        if (!hole || hole.length < 3) return;
        var hPoints = hole.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
        if (THREE.ShapeUtils.area(hPoints) * THREE.ShapeUtils.area(points) > 0) hPoints.reverse();
        shape.holes.push(new THREE.Path(hPoints));
      });

      var thick = Number(peca.espessura) || Number(data.espessura_mdf) || 18;
      var geom = new THREE.ExtrudeGeometry(shape, {
        depth: thick,
        bevelEnabled: false,
        curveSegments: 16
      });

      // Mapeamento UV por orientação da face:
      // - Faces frontal/traseira (nz): veio na vertical da mesa
      // - Topos de MDF (ny): textura rotacionada em 90° para o veio acompanhar o comprimento do topo
      // - Bordas verticais (nx): veio acompanha a altura da perna
      geom.computeVertexNormals();
      var posAttr = geom.attributes.position;
      var normAttr = geom.attributes.normal;
      var uvAttr = geom.attributes.uv;

      if (posAttr && normAttr && uvAttr) {
        var px0 = peca.x || 0;
        var py0 = peca.y || 0;
        var pz0 = peca.z || 0;

        for (var i = 0; i < uvAttr.count; i++) {
          var nx = normAttr.getX(i);
          var ny = normAttr.getY(i);
          var nz = normAttr.getZ(i);

          var wx = px0 + posAttr.getX(i);
          var wy = py0 + posAttr.getY(i);
          var wz = pz0 + posAttr.getZ(i);

          if (Math.abs(nz) > 0.5) {
            // Faces frontal e traseira: veio na vertical da mesa
            uvAttr.setXY(i, wx / widthTotal, wy / heightTotal);
          } else if (Math.abs(ny) > Math.abs(nx)) {
            // Topos e bases horizontais do MDF: rotaciona 90° para o veio correr ao longo do topo
            uvAttr.setXY(i, wz / 200.0, wx / widthTotal);
          } else {
            // Bordas verticais do MDF: veio acompanha a altura vertical
            uvAttr.setXY(i, wz / 200.0, wy / heightTotal);
          }
        }
        uvAttr.needsUpdate = true;
      }

      var mat = peca.is_emenda ? state.materials.porticoEmenda : state.materials.coneCasca;
      var mesh = new THREE.Mesh(geom, mat);

      if (peca.vertical || peca.tipo === 'painel_vertical') {
        mesh.position.set(peca.x || 0, peca.y || 0, peca.z || 0);
      } else {
        geom.rotateX(-Math.PI / 2);
        mesh.position.set(peca.x || 0, peca.z || 0, 0);
      }

      addMesh(mesh, geom, true);
    });
  }

  function addPortaCavaQuadrada(data) {
    var width = Number(data.largura);
    var height = Number(data.altura);
    var thickness = Number(data.espessura_material) || 18;
    var cavity = data.cava || {};
    var outer = cavity.outer || {};
    var inner = cavity.inner || {};
    var vbit = cavity.vbit || {};
    var pocketDepth = Math.max(0, Math.min(thickness - 0.5, Number(cavity.profundidade_rebaixo) || 0));
    var pocketFloorZ = thickness - pocketDepth;
    var vbitDepth = Math.max(0, Math.min(thickness - 0.5, Number(vbit.profundidade) || 0));
    var chamferWidth = Math.max(0, Number(vbit.largura_chanfro) || 0);
    if (!(width > 0 && height > 0 && thickness > 0)) return;

    applyWoodTexture(state.materials.portaCasca, 1, 2);

    function rectangleShape(x0, y0, x1, y1) {
      var shape = new THREE.Shape();
      shape.moveTo(x0, y0);
      shape.lineTo(x1, y0);
      shape.lineTo(x1, y1);
      shape.lineTo(x0, y1);
      shape.closePath();
      return shape;
    }

    function rectangleHole(rect) {
      var path = new THREE.Path();
      path.moveTo(Number(rect.x0), Number(rect.y0));
      path.lineTo(Number(rect.x0), Number(rect.y1));
      path.lineTo(Number(rect.x1), Number(rect.y1));
      path.lineTo(Number(rect.x1), Number(rect.y0));
      path.closePath();
      return path;
    }

    function circleHole(hole) {
      var path = new THREE.Path();
      path.absellipse(Number(hole.x), Number(hole.y), Number(hole.diametro) / 2, Number(hole.diametro) / 2, 0, Math.PI * 2, true, 0);
      return path;
    }

    function addFace(shape, z, material, showEdges) {
      var geometry = new THREE.ShapeGeometry(shape, 32);
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      addMesh(mesh, geometry, showEdges);
    }

    function addRectWalls(rect, z0, z1, material, skip) {
      if (!(z1 > z0)) return;
      skip = skip || {};
      var x0 = Number(rect.x0), y0 = Number(rect.y0);
      var x1 = Number(rect.x1), y1 = Number(rect.y1);
      var positions = [];
      function quad(a, b, c, d) {
        [a, b, c, a, c, d].forEach(function (point) {
          positions.push(point[0], point[1], point[2]);
        });
      }
      if (!skip.base) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
      if (!skip.direita) quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
      if (!skip.topo) quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]);
      if (!skip.esquerda) quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]);
      if (!positions.length) return;
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, material), geometry);
    }

    function clippedRect(rect, base) {
      return {
        x0: Math.max(Number(base.x0), Number(rect.x0)),
        y0: Math.max(Number(base.y0), Number(rect.y0)),
        x1: Math.min(Number(base.x1), Number(rect.x1)),
        y1: Math.min(Number(base.y1), Number(rect.y1))
      };
    }

    function addRegionMinusRect(base, cut, z, material, blindHoles) {
      var clipped = clippedRect(cut, base);
      var regions = [];
      if (clipped.x0 > base.x0) regions.push({x0: base.x0, y0: base.y0, x1: clipped.x0, y1: base.y1});
      if (clipped.x1 < base.x1) regions.push({x0: clipped.x1, y0: base.y0, x1: base.x1, y1: base.y1});
      var centerX0 = Math.max(base.x0, clipped.x0);
      var centerX1 = Math.min(base.x1, clipped.x1);
      if (centerX1 > centerX0 && clipped.y0 > base.y0) regions.push({x0: centerX0, y0: base.y0, x1: centerX1, y1: clipped.y0});
      if (centerX1 > centerX0 && clipped.y1 < base.y1) regions.push({x0: centerX0, y0: clipped.y1, x1: centerX1, y1: base.y1});
      regions.forEach(function (region) {
        if (!(region.x1 > region.x0 && region.y1 > region.y0)) return;
        var shape = rectangleShape(region.x0, region.y0, region.x1, region.y1);
        (blindHoles || []).forEach(function (hole) {
          var radius = Number(hole.diametro) / 2;
          var x = Number(hole.x), y = Number(hole.y);
          if (x - radius > region.x0 && x + radius < region.x1 && y - radius > region.y0 && y + radius < region.y1) {
            shape.holes.push(circleHole(hole));
          }
        });
        addFace(shape, z, material, false);
      });
    }

    var innerValid = Number(inner.x1) > Number(inner.x0) && Number(inner.y1) > Number(inner.y0);
    var outerValid = Number(outer.x1) > Number(outer.x0) && Number(outer.y1) > Number(outer.y0);
    if (!innerValid || !outerValid) return;

    var boardRect = {x0: 0, y0: 0, x1: width, y1: height};
    var openBorders = cavity.aberta_bordas || {};
    // O rebaixo pode alcancar a borda sozinho - cava perto da borda, com o
    // vazado ainda dentro da peca. Nesse caso o desenho tambem precisa do
    // caminho recortado, senao o fundo do rebaixo sai flutuando fora da porta.
    var pocketReachesEdge = Number(outer.x0) <= 0 || Number(outer.y0) <= 0 ||
      Number(outer.x1) >= width || Number(outer.y1) >= height;
    var openCavity = !!(openBorders.esquerda || openBorders.direita || openBorders.base || openBorders.topo) || pocketReachesEdge;
    var innerClip = clippedRect(inner, boardRect);
    var outerClip = clippedRect(outer, boardRect);

    var vbitOuter = {
      x0: Math.max(0, Number(inner.x0) - chamferWidth),
      y0: Math.max(0, Number(inner.y0) - chamferWidth),
      x1: Math.min(width, Number(inner.x1) + chamferWidth),
      y1: Math.min(height, Number(inner.y1) + chamferWidth)
    };

    // A face externa permanece com o recorte nominal. A V-bit desta porta e
    // aplicada pelo verso, depois do rebaixo, no contorno do vao interno.
    if (openCavity) {
      addRegionMinusRect(boardRect, innerClip, 0, state.materials.portaCasca, []);
    } else {
      var frontShape = rectangleShape(0, 0, width, height);
      frontShape.holes.push(rectangleHole(inner));
      addFace(frontShape, 0, state.materials.portaCasca, true);
    }

    // Face interna: o rebaixo maior abre a melamina pelo verso. As furações
    // de dobradiça também são removidas desta face para revelar sua profundidade.
    var allBlindHoles = (data.dobradicas || []).concat(data.furos_marcacao || []).filter(function (hole) {
      return Number(hole.diametro) > 0 && Number(hole.profundidade) > 0;
    });
    var backCut = pocketDepth > 0 ? outerClip : (vbitDepth > 0 && chamferWidth > 0 ? vbitOuter : innerClip);
    if (openCavity) {
      addRegionMinusRect(boardRect, backCut, thickness, state.materials.portaCasca, allBlindHoles);
    } else {
      var backShape = rectangleShape(0, 0, width, height);
      backShape.holes.push(rectangleHole(backCut));
      allBlindHoles.forEach(function (hole) { backShape.holes.push(circleHole(hole)); });
      addFace(backShape, thickness, state.materials.portaCasca, true);
    }

    // Miolo exposto no rebaixo da cava, preservando o vazio atravessante.
    if (pocketDepth > 0) {
      if (openCavity) {
        addRegionMinusRect(outerClip, vbitDepth > 0 && chamferWidth > 0 ? vbitOuter : innerClip, pocketFloorZ, state.materials.portaMiolo, []);
      } else {
        var pocketShape = rectangleShape(Number(outer.x0), Number(outer.y0), Number(outer.x1), Number(outer.y1));
        pocketShape.holes.push(rectangleHole(vbitDepth > 0 && chamferWidth > 0 ? vbitOuter : inner));
        addFace(pocketShape, pocketFloorZ, state.materials.portaMiolo, true);
      }
      addRectWalls(outerClip, pocketFloorZ, thickness, state.materials.portaMiolo, {
        esquerda: Number(outer.x0) <= 0,
        direita: Number(outer.x1) >= width,
        base: Number(outer.y0) <= 0,
        topo: Number(outer.y1) >= height
      });
    }

    // profundidade V-bit e medida desde a face traseira da chapa. Z-2 em MDF
    // de 18 mm significa 16 mm de descida e ponta terminando em Z=2 mm.
    var vbitInnerZ = Math.max(0, thickness - vbitDepth);
    if (vbitDepth > 0 && chamferWidth > 0) {
      var bevelPositions = [];
      function bevelQuad(a, b, c, d) {
        [a, b, c, a, c, d].forEach(function (point) {
          bevelPositions.push(point[0], point[1], point[2]);
        });
      }
      var ox0 = Number(vbitOuter.x0), oy0 = Number(vbitOuter.y0);
      var ox1 = Number(vbitOuter.x1), oy1 = Number(vbitOuter.y1);
      var ix0 = Number(inner.x0), iy0 = Number(inner.y0);
      var ix1 = Number(inner.x1), iy1 = Number(inner.y1);
      // Nas bordas em que o recorte encontra o contorno final da porta nao ha
      // parede nem chanfro: essa sobra sai junto no corte externo da peca.
      if (!openBorders.base) bevelQuad([ox0, oy0, pocketFloorZ], [ox1, oy0, pocketFloorZ], [ix1, iy0, vbitInnerZ], [ix0, iy0, vbitInnerZ]);
      if (!openBorders.direita) bevelQuad([ox1, oy0, pocketFloorZ], [ox1, oy1, pocketFloorZ], [ix1, iy1, vbitInnerZ], [ix1, iy0, vbitInnerZ]);
      if (!openBorders.topo) bevelQuad([ox1, oy1, pocketFloorZ], [ox0, oy1, pocketFloorZ], [ix0, iy1, vbitInnerZ], [ix1, iy1, vbitInnerZ]);
      if (!openBorders.esquerda) bevelQuad([ox0, oy1, pocketFloorZ], [ox0, oy0, pocketFloorZ], [ix0, iy0, vbitInnerZ], [ix0, iy1, vbitInnerZ]);
      var bevelGeometry = new THREE.BufferGeometry();
      bevelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bevelPositions, 3));
      bevelGeometry.computeVertexNormals();
      addMesh(new THREE.Mesh(bevelGeometry, state.materials.portaVbit), bevelGeometry);
    }
    addRectWalls(innerClip, 0, vbitInnerZ, state.materials.portaMiolo, {
      esquerda: !!openBorders.esquerda,
      direita: !!openBorders.direita,
      base: !!openBorders.base,
      topo: !!openBorders.topo
    });
    if (!openCavity) {
      addRectWalls(boardRect, 0, thickness, state.materials.portaMiolo);
    } else {
      // As bordas externas que cruzam a cava sao segmentadas: trecho vazado
      // nao recebe parede e trecho apenas rebaixado termina no fundo do pocket.
      var boundaryPositions = [];
      function boundaryQuad(a, b, c, d) {
        [a, b, c, a, c, d].forEach(function (point) { boundaryPositions.push(point[0], point[1], point[2]); });
      }
      function sideSegments(side, maxValue, outerStart, outerEnd, innerStart, innerEnd, outerTouches, innerTouches) {
        var stops = [0, maxValue];
        if (outerTouches) stops.push(Math.max(0, outerStart), Math.min(maxValue, outerEnd));
        if (innerTouches) stops.push(Math.max(0, innerStart), Math.min(maxValue, innerEnd));
        stops.sort(function (a, b) { return a - b; });
        stops = stops.filter(function (value, index, values) { return index === 0 || Math.abs(value - values[index - 1]) > 1e-7; });
        for (var index = 0; index < stops.length - 1; index++) {
          var a = stops[index], b = stops[index + 1], mid = (a + b) / 2;
          // Quando o recorte atravessante chega a esta borda, o corte externo
          // leva tambem a pequena parede entre o inner e o limite do rebaixo.
          var removalStart = innerTouches && outerTouches ? outerStart : innerStart;
          var removalEnd = innerTouches && outerTouches ? outerEnd : innerEnd;
          var inRemovedOpening = innerTouches && mid > removalStart && mid < removalEnd;
          if (inRemovedOpening || !(b > a)) continue;
          var inOuter = outerTouches && mid > outerStart && mid < outerEnd;
          var z1 = inOuter ? pocketFloorZ : thickness;
          if (side === 'esquerda') boundaryQuad([0, b, 0], [0, a, 0], [0, a, z1], [0, b, z1]);
          if (side === 'direita') boundaryQuad([width, a, 0], [width, b, 0], [width, b, z1], [width, a, z1]);
          if (side === 'base') boundaryQuad([a, 0, 0], [b, 0, 0], [b, 0, z1], [a, 0, z1]);
          if (side === 'topo') boundaryQuad([b, height, 0], [a, height, 0], [a, height, z1], [b, height, z1]);
        }
      }
      sideSegments('esquerda', height, outer.y0, outer.y1, inner.y0, inner.y1, outer.x0 <= 0, inner.x0 <= 0);
      sideSegments('direita', height, outer.y0, outer.y1, inner.y0, inner.y1, outer.x1 >= width, inner.x1 >= width);
      sideSegments('base', width, outer.x0, outer.x1, inner.x0, inner.x1, outer.y0 <= 0, inner.y0 <= 0);
      sideSegments('topo', width, outer.x0, outer.x1, inner.x0, inner.x1, outer.y1 >= height, inner.y1 >= height);
      if (boundaryPositions.length) {
        var boundaryGeometry = new THREE.BufferGeometry();
        boundaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(boundaryPositions, 3));
        boundaryGeometry.computeVertexNormals();
        addMesh(new THREE.Mesh(boundaryGeometry, state.materials.portaMiolo), boundaryGeometry);
      }
    }

    function addBlindHole(hole) {
      var diameter = Number(hole.diametro);
      var depth = Math.max(0, Math.min(thickness - 0.5, Number(hole.profundidade) || 0));
      if (!(diameter > 0 && depth > 0)) return;
      var radius = diameter / 2;
      var wallGeometry = new THREE.CylinderGeometry(radius, radius, depth, 32, 1, true);
      wallGeometry.rotateX(Math.PI / 2);
      var wall = new THREE.Mesh(wallGeometry, state.materials.portaMiolo);
      wall.position.set(Number(hole.x), Number(hole.y), thickness - depth / 2);
      addMesh(wall, wallGeometry, false);

      var bottomGeometry = new THREE.CircleGeometry(radius, 32);
      var bottom = new THREE.Mesh(bottomGeometry, state.materials.portaFuro);
      bottom.position.set(Number(hole.x), Number(hole.y), thickness - depth + 0.02);
      addMesh(bottom, bottomGeometry, false);
    }
    allBlindHoles.forEach(addBlindHole);
  }

  function addPortaCavaRedonda(data) {
    var width = Number(data.largura);
    var height = Number(data.altura);
    var thickness = Number(data.espessura_material) || 18;
    var cavity = data.cava || {};
    var center = cavity.centro || {};
    var cx = Number(center.x), cy = Number(center.y);
    var innerRadius = Number(cavity.raio_inner);
    var outerRadius = Number(cavity.raio_outer);
    var vbit = cavity.vbit || {};
    var pocketDepth = Math.max(0, Math.min(thickness - 0.5, Number(cavity.profundidade_rebaixo) || 0));
    var pocketFloorZ = thickness - pocketDepth;
    var vbitDepth = Math.max(0, Math.min(thickness, Number(vbit.profundidade) || 0));
    var vbitInnerZ = Math.max(0, thickness - vbitDepth);
    var chamferWidth = Math.max(0, Number(vbit.largura_chanfro) || 0);
    var chamferOuterRadius = Math.min(outerRadius, innerRadius + chamferWidth);
    if (!(width > 0 && height > 0 && thickness > 0 && innerRadius > 0 && outerRadius > innerRadius)) return;

    applyWoodTexture(state.materials.portaCasca, 1, 2);

    function rectangleShape() {
      var shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(width, 0);
      shape.lineTo(width, height);
      shape.lineTo(0, height);
      shape.closePath();
      return shape;
    }

    function circlePath(x, y, radius) {
      var path = new THREE.Path();
      path.absellipse(x, y, radius, radius, 0, Math.PI * 2, true, 0);
      return path;
    }

    function circularShape(x, y, radius) {
      var shape = new THREE.Shape();
      shape.absellipse(x, y, radius, radius, 0, Math.PI * 2, false, 0);
      return shape;
    }

    function addFace(shape, z, material, showEdges) {
      var geometry = new THREE.ShapeGeometry(shape, 64);
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      addMesh(mesh, geometry, showEdges);
    }

    function addCircleOutline(x, y, radius, z) {
      var points = [];
      for (var index = 0; index < 64; index++) {
        var angle = Math.PI * 2 * index / 64;
        points.push(new THREE.Vector3(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z));
      }
      var geometry = new THREE.BufferGeometry().setFromPoints(points);
      state.model.add(new THREE.LineLoop(geometry, state.edgeMaterial));
    }

    function addOuterBoardWalls() {
      var positions = [];
      function quad(a, b, c, d) {
        [a, b, c, a, c, d].forEach(function (point) {
          positions.push(point[0], point[1], point[2]);
        });
      }
      quad([0, 0, 0], [width, 0, 0], [width, 0, thickness], [0, 0, thickness]);
      quad([width, 0, 0], [width, height, 0], [width, height, thickness], [width, 0, thickness]);
      quad([width, height, 0], [0, height, 0], [0, height, thickness], [width, height, thickness]);
      quad([0, height, 0], [0, 0, 0], [0, 0, thickness], [0, height, thickness]);
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, state.materials.portaMiolo), geometry);
    }

    var allBlindHoles = (data.dobradicas || []).concat(data.furos_marcacao || []).filter(function (hole) {
      return Number(hole.diametro) > 0 && Number(hole.profundidade) > 0;
    });

    // Face externa: somente o furo nominal atravessante aparece.
    var frontShape = rectangleShape();
    frontShape.holes.push(circlePath(cx, cy, innerRadius));
    // ShapeGeometry triangula superfícies com furos circulares. Não desenhamos
    // as arestas desses triângulos, pois elas não são linhas reais da peça.
    addFace(frontShape, 0, state.materials.portaCasca, false);
    addCircleOutline(cx, cy, innerRadius, 0.02);

    // Face traseira: revela o rebaixo maior e as furações cegas das dobradiças.
    var backShape = rectangleShape();
    backShape.holes.push(circlePath(cx, cy, pocketDepth > 0 ? outerRadius : chamferOuterRadius));
    allBlindHoles.forEach(function (hole) {
      backShape.holes.push(circlePath(Number(hole.x), Number(hole.y), Number(hole.diametro) / 2));
    });
    addFace(backShape, thickness, state.materials.portaCasca, false);
    addCircleOutline(cx, cy, pocketDepth > 0 ? outerRadius : chamferOuterRadius, thickness + 0.02);
    allBlindHoles.forEach(function (hole) {
      addCircleOutline(Number(hole.x), Number(hole.y), Number(hole.diametro) / 2, thickness + 0.02);
    });

    // Fundo anular do rebaixo, já descontando a abertura necessária para a V-bit.
    if (pocketDepth > 0) {
      var pocketShape = circularShape(cx, cy, outerRadius);
      pocketShape.holes.push(circlePath(cx, cy, chamferOuterRadius));
      addFace(pocketShape, pocketFloorZ, state.materials.portaMiolo, false);
      addCircleOutline(cx, cy, outerRadius, pocketFloorZ + 0.02);
      addCircleOutline(cx, cy, chamferOuterRadius, pocketFloorZ + 0.02);

      var pocketWallGeometry = new THREE.CylinderGeometry(outerRadius, outerRadius, pocketDepth, 64, 1, true);
      pocketWallGeometry.rotateX(Math.PI / 2);
      var pocketWall = new THREE.Mesh(pocketWallGeometry, state.materials.portaMiolo);
      pocketWall.position.set(cx, cy, thickness - pocketDepth / 2);
      addMesh(pocketWall, pocketWallGeometry, false);
    }

    // A superfície cônica representa a V-bit de 90 graus descendo até Z=2 mm.
    var visibleVbitHeight = Math.max(0, pocketFloorZ - vbitInnerZ);
    if (visibleVbitHeight > 0 && chamferOuterRadius > innerRadius) {
      var bevelGeometry = new THREE.CylinderGeometry(
        chamferOuterRadius, innerRadius, visibleVbitHeight, 64, 1, true
      );
      bevelGeometry.rotateX(Math.PI / 2);
      var bevel = new THREE.Mesh(bevelGeometry, state.materials.portaVbit);
      bevel.position.set(cx, cy, vbitInnerZ + visibleVbitHeight / 2);
      addMesh(bevel, bevelGeometry, false);
    }

    // Parede curta que resta entre a ponta da V-bit e a face externa.
    if (vbitInnerZ > 0) {
      var throughWallGeometry = new THREE.CylinderGeometry(innerRadius, innerRadius, vbitInnerZ, 64, 1, true);
      throughWallGeometry.rotateX(Math.PI / 2);
      var throughWall = new THREE.Mesh(throughWallGeometry, state.materials.portaMiolo);
      throughWall.position.set(cx, cy, vbitInnerZ / 2);
      addMesh(throughWall, throughWallGeometry, false);
    }
    addOuterBoardWalls();

    function addBlindHole(hole) {
      var diameter = Number(hole.diametro);
      var depth = Math.max(0, Math.min(thickness - 0.5, Number(hole.profundidade) || 0));
      if (!(diameter > 0 && depth > 0)) return;
      var radius = diameter / 2;
      var wallGeometry = new THREE.CylinderGeometry(radius, radius, depth, 32, 1, true);
      wallGeometry.rotateX(Math.PI / 2);
      var wall = new THREE.Mesh(wallGeometry, state.materials.portaMiolo);
      wall.position.set(Number(hole.x), Number(hole.y), thickness - depth / 2);
      addMesh(wall, wallGeometry, false);

      var bottomGeometry = new THREE.CircleGeometry(radius, 32);
      var bottom = new THREE.Mesh(bottomGeometry, state.materials.portaFuro);
      bottom.position.set(Number(hole.x), Number(hole.y), thickness - depth + 0.02);
      addMesh(bottom, bottomGeometry, false);
    }
    allBlindHoles.forEach(addBlindHole);
  }

  function addPortaSemPuxador(data) {
    var width = Number(data.largura);
    var height = Number(data.altura);
    var thickness = Number(data.espessura_material) || 18;
    if (!(width > 0 && height > 0 && thickness > 0)) return;

    applyWoodTexture(state.materials.portaCasca, 1, 2);

    function rectangleShape() {
      var shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(width, 0);
      shape.lineTo(width, height);
      shape.lineTo(0, height);
      shape.closePath();
      return shape;
    }

    function circlePath(hole) {
      var path = new THREE.Path();
      path.absellipse(
        Number(hole.x), Number(hole.y),
        Number(hole.diametro) / 2, Number(hole.diametro) / 2,
        0, Math.PI * 2, true, 0
      );
      return path;
    }

    function addFace(shape, z, material) {
      var geometry = new THREE.ShapeGeometry(shape, 48);
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      addMesh(mesh, geometry, false);
    }

    function addCircleOutline(hole, z) {
      var points = [];
      var radius = Number(hole.diametro) / 2;
      for (var index = 0; index < 48; index++) {
        var angle = Math.PI * 2 * index / 48;
        points.push(new THREE.Vector3(
          Number(hole.x) + Math.cos(angle) * radius,
          Number(hole.y) + Math.sin(angle) * radius,
          z
        ));
      }
      var geometry = new THREE.BufferGeometry().setFromPoints(points);
      state.model.add(new THREE.LineLoop(geometry, state.edgeMaterial));
    }

    function addOuterWalls() {
      var positions = [];
      function quad(a, b, c, d) {
        [a, b, c, a, c, d].forEach(function (point) {
          positions.push(point[0], point[1], point[2]);
        });
      }
      quad([0, 0, 0], [width, 0, 0], [width, 0, thickness], [0, 0, thickness]);
      quad([width, 0, 0], [width, height, 0], [width, height, thickness], [width, 0, thickness]);
      quad([width, height, 0], [0, height, 0], [0, height, thickness], [width, height, thickness]);
      quad([0, height, 0], [0, 0, 0], [0, 0, thickness], [0, height, thickness]);
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      addMesh(new THREE.Mesh(geometry, state.materials.portaMiolo), geometry);
    }

    var blindHoles = (data.dobradicas || []).concat(data.furos_marcacao || []).filter(function (hole) {
      return Number(hole.diametro) > 0 && Number(hole.profundidade) > 0;
    });

    // A face externa é totalmente lisa; as operações existem somente no verso.
    addFace(rectangleShape(), 0, state.materials.portaCasca);
    var backShape = rectangleShape();
    blindHoles.forEach(function (hole) { backShape.holes.push(circlePath(hole)); });
    addFace(backShape, thickness, state.materials.portaCasca);
    blindHoles.forEach(function (hole) { addCircleOutline(hole, thickness + 0.02); });
    addOuterWalls();

    function addBlindHole(hole) {
      var diameter = Number(hole.diametro);
      var depth = Math.max(0, Math.min(thickness - 0.5, Number(hole.profundidade) || 0));
      if (!(diameter > 0 && depth > 0)) return;
      var radius = diameter / 2;
      var wallGeometry = new THREE.CylinderGeometry(radius, radius, depth, 32, 1, true);
      wallGeometry.rotateX(Math.PI / 2);
      var wall = new THREE.Mesh(wallGeometry, state.materials.portaMiolo);
      wall.position.set(Number(hole.x), Number(hole.y), thickness - depth / 2);
      addMesh(wall, wallGeometry, false);

      var bottomGeometry = new THREE.CircleGeometry(radius, 32);
      var bottom = new THREE.Mesh(bottomGeometry, state.materials.portaFuro);
      bottom.position.set(Number(hole.x), Number(hole.y), thickness - depth + 0.02);
      addMesh(bottom, bottomGeometry, false);
    }
    blindHoles.forEach(addBlindHole);
  }

  function frameModel() {
    var box = new THREE.Box3().setFromObject(state.model);
    if (box.isEmpty()) return;
    var sphere = box.getBoundingSphere(new THREE.Sphere());
    state.center.copy(sphere.center);
    state.radius = Math.max(sphere.radius, 1);
    state.floor.scale.set(state.radius * 6, state.radius * 6, 1);
    state.floor.position.set(state.center.x, box.min.y, state.center.z);
    state.mainLight.target.position.copy(state.center);
    var shadowHalf = state.radius + 40;
    var shadowCamera = state.mainLight.shadow.camera;
    shadowCamera.left = -shadowHalf;
    shadowCamera.right = shadowHalf;
    shadowCamera.top = shadowHalf;
    shadowCamera.bottom = -shadowHalf;
    shadowCamera.near = 1;
    shadowCamera.far = shadowHalf * 8;
    shadowCamera.updateProjectionMatrix();
    fitCamera();
    render();
    setStatus('', false);
  }

  // Conferência de encaixe, padrão de todos os pés (decisão de 22/10/2026):
  // o gerador monta as peças como na oficina e manda em `interferencias` o
  // pedaço de uma peça que entra na outra. Sai em vermelho, visível através
  // da casca. Formato em curvos/encaixe_montagem.py: `contorno` (+ `furo`) é a
  // planta, com x para a direita e y para a frente, como a casca; o formato
  // de elipse (`inner_a`...) é o do Pé Cônico.
  function addZonasDeEncaixe(data) {
    var zonas = (data && data.interferencias) || [];
    var desenhou = false;
    zonas.forEach(function (zona) {
      var z0 = Number(zona.z0), z1 = Number(zona.z1);
      var depth = z1 - z0;
      if (!(depth > 0)) return;
      var shape, geometry;
      if (zona.contorno && zona.contorno.length >= 3) {
        shape = new THREE.Shape(zona.contorno.map(function (p) {
          return new THREE.Vector2(Number(p[0]), Number(p[1]));
        }));
        if (zona.furo && zona.furo.length >= 3) {
          shape.holes.push(new THREE.Path(zona.furo.map(function (p) {
            return new THREE.Vector2(Number(p[0]), Number(p[1]));
          })));
        }
        geometry = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        // (x, y, altura) da planta vira (x, altura, y) no mundo, como a casca.
        geometry.rotateX(Math.PI / 2);
        geometry.translate(0, z1, 0);
      } else {
        var folgaVisual = 0.4;
        var outerA = Number(zona.outer_a) + folgaVisual, outerB = Number(zona.outer_b) + folgaVisual;
        var innerA = Math.max(0.5, Number(zona.inner_a) - folgaVisual);
        var innerB = Math.max(0.5, Number(zona.inner_b) - folgaVisual);
        if (!(outerA > innerA && outerB > innerB)) return;
        shape = new THREE.Shape();
        shape.absellipse(0, 0, outerA, outerB, 0, Math.PI * 2, false, 0);
        var opening = new THREE.Path();
        opening.absellipse(0, 0, innerA, innerB, 0, Math.PI * 2, true, 0);
        shape.holes.push(opening);
        geometry = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, curveSegments: 96 });
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, z0, 0);
      }
      var mesh = new THREE.Mesh(geometry, state.materials.coneInterferencia);
      mesh.renderOrder = 999;
      // Aviso de encaixe: continua à vista também na "Estrutura interna".
      mesh.userData.parte = 'interferencia';
      addMesh(mesh, geometry, false);
      desenhou = true;
    });
    return desenhou;
  }

  function updateModel(data, subtype) {
    dataBySubtype[subtype || currentSubtype()] = data;
    initScene();
    if (!state) return;
    disposeModel();
    try {
      buildModel(data, subtype);
    } finally {
      if (addZonasDeEncaixe(data)) render();
      // Modelo refeito (medida alterada ou troca de produto): as peças novas
      // nascem visíveis, então o modo "Estrutura interna" é reaplicado aqui.
      syncEstruturaInterna();
    }
  }

  function buildModel(data, subtype) {
    if (data.kind === 'prateleira_dupla') {
      addShelfPanel(data);
      frameModel();
      return;
    }
    if (data.kind === 'porta_cava_quadrada' || data.kind === 'porta_cava_longa') {
      addPortaCavaQuadrada(data);
      frameModel();
      return;
    }
    if (data.kind === 'porta_cava_redonda') {
      addPortaCavaRedonda(data);
      frameModel();
      return;
    }
    if (data.kind === 'porta_sem_puxador') {
      addPortaSemPuxador(data);
      frameModel();
      return;
    }
    if (data.kind === 'muxarabi_encaixado') {
      addMuxarabiPanel(data);
      frameModel();
      return;
    }
    if (data.kind === 'painel_muxarabi') {
      addPainelMuxarabi(data);
      frameModel();
      return;
    }
    if (data.kind === 'painel_ripado_cavilhado') {
      addPainelRipado(data);
      frameModel();
      return;
    }
    if (data.kind === 'pe_redondo_estruturado') {
      addPeRedondoEstruturado(data);
      frameModel();
      return;
    }
    if (data.kind === 'revestimento_cone_eliptico' || data.kind === 'pe_conico' || data.kind === 'pe_redondo' || data.kind === 'pe_oval') {
      addRevestimentoCone(data);
      frameModel();
      return;
    }
    if (data.kind === 'pe_oblongo') {
      addPeOblongo(data);
      frameModel();
      return;
    }
    if (data.kind === 'pe_ripado_arredondado') {
      addPeRipadoArredondado(data);
      frameModel();
      return;
    }
    if (data.kind === 'pe_conico_quadrado') {
      addPeConicoQuadrado(data);
      frameModel();
      return;
    }
    if (data.kind === 'pe_portico_u' || subtype === 'pe_portico_u') {
      addPePorticoU(data);
      frameModel();
      return;
    }
    var thickness = Number(data.espessura_mdf) || 18;
    var height = Number(data.altura) || 400;
    var levels = data.estrutura_z && data.estrutura_z.length ? data.estrutura_z : [height - thickness];
    var vazadoEstrutura = data.vazado_outline && data.vazado_outline.length ? [data.vazado_outline] : null;
    levels.forEach(function (z) {
      addFlatPanel(data.top_outline, z, thickness, state.materials.estrutura, vazadoEstrutura);
    });
    var reforcoOutlines = data.reforco_outlines || (
      data.reforco_outline && data.reforco_outline.length ? [data.reforco_outline] : []
    );
    if (reforcoOutlines.length) {
      (data.reforco_z || []).forEach(function (z) {
        reforcoOutlines.forEach(function (outline) {
          addFlatPanel(outline, z, thickness, state.materials.reforco);
        });
      });
    }
    applyWoodTexture(state.materials.ripaAmadeirada, 1, 1);
    (data.ripas || []).forEach(function (rect) {
      var faceMaterial = rect.face_amadeirada ? state.materials.ripaAmadeirada : null;
      addRipa(rect, height, state.materials.ripa, faceMaterial, rect.face_amadeirada);
    });
    (data.ripas_montagem || []).forEach(function (rect) {
      addRipa(rect, height, state.materials.ripa);
    });
    if (data.kind === 'curvo_simples_fresagens' || data.kind === 'curvo_duplo_fresagens' || data.kind === 'curvo_simples_v3_fresagens' || data.kind === 'curvo_duplo_parafusado_fresagens') addKerfedWall(data);
    else addWall(data);
    frameModel();
  }

  function fitCamera() {
    if (!state) return;
    var verticalFov = state.camera.fov * Math.PI / 180;
    state.fitDistance = (state.radius * 1.35) / Math.sin(verticalFov / 2);
  }

  function render() {
    if (!state) return;
    var pitch = Math.max(-1.5, Math.min(0.85, view.pitch));
    var distance = state.fitDistance / zoom;
    state.camera.position.set(
      state.center.x + distance * Math.sin(view.yaw) * Math.cos(pitch),
      state.center.y + distance * Math.sin(pitch) + state.radius * 0.15,
      state.center.z + distance * Math.cos(view.yaw) * Math.cos(pitch)
    );
    state.camera.up.set(0, 1, 0);
    state.camera.lookAt(state.center);
    state.renderer.render(state.scene, state.camera);
  }

  function applyXray() {
    if (!state) return;
    Object.keys(state.materials).forEach(function (key) {
      var material = state.materials[key];
      var isShelfLayer = key === 'prateleira' || key === 'prateleiraEspelhada';
      var isConeMarking = key === 'fresagemCone' || key === 'fresagemDobra' || key === 'vbitEstruturado' || key === 'emendaCone' || key === 'emendaParede' || key === 'portaFuro' || key === 'porticoEmenda';
      material.transparent = xray;
      material.opacity = xray ? (isConeMarking ? 0.9 : (isShelfLayer ? 0.2 : 0.32)) : 1;
      material.depthWrite = !xray;
      // As duas chapas encostam na mesma face. Em raio X, DoubleSide mistura as
      // faces coplanares e revela a triangulacao como listras. FrontSide elimina
      // essa sobreposicao sem esconder os rebaixos posicionados entre as chapas.
      if (isShelfLayer) material.side = xray ? THREE.FrontSide : THREE.DoubleSide;
      material.needsUpdate = true;
    });
    state.model.traverse(function (node) {
      if (node.userData && node.userData.xrayOnly) node.visible = xray;
    });
    var button = document.getElementById('curvoXrayToolBtn');
    if (button) {
      button.classList.toggle('active', xray);
      button.setAttribute('aria-pressed', xray ? 'true' : 'false');
    }
    render();
  }

  // Peças que ficam à vista na "Estrutura interna". O resto (casca, miolo,
  // fresagens, emendas e anéis externos) some por completo.
  var PARTES_ESTRUTURA_INTERNA = { anelInterno: true, ripaLigacao: true, interferencia: true };

  function contarPartes() {
    var total = {}, visiveis = {};
    if (!state) return { total: total, visiveis: visiveis };
    state.model.children.forEach(function (child) {
      var parte = (child.userData && child.userData.parte) || 'outros';
      total[parte] = (total[parte] || 0) + 1;
      if (child.visible) visiveis[parte] = (visiveis[parte] || 0) + 1;
    });
    return { total: total, visiveis: visiveis };
  }

  // Só ganha o botão o pé que tem, ao mesmo tempo, anel interno e ripa de ligação.
  function temEstruturaInterna() {
    var total = contarPartes().total;
    return !!(total.anelInterno && total.ripaLigacao);
  }

  function applyEstruturaInterna() {
    if (!state) return;
    state.model.children.forEach(function (child) {
      var dados = child.userData || {};
      if (estruturaInterna) child.visible = !!PARTES_ESTRUTURA_INTERNA[dados.parte];
      else child.visible = dados.xrayOnly ? xray : true;
    });
    var button = document.getElementById('curvoEstruturaToolBtn');
    if (button) {
      button.classList.toggle('active', estruturaInterna);
      button.setAttribute('aria-pressed', estruturaInterna ? 'true' : 'false');
    }
    render();
  }

  function syncEstruturaInterna() {
    var disponivel = !!state && temEstruturaInterna();
    // Ex.: desmarcou as ripas com o modo ligado — volta para a vista completa.
    if (!disponivel) estruturaInterna = false;
    var button = document.getElementById('curvoEstruturaToolBtn');
    if (button) button.style.display = disponivel ? 'grid' : 'none';
    applyEstruturaInterna();
  }

  function resizeRenderer() {
    if (!state) return;
    var size = canvasSize();
    state.renderer.setSize(size.width, size.height, false);
    state.camera.aspect = size.width / size.height;
    state.camera.updateProjectionMatrix();
    fitCamera();
    render();
  }

  function bindCanvasControls() {
    var dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', function (event) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointerup', function () { dragging = false; });
    canvas.addEventListener('pointercancel', function () { dragging = false; });
    canvas.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      view.yaw += (event.clientX - lastX) * 0.006;
      view.pitch += (event.clientY - lastY) * 0.006;
      lastX = event.clientX;
      lastY = event.clientY;
      render();
    });
    canvas.addEventListener('wheel', function (event) {
      if (!isActive()) return;
      event.preventDefault();
      zoom = Math.max(0.35, Math.min(4, zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
      render();
    }, { passive: false });
  }

  function setExpanded(nextExpanded) {
    var backdrop = document.getElementById('curvoPreviewBackdrop');
    if (nextExpanded === expanded) return;
    if (nextExpanded) {
      originalParent = wrap.parentNode;
      originalNextSibling = wrap.nextSibling;
      // Anota o lugar de cada botão antes de mexer em qualquer um.
      floatingButtonsHome = [
        [xrayButton, 'curvo-fullscreen-xray'],
        [estruturaButton, 'curvo-fullscreen-estrutura']
      ].filter(function (item) { return item[0]; }).map(function (item) {
        return { button: item[0], cls: item[1], parent: item[0].parentNode, next: item[0].nextSibling };
      });
      if (backdrop) document.body.appendChild(backdrop);
      document.body.appendChild(wrap);
      floatingButtonsHome.forEach(function (home) {
        wrap.appendChild(home.button);
        home.button.classList.add(home.cls);
      });
      wrap.classList.add('curvo-expanded');
      if (backdrop) backdrop.classList.add('active');
    } else {
      wrap.classList.remove('curvo-expanded');
      if (backdrop) backdrop.classList.remove('active');
      // Volta na ordem inversa: o vizinho anotado de cada botão já está no lugar.
      floatingButtonsHome.slice().reverse().forEach(function (home) {
        home.button.classList.remove(home.cls);
        if (home.parent) home.parent.insertBefore(home.button, home.next);
      });
      floatingButtonsHome = [];
      if (originalParent) originalParent.insertBefore(wrap, originalNextSibling);
    }
    expanded = nextExpanded;
    requestAnimationFrame(resizeRenderer);
  }

  function requestGeometry() {
    if (!isActive()) return;
    var requestedSubtype = currentSubtype();
    var requestedForm = activeForm(requestedSubtype);
    if (!requestedForm) return;
    var mySeq = ++geometryRequestSeq;
    setStatus('Atualizando 3D…', false);
    if (requestController) requestController.abort();
    requestController = new AbortController();
    fetch(geometryEndpoint(requestedSubtype), {
      method: 'POST',
      body: new FormData(requestedForm),
      signal: requestController.signal
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) throw new Error(body.erro || 'Não foi possível atualizar o preview.');
        return body;
      });
    }).then(function (data) {
      if (mySeq !== geometryRequestSeq) return; // resposta obsoleta, superada por outra requisição
      if (currentSubtype() !== requestedSubtype || !isActive()) return;
      ensureThreeLoaded(function () {
        updateModel(data, requestedSubtype);
        if (requestedSubtype === 'simples' || requestedSubtype === 'simples_v3' || requestedSubtype === 'duplo_vertical' || requestedSubtype === 'curvo_duplo_180' || requestedSubtype === 'duplo_parafusado') {
          var chkReforco = curvoForm ? curvoForm.querySelector('[name="gerar_reforco"]') : null;
          var hiddenAuto = curvoForm ? curvoForm.querySelector('[name="reforco_auto_desativado"]') : null;
          if (chkReforco && typeof data.reforco_ativo === 'boolean') chkReforco.checked = data.reforco_ativo;
          if (hiddenAuto && typeof data.reforco_auto_desativado === 'boolean') hiddenAuto.value = data.reforco_auto_desativado ? '1' : '0';
          var avisos = [];
          if (data.aviso_reforco) avisos.push(data.aviso_reforco);
          if (requestedSubtype === 'duplo_vertical' || requestedSubtype === 'curvo_duplo_180') {
            var campoDistRipaBorda = curvoForm ? curvoForm.querySelector('[name="distancia_ripa_borda"]') : null;
            if (campoDistRipaBorda && typeof data.distancia_ripa_borda_usada === 'number') {
              campoDistRipaBorda.value = data.distancia_ripa_borda_usada;
            }
            var campoEncaixeAltura = curvoForm ? curvoForm.querySelector('[name="encaixe_altura"]') : null;
            if (campoEncaixeAltura && typeof data.encaixe_altura_usada === 'number') {
              campoEncaixeAltura.value = data.encaixe_altura_usada;
            }
            // Só o Curvo Duplo 180° chega a reduzir a quantidade de encaixes
            // (último recurso do ajuste automático).
            var campoQtdEncaixes = curvoForm ? curvoForm.querySelector('[name="qtd_encaixes"]') : null;
            if (campoQtdEncaixes && typeof data.qtd_encaixes_usada === 'number') {
              campoQtdEncaixes.value = data.qtd_encaixes_usada;
            }
            if (data.aviso_encaixes) avisos.push(data.aviso_encaixes);
          }
          if (avisos.length) setStatus(avisos.join(' '), false);
        }
        // Canal genérico: qualquer produto que devolva `avisos` no payload
        // mostra o texto na barra de status, sem bloquear a geração.
        if (data.avisos && data.avisos.length) setStatus(data.avisos.join(' '), false);
      });
    }).catch(function (error) {
      if (error.name !== 'AbortError') setStatus(error.message, true);
    });
  }

  function scheduleRefresh() {
    if (!isActive()) return;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(requestGeometry, 220);
  }

  allForms.forEach(function (form) {
    if (!form) return;
    form.addEventListener('input', scheduleRefresh);
    form.addEventListener('change', scheduleRefresh);
  });

  var rotateButton = document.getElementById('previewRotateToolBtn');
  if (rotateButton) rotateButton.addEventListener('click', function () {
    if (!isActive()) return;
    view.yaw += Math.PI / 4;
    render();
  });
  var xrayButton = document.getElementById('curvoXrayToolBtn');
  if (xrayButton) xrayButton.addEventListener('click', function () {
    if (!isActive()) return;
    xray = !xray;
    // Os dois modos se somam: com a "Estrutura interna" ligada, o raio-X deixa
    // transparentes só os anéis internos e as ripas; o resto segue escondido.
    applyXray();
    applyEstruturaInterna();
  });
  var estruturaButton = document.getElementById('curvoEstruturaToolBtn');
  if (estruturaButton) estruturaButton.addEventListener('click', function () {
    if (!isActive() || !temEstruturaInterna()) return;
    estruturaInterna = !estruturaInterna;
    applyEstruturaInterna();
  });
  // Conferência (só leitura): quantas peças de cada tipo existem e estão à
  // vista, e o estado dos dois modos. Usado pelos testes de tela.
  window.__curvoPreviewResumo = function () {
    var partes = contarPartes();
    // Opacidade das peças do esqueleto à vista (1 = opaco; menor = raio-X).
    var opacidades = [];
    if (state) state.model.children.forEach(function (child) {
      var parte = child.userData && child.userData.parte;
      if (child.visible && (parte === 'anelInterno' || parte === 'ripaLigacao') && child.material) {
        opacidades.push(child.material.opacity);
      }
    });
    return {
      opacidadesEstrutura: opacidades,
      total: partes.total,
      visiveis: partes.visiveis,
      xray: xray,
      estruturaInterna: estruturaInterna,
      botaoEstrutura: estruturaButton ? estruturaButton.style.display !== 'none' : false
    };
  };
  var zoomButton = document.getElementById('ppZoomToolBtn');
  if (zoomButton) zoomButton.addEventListener('click', function () {
    if (!isActive()) return;
    zoom = 1;
    render();
  });
  var fullscreenButton = document.getElementById('ppFullscreenToolBtn');
  if (fullscreenButton) fullscreenButton.addEventListener('click', function () {
    if (!isActive() && !expanded) return;
    setExpanded(!expanded);
  });
  var backdrop = document.getElementById('curvoPreviewBackdrop');
  if (backdrop) backdrop.addEventListener('click', function () { setExpanded(false); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && expanded) setExpanded(false);
  });
  window.addEventListener('resize', resizeRenderer);

  window.__curvoPreviewSelect = function (subtype) {
    var enteringShelf = subtype === 'prateleira_dupla' && lastSelectedSubtype !== 'prateleira_dupla';
    var leavingShelf = lastSelectedSubtype === 'prateleira_dupla' && subtype !== 'prateleira_dupla';
    var enteringRoundDoor = subtype === 'porta_puxador_cava_redonda' && lastSelectedSubtype !== subtype;
    var enteringPlainDoor = subtype === 'porta_sem_puxador' && lastSelectedSubtype !== subtype;
    if (enteringShelf) xray = true;
    if (leavingShelf) xray = false;
    if (enteringRoundDoor) {
      view.yaw = -0.42;
      view.pitch = 0.28;
      zoom = 1;
    }
    if (enteringPlainDoor) {
      view.yaw = -0.42;
      view.pitch = 0.28;
      zoom = 1;
    }
    lastSelectedSubtype = subtype;
    window.clearTimeout(refreshTimer);
    if (requestController) {
      requestController.abort();
      requestController = null;
    }
    // O aviso pertence ao produto anterior: trocar de produto apaga o texto do
    // card. Sem isso um erro fica grudado na tela, porque a única outra limpeza
    // (no fim de frameModel) só roda quando o 3D consegue desenhar.
    setStatus('', false);
    if (xrayButton) xrayButton.style.display = supports3d(subtype) ? 'grid' : 'none';
    // Produto novo começa na vista completa; o botão "EI" volta a aparecer
    // quando o modelo chegar e tiver anel interno + ripa de ligação.
    estruturaInterna = false;
    if (estruturaButton) {
      estruturaButton.style.display = 'none';
      estruturaButton.classList.remove('active');
      estruturaButton.setAttribute('aria-pressed', 'false');
    }
    if (state) applyEstruturaInterna();
    if (!supports3d(subtype)) {
      if (xray) { xray = false; applyXray(); }
      if (expanded) setExpanded(false);
      return;
    }
    ensureThreeLoaded(function () {
      initScene();
      applyXray();
      if (dataBySubtype[subtype]) updateModel(dataBySubtype[subtype], subtype);
      requestAnimationFrame(resizeRenderer);
    });
    // Troca de produto/carregamento inicial é uma ação discreta (não uma
    // sequência de teclas) — não precisa dos 220ms do debounce de digitação
    // (scheduleRefresh). Mas quem chama __curvoPreviewSelect (selectProduct)
    // ainda roda código síncrono DEPOIS desta chamada que reseta campos do
    // formulário pros defaults do novo subtipo (aplicarDoorSubtypeDefaults,
    // aplicarDefaultsCurvo) - sem disparar evento input/change. Se a geometria
    // fosse pedida agora mesmo, o FormData capturaria os valores antigos
    // (do subtipo anterior) e o preview 3D ficaria incompleto/errado até o
    // usuário digitar algo. Adiar pro próximo tick garante que esse reset
    // síncrono já rodou antes do FormData ser montado.
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(requestGeometry, 0);
  };

  if (supports3d(currentSubtype()) && wrap.style.display !== 'none') {
    window.__curvoPreviewSelect(currentSubtype());
  }
})();
