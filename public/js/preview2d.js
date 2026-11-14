/**
 * CENTRAL DXF PRO - VISUALIZADOR 2D CAD VETORIAL
 * Renderização bidimensional com camadas CNC, cotas e navegação interativa (Pan/Zoom).
 */

export class Visualizador2D {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.geometria = null;

    this.scale = 0.5;
    this.panX = 100;
    this.panY = 100;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;

    this.camadasVisiveis = {
      CORTE: true,
      USINAGEM: true,
      FRESAGEM_DOBRA: true,
      FURACAO: true,
      COTAS: true
    };

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const mouseX = e.offsetX;
      const mouseY = e.offsetY;

      this.panX = mouseX - (mouseX - this.panX) * zoomFactor;
      this.panY = mouseY - (mouseY - this.panY) * zoomFactor;
      this.scale *= zoomFactor;
      this.render();
    });

    window.addEventListener('resize', () => {
      this.ajustarDimensoes();
      this.render();
    });
  }

  ajustarDimensoes() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  atualizarGeometria(resultadoCalculo) {
    this.geometria = resultadoCalculo;
    this.ajustarDimensoes();
    this.enquadrar();
  }

  enquadrar() {
    if (!this.geometria) return;
    const padding = 60;
    const { camadas = [], largura, altura } = this.geometria;
    let minX = 0, maxX = largura || 500;
    let minY = 0, maxY = altura || 500;

    if (camadas && camadas.length > 0) {
      let found = false;
      for (const ent of camadas) {
        if (ent.pontos) {
          for (const p of ent.pontos) {
            if (!found) { minX = maxX = p.x; minY = maxY = p.y; found = true; }
            else {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            }
          }
        } else if (ent.tipo === 'line') {
          if (!found) {
            minX = Math.min(ent.x1, ent.x2); maxX = Math.max(ent.x1, ent.x2);
            minY = Math.min(ent.y1, ent.y2); maxY = Math.max(ent.y1, ent.y2);
            found = true;
          } else {
            minX = Math.min(minX, ent.x1, ent.x2);
            maxX = Math.max(maxX, ent.x1, ent.x2);
            minY = Math.min(minY, ent.y1, ent.y2);
            maxY = Math.max(maxY, ent.y1, ent.y2);
          }
        }
      }
    }

    const boundW = Math.max(10, maxX - minX);
    const boundH = Math.max(10, maxY - minY);
    const scaleX = (this.canvas.width - padding * 2) / boundW;
    const scaleY = (this.canvas.height - padding * 2) / boundH;
    this.scale = Math.min(scaleX, scaleY);

    this.panX = (this.canvas.width - boundW * this.scale) / 2 - minX * this.scale;
    this.panY = (this.canvas.height + boundH * this.scale) / 2 + minY * this.scale;
    this.render();
  }

  render() {
    if (!this.ctx || !this.geometria) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fundo CAD Escuro
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    // Desenhar Grid milimétrico suave
    this.desenharGrid(ctx);

    ctx.save();
    // Aplicar transformação de Pan e Zoom com Y invertido para padrão CNC
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, -this.scale);

    const { camadas = [] } = this.geometria;

    // Cores das Camadas CNC
    const cores = {
      CORTE: '#ef4444',         // Vermelho
      USINAGEM: '#10b981',      // Verde
      FRESAGEM_DOBRA: '#f59e0b',// Amarelo
      FURACAO: '#38bdf8'        // Ciano
    };

    // Renderizar Entidades
    for (const ent of camadas) {
      const layer = ent.layer || 'CORTE';
      if (!this.camadasVisiveis[layer]) continue;

      ctx.strokeStyle = cores[layer] || '#ffffff';
      ctx.lineWidth = (layer === 'CORTE' ? 2 : 1.5) / this.scale;

      if (ent.tipo === 'polyline' && ent.pontos && ent.pontos.length > 0) {
        ctx.beginPath();
        ctx.moveTo(ent.pontos[0].x, ent.pontos[0].y);
        for (let i = 1; i < ent.pontos.length; i++) {
          ctx.lineTo(ent.pontos[i].x, ent.pontos[i].y);
        }
        if (ent.fechada) ctx.closePath();
        ctx.stroke();

        // Se for usinagem, preencher levemente
        if (layer === 'USINAGEM') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
          ctx.fill();
        }
      } else if (ent.tipo === 'line') {
        ctx.beginPath();
        ctx.moveTo(ent.x1, ent.y1);
        ctx.lineTo(ent.x2, ent.y2);
        ctx.stroke();
      } else if (ent.tipo === 'circle') {
        ctx.beginPath();
        ctx.arc(ent.cx, ent.cy, ent.r, 0, Math.PI * 2);
        ctx.stroke();

        // Ponto central de mira para furadeiras CNC
        ctx.beginPath();
        const mira = ent.r * 0.4;
        ctx.moveTo(ent.cx - mira, ent.cy);
        ctx.lineTo(ent.cx + mira, ent.cy);
        ctx.moveTo(ent.cx, ent.cy - mira);
        ctx.lineTo(ent.cx, ent.cy + mira);
        ctx.stroke();
      }
    }

    // Desenhar Cotas Dimensionais se ativado
    if (this.camadasVisiveis.COTAS) {
      this.desenharCotas(ctx);
    }

    ctx.restore();
  }

  desenharGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = '#151e2e';
    ctx.lineWidth = 1;

    const step = 50 * this.scale;
    if (step > 15) {
      const offsetX = this.panX % step;
      const offsetY = this.panY % step;

      ctx.beginPath();
      for (let x = offsetX; x < this.canvas.width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
      }
      for (let y = offsetY; y < this.canvas.height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(this.canvas.width, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  desenharCotas(ctx) {
    const { largura, altura } = this.geometria;
    const offset = 40;

    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.fillStyle = '#94a3b8';
    ctx.lineWidth = 1.2 / this.scale;

    // Cota Horizontal (Largura)
    const yCota = -offset;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, yCota - 10);
    ctx.moveTo(largura, 0);
    ctx.lineTo(largura, yCota - 10);
    ctx.moveTo(0, yCota);
    ctx.lineTo(largura, yCota);
    ctx.stroke();

    // Texto de cota invertido para ficar legível
    ctx.save();
    ctx.scale(1, -1);
    ctx.font = `${Math.max(12, 14 / this.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${largura} mm`, largura / 2, -yCota + 18 / this.scale);
    ctx.restore();

    // Cota Vertical (Altura)
    const xCota = -offset;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(xCota - 10, 0);
    ctx.moveTo(0, altura);
    ctx.lineTo(xCota - 10, altura);
    ctx.moveTo(xCota, 0);
    ctx.lineTo(xCota, altura);
    ctx.stroke();

    ctx.save();
    ctx.scale(1, -1);
    ctx.font = `${Math.max(12, 14 / this.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${altura} mm`, xCota - 25 / this.scale, -altura / 2);
    ctx.restore();

    ctx.restore();
  }
}
