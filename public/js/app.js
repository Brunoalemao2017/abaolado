/**
 * CENTRAL DXF PRO - CONTROLADOR PRINCIPAL DA PLATAFORMA
 * Suporte completo ao catálogo industrial, histórico persistente, roteamento de URL e renderização 3D/2D.
 */

import { AlgoritmosCNC } from './algorithms.js';
import { Visualizador3D } from './preview3d.js';
import { Visualizador2D } from './preview2d.js';
import { gerarDXFTexto, baixarArquivoDXF } from './dxf-generator.js';

// Catálogo Completo de Categorias e Subprodutos do Central DXF PRO
const CATALOGO = {
  canto_curvo: {
    nome: 'Canto Curvo',
    icone: '◜',
    produtos: [
      { id: 'curvo_simples', nome: 'Curvo Simples', desc: 'Móvel curvo montado 3D com tampo, base, ripas e casca flexível.', thumb: '/static/canto_curvo_simples.jpg', icone: '◜' },
      { id: 'curvo_simples_parafusado', nome: 'Curvo Parafusado', desc: 'Com furação escareada para fixação rápida.', thumb: '/static/canto_curvo_simples.jpg', icone: '🔩' },
      { id: 'curvo_duplo', nome: 'Curvo Duplo', desc: 'Dupla curvatura em "S" com pontes intermediárias.', thumb: '/static/canto_curvo_duplo.jpg', icone: '〰' }
    ]
  },
  portas: {
    nome: 'Portas',
    icone: '🚪',
    produtos: [
      { id: 'porta_cava_quadrada', nome: 'Cava Quadrada', desc: 'Puxador cava retangular usinado no topo ou lateral.', thumb: '/static/porta_cava_quadrada.jpg', icone: '🚪' },
      { id: 'porta_cava_longa', nome: 'Cava Longa', desc: 'Puxador contínuo longitudinal em toda a extensão.', thumb: '/static/porta_cava_longa.jpg', icone: '▬' },
      { id: 'porta_cava_redonda', nome: 'Cava Redonda', desc: 'Puxador circular cava usinada tipo finger-pull.', thumb: '/static/porta_cava_redonda.svg', icone: '⭕' },
      { id: 'porta_sem_puxador', nome: 'Sem Puxador', desc: 'Porta lisa com usinagem padrão de dobradiças 35mm.', thumb: '/static/porta_cava_quadrada.jpg', icone: '▯' }
    ]
  },
  prateleiras: {
    nome: 'Prateleiras',
    icone: '📚',
    produtos: [
      { id: 'prateleira_dupla', nome: 'Prateleira Dupla', desc: 'Peças espelhadas com furação oculta para cavilhas.', thumb: '/static/prateleira_dupla.png', icone: '📚' }
    ]
  },
  muxarabi: {
    nome: 'Muxarabi',
    icone: '▦',
    produtos: [
      { id: 'painel_muxarabi', nome: 'Muxarabi Usinado', desc: 'Grade vazada retangular pronta para corte passante.', thumb: '/static/muxarabi_usinado_thumb.jpg', icone: '▦' },
      { id: 'muxarabi_encaixado', nome: 'Muxarabi Encaixado', desc: 'Ripas meia-madeira com dog-bones para encaixe perfeito.', thumb: '/static/muxarabi_encaixado_thumb.jpg', icone: '⧉' },
      { id: 'muxarabi_usinado_redondo', nome: 'Muxarabi Redondo', desc: 'Chapa perfurada com furos circulares em grade ou colmeia.', thumb: '/static/muxarabi_redondo_thumb.jpg', icone: '⚬' }
    ]
  },
  paineis: {
    nome: 'Painéis',
    icone: '▤',
    produtos: [
      { id: 'painel_ripado_cavilhado', nome: 'Ripado Cavilhado', desc: 'Fundo + ripas espaçadas com pinos guia automatizados.', thumb: '/static/ripado_cavilha_thumb.jpg', icone: '▤' },
      { id: 'painel_parametrico', nome: 'Painel Paramétrico', desc: 'Relevo ondulado 3D wave com fatias senoidais.', thumb: '/static/cone_eliptico_thumb.jpg', icone: '🌊' }
    ]
  },
  pes_especiais: {
    nome: 'Pés Especiais',
    icone: '🏺',
    produtos: [
      { id: 'pe_conico', nome: 'Pé Cônico Ripada', desc: 'Base cônica para mesas com ripas estruturais.', thumb: '/static/pe_cone_thumb.jpg', icone: '🏺' },
      { id: 'pe_oval', nome: 'Pé Oval', desc: 'Base ripada para mesas de jantar ovais.', thumb: '/static/pe_oval_thumb.jpg', icone: '🥚' },
      { id: 'pe_redondo', nome: 'Pé Redondo', desc: 'Base cilíndrica ripada circular.', thumb: '/static/pe_redondo_thumb.jpg', icone: '⚪' },
      { id: 'pe_oblongo', nome: 'Pé Oblongo', desc: 'Base oblonga com curvaturas nas extremidades.', thumb: '/static/pe_oblongo_thumb.jpg', icone: '⬯' },
      { id: 'pe_conico_quadrado', nome: 'Pé Cônico Quadrado', desc: 'Base tronco-piramidal ripada.', thumb: '/static/pe_conico_quadrado_thumb.jpg', icone: '⯃' }
    ]
  },
  personalizadas: {
    nome: 'Peças Personalizadas',
    icone: '⭐',
    produtos: [
      { id: 'tampo_organico', nome: 'Tampo Orgânico', desc: 'Mesa de centro com curvas fluidas e sem quinas vivas.', thumb: '/static/textura_melamina_nogueira.jpg', icone: '🥔' }
    ]
  }
};

class CentralDXFApp {
  constructor() {
    this.categoriaAtual = 'canto_curvo';
    this.produtoAtual = 'curvo_simples';
    this.tabAtual = 'medidas';
    this.viewMode = '3d';

    this.resultadoCalculo = null;
    this.numVaosXSelecionado = null;
    this.numVaosYSelecionado = null;

    this.filaLote = [];
    this.historico = [];
    this.debounceTimer = null;

    this.init();
  }

  async init() {
    const canvas3d = document.getElementById('curvoPreviewCanvas') || document.getElementById('canvas3d');
    const canvas2d = document.getElementById('curvoPreview2DCanvas') || document.getElementById('canvas2d');

    this.view3d = new Visualizador3D(canvas3d);
    this.view2d = new Visualizador2D(canvas2d);

    this.carregarDadosPersistentes();
    this.lerParametrosURL();
    this.vincularEventos();

    this.renderizarAbasCategorias();
    this.renderizarGradeSubprodutos();
    this.renderizarFormulario();
    this.recalcular();
    this.atualizarTabelaHistorico();
  }

  carregarDadosPersistentes() {
    try {
      this.historico = JSON.parse(localStorage.getItem('central_dxf_historico') || '[]');
      this.filaLote = JSON.parse(localStorage.getItem('central_dxf_lote') || '[]');
    } catch (e) {
      this.historico = [];
      this.filaLote = [];
    }
    this.atualizarKPIs();
  }

  salvarDadosPersistentes() {
    localStorage.setItem('central_dxf_historico', JSON.stringify(this.historico));
    localStorage.setItem('central_dxf_lote', JSON.stringify(this.filaLote));
    this.atualizarKPIs();
  }

  atualizarKPIs() {
    const elArquivos = document.getElementById('kpiArquivosVal') || document.getElementById('kpiTotalArquivos');
    if (elArquivos) elArquivos.textContent = this.historico.length;

    const elQueue = document.getElementById('queueBadge') || document.getElementById('headerQueueCount');
    if (elQueue) elQueue.textContent = this.filaLote.length;

    const horas = ((this.historico.length * 18) / 60).toFixed(1);
    const elTempo = document.getElementById('kpiTempoVal') || document.getElementById('kpiTempoEconomizado');
    if (elTempo) elTempo.textContent = `~${horas}h`;
  }

  lerParametrosURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const prodParam = urlParams.get('produto');
    if (prodParam) {
      for (const catKey in CATALOGO) {
        const achou = CATALOGO[catKey].produtos.find(p => p.id === prodParam || prodParam.includes(p.id));
        if (achou) {
          this.categoriaAtual = catKey;
          this.produtoAtual = achou.id;
          break;
        }
      }
    }
  }

  vincularEventos() {
    // Links da sidebar lateral escura
    document.querySelectorAll('.app-sidebar .nav-link[data-nav]').forEach(item => {
      item.addEventListener('click', () => {
        this.selecionarCategoria(item.dataset.nav);
      });
    });

    // Botões de categoria na barra horizontal (estilo Central DXF)
    document.querySelectorAll('#sel-produto .btn-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selecionarCategoria(btn.dataset.cat);
      });
    });

    // Abas de formulário (Medidas, Folgas, Avançado, Presets, Lote)
    document.querySelectorAll('#generatorTabs .tab, .form-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#generatorTabs .tab, .form-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tabAtual = btn.dataset.tab;
        const badge = document.getElementById('formTabBadge');
        if (badge) badge.textContent = btn.textContent;
        this.renderizarFormulario();
      });
    });

    // Botões de ação principais
    document.getElementById('btnGerarDXFPrincipal')?.addEventListener('click', () => this.gerarEDescarregarDXF());
    document.getElementById('btnPreview2DTrigger')?.addEventListener('click', () => this.alternarModoVisualizacao('2d'));
    document.getElementById('btnRelatorioTrigger')?.addEventListener('click', () => this.abrirModalRelatorio());
    document.getElementById('btnAdicionarLoteTrigger')?.addEventListener('click', () => this.adicionarAoLote());

    // Alternadores 3D / 2D CAD
    document.getElementById('btnToggle3D')?.addEventListener('click', () => this.alternarModoVisualizacao('3d'));
    document.getElementById('btnToggle2D')?.addEventListener('click', () => this.alternarModoVisualizacao('2d'));

    // Botões flutuantes da câmera (idênticos ao Central DXF)
    const btnRotate = document.getElementById('previewRotateToolBtn') || document.getElementById('btnResetCamera');
    btnRotate?.addEventListener('click', () => this.view3d.resetarCamera());

    const btnFrontal = document.getElementById('previewFrontalToolBtn') || document.getElementById('btnFrontalCamera');
    btnFrontal?.addEventListener('click', () => this.view3d.vistaFrontal());

    const btnXRay = document.getElementById('curvoXrayToolBtn') || document.getElementById('btnXRayToggle');
    btnXRay?.addEventListener('click', (e) => {
      const active = this.view3d.toggleXRay();
      e.currentTarget.classList.toggle('active', active);
    });

    const btnZoom = document.getElementById('ppZoomToolBtn');
    btnZoom?.addEventListener('click', () => this.view3d.resetarCamera());

    const btnFullscreen = document.getElementById('ppFullscreenToolBtn') || document.getElementById('btnFullscreenToggle');
    btnFullscreen?.addEventListener('click', () => this.toggleFullscreen());

    // Seletor de Acabamento / Textura de Madeira
    document.getElementById('selectAcabamento')?.addEventListener('change', (e) => {
      this.view3d.mudarMaterial(e.target.value);
    });

    // Modal de Configurações CNC
    const btnConta = document.getElementById('navContaBtn') || document.getElementById('sidebarBtnConta');
    btnConta?.addEventListener('click', () => {
      const m = document.getElementById('modalConfigCNC');
      if (m) m.style.display = 'flex';
    });

    const btnCncTop = document.getElementById('btnConfigCncTrigger');
    btnCncTop?.addEventListener('click', () => {
      const m = document.getElementById('modalConfigCNC');
      if (m) m.style.display = 'flex';
    });

    document.getElementById('btnSalvarConfigCNC')?.addEventListener('click', () => {
      alert('Configurações da Router CNC salvas com sucesso!');
      const m = document.getElementById('modalConfigCNC');
      if (m) m.style.display = 'none';
    });

    // Fechamento de Modais
    document.querySelectorAll('.modal-close, .ux-modal-backdrop').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ux-modal, .modal-backdrop').forEach(m => m.style.display = 'none');
      });
    });

    // Busca e Limpeza do Histórico
    document.getElementById('historySearchInput')?.addEventListener('input', (e) => {
      this.filtrarHistorico(e.target.value);
    });
    document.getElementById('btnClearHistory')?.addEventListener('click', () => {
      if (confirm('Deseja limpar todo o histórico de peças geradas?')) {
        this.historico = [];
        this.salvarDadosPersistentes();
        this.atualizarTabelaHistorico();
      }
    });

    document.getElementById('btnCopiarDxfClipboard')?.addEventListener('click', () => {
      const code = document.getElementById('dxfCodeBox')?.textContent || '';
      navigator.clipboard.writeText(code);
      alert('Código DXF copiado!');
    });
    document.getElementById('btnDownloadDxfFromModal')?.addEventListener('click', () => {
      this.gerarEDescarregarDXF();
    });
  }

  selecionarCategoria(catKey) {
    this.categoriaAtual = catKey;
    const cat = CATALOGO[catKey];
    if (cat && cat.produtos.length > 0) {
      this.produtoAtual = cat.produtos[0].id;
    }
    this.numVaosXSelecionado = null;
    this.numVaosYSelecionado = null;

    this.renderizarAbasCategorias();
    this.renderizarGradeSubprodutos();
    this.renderizarFormulario();
    this.recalcular();
  }

  selecionarProduto(prodId) {
    this.produtoAtual = prodId;
    this.numVaosXSelecionado = null;
    this.numVaosYSelecionado = null;

    document.querySelectorAll('#sel-subtipo .btn-sub, .subproduct-card').forEach(c => {
      const match = (c.dataset.sub === prodId) || (c.dataset.prodId === prodId);
      c.classList.toggle('ativo', match);
      c.classList.toggle('active', match);
    });

    const url = new URL(window.location);
    url.searchParams.set('produto', prodId);
    window.history.replaceState({}, '', url);

    this.renderizarFormulario();
    this.recalcular();
  }

  renderizarAbasCategorias() {
    document.querySelectorAll('#sel-produto .btn-cat').forEach(btn => {
      btn.classList.toggle('ativo', btn.dataset.cat === this.categoriaAtual);
    });
    document.querySelectorAll('.app-sidebar .nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === this.categoriaAtual);
    });
  }

  renderizarGradeSubprodutos() {
    const container = document.getElementById('sel-subtipo') || document.getElementById('subproductsGrid');
    if (!container) return;
    container.innerHTML = '';
    const cat = CATALOGO[this.categoriaAtual];
    if (!cat) return;

    cat.produtos.forEach(prod => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-sub ${prod.id === this.produtoAtual ? 'ativo' : ''}`;
      btn.dataset.sub = prod.id;
      btn.style.marginRight = '8px';
      btn.style.marginBottom = '6px';
      
      let imgHtml = '';
      if (prod.thumb) {
        imgHtml = `<img src="${prod.thumb}" alt="" style="width:26px;height:26px;object-fit:cover;border-radius:4px;margin-right:8px;vertical-align:middle;display:inline-block;">`;
      } else {
        imgHtml = `<span style="font-size:16px;margin-right:8px;vertical-align:middle;">${prod.icone}</span>`;
      }
      btn.innerHTML = `${imgHtml}<span style="vertical-align:middle;">${prod.nome}</span>`;
      btn.addEventListener('click', () => this.selecionarProduto(prod.id));
      container.appendChild(btn);
    });
  }

  renderizarFormulario() {
    const container = document.getElementById('formBody');
    const titleElem = document.getElementById('page_title') || document.getElementById('generatorTitle');
    const subtitleElem = document.getElementById('page_lead') || document.getElementById('generatorSubtitle');

    const cat = CATALOGO[this.categoriaAtual];
    const prod = cat ? cat.produtos.find(p => p.id === this.produtoAtual) : null;
    if (prod) {
      if (titleElem) titleElem.textContent = prod.nome;
      if (subtitleElem) subtitleElem.textContent = prod.desc;
    }

    if (this.tabAtual === 'folgas') {
      container.innerHTML = `
        <div class="form-group">
          <label>Diâmetro da fresa de corte</label>
          <div class="input-with-unit">
            <input type="number" id="inp_diamFresa" value="6" min="1" max="25">
            <span class="unit-tag">mm</span>
          </div>
        </div>
        <div class="form-group">
          <label>Folga de encaixe / montagem</label>
          <div class="input-with-unit">
            <input type="number" id="inp_folga" value="0.2" step="0.1" min="0">
            <span class="unit-tag">mm</span>
          </div>
        </div>
        <div class="form-group">
          <label>Profundidade do rebaixo</label>
          <div class="input-with-unit">
            <input type="number" id="inp_profRebaixo" value="6">
            <span class="unit-tag">mm</span>
          </div>
        </div>
        <div class="form-group">
          <label>Espessura restante (pele flexível)</label>
          <div class="input-with-unit">
            <input type="number" id="inp_espessuraRestante" value="2">
            <span class="unit-tag">mm</span>
          </div>
        </div>
      `;
      this.vincularListenersInputs(container);
      return;
    }

    if (this.tabAtual === 'avancado') {
      container.innerHTML = `
        <div class="form-group">
          <label>Versão AutoCAD DXF</label>
          <select id="inp_versaoDxf">
            <option value="R12" selected>AutoCAD R12 ASCII (Recomendado CAM)</option>
            <option value="2000">AutoCAD 2000</option>
          </select>
        </div>
        <div class="form-group">
          <label>Camada de Corte Passante</label>
          <input type="text" value="CORTE" readonly style="background: #1e293b; color: #ef4444; font-weight: 700; padding: 8px; border-radius: 6px; border: 1px solid #374151;">
        </div>
        <div class="form-group">
          <label>Camada de Rebaixos / Cavas</label>
          <input type="text" value="USINAGEM" readonly style="background: #1e293b; color: #10b981; font-weight: 700; padding: 8px; border-radius: 6px; border: 1px solid #374151;">
        </div>
        <div class="form-group">
          <label>Camada de Dobra / Kerfing</label>
          <input type="text" value="FRESAGEM_DOBRA" readonly style="background: #1e293b; color: #f59e0b; font-weight: 700; padding: 8px; border-radius: 6px; border: 1px solid #374151;">
        </div>
      `;
      return;
    }

    if (this.tabAtual === 'presets') {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <p style="color:#64748b; font-size:12px; margin-bottom:4px;">Presets salvos para reutilização rápida de configurações frequentes.</p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <button class="btn secondary" style="text-align:left; padding:10px 12px; border-radius:8px;" onclick="window.app.selecionarCategoria('canto_curvo')">
              <strong style="font-size:12px; display:block;">Curvo 400×400 R100</strong>
              <span style="font-size:11px; color:#94a3b8;">Padrão marcenaria</span>
            </button>
            <button class="btn secondary" style="text-align:left; padding:10px 12px; border-radius:8px;" onclick="window.app.selecionarCategoria('portas')">
              <strong style="font-size:12px; display:block;">Porta Cava 500×700</strong>
              <span style="font-size:11px; color:#94a3b8;">Padrão cozinha</span>
            </button>
            <button class="btn secondary" style="text-align:left; padding:10px 12px; border-radius:8px;" onclick="window.app.selecionarCategoria('muxarabi')">
              <strong style="font-size:12px; display:block;">Muxarabi 800×1200</strong>
              <span style="font-size:11px; color:#94a3b8;">Divisória moderna</span>
            </button>
            <button class="btn secondary" style="text-align:left; padding:10px 12px; border-radius:8px;" onclick="window.app.selecionarCategoria('prateleiras')">
              <strong style="font-size:12px; display:block;">Prateleira 800mm</strong>
              <span style="font-size:11px; color:#94a3b8;">Dupla com cavilha</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (this.tabAtual === 'lote') {
      let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
      if (this.filaLote.length === 0) {
        html += '<p style="color: #64748b; font-size: 12px; text-align: center; padding: 20px;">Nenhuma peça na fila. Clique em "➕ Lote" para enfileirar.</p>';
      } else {
        this.filaLote.forEach((it, idx) => {
          html += `
            <div style="background:#172236; border:1px solid #273549; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:white; font-size:12px;">${idx + 1}. ${it.nome}</strong>
                <p style="color:#94a3b8; font-size:11px;">${it.largura}x${it.altura}mm | MDF ${it.espessura}mm</p>
              </div>
              <button class="btn-secondary" style="padding:2px 6px; font-size:11px;" onclick="window.app.removerItemLote(${it.id})">✕</button>
            </div>
          `;
        });
        html += `
          <button class="btn-dxf-main" style="margin-top:12px;" onclick="window.app.baixarLoteZip()">
            📦 Baixar Lote Completo (.ZIP)
          </button>
        `;
      }
      html += '</div>';
      container.innerHTML = html;
      return;
    }

    // ABA MEDIDAS - CANTO CURVO SIMPLES / PARAFUSADO / DUPLO
    if (this.produtoAtual.includes('curvo')) {
      const isDuplo = this.produtoAtual === 'curvo_duplo';
      const isParaf = this.produtoAtual === 'curvo_simples_parafusado';
      const defW = isDuplo ? 400 : 200;
      const defD = 300;
      const defR = 80;
      const abaLabel = isDuplo ? 'Frente central (L − 2R)' : 'Aba de encaixe (L − R)';
      const abaVal = isDuplo ? `${defW - 2 * defR} mm` : `${defW - defR} mm`;

      container.innerHTML = `
        <div id="boxAvisoGeometria" style="display:none; margin-bottom:12px; background:rgba(245, 158, 11, 0.15); border:1px solid #f59e0b; color:#fbbf24; border-radius:6px; padding:8px 12px; font-size:12px; line-height:1.4;"></div>
        ${isParaf ? '<div style="margin-bottom:12px; background:rgba(56, 189, 248, 0.12); border:1px solid #38bdf8; color:#38bdf8; border-radius:6px; padding:6px 10px; font-size:11px;">🔩 <strong>Modo Parafusado Ativo:</strong> Furações escareadas de Ø4.5mm geradas automaticamente nas ripas e tampos.</div>' : ''}
        ${isDuplo ? '<div style="margin-bottom:12px; background:rgba(168, 85, 247, 0.12); border:1px solid #a855f7; color:#c084fc; border-radius:6px; padding:6px 10px; font-size:11px;">〰 <strong>Modo Curvo Duplo:</strong> Dois cantos arredondados simétricos com zonas duplas de flex/usinagem.</div>' : ''}
        <div class="input-row">
          <div class="form-group">
            <label>Largura (Frente)</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="${defW}" min="50" max="2500"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Profundidade (Lateral)</label>
            <div class="input-with-unit"><input type="number" id="inp_profundidade" value="${defD}" min="50" max="2500"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Altura do móvel</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="400" min="50" max="3000"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Raio nominal (R)</label>
            <div class="input-with-unit"><input type="number" id="inp_raio" value="${defR}" min="10" max="1000"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Espessura MDF</label>
            <div class="input-with-unit">
              <select id="inp_espessura">
                <option value="15">15 mm</option>
                <option value="18" selected>18 mm</option>
                <option value="25">25 mm</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>${abaLabel}</label>
            <div class="input-with-unit"><input type="text" id="inp_abaEncaixe" value="${abaVal}" readonly style="background:#1e293b; color:#38bdf8; font-weight:700;"></div>
          </div>
        </div>
        <div class="form-group">
          <label>Sistema de Montagem</label>
          <select id="inp_metodo">
            <option value="rebaixo" selected>Com rebaixo (Usinagem nas tampas)</option>
            <option value="kerfing">Com fresagens para dobra (Kerfing)</option>
          </select>
        </div>
        <div class="form-group" style="flex-direction:row; align-items:center; gap:8px;">
          <input type="checkbox" id="inp_gerarReforco" checked style="width:18px; height:18px; accent-color:#38bdf8;">
          <label for="inp_gerarReforco" style="cursor:pointer; font-size:12px;">Gerar prateleira / reforço intermediário</label>
        </div>
      `;
    } else if (this.produtoAtual === 'painel_muxarabi') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura total</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="800"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura total</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="1200"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Espessura do MDF</label>
          <select id="inp_espessura">
            <option value="6">6 mm</option><option value="9">9 mm</option><option value="12">12 mm</option>
            <option value="15" selected>15 mm</option><option value="18">18 mm</option><option value="25">25 mm</option>
          </select>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Vão na largura (X)</label>
            <div class="input-with-unit"><input type="number" id="inp_vaoX" value="60"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Vão na altura (Y)</label>
            <div class="input-with-unit"><input type="number" id="inp_vaoY" value="60"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Entre-vãos (Ripa)</label>
            <div class="input-with-unit"><input type="number" id="inp_entreVaos" value="10"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Margem nas bordas</label>
            <div class="input-with-unit"><input type="number" id="inp_margem" value="0"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Modo de Distribuição</label>
          <select id="inp_modo">
            <option value="dividido_igualmente" selected>Dividido igualmente (vãos proporcionais)</option>
            <option value="sobra_nos_cantos">Sobra nos cantos (vão nominal fixo)</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-size:11px; color:#94a3b8;">Opções na Largura (X):</label>
          <div style="display:flex; flex-wrap:wrap; gap:4px;" id="chipsSugestoesX"></div>
        </div>
        <div class="form-group">
          <label style="font-size:11px; color:#94a3b8;">Opções na Altura (Y):</label>
          <div style="display:flex; flex-wrap:wrap; gap:4px;" id="chipsSugestoesY"></div>
        </div>
      `;
    } else if (this.produtoAtual === 'muxarabi_encaixado') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura total</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="1000"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura total</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="800"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Largura da ripa H</label>
            <div class="input-with-unit"><input type="number" id="inp_larguraRipaH" value="40"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Largura da ripa V</label>
            <div class="input-with-unit"><input type="number" id="inp_larguraRipaV" value="40"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Espessura do MDF</label>
            <div class="input-with-unit"><input type="number" id="inp_espessura" value="18"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Vão desejado</label>
            <div class="input-with-unit"><input type="number" id="inp_vaoX" value="150"><span class="unit-tag">mm</span></div>
          </div>
        </div>
      `;
    } else if (this.produtoAtual === 'porta_cava_quadrada') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="500"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="700"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Espessura MDF</label>
            <div class="input-with-unit">
              <select id="inp_espessura">
                <option value="15">15 mm</option>
                <option value="18" selected>18 mm</option>
                <option value="25">25 mm</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Qtd. Dobradiças</label>
            <select id="inp_dobradicas">
              <option value="2" selected>2 Dobradiças</option>
              <option value="3">3 Dobradiças</option>
              <option value="4">4 Dobradiças</option>
            </select>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Largura da cava retangular</label>
            <div class="input-with-unit"><input type="number" id="inp_larguraCava" value="140"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura da cava (recuo)</label>
            <div class="input-with-unit"><input type="number" id="inp_alturaCava" value="35"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Profundidade do rebaixo da cava</label>
          <div class="input-with-unit"><input type="number" id="inp_profCava" value="12"><span class="unit-tag">mm</span></div>
        </div>
      `;
    } else if (this.produtoAtual === 'porta_cava_longa') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="500"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="700"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Espessura MDF</label>
            <div class="input-with-unit">
              <select id="inp_espessura">
                <option value="15">15 mm</option>
                <option value="18" selected>18 mm</option>
                <option value="25">25 mm</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Qtd. Dobradiças</label>
            <select id="inp_dobradicas">
              <option value="2" selected>2 Dobradiças</option>
              <option value="3">3 Dobradiças</option>
              <option value="4">4 Dobradiças</option>
            </select>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Altura da cava (topo)</label>
            <div class="input-with-unit"><input type="number" id="inp_alturaCava" value="35"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Profundidade do rebaixo</label>
            <div class="input-with-unit"><input type="number" id="inp_profCava" value="12"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <p style="font-size:11.5px; color:#94a3b8; margin:4px 0 0 0;">ℹ️ Cava longitudinal contínua usinada em toda a extensão da largura da porta.</p>
      `;
    } else if (this.produtoAtual === 'porta_cava_redonda') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="500"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="700"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Espessura MDF</label>
            <div class="input-with-unit">
              <select id="inp_espessura">
                <option value="15">15 mm</option>
                <option value="18" selected>18 mm</option>
                <option value="25">25 mm</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Qtd. Dobradiças</label>
            <select id="inp_dobradicas">
              <option value="2" selected>2 Dobradiças</option>
              <option value="3">3 Dobradiças</option>
              <option value="4">4 Dobradiças</option>
            </select>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Diâmetro da cava circular</label>
            <div class="input-with-unit"><input type="number" id="inp_diametroCava" value="50"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Profundidade do rebaixo</label>
            <div class="input-with-unit"><input type="number" id="inp_profCava" value="12"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <p style="font-size:11.5px; color:#94a3b8; margin:4px 0 0 0;">ℹ️ Puxador tipo finger-pull circular usinado no topo da folha.</p>
      `;
    } else if (this.produtoAtual === 'porta_sem_puxador') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="500"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura da porta</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="700"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Espessura MDF</label>
            <div class="input-with-unit">
              <select id="inp_espessura">
                <option value="15">15 mm</option>
                <option value="18" selected>18 mm</option>
                <option value="25">25 mm</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Qtd. Dobradiças</label>
            <select id="inp_dobradicas">
              <option value="2" selected>2 Dobradiças</option>
              <option value="3">3 Dobradiças</option>
              <option value="4">4 Dobradiças</option>
            </select>
          </div>
        </div>
        <p style="font-size:11.5px; color:#94a3b8; margin:4px 0 0 0;">ℹ️ Porta lisa com corte e furação padrão 35mm para dobradiças (fecho-toque ou puxador externo).</p>
      `;
    } else if (this.produtoAtual === 'muxarabi_usinado_redondo') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura total</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="800"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura total</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="1200"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Diâmetro dos furos</label>
            <div class="input-with-unit"><input type="number" id="inp_diametro" value="50"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Entre-furos</label>
            <div class="input-with-unit"><input type="number" id="inp_entreVaos" value="15"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Margem nas bordas</label>
            <div class="input-with-unit"><input type="number" id="inp_margem" value="40"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Espessura do MDF</label>
            <div class="input-with-unit">
              <select id="inp_espessura">
                <option value="6">6 mm</option><option value="9">9 mm</option><option value="12">12 mm</option>
                <option value="15" selected>15 mm</option><option value="18">18 mm</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Padrão de Distribuição</label>
          <select id="inp_padrao">
            <option value="grade" selected>Grade alinhada (matriz retangular)</option>
            <option value="colmeia">Colmeia (linhas alternadas 60°)</option>
          </select>
        </div>
      `;
    } else if (this.produtoAtual === 'painel_ripado_cavilhado') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura total</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="900"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura total</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="1800"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Largura da ripa</label>
            <div class="input-with-unit"><input type="number" id="inp_larguraRipa" value="30"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Espaçamento entre ripas</label>
            <div class="input-with-unit"><input type="number" id="inp_espacamento" value="15"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Espessura do fundo MDF</label>
          <div class="input-with-unit"><input type="number" id="inp_espessura" value="15"><span class="unit-tag">mm</span></div>
        </div>
      `;
    } else if (this.produtoAtual === 'painel_parametrico') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura total</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="1600"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura total</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="900"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Profundidade do relevo (onda)</label>
            <div class="input-with-unit"><input type="number" id="inp_profundidade" value="200"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Espessura de cada lâmina</label>
            <div class="input-with-unit"><input type="number" id="inp_espLamina" value="18"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Espaçamento entre lâminas</label>
          <div class="input-with-unit"><input type="number" id="inp_espacamento" value="30"><span class="unit-tag">mm</span></div>
        </div>
      `;
    } else if (this.produtoAtual === 'tampo_organico') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Comprimento maior</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="1200"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Largura menor</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="800"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Espessura da chapa MDF</label>
          <div class="input-with-unit"><input type="number" id="inp_espessura" value="25"><span class="unit-tag">mm</span></div>
        </div>
      `;
    } else if (this.produtoAtual === 'prateleira_dupla') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Comprimento</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="800"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Profundidade</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="250"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Espessura MDF</label>
            <div class="input-with-unit"><input type="number" id="inp_espessura" value="18"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Diâmetro Cavilha</label>
            <div class="input-with-unit"><input type="number" id="inp_diamCavilha" value="8"><span class="unit-tag">mm</span></div>
          </div>
        </div>
      `;
    } else if (this.produtoAtual === 'pe_conico') {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Diâmetro na base</label>
            <div class="input-with-unit"><input type="number" id="inp_diamBase" value="550"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Diâmetro no topo</label>
            <div class="input-with-unit"><input type="number" id="inp_diamTopo" value="350"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Altura do pé</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="700"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Qtd. de ripas</label>
            <div class="input-with-unit"><input type="number" id="inp_numRipas" value="16"><span class="unit-tag">un</span></div>
          </div>
        </div>
      `;
    } else if (this.produtoAtual === 'pe_oval' || this.produtoAtual === 'pe_redondo' || this.produtoAtual === 'pe_oblongo' || this.produtoAtual === 'pe_conico_quadrado') {
      const labNomes = { pe_oval: 'Oval', pe_redondo: 'Redondo', pe_oblongo: 'Oblongo', pe_conico_quadrado: 'Cônico Quadrado' };
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Comprimento da base</label>
            <div class="input-with-unit"><input type="number" id="inp_compBase" value="700"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Largura da base</label>
            <div class="input-with-unit"><input type="number" id="inp_largBase" value="450"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Altura do pé</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="720"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Qtd. de ripas</label>
            <div class="input-with-unit"><input type="number" id="inp_numRipas" value="24"><span class="unit-tag">un</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Espessura MDF</label>
          <div class="input-with-unit"><input type="number" id="inp_espessura" value="18"><span class="unit-tag">mm</span></div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="input-row">
          <div class="form-group">
            <label>Largura</label>
            <div class="input-with-unit"><input type="number" id="inp_largura" value="900"><span class="unit-tag">mm</span></div>
          </div>
          <div class="form-group">
            <label>Altura</label>
            <div class="input-with-unit"><input type="number" id="inp_altura" value="1200"><span class="unit-tag">mm</span></div>
          </div>
        </div>
        <div class="form-group">
          <label>Espessura</label>
          <div class="input-with-unit"><input type="number" id="inp_espessura" value="15"><span class="unit-tag">mm</span></div>
        </div>
      `;
    }

    this.vincularListenersInputs(container);
  }

  vincularListenersInputs(container) {
    container.querySelectorAll('input, select').forEach(elem => {
      elem.addEventListener('input', () => {
        if (elem.id === 'inp_vaoX' || elem.id === 'inp_largura') this.numVaosXSelecionado = null;
        if (elem.id === 'inp_vaoY' || elem.id === 'inp_altura') this.numVaosYSelecionado = null;
        // Atualização em tempo real da aba de encaixe com limites de raio
        if (this.produtoAtual.includes('curvo')) {
          const l = Math.max(50, parseFloat(document.getElementById('inp_largura')?.value) || 200);
          const d = Math.max(50, parseFloat(document.getElementById('inp_profundidade')?.value) || 300);
          const r = parseFloat(document.getElementById('inp_raio')?.value) || 80;
          const isDuplo = this.produtoAtual === 'curvo_duplo';
          const rMax = isDuplo ? Math.max(10, Math.min(Math.floor((l - 20) / 2), d - 10)) : Math.max(10, Math.min(l - 10, d - 10));
          const rEfetivo = Math.max(10, Math.min(r, rMax));
          const abaEl = document.getElementById('inp_abaEncaixe');
          if (abaEl) {
            abaEl.value = isDuplo ? `${Math.max(10, l - 2 * rEfetivo)} mm` : `${Math.max(10, l - rEfetivo)} mm`;
          }
        }
        this.agendarRecalculo();
      });
      elem.addEventListener('change', () => this.agendarRecalculo());
    });
  }

  agendarRecalculo() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.recalcular(), 100);
  }

  coletarParametros() {
    const params = {
      produto: this.produtoAtual,
      numVaosX: this.numVaosXSelecionado,
      numVaosY: this.numVaosYSelecionado
    };
    document.querySelectorAll('#formBody input, #formBody select').forEach(elem => {
      const chave = elem.id.replace('inp_', '');
      if (elem.type === 'checkbox') {
        params[chave] = elem.checked;
      } else {
        params[chave] = elem.value;
      }
    });
    return params;
  }

  recalcular() {
    const params = this.coletarParametros();
    let res = null;

    if (this.produtoAtual === 'curvo_simples') {
      res = AlgoritmosCNC.calcularCurvoSimples(params);
    } else if (this.produtoAtual === 'curvo_simples_parafusado') {
      res = AlgoritmosCNC.calcularCurvoParafusado(params);
    } else if (this.produtoAtual === 'curvo_duplo') {
      res = AlgoritmosCNC.calcularCurvoDuplo(params);
    } else if (this.produtoAtual === 'painel_muxarabi') {
      res = AlgoritmosCNC.calcularMuxarabi(params);
      this.atualizarChipsSugestao(res);
    } else if (this.produtoAtual === 'muxarabi_encaixado') {
      res = AlgoritmosCNC.calcularMuxarabiEncaixado(params);
    } else if (this.produtoAtual === 'muxarabi_usinado_redondo') {
      res = AlgoritmosCNC.calcularMuxarabiRedondo(params);
    } else if (this.produtoAtual.includes('porta')) {
      res = AlgoritmosCNC.calcularPortaCava(params);
    } else if (this.produtoAtual === 'prateleira_dupla') {
      res = AlgoritmosCNC.calcularPrateleiraDupla(params);
    } else if (this.produtoAtual === 'painel_ripado_cavilhado') {
      res = AlgoritmosCNC.calcularPainelRipado(params);
    } else if (this.produtoAtual === 'painel_parametrico') {
      res = AlgoritmosCNC.calcularPainelParametrico(params);
    } else if (this.produtoAtual === 'pe_conico') {
      res = AlgoritmosCNC.calcularPeConico(params);
    } else if (this.produtoAtual === 'pe_oval' || this.produtoAtual === 'pe_redondo' || this.produtoAtual === 'pe_oblongo' || this.produtoAtual === 'pe_conico_quadrado') {
      res = AlgoritmosCNC.calcularPeOval(params);
    } else if (this.produtoAtual === 'tampo_organico') {
      res = AlgoritmosCNC.calcularTampoOrganico(params);
    } else {
      res = AlgoritmosCNC.calcularCurvoSimples(params);
    }
    if (!res) return;
    this.resultadoCalculo = res;

    // Alerta reativo de validação geométrica
    const avisoBox = document.getElementById('boxAvisoGeometria');
    if (avisoBox) {
      if (res.curvoSimplesData && res.curvoSimplesData.aviso_validacao) {
        avisoBox.style.display = 'block';
        avisoBox.innerHTML = `⚠️ <strong>Validação CNC:</strong> ${res.curvoSimplesData.aviso_validacao}`;
      } else {
        avisoBox.style.display = 'none';
        avisoBox.innerHTML = '';
      }
    }

    this.view3d.atualizarGeometria(res);
    if (this.viewMode === '2d') {
      this.view2d.atualizarGeometria(res);
    }

    const elArea = document.getElementById('metricArea');
    const elPerim = document.getElementById('metricPerimetro');
    const elTempo = document.getElementById('metricTempo');
    if (elArea) elArea.textContent = `${res.relatorio.areaTotalM2} m²`;
    if (elPerim) elPerim.textContent = `${res.relatorio.perimetroCorteMetros} m`;
    if (elTempo) elTempo.textContent = `~${res.relatorio.tempoEstimadoMinutos} min`;
  }

  atualizarChipsSugestao(res) {
    const containerX = document.getElementById('chipsSugestoesX');
    const containerY = document.getElementById('chipsSugestoesY');
    if (!containerX || !containerY) return;

    containerX.innerHTML = '';
    (res.sugestoesX || []).forEach(s => {
      const btn = document.createElement('button');
      btn.className = `tool-btn ${s.num === res.numX ? 'active' : ''}`;
      btn.style.fontSize = '11px';
      btn.style.padding = '3px 6px';
      btn.textContent = `${s.num} vãos — ${s.vao} mm`;
      btn.addEventListener('click', () => {
        this.numVaosXSelecionado = s.num;
        this.recalcular();
      });
      containerX.appendChild(btn);
    });

    containerY.innerHTML = '';
    (res.sugestoesY || []).forEach(s => {
      const btn = document.createElement('button');
      btn.className = `tool-btn ${s.num === res.numY ? 'active' : ''}`;
      btn.style.fontSize = '11px';
      btn.style.padding = '3px 6px';
      btn.textContent = `${s.num} vãos — ${s.vao} mm`;
      btn.addEventListener('click', () => {
        this.numVaosYSelecionado = s.num;
        this.recalcular();
      });
      containerY.appendChild(btn);
    });
  }

  alternarModoVisualizacao(modo) {
    this.viewMode = modo;
    const canvas3d = document.getElementById('curvoPreviewCanvas') || document.getElementById('canvas3d');
    const canvas2d = document.getElementById('curvoPreview2DCanvas') || document.getElementById('canvas2d');
    const btn3d = document.getElementById('btnToggle3D');
    const btn2d = document.getElementById('btnToggle2D');

    if (modo === '3d') {
      if (canvas3d) canvas3d.style.display = 'block';
      if (canvas2d) canvas2d.style.display = 'none';
      if (btn3d) btn3d.classList.add('active');
      if (btn2d) btn2d.classList.remove('active');
      if (canvas3d) this.view3d.onWindowResize();
    } else {
      if (canvas3d) canvas3d.style.display = 'none';
      if (canvas2d) canvas2d.style.display = 'block';
      if (btn2d) btn2d.classList.add('active');
      if (btn3d) btn3d.classList.remove('active');
      if (this.resultadoCalculo) {
        this.view2d.atualizarGeometria(this.resultadoCalculo);
      }
    }
  }

  toggleFullscreen() {
    const el = document.querySelector('.viewport-card');
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  gerarEDescarregarDXF() {
    if (!this.resultadoCalculo) return;
    const nome = `${this.produtoAtual}_${this.resultadoCalculo.largura}x${this.resultadoCalculo.altura}mm.dxf`;
    const dxfTexto = gerarDXFTexto(this.resultadoCalculo);
    baixarArquivoDXF(nome, dxfTexto);

    const itemHistorico = {
      id: Date.now(),
      nome,
      produto: this.produtoAtual,
      dimensoes: `${this.resultadoCalculo.largura} x ${this.resultadoCalculo.altura} mm`,
      material: `MDF ${this.resultadoCalculo.espessura}mm`,
      camadas: this.resultadoCalculo.camadas.length,
      data: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      geometria: this.resultadoCalculo
    };
    this.historico.unshift(itemHistorico);
    if (this.historico.length > 50) this.historico.pop();
    this.salvarDadosPersistentes();
    this.atualizarTabelaHistorico();
  }

  atualizarTabelaHistorico() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (this.historico.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Nenhuma peça gerada ainda no histórico. Clique em "🚀 GERAR DXF AGORA".</td></tr>';
      return;
    }

    this.historico.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:white;">${it.nome}</strong></td>
        <td>${it.dimensoes}</td>
        <td><span style="background:#1e293b; color:#38bdf8; padding:2px 6px; border-radius:4px; font-size:11px;">${it.material}</span></td>
        <td>${it.camadas} entidades</td>
        <td>${it.data}</td>
        <td style="text-align:right;">
          <button class="btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="window.app.recarregarDoHistorico(${it.id})">⬇ Baixar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  recarregarDoHistorico(id) {
    const item = this.historico.find(x => x.id === id);
    if (item) {
      const dxf = gerarDXFTexto(item.geometria);
      baixarArquivoDXF(item.nome, dxf);
    }
  }

  filtrarHistorico(termo) {
    const t = termo.toLowerCase();
    document.querySelectorAll('#historyTableBody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(t) ? '' : 'none';
    });
  }

  adicionarAoLote() {
    if (!this.resultadoCalculo) return;
    const item = {
      id: Date.now(),
      nome: `${this.produtoAtual}_${this.resultadoCalculo.largura}x${this.resultadoCalculo.altura}`,
      largura: this.resultadoCalculo.largura,
      altura: this.resultadoCalculo.altura,
      espessura: this.resultadoCalculo.espessura,
      geometria: this.resultadoCalculo
    };
    this.filaLote.push(item);
    this.salvarDadosPersistentes();
    alert(`Peça "${item.nome}" adicionada à fila de lote!`);
  }

  removerItemLote(id) {
    this.filaLote = this.filaLote.filter(x => x.id !== id);
    this.salvarDadosPersistentes();
    this.renderizarFormulario();
  }

  async baixarLoteZip() {
    if (this.filaLote.length === 0) return;
    try {
      const response = await fetch('/api/dxf/batch-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: this.filaLote })
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lote_producao_cnc_${this.filaLote.length}_pecas.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert(`Erro ao gerar ZIP do lote: ${e.message}`);
    }
  }

  abrirModalRelatorio() {
    if (!this.resultadoCalculo) return;
    const r = this.resultadoCalculo.relatorio;
    document.getElementById('relatorioModalContent').innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid #1e293b;">
          <h4 style="color:#38bdf8; margin-bottom:6px;">📊 Métricas da Peça</h4>
          <p>Dimensões: ${this.resultadoCalculo.largura} x ${this.resultadoCalculo.altura} x ${this.resultadoCalculo.espessura} mm</p>
          <p>Área Total da Chapa: ${r.areaTotalM2} m²</p>
          <p>Aproveitamento de Material: ${r.aproveitamentoPorcento || '100'}%</p>
        </div>
        <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid #1e293b;">
          <h4 style="color:#10b981; margin-bottom:6px;">⚙️ Usinagem CNC</h4>
          <p>Perímetro Linear Total de Corte: ${r.perimetroCorteMetros} metros</p>
          <p>Tempo Estimado de Máquina: ~${r.tempoEstimadoMinutos} minutos</p>
        </div>
      </div>
    `;
    document.getElementById('modalRelatorioCorte').style.display = 'flex';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new CentralDXFApp();
});
