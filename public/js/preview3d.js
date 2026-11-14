/**
 * CENTRAL DXF PRO - MOTOR 3D WEBGL (THREE.JS) UNIVERSAL
 * Implementação 100% idêntica e compatível com a arquitetura do Central DXF PRO.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

export class Visualizador3D {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.mainGroup = new THREE.Group();

    this.modoXRay = false;
    this.modoWireframe = false;
    this.materialAtual = 'mdf_cru';
    this.texturas = {};

    this.init();
  }

  init() {
    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8fafc);

    this.camera = new THREE.PerspectiveCamera(38, width / height, 1, 35000);
    this.camera.position.set(300, 500, 500);
    this.camera.up.set(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;

    // Iluminação idêntica ao Central DXF (clara, nítida e suave)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(800, 1200, 600);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.set(1024, 1024);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.45);
    dirLight2.position.set(-600, 500, -500);
    this.scene.add(dirLight2);

    // Piso circular suave com grid limpo e discreto
    const floorGeo = new THREE.PlaneGeometry(3500, 3500);
    floorGeo.rotateX(-Math.PI / 2);
    this.floor = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ color: 0xedf2f7, transparent: true, opacity: 0.6 }));
    this.floor.position.y = -0.5;
    this.scene.add(this.floor);

    this.grid = new THREE.GridHelper(2500, 25, 0xcfd8dc, 0xe2e8f0);
    this.grid.position.y = -0.4;
    this.scene.add(this.grid);

    this.scene.add(this.mainGroup);
    this.gerarTexturas();

    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  gerarTexturas() {
    const criarCanvasMadeira = (corBase, corVeio) => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 512;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = corBase;
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = corVeio;
      for (let y = 0; y < 512; y += 4) {
        const offset = Math.sin(y * 0.05) * 8 + (Math.random() - 0.5) * 3;
        ctx.globalAlpha = 0.15 + Math.random() * 0.1;
        ctx.fillRect(0, y + offset, 512, 2);
      }
      const texture = new THREE.CanvasTexture(cv);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      return texture;
    };

    this.texturas = {
      mdf_cru: criarCanvasMadeira('#d7ba89', '#bfa06f'),
      carvalho: criarCanvasMadeira('#c8a876', '#8c6b3e'),
      nogueira: criarCanvasMadeira('#5a3d28', '#382212'),
      freijo: criarCanvasMadeira('#a67c52', '#6e4f30'),
      branco: criarCanvasMadeira('#f3f4f6', '#e5e7eb'),
      preto: criarCanvasMadeira('#1f242d', '#11141a')
    };
  }

  obterMaterial() {
    return new THREE.MeshStandardMaterial({
      map: this.texturas[this.materialAtual] || this.texturas.mdf_cru,
      roughness: 0.72,
      metalness: 0.05,
      transparent: this.modoXRay,
      opacity: this.modoXRay ? 0.38 : 1.0,
      wireframe: this.modoWireframe,
      side: THREE.DoubleSide
    });
  }

  limparCena() {
    while (this.mainGroup.children.length > 0) {
      const obj = this.mainGroup.children[0];
      this.mainGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }
  }

  // Método exato do Central DXF para painéis horizontais (Tampas, Bases e Reforços)
  addFlatPanel(outline, zBottom, thickness, material, matEdges) {
    if (!outline || outline.length < 3) return;
    const points = outline.map(p => new THREE.Vector2(p[0], p[1]));
    const shape = new THREE.Shape(points);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 16
    });

    // Rotação exata do Central DXF: deita no plano X-Z
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = zBottom;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mainGroup.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), matEdges);
    edges.position.y = zBottom;
    this.mainGroup.add(edges);
  }

  // Método com encaixe perfeito para ripas verticais estruturais
  addRipa(rect, height, material, matEdges, thickness) {
    const width = rect.x1 - rect.x0;
    const depth = rect.y1 - rect.y0;
    if (!(width > 0 && depth > 0 && height > 0)) return;

    // Altura útil entre base e topo para evitar colisão visual
    const altUtil = thickness ? Math.max(10, height - 2 * thickness) : height;
    const posY = thickness ? height / 2 : height / 2;

    const geometry = new THREE.BoxGeometry(width, altUtil, depth);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(rect.x0 + width / 2, posY, -(rect.y0 + depth / 2));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mainGroup.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), matEdges);
    edges.position.copy(mesh.position);
    this.mainGroup.add(edges);
  }

  // Método exato do Central DXF para a parede curva externa (front_path)
  addWall(data, material, matEdges) {
    const path = data.front_path || [];
    const count = path.length;
    if (count < 2) return;
    const thickness = data.espessura_mdf || 18;
    const flexThickness = Math.max(0.5, Math.min(thickness, Number(data.espessura_flex) || 2));
    const height = data.altura || 400;
    const normals = [];
    const pathDistances = [0];

    for (let i = 0; i < count; i++) {
      const previous = path[Math.max(0, i - 1)];
      const next = path[Math.min(count - 1, i + 1)];
      const tx = next[0] - previous[0];
      const ty = next[1] - previous[1];
      const length = Math.hypot(tx, ty) || 1;
      normals.push([-ty / length, tx / length]);
      if (i > 0) {
        pathDistances.push(pathDistances[i - 1] + Math.hypot(
          path[i][0] - path[i - 1][0],
          path[i][1] - path[i - 1][1]
        ));
      }
    }
    const totalPathLength = Math.max(pathDistances[pathDistances.length - 1], 1);

    const positions = [];
    const indices = [];
    const uvs = [];

    function quad(a, b, c, d, u0, u1) {
      const base = positions.length / 3;
      [a, b, c, d].forEach(p => positions.push(p[0], p[1], p[2]));
      uvs.push(u0, 0, u0, 1, u1, 1, u1, 0);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    function segmentIsFlex(idx) {
      if (data.front_flex_ranges) {
        return data.front_flex_ranges.some(r => idx >= r[0] && idx < r[1]);
      }
      return (data.front_flex_start_idx !== undefined) && (idx >= data.front_flex_start_idx && idx < data.front_flex_end_idx);
    }

    for (let i = 0; i < count - 1; i++) {
      const p0 = path[i];
      const p1 = path[i + 1];
      const n0 = normals[i];
      const n1 = normals[i + 1];

      // Determinar se este segmento pertence à zona curva desbastada (flex)
      const isFlex = segmentIsFlex(i);
      const localThickness = isFlex ? flexThickness : thickness;

      // Vértices externos faceados
      const outB0 = [p0[0], 0, -p0[1]];
      const outT0 = [p0[0], height, -p0[1]];
      const outB1 = [p1[0], 0, -p1[1]];
      const outT1 = [p1[0], height, -p1[1]];

      // Vértices internos deslocados estritamente para o interior do móvel (+ normal)
      const inB0 = [p0[0] + n0[0] * localThickness, 0, -(p0[1] + n0[1] * localThickness)];
      const inT0 = [p0[0] + n0[0] * localThickness, height, -(p0[1] + n0[1] * localThickness)];
      const inB1 = [p1[0] + n1[0] * localThickness, 0, -(p1[1] + n1[1] * localThickness)];
      const inT1 = [p1[0] + n1[0] * localThickness, height, -(p1[1] + n1[1] * localThickness)];

      const u0 = pathDistances[i] / totalPathLength;
      const u1 = pathDistances[i + 1] / totalPathLength;

      // Face externa (normal orientada para fora do móvel)
      quad(outB0, outB1, outT1, outT0, u0, u1);
      // Face interna (normal orientada para o interior)
      quad(inB1, inB0, inT0, inT1, u1, u0);
      // Topo (normal orientada para cima +Y)
      quad(outT0, outT1, inT1, inT0, u0, u1);
      // Base (normal orientada para baixo -Y)
      quad(outB1, outB0, inB0, inB1, u1, u0);
    }

    // Tampa na extremidade inicial do painel (x=0, y=0)
    const pStart = path[0];
    const nStart = normals[0];
    const thStart = segmentIsFlex(0) ? flexThickness : thickness;
    const sOutB = [pStart[0], 0, -pStart[1]];
    const sOutT = [pStart[0], height, -pStart[1]];
    const sInB = [pStart[0] + nStart[0] * thStart, 0, -(pStart[1] + nStart[1] * thStart)];
    const sInT = [pStart[0] + nStart[0] * thStart, height, -(pStart[1] + nStart[1] * thStart)];
    quad(sInB, sOutB, sOutT, sInT, 0, 0);

    // Tampa na extremidade final do painel (x=W, y=D)
    const pEnd = path[count - 1];
    const nEnd = normals[count - 1];
    const thEnd = segmentIsFlex(count - 2) ? flexThickness : thickness;
    const eOutB = [pEnd[0], 0, -pEnd[1]];
    const eOutT = [pEnd[0], height, -pEnd[1]];
    const eInB = [pEnd[0] + nEnd[0] * thEnd, 0, -(pEnd[1] + nEnd[1] * thEnd)];
    const eInT = [pEnd[0] + nEnd[0] * thEnd, height, -(pEnd[1] + nEnd[1] * thEnd)];
    quad(eOutB, eInB, eInT, eOutT, 1, 1);

    // Degraus de transição entre a aba cheia e o miolo desbastado flex
    for (let i = 1; i < count - 1; i++) {
      if (segmentIsFlex(i - 1) === segmentIsFlex(i)) continue;

      const point = path[i];
      const normal = normals[i];
      const fInB = [point[0] + normal[0] * flexThickness, 0, -(point[1] + normal[1] * flexThickness)];
      const fInT = [fInB[0], height, fInB[2]];
      const fullInB = [point[0] + normal[0] * thickness, 0, -(point[1] + normal[1] * thickness)];
      const fullInT = [fullInB[0], height, fullInB[2]];
      quad(fInB, fullInB, fullInT, fInT, 0, 0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mainGroup.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), matEdges);
    this.mainGroup.add(edges);
  }

  atualizarGeometria(resultado) {
    this.limparCena();
    if (!resultado) return;
    this.ultimoResultado = resultado;

    const { largura, altura, espessura, produto } = resultado;
    const material = this.obterMaterial();
    const matEdges = new THREE.LineBasicMaterial({ color: 0x0f172a });

    // =======================================================================
    // CASO 1: CANTO CURVO SIMPLES / PARAFUSADO (MOTOR IDÊNTICO CENTRAL DXF)
    // =======================================================================
    if (resultado.curvoSimplesData) {
      const data = resultado.curvoSimplesData;
      const thickness = Number(data.espessura_mdf) || 18;
      const height = Number(data.altura) || 400;

      // 1. Painéis horizontais (Base e Topo)
      const levels = data.estrutura_z || [0, height - thickness];
      levels.forEach(z => {
        this.addFlatPanel(data.top_outline, z, thickness, material, matEdges);
      });

      // 2. Prateleira / Reforço intermediário (com rebaixo perimétrico)
      if (data.reforco_outline && data.reforco_z) {
        data.reforco_z.forEach(z => {
          this.addFlatPanel(data.reforco_outline, z, thickness, material, matEdges);
        });
      }

      // 3. Ripas verticais estruturais internas ajustadas
      (data.ripas || []).forEach(rect => {
        this.addRipa(rect, height, material, matEdges, thickness);
      });

      // 4. Travessas traseiras estruturais (sustentação e fechamento)
      (data.travessasTraseiras || []).forEach(tr => {
        const w = tr.x1 - tr.x0;
        const d = tr.y1 - tr.y0;
        const h = tr.altura || 50;
        const geo = new THREE.BoxGeometry(w, h, d);
        const m = new THREE.Mesh(geo, material);
        m.position.set(tr.x0 + w / 2, tr.z + h / 2, -(tr.y0 + d / 2));
        this.mainGroup.add(m);
        const ed = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), matEdges);
        ed.position.copy(m.position);
        this.mainGroup.add(ed);
      });

      // 5. Parede curva externa fechando a frente e o raio
      this.addWall(data, material, matEdges);

      // Centralizar e ajustar piso dinamicamente
      this.frameModel();
      return;
    }

    // =======================================================================
    // CASO 2: PÉS ESPECIAIS (CÔNICO, OVAL, REDONDO, OBLONGO, CÔNICO QUADRADO)
    // =======================================================================
    if (resultado.pes3D) {
      const pes = resultado.pes3D;
      const alt = resultado.altura || 700;
      const esp = resultado.espessura || 18;

      if (produto === 'pe_conico') {
        const { diamBase, diamTopo } = resultado;

        // Anel da base
        const meshBase = new THREE.Mesh(
          new THREE.CylinderGeometry(diamBase / 2, diamBase / 2, esp, 48, 1, true),
          material
        );
        meshBase.position.y = esp / 2;
        this.mainGroup.add(meshBase);
        this.mainGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(meshBase.geometry, 20), matEdges));

        // Anel do topo
        const meshTopo = new THREE.Mesh(
          new THREE.CylinderGeometry(diamTopo / 2, diamTopo / 2, esp, 48, 1, true),
          material
        );
        meshTopo.position.y = alt - esp / 2;
        this.mainGroup.add(meshTopo);
        this.mainGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(meshTopo.geometry, 20), matEdges));

        // Ripas verticais do cone
        for (const r of pes) {
          const xB = Math.cos(r.angulo) * r.rBase;
          const zB = Math.sin(r.angulo) * r.rBase;
          const xT = Math.cos(r.angulo) * r.rTopo;
          const zT = Math.sin(r.angulo) * r.rTopo;
          const ripaGeom = new THREE.BoxGeometry(r.esp, r.alt - 2 * esp, r.esp);
          const meshRipa = new THREE.Mesh(ripaGeom, material);
          meshRipa.position.set((xB + xT) / 2, alt / 2, (zB + zT) / 2);
          meshRipa.rotation.y = -r.angulo;
          this.mainGroup.add(meshRipa);
          this.mainGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(ripaGeom, 20), matEdges));
        }

      } else if (produto === 'pe_oval') {
        // Pé oval: elipse usando CylinderGeometry deformada via scale
        const { largura: compBase, espessura: espOval } = resultado;
        const largBase = resultado.largBase || compBase * 0.65;
        const scaleX = compBase / 2;
        const scaleZ = largBase / 2;

        const meshBaseOval = new THREE.Mesh(
          new THREE.CylinderGeometry(1, 1, espOval, 48),
          material
        );
        meshBaseOval.scale.set(scaleX, 1, scaleZ);
        meshBaseOval.position.y = espOval / 2;
        this.mainGroup.add(meshBaseOval);

        const meshTopoOval = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85, 0.85, espOval, 48),
          material
        );
        meshTopoOval.scale.set(scaleX * 0.85, 1, scaleZ * 0.85);
        meshTopoOval.position.y = alt - espOval / 2;
        this.mainGroup.add(meshTopoOval);

        for (const r of pes) {
          const xB = Math.cos(r.angulo) * r.a;
          const zB = Math.sin(r.angulo) * r.b;
          const ripaGeom = new THREE.BoxGeometry(espOval, r.alt - 2 * espOval, espOval);
          const meshRipa = new THREE.Mesh(ripaGeom, material);
          meshRipa.position.set(xB * 0.9, alt / 2, zB * 0.9);
          meshRipa.rotation.y = -r.angulo;
          this.mainGroup.add(meshRipa);
        }

      } else {
        // pe_redondo, pe_oblongo, pe_conico_quadrado — fallback cilíndrico genérico
        const diam = resultado.largura || 400;
        const meshGen = new THREE.Mesh(
          new THREE.CylinderGeometry(diam / 2, diam / 2 * 1.1, alt, 48),
          material
        );
        meshGen.position.y = alt / 2;
        this.mainGroup.add(meshGen);
        this.mainGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(meshGen.geometry, 20), matEdges));

        for (const r of pes) {
          const ang = r.angulo;
          const rx = r.rBase || diam / 2 * 0.9;
          const rz = r.b || rx;
          const ripaGeom = new THREE.BoxGeometry(r.esp || esp, r.alt - 2 * esp, r.esp || esp);
          const meshRipa = new THREE.Mesh(ripaGeom, material);
          meshRipa.position.set(Math.cos(ang) * rx * 0.9, alt / 2, Math.sin(ang) * rz * 0.9);
          meshRipa.rotation.y = -ang;
          this.mainGroup.add(meshRipa);
        }
      }

      this.frameModel();
      return;
    }

    // =======================================================================
    // CASO 3: PAINEL PARAMÉTRICO WAVE (LÂMINAS ONDULADAS 3D)
    // =======================================================================
    if (produto === 'painel_parametrico' && resultado.laminas3D) {
      const cx = -largura / 2;
      const cy = -altura / 2;

      for (const lam of resultado.laminas3D) {
        const shapeLam = new THREE.Shape();
        shapeLam.moveTo(0, 0);
        shapeLam.lineTo(resultado.profundidade, 0);
        for (const pt of lam.pontos) {
          shapeLam.lineTo(pt.z, pt.y);
        }
        shapeLam.lineTo(0, altura);
        shapeLam.closePath();

        const geomLam = new THREE.ExtrudeGeometry(shapeLam, { depth: lam.esp, bevelEnabled: false });
        geomLam.rotateY(Math.PI / 2);
        const meshLam = new THREE.Mesh(geomLam, material);
        meshLam.position.set(cx + lam.x, cy, 0);
        this.mainGroup.add(meshLam);
      }
      this.frameModel();
      return;
    }

    // =======================================================================
    // CASO 4: MUXARABI ENCAIXADO (RIPAS MEIA-MADEIRA)
    // =======================================================================
    if (produto === 'muxarabi_encaixado' && resultado.ripas3D) {
      const cx = -largura / 2;
      const cy = -altura / 2;

      for (const r of resultado.ripas3D) {
        const wR = r.x1 - r.x0;
        const hR = r.y1 - r.y0;
        const profR = r.prof || 40;
        const geom = new THREE.BoxGeometry(wR, hR, profR);
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(cx + (r.x0 + r.x1) / 2, cy + (r.y0 + r.y1) / 2, profR / 2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.mainGroup.add(mesh);

        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 20), matEdges);
        edges.position.copy(mesh.position);
        this.mainGroup.add(edges);
      }
      this.frameModel();
      return;
    }

    // =======================================================================
    // CASO GERAL: EXTRUSÃO PARAMÉTRICA COM FUROS PASSANTES E REBAIXOS
    // =======================================================================
    const cx = -largura / 2;
    const cy = -altura / 2;

    const shape = new THREE.Shape();
    if (resultado.pontosOrganicos && resultado.pontosOrganicos.length > 0) {
      const pts = resultado.pontosOrganicos;
      shape.moveTo(cx + pts[0].x, cy + pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        shape.lineTo(cx + pts[i].x, cy + pts[i].y);
      }
      shape.closePath();
    } else {
      shape.moveTo(cx, cy);
      shape.lineTo(cx + largura, cy);
      shape.lineTo(cx + largura, cy + altura);
      shape.lineTo(cx, cy + altura);
      shape.closePath();
    }

    for (const b of resultado.buracos3D || []) {
      const hole = new THREE.Path();
      if (b.tipo === 'retangulo') {
        hole.moveTo(cx + b.x0, cy + b.y0);
        hole.lineTo(cx + b.x1, cy + b.y0);
        hole.lineTo(cx + b.x1, cy + b.y1);
        hole.lineTo(cx + b.x0, cy + b.y1);
        hole.closePath();
      } else if (b.tipo === 'circulo') {
        hole.absarc(cx + b.cx, cy + b.cy, b.r, 0, Math.PI * 2, true);
      }
      shape.holes.push(hole);
    }

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: espessura,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 2,
      curveSegments: 24
    });

    const painelMesh = new THREE.Mesh(geom, material);
    painelMesh.castShadow = true;
    painelMesh.receiveShadow = true;
    this.mainGroup.add(painelMesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 25), matEdges);
    this.mainGroup.add(edges);

    for (const r of resultado.ripas3D || []) {
      const geomRipa = new THREE.BoxGeometry(r.x1 - r.x0, r.y1 - r.y0, r.alt);
      const meshRipa = new THREE.Mesh(geomRipa, material);
      meshRipa.position.set(cx + (r.x0 + r.x1) / 2, cy + (r.y0 + r.y1) / 2, espessura + r.alt / 2);
      this.mainGroup.add(meshRipa);
    }

    for (const reb of resultado.rebaixos3D || []) {
      if (reb.tipo === 'rebaixo_retangular') {
        const gReb = new THREE.BoxGeometry(reb.x1 - reb.x0, reb.y1 - reb.y0, reb.prof);
        const mReb = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 });
        const meshR = new THREE.Mesh(gReb, mReb);
        meshR.position.set(cx + (reb.x0 + reb.x1) / 2, cy + (reb.y0 + reb.y1) / 2, espessura - reb.prof / 2 + 0.1);
        this.mainGroup.add(meshR);
        const edR = new THREE.LineSegments(new THREE.EdgesGeometry(gReb, 15), matEdges);
        edR.position.copy(meshR.position);
        this.mainGroup.add(edR);
      } else if (reb.tipo === 'rebaixo_circular') {
        const gCirc = new THREE.CylinderGeometry(reb.r, reb.r, reb.prof, 32);
        gCirc.rotateX(Math.PI / 2);
        const mCirc = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 });
        const meshC = new THREE.Mesh(gCirc, mCirc);
        meshC.position.set(cx + reb.cx, cy + reb.cy, espessura - reb.prof / 2 + 0.1);
        this.mainGroup.add(meshC);
        const edC = new THREE.LineSegments(new THREE.EdgesGeometry(gCirc, 15), matEdges);
        edC.position.copy(meshC.position);
        this.mainGroup.add(edC);
      }
    }

    this.frameModel();
  }

  frameModel() {
    const box = new THREE.Box3().setFromObject(this.mainGroup);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 200);

    // Ajusta o piso para ficar SEMPRE abaixo da base da peça (sem atravessar o meio!)
    if (this.grid) {
      this.grid.position.set(center.x, box.min.y - 0.5, center.z);
      const gridScale = Math.max(maxDim / 800, 0.5);
      this.grid.scale.set(gridScale, 1, gridScale);
    }

    this.controls.target.copy(center);
    const dist = maxDim * 1.5;
    this.camera.position.set(center.x + dist * 0.65, center.y + dist * 0.45, center.z + dist * 0.9);
    this.camera.lookAt(center);
    this.controls.update();
  }

  mudarMaterial(nome) {
    this.materialAtual = nome;
    const mat = this.obterMaterial();
    this.mainGroup.traverse(obj => {
      if (obj.isMesh && obj.material.map !== undefined) {
        obj.material = mat;
      }
    });
  }

  toggleXRay() {
    this.modoXRay = !this.modoXRay;
    this.mudarMaterial(this.materialAtual);
    return this.modoXRay;
  }

  toggleWireframe() {
    this.modoWireframe = !this.modoWireframe;
    this.mainGroup.traverse(obj => {
      if (obj.isMesh) obj.material.wireframe = this.modoWireframe;
    });
    return this.modoWireframe;
  }

  resetarCamera() {
    this.frameModel();
  }

  vistaFrontal() {
    const box = new THREE.Box3().setFromObject(this.mainGroup);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 200);
    this.controls.target.copy(center);
    this.camera.position.set(center.x, center.y, center.z + maxDim * 1.6);
    this.camera.lookAt(center);
    this.controls.update();
  }

  onWindowResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }
}
