(function () {
  "use strict";

  if (!window.THREE) return;

  const state = {
    panel: null,
    stage: null,
    empty: null,
    structureStatus: null,
    renderer: null,
    scene: null,
    camera: null,
    root: null,
    model: null,
    structureGroup: null,
    backdrop: null,
    fullscreen: false,
    xray: false,
    structuresVisible: true,
    // Vista explodida das Cambotas Empilhadas: afasta as camadas na vertical.
    explodido: false,
    yaw: -0.72,
    pitch: -0.42,
    zoom: 1,
    baseDistance: 900,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    updateFrame: 0,
    renderFrame: 0,
    resizeObserver: null,
    texture: null,
    rawMdfTexture: null,
    grooveAudit: [],
    viewMode: null,
  };

  const clamp3d = (value, min, max) => Math.max(min, Math.min(max, value));
  const number3d = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function makePanel() {
    if (state.panel) return state.panel;

    const panel = document.createElement("div");
    panel.className = "org3d-card";
    panel.innerHTML = [
      '<div class="org3d-stage">',
      '  <div class="org3d-title">Preview 3D</div>',
      '  <div class="org3d-actions">',
      '    <button type="button" class="org3d-btn" data-action="reset" title="Redefinir visualização">↻</button>',
      '    <button type="button" class="org3d-btn org3d-text-btn" data-action="xray" title="Ativar raio X" aria-pressed="false">XR</button>',
      '    <button type="button" class="org3d-btn org3d-text-btn active" data-action="structures" title="Ocultar estruturas" aria-pressed="true">EST</button>',
      '    <button type="button" class="org3d-btn org3d-text-btn" data-action="explodir" title="Vista explodida: afasta as cambotas" aria-pressed="false" style="display:none;">EXP</button>',
      '    <button type="button" class="org3d-btn" data-action="fullscreen" title="Abrir em tela cheia">⛶</button>',
      "  </div>",
      '  <div class="org3d-status">Calculando estruturas…</div>',
      '  <div class="org3d-hint">Arraste para girar · roda para zoom</div>',
      '  <div class="org3d-empty">Crie uma curva com pelo menos dois nós para visualizar a peça.</div>',
      "</div>",
    ].join("");

    state.panel = panel;
    state.stage = panel.querySelector(".org3d-stage");
    state.empty = panel.querySelector(".org3d-empty");
    state.structureStatus = panel.querySelector(".org3d-status");

    state.stage.addEventListener("pointerdown", onPointerDown);
    state.stage.addEventListener("pointermove", onPointerMove);
    state.stage.addEventListener("pointerup", onPointerUp);
    state.stage.addEventListener("pointercancel", onPointerUp);
    state.stage.addEventListener("wheel", onWheel, { passive: false });
    panel.querySelector('[data-action="reset"]').addEventListener("click", function (event) {
      event.stopPropagation();
      resetView();
    });
    panel.querySelector('[data-action="xray"]').addEventListener("click", function (event) {
      event.stopPropagation();
      state.xray = !state.xray;
      applyDisplayModes();
    });
    panel.querySelector('[data-action="structures"]').addEventListener("click", function (event) {
      event.stopPropagation();
      state.structuresVisible = !state.structuresVisible;
      applyDisplayModes();
    });
    // Empilhado x Explodido (§19 das Cambotas). Só aparece no modo cambotas —
    // nas outras peças não existe pilha para afastar.
    panel.querySelector('[data-action="explodir"]').addEventListener("click", function (event) {
      event.stopPropagation();
      state.explodido = !state.explodido;
      event.currentTarget.classList.toggle("active", state.explodido);
      event.currentTarget.setAttribute("aria-pressed", state.explodido ? "true" : "false");
      scheduleUpdate();
    });
    panel.querySelector('[data-action="fullscreen"]').addEventListener("click", function (event) {
      event.stopPropagation();
      toggleFullscreen();
    });

    ensureScene();
    return panel;
  }

  function syncCambotaButtons() {
    if (!state.panel) return;
    const ehCambotas = typeof _activeMode !== "undefined" && _activeMode === "cambotas";
    const btn = state.panel.querySelector('[data-action="explodir"]');
    if (btn) btn.style.display = ehCambotas ? "" : "none";
    // EST liga e desliga as estruturas da peça orgânica (a que se dobra). Nas
    // Cambotas não existe estrutura desse tipo: o botão sai só lá.
    const est = state.panel.querySelector('[data-action="structures"]');
    if (est) est.style.display = ehCambotas ? "none" : "";
  }

  function ensureScene() {
    if (state.renderer) return;

    try {
      state.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (e) {
      if (window.avisoWebGL) window.avisoWebGL(state.stage, e);
      state.renderer = null;
      return;
    }
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    state.renderer.outputColorSpace = THREE.SRGBColorSpace;
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    state.stage.insertBefore(state.renderer.domElement, state.stage.firstChild);

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0xeef2f7);

    state.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100000);
    state.root = new THREE.Group();
    state.scene.add(state.root);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x718096, 2.25);
    state.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.35);
    key.position.set(-700, 1100, 850);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    state.scene.add(key);
    state.keyLight = key;

    const fill = new THREE.DirectionalLight(0xc7dcff, 1.15);
    fill.position.set(850, 420, -650);
    state.scene.add(fill);

    // Rebote do piso: sem ele as faces voltadas para baixo (fundo do tampo,
    // base dos engrossos) ficam pretas e escondem furos e emendas.
    const bounce = new THREE.DirectionalLight(0xffeede, 0.75);
    bounce.position.set(260, -820, 380);
    state.scene.add(bounce);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/static/textura_melamina_nogueira.jpg",
      function (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2.2, 1.6);
        texture.anisotropy = Math.min(8, state.renderer.capabilities.getMaxAnisotropy());
        state.texture = texture;
        scheduleUpdate();
      },
      undefined,
      function () {
        state.texture = null;
        requestRender();
      }
    );

    if (window.ResizeObserver) {
      state.resizeObserver = new ResizeObserver(resizeRenderer);
      state.resizeObserver.observe(state.panel);
    }
    window.addEventListener("resize", resizeRenderer);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.fullscreen) toggleFullscreen(false);
    });
  }

  /**
   * O frustum padrão da luz direcional cobre 10 unidades — nada perto de uma
   * peça de 900 mm, e por isso nenhuma sombra chegava ao chão. Ajusta o
   * volume de sombra ao tamanho real do modelo a cada reconstrução.
   */
  function fitShadowCamera(size) {
    const light = state.keyLight;
    if (!light || !size) return;
    const radius = Math.max(
      60,
      Math.hypot(size.x || 0, size.y || 0, size.z || 0) * 0.5
    );
    const extent = radius * 1.3;
    const shadowCamera = light.shadow.camera;
    shadowCamera.left = -extent;
    shadowCamera.right = extent;
    shadowCamera.top = extent;
    shadowCamera.bottom = -extent;
    shadowCamera.near = extent * 0.4;
    shadowCamera.far = extent * 8;
    shadowCamera.updateProjectionMatrix();
    light.shadow.bias = -0.0009;
    light.shadow.normalBias = Math.max(0.4, radius * 0.003);
    const direction = new THREE.Vector3(-700, 1100, 850).normalize();
    light.position.copy(direction.multiplyScalar(extent * 2.6));
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
  }

  function disposeObject(object) {
    const geometries = new Set();
    const materialsSeen = new Set();
    object.traverse(function (child) {
      if (child.geometry && !geometries.has(child.geometry)) {
        geometries.add(child.geometry);
        child.geometry.dispose();
      }
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(function (material) {
          if (!materialsSeen.has(material)) {
            materialsSeen.add(material);
            material.dispose();
          }
        });
      }
    });
  }

  function clearModel() {
    if (!state.model) return;
    state.root.remove(state.model);
    // O modelo velho só é descartado DEPOIS que o novo for desenhado. Descartar
    // antes zerava o uso dos shaders, o three.js os apagava e compilava tudo de
    // novo a cada recálculo — era a maior parte da demora do 3D. Desenhado o
    // novo, os shaders já estão em uso por ele e o descarte não os apaga.
    state.descartar = state.descartar || [];
    state.descartar.push(state.model);
    // Painel escondido não desenha: não deixar a lista crescer sem fim.
    while (state.descartar.length > 2) disposeObject(state.descartar.shift());
    state.model = null;
    state.structureGroup = null;
    requestRender();
  }

  function descartarModelosVelhos() {
    if (!state.descartar || !state.descartar.length) return;
    const velhos = state.descartar;
    state.descartar = [];
    velhos.forEach(disposeObject);
  }

  function cumulative(points, closed) {
    const lengths = [0];
    const segmentCount = closed ? points.length : points.length - 1;
    let total = 0;
    for (let i = 0; i < segmentCount; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      total += Math.hypot(b[0] - a[0], b[1] - a[1]);
      lengths.push(total);
    }
    return { lengths: lengths, total: total, segmentCount: segmentCount };
  }

  function pointAtDistance(points, closed, distance, knownData) {
    const data = knownData || cumulative(points, closed);
    if (data.total < 1e-7) return points[0].slice();
    let target = distance;
    if (closed) target = ((target % data.total) + data.total) % data.total;
    else target = clamp3d(target, 0, data.total);

    for (let i = 0; i < data.segmentCount; i += 1) {
      const start = data.lengths[i];
      const end = data.lengths[i + 1];
      if (target <= end + 1e-8 || i === data.segmentCount - 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const ratio = end > start ? (target - start) / (end - start) : 0;
        return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
      }
    }
    return points[points.length - 1].slice();
  }

  function resample(points, count, closed) {
    if (!Array.isArray(points) || points.length < 2) return [];
    const data = cumulative(points, closed);
    if (data.total < 1e-7) return [];
    const output = [];
    const denominator = closed ? count : Math.max(1, count - 1);
    for (let i = 0; i < count; i += 1) {
      output.push(pointAtDistance(points, closed, data.total * i / denominator));
    }
    return output;
  }

  function closestFractionOnPath(points, closed, target) {
    const data = cumulative(points, closed);
    let bestDistance = Infinity;
    let bestArc = 0;
    for (let index = 0; index < data.segmentCount; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared > 1e-12
        ? clamp3d(((target[0] - a[0]) * dx + (target[1] - a[1]) * dy) / lengthSquared, 0, 1)
        : 0;
      const px = a[0] + dx * t;
      const py = a[1] + dy * t;
      const distance = Math.hypot(px - target[0], py - target[1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestArc = data.lengths[index] + Math.sqrt(lengthSquared) * t;
      }
    }
    return data.total > 1e-8 ? bestArc / data.total : 0;
  }

  function lineFractionOnPath(points, closed, origin, direction) {
    const data = cumulative(points, closed);
    let best = null;
    for (let index = 0; index < data.segmentCount; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const segment = [b[0] - a[0], b[1] - a[1]];
      const denominator = direction[0] * segment[1] - direction[1] * segment[0];
      if (Math.abs(denominator) < 1e-10) continue;
      const delta = [a[0] - origin[0], a[1] - origin[1]];
      const lineDistance = (delta[0] * segment[1] - delta[1] * segment[0]) / denominator;
      const segmentFraction = (delta[0] * direction[1] - delta[1] * direction[0]) / denominator;
      if (segmentFraction < -1e-7 || segmentFraction > 1 + 1e-7) continue;
      if (!best || Math.abs(lineDistance) < Math.abs(best.lineDistance)) {
        const segmentLength = Math.hypot(segment[0], segment[1]);
        best = {
          lineDistance: lineDistance,
          fraction: data.total > 1e-8
            ? (data.lengths[index] + segmentLength * clamp3d(segmentFraction, 0, 1)) / data.total
            : 0,
        };
      }
    }
    return best;
  }

  function grooveGuidesForPath(path, closed, fractions) {
    const data = cumulative(path, closed);
    if (data.total < 1e-8) return [];
    const sampleDistance = Math.max(0.35, Math.min(1.5, number3d(O.larg_fresa, 6) * 0.2));
    return fractions.map(function (fractionValue) {
      const fraction = closed
        ? ((fractionValue % 1) + 1) % 1
        : clamp3d(fractionValue, 0, 1);
      const distance = data.total * fraction;
      const point = pointAtDistance(path, closed, distance, data);
      const before = pointAtDistance(path, closed, distance - sampleDistance, data);
      const after = pointAtDistance(path, closed, distance + sampleDistance, data);
      const dx = after[0] - before[0];
      const dy = after[1] - before[1];
      const length = Math.hypot(dx, dy) || 1;
      return {
        fraction: fraction,
        point: point,
        normal: [-dy / length, dx / length],
      };
    });
  }

  function alignPath(reference, candidate, closed) {
    if (!reference.length || !candidate.length) return candidate;
    if (!closed) {
      const forward = Math.hypot(candidate[0][0] - reference[0][0], candidate[0][1] - reference[0][1])
        + Math.hypot(
          candidate[candidate.length - 1][0] - reference[reference.length - 1][0],
          candidate[candidate.length - 1][1] - reference[reference.length - 1][1]
        );
      const reverse = Math.hypot(
        candidate[candidate.length - 1][0] - reference[0][0],
        candidate[candidate.length - 1][1] - reference[0][1]
      ) + Math.hypot(
        candidate[0][0] - reference[reference.length - 1][0],
        candidate[0][1] - reference[reference.length - 1][1]
      );
      return reverse < forward ? candidate.slice().reverse() : candidate;
    }

    // A emenda pode ter sido inserida no meio de uma reta. Limpezas de
    // offset removem legitimamente esse ponto colinear; alinhar pelo vertice
    // mais proximo deslocaria a abertura ate o canto. Reinsira a projecao no
    // segmento sem alterar a forma ou o comprimento do contorno.
    let segmentIndex = 0;
    let segmentFraction = 0;
    let projectedStart = candidate[0].slice();
    let best = Infinity;
    for (let i = 0; i < candidate.length; i += 1) {
      const a = candidate[i];
      const b = candidate[(i + 1) % candidate.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lengthSquared = dx * dx + dy * dy;
      const fraction = lengthSquared > 1e-14
        ? clamp3d(
          ((reference[0][0] - a[0]) * dx + (reference[0][1] - a[1]) * dy)
            / lengthSquared,
          0,
          1
        )
        : 0;
      const projected = [a[0] + dx * fraction, a[1] + dy * fraction];
      const distance = Math.hypot(
        projected[0] - reference[0][0],
        projected[1] - reference[0][1]
      );
      if (distance < best) {
        best = distance;
        segmentIndex = i;
        segmentFraction = fraction;
        projectedStart = projected;
      }
    }
    const aligned = candidate.slice();
    let start;
    if (segmentFraction <= 1e-9) {
      start = segmentIndex;
    } else if (segmentFraction >= 1 - 1e-9) {
      start = (segmentIndex + 1) % aligned.length;
    } else {
      start = segmentIndex + 1;
      aligned.splice(start, 0, projectedStart);
    }
    const rotated = aligned.slice(start).concat(aligned.slice(0, start));
    if (rotated.length < 3 || reference.length < 2) return rotated;
    const refDirection = [reference[1][0] - reference[0][0], reference[1][1] - reference[0][1]];
    const forwardDirection = [rotated[1][0] - rotated[0][0], rotated[1][1] - rotated[0][1]];
    const reverseDirection = [
      rotated[rotated.length - 1][0] - rotated[0][0],
      rotated[rotated.length - 1][1] - rotated[0][1],
    ];
    const forwardDot = refDirection[0] * forwardDirection[0] + refDirection[1] * forwardDirection[1];
    const reverseDot = refDirection[0] * reverseDirection[0] + refDirection[1] * reverseDirection[1];
    return reverseDot > forwardDot
      ? [rotated[0]].concat(rotated.slice(1).reverse())
      : rotated;
  }

  function signedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area * 0.5;
  }

  function curveTurn(points) {
    let turn = 0;
    for (let i = 1; i < points.length - 1; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const c = points[i + 1];
      const ax = b[0] - a[0];
      const ay = b[1] - a[1];
      const bx = c[0] - b[0];
      const by = c[1] - b[1];
      turn += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    }
    return turn;
  }

  function inwardNormals(points, closed) {
    // Em contornos fechados anti-horários, a normal à esquerda da tangente
    // aponta para dentro. O sinal anterior devolvia a normal externa e, no
    // círculo (que usa offsets analíticos locais para as estruturas), trazia
    // as duas estruturas para cima da parede usinada. A sobreposição escondia
    // justamente as bocas dos frisos na face superior.
    const side = closed ? (signedArea(points) >= 0 ? 1 : -1) : (curveTurn(points) >= 0 ? 1 : -1);
    return points.map(function (_, index) {
      const prev = points[closed ? (index - 1 + points.length) % points.length : Math.max(0, index - 1)];
      const next = points[closed ? (index + 1) % points.length : Math.min(points.length - 1, index + 1)];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const length = Math.hypot(dx, dy) || 1;
      return [-dy / length * side, dx / length * side];
    });
  }

  function offsetPath(points, normals, distance) {
    return points.map(function (point, index) {
      return [
        point[0] + normals[index][0] * distance,
        point[1] + normals[index][1] * distance,
      ];
    });
  }

  function material(color, textured) {
    return new THREE.MeshStandardMaterial({
      color: color,
      map: textured && state.texture ? state.texture : null,
      roughness: textured ? 0.72 : 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }

  function pairPathByNormal(reference, opposite, closed) {
    if (!reference.length || !opposite.length) return [];
    const oppositeData = cumulative(opposite, closed);
    const oppositeSegmentCount = oppositeData.segmentCount;
    const paired = [];
    const cross2d = function (a, b) {
      return a[0] * b[1] - a[1] * b[0];
    };
    const closestPoint = function (target) {
      let best = null;
      let bestDistanceSquared = Infinity;
      for (let segmentIndex = 0; segmentIndex < oppositeSegmentCount; segmentIndex += 1) {
        const start = opposite[segmentIndex];
        const end = opposite[(segmentIndex + 1) % opposite.length];
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared > 1e-12
          ? clamp3d(
            ((target[0] - start[0]) * dx + (target[1] - start[1]) * dy) / lengthSquared,
            0,
            1
          )
          : 0;
        const point = [start[0] + dx * t, start[1] + dy * t];
        const distanceSquared = (
          (point[0] - target[0]) * (point[0] - target[0]) +
          (point[1] - target[1]) * (point[1] - target[1])
        );
        if (distanceSquared < bestDistanceSquared) {
          bestDistanceSquared = distanceSquared;
          best = point;
        }
      }
      return best;
    };
    const rayHit = function (source, direction) {
      let nearest = null;
      for (let segmentIndex = 0; segmentIndex < oppositeSegmentCount; segmentIndex += 1) {
        const start = opposite[segmentIndex];
        const end = opposite[(segmentIndex + 1) % opposite.length];
        const segment = [end[0] - start[0], end[1] - start[1]];
        const denominator = cross2d(direction, segment);
        if (Math.abs(denominator) < 1e-9) continue;
        const delta = [start[0] - source[0], start[1] - source[1]];
        const rayDistance = cross2d(delta, segment) / denominator;
        const segmentFraction = cross2d(delta, direction) / denominator;
        if (
          rayDistance > 1e-6 &&
          segmentFraction >= -1e-7 &&
          segmentFraction <= 1 + 1e-7 &&
          (!nearest || rayDistance < nearest.distance)
        ) {
          nearest = {
            distance: rayDistance,
            point: [
              source[0] + direction[0] * rayDistance,
              source[1] + direction[1] * rayDistance,
            ],
          };
        }
      }
      return nearest;
    };

    reference.forEach(function (source, index) {
      let normal = edgeNormal2D(reference, index, closed);
      const closest = closestPoint(source);
      if (
        closest &&
        normal[0] * (closest[0] - source[0]) +
        normal[1] * (closest[1] - source[1]) < 0
      ) {
        normal = [-normal[0], -normal[1]];
      }
      const hit = rayHit(source, normal);
      paired.push(hit ? hit.point : (closest || source.slice()));
    });
    return paired;
  }

  function stripGeometry(edgeA, edgeB, yBottom, yTop, closed) {
    // Em uma faixa aberta, near/far são offsets independentes e podem ter
    // quantidades e distribuições de pontos diferentes. Unir os contornos por
    // seções locais faz uma seção saltar para outra volta nas curvas em "S",
    // criando grandes triângulos sobre o vão. O perímetro completo da faixa é
    // simples; o Earcut triangula tampo e base globalmente, enquanto a extrusão
    // constrói cada lateral seguindo somente o seu próprio contorno.
    const distance = function (first, second) {
      return Math.hypot(first[0] - second[0], first[1] - second[1]);
    };
    const cleanPath = function (points) {
      const clean = [];
      (points || []).forEach(function (point) {
        if (!clean.length || distance(clean[clean.length - 1], point) > 1e-6) {
          clean.push([point[0], point[1]]);
        }
      });
      return clean;
    };
    const first = cleanPath(edgeA);
    let second = cleanPath(edgeB);
    if (first.length < 2 || second.length < 2) return new THREE.BufferGeometry();

    const directEnds = distance(first[0], second[0]) + distance(first[first.length - 1], second[second.length - 1]);
    const reversedEnds = distance(first[0], second[second.length - 1]) + distance(first[first.length - 1], second[0]);
    if (reversedEnds < directEnds) second = second.slice().reverse();

    let perimeter = first.concat(second.slice().reverse()).map(function (point) {
      return new THREE.Vector2(point[0], point[1]);
    });
    if (!THREE.ShapeUtils.isClockWise(perimeter)) perimeter = perimeter.slice().reverse();

    const shape = new THREE.Shape();
    perimeter.forEach(function (point, index) {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, yTop - yBottom),
      steps: 1,
      bevelEnabled: false,
      curveSegments: 1,
    });
    // Shape XY -> mundo XZ; profundidade Z -> altura Y.
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, yBottom, 0);
    geometry.computeVertexNormals();
    return geometry;
  }

  function closedStripGeometry(edgeA, edgeB, yBottom, yTop) {
    // Estrutura fechada é um anel plano real, não uma sequência de quads.
    // O Shape + hole preserva exatamente os dois contornos offset publicados
    // pelo backend e deixa a triangulação da tampa a cargo do Earcut/Three.js,
    // sem qualquer associação artificial entre seus percentuais de arco.
    const firstIsOuter = Math.abs(signedArea(edgeA)) >= Math.abs(signedArea(edgeB));
    let outer = (firstIsOuter ? edgeA : edgeB).map(function (point) {
      return new THREE.Vector2(point[0], point[1]);
    });
    let hole = (firstIsOuter ? edgeB : edgeA).map(function (point) {
      return new THREE.Vector2(point[0], point[1]);
    });
    if (!THREE.ShapeUtils.isClockWise(outer)) outer = outer.slice().reverse();
    if (THREE.ShapeUtils.isClockWise(hole)) hole = hole.slice().reverse();

    const shape = new THREE.Shape();
    outer.forEach(function (point, index) {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    const holePath = new THREE.Path();
    hole.forEach(function (point, index) {
      if (index === 0) holePath.moveTo(point.x, point.y);
      else holePath.lineTo(point.x, point.y);
    });
    holePath.closePath();
    shape.holes.push(holePath);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, yTop - yBottom),
      steps: 1,
      bevelEnabled: false,
      curveSegments: 1,
    });
    // Shape XY -> mundo XZ; profundidade Z -> altura Y.
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, yBottom, 0);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addStrip(group, edgeA, edgeB, yBottom, yTop, closed, stripMaterial, role) {
    const geometry = closed
      ? closedStripGeometry(edgeA, edgeB, yBottom, yTop)
      : stripGeometry(edgeA, edgeB, yBottom, yTop, false);
    const mesh = new THREE.Mesh(geometry, stripMaterial);
    mesh.castShadow = true;
    // As faixas são muito próximas entre si (folgas de 1 mm). Receber a
    // própria sombra gera "shadow acne" e manchas triangulares no tampo.
    mesh.receiveShadow = false;
    mesh.userData.previewRole = role || "wall";
    group.add(mesh);
    return mesh;
  }

  function addPathOutline(group, path, y, closed, color, opacity) {
    const geometry = new THREE.BufferGeometry().setFromPoints(path.map(function (point) {
      return new THREE.Vector3(point[0], y, -point[1]);
    }));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: color,
      transparent: opacity < 1,
      opacity: opacity,
      depthTest: true,
    });
    const line = closed ? new THREE.LineLoop(geometry, lineMaterial) : new THREE.Line(geometry, lineMaterial);
    line.renderOrder = 5;
    group.add(line);
  }

  /** Contorno de arame mostrado só no raio X.
   *
   * No raio X cada face tem uma opacidade fixa, então o que se enxerga depende
   * de quantas faces o olhar atravessa: de lado são muitas e a peça parece
   * sólida; de cima são duas e ela some contra o fundo branco. A linha não
   * depende do ângulo — desenha a forma igual em qualquer posição.
   */
  function addXrayOutline(group, path, y, closed) {
    if (!Array.isArray(path) || path.length < 2) return null;
    const geometry = new THREE.BufferGeometry().setFromPoints(
      path.map(function (point) {
        return new THREE.Vector3(point[0], y, -point[1]);
      })
    );
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x8a6a4f,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const line = closed
      ? new THREE.LineLoop(geometry, lineMaterial)
      : new THREE.Line(geometry, lineMaterial);
    line.renderOrder = 30;
    line.visible = false;
    line.userData.previewRole = "xrayOutline";
    group.add(line);
    return line;
  }

  function addSeamIndicator(group, geometry, height) {
    if (!geometry.closed || !geometry.outer.length || !geometry.seam.length) return null;
    // O backend já rotaciona todos os contornos para que o índice zero seja
    // exatamente o nó INÍCIO/FIM escolhido na planta/DXF. A marca usa esses
    // pontos publicados; não procura outro ponto "parecido" no contorno.
    const outer = geometry.outer[0];
    const seam = geometry.seam[0];
    const innerPath = geometry.inner && geometry.inner.length ? geometry.inner : geometry.seam;
    const inner = innerPath[0];
    const offsetPoint = function (point, awayFrom) {
      const dx = point[0] - awayFrom[0];
      const dy = point[1] - awayFrom[1];
      const length = Math.hypot(dx, dy) || 1;
      return [point[0] + dx / length * 0.35, point[1] + dy / length * 0.35];
    };
    // Afasta a linha 0,35 mm de cada face para evitar z-fighting, mantendo a
    // posição física da emenda visualmente coincidente com o início/fim.
    const outerMark = offsetPoint(outer, seam);
    const innerReference = geometry.inner && geometry.inner.length ? seam : outer;
    const innerMark = offsetPoint(inner, innerReference);
    const indicator = new THREE.Group();
    indicator.userData.previewRole = "seamIndicator";
    const stripMaterial = new THREE.MeshBasicMaterial({
      color: 0x2a160e,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const seamTangent = function (path) {
      const origin = path[0];
      let next = null;
      let previous = null;
      for (let index = 1; index < path.length; index += 1) {
        if (Math.hypot(path[index][0] - origin[0], path[index][1] - origin[1]) > 1e-6) {
          next = path[index];
          break;
        }
      }
      for (let index = path.length - 1; index > 0; index -= 1) {
        if (Math.hypot(path[index][0] - origin[0], path[index][1] - origin[1]) > 1e-6) {
          previous = path[index];
          break;
        }
      }
      if (!next && !previous) return [1, 0];
      const outgoing = next
        ? [next[0] - origin[0], next[1] - origin[1]]
        : [origin[0] - previous[0], origin[1] - previous[1]];
      const incoming = previous
        ? [origin[0] - previous[0], origin[1] - previous[1]]
        : outgoing;
      const outLength = Math.hypot(outgoing[0], outgoing[1]) || 1;
      const inLength = Math.hypot(incoming[0], incoming[1]) || 1;
      let tx = outgoing[0] / outLength + incoming[0] / inLength;
      let ty = outgoing[1] / outLength + incoming[1] / inLength;
      let tangentLength = Math.hypot(tx, ty);
      if (tangentLength < 1e-6) {
        tx = outgoing[0] / outLength;
        ty = outgoing[1] / outLength;
        tangentLength = 1;
      }
      return [tx / tangentLength, ty / tangentLength];
    };
    const addVerticalStrip = function (path, point) {
      const tangent = seamTangent(path);
      const halfWidth = 0.65;
      const x0 = point[0] - tangent[0] * halfWidth;
      const y0 = point[1] - tangent[1] * halfWidth;
      const x1 = point[0] + tangent[0] * halfWidth;
      const y1 = point[1] + tangent[1] * halfWidth;
      const verticalGeometry = new THREE.BufferGeometry();
      verticalGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
        x0, 0.2, -y0,
        x1, 0.2, -y1,
        x1, height - 0.2, -y1,
        x0, height - 0.2, -y0,
      ], 3));
      verticalGeometry.setIndex([0, 1, 2, 0, 2, 3]);
      verticalGeometry.computeVertexNormals();
      const strip = new THREE.Mesh(verticalGeometry, stripMaterial);
      strip.renderOrder = 9;
      strip.userData.previewRole = "seamIndicator";
      indicator.add(strip);
    };
    addVerticalStrip(geometry.outer, outerMark);
    addVerticalStrip(innerPath, innerMark);
    const points = [
      new THREE.Vector3(outerMark[0], 0, -outerMark[1]),
      new THREE.Vector3(outerMark[0], height, -outerMark[1]),
      new THREE.Vector3(innerMark[0], 0, -innerMark[1]),
      new THREE.Vector3(innerMark[0], height, -innerMark[1]),
      new THREE.Vector3(outer[0], height + 0.4, -outer[1]),
      new THREE.Vector3(inner[0], height + 0.4, -inner[1]),
      new THREE.Vector3(outer[0], -0.4, -outer[1]),
      new THREE.Vector3(inner[0], -0.4, -inner[1]),
    ];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x3b2418,
      transparent: true,
      opacity: 0.98,
      depthTest: true,
    });
    const seamLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    seamLines.renderOrder = 10;
    seamLines.userData.previewRole = "seamIndicator";
    indicator.add(seamLines);
    group.add(indicator);
    return indicator;
  }

  // Emendas de DIVISAO: onde a peca planificada e cortada em partes que cabem
  // na chapa. Sao marcas diferentes do INICIO/FIM - laranja, a mesma cor da
  // tesoura do editor 2D - e precisam aparecer aqui para o usuario conferir
  // onde cada parte comeca e termina antes de mandar cortar.
  function addDivisionSeams(group, geometry, height) {
    if (!geometry || !geometry.outer || geometry.outer.length < 2) return null;
    if (typeof orgPartesDaPeca !== "function") return null;
    let dados = null;
    try {
      dados = orgPartesDaPeca();
    } catch (erro) {
      dados = null;
    }
    if (!dados || !Array.isArray(dados.cortes) || !dados.cortes.length) return null;
    if (!(dados.total > 0)) return null;

    const COR = 0xea580c;
    const indicator = new THREE.Group();
    indicator.userData.previewRole = "divisionSeam";
    const stripMaterial = new THREE.MeshBasicMaterial({
      color: COR,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const lineMaterial = new THREE.LineBasicMaterial({
      color: COR,
      transparent: true,
      opacity: 0.98,
      depthTest: true,
    });

    const innerPath = (geometry.inner && geometry.inner.length)
      ? geometry.inner
      : geometry.seam;
    // Sem peca interna o contorno de dentro E a propria costura: incluir os
    // dois desenharia a mesma faixa duas vezes no mesmo lugar.
    const caminhos = [];
    [geometry.outer, geometry.seam, innerPath].forEach(function (caminho) {
      if (caminho && caminho.length > 1 && caminhos.indexOf(caminho) === -1) {
        caminhos.push(caminho);
      }
    });
    if (!caminhos.length) return null;
    const arcos = caminhos.map(function (caminho) {
      return cumulative(caminho, geometry.closed);
    });

    // O indice zero de todos os contornos e o no INICIO/FIM, e os cortes vem
    // medidos a partir dele, ao longo do contorno DESENHADO (caminhos[0]).
    // Nas demais faces a marca e a PROJECAO NORMAL da marca de fora, nao a
    // mesma fracao do perimetro: trecho reto nao encolhe quando a peca e
    // deslocada, so o curvo encolhe, entao a mesma fracao caia deslocada ao
    // longo do comprimento e a linha do topo saia torta -- como se o corte
    // tivesse sido feito em angulo em vez de reto pela espessura.
    dados.cortes.forEach(function (corte) {
      const t = corte / dados.total;
      if (!(t > 0) || !(t < 1)) return;
      const pontos = [];
      let referencia = null;
      caminhos.forEach(function (caminho, indice) {
        const arco = arcos[indice];
        const alvo = referencia
          ? arco.total * closestFractionOnPath(caminho, geometry.closed, referencia)
          : arco.total * t;
        const ponto = pointAtDistance(caminho, geometry.closed, alvo, arco);
        if (!referencia) referencia = ponto;
        pontos.push(ponto);
        const antes = pointAtDistance(caminho, geometry.closed, alvo - 0.8, arco);
        const depois = pointAtDistance(caminho, geometry.closed, alvo + 0.8, arco);
        const tx = depois[0] - antes[0];
        const ty = depois[1] - antes[1];
        const comprimento = Math.hypot(tx, ty) || 1;
        const hx = tx / comprimento * 0.8;
        const hy = ty / comprimento * 0.8;
        const faixa = new THREE.BufferGeometry();
        faixa.setAttribute("position", new THREE.Float32BufferAttribute([
          ponto[0] - hx, 0.2, -(ponto[1] - hy),
          ponto[0] + hx, 0.2, -(ponto[1] + hy),
          ponto[0] + hx, height - 0.2, -(ponto[1] + hy),
          ponto[0] - hx, height - 0.2, -(ponto[1] - hy),
        ], 3));
        faixa.setIndex([0, 1, 2, 0, 2, 3]);
        faixa.computeVertexNormals();
        const strip = new THREE.Mesh(faixa, stripMaterial);
        strip.renderOrder = 9;
        strip.userData.previewRole = "divisionSeam";
        indicator.add(strip);
      });
      const fora = pontos[0];
      const dentro = pontos[pontos.length - 1];
      const linhaGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(fora[0], 0, -fora[1]),
        new THREE.Vector3(fora[0], height, -fora[1]),
        new THREE.Vector3(dentro[0], 0, -dentro[1]),
        new THREE.Vector3(dentro[0], height, -dentro[1]),
        new THREE.Vector3(fora[0], height + 0.4, -fora[1]),
        new THREE.Vector3(dentro[0], height + 0.4, -dentro[1]),
        new THREE.Vector3(fora[0], -0.4, -fora[1]),
        new THREE.Vector3(dentro[0], -0.4, -dentro[1]),
      ]);
      const linhas = new THREE.LineSegments(linhaGeom, lineMaterial);
      linhas.renderOrder = 10;
      linhas.userData.previewRole = "divisionSeam";
      indicator.add(linhas);
    });

    if (!indicator.children.length) return null;
    group.add(indicator);
    return indicator;
  }

  function sourceGeometry() {
    if (typeof O === "undefined" || typeof orgHasEnoughGeometry !== "function" || !orgHasEnoughGeometry()) {
      return null;
    }

    const exactCircle = typeof orgIsExactCircle === "function" && orgIsExactCircle();
    const closed = exactCircle || !!O.fechada;
    // O objeto de preview é mantido durante o debounce para evitar apagar a
    // planta 2D. No 3D, porém, ele só pode ser usado quando pertence ao payload
    // atual; misturar estruturas da resposta anterior com a nova curva causava
    // a deformação transitória observada durante o carregamento.
    const backendPreviewCurrent = (
      typeof _orgInternaPreviewSig !== "undefined"
      && typeof _orgInternaPendingSig !== "undefined"
      && _orgInternaPreviewSig !== null
      && _orgInternaPreviewSig === _orgInternaPendingSig
    );
    let rawOuter;
    let effectiveNodes = [];
    let effectiveStraight = [];

    if (exactCircle) {
      rawOuter = orgCirclePts(180);
    } else {
      effectiveNodes = O.inverter ? O.nos.slice().reverse() : O.nos.slice();
      effectiveStraight = O.inverter ? (O.segReto || []).slice().reverse() : (O.segReto || []).slice();
      const segments = closed ? effectiveNodes.length : effectiveNodes.length - 1;
      while (effectiveStraight.length < segments) effectiveStraight.push(false);
      rawOuter = orgCurve(effectiveNodes, 240, closed, effectiveStraight);
    }

    const hasBackendOuter = !exactCircle && backendPreviewCurrent && _orgInternaPreview
      && _orgInternaPreview.mode === "curve"
      && Array.isArray(_orgInternaPreview.outerPoints)
      && _orgInternaPreview.outerPoints.length > 1;
    if (hasBackendOuter
        && Array.isArray(_orgInternaPreview.outerPoints) && _orgInternaPreview.outerPoints.length > 1) {
      rawOuter = _orgInternaPreview.outerPoints;
    }

    const guideOuter = rawOuter.map(function (point) {
      return [number3d(point[0], 0), number3d(point[1], 0)];
    });
    const rawArc = cumulative(guideOuter, closed).total;
    // O passo anterior (~15 mm em peças grandes) era da mesma ordem do
    // espaçamento entre frisos. A tangente ficava quantizada e os canais dos
    // cantos deixavam de acompanhar o arco do 2D. Mantemos pontos a cada
    // ~3 mm, com teto para preservar a fluidez do editor.
    const count = Math.min(
      720,
      Math.max(closed ? 240 : 200, Math.ceil(rawArc / 3))
    );
    // Para a parede usinada, preservar a polilinha exata publicada pelo
    // backend mantém a mesma tangente usada pela planta e pelo DXF. A
    // reamostragem continua apenas no fallback local.
    const outer = hasBackendOuter ? guideOuter.slice() : resample(rawOuter, count, closed);
    if (outer.length < 2) return null;
    const normals = inwardNormals(outer, closed);

    let seam = null;
    let inner = null;
    if (exactCircle && _orgInternaPreview && _orgInternaPreview.mode === "circle") {
      const a0 = O.circleEmendaAng || (-Math.PI / 2);
      seam = Array.from({ length: count }, function (_, index) {
        const angle = a0 + Math.PI * 2 * index / count;
        return [
          _orgInternaPreview.cx + _orgInternaPreview.rSeam * Math.cos(angle),
          _orgInternaPreview.cy + _orgInternaPreview.rSeam * Math.sin(angle),
        ];
      });
      if (O.gerar_interna && _orgInternaPreview.r > 0) {
        inner = Array.from({ length: count }, function (_, index) {
          const angle = a0 + Math.PI * 2 * index / count;
          return [
            _orgInternaPreview.cx + _orgInternaPreview.r * Math.cos(angle),
            _orgInternaPreview.cy + _orgInternaPreview.r * Math.sin(angle),
          ];
        });
      }
    } else if (backendPreviewCurrent && _orgInternaPreview && _orgInternaPreview.mode === "curve") {
      if (Array.isArray(_orgInternaPreview.seamPoints) && _orgInternaPreview.seamPoints.length > 1) {
        const seamCandidate = _orgInternaPreview.seamPoints.map(function (point) {
          return [number3d(point[0], 0), number3d(point[1], 0)];
        });
        seam = alignPath(
          outer,
          hasBackendOuter ? seamCandidate : resample(seamCandidate, count, closed),
          closed
        );
      }
      if (O.gerar_interna && Array.isArray(_orgInternaPreview.points) && _orgInternaPreview.points.length > 1) {
        const innerCandidate = _orgInternaPreview.points.map(function (point) {
          return [number3d(point[0], 0), number3d(point[1], 0)];
        });
        inner = alignPath(
          seam || outer,
          hasBackendOuter ? innerCandidate : resample(innerCandidate, count, closed),
          closed
        );
      }
    }

    if (!seam || seam.length < 2) {
      seam = offsetPath(outer, normals, Math.max(0.1, number3d(O.espessura, 18)));
    }
    // Parede de várias chapas: todas as internas têm a "Espessura interna".
    const qtdChapas = O.gerar_interna && typeof orgQtdChapasEfetiva === "function"
      ? orgQtdChapasEfetiva()
      : 2;
    if (O.gerar_interna && (!inner || inner.length < 2)) {
      inner = offsetPath(
        seam,
        inwardNormals(seam, closed),
        Math.max(0.1, number3d(orgEspessuraInternaEfetiva(), O.espessura) * (qtdChapas - 1))
      );
    }

    // Chapas do meio (3 ou mais chapas): as faces vêm prontas do backend — as
    // mesmas que medem cada chapa no DXF. No círculo basta o raio de cada uma.
    // Se alguma faltar, nenhuma entra: a interna volta a ocupar o vão inteiro,
    // em vez de sobrar um buraco na parede.
    const camadasMeio = O.gerar_interna && inner
      && typeof _orgInternaPreview !== "undefined" && _orgInternaPreview
      && Array.isArray(_orgInternaPreview.camadasMeio || _orgInternaPreview.camadas_meio)
      ? (_orgInternaPreview.camadasMeio || _orgInternaPreview.camadas_meio)
      : [];
    const middleSheets = [];
    if (camadasMeio.length && exactCircle && _orgInternaPreview.mode === "circle") {
      const a0 = O.circleEmendaAng || (-Math.PI / 2);
      const ring = function (radius) {
        return Array.from({ length: count }, function (_, index) {
          const angle = a0 + Math.PI * 2 * index / count;
          return [
            _orgInternaPreview.cx + radius * Math.cos(angle),
            _orgInternaPreview.cy + radius * Math.sin(angle),
          ];
        });
      };
      camadasMeio.forEach(function (camada) {
        const rOuter = number3d(camada && camada.r_outer, NaN);
        const rInner = number3d(camada && camada.r_inner, NaN);
        if (!(rOuter > 0) || !(rInner > 0)) return;
        middleSheets.push({
          chapa: camada.chapa,
          outer: ring(rOuter),
          inner: ring(rInner),
          machining: Array.isArray(camada.machining) ? camada.machining : [],
        });
      });
    } else if (camadasMeio.length && backendPreviewCurrent && _orgInternaPreview.mode === "curve") {
      const takeFace = function (points) {
        if (!Array.isArray(points) || points.length < 2) return null;
        const candidate = points.map(function (point) {
          return [number3d(point[0], 0), number3d(point[1], 0)];
        });
        return alignPath(
          outer,
          hasBackendOuter ? candidate : resample(candidate, count, closed),
          closed
        );
      };
      camadasMeio.forEach(function (camada) {
        const sheetOuter = takeFace(camada && camada.points_outer);
        const sheetInner = takeFace(camada && camada.points_inner);
        if (!sheetOuter || !sheetInner) return;
        middleSheets.push({
          chapa: camada.chapa,
          outer: sheetOuter,
          inner: sheetInner,
          machining: Array.isArray(camada.machining) ? camada.machining : [],
        });
      });
    }
    const sheets = middleSheets.length === camadasMeio.length ? middleSheets : [];
    // Face de fora da peça interna: com 2 chapas é a própria costura.
    const seamInt = sheets.length ? sheets[sheets.length - 1].inner : seam;

    let structures = null;
    const structureData = !exactCircle && backendPreviewCurrent && _orgInternaPreview
      && _orgInternaPreview.mode === "curve" ? _orgInternaPreview.structures : null;
    if (structureData) {
      const take = function (key, reference) {
        const source = structureData[key];
        if (!Array.isArray(source) || source.length < 2) return null;
        const candidate = source.map(function (point) {
          return [number3d(point[0], 0), number3d(point[1], 0)];
        });
        return alignPath(reference, candidate, closed);
      };
      const externalNear = take("external_near", outer);
      const externalFar = externalNear ? take("external_far", externalNear) : null;
      const internalReference = inner || seam;
      const internalNear = take("internal_near", internalReference);
      const internalFar = internalNear ? take("internal_far", internalNear) : null;
      if (externalNear && externalFar && internalNear && internalFar) {
        structures = {
          externalNear: externalNear,
          externalFar: externalFar,
          internalNear: internalNear,
          internalFar: internalFar,
        };
      }
    }

    return {
      exactCircle: exactCircle,
      closed: closed,
      guideOuter: guideOuter,
      outer: outer,
      seam: seam,
      inner: inner,
      middleSheets: sheets,
      seamInt: seamInt,
      normals: normals,
      effectiveNodes: effectiveNodes,
      effectiveStraight: effectiveStraight,
      structures: structures,
    };
  }

  function sharedPlantGrooveGuides(kind) {
    const machining = typeof _orgInternaPreview !== "undefined"
      && _orgInternaPreview && _orgInternaPreview.machining;
    const machiningSource = machining && Array.isArray(machining[kind])
      ? machining[kind]
      : null;
    const shared = window._orgFrisoGuides2d;
    const source = machiningSource || (shared && Array.isArray(shared[kind]) ? shared[kind] : []);
    return parseGrooveGuides(source);
  }

  // Converte as guias do plano de usinagem do backend (boca, normal, bordas
  // do canal) no formato do addMachinedWall. Também usado pelas chapas do
  // meio, que trazem o próprio plano em camadas_meio[].machining.
  function parseGrooveGuides(source) {
    return (Array.isArray(source) ? source : []).reduce(function (guides, item) {
      const rawPoint = item && (item.mouth_point || item.mouthPoint || item.point);
      const rawDirection = item && (
        item.normal_into_material || item.normalIntoMaterial || item.direction || item.normal
      );
      if (!item || !Array.isArray(rawPoint) || !Array.isArray(rawDirection)) return guides;
      const point = [number3d(rawPoint[0], NaN), number3d(rawPoint[1], NaN)];
      const direction = [number3d(rawDirection[0], NaN), number3d(rawDirection[1], NaN)];
      const length = Math.hypot(direction[0], direction[1]);
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(length) || length < 1e-8) {
        return guides;
      }
      guides.push({
        point: point,
        normal: [direction[0] / length, direction[1] / length],
        mouthStartPoint: Array.isArray(
          item.mouth_start_point || item.mouthStartPoint
        )
          ? [
            number3d(
              (item.mouth_start_point || item.mouthStartPoint)[0], NaN
            ),
            number3d(
              (item.mouth_start_point || item.mouthStartPoint)[1], NaN
            ),
          ]
          : null,
        mouthEndPoint: Array.isArray(
          item.mouth_end_point || item.mouthEndPoint
        )
          ? [
            number3d(
              (item.mouth_end_point || item.mouthEndPoint)[0], NaN
            ),
            number3d(
              (item.mouth_end_point || item.mouthEndPoint)[1], NaN
            ),
          ]
          : null,
        oppositeStartPoint: Array.isArray(
          item.opposite_start_point || item.oppositeStartPoint
        )
          ? [
            number3d(
              (item.opposite_start_point || item.oppositeStartPoint)[0], NaN
            ),
            number3d(
              (item.opposite_start_point || item.oppositeStartPoint)[1], NaN
            ),
          ]
          : null,
        oppositeEndPoint: Array.isArray(
          item.opposite_end_point || item.oppositeEndPoint
        )
          ? [
            number3d(
              (item.opposite_end_point || item.oppositeEndPoint)[0], NaN
            ),
            number3d(
              (item.opposite_end_point || item.oppositeEndPoint)[1], NaN
            ),
          ]
          : null,
        fraction: (item.source_fraction != null || item.fraction != null)
          && Number.isFinite(Number(item.source_fraction != null ? item.source_fraction : item.fraction))
          ? Number(item.source_fraction != null ? item.source_fraction : item.fraction)
          : null,
        sourceStartFraction: (
          item.source_start_fraction != null || item.sourceStartFraction != null
        ) && Number.isFinite(Number(
          item.source_start_fraction != null
            ? item.source_start_fraction
            : item.sourceStartFraction
        ))
          ? Number(
            item.source_start_fraction != null
              ? item.source_start_fraction
              : item.sourceStartFraction
          )
          : null,
        sourceEndFraction: (
          item.source_end_fraction != null || item.sourceEndFraction != null
        ) && Number.isFinite(Number(
          item.source_end_fraction != null
            ? item.source_end_fraction
            : item.sourceEndFraction
        ))
          ? Number(
            item.source_end_fraction != null
              ? item.source_end_fraction
              : item.sourceEndFraction
          )
          : null,
        sourceStation: (item.source_station != null || item.station != null)
          && Number.isFinite(Number(item.source_station != null ? item.source_station : item.station))
          ? Number(item.source_station != null ? item.source_station : item.station)
          : null,
        dxfX: (item.dxf_x != null || item.dxfX != null)
          && Number.isFinite(Number(item.dxf_x != null ? item.dxf_x : item.dxfX))
          ? Number(item.dxf_x != null ? item.dxf_x : item.dxfX)
          : null,
        sourceFace: item.source_face || item.sourceFace || null,
        group: item.group != null && Number.isFinite(Number(item.group)) ? Number(item.group) : null,
      });
      return guides;
    }, []);
  }

  function sharedDesbastePiece(kind) {
    const plan = typeof _orgInternaPreview !== "undefined"
      && _orgInternaPreview && _orgInternaPreview.desbaste;
    if (!plan || !plan.active || !Array.isArray(plan.pieces)) return null;
    const wanted = kind === "internal" ? "internal" : "external";
    return plan.pieces.find(function (piece) {
      return piece && piece.piece === wanted;
    }) || null;
  }

  function sharedDesbasteRanges(kind) {
    const piece = sharedDesbastePiece(kind);
    if (!piece || !Array.isArray(piece.regions)) return [];
    return piece.regions.reduce(function (ranges, region, index) {
      const start = number3d(
        region.source_start_fraction != null
          ? region.source_start_fraction : region.sourceStartFraction,
        NaN
      );
      const end = number3d(
        region.source_end_fraction != null
          ? region.source_end_fraction : region.sourceEndFraction,
        NaN
      );
      if (!Number.isFinite(start) || !Number.isFinite(end)) return ranges;
      const fullLoop = (!!O.fechada || (
        typeof orgIsExactCircle === "function" && orgIsExactCircle()
      )) && end - start >= 0.999999;
      const safeEnd = end;
      const takePoint = function (snake, camel) {
        const raw = region[snake] || region[camel];
        if (!Array.isArray(raw) || raw.length < 2) return null;
        const point = [number3d(raw[0], NaN), number3d(raw[1], NaN)];
        return point.every(Number.isFinite) ? point : null;
      };
      ranges.push({
        fraction: (start + safeEnd) / 2,
        sourceStartFraction: start,
        sourceEndFraction: safeEnd,
        // Num anel completo as duas bordas coincidem na emenda. Nesse caso a
        // seção oposta é encontrada pela normal local, não por interpolação
        // entre dois pontos iguais ao longo de quase uma volta inteira.
        mouthStartPoint: fullLoop ? null : takePoint("mouth_start_point", "mouthStartPoint"),
        mouthEndPoint: fullLoop ? null : takePoint("mouth_end_point", "mouthEndPoint"),
        oppositeStartPoint: fullLoop ? null : takePoint("opposite_start_point", "oppositeStartPoint"),
        oppositeEndPoint: fullLoop ? null : takePoint("opposite_end_point", "oppositeEndPoint"),
        sourceFace: piece.source_face || piece.sourceFace || null,
        fullRange: fullLoop,
        group: index,
        dxfX: (
          number3d(region.dxf_start, 0) + number3d(region.dxf_end, 0)
        ) / 2,
      });
      return ranges;
    }, []);
  }

  function addCambotinhaStacks(group, height) {
    const plan = typeof _orgInternaPreview !== "undefined"
      && _orgInternaPreview && _orgInternaPreview.desbaste;
    if (!plan || !plan.active || !Array.isArray(plan.pieces)) return;
    const fillerMaterial = material(0xb7793f, false);
    const fillers = Array.isArray(plan.fillers) ? plan.fillers : plan.pieces;
    fillers.forEach(function (piece) {
      if (!piece || (piece.piece === "internal" && !O.gerar_interna)) return;
      const layerThickness = Math.max(0.1, number3d(
        piece.stack_piece_thickness_mm != null
          ? piece.stack_piece_thickness_mm : piece.stackPieceThicknessMm,
        O.espessura
      ));
      const quantity = Math.max(1, Math.floor(number3d(
        piece.stack_quantity != null
          ? piece.stack_quantity : piece.stackQuantity,
        Math.ceil(height / layerThickness)
      )));
      (piece.regions || []).forEach(function (region) {
        const contour = region.cambotinha_contour || region.cambotinhaContour;
        if (!Array.isArray(contour) || contour.length < 3) return;
        const shape = new THREE.Shape();
        contour.forEach(function (raw, index) {
          const x = number3d(raw[0], 0);
          const y = number3d(raw[1], 0);
          if (index === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        });
        shape.closePath();
        for (let layerIndex = 0; layerIndex < quantity; layerIndex += 1) {
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: layerThickness,
            bevelEnabled: false,
            curveSegments: 1,
          });
          geometry.rotateX(-Math.PI / 2);
          geometry.translate(0, layerIndex * layerThickness, 0);
          geometry.computeVertexNormals();
          const mesh = new THREE.Mesh(geometry, fillerMaterial);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.previewRole = "cambotinha";
          group.add(mesh);
        }
      });
    });
  }

  function groovePositions(geometry) {
    if (!O.gerar_fresagem || number3d(O.espaco_fresagem, 0) <= 0) return [];
    const plantGuides = sharedPlantGrooveGuides("external");
    if (plantGuides.length) return plantGuides;

    const guidePath = geometry.guideOuter || geometry.outer;
    const arc = cumulative(guidePath, geometry.closed).total;
    if (arc <= 0) return [];

    if (geometry.exactCircle) {
      const spacing = Math.max(0.1, number3d(O.espaco_fresagem, 15));
      const count = Math.max(1, Math.floor(arc / spacing + 1e-9));
      const fractions = Array.from({ length: count }, function (_, index) {
        return (index + 0.5) / count;
      });
      return grooveGuidesForPath(guidePath, geometry.closed, fractions);
    }

    if (typeof orgCurvedRanges !== "function" || typeof orgFresColumns !== "function") return [];
    const sourceArc = orgArcLen(orgCurve(geometry.effectiveNodes, 500, geometry.closed, geometry.effectiveStraight))
      + orgCornerArcCorrection(geometry.effectiveNodes, geometry.closed, O.nodeCorners);
    const ranges = orgCurvedRanges(
      geometry.effectiveNodes,
      geometry.closed,
      geometry.effectiveStraight,
      O.nodeCorners,
      sourceArc
    );
    const fractions = orgFresColumns(
      sourceArc,
      number3d(O.dist_inicial, 0),
      number3d(O.espaco_fresagem, 15),
      ranges,
      number3d(O.fresagem_prolongamento_pct, 10)
    ).map(function (position) {
      return clamp3d(position / Math.max(sourceArc, 1e-8), 0, geometry.closed ? 0.999999 : 1);
    });
    return grooveGuidesForPath(guidePath, geometry.closed, fractions);
  }

  function addMachinedWall(group, edgeA, edgeB, height, thickness, closed, options) {
    const role = options.role || "wall";
    const woodMaterial = options.woodMaterial;
    const coreMaterial = options.coreMaterial;
    const grooveMaterial = options.grooveMaterial;
    const cutFrom = options.cutFrom === "a" ? "a" : "b";
    const hideFaceA = !!options.hideFaceA;
    const hideFaceB = !!options.hideFaceB;
    const sourceFaceName = cutFrom === "a"
      ? (options.edgeAFace || "a")
      : (options.edgeBFace || "b");
    const toolWidth = Math.max(0.5, number3d(options.toolWidth, 6));
    const skin = clamp3d(number3d(options.skin, 1), 0.5, Math.max(0.5, thickness - 0.1));
    const depthRatio = clamp3d((thickness - skin) / Math.max(thickness, 0.1), 0, 0.995);
    const cutDepth = thickness * depthRatio;
    const centers = Array.isArray(options.grooveFractions) ? options.grooveFractions : [];
    const reference = cutFrom === "a" ? edgeA : edgeB;
    const refData = cumulative(reference, closed);
    const edgeAData = cumulative(edgeA, closed);
    const edgeBData = cumulative(edgeB, closed);
    const normalizedFraction = function (fraction) {
      if (closed) return ((fraction % 1) + 1) % 1;
      return clamp3d(fraction, 0, 1);
    };
    const pointOn = function (edge, fraction) {
      const data = edge === edgeA ? edgeAData : edgeBData;
      return pointAtDistance(edge, closed, data.total * normalizedFraction(fraction), data);
    };
    const halfFraction = toolWidth / Math.max(refData.total, 1e-6) / 2;
    const ranges = [];
    const oppositeReference = cutFrom === "a" ? edgeB : edgeA;

    centers.forEach(function (centerValue, centerIndex) {
      const guide = centerValue && typeof centerValue === "object" ? centerValue : null;
      const hasSourceFraction = !!(
        guide && guide.fraction != null && Number.isFinite(Number(guide.fraction))
      );
      const originalFraction = guide
        ? (hasSourceFraction ? Number(guide.fraction) : 0)
        : number3d(centerValue, 0);
      const hasMachiningMouth = !!(
        guide && guide.sourceFace && Array.isArray(guide.point)
      );
      const mapped = hasMachiningMouth
        ? { fraction: closestFractionOnPath(reference, closed, guide.point) }
        : (!hasSourceFraction && guide
          && Array.isArray(guide.point) && Array.isArray(guide.normal)
          ? lineFractionOnPath(reference, closed, guide.point, guide.normal)
          : null);
      const center = closed
        ? ((((mapped ? mapped.fraction : originalFraction) % 1) + 1) % 1)
        : clamp3d(mapped ? mapped.fraction : originalFraction, 0, 1);
      const rangeData = {
        center: center,
        guideId: centerIndex,
        plantPoint: guide && Array.isArray(guide.point)
          ? [guide.point[0], guide.point[1]]
          : null,
        guideNormal: guide && Array.isArray(guide.normal)
          ? [guide.normal[0], guide.normal[1]]
          : null,
        mouthStartPoint: guide && Array.isArray(guide.mouthStartPoint)
          && guide.mouthStartPoint.every(Number.isFinite)
          ? guide.mouthStartPoint.slice(0, 2)
          : null,
        mouthEndPoint: guide && Array.isArray(guide.mouthEndPoint)
          && guide.mouthEndPoint.every(Number.isFinite)
          ? guide.mouthEndPoint.slice(0, 2)
          : null,
        oppositeStartPoint: guide && Array.isArray(guide.oppositeStartPoint)
          && guide.oppositeStartPoint.every(Number.isFinite)
          ? guide.oppositeStartPoint.slice(0, 2)
          : null,
        oppositeEndPoint: guide && Array.isArray(guide.oppositeEndPoint)
          && guide.oppositeEndPoint.every(Number.isFinite)
          ? guide.oppositeEndPoint.slice(0, 2)
          : null,
        sourceStation: guide ? guide.sourceStation : null,
        dxfX: guide ? guide.dxfX : null,
        sourceFace: guide ? guide.sourceFace : null,
        group: guide ? guide.group : null,
        fullRange: !!(guide && guide.fullRange),
      };
      if (rangeData.oppositeStartPoint && rangeData.oppositeEndPoint) {
        rangeData.oppositeStartFraction = closestFractionOnPath(
          oppositeReference, closed, rangeData.oppositeStartPoint
        );
        rangeData.oppositeEndFraction = closestFractionOnPath(
          oppositeReference, closed, rangeData.oppositeEndPoint
        );
      }
      if (guide && guide.fullRange) {
        rangeData.grooveStartFraction = 0;
        rangeData.grooveEndFraction = 1;
        ranges.push(Object.assign({ start: 0, end: 1 }, rangeData));
        return;
      }
      const hasPlanBoundaries = !!(
        guide &&
        guide.sourceStartFraction != null &&
        guide.sourceEndFraction != null &&
        Number.isFinite(Number(guide.sourceStartFraction)) &&
        Number.isFinite(Number(guide.sourceEndFraction))
      );
      let start = hasPlanBoundaries
        ? normalizedFraction(Number(guide.sourceStartFraction))
        : center - halfFraction;
      let end = hasPlanBoundaries
        ? normalizedFraction(Number(guide.sourceEndFraction))
        : center + halfFraction;
      rangeData.grooveStartFraction = normalizedFraction(start);
      rangeData.grooveEndFraction = normalizedFraction(end);

      if (hasPlanBoundaries && closed) {
        // A largura física também vem da planificação: bordas = dxf_x ±
        // raio da fresa, depois mapeadas para a face curvada. Reaplicar os
        // 6 mm diretamente no raio interno fazia um passo planificado de
        // 9 mm virar ~5 mm entre centros, mas mantinha canais de 6 mm e
        // apagava por sobreposição os 3 mm de MDF que deveriam restar.
        if (start > end) {
          ranges.push(
            Object.assign({ start: start, end: 1 }, rangeData),
            Object.assign({ start: 0, end: end }, rangeData)
          );
        } else if (end > start + 1e-8) {
          ranges.push(Object.assign({ start: start, end: end }, rangeData));
        }
      } else if (closed && start < 0) {
        ranges.push(
          Object.assign({ start: 0, end: end }, rangeData),
          Object.assign({ start: 1 + start, end: 1 }, rangeData)
        );
      } else if (closed && end > 1) {
        ranges.push(
          Object.assign({ start: start, end: 1 }, rangeData),
          Object.assign({ start: 0, end: end - 1 }, rangeData)
        );
      } else {
        start = clamp3d(start, 0, 1);
        end = clamp3d(end, 0, 1);
        if (end < start) {
          const swap = start;
          start = end;
          end = swap;
        }
        if (end > start + 1e-8) {
          ranges.push(Object.assign({ start: start, end: end }, rangeData));
        }
      }
    });

    const breakpoints = [0, 1];
    const baseSegments = Math.max(80, edgeA.length);
    for (let i = 1; i < baseSegments; i += 1) breakpoints.push(i / baseSegments);
    // A polilinha publicada pelo backend é a mesma usada pela planta/DXF.
    // Nenhum quad pode atravessar um vértice real dessa face: nesse ponto a
    // tangente (e portanto a normal da fresagem) muda de segmento.
    for (let i = 1; i < refData.segmentCount; i += 1) {
      breakpoints.push(refData.lengths[i] / Math.max(refData.total, 1e-9));
    }
    ranges.forEach(function (range) {
      breakpoints.push(range.start, range.end);
    });
    breakpoints.sort(function (a, b) { return a - b; });
    const uniqueBreakpoints = breakpoints.filter(function (value, index, values) {
      return index === 0 || Math.abs(value - values[index - 1]) > 1e-7;
    });

    const grooveAt = function (fraction) {
      return ranges.find(function (range) {
        return fraction > range.start + 1e-8 && fraction < range.end - 1e-8;
      });
    };
    const localFaceTangent = function (edge, fraction) {
      const data = edge === edgeA ? edgeAData : edgeBData;
      const normalized = normalizedFraction(fraction);
      const distance = data.total * normalized;
      const segmentTangent = function (segmentIndex) {
        const start = edge[segmentIndex];
        const end = edge[(segmentIndex + 1) % edge.length];
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const length = Math.hypot(dx, dy) || 1;
        return [dx / length, dy / length];
      };
      // Em um vértice real, usar apenas o segmento anterior faz a seção do
      // canto atravessar o tampo. A bissetriz encontra o miter correspondente
      // na face oposta e é compartilhada pelos quads dos dois segmentos.
      const boundaryTolerance = Math.max(1e-7, data.total * 1e-10);
      let boundaryIndex = null;
      if (closed && (
        distance <= boundaryTolerance ||
        Math.abs(distance - data.total) <= boundaryTolerance
      )) {
        boundaryIndex = 0;
      } else {
        for (let index = 1; index < data.segmentCount; index += 1) {
          if (Math.abs(distance - data.lengths[index]) <= boundaryTolerance) {
            boundaryIndex = index;
            break;
          }
        }
      }
      if (boundaryIndex != null && (closed || (
        boundaryIndex > 0 && boundaryIndex < data.segmentCount
      ))) {
        const previousIndex = (
          boundaryIndex - 1 + data.segmentCount
        ) % data.segmentCount;
        const nextIndex = boundaryIndex % data.segmentCount;
        const previous = segmentTangent(previousIndex);
        const next = segmentTangent(nextIndex);
        const directionDot = previous[0] * next[0] + previous[1] * next[1];
        if (directionDot < -0.8) {
          // Alguns offsets arredondados trazem um micro-retorno submilimétrico
          // no encontro reta/arco. Ele não é uma quina física e sua bissetriz
          // quase nula lançaria o raio para uma face distante.
          const previousLength = (
            data.lengths[previousIndex + 1] - data.lengths[previousIndex]
          );
          const nextLength = data.lengths[nextIndex + 1] - data.lengths[nextIndex];
          return nextLength >= previousLength ? next : previous;
        }
        const sumX = previous[0] + next[0];
        const sumY = previous[1] + next[1];
        const sumLength = Math.hypot(sumX, sumY);
        if (sumLength > 1e-8) return [sumX / sumLength, sumY / sumLength];
        return next;
      }
      let segmentIndex = Math.max(0, data.segmentCount - 1);
      for (let index = 0; index < data.segmentCount; index += 1) {
        if (distance <= data.lengths[index + 1] + 1e-9) {
          segmentIndex = index;
          break;
        }
      }
      return segmentTangent(segmentIndex);
    };
    const localFaceNormal = function (edge, fraction, targetDirection) {
      const tangent = localFaceTangent(edge, fraction);
      let nx = -tangent[1];
      let ny = tangent[0];
      if (nx * targetDirection[0] + ny * targetDirection[1] < 0) {
        nx = -nx;
        ny = -ny;
      }
      return [nx, ny];
    };
    const moveAlong = function (point, direction, distance) {
      return [point[0] + direction[0] * distance, point[1] + direction[1] * distance];
    };
    const cross2d = function (a, b) {
      return a[0] * b[1] - a[1] * b[0];
    };
    const closestPointOnEdge = function (target, edge) {
      const data = edge === edgeA ? edgeAData : edgeBData;
      let best = null;
      let bestDistanceSquared = Infinity;
      for (let segmentIndex = 0; segmentIndex < data.segmentCount; segmentIndex += 1) {
        const start = edge[segmentIndex];
        const end = edge[(segmentIndex + 1) % edge.length];
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const lengthSquared = dx * dx + dy * dy;
        const segmentFraction = lengthSquared > 1e-12
          ? clamp3d(
            ((target[0] - start[0]) * dx + (target[1] - start[1]) * dy) / lengthSquared,
            0,
            1
          )
          : 0;
        const point = [
          start[0] + dx * segmentFraction,
          start[1] + dy * segmentFraction,
        ];
        const distanceSquared = (
          (point[0] - target[0]) * (point[0] - target[0]) +
          (point[1] - target[1]) * (point[1] - target[1])
        );
        if (distanceSquared < bestDistanceSquared) {
          const segmentLength = Math.sqrt(lengthSquared);
          bestDistanceSquared = distanceSquared;
          best = {
            point: point,
            edgeFraction: data.total > 1e-9
              ? (data.lengths[segmentIndex] + segmentLength * segmentFraction) / data.total
              : 0,
          };
        }
      }
      return best;
    };
    const rayHitOnEdge = function (source, direction, oppositeEdge, fallbackPoint) {
      const oppositeData = oppositeEdge === edgeA ? edgeAData : edgeBData;
      let nearest = null;
      const segmentCount = closed ? oppositeEdge.length : Math.max(0, oppositeEdge.length - 1);
      for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
        const start = oppositeEdge[segmentIndex];
        const end = oppositeEdge[(segmentIndex + 1) % oppositeEdge.length];
        const segment = [end[0] - start[0], end[1] - start[1]];
        const denominator = cross2d(direction, segment);
        if (Math.abs(denominator) < 1e-9) continue;
        const delta = [start[0] - source[0], start[1] - source[1]];
        const rayDistance = cross2d(delta, segment) / denominator;
        const segmentFraction = cross2d(delta, direction) / denominator;
        if (
          rayDistance > 1e-6 &&
          segmentFraction >= -1e-7 &&
          segmentFraction <= 1 + 1e-7
        ) {
          if (!nearest || rayDistance < nearest.distance) {
            const segmentLength = Math.hypot(segment[0], segment[1]);
            nearest = {
              distance: rayDistance,
              point: moveAlong(source, direction, rayDistance),
              edgeFraction: oppositeData.total > 1e-9
                ? (
                  oppositeData.lengths[segmentIndex] +
                  segmentLength * clamp3d(segmentFraction, 0, 1)
                ) / oppositeData.total
                : 0,
            };
          }
        }
      }
      if (nearest) return nearest;

      // Fallback para discretizações degeneradas. A seção continua normal à
      // face fonte; o ponto oposto por mesma fração serve apenas para estimar
      // a espessura, nunca mais como vértice direto do tampo.
      const projected = (
        (fallbackPoint[0] - source[0]) * direction[0] +
        (fallbackPoint[1] - source[1]) * direction[1]
      );
      const distance = projected > 1e-6 ? projected : thickness;
      const fallbackHit = closestPointOnEdge(
        moveAlong(source, direction, distance),
        oppositeEdge
      );
      return {
        distance: distance,
        point: moveAlong(source, direction, distance),
        edgeFraction: fallbackHit ? fallbackHit.edgeFraction : 0,
      };
    };
    const cutDirectionAt = function (fraction, preferredDirection) {
      const source = pointOn(reference, fraction);
      const closest = closestPointOnEdge(source, oppositeReference);
      const towardMaterial = (
        Array.isArray(preferredDirection) && preferredDirection.length >= 2
      ) ? preferredDirection : (
        closest
          ? [closest.point[0] - source[0], closest.point[1] - source[1]]
          : [0, 0]
      );
      return localFaceNormal(
        reference,
        fraction,
        towardMaterial
      );
    };
    const pairedOppositeAt = function (fraction, range) {
      if (
        !range ||
        !Array.isArray(range.oppositeStartPoint) ||
        !Array.isArray(range.oppositeEndPoint) ||
        !Number.isFinite(range.oppositeStartFraction) ||
        !Number.isFinite(range.oppositeEndFraction) ||
        !Number.isFinite(range.grooveStartFraction) ||
        !Number.isFinite(range.grooveEndFraction)
      ) {
        return null;
      }
      const start = range.grooveStartFraction;
      const end = range.grooveEndFraction;
      let span;
      let offset;
      if (closed) {
        span = (end - start + 1) % 1;
        offset = (normalizedFraction(fraction) - start + 1) % 1;
      } else {
        span = end - start;
        offset = fraction - start;
      }
      if (span <= 1e-10) return null;
      const interpolation = clamp3d(offset / span, 0, 1);
      let oppositeSpan;
      let oppositeFraction;
      if (closed) {
        // Os contornos offset sao independentes e podem chegar com sentidos
        // opostos. As duas bordas de uma fresa de 6 mm sempre delimitam o arco
        // curto entre elas. Forcar modulo positivo fazia um contorno invertido
        // interpolar pela volta longa (quase 100% da peca), criando uma placa
        // retangular na parede interna e uma cunha atravessando o tampo.
        oppositeSpan = (
          range.oppositeEndFraction - range.oppositeStartFraction
        );
        if (oppositeSpan > 0.5) oppositeSpan -= 1;
        else if (oppositeSpan < -0.5) oppositeSpan += 1;
        oppositeFraction = normalizedFraction(
          range.oppositeStartFraction + oppositeSpan * interpolation
        );
      } else {
        oppositeFraction = (
          range.oppositeStartFraction +
          (range.oppositeEndFraction - range.oppositeStartFraction) * interpolation
        );
      }
      return pointOn(oppositeReference, oppositeFraction);
    };
    const sectionAt = function (fraction, grooved, range) {
      const source = pointOn(reference, fraction);
      const fallbackOpposite = pointOn(oppositeReference, fraction);
      let direction = cutDirectionAt(
        fraction,
        range && Array.isArray(range.guideNormal) ? range.guideNormal : null
      );
      let hit = null;
      let pairedFloor = null;
      if (grooved && range && range.fullRange) {
        const localOpposite = closestPointOnEdge(source, oppositeReference);
        if (localOpposite) {
          const vector = [
            localOpposite.point[0] - source[0],
            localOpposite.point[1] - source[1],
          ];
          const distance = Math.hypot(vector[0], vector[1]);
          if (distance > 1e-7) {
            direction = [vector[0] / distance, vector[1] / distance];
            hit = {
              distance: distance,
              point: localOpposite.point,
              edgeFraction: localOpposite.edgeFraction,
            };
            pairedFloor = [
              source[0] + vector[0] * depthRatio,
              source[1] + vector[1] * depthRatio,
            ];
          }
        }
      }
      const pairedOpposite = grooved && options.usePairedPlanSections
        && !(range && range.fullRange)
        ? pairedOppositeAt(fraction, range)
        : null;
      if (pairedOpposite) {
        const pairedVector = [
          pairedOpposite[0] - source[0],
          pairedOpposite[1] - source[1],
        ];
        const pairedDistance = Math.hypot(pairedVector[0], pairedVector[1]);
        if (pairedDistance > 1e-7) {
          direction = [
            pairedVector[0] / pairedDistance,
            pairedVector[1] / pairedDistance,
          ];
          const pairedFrame = closestPointOnEdge(
            pairedOpposite, oppositeReference
          );
          hit = {
            distance: pairedDistance,
            point: pairedOpposite,
            edgeFraction: pairedFrame ? pairedFrame.edgeFraction : 0,
          };
          // A peça é usinada plana e depois dobrada. No preview montado, o
          // fundo do canal precisa manter a mesma coordenada relativa através
          // da espessura (17/18). Avançar 17 mm euclidianos após a dobra fazia
          // os fundos vizinhos se cruzarem nos raios apertados.
          pairedFloor = [
            source[0] + pairedVector[0] * depthRatio,
            source[1] + pairedVector[1] * depthRatio,
          ];
        }
      }
      if (!hit) {
        hit = rayHitOnEdge(
          source, direction, oppositeReference, fallbackOpposite
        );
      }
      // A profundidade pertence ao plano CNC: MDF 18 mm - pele 1 mm = 17 mm.
      // Não a reduza por aproximações entre os contornos já curvados; isso
      // fazia alguns canais internos ficarem mais rasos justamente nos raios.
      const floorDepth = grooved ? cutDepth : 0;
      const floor = pairedFloor || moveAlong(source, direction, floorDepth);
      if (cutFrom === "a") {
        return {
          a: source,
          b: hit.point,
          aFraction: normalizedFraction(fraction),
          bFraction: normalizedFraction(hit.edgeFraction),
          source: source,
          opposite: hit.point,
          floor: floor,
          direction: direction,
          availableDepth: hit.distance,
        };
      }
      return {
        a: hit.point,
        b: source,
        aFraction: normalizedFraction(hit.edgeFraction),
        bFraction: normalizedFraction(fraction),
        source: source,
        opposite: hit.point,
        floor: floor,
        direction: direction,
        availableDepth: hit.distance,
      };
    };
    const auditedGuideIds = new Set();
    ranges.forEach(function (range) {
      range.direction = cutDirectionAt(
        range.center,
        Array.isArray(range.guideNormal) ? range.guideNormal : null
      );
      if (
        Array.isArray(options.auditTarget) &&
        !auditedGuideIds.has(range.guideId)
      ) {
        auditedGuideIds.add(range.guideId);
        // As duas paredes são a geometria física da fresa. A linha central do
        // fundo é apenas uma interpolação para fechar a malha e não deve ser
        // usada para afirmar se o canal está perpendicular à face.
        [
          range.grooveStartFraction,
          range.grooveEndFraction,
        ].forEach(function (wallFraction, wallIndex) {
          const section = sectionAt(wallFraction, true, range);
          const source = section.source;
          const direction = section.direction;
          const expectedDirection = cutDirectionAt(
            wallFraction,
            Array.isArray(range.guideNormal) ? range.guideNormal : direction
          );
          const plantDirection = expectedDirection;
          const plantLength = Math.hypot(plantDirection[0], plantDirection[1]) || 1;
          const directionLength = Math.hypot(direction[0], direction[1]) || 1;
          const alignment = (
            (plantDirection[0] * direction[0] + plantDirection[1] * direction[1]) /
            (plantLength * directionLength)
          );
          const plannedMouth = wallIndex === 0
            ? range.mouthStartPoint
            : range.mouthEndPoint;
          const lineOffset = plannedMouth
            ? Math.hypot(
              source[0] - plannedMouth[0],
              source[1] - plannedMouth[1]
            )
            : 0;
          const localTangent = localFaceTangent(reference, wallFraction);
          const perpendicularDot = Math.abs(
            localTangent[0] * (direction[0] / directionLength)
            + localTangent[1] * (direction[1] / directionLength)
          );
          options.auditTarget.push({
            piece: options.auditKind || role,
            sourceFace: cutFrom,
            sourceFaceName: sourceFaceName,
            plannedSourceFace: range.sourceFace,
            sourceFaceMatchesPlan: !range.sourceFace || range.sourceFace === sourceFaceName,
            plantPoint: range.plantPoint,
            sourcePoint: source,
            plantDirection: plantDirection,
            direction: direction,
            wall: wallIndex === 0 ? "start" : "end",
            angleErrorDeg: Math.acos(clamp3d(alignment, -1, 1)) * 180 / Math.PI,
            perpendicularErrorDeg: Math.asin(clamp3d(perpendicularDot, 0, 1)) * 180 / Math.PI,
            lineOffsetMm: lineOffset,
            sourceStation: range.sourceStation,
            dxfX: range.dxfX,
            group: range.group,
          });
        });
      }
    });
    const worldNormal = function (normal) {
      return [normal[0], 0, -normal[1]];
    };
    const to3 = function (point, y) {
      return [point[0], y, -point[1]];
    };
    const woodPositions = [];
    const woodUvs = [];
    const woodNormals = [];
    const corePositions = [];
    const groovePositions = [];
    const triangle = function (target, a, b, c) {
      target.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    };
    const quad = function (target, a, b, c, d) {
      triangle(target, a, b, c);
      triangle(target, a, c, d);
    };
    const woodQuad = function (a, b, c, d, u0, u1, normals) {
      quad(woodPositions, a, b, c, d);
      woodUvs.push(u0, 0, u0, 1, u1, 1, u0, 0, u1, 1, u1, 0);
      [normals[0], normals[1], normals[2], normals[0], normals[2], normals[3]].forEach(function (normal) {
        woodNormals.push(normal[0], normal[1], normal[2]);
      });
    };

    const cleanPlanarBoundary = function (points, isClosed) {
      let cleaned = [];
      points.forEach(function (point) {
        if (
          !cleaned.length ||
          Math.hypot(
            point[0] - cleaned[cleaned.length - 1][0],
            point[1] - cleaned[cleaned.length - 1][1]
          ) > 1e-5
        ) {
          cleaned.push([point[0], point[1]]);
        }
      });
      if (
        isClosed && cleaned.length > 2 &&
        Math.hypot(
          cleaned[0][0] - cleaned[cleaned.length - 1][0],
          cleaned[0][1] - cleaned[cleaned.length - 1][1]
        ) <= 1e-5
      ) {
        cleaned.pop();
      }

      // A planta/backend já publica o contorno físico definitivo. Aqui só
      // eliminamos duplicatas e pontos estritamente colineares; remover um
      // "micro-retorno" apenas no 3D encurtava a peça interna e criava cunhas
      // que não existem no DXF.
      let changed = true;
      let passes = 0;
      while (changed && cleaned.length > (isClosed ? 3 : 2) && passes < 12) {
        changed = false;
        passes += 1;
        const next = [];
        for (let index = 0; index < cleaned.length; index += 1) {
          if (!isClosed && (index === 0 || index === cleaned.length - 1)) {
            next.push(cleaned[index]);
            continue;
          }
          const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length];
          const current = cleaned[index];
          const following = cleaned[(index + 1) % cleaned.length];
          const incoming = [current[0] - previous[0], current[1] - previous[1]];
          const outgoing = [following[0] - current[0], following[1] - current[1]];
          const incomingLength = Math.hypot(incoming[0], incoming[1]);
          const outgoingLength = Math.hypot(outgoing[0], outgoing[1]);
          const dot = incomingLength > 1e-9 && outgoingLength > 1e-9
            ? (
              incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
            ) / (incomingLength * outgoingLength)
            : 1;
          const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
          const redundantCollinear = (
            dot > 0.9999999 &&
            Math.abs(cross) <= 1e-7 * Math.max(1, incomingLength * outgoingLength)
          );
          if (
            incomingLength <= 1e-5 ||
            outgoingLength <= 1e-5 ||
            redundantCollinear
          ) {
            changed = true;
          } else {
            next.push(current);
          }
        }
        cleaned = next;
      }
      return cleaned;
    };
    const appendBoundaryPoint = function (target, point) {
      if (
        !target.length ||
        Math.hypot(
          point[0] - target[target.length - 1][0],
          point[1] - target[target.length - 1][1]
        ) > 1e-5
      ) {
        target.push([point[0], point[1]]);
      }
    };
    const faceNormalAt = function (edge, fraction, otherEdge) {
      const point = pointOn(edge, fraction);
      const closest = closestPointOnEdge(point, otherEdge);
      const awayFromMaterial = closest
        ? [point[0] - closest.point[0], point[1] - closest.point[1]]
        : [1, 0];
      return worldNormal(localFaceNormal(edge, fraction, awayFromMaterial));
    };
    const addIndependentFace = function (edge, otherEdge, isFaceA, hidden) {
      if (hidden) return;
      const data = edge === edgeA ? edgeAData : edgeBData;
      for (let index = 0; index < data.segmentCount; index += 1) {
        const p0 = edge[index];
        const p1 = edge[(index + 1) % edge.length];
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) <= 1e-7) continue;
        const f0 = data.lengths[index] / Math.max(data.total, 1e-9);
        const f1 = data.lengths[index + 1] / Math.max(data.total, 1e-9);
        const normal0 = faceNormalAt(edge, f0, otherEdge);
        const normal1 = faceNormalAt(edge, f1, otherEdge);
        if (isFaceA) {
          woodQuad(
            to3(p0, 0), to3(p0, height), to3(p1, height), to3(p1, 0),
            f0 * 2, f1 * 2,
            [normal0, normal0, normal1, normal1]
          );
        } else {
          woodQuad(
            to3(p0, 0), to3(p1, 0), to3(p1, height), to3(p0, height),
            f0 * 2, f1 * 2,
            [normal0, normal1, normal1, normal0]
          );
        }
      }
    };
    const addSourceFaceInterval = function (f0, f1) {
      const p0 = pointOn(reference, f0);
      const p1 = pointOn(reference, f1);
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) <= 1e-7) return;
      const other = cutFrom === "a" ? edgeB : edgeA;
      const normal0 = faceNormalAt(reference, f0, other);
      const normal1 = faceNormalAt(reference, f1, other);
      if (cutFrom === "a") {
        woodQuad(
          to3(p0, 0), to3(p0, height), to3(p1, height), to3(p1, 0),
          f0 * 2, f1 * 2,
          [normal0, normal0, normal1, normal1]
        );
      } else {
        woodQuad(
          to3(p0, 0), to3(p1, 0), to3(p1, height), to3(p0, height),
          f0 * 2, f1 * 2,
          [normal0, normal1, normal1, normal0]
        );
      }
    };
    const sourceBoundary = [];
    const intervals = [];
    for (let index = 0; index < uniqueBreakpoints.length - 1; index += 1) {
      const f0 = uniqueBreakpoints[index];
      const f1 = uniqueBreakpoints[index + 1];
      if (f1 <= f0 + 1e-8) continue;
      const grooveRange = grooveAt((f0 + f1) / 2);
      const grooved = Boolean(grooveRange);
      const section0 = sectionAt(f0, grooved, grooveRange);
      const section1 = sectionAt(f1, grooved, grooveRange);
      intervals.push({
        f0: f0,
        f1: f1,
        range: grooveRange || null,
        grooved: grooved,
        section0: section0,
        section1: section1,
      });

      if (grooved) {
        appendBoundaryPoint(sourceBoundary, section0.floor);
        appendBoundaryPoint(sourceBoundary, section1.floor);
        if (cutFrom === "a") {
          quad(
            groovePositions,
            to3(section0.floor, 0), to3(section1.floor, 0),
            to3(section1.floor, height), to3(section0.floor, height)
          );
        } else {
          quad(
            groovePositions,
            to3(section0.floor, 0), to3(section0.floor, height),
            to3(section1.floor, height), to3(section1.floor, 0)
          );
        }
      } else {
        appendBoundaryPoint(sourceBoundary, section0.source);
        appendBoundaryPoint(sourceBoundary, section1.source);
        const sourceHidden = cutFrom === "a" ? hideFaceA : hideFaceB;
        if (!sourceHidden) addSourceFaceInterval(f0, f1);
      }
    }

    // A face oposta nunca depende das seções lançadas da face fresada. Ela usa
    // o próprio contorno, impedindo que um raio em uma quina acerte outro ramo.
    if (cutFrom === "a") {
      addIndependentFace(edgeB, edgeA, false, hideFaceB);
    } else {
      addIndependentFace(edgeA, edgeB, true, hideFaceA);
    }

    // Paredes de entrada/saída de cada canal. No fechamento 0/1, duas metades
    // do mesmo friso continuam como um único canal, sem parede artificial.
    const transitionCount = closed ? intervals.length : Math.max(0, intervals.length - 1);
    for (let index = 0; index < transitionCount; index += 1) {
      const before = intervals[index];
      const after = intervals[(index + 1) % intervals.length];
      if (before.grooved === after.grooved) continue;
      const fraction = index === intervals.length - 1 ? 0 : after.f0;
      const transitionRange = before.range || after.range;
      if (transitionRange) {
        const transitionSection = sectionAt(fraction, true, transitionRange);
        const source = transitionSection.source;
        const floor = transitionSection.floor;
        quad(
          groovePositions,
          to3(source, 0), to3(source, height), to3(floor, height), to3(floor, 0)
        );
      }
    }

    const addPathToShape = function (path, points) {
      if (!Array.isArray(points) || points.length < 3) {
        throw new Error(
          "Contorno insuficiente para a tampa da parede usinada: " +
          (Array.isArray(points) ? points.length : "inválido")
        );
      }
      points.forEach(function (point, index) {
        if (index === 0) path.moveTo(point[0], point[1]);
        else path.lineTo(point[0], point[1]);
      });
      path.closePath();
    };
    const makeCapShape = function () {
      const cleanSource = cleanPlanarBoundary(sourceBoundary, closed);
      if (cleanSource.length < 3) {
        throw new Error("Não foi possível formar o fundo físico do desbaste.");
      }
      const cleanA = cutFrom === "a"
        ? cleanSource
        : cleanPlanarBoundary(edgeA, closed);
      const cleanB = cutFrom === "b"
        ? cleanSource
        : cleanPlanarBoundary(edgeB, closed);
      if (closed) {
        const aIsOuter = Math.abs(signedArea(cleanA)) >= Math.abs(signedArea(cleanB));
        let outer = (aIsOuter ? cleanA : cleanB).slice();
        let hole = (aIsOuter ? cleanB : cleanA).slice();
        const outerVectors = outer.map(function (point) {
          return new THREE.Vector2(point[0], point[1]);
        });
        const holeVectors = hole.map(function (point) {
          return new THREE.Vector2(point[0], point[1]);
        });
        if (!THREE.ShapeUtils.isClockWise(outerVectors)) outer = outer.reverse();
        if (THREE.ShapeUtils.isClockWise(holeVectors)) hole = hole.reverse();
        const shape = new THREE.Shape();
        addPathToShape(shape, outer);
        const holePath = new THREE.Path();
        addPathToShape(holePath, hole);
        shape.holes.push(holePath);
        return shape;
      }

      const polygon = cleanPlanarBoundary(
        cleanA.concat(cleanB.slice().reverse()),
        true
      );
      const shape = new THREE.Shape();
      addPathToShape(shape, polygon);
      return shape;
    };
    const appendCapTriangles = function () {
      const shape = makeCapShape();
      const capGeometry = new THREE.ShapeGeometry(shape, 1);
      const trianglesGeometry = capGeometry.index
        ? capGeometry.toNonIndexed()
        : capGeometry;
      const capAttribute = trianglesGeometry.getAttribute("position");
      for (let index = 0; index < capAttribute.count; index += 3) {
        const a = [capAttribute.getX(index), capAttribute.getY(index)];
        const b = [capAttribute.getX(index + 1), capAttribute.getY(index + 1)];
        const c = [capAttribute.getX(index + 2), capAttribute.getY(index + 2)];
        const doubleArea = Math.abs(
          (b[0] - a[0]) * (c[1] - a[1]) -
          (b[1] - a[1]) * (c[0] - a[0])
        );
        if (doubleArea <= 1e-8) continue;
        triangle(corePositions, to3(a, height), to3(b, height), to3(c, height));
        triangle(corePositions, to3(a, 0), to3(c, 0), to3(b, 0));
      }
      if (trianglesGeometry !== capGeometry) trianglesGeometry.dispose();
      capGeometry.dispose();
    };
    appendCapTriangles();

    if (!closed) {
      [0, 1].forEach(function (fraction, endpointIndex) {
        const a = pointOn(edgeA, fraction);
        const b = pointOn(edgeB, fraction);
        if (endpointIndex === 0) {
          quad(corePositions, to3(a, 0), to3(b, 0), to3(b, height), to3(a, height));
        } else {
          quad(corePositions, to3(a, 0), to3(a, height), to3(b, height), to3(b, 0));
        }
      });
    }

    const addSurface = function (positions, surfaceMaterial, surfaceRole, uvs, normals) {
      if (!positions.length) return;
      const surfaceGeometry = new THREE.BufferGeometry();
      surfaceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      if (uvs && uvs.length) {
        surfaceGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      }
      if (normals && normals.length === positions.length) {
        surfaceGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      } else {
        surfaceGeometry.computeVertexNormals();
      }
      const mesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
      mesh.userData.previewRole = surfaceRole;
      mesh.castShadow = surfaceRole !== "groove";
      mesh.receiveShadow = false;
      group.add(mesh);
    };

    addSurface(woodPositions, woodMaterial, role, woodUvs, woodNormals);
    addSurface(corePositions, coreMaterial, role);
    addSurface(groovePositions, grooveMaterial, "groove");
  }

  function addGround(group, bounds) {
    const width = Math.max(bounds.x, bounds.z, 100) * 2.4;
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xe7ecf3,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, width), groundMaterial);
    ground.userData.previewRole = "ground";
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    group.add(ground);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TAMPO ORGÂNICO — peça montada (resultado pós-usinagem)
  //
  //  O DXF entrega tampo e engrossos planificados com o mesmo contorno
  //  externo. Depois de fresado com a V-bit e colado, a aba externa some e
  //  sobra o chanfro: o engrosso monta recuado e o topo permanece no lugar.
  //  O backend publica esse plano em `preview.montagem` (calcular_preview_
  //  tampo) — aqui só construímos os sólidos.
  // ═══════════════════════════════════════════════════════════════════════

  const TAMPO_TEX_SPAN = 520;      // mm cobertos por uma repetição da textura
  const TAMPO_MIN_EDGE = 1e-4;

  function tampoTexture() {
    if (!state.texture) return null;
    if (!state.tampoTexture) {
      const clone = state.texture.clone();
      clone.wrapS = THREE.RepeatWrapping;
      clone.wrapT = THREE.RepeatWrapping;
      // As UVs desta peça já estão em milímetros reais (ver TAMPO_TEX_SPAN);
      // o repeat da textura compartilhada esticaria o veio de novo.
      clone.repeat.set(1, 1);
      clone.offset.set(0, 0);
      clone.colorSpace = THREE.SRGBColorSpace;
      clone.anisotropy = state.texture.anisotropy || 1;
      clone.needsUpdate = true;
      state.tampoTexture = clone;
    }
    return state.tampoTexture;
  }

  function tampoMaterial(color, roughness) {
    return new THREE.MeshStandardMaterial({
      color: color,
      map: tampoTexture(),
      roughness: roughness === undefined ? 0.62 : roughness,
      metalness: 0,
      side: THREE.FrontSide,
    });
  }

  // As faces de borda são MDF exposto, sem fita. A textura procedural evita
  // que elas pareçam apenas uma faixa lisa ou continuem com o veio da face.
  function rawMdfTexture() {
    if (state.rawMdfTexture) return state.rawMdfTexture;
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    const image = context.createImageData(canvas.width, canvas.height);
    let seed = 173;
    const random = function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let index = 0; index < image.data.length; index += 4) {
      const noise = (random() - 0.5) * 22;
      image.data[index] = Math.max(0, Math.min(255, 170 + noise));
      image.data[index + 1] = Math.max(0, Math.min(255, 127 + noise * 0.7));
      image.data[index + 2] = Math.max(0, Math.min(255, 82 + noise * 0.45));
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    context.globalAlpha = 0.22;
    context.strokeStyle = "#6f4c2d";
    context.lineWidth = 0.45;
    for (let line = 0; line < 34; line += 1) {
      const y = (line / 34) * canvas.height;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y + (random() - 0.5) * 5);
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.4, 1.35);
    texture.needsUpdate = true;
    state.rawMdfTexture = texture;
    return texture;
  }

  function rawMdfMaterial(color, roughness) {
    return new THREE.MeshStandardMaterial({
      color: color || 0xffffff,
      map: rawMdfTexture(),
      roughness: roughness === undefined ? 0.92 : roughness,
      metalness: 0,
      side: THREE.FrontSide,
    });
  }

  // ── utilitários de caminho ─────────────────────────────────────────────
  function dedupePath(path, closed) {
    if (!Array.isArray(path)) return [];
    const output = [];
    path.forEach(function (point) {
      if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
      const last = output[output.length - 1];
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < TAMPO_MIN_EDGE) return;
      output.push([point[0], point[1]]);
    });
    if (closed && output.length > 1) {
      const first = output[0];
      const last = output[output.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < TAMPO_MIN_EDGE) output.pop();
    }
    return output;
  }

  function ensureCCW(path) {
    return signedArea(path) < 0 ? path.slice().reverse() : path;
  }

  /** Limpa dois caminhos pareados mantendo a correspondência por índice. */
  function dedupePathPair(primary, secondary, closed) {
    const source = Array.isArray(primary) ? primary : [];
    const other = Array.isArray(secondary) ? secondary : [];
    if (other.length !== source.length) {
      return { primary: dedupePath(source, closed), secondary: [] };
    }
    const keptPrimary = [];
    const keptSecondary = [];
    source.forEach(function (point, index) {
      const last = keptPrimary[keptPrimary.length - 1];
      if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < TAMPO_MIN_EDGE) return;
      keptPrimary.push([point[0], point[1]]);
      keptSecondary.push([other[index][0], other[index][1]]);
    });
    if (closed && keptPrimary.length > 3) {
      const first = keptPrimary[0];
      const last = keptPrimary[keptPrimary.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < TAMPO_MIN_EDGE) {
        keptPrimary.pop();
        keptSecondary.pop();
      }
    }
    return { primary: keptPrimary, secondary: keptSecondary };
  }

  /** Normal externa local de um vértice (contorno no sentido anti-horário). */
  function edgeNormal2D(path, index, closed) {
    const count = path.length;
    const point = path[index];
    const hasPrevious = closed || index > 0;
    const hasNext = closed || index < count - 1;
    let tangent = null;
    if (hasPrevious && hasNext) {
      const previous = path[closed ? (index - 1 + count) % count : index - 1];
      const next = path[closed ? (index + 1) % count : index + 1];
      const inX = point[0] - previous[0];
      const inY = point[1] - previous[1];
      const outX = next[0] - point[0];
      const outY = next[1] - point[1];
      const inLength = Math.hypot(inX, inY);
      const outLength = Math.hypot(outX, outY);
      if (inLength > 1e-9 && outLength > 1e-9) {
        tangent = [inX / inLength + outX / outLength,
          inY / inLength + outY / outLength];
      }
    }
    if (!tangent && hasNext) {
      const next = path[closed ? (index + 1) % count : index + 1];
      tangent = [next[0] - point[0], next[1] - point[1]];
    }
    if (!tangent && hasPrevious) {
      const previous = path[closed ? (index - 1 + count) % count : index - 1];
      tangent = [point[0] - previous[0], point[1] - previous[1]];
    }
    const length = Math.hypot(tangent ? tangent[0] : 0, tangent ? tangent[1] : 0) || 1;
    // À direita da tangente = para fora, em contornos anti-horários.
    return [tangent ? tangent[1] / length : 0,
      tangent ? -tangent[0] / length : -1];
  }

  function edgeNormals2D(path, closed) {
    return path.map(function (_, index) {
      return edgeNormal2D(path, index, closed);
    });
  }

  function arcLengths(path, closed) {
    const data = cumulative(path, closed);
    return data.lengths;
  }

  /** Linha visual na união horizontal entre duas chapas da montagem.
   *
   * Ela fica alguns décimos de milímetro para fora da face apenas para evitar
   * z-fighting. Não representa rasgo nem entra no plano de usinagem.
   */
  function addLayerBoundary(group, path, y, closed, inner, lineMaterial) {
    const cleanPath = dedupePath(path, closed);
    if (cleanPath.length < 2 || !lineMaterial) return null;
    const normals = edgeNormals2D(cleanPath, closed);
    const direction = inner ? -1 : 1;
    const displayOffset = 0.3;
    const points = cleanPath.map(function (point, index) {
      const normal = normals[index];
      return new THREE.Vector3(
        point[0] + normal[0] * displayOffset * direction,
        y,
        -(point[1] + normal[1] * displayOffset * direction)
      );
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = closed
      ? new THREE.LineLoop(geometry, lineMaterial)
      : new THREE.Line(geometry, lineMaterial);
    line.renderOrder = 12;
    line.userData.previewRole = "layerBoundary";
    group.add(line);
    return line;
  }

  const worldPoint = function (point, y) {
    return [point[0], y, -point[1]];
  };

  // ── acumulador de superfícies ──────────────────────────────────────────
  function surfaceBuilder() {
    return { position: [], normal: [], uv: [] };
  }

  function pushVertex(builder, point, normal, uv) {
    builder.position.push(point[0], point[1], point[2]);
    builder.normal.push(normal[0], normal[1], normal[2]);
    builder.uv.push(uv[0], uv[1]);
  }

  function pushTriangle(builder, a, b, c) {
    pushVertex(builder, a.p, a.n, a.uv);
    pushVertex(builder, b.p, b.n, b.uv);
    pushVertex(builder, c.p, c.n, c.uv);
  }

  function builderToMesh(builder, meshMaterial, role, group, castShadow) {
    if (!builder.position.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(builder.position, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(builder.normal, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(builder.uv, 2));
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.userData.previewRole = role;
    mesh.castShadow = castShadow !== false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  }

  /**
   * Faixa vertical/inclinada entre dois contornos já pareados ponto a ponto.
   * `outward` = true quando a face olha para fora do contorno.
   */
  function addWallStrip(builder, bottom, yBottom, top, yTop, options) {
    const settings = options || {};
    const count = Math.min(bottom.length, top.length);
    if (count < 2) return;
    const closed = !!settings.closed;
    const outward = settings.outward !== false;
    const normalsBottom = settings.normalsBottom || edgeNormals2D(bottom, closed);
    const normalsTop = settings.normalsTop || normalsBottom;
    const lengths = settings.lengths || arcLengths(bottom, closed);
    const segmentCount = closed ? count : count - 1;
    const span = TAMPO_TEX_SPAN;

    const vertex = function (index, isTop) {
      const path = isTop ? top : bottom;
      const y = isTop ? yTop : yBottom;
      const flat = (isTop ? normalsTop : normalsBottom)[index];
      // Perfil visto no plano (normal externa, altura): a tangente vai de
      // (0, yBottom) a (ds, yTop). A normal da superfície é (h, -ds): num
      // chanfro que recua ao subir (ds < 0) ela olha para fora e para cima.
      const dx = top[index][0] - bottom[index][0];
      const dy = top[index][1] - bottom[index][1];
      const ds = dx * flat[0] + dy * flat[1];
      const vertical = yTop - yBottom;
      let normal;
      if (Math.abs(ds) > 1e-6) {
        const length = Math.hypot(vertical, ds) || 1;
        const lateral = vertical / length;
        normal = [flat[0] * lateral, -ds / length, -flat[1] * lateral];
      } else {
        normal = [flat[0], 0, -flat[1]];
      }
      if (!outward) normal = [-normal[0], -normal[1], -normal[2]];
      const u = y / span;
      const v = (lengths[Math.min(index, lengths.length - 1)] || 0) / span;
      return { p: worldPoint(path[index], y), n: normal, uv: [u, v] };
    };

    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % count;
      const a0 = vertex(index, false);
      const a1 = vertex(next, false);
      const b1 = vertex(next, true);
      const b0 = vertex(index, true);
      if (next === 0 && closed) {
        // fecha o anel reusando o comprimento total no último quad
        const total = lengths[lengths.length - 1] || 0;
        a1.uv = [a1.uv[0], total / span];
        b1.uv = [b1.uv[0], total / span];
      }
      if (outward) {
        pushTriangle(builder, a0, a1, b1);
        pushTriangle(builder, a0, b1, b0);
      } else {
        pushTriangle(builder, a0, b1, a1);
        pushTriangle(builder, a0, b0, b1);
      }
    }
  }

  /**
   * Faixa chanfrada entre dois contornos fechados independentes.
   *
   * Os contornos offset podem ter comprimentos e quinas diferentes. Por isso
   * não fazemos quads entre o ponto N de um e o ponto N do outro: o Earcut
   * triangula o anel inteiro e cada vértice conserva a altura da borda a que
   * pertence.
   */
  function addSlopedRing(builder, outer, inner, yOuter, yInner, outward, closed,
                          pairedByIndex) {
    const isClosed = closed !== false;
    const pairedPaths = pairedByIndex
      ? dedupePathPair(outer, inner, isClosed)
      : null;
    const outerPath = pairedPaths
      ? pairedPaths.primary
      : dedupePath(outer, isClosed);
    const innerPath = pairedPaths
      ? pairedPaths.secondary
      : dedupePath(inner, isClosed);
    if (outerPath.length < (isClosed ? 3 : 2) || innerPath.length < (isClosed ? 3 : 2)) {
      return false;
    }
    // Cada vértice do contorno externo encontra o contorno interno pela
    // normal geométrica. Isso evita a ligação pela mesma fração de perímetro
    // e mantém a malha local, sem os triângulos diagonais que atravessavam
    // toda a faixa orgânica quando o anel era triangulado como um único polígono.
    // No chanfro dos engrossos, topo e base chegam do mesmo plano 3D e têm
    // correspondência 1:1. Recalcular por raio normal aqui fazia a primeira
    // camada parecer correta, mas trocava o ramo da curva nas camadas mais
    // internas. O pareamento normal continua reservado aos contornos
    // independentes, como o chanfro do tampo.
    const pairedInner = pairedPaths
      ? pairedPaths.secondary
      : pairPathByNormal(outerPath, innerPath, isClosed);
    if (pairedInner.length !== outerPath.length) return false;
    const outerNormals = edgeNormals2D(outerPath, isClosed);
    const lengths = arcLengths(outerPath, isClosed);
    const segmentCount = isClosed ? outerPath.length : outerPath.length - 1;
    const vertex = function (index, isOuter) {
      const point = isOuter ? outerPath[index] : pairedInner[index];
      const flat = outerNormals[index];
      const opposite = pairedInner[index];
      const dx = outerPath[index][0] - opposite[0];
      const dy = outerPath[index][1] - opposite[1];
      const ds = dx * flat[0] + dy * flat[1];
      const vertical = yOuter - yInner;
      const slopeLength = Math.hypot(vertical, ds) || 1;
      const lateral = vertical / slopeLength;
      let normal = [
        flat[0] * lateral,
        -ds / slopeLength,
        -flat[1] * lateral,
      ];
      if (!outward) normal = [-normal[0], -normal[1], -normal[2]];
      return {
        p: worldPoint(point, isOuter ? yOuter : yInner),
        n: normal,
        uv: [
          (isOuter ? yOuter : yInner) / TAMPO_TEX_SPAN,
          (lengths[Math.min(index, lengths.length - 1)] || 0) / TAMPO_TEX_SPAN,
        ],
      };
    };
    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % outerPath.length;
      const innerA = vertex(index, false);
      const innerB = vertex(next, false);
      const outerB = vertex(next, true);
      const outerA = vertex(index, true);
      const expected = [
        (innerA.n[0] + innerB.n[0] + outerA.n[0] + outerB.n[0]) / 4,
        (innerA.n[1] + innerB.n[1] + outerA.n[1] + outerB.n[1]) / 4,
        (innerA.n[2] + innerB.n[2] + outerA.n[2] + outerB.n[2]) / 4,
      ];
      // As duas faces são independentes; o helper só escolhe o winding que
      // corresponde à normal da seção, sem criar um quad transversal único.
      pushOriented(builder, innerA, innerB, outerB, expected);
      pushOriented(builder, innerA, outerB, outerA, expected);
    }
    return true;
  }

  /** Triangulação de uma tampa (contorno + furos), devolvida em 2D. */
  function capTriangles(contour, holes) {
    const outline = dedupePath(contour, true);
    if (outline.length < 3) return null;
    const contourCCW = ensureCCW(outline);
    const holeList = (holes || [])
      .map(function (hole) { return dedupePath(hole, true); })
      .filter(function (hole) { return hole.length >= 3; })
      .map(function (hole) {
        return signedArea(hole) > 0 ? hole.slice().reverse() : hole;
      });
    const toVector = function (point) { return new THREE.Vector2(point[0], point[1]); };
    let faces;
    try {
      faces = THREE.ShapeUtils.triangulateShape(
        contourCCW.map(toVector),
        holeList.map(function (hole) { return hole.map(toVector); })
      );
    } catch (_error) {
      return null;
    }
    const vertices = contourCCW.slice();
    holeList.forEach(function (hole) {
      hole.forEach(function (point) { vertices.push(point); });
    });
    return { vertices: vertices, faces: faces };
  }

  function addCap(builder, contour, holes, y, upward) {
    const triangulated = capTriangles(contour, holes);
    if (!triangulated) return false;
    const span = TAMPO_TEX_SPAN;
    const normal = upward ? [0, 1, 0] : [0, -1, 0];
    const makeVertex = function (point) {
      return {
        p: worldPoint(point, y),
        n: normal,
        // Veio da chapa acompanha o eixo X do desenho (V da textura).
        uv: [point[1] / span, point[0] / span],
      };
    };
    triangulated.faces.forEach(function (face) {
      const a = triangulated.vertices[face[0]];
      const b = triangulated.vertices[face[1]];
      const c = triangulated.vertices[face[2]];
      if (!a || !b || !c) return;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-9) return;
      // Anti-horário em 2D = normal para cima no mundo (z = -y).
      const ccw = area > 0;
      const ordered = (ccw === !!upward) ? [a, b, c] : [a, c, b];
      pushTriangle(
        builder,
        makeVertex(ordered[0]),
        makeVertex(ordered[1]),
        makeVertex(ordered[2])
      );
    });
    return true;
  }

  /** Empurra o triângulo com o winding que corresponde à normal informada. */
  function pushOriented(builder, a, b, c, normal) {
    const ux = b.p[0] - a.p[0];
    const uy = b.p[1] - a.p[1];
    const uz = b.p[2] - a.p[2];
    const vx = c.p[0] - a.p[0];
    const vy = c.p[1] - a.p[1];
    const vz = c.p[2] - a.p[2];
    const cross = [
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx,
    ];
    const dot = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2];
    if (dot >= 0) pushTriangle(builder, a, b, c);
    else pushTriangle(builder, a, c, b);
  }

  /** Traço da emenda de duas peças já coladas.
   *
   * A montagem não ganha uma fresta nem faces de fechamento: isso expunha a
   * triangulação da seção como aletas. Quatro segmentos finos indicam a junta
   * nas faces externa, interna, superior e inferior sem acrescentar material.
   */
  function addPieceSeamLines(group, outerTop, outerBase, inner,
                             isStart, yBottom, yTop, lineMaterial) {
    if (!lineMaterial || !outerTop.length || !outerBase.length || !inner.length) return;
    const indexFor = function (path) { return isStart ? 0 : path.length - 1; };
    const top = outerTop[indexFor(outerTop)];
    const base = outerBase[indexFor(outerBase)];
    const inside = inner[indexFor(inner)];

    const inwardX = inside[0] - top[0];
    const inwardY = inside[1] - top[1];
    const inwardLength = Math.hypot(inwardX, inwardY) || 1;
    const ix = inwardX / inwardLength;
    const iy = inwardY / inwardLength;
    const faceOffset = 0.22;
    const heightOffset = 0.12;
    const shifted = function (point, radial, height) {
      return new THREE.Vector3(
        point[0] + ix * radial,
        height,
        -(point[1] + iy * radial)
      );
    };
    const points = [
      // Face externa: um pouco para fora do chanfro.
      shifted(base, -faceOffset, yBottom),
      shifted(top, -faceOffset, yTop),
      // Face interna: um pouco para dentro da abertura.
      shifted(inside, faceOffset, yBottom),
      shifted(inside, faceOffset, yTop),
      // Faces horizontais, afastadas em Y para não piscar sobre a madeira.
      shifted(top, 0, yTop + heightOffset),
      shifted(inside, 0, yTop + heightOffset),
      shifted(base, 0, yBottom - heightOffset),
      shifted(inside, 0, yBottom - heightOffset),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lines = new THREE.LineSegments(geometry, lineMaterial);
    lines.renderOrder = 13;
    lines.userData.previewRole = "seamIndicator";
    group.add(lines);
  }

  /** Parede cilíndrica de um furo, com fundo opcional. */
  function addHoleGeometry(builder, center, radius, yFace, yEnd, downward, capEnd) {
    const segments = Math.max(12, Math.min(28, Math.round(radius * 4)));
    const span = TAMPO_TEX_SPAN;
    const ring = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      ring.push([
        center[0] + Math.cos(angle) * radius,
        center[1] + Math.sin(angle) * radius,
        Math.cos(angle),
        Math.sin(angle),
      ]);
    }
    for (let index = 0; index < segments; index += 1) {
      const a = ring[index];
      const b = ring[index + 1];
      // Normal aponta para o eixo do furo (parede vista de dentro).
      const na = [-a[2], 0, a[3]];
      const nb = [-b[2], 0, b[3]];
      const u0 = (index / segments) * (radius * 2 * Math.PI) / span;
      const u1 = ((index + 1) / segments) * (radius * 2 * Math.PI) / span;
      const topA = { p: worldPoint(a, yFace), n: na, uv: [u0, yFace / span] };
      const topB = { p: worldPoint(b, yFace), n: nb, uv: [u1, yFace / span] };
      const endA = { p: worldPoint(a, yEnd), n: na, uv: [u0, yEnd / span] };
      const endB = { p: worldPoint(b, yEnd), n: nb, uv: [u1, yEnd / span] };
      // A parede é vista de dentro do furo: o winding é o oposto do de uma
      // parede externa.
      if (downward) {
        pushTriangle(builder, topA, topB, endA);
        pushTriangle(builder, topB, endB, endA);
      } else {
        pushTriangle(builder, topA, endA, topB);
        pushTriangle(builder, topB, endA, endB);
      }
      if (capEnd) {
        // Fundo do furo cego (voltado para a boca).
        const bottomNormal = downward ? [0, 1, 0] : [0, -1, 0];
        const centerVertex = {
          p: worldPoint(center, yEnd),
          n: bottomNormal,
          uv: [center[1] / span, center[0] / span],
        };
        const fa = { p: worldPoint(a, yEnd), n: bottomNormal, uv: [a[1] / span, a[0] / span] };
        const fb = { p: worldPoint(b, yEnd), n: bottomNormal, uv: [b[1] / span, b[0] / span] };
        if (downward) pushTriangle(builder, centerVertex, fa, fb);
        else pushTriangle(builder, centerVertex, fb, fa);
      }
    }
  }

  /** Furo cego real: parede cilíndrica + fundo, aberto na face indicada. */
  function addBlindHole(builder, center, radius, yFace, depth, downward) {
    const yEnd = downward ? yFace - depth : yFace + depth;
    addHoleGeometry(builder, center, radius, yFace, yEnd, downward, true);
  }

  /** Furo passante do engrosso: parede aberta nas faces superior e inferior. */
  function addThroughHole(builder, center, radius, yTop, yBottom) {
    addHoleGeometry(builder, center, radius, yTop, yBottom, true, false);
  }

  function circlePath(center, radius, segments) {
    const output = [];
    const count = segments || 20;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      output.push([
        center[0] + Math.cos(angle) * radius,
        center[1] + Math.sin(angle) * radius,
      ]);
    }
    return output;
  }

  function pointInsidePath(point, path) {
    let inside = false;
    for (let i = 0, j = path.length - 1; i < path.length; j = i, i += 1) {
      const xi = path[i][0];
      const yi = path[i][1];
      const xj = path[j][0];
      const yj = path[j][1];
      if ((yi > point[1]) !== (yj > point[1]) &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + 1e-15) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  /** Sulco em V na face indicada (quando a V-bit não deceppa a aba). */
  function addVGroove(builder, path, closed, yFace, depth, halfWidth, upward) {
    const count = path.length;
    if (count < (closed ? 3 : 2)) return;
    const normals = edgeNormals2D(path, closed);
    const lengths = arcLengths(path, closed);
    const span = TAMPO_TEX_SPAN;
    const yTip = upward ? yFace + depth : yFace - depth;
    const segmentCount = closed ? count : count - 1;
    const flank = function (index, side) {
      const normal = normals[index];
      return [
        path[index][0] + normal[0] * halfWidth * side,
        path[index][1] + normal[1] * halfWidth * side,
      ];
    };
    for (let index = 0; index < segmentCount; index += 1) {
      const next = (index + 1) % count;
      const u = (lengths[Math.min(index, lengths.length - 1)] || 0) / span;
      const uNext = (lengths[Math.min(next, lengths.length - 1)] || 0) / span;
      [1, -1].forEach(function (side) {
        const outerA = flank(index, side);
        const outerB = flank(next, side);
        const normalA = normals[index];
        const normalB = normals[next];
        const slope = Math.hypot(halfWidth, depth) || 1;
        const vertical = (halfWidth / slope) * (upward ? -1 : 1);
        const lateral = depth / slope;
        // Flanco visto de dentro do sulco: a normal olha para o lado oposto
        // ao material e acompanha a inclinação da ferramenta.
        const na = [-normalA[0] * lateral * side, vertical, normalA[1] * lateral * side];
        const nb = [-normalB[0] * lateral * side, vertical, normalB[1] * lateral * side];
        const a = { p: worldPoint(outerA, yFace), n: na, uv: [yFace / span, u] };
        const b = { p: worldPoint(outerB, yFace), n: nb, uv: [yFace / span, uNext] };
        const tipA = { p: worldPoint(path[index], yTip), n: na, uv: [yTip / span, u] };
        const tipB = { p: worldPoint(path[next], yTip), n: nb, uv: [yTip / span, uNext] };
        pushOriented(builder, a, b, tipB, na);
        pushOriented(builder, a, tipB, tipA, na);
      });
    }
  }

  /** Desloca o caminho para dentro pelas normais de cada vértice. */
  function shrinkPath(path, normals, amount) {
    return path.map(function (point, index) {
      return [
        point[0] - normals[index][0] * amount,
        point[1] - normals[index][1] * amount,
      ];
    });
  }

  function buildTampoBody(group, preview, montagem, cavilhas, materials) {
    const points = dedupePath(ensureCCW(preview.points), true);
    if (points.length < 3) return null;
    const yBottom = montagem.z_tampo[0];
    const yTop = montagem.z_tampo[1];
    const chanfro = montagem.chanfro;
    const builder = surfaceBuilder();
    const edgeBuilder = surfaceBuilder();
    const holeBuilder = surfaceBuilder();
    const normals = edgeNormals2D(points, true);
    const lengths = arcLengths(points, true);
    const chanfroContour3d = chanfro && Array.isArray(chanfro.contorno_3d)
      && chanfro.contorno_3d.length >= 3
      ? chanfro.contorno_3d : null;
    const chanfroPts = chanfroContour3d || (chanfro && Array.isArray(preview.chanfro_points)
      && preview.chanfro_points.length >= 3
      ? dedupePath(ensureCCW(preview.chanfro_points), true)
      : null);
    const normalizedChanfroPts = chanfroPts && chanfroPts.length >= 3
      ? dedupePath(ensureCCW(chanfroPts), true)
      : null;
    const bottomContour = chanfro && chanfroPts && chanfroPts.length >= 3
      ? normalizedChanfroPts : points;

    // Furos de cavilha do tampo: abrem na face inferior, entram para cima.
    const cavilhaInfo = montagem.cavilha;
    const holePaths = [];
    if (cavilhaInfo && Array.isArray(cavilhas)) {
      cavilhas.forEach(function (center) {
        if (!pointInsidePath(center, bottomContour)) return;
        holePaths.push(circlePath(center, cavilhaInfo.diametro / 2, 20));
        addBlindHole(
          holeBuilder, center, cavilhaInfo.diametro / 2,
          yBottom, cavilhaInfo.prof_tampo, false
        );
      });
    }

    addCap(builder, bottomContour, holePaths, yBottom, false);

    const hasChanfro = chanfro && chanfro.altura > 0.05
      && bottomContour !== points;
    if (hasChanfro) {
      // O tampo é usinado de ponta-cabeça: o chanfro começa na face inferior
      // e termina dentro do tampo. A face superior permanece inteira.
      // A parede reta restante e a espessura menos a profundidade configurada.
      const profundidadeChanfro = Number.isFinite(chanfro.profundidade)
        ? Math.max(0, chanfro.profundidade)
        : Math.max(0, chanfro.altura);
      const bevelTop = Math.min(yBottom + profundidadeChanfro, yTop);
      addSlopedRing(edgeBuilder, points, bottomContour, bevelTop, yBottom, true, true);
      if (bevelTop < yTop - 0.01) {
        addWallStrip(edgeBuilder, points, bevelTop, points, yTop, {
          closed: true, outward: true, normalsBottom: normals, lengths: lengths,
        });
      }
      addCap(builder, points, [], yTop, true);
    } else {
      addWallStrip(edgeBuilder, points, yBottom, points, yTop, {
        closed: true, outward: true, normalsBottom: normals, lengths: lengths,
      });
      addCap(builder, points, [], yTop, true);
    }

    builderToMesh(builder, materials.wood, "tampo", group, true);
    builderToMesh(edgeBuilder, materials.rawMdf, "rawMdfEdge", group, true);
    builderToMesh(holeBuilder, materials.hole, "blindHole", group, false);
    addXrayOutline(group, points, yTop, true);
    addXrayOutline(group, bottomContour, yBottom, true);
    return { points: points, yBottom: yBottom, yTop: yTop };
  }

  function buildEngrossoPiece(group, piece, engrosso, cavilhaInfo, materials) {
    const closed = !!piece.closed;
    // Topo e base do chanfro chegam pareados 1:1 do backend; qualquer limpeza
    // precisa remover o mesmo índice nos dois, senão o loft embaralha.
    const pair = dedupePathPair(piece.outer_topo, piece.outer_base, closed);
    const outerTop = pair.primary;
    let outerBase = pair.secondary;
    const innerRaw = dedupePath(piece.inner, closed);
    if (outerTop.length < 2 || innerRaw.length < 2) return;

    const yBottom = engrosso.z[0];
    const yTop = engrosso.z[1];
    const chanfroAltura = Math.min(engrosso.chanfro_altura || 0, yTop - yBottom - 0.05);
    const hasChanfro = chanfroAltura > 0.05 && outerBase.length === outerTop.length;

    if (hasChanfro) {
      // No conjunto montado o V-bit atravessa todo o engrosso. O plano do
      // backend ainda publica o perfil da profundidade informada no DXF;
      // prolongamos apenas a malha 3D até a base sem tocar nesse plano.
      const fullDepth = yTop - yBottom;
      const profileScale = fullDepth / chanfroAltura;
      if (profileScale > 1.0001) {
        outerBase = outerTop.map(function (point, index) {
          const base = outerBase[index];
          return [
            point[0] + (base[0] - point[0]) * profileScale,
            point[1] + (base[1] - point[1]) * profileScale,
          ];
        });
      }
    }

    const edgeBuilder = surfaceBuilder();
    const holeBuilder = surfaceBuilder();
    // A parede interna é uma extrusão do próprio contorno: parear com o
    // externo (raycast) deformava as pontas dos arcos e abria degraus na
    // faixa. Cada bordo é usado como o backend o publicou.
    const inner = innerRaw;
    const normalsOuter = edgeNormals2D(outerTop, closed);
    const lengthsOuter = arcLengths(outerTop, closed);
    // Parede externa: o V-bit percorre toda a espessura do engrosso, da base
    // até a face de encontro com o tampo.
    if (hasChanfro) {
      addSlopedRing(edgeBuilder, outerTop, outerBase, yTop, yBottom, true, closed, true);
    } else {
      addWallStrip(edgeBuilder, outerTop, yBottom, outerTop, yTop, {
        closed: closed, outward: true, normalsBottom: normalsOuter, lengths: lengthsOuter,
      });
    }

    // Parede interna (voltada para o miolo do tampo).
    addWallStrip(edgeBuilder, inner, yBottom, inner, yTop, {
      closed: closed, outward: false,
      normalsBottom: edgeNormals2D(inner, closed),
      lengths: arcLengths(inner, closed),
    });

    // Nos engrossos, os furos de cavilha atravessam a chapa inteira.
    const bandOuter = closed ? outerTop : outerTop.concat(inner.slice().reverse());
    if (cavilhaInfo && Array.isArray(piece.cavilhas)) {
      piece.cavilhas.forEach(function (center) {
        if (!pointInsidePath(center, bandOuter)) return;
        if (closed && pointInsidePath(center, inner)) return;
        addThroughHole(
          holeBuilder, center, cavilhaInfo.diametro / 2,
          yTop, yBottom
        );
      });
    }
    if (!closed) {
      // Na montagem colada não existe vão nem face exposta entre as partes.
      // Mostramos apenas o traço fino da junta; fechar cada trecho com uma face
      // triangulada criava as aletas vistas nas pontas dos engrossos.
      // Cada peça desenha só o seu início: como o anel de partes é fechado,
      // isso cobre todas as juntas uma vez, sem escurecer a linha em duplicidade.
      addPieceSeamLines(
        group, outerTop, hasChanfro ? outerBase : outerTop, inner,
        true, yBottom, yTop, materials.emenda
      );
    }

    const edgeMesh = builderToMesh(
      edgeBuilder, materials.rawMdf, "rawMdfEdge", group, true
    );
    if (edgeMesh) {
      // Metadados da auditoria do preview: permitem conferir a malha que o
      // WebGL recebeu, separando a faixa externa inclinada da parede interna.
      // Não alteram o material nem o desenho em produção.
      edgeMesh.userData.tampoLayer = Number(engrosso.camada || 0);
      edgeMesh.userData.tampoPieceIndex = Number(piece.index || 0);
      edgeMesh.userData.tampoHasChanfro = hasChanfro;
      edgeMesh.userData.tampoOuterRingVertexCount = (
        (closed ? outerTop.length : outerTop.length - 1) * 6
      );
    }
    builderToMesh(holeBuilder, materials.hole, "throughHole", group, false);
    // Limite horizontal desta chapa: na primeira camada é a união com o tampo;
    // nas seguintes é a união com o engrosso imediatamente acima.
    addLayerBoundary(
      group, outerTop, yTop, closed, false, materials.layerBoundary
    );
    // A borda interna também fica exposta quando o conjunto é visto por baixo.
    addLayerBoundary(
      group, inner, yTop, closed, true, materials.layerBoundary
    );
    addXrayOutline(group, outerTop, yTop, closed);
    addXrayOutline(group, inner, yTop, closed);
  }

  /**
   * Une os trechos de uma camada depois da montagem.
   *
   * Uma tampa plana nao pode ser triangulada trecho a trecho: o fechamento
   * local de uma peca aberta liga bordas distantes e cria uma face atravessando
   * o miolo. Paredes e emendas continuam por peca, mas a face inferior e um
   * unico anel fechado.
   */
  function assembleMountedPath(paths) {
    const usable = (paths || []).map(function (path) {
      return dedupePath(path, false);
    }).filter(function (path) { return path.length >= 2; });
    if (!usable.length) return [];
    if (usable.length === 1) return dedupePath(usable[0], true);

    const output = usable[0].slice();
    usable.slice(1).forEach(function (rawPath) {
      let path = rawPath.slice();
      const last = output[output.length - 1];
      const end = path[path.length - 1];
      const toStart = Math.hypot(last[0] - path[0][0], last[1] - path[0][1]);
      const toEnd = Math.hypot(last[0] - end[0], last[1] - end[1]);
      if (toEnd < toStart) path = path.reverse();
      const first = path[0];
      const touches = Math.hypot(last[0] - first[0], last[1] - first[1])
        < TAMPO_MIN_EDGE;
      path.slice(touches ? 1 : 0).forEach(function (point) {
        output.push([point[0], point[1]]);
      });
    });
    return dedupePath(output, true);
  }

  function mountedEngrossoGeometry(piece, engrosso) {
    const closed = !!piece.closed;
    const pair = dedupePathPair(piece.outer_topo, piece.outer_base, closed);
    const outerTop = pair.primary;
    let outerBase = pair.secondary;
    const inner = dedupePath(piece.inner, closed);
    if (outerTop.length < 2 || inner.length < 2) return null;

    const yBottom = engrosso.z[0];
    const yTop = engrosso.z[1];
    const chanfroAltura = Math.min(
      engrosso.chanfro_altura || 0, yTop - yBottom - 0.05
    );
    const hasChanfro = chanfroAltura > 0.05
      && outerBase.length === outerTop.length;
    if (hasChanfro) {
      const profileScale = (yTop - yBottom) / chanfroAltura;
      if (profileScale > 1.0001) {
        outerBase = outerTop.map(function (point, index) {
          const base = outerBase[index];
          return [
            point[0] + (base[0] - point[0]) * profileScale,
            point[1] + (base[1] - point[1]) * profileScale,
          ];
        });
      }
    }
    return {
      outerTop: outerTop,
      outerBottom: hasChanfro ? outerBase : outerTop,
      inner: inner,
    };
  }

  function buildEngrossoLayerBottom(group, engrosso, cavilhaInfo, materials) {
    const pieces = Array.isArray(engrosso.pieces) ? engrosso.pieces : [];
    const geometries = pieces.map(function (piece) {
      return mountedEngrossoGeometry(piece, engrosso);
    }).filter(Boolean);
    if (!geometries.length) return;

    const outerTop = assembleMountedPath(geometries.map(function (geometry) {
      return geometry.outerTop;
    }));
    const outerBottom = assembleMountedPath(geometries.map(function (geometry) {
      return geometry.outerBottom;
    }));
    const inner = assembleMountedPath(geometries.map(function (geometry) {
      return geometry.inner;
    }));
    if (outerTop.length < 3 || outerBottom.length < 3 || inner.length < 3) return;

    const yBottom = engrosso.z[0];
    const capBuilder = surfaceBuilder();
    const grooveBuilder = surfaceBuilder();
    const throughHoles = [];
    const dowelDiameter = Math.max(0.1, number3d(
      cavilhaInfo && cavilhaInfo.diametro, 8
    ));
    pieces.forEach(function (piece) {
      (piece.cavilhas || []).forEach(function (center) {
        if (!Array.isArray(center) || center.length < 2) return;
        if (!pointInsidePath(center, outerTop) || pointInsidePath(center, inner)) return;
        if (throughHoles.some(function (hole) {
          return Math.hypot(
            hole.center[0] - center[0], hole.center[1] - center[1]
          ) < TAMPO_MIN_EDGE;
        })) return;
        throughHoles.push({
          center: center,
          path: circlePath(center, dowelDiameter / 2, 20),
        });
      });
    });
    const holesForCap = function (contour, intrinsicHoles) {
      const fixedHoles = intrinsicHoles || [];
      return fixedHoles.concat(throughHoles.filter(function (hole) {
        return pointInsidePath(hole.center, contour)
          && !fixedHoles.some(function (fixed) {
            return pointInsidePath(hole.center, fixed);
          });
      }).map(function (hole) { return hole.path; }));
    };

    const groove = engrosso.groove;
    if (groove && groove.offset > 0.01 && groove.meia_largura > 0.01) {
      const normals = edgeNormals2D(outerTop, true);
      const groovePath = shrinkPath(outerTop, normals, groove.offset);
      const grooveOuter = groovePath.map(function (point, index) {
        return [
          point[0] + normals[index][0] * groove.meia_largura,
          point[1] + normals[index][1] * groove.meia_largura,
        ];
      });
      const grooveInner = groovePath.map(function (point, index) {
        return [
          point[0] - normals[index][0] * groove.meia_largura,
          point[1] - normals[index][1] * groove.meia_largura,
        ];
      });
      let bottomOk = addCap(
        capBuilder, outerTop, holesForCap(outerTop, [grooveOuter]), yBottom, false
      );
      bottomOk = addCap(
        capBuilder, grooveInner, holesForCap(grooveInner, [inner]), yBottom, false
      ) && bottomOk;
      if (!bottomOk) {
        addCap(
          capBuilder, outerBottom, holesForCap(outerBottom, [inner]), yBottom, false
        );
      }
      addVGroove(
        grooveBuilder, groovePath, true, yBottom,
        groove.prof, groove.meia_largura, true
      );
    } else {
      addCap(
        capBuilder, outerBottom, holesForCap(outerBottom, [inner]), yBottom, false
      );
    }

    builderToMesh(capBuilder, materials.engrosso, "structure", group, true);
    builderToMesh(grooveBuilder, materials.rawMdf, "rawMdfEdge", group, true);
    addXrayOutline(group, outerBottom, yBottom, true);
    addXrayOutline(group, inner, yBottom, true);
  }

  function rebuildTampoModel() {
    if (state.viewMode !== "tampo") {
      state.viewMode = "tampo";
      state.yaw = -0.58;
      state.pitch = 0.42;
      state.zoom = 1;
    }
    const preview = (
      typeof _tampoPreview !== "undefined" &&
      _tampoPreview &&
      Array.isArray(_tampoPreview.points)
    ) ? _tampoPreview : null;
    if (!preview || preview.points.length < 3 || !preview.montagem) {
      if (state.empty) {
        state.empty.textContent = "Crie um contorno fechado para visualizar o tampo.";
        state.empty.style.display = "flex";
      }
      if (state.structureStatus) state.structureStatus.style.display = "none";
      return;
    }
    state.empty.style.display = "none";
    if (state.structureStatus) state.structureStatus.style.display = "none";

    const montagem = preview.montagem;
    const model = new THREE.Group();
    const materials = {
      wood: tampoMaterial(0xffffff, 0.58),
      engrosso: tampoMaterial(0xf4e7d6, 0.68),
      rawMdf: rawMdfMaterial(0xffffff, 0.92),
      hole: new THREE.MeshStandardMaterial({
        color: 0x6b4a32, roughness: 0.95, metalness: 0, side: THREE.FrontSide,
      }),
      // Marca da emenda: mesma cor das cavilhas, para ler como referência de
      // montagem e não como um material diferente.
      emenda: new THREE.LineBasicMaterial({
        color: 0x4a2d1d,
        transparent: true,
        opacity: 0.92,
        depthTest: true,
        depthWrite: false,
      }),
      layerBoundary: new THREE.LineBasicMaterial({
        color: 0x4a2d1d,
        transparent: true,
        opacity: 0.82,
        depthTest: true,
        depthWrite: false,
      }),
    };

    // As cavilhas do tampo saem das mesmas posições das peças de engrosso.
    const todasCavilhas = [];
    const engrossos = Array.isArray(montagem.engrossos)
      ? montagem.engrossos
      : (montagem.engrosso ? [montagem.engrosso] : []);
    const engrosso = engrossos[0] || null;
    // Os furos do tampo correspondem à primeira chapa, que é a que encosta
    // diretamente nele. Cada camada abaixo tem a sua própria lista de furos.
    if (engrosso && Array.isArray(engrosso.pieces)) {
      engrosso.pieces.forEach(function (piece) {
        (piece.cavilhas || []).forEach(function (point) { todasCavilhas.push(point); });
      });
    }

    buildTampoBody(model, preview, montagem, todasCavilhas, materials);

    const structureGroup = new THREE.Group();
    structureGroup.userData.previewRole = "structures";
    model.add(structureGroup);
    state.structureGroup = structureGroup;

    engrossos.forEach(function (camada) {
      if (!camada || !Array.isArray(camada.pieces)) return;
      camada.pieces.forEach(function (piece) {
        buildEngrossoPiece(
          structureGroup, piece, camada,
          camada.cavilha || montagem.cavilha, materials
        );
      });
    });
    // A lista vem da chapa encostada no tampo para a mais baixa. Somente a
    // última camada tem uma face inferior exposta na montagem.
    const bottomLayer = engrossos[engrossos.length - 1];
    if (bottomLayer && Array.isArray(bottomLayer.pieces)) {
      buildEngrossoLayerBottom(
        structureGroup, bottomLayer,
        bottomLayer.cavilha || montagem.cavilha, materials
      );
    }

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.set(-center.x, -center.y, -center.z);
    state.root.add(model);
    state.model = model;
    addGround(model, size);
    fitShadowCamera(size);
    state.baseDistance = Math.max(size.x, size.z, 80) * 2.7;
    applyDisplayModes();
    updateCamera();
  }

  // ── CAMBOTAS EMPILHADAS ───────────────────────────────────────────────────
  // A peça é uma pilha de camadas planas, então o 3D é literal: cada peça de
  // cada camada vira uma extrusão da própria geometria que sai no DXF, na
  // espessura real do material e na altura em que ela fica. Nada de silhueta
  // esquemática — o que aparece aqui é o que vai ser cortado e colado.

  // As MESMAS cores do desenho na tela e do DXF, para a peça ser reconhecida de
  // olho nos três. Precisam bater com `CORES_PECA` em
  // `curvos/cambotas_generator.py` e `CB_CORES` em
  // `curvos/templates/cambotas_modo.py` — há um teste que quebra se divergirem.
  const CAMB_CORES = [0x93c5fd, 0x86efac, 0xfde68a, 0xf0abfc, 0xfda4af, 0x5eead4];
  const CAMB_COR_FUNCIONAL = 0xc4b5fd;

  // A cor vem da LETRA da peça, não da ordem na lista: a parte A é sempre azul,
  // mesmo quando a camada também tem uma frente de gaveta na primeira posição.
  function corDaCambota(peca, indice) {
    if (peca && peca.funcional) return CAMB_COR_FUNCIONAL;
    const letra = (peca && peca.letra) || "";
    if (letra.length === 1 && letra >= "A" && letra <= "Z") {
      return CAMB_CORES[(letra.charCodeAt(0) - 65) % CAMB_CORES.length];
    }
    // Sem letra é a cambota inteira (ou a estrutura de uma camada com frente):
    // existe uma só por camada, e ela é sempre a primeira cor.
    return CAMB_CORES[0];
  }

  function shapeDeContorno(pts, furos) {
    const shape = new THREE.Shape();
    pts.forEach(function (p, i) {
      if (i === 0) shape.moveTo(p[0], p[1]);
      else shape.lineTo(p[0], p[1]);
    });
    shape.closePath();
    (furos || []).forEach(function (furo) {
      const path = new THREE.Path();
      furo.forEach(function (p, i) {
        if (i === 0) path.moveTo(p[0], p[1]);
        else path.lineTo(p[0], p[1]);
      });
      path.closePath();
      shape.holes.push(path);
    });
    return shape;
  }

  // Estado de exibição de um componente funcional, lido do corte que o gerou.
  // Peça de estrutura nunca é escondida nem afastada: ela é o móvel.
  function cambotaEstadoComponente(peca) {
    if (!peca.funcional || typeof CB === "undefined") {
      return { oculto: false, afastado: false };
    }
    const corte = (CB.cortes || []).find(function (c) {
      return c.nome === peca.nome;
    });
    if (!corte) return { oculto: false, afastado: false };
    return { oculto: !!corte.oculto3d, afastado: !!corte.explodido3d };
  }

  function centroide2d(pts) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const cross = p[0] * q[1] - q[0] * p[1];
      a += cross;
      cx += (p[0] + q[0]) * cross;
      cy += (p[1] + q[1]) * cross;
    }
    if (Math.abs(a) < 1e-9) return { x: pts[0][0], y: pts[0][1] };
    return { x: cx / (3 * a), y: cy / (3 * a) };
  }

  function bboxDasCamadas(camadas) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    camadas.forEach(function (cam) {
      (cam.pecas || []).forEach(function (p) {
        (p.pts || []).forEach(function (q) {
          if (q[0] < x0) x0 = q[0];
          if (q[0] > x1) x1 = q[0];
          if (q[1] < y0) y0 = q[1];
          if (q[1] > y1) y1 = q[1];
        });
      });
    });
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function circuloPath(cx, cy, r) {
    const pontos = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24;
      pontos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pontos;
  }

  /**
   * Fatias de altura da peça, cada uma com os furos que estão abertos nela.
   * Furo sem face (resposta antiga) ou passante atravessa a peça inteira; o
   * de face "baixo" vai de 0 até a profundidade, e o de "cima" desce da face
   * de cima. Fatias vizinhas com os mesmos furos são juntadas: numa camada do
   * meio da pilha sobra uma só, como antes.
   */
  function fatiasDaCambota(peca, esp) {
    const todos = (peca.cavilhas || []).concat(
      (peca.marcas || []).map(function (m) {
        return Object.assign({ face: "cima" }, m);
      })
    );
    function limites(f) {
      const prof = Math.min(esp, Math.max(0.1, number3d(f.profundidade, esp)));
      if (f.face === "baixo") return [0, prof];
      if (f.face === "cima") return [esp - prof, esp];
      return [0, esp];
    }
    const cortes = [0, esp];
    todos.forEach(function (f) {
      limites(f).forEach(function (z) { cortes.push(z); });
    });
    const zs = cortes
      .map(function (z) { return Math.round(z * 1000) / 1000; })
      .sort(function (a, b) { return a - b; })
      .filter(function (z, i, arr) { return i === 0 || z - arr[i - 1] > 1e-3; });
    const fatias = [];
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i], z1 = zs[i + 1];
      const meio = (z0 + z1) / 2;
      const furos = todos.filter(function (f) {
        const l = limites(f);
        return meio > l[0] && meio < l[1];
      });
      const anterior = fatias[fatias.length - 1];
      if (anterior && anterior.furos.length === furos.length
          && anterior.furos.every(function (f, k) { return f === furos[k]; })) {
        anterior.z1 = z1;
      } else {
        fatias.push({ z0: z0, z1: z1, furos: furos });
      }
    }
    return fatias;
  }

  function chaveGeometriaCambota(peca, furos, espessura) {
    // A resposta já vem arredondada para a tela. A chave só precisa identificar
    // malhas visualmente iguais para que dezenas de camadas compartilhem a
    // mesma ExtrudeGeometry.
    return JSON.stringify([
      Number(espessura).toFixed(3),
      peca.pts || [],
      furos || [],
    ]);
  }

  function addCambotaLayerBoundary(group, path, y, interno, dx, dz, cache) {
    if (!Array.isArray(path) || path.length < 3) return null;
    const chave = "junta|" + JSON.stringify(path);
    let geometry = cache && cache.get(chave);
    if (!geometry) {
      geometry = new THREE.BufferGeometry().setFromPoints(
        path.map(function (point) {
          return new THREE.Vector3(point[0], 0, -point[1]);
        })
      );
      if (cache) cache.set(chave, geometry);
    }
    const material = new THREE.LineBasicMaterial({
      color: interno ? 0x35516b : 0x29445f,
      transparent: true,
      opacity: interno ? 0.66 : 0.82,
      depthTest: true,
      depthWrite: false,
    });
    const line = new THREE.LineLoop(geometry, material);
    // A linha acompanha inclusive o componente funcional quando ele é afastado
    // para conferência; altura e deslocamento pertencem à ocorrência, não à
    // geometria compartilhada.
    line.position.set(dx || 0, y, dz || 0);
    line.renderOrder = 18;
    line.userData.previewRole = "layerBoundary";
    group.add(line);
    return line;
  }

  function rebuildCambotasModel() {
    if (state.viewMode !== "cambotas") {
      state.viewMode = "cambotas";
      state.yaw = -0.62;
      state.pitch = 0.34;
      state.zoom = 1;
    }
    syncCambotaButtons();
    const proj = (typeof CB !== "undefined" && CB.projeto) ? CB.projeto : null;
    if (!proj || !proj.camadas || !proj.camadas.length) {
      if (state.empty) {
        state.empty.textContent = "Desenhe a seção para visualizar as cambotas empilhadas.";
        state.empty.style.display = "flex";
      }
      if (state.structureStatus) state.structureStatus.style.display = "none";
      return;
    }
    state.empty.style.display = "none";
    if (state.structureStatus) state.structureStatus.style.display = "none";

    const model = new THREE.Group();
    const camadas = proj.camadas;
    const altura = (proj.resumo && proj.resumo.altura_final) || 720;
    // O afastamento da vista explodida acompanha o tamanho da peça: um valor
    // fixo somiria numa coluna de 2 m e estouraria a tela num pé de 200 mm.
    const passoExplode = state.explodido
      ? Math.max(6, (altura / Math.max(1, camadas.length)) * 1.9)
      : 0;
    const selecionada = (typeof CB !== "undefined") ? CB.camadaSel : -1;
    // Caixa do volume inteiro: é dela que sai a direção "para fora" usada ao
    // afastar um componente funcional.
    const bbox2d = bboxDasCamadas(camadas);
    const geometryCache = new Map();

    camadas.forEach(function (cam, iCam) {
      const grupo = new THREE.Group();
      grupo.userData.previewRole = "cambota";
      grupo.userData.indice = cam.indice;
      const esp = Math.max(0.5, number3d(cam.espessura, 18));
      const yBase = number3d(cam.z0, 0) + passoExplode * iCam;
      const ehSel = cam.indice === selecionada;

      (cam.pecas || []).forEach(function (peca, iPeca) {
        if (!peca.pts || peca.pts.length < 3) return;
        // §25 — ocultar/isolar um componente funcional. O usuário liga isso no
        // painel do corte para conferir a estrutura sem a frente na frente.
        const estado = cambotaEstadoComponente(peca);
        if (estado.oculto) return;
        // A peça sai em FATIAS de altura, uma para cada trecho em que o
        // conjunto de furos abertos é o mesmo: furo passante atravessa todas,
        // furo cego só existe da face dele até a profundidade. Sem isso o
        // tampo da última camada aparecia furado, e ele fica liso na peça.
        const fatias = fatiasDaCambota(peca, esp);
        const malhas = [];
        fatias.forEach(function (fatia) {
          const furos = [];
          if (peca.interno && peca.interno.length >= 3) furos.push(peca.interno);
          // Cavilha é furo de verdade na peça: some no 3D quando o usuário
          // desliga, e aparece onde ela vai ser realmente perfurada.
          fatia.furos.forEach(function (c) {
            furos.push(circuloPath(c.x, c.y, Math.max(1, c.diametro / 2)));
          });
          const altura = fatia.z1 - fatia.z0;
          const chaveGeom = chaveGeometriaCambota(peca, furos, altura);
          let geom = geometryCache.get(chaveGeom);
          if (!geom) {
            try {
              geom = new THREE.ExtrudeGeometry(shapeDeContorno(peca.pts, furos), {
                depth: altura, bevelEnabled: false, curveSegments: 1,
              });
            } catch (e) { return; }
            // ExtrudeGeometry cresce em +Z; a pilha cresce em +Y. A rotação
            // põe a peça deitada. A altura é aplicada no Mesh, permitindo que
            // todas as ocorrências iguais compartilhem esta BufferGeometry.
            geom.rotateX(-Math.PI / 2);
            geometryCache.set(chaveGeom, geom);
          }
          malhas.push({ geom: geom, z0: fatia.z0 });
        });
        if (!malhas.length) return;
        // §24 — explodir o componente funcional: ele avança para FORA do móvel,
        // na direção que sai do centro da peça, para dar para conferir a
        // curvatura e o encaixe com a estrutura.
        let dx = 0, dz = 0;
        if (estado.afastado) {
          const c = centroide2d(peca.pts);
          const cx = (bbox2d.x0 + bbox2d.x1) / 2;
          const cy = (bbox2d.y0 + bbox2d.y1) / 2;
          const vx = c.x - cx, vy = c.y - cy;
          const L = Math.hypot(vx, vy) || 1;
          const passo = Math.max(40, Math.max(bbox2d.x1 - bbox2d.x0,
                                              bbox2d.y1 - bbox2d.y0) * 0.45);
          dx = (vx / L) * passo;
          dz = -(vy / L) * passo;   // o eixo Y do desenho virou -Z na rotação
        }
        const cor = corDaCambota(peca, iPeca);
        const mat = new THREE.MeshStandardMaterial({
          color: cor,
          roughness: 0.82,
          metalness: 0,
          // A peça tem de ler como SÓLIDA: é para isso que o usuário abre o 3D
          // no passo de conferir o formato final. Deixar as camadas não
          // selecionadas translúcidas dava um vitral bonito e um volume que não
          // dava para avaliar. Quem quiser ver por dentro usa o raio X (XR),
          // que já existe no painel.
          //
          // A camada escolhida na lista é marcada por BRILHO, não por opacidade
          // das outras — assim a ligação lista/canvas/3D do §31 continua, sem
          // apagar o resto do modelo.
          emissive: ehSel ? 0x4c1d95 : 0x000000,
          emissiveIntensity: ehSel ? 0.35 : 0,
          side: THREE.DoubleSide,
        });
        malhas.forEach(function (m) {
          const mesh = new THREE.Mesh(m.geom, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.previewRole = peca.funcional ? "funcional" : "cambota";
          mesh.position.set(dx, yBase + m.z0, dz);
          grupo.add(mesh);
        });

        // A cambota conserva a espessura física completa. A junta é apenas uma
        // linha sobre o limite real entre as camadas — não há vão artificial.
        if (iCam < camadas.length - 1) {
          const yJunta = yBase + esp + 0.06;
          addCambotaLayerBoundary(
            grupo, peca.pts, yJunta, false, dx, dz, geometryCache
          );
          if (peca.interno && peca.interno.length >= 3) {
            addCambotaLayerBoundary(
              grupo, peca.interno, yJunta, true, dx, dz, geometryCache
            );
          }
        }
      });
      model.add(grupo);
    });

    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.set(-center.x, -center.y, -center.z);
    state.root.add(model);
    state.model = model;
    addGround(model, size);
    fitShadowCamera(size);
    state.baseDistance = Math.max(size.x, size.y, size.z, 80) * 2.2;
    applyDisplayModes();
    updateCamera();
  }

  function rebuildModel() {
    clearModel();
    syncCambotaButtons();
    if (typeof _activeMode !== "undefined" && _activeMode === "cambotas") {
      rebuildCambotasModel();
      return;
    }
    if (
      typeof _activeMode !== "undefined" &&
      _activeMode === "tampos_organicos"
    ) {
      rebuildTampoModel();
      return;
    }
    if (typeof _activeMode === "undefined" || _activeMode !== "organica") return;
    if (state.viewMode !== "organica") {
      state.viewMode = "organica";
      state.yaw = -0.72;
      state.pitch = -0.42;
      state.zoom = 1;
    }
    if (state.empty) {
      state.empty.textContent = "Crie uma curva com pelo menos dois nós para visualizar a peça.";
    }

    const geometry = sourceGeometry();
    if (!geometry) {
      if (state.structureStatus) state.structureStatus.style.display = "none";
      state.empty.style.display = "flex";
      requestRender();
      return;
    }
    state.empty.style.display = "none";

    const model = new THREE.Group();
    state.grooveAudit = [];
    const height = Math.max(10, number3d(O.altura, 720));
    const structureThickness = Math.min(Math.max(2, number3d(O.espessura, 18)), height * 0.12);
    const wood = material(0xd8b08c, true);
    const woodInner = material(0xf0d3b8, true);
    const exposedCoreMaterial = material(0xd8b98c, false);
    const machinedCoreMaterial = material(0xb48252, false);
    const structureExternalMaterial = material(0xc88e50, false);
    const structureInternalMaterial = material(0xe3c99f, false);

    // Compatibilidade dos frisos existentes: skin: 1 mm. No desbaste total,
    // o plano do backend substitui esse valor pela regra automática/manual.
    const desbasteMode = typeof orgModoFlexaoEfetivo === "function"
      && orgModoFlexaoEfetivo() === "desbaste";
    const outerDesbastePiece = desbasteMode
      ? sharedDesbastePiece("external") : null;
    const outerGrooveFractions = desbasteMode
      ? sharedDesbasteRanges("external")
      : groovePositions(geometry);
    const cutFromPlan = function (guides, faceA, faceB, fallback) {
      const plannedFaces = (guides || []).map(function (guide) {
        return guide && guide.sourceFace;
      }).filter(Boolean);
      if (plannedFaces.length && plannedFaces.every(function (face) { return face === faceA; })) {
        return "a";
      }
      if (plannedFaces.length && plannedFaces.every(function (face) { return face === faceB; })) {
        return "b";
      }
      return fallback;
    };
    const outerCutFrom = cutFromPlan(
      outerGrooveFractions,
      "outer",
      "seam",
      O.friso_lado === "externo" ? "a" : "b"
    );
    addMachinedWall(
      model, geometry.outer, geometry.seam, height,
      Math.max(0.1, number3d(O.espessura, 18)), geometry.closed,
      {
        role: "outerWall",
        woodMaterial: wood,
        coreMaterial: exposedCoreMaterial,
        grooveMaterial: machinedCoreMaterial,
        grooveFractions: outerGrooveFractions,
        toolWidth: number3d(O.larg_fresa, 6),
        skin: outerDesbastePiece
          ? number3d(
            outerDesbastePiece.skin_mm != null
              ? outerDesbastePiece.skin_mm : outerDesbastePiece.skinMm,
            1
          )
          : 1,
        cutFrom: outerCutFrom,
        edgeAFace: "outer",
        edgeBFace: "seam",
        // Havendo a segunda chapa, a face de emenda é compartilhada. Renderizar
        // as duas faces coplanares causa moiré e deixa frisos internos vazarem.
        hideFaceB: !!geometry.inner,
        usePairedPlanSections: desbasteMode,
        auditKind: "external",
        auditTarget: state.grooveAudit,
      }
    );
    const finalInner = geometry.inner || geometry.seam;
    if (geometry.inner) {
      const innerDesbastePiece = desbasteMode
        ? sharedDesbastePiece("internal") : null;
      let innerGrooveFractions = desbasteMode
        ? sharedDesbasteRanges("internal")
        : sharedPlantGrooveGuides("internal");
      if (!desbasteMode && !innerGrooveFractions.length && _orgInternaPreview
          && Array.isArray(_orgInternaPreview.frisoPositionsInt)
          && _orgInternaPreview.frisoPositionsInt.length) {
        const innerArc = cumulative(geometry.inner, geometry.closed).total;
        const innerFractions = _orgInternaPreview.frisoPositionsInt.map(function (position) {
          return clamp3d(number3d(position, 0) / Math.max(innerArc, 1e-6), 0, geometry.closed ? 0.999999 : 1);
        });
        innerGrooveFractions = grooveGuidesForPath(
          geometry.inner,
          geometry.closed,
          innerFractions
        );
      }
      if (!desbasteMode && !innerGrooveFractions.length) innerGrooveFractions = outerGrooveFractions;
      const innerCutFrom = cutFromPlan(
        innerGrooveFractions,
        "seam",
        "inner",
        outerCutFrom === "a" ? "b" : "a"
      );
      // Chapas do meio (parede de 3 ou mais): cada uma entre a face de dentro
      // da anterior e a de fora da seguinte, com os próprios frisos do plano
      // do backend. As duas faces são coladas, então nenhuma é desenhada.
      // Com a "largura das peças do meio" preenchida, cada chapa do meio vira
      // duas ripas: uma na borda de baixo e outra na de cima da parede.
      const larguraMeio = typeof orgLarguraMeioEfetiva === "function"
        ? orgLarguraMeioEfetiva()
        : null;
      const bandasMeio = larguraMeio > 0 && 2 * larguraMeio < height
        ? [[0, larguraMeio], [height - larguraMeio, larguraMeio]]
        : [[0, height]];
      (geometry.middleSheets || []).forEach(function (sheet) {
        const sheetGrooves = O.gerar_fresagem ? parseGrooveGuides(sheet.machining) : [];
        bandasMeio.forEach(function (banda) {
          const bandGroup = new THREE.Group();
          bandGroup.position.y = banda[0];
          model.add(bandGroup);
          addMachinedWall(
            bandGroup, sheet.outer, sheet.inner, banda[1],
            Math.max(0.1, number3d(orgEspessuraInternaEfetiva(), O.espessura)), geometry.closed,
            {
              role: "middleWall",
              woodMaterial: woodInner,
              coreMaterial: exposedCoreMaterial,
              grooveMaterial: machinedCoreMaterial,
              grooveFractions: sheetGrooves,
              toolWidth: number3d(O.larg_fresa, 6),
              skin: 1,
              cutFrom: cutFromPlan(sheetGrooves, "seam", "inner", innerCutFrom),
              edgeAFace: "seam",
              edgeBFace: "inner",
              hideFaceA: true,
              hideFaceB: true,
              usePairedPlanSections: true,
              auditKind: "middle",
              auditTarget: state.grooveAudit,
            }
          );
        });
      });
      addMachinedWall(
        model, geometry.seamInt || geometry.seam, geometry.inner, height,
        Math.max(0.1, number3d(orgEspessuraInternaEfetiva(), O.espessura)), geometry.closed,
        {
          role: "innerWall",
          woodMaterial: woodInner,
          coreMaterial: exposedCoreMaterial,
          grooveMaterial: machinedCoreMaterial,
          grooveFractions: innerGrooveFractions,
          toolWidth: number3d(O.larg_fresa, 6),
          skin: innerDesbastePiece
            ? number3d(
              innerDesbastePiece.skin_mm != null
                ? innerDesbastePiece.skin_mm : innerDesbastePiece.skinMm,
              1
            )
            : 1,
          // A planta desenha os frisos da peça interna no lado oposto aos
          // da externa (frisoSignInt = -frisoSign). O 3D deve preservar essa
          // inversão também na face de abertura do canal.
          cutFrom: innerCutFrom,
          edgeAFace: "seam",
          edgeBFace: "inner",
          hideFaceA: true,
          usePairedPlanSections: true,
          auditKind: "internal",
          auditTarget: state.grooveAudit,
        }
      );
    }

    if (desbasteMode) addCambotinhaStacks(model, height);

    addSeamIndicator(model, geometry, height);
    addDivisionSeams(model, geometry, height);

    let extNear = null;
    let extFar = null;
    let intNear = null;
    let intFar = null;
    let structuresReady = false;
    if (geometry.structures) {
      extNear = geometry.structures.externalNear;
      extFar = geometry.structures.externalFar;
      intNear = geometry.structures.internalNear;
      intFar = geometry.structures.internalFar;
      structuresReady = true;
    } else if (geometry.exactCircle) {
      // No círculo o offset analítico local é exato. Nas demais formas, nunca
      // mostrar a aproximação enquanto o backend calcula os mesmos contornos
      // usados pelo DXF — era ela que aparecia deformada por alguns instantes.
      const externalGap = Math.max(0, number3d(O.folga_externa, 1));
      const externalWidth = Math.max(1, number3d(O.largura_externa, 40));
      const internalGap = Math.max(0, number3d(O.folga_interna, 1));
      const internalWidth = Math.max(1, number3d(O.largura_interna, 40));
      extNear = offsetPath(geometry.outer, geometry.normals, -externalGap);
      extFar = offsetPath(geometry.outer, geometry.normals, -(externalGap + externalWidth));
      intNear = offsetPath(finalInner, geometry.normals, internalGap);
      intFar = offsetPath(finalInner, geometry.normals, internalGap + internalWidth);
      structuresReady = true;
    }

    const structureGroup = new THREE.Group();
    structureGroup.userData.previewRole = "structures";
    model.add(structureGroup);
    state.structureGroup = structureGroup;

    if (structuresReady) {
      addStrip(
        structureGroup, extNear, extFar, 0, structureThickness,
        geometry.closed, structureExternalMaterial, "structure"
      );
      addStrip(
        structureGroup, intNear, intFar, 0, structureThickness,
        geometry.closed, structureInternalMaterial, "structure"
      );
      addStrip(
        structureGroup, extNear, extFar, height - structureThickness, height,
        geometry.closed, structureExternalMaterial, "structure"
      );
      addStrip(
        structureGroup, intNear, intFar, height - structureThickness, height,
        geometry.closed, structureInternalMaterial, "structure"
      );
    }
    if (state.structureStatus) {
      state.structureStatus.style.display = structuresReady ? "none" : "block";
    }

    if (geometry.inner) {
      // Apenas as emendas entre as chapas; as demais bordas vêm da própria
      // geometria reta e não recebem linha decorativa/fita.
      addPathOutline(model, geometry.seam, -0.25, geometry.closed, 0x49301f, 0.8);
      addPathOutline(model, geometry.seam, height + 0.25, geometry.closed, 0x49301f, 0.8);
      (geometry.middleSheets || []).forEach(function (sheet) {
        addPathOutline(model, sheet.inner, -0.25, geometry.closed, 0x49301f, 0.8);
        addPathOutline(model, sheet.inner, height + 0.25, geometry.closed, 0x49301f, 0.8);
      });
    }
    if (structuresReady) {
      [extNear, extFar].forEach(function (path) {
        addPathOutline(structureGroup, path, -0.45, geometry.closed, 0x70421f, 0.9);
        addPathOutline(structureGroup, path, height + 0.45, geometry.closed, 0x70421f, 0.9);
      });
      [intNear, intFar].forEach(function (path) {
        addPathOutline(structureGroup, path, -0.5, geometry.closed, 0x6b5135, 0.9);
        addPathOutline(structureGroup, path, height + 0.5, geometry.closed, 0x6b5135, 0.9);
      });
    }
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.set(-center.x, -center.y, -center.z);
    state.root.add(model);
    state.model = model;

    addGround(model, size);
    fitShadowCamera(size);
    state.baseDistance = Math.max(size.x, size.y, size.z, 80) * 2.05;
    applyDisplayModes();
    updateCamera();
  }

  function applyDisplayModes() {
    if (state.structureGroup) state.structureGroup.visible = state.structuresVisible;

    if (state.model) {
      state.model.traverse(function (node) {
        // O contorno de arame existe só para o raio X: liga e desliga junto.
        if (node.userData.previewRole === "xrayOutline") {
          node.visible = state.xray;
          return;
        }
        if (node.userData.previewRole === "layerBoundary" && node.material) {
          node.visible = true;
          if (node.material.userData.cambotaOpacity === undefined) {
            node.material.userData.cambotaOpacity = node.material.opacity;
          }
          node.material.depthTest = !state.xray;
          node.material.opacity = state.xray ? 0.92
            : node.material.userData.cambotaOpacity;
          node.material.needsUpdate = true;
          return;
        }
        if (!node.isMesh || !node.material) return;
        const role = node.userData.previewRole || "wall";
        if (role === "ground") return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach(function (meshMaterial) {
          if (!meshMaterial.userData.org3dDisplayOriginal) {
            meshMaterial.userData.org3dDisplayOriginal = {
              transparent: meshMaterial.transparent,
              opacity: meshMaterial.opacity,
              depthWrite: meshMaterial.depthWrite,
              side: meshMaterial.side,
            };
          }
          const original = meshMaterial.userData.org3dDisplayOriginal;
          if (state.xray) {
            const isReferenceMark = (
              role === "groove" ||
              role === "seamIndicator" ||
              role === "divisionSeam" ||
              role === "blindHole" ||
              role === "throughHole"
            );
            meshMaterial.transparent = !isReferenceMark;
            meshMaterial.opacity = (role === "seamIndicator" || role === "divisionSeam")
              ? 1
              : (role === "blindHole" || role === "throughHole") ? 1
              : role === "innerWall"
              ? 0.42
              : role === "structure" ? 0.16 : role === "groove" ? 1 : 0.22;
            meshMaterial.depthWrite = isReferenceMark;
            meshMaterial.side = THREE.DoubleSide;
          } else {
            meshMaterial.transparent = original.transparent;
            meshMaterial.opacity = original.opacity;
            meshMaterial.depthWrite = original.depthWrite;
            meshMaterial.side = original.side;
          }
          meshMaterial.needsUpdate = true;
        });
        node.castShadow = !state.xray && role !== "groove";
      });
    }

    if (state.panel) {
      const xrayButton = state.panel.querySelector('[data-action="xray"]');
      const structuresButton = state.panel.querySelector('[data-action="structures"]');
      if (xrayButton) {
        xrayButton.classList.toggle("active", state.xray);
        xrayButton.setAttribute("aria-pressed", state.xray ? "true" : "false");
        xrayButton.title = state.xray ? "Desativar raio X" : "Ativar raio X";
      }
      if (structuresButton) {
        structuresButton.classList.toggle("active", state.structuresVisible);
        structuresButton.setAttribute("aria-pressed", state.structuresVisible ? "true" : "false");
        structuresButton.title = state.structuresVisible ? "Ocultar estruturas" : "Mostrar estruturas";
      }
    }
    requestRender();
  }

  function resetView() {
    const isTampo = (
      typeof _activeMode !== "undefined" &&
      _activeMode === "tampos_organicos"
    );
    state.yaw = isTampo ? -0.58 : -0.72;
    state.pitch = isTampo ? 0.42 : -0.42;
    state.zoom = 1;
    updateCamera();
  }

  function updateCamera() {
    if (!state.camera || !state.root) return;
    const cameraDistance = state.baseDistance * state.zoom;
    state.root.rotation.set(state.pitch, state.yaw, 0);
    state.camera.position.set(0, 0, cameraDistance);
    // A antiga faixa 0.1–100000 desperdiçava quase toda a precisão do
    // depth-buffer. Com apenas 1 mm de casca entre o fundo do friso e a face
    // oposta, isso causava z-fighting e fazia o canal interno "vazar" na face
    // externa. O clipping acompanha a distância real do modelo.
    state.camera.near = Math.max(0.5, cameraDistance * 0.01);
    state.camera.far = cameraDistance + state.baseDistance * 3.25;
    state.camera.updateProjectionMatrix();
    state.camera.lookAt(0, 0, 0);
    requestRender();
  }

  function resizeRenderer(shouldRender) {
    if (!state.renderer || !state.stage || !state.panel || !state.panel.isConnected) return;
    const width = Math.max(1, state.stage.clientWidth);
    const height = Math.max(1, state.stage.clientHeight);
    const canvas = state.renderer.domElement;
    const pixelRatio = state.renderer.getPixelRatio();
    const neededWidth = Math.floor(width * pixelRatio);
    const neededHeight = Math.floor(height * pixelRatio);
    if (canvas.width !== neededWidth || canvas.height !== neededHeight) {
      state.renderer.setSize(width, height, false);
    }
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    if (shouldRender !== false) requestRender();
  }

  function requestRender() {
    if (state.renderFrame) return;
    state.renderFrame = requestAnimationFrame(function () {
      state.renderFrame = 0;
      if (!state.renderer || !state.panel || !state.panel.isConnected) return;
      resizeRenderer(false);
      state.renderer.render(state.scene, state.camera);
      descartarModelosVelhos();
    });
  }

  function scheduleUpdate() {
    if (state.updateFrame) cancelAnimationFrame(state.updateFrame);
    state.updateFrame = requestAnimationFrame(function () {
      state.updateFrame = 0;
      rebuildModel();
    });
  }

  function onPointerDown(event) {
    if (event.target.closest(".org3d-btn")) return;
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.stage.classList.add("dragging");
    state.stage.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.yaw += dx * 0.009;
    state.pitch = clamp3d(state.pitch + dy * 0.009, -1.45, 1.45);
    updateCamera();
  }

  function onPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    state.dragging = false;
    state.pointerId = null;
    state.stage.classList.remove("dragging");
    try {
      state.stage.releasePointerCapture(event.pointerId);
    } catch (_) {
      // O ponteiro pode ter sido liberado pelo navegador.
    }
  }

  function onWheel(event) {
    event.preventDefault();
    state.zoom = clamp3d(state.zoom * Math.exp(event.deltaY * 0.0012), 0.34, 3.5);
    updateCamera();
  }

  function toggleFullscreen(force) {
    const open = typeof force === "boolean" ? force : !state.fullscreen;
    if (open === state.fullscreen) return;
    state.fullscreen = open;
    const button = state.panel.querySelector('[data-action="fullscreen"]');
    if (open) {
      state.backdrop = document.createElement("div");
      state.backdrop.className = "org3d-backdrop";
      state.backdrop.addEventListener("click", function () { toggleFullscreen(false); });
      document.body.appendChild(state.backdrop);
      document.body.appendChild(state.panel);
      state.panel.classList.add("org3d-fullscreen");
      button.textContent = "×";
      button.title = "Fechar tela cheia";
    } else {
      state.panel.classList.remove("org3d-fullscreen");
      if (state.backdrop) state.backdrop.remove();
      state.backdrop = null;
      const host = document.getElementById("org3d-host");
      if (host) host.appendChild(state.panel);
      button.textContent = "⛶";
      button.title = "Abrir em tela cheia";
    }
    requestAnimationFrame(resizeRenderer);
  }

  window.org3dDetach = function () {
    if (!state.panel || state.fullscreen) return;
    state.panel.remove();
  };

  window.org3dMount = function () {
    if (
      typeof _activeMode === "undefined" ||
      (_activeMode !== "organica" && _activeMode !== "tampos_organicos"
       && _activeMode !== "cambotas")
    ) return;
    const host = document.getElementById("org3d-host");
    if (!host) return;
    const panel = makePanel();
    if (!state.fullscreen && panel.parentNode !== host) host.appendChild(panel);
    syncCambotaButtons();
    resizeRenderer();
    scheduleUpdate();
  };

  window.org3dUpdate = scheduleUpdate;
  window.org3dCambotasAuditSnapshot = function () {
    const geometries = new Set();
    let stackMinY = Infinity;
    let stackMaxY = -Infinity;
    let meshes = 0;
    let layerBoundaries = 0;
    let layers = 0;
    if (state.model) {
      state.model.traverse(function (node) {
        if (node.userData && node.userData.previewRole === "cambota" && node.isGroup) {
          layers += 1;
        }
        if (node.userData && node.userData.previewRole === "layerBoundary") {
          layerBoundaries += 1;
        }
        if (node.isMesh) {
          meshes += 1;
          if (node.geometry && node.geometry.uuid) geometries.add(node.geometry.uuid);
          if (node.userData.previewRole === "cambota" ||
              node.userData.previewRole === "funcional") {
            if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
            const box = node.geometry.boundingBox;
            if (box) {
              stackMinY = Math.min(stackMinY, box.min.y + node.position.y);
              stackMaxY = Math.max(stackMaxY, box.max.y + node.position.y);
            }
          }
        }
      });
    }
    return {
      mode: state.viewMode,
      layers: layers,
      meshes: meshes,
      uniqueGeometries: geometries.size,
      layerBoundaries: layerBoundaries,
      stackHeight: isFinite(stackMinY) ? stackMaxY - stackMinY : 0,
      xray: state.xray,
      exploded: state.explodido,
    };
  };
  window.org3dAuditSnapshot = function () {
    return JSON.parse(JSON.stringify(state.grooveAudit || []));
  };
  window.org3dAuditSummary = function () {
    const rows = state.grooveAudit || [];
    return {
      count: rows.length,
      external: rows.filter(function (row) { return row.piece === "external"; }).length,
      internal: rows.filter(function (row) { return row.piece === "internal"; }).length,
      middle: rows.filter(function (row) { return row.piece === "middle"; }).length,
      maxAngleErrorDeg: rows.reduce(function (value, row) {
        return Math.max(value, number3d(row.angleErrorDeg, 0));
      }, 0),
      maxPerpendicularErrorDeg: rows.reduce(function (value, row) {
        return Math.max(value, number3d(row.perpendicularErrorDeg, 0));
      }, 0),
      maxMouthOffsetMm: rows.reduce(function (value, row) {
        return Math.max(value, number3d(row.lineOffsetMm, 0));
      }, 0),
      faceMismatches: rows.filter(function (row) {
        return row.sourceFaceMatchesPlan === false;
      }).length,
    };
  };

  function init() {
    document.addEventListener("input", function (event) {
      if (event.target && event.target.closest && event.target.closest("#pp-right")) {
        if (typeof orgUpdateInternaPreview === "function") orgUpdateInternaPreview();
        scheduleUpdate();
      }
    });
    document.addEventListener("change", function (event) {
      if (event.target && event.target.closest && event.target.closest("#pp-right")) {
        if (typeof orgUpdateInternaPreview === "function") orgUpdateInternaPreview();
        scheduleUpdate();
      }
    });
    if (typeof _activeMode !== "undefined" && _activeMode === "organica") {
      window.org3dMount();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
