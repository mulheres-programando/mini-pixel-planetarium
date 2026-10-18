/**
 * ============================================================================
 * MINI PIXEL PLANETARIUM — SIMULADOR DO SISTEMA SOLAR EM PIXEL ART 2D
 * ============================================================================
 * Desenvolvido em Vanilla JavaScript (ES6+), HTML5 Canvas e CSS3 puro.
 * Zero dependências externas e zero imagens externas (100% procedural).
 *
 * OBJETIVO DIDÁTICO:
 * Demonstrar como utilizar Trigonometria (Seno e Cosseno), Hierarquia de
 * Transformações Espaciais e Renderização Pixel Art no HTML5 Canvas.
 * ============================================================================
 */

(() => {
  "use strict";

  // ==========================================================================
  // 1. CONFIGURAÇÃO DO CANVAS E ESCALA DE PIXEL ART
  // ==========================================================================
  const canvas = document.getElementById("planetarium");
  const ctx = canvas.getContext("2d");

  const previewCanvas = document.getElementById("card-preview");
  const previewCtx = previewCanvas.getContext("2d");

  /**
   * PIXEL_SCALE define o tamanho dos "blocos" de pixel na tela.
   * Ao renderizar o canvas com uma resolução interna reduzida por PIXEL_SCALE
   * e esticá-lo via CSS com `image-rendering: pixelated`, obtemos um visual
   * retrô autêntico de 8-bit/16-bit e excelente performance!
   */
  const PIXEL_SCALE = 2;

  let viewportWidth = 0;
  let viewportHeight = 0;

  function resizeCanvas() {
    viewportWidth = Math.floor(window.innerWidth / PIXEL_SCALE);
    viewportHeight = Math.floor(window.innerHeight / PIXEL_SCALE);

    canvas.width = viewportWidth;
    canvas.height = viewportHeight;

    // Desativa a suavização de imagem para preservar os pixels nítidos
    ctx.imageSmoothingEnabled = false;
    previewCtx.imageSmoothingEnabled = false;
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ==========================================================================
  // 2. ESTADO DA SIMULAÇÃO E CÂMERA (PAN & ZOOM)
  // ==========================================================================
  const state = {
    timeSpeed: 1,          // Multiplicador de velocidade (0 = pausado, 1x, 5x, etc.)
    elapsedTime: 0,        // Tempo acumulado para animações visuais (Sol, estrelas)
    showOrbits: true,      // Mostrar linhas de órbita
    showLabels: true,      // Mostrar nomes dos planetas
    showTrails: true,      // Mostrar rastro luminoso
    showPluto: true,       // Incluir Plutão (planeta anão opcional)
    selectedBody: null,    // Astro atualmente selecionado para foco da câmera
  };

  const camera = {
    x: 0,                  // Posição X atual da câmera no espaço (0,0 é o Sol)
    y: 0,                  // Posição Y atual da câmera no espaço
    targetX: 0,            // Destino X para interpolação suave (Lerp)
    targetY: 0,            // Destino Y para interpolação suave (Lerp)
    zoom: 1,               // Zoom atual
    targetZoom: 1,         // Zoom alvo para interpolação suave
    minZoom: 0.28,
    maxZoom: 4.0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    camStartX: 0,
    camStartY: 0,
    hasMovedDuringClick: false,
  };

  // ==========================================================================
  // 3. BANCO DE DADOS DOS ASTROS DO SISTEMA SOLAR
  // ==========================================================================
  /**
   * NOTA SOBRE ESCALAS E VELOCIDADES ORBITAIS:
   * No espaço real, as distâncias e tamanhos são gigantescos (se o Sol tivesse
   * 20 pixels, a Terra seria menor que 0.2 pixel!). Por isso, usamos diâmetros
   * e raios orbitais "estilizados", mas preservamos a proporção real das
   * VELOCIDADES ORBITAIS (3ª Lei de Kepler: quanto mais próximo do Sol,
   * muito mais rápido o planeta completa sua volta).
   *
   * A velocidade base da Terra (`BASE_EARTH_SPEED`) é definida em radianos por
   * segundo na velocidade 1x. A velocidade angular de cada astro é:
   *   omega = BASE_EARTH_SPEED * relativeSpeed
   */
  const BASE_EARTH_SPEED = 0.35; // Radianos por segundo em 1x (~18s por ano terrestre)

  const CELESTIAL_DATA = [
    {
      id: "sun",
      name: "SOL",
      type: "ESTRELA (ANÃ AMARELA)",
      radius: 22,
      orbitRadius: 0,
      relativeSpeed: 0,
      initialAngle: 0,
      color: "#ffaa22",
      trailColor: "#ffcc44",
      distanceText: "0 UA (Centro do Sistema)",
      periodText: "~230 milhões de anos (na Galáxia)",
      tempText: "5.500 °C (Superfície) / 15 mi °C (Núcleo)",
      fact: "O Sol concentra 99,86% de toda a massa do Sistema Solar! Caberiam cerca de 1,3 milhão de Terras dentro dele.",
    },
    {
      id: "mercury",
      name: "MERCÚRIO",
      type: "PLANETA ROCHOSO",
      radius: 4,
      orbitRadius: 46,
      relativeSpeed: 4.15, // 365.25 / 88 dias = 4.15x mais rápido que a Terra
      initialAngle: 0.8,
      color: "#9badb7",
      trailColor: "#9badb7",
      distanceText: "0,39 UA (57,9 milhões km)",
      periodText: "88 dias terrestres",
      tempText: "167 °C (-180 °C a 430 °C)",
      fact: "Apesar de ser o planeta mais próximo do Sol, Mercúrio possui gelo em crateras profundas nos seus polos que nunca recebem luz solar.",
    },
    {
      id: "venus",
      name: "VÊNUS",
      type: "PLANETA ROCHOSO",
      radius: 6,
      orbitRadius: 68,
      relativeSpeed: 1.62, // 365.25 / 224.7 dias = 1.62x mais rápido que a Terra
      initialAngle: 2.4,
      color: "#e8c170",
      trailColor: "#e8c170",
      distanceText: "0,72 UA (108,2 milhões km)",
      periodText: "225 dias terrestres",
      tempText: "464 °C (Mais quente!)",
      fact: "Vênus gira ao contrário da maioria dos planetas (rotação retrógrada) e tão devagar que um 'dia' em Vênus dura mais que um 'ano' venusiano!",
    },
    {
      id: "earth",
      name: "TERRA",
      type: "PLANETA ROCHOSO",
      radius: 7,
      orbitRadius: 98,
      relativeSpeed: 1.0, // Referência: 1.00x
      initialAngle: 4.1,
      color: "#3b82f6",
      trailColor: "#4fd1c5",
      distanceText: "1,00 UA (149,6 milhões km)",
      periodText: "365,25 dias terrestres",
      tempText: "15 °C",
      fact: "A Terra viaja pelo espaço a incríveis 107.000 km/h ao redor do Sol, e é o único mundo conhecido com oceanos de água líquida na superfície.",
    },
    {
      id: "moon",
      name: "LUA",
      type: "SATÉLITE NATURAL",
      parentId: "earth", // HIERARQUIA: A Lua orbita a Terra em vez do Sol!
      radius: 2,
      orbitRadius: 15,
      relativeSpeed: 12.3, // ~12.3 ciclos lunares por ano terrestre
      initialAngle: 1.0,
      color: "#d4d8e0",
      trailColor: "#cbd5e1",
      distanceText: "384.400 km da Terra",
      periodText: "27,3 dias (ao redor da Terra)",
      tempText: "-23 °C (-173 °C a 127 °C)",
      fact: "A Lua está se afastando da Terra cerca de 3,8 centímetros por ano. Além disso, ela sempre mostra a mesma face para nós (rotação sincronizada).",
    },
    {
      id: "mars",
      name: "MARTE",
      type: "PLANETA ROCHOSO",
      radius: 5,
      orbitRadius: 132,
      relativeSpeed: 0.53, // 365.25 / 687 dias = 0.53x
      initialAngle: 5.2,
      color: "#e05a47",
      trailColor: "#e05a47",
      distanceText: "1,52 UA (227,9 milhões km)",
      periodText: "687 dias terrestres (1,88 anos)",
      tempText: "-65 °C",
      fact: "Marte abriga o Monte Olimpo, o maior vulcão do Sistema Solar, com 21,9 km de altura — quase três vezes a altura do Monte Everest!",
    },
    {
      id: "jupiter",
      name: "JÚPITER",
      type: "GIGANTE GASOSO",
      radius: 14,
      orbitRadius: 184,
      relativeSpeed: 0.22, // Estilizado a partir de 0.084x para boa dinâmica visual
      initialAngle: 1.2,
      color: "#d99b66",
      trailColor: "#e0a96d",
      distanceText: "5,20 UA (778,5 milhões km)",
      periodText: "11,86 anos terrestres",
      tempText: "-110 °C",
      fact: "A Grande Mancha Vermelha de Júpiter é uma tempestade colossal que dura há mais de 300 anos e é maior do que o planeta Terra inteiro!",
    },
    {
      id: "saturn",
      name: "SATURNO",
      type: "GIGANTE GASOSO",
      radius: 12,
      hitRadius: 22, // Inclui os anéis na área clicável
      orbitRadius: 245,
      relativeSpeed: 0.12, // Mais lento que Júpiter
      initialAngle: 3.6,
      color: "#e6c875",
      trailColor: "#e6c875",
      distanceText: "9,58 UA (1,43 bilhão km)",
      periodText: "29,45 anos terrestres",
      tempText: "-140 °C",
      fact: "Os famosos anéis de Saturno têm cerca de 280.000 km de largura, mas são incrivelmente finos: têm em média apenas 10 metros de espessura!",
    },
    {
      id: "uranus",
      name: "URANO",
      type: "GIGANTE DE GELO",
      radius: 9,
      orbitRadius: 304,
      relativeSpeed: 0.065,
      initialAngle: 0.4,
      color: "#73eff7",
      trailColor: "#73eff7",
      distanceText: "19,20 UA (2,87 bilhões km)",
      periodText: "84 anos terrestres",
      tempText: "-195 °C",
      fact: "Urano tem uma inclinação axial de 98 graus: ele literalmente 'rola de lado' ao longo de sua órbita ao redor do Sol!",
    },
    {
      id: "neptune",
      name: "NETUNO",
      type: "GIGANTE DE GELO",
      radius: 9,
      orbitRadius: 356,
      relativeSpeed: 0.04,
      initialAngle: 4.8,
      color: "#3b5dc9",
      trailColor: "#4f77ff",
      distanceText: "30,05 UA (4,50 bilhões km)",
      periodText: "164,8 anos terrestres",
      tempText: "-200 °C",
      fact: "Netuno tem os ventos mais velozes do Sistema Solar, podendo atingir velocidades supersônicas de mais de 2.100 km/h!",
    },
    {
      id: "pluto",
      name: "PLUTÃO",
      type: "PLANETA ANÃO (CINTURÃO DE KUIPER)",
      isOptionalPluto: true,
      radius: 3,
      orbitRadius: 404,
      relativeSpeed: 0.026,
      initialAngle: 2.1,
      color: "#c2a385",
      trailColor: "#c2a385",
      distanceText: "39,48 UA (5,91 bilhões km)",
      periodText: "248 anos terrestres",
      tempText: "-229 °C",
      fact: "Plutão possui uma gigantesca planície de gelo de nitrogênio em formato de coração chamada 'Tombaugh Regio', fotografada pela sonda New Horizons.",
    },
  ];

  // ==========================================================================
  // 4. GERADOR PROCEDURAL DE SPRITES EM PIXEL ART
  // ==========================================================================
  /**
   * Em vez de carregar imagens PNG externas, desenhamos cada planeta pixel por
   * pixel em um Canvas Offscreen (em memória). Isso garante zero dependências
   * e texturas autênticas de Pixel Art (crateras, continentes, Grande Mancha
   * Vermelha de Júpiter e anéis pixelados de Saturno).
   */
  function createPlanetSprite(body) {
    // Saturno e Urano precisam de um canvas maior por causa dos anéis
    const padding = body.id === "saturn" ? 16 : body.id === "uranus" ? 6 : 4;
    const size = (body.radius + padding) * 2;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = size;
    offCanvas.height = size;
    const octx = offCanvas.getContext("2d");
    octx.imageSmoothingEnabled = false;

    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    const r = body.radius;

    // Função auxiliar para pintar 1 pixel inteiro
    const setPixel = (x, y, color) => {
      octx.fillStyle = color;
      octx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    };

    // Desenha a parte de trás dos anéis de Saturno antes da esfera do planeta
    if (body.id === "saturn") {
      drawSaturnRings(setPixel, cx, cy, r, "back");
    }

    // Varre uma grade quadrada [-r, r] e usa a equação do círculo (dx² + dy² <= r²)
    // para esculpir a esfera pixelada de cada astro
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const distSq = dx * dx + dy * dy;
        if (distSq > r * r + 0.5) continue;

        // Cálculo de iluminação esférica simples (luz vinda do topo-esquerda)
        const lightFactor = (-dx * 0.6 - dy * 0.6) / r;
        const isEdge = distSq >= (r - 1) * (r - 1);

        let pixelColor = body.color;

        switch (body.id) {
          case "sun": {
            // Textura de plasma solar granulado
            const distRatio = Math.sqrt(distSq) / r;
            const noise = Math.sin(dx * 1.3) * Math.cos(dy * 1.3);
            if (distRatio > 0.85) pixelColor = "#ff6b1a";
            else if (distRatio > 0.65 || noise > 0.45) pixelColor = "#ff9f1c";
            else if (distRatio > 0.35) pixelColor = "#ffd166";
            else pixelColor = "#fff3b0";
            break;
          }

          case "mercury": {
            pixelColor = "#8b9bb4";
            // Crateras em pixel art
            if ((dx === -1 && dy === -1) || (dx === 2 && dy === 1)) {
              pixelColor = "#5a6988";
            } else if (lightFactor > 0.25) {
              pixelColor = "#c0cbdc";
            } else if (lightFactor < -0.3) {
              pixelColor = "#5a6988";
            }
            break;
          }

          case "venus": {
            // Faixas densas de ácido sulfúrico
            const band = Math.sin((dy + dx * 0.3) * 1.1);
            pixelColor = band > 0.2 ? "#f4d28c" : "#d9a05b";
            if (lightFactor < -0.35) pixelColor = "#9e6835";
            break;
          }

          case "earth": {
            // Oceanos azuis, continentes verdes e calotas polares brancas
            pixelColor = "#2563eb";
            if (Math.abs(dy) >= r - 1) {
              pixelColor = "#f8fafc"; // Calotas polares
            } else {
              // Desenho estilizado dos continentes
              const isContinent =
                (dx >= -4 && dx <= -1 && dy >= -4 && dy <= 3) ||
                (dx >= 1 && dx <= 4 && dy >= -3 && dy <= 4 && dx + dy !== 3);
              if (isContinent) {
                pixelColor = dy < -1 ? "#4ade80" : "#22c55e";
              }
            }
            // Sombra noturna suave na borda direita
            if (lightFactor < -0.45 && Math.abs(dy) < r - 1) {
              pixelColor = "#1e3a8a";
            }
            break;
          }

          case "moon": {
            pixelColor = lightFactor > 0 ? "#e2e8f0" : "#94a3b8";
            if (dx === 0 && dy === 1) pixelColor = "#64748b";
            break;
          }

          case "mars": {
            // Superfície enferrujada com calota polar norte e manchas escuras
            pixelColor = "#d95745";
            if (dy === -r + 1 && Math.abs(dx) <= 1) {
              pixelColor = "#ffffff"; // Calota polar de Marte
            } else if ((dx + dy) % 3 === 0 && dx > -1) {
              pixelColor = "#a8382b";
            } else if (lightFactor > 0.3) {
              pixelColor = "#f2836b";
            }
            break;
          }

          case "jupiter": {
            // Faixas horizontais características de Júpiter
            const absY = Math.abs(dy);
            if (absY <= 2) pixelColor = "#f4e4c1";
            else if (absY <= 5) pixelColor = "#c87d4b";
            else if (absY <= 8) pixelColor = "#e6b88a";
            else if (absY <= 11) pixelColor = "#a65e38";
            else pixelColor = "#7a442a";

            // Grande Mancha Vermelha (no hemisfério sul de Júpiter)
            const spotDx = dx - 3;
            const spotDy = dy - 4;
            if (spotDx * spotDx * 0.6 + spotDy * spotDy * 1.4 <= 6) {
              pixelColor = spotDy < 0 ? "#ef4444" : "#b91c1c";
            }

            if (lightFactor < -0.45 || isEdge) {
              // Escurece levemente a borda para dar volume 3D em pixel art
              if (dx > 0) pixelColor = shadeColor(pixelColor, -22);
            }
            break;
          }

          case "saturn": {
            // Faixas douradas suaves de Saturno
            if (Math.abs(dy) <= 2) pixelColor = "#f7e39c";
            else if (Math.abs(dy) <= 6) pixelColor = "#dfb962";
            else if (Math.abs(dy) <= 9) pixelColor = "#c49a45";
            else pixelColor = "#9e772f";

            if (dx > 3 && isEdge) pixelColor = "#7d5b1f";
            break;
          }

          case "uranus": {
            // Gigante de gelo ciano com bandas verticais sutis (por girar de lado)
            if (dx < -3) pixelColor = "#a5f3fc";
            else if (dx <= 2) pixelColor = "#67e8f9";
            else if (dx <= 6) pixelColor = "#22d3ee";
            else pixelColor = "#0891b2";
            break;
          }

          case "neptune": {
            // Azul cobalto profundo com tempestades brancas e escuras
            if (Math.abs(dy) <= 2) pixelColor = "#3b82f6";
            else if (Math.abs(dy) <= 5) pixelColor = "#2563eb";
            else pixelColor = "#1d4ed8";

            // Grande Mancha Escura + nuvem de metano branca
            if (dx >= -3 && dx <= 0 && dy >= 1 && dy <= 3) {
              pixelColor = "#1e3a8a";
            } else if (dx >= -2 && dx <= 1 && dy === 0) {
              pixelColor = "#93c5fd";
            }
            break;
          }

          case "pluto": {
            pixelColor = lightFactor > 0 ? "#d6b89c" : "#8f7158";
            // "Coração" claro de Plutão (Tombaugh Regio)
            if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1) {
              pixelColor = "#f5ebe0";
            }
            break;
          }
        }

        setPixel(cx + dx, cy + dy, pixelColor);
      }
    }

    // Desenha a parte da frente dos anéis de Saturno (passando na frente do planeta)
    if (body.id === "saturn") {
      drawSaturnRings(setPixel, cx, cy, r, "front");
    }

    // Anel vertical sutil de Urano
    if (body.id === "uranus") {
      for (let ry = -r - 4; ry <= r + 4; ry++) {
        if (Math.abs(ry) > r || ry % 2 === 0) {
          setPixel(cx + Math.round(ry * 0.25), cy + ry, "rgba(165, 243, 252, 0.55)");
        }
      }
    }

    return offCanvas;
  }

  /**
   * Desenha os anéis elípticos inclinados de Saturno em duas camadas
   * ("back" atrás do planeta e "front" na frente do planeta) para criar
   * profundidade 3D perfeita em Pixel Art.
   */
  function drawSaturnRings(setPixel, cx, cy, planetRadius, layer) {
    const tilt = -0.32; // Inclinação dos anéis em radianos
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    const outerA = planetRadius + 13;
    const outerB = 6;
    const innerA = planetRadius + 3;
    const innerB = 2.2;

    for (let dy = -outerA; dy <= outerA; dy++) {
      for (let dx = -outerA; dx <= outerA; dx++) {
        // Rotaciona as coordenadas do pixel para alinhar com a elipse do anel
        const rx = dx * cosT - dy * sinT;
        const ry = dx * sinT + dy * cosT;

        // Separa o que está atrás (ry < 0) do que está na frente (ry >= 0)
        if (layer === "back" && ry >= 0) continue;
        if (layer === "front" && ry < 0) continue;

        const normOuter = (rx * rx) / (outerA * outerA) + (ry * ry) / (outerB * outerB);
        const normInner = (rx * rx) / (innerA * innerA) + (ry * ry) / (innerB * innerB);

        if (normOuter <= 1.0 && normInner >= 1.0) {
          // Divisão de Cassini (espaço escuro no meio dos anéis)
          if (normOuter > 0.62 && normOuter < 0.72) continue;

          const ringColor =
            normOuter > 0.72
              ? "#c9a66b"
              : normOuter > 0.38
              ? "#f3d999"
              : "#d6b265";
          setPixel(cx + dx, cy + dy, ringColor);
        }
      }
    }
  }

  // Utilitário simples para escurecer/clarear cores hexadecimais
  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Inicializa os astros com posição (x, y), ângulo atual, sprite e histórico de rastro
  const bodies = CELESTIAL_DATA.map((data) => ({
    ...data,
    angle: data.initialAngle,
    x: 0,
    y: 0,
    trail: [],
    sprite: createPlanetSprite(data),
  }));

  // Mapa rápido por ID para buscar o astro-pai (ex.: Terra para a Lua)
  const bodyById = Object.fromEntries(bodies.map((b) => [b.id, b]));

  // ==========================================================================
  // 5. FUNDO ESTRELADO PROFUNDO COM ESTRELAS CINTILANTES
  // ==========================================================================
  const STAR_COUNT = 260;
  const stars = [];

  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random(), // Coordenada normalizada [0..1]
      y: Math.random(),
      size: Math.random() > 0.88 ? 2 : 1,
      isCross: Math.random() > 0.94, // Algumas estrelas têm formato de cruz retrô
      twinkleSpeed: 1.5 + Math.random() * 4.0,
      twinkleOffset: Math.random() * Math.PI * 2,
      color:
        Math.random() > 0.8
          ? "#a5f3fc"
          : Math.random() > 0.6
          ? "#fde68a"
          : "#ffffff",
    });
  }

  function drawStarfield(time) {
    // Limpa o fundo com o azul escuro do espaço profundo
    ctx.fillStyle = "#060713";
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      // Parallaxe sutil quando o usuário move a câmera
      const sx =
        (((s.x * viewportWidth - camera.x * 0.08) % viewportWidth) + viewportWidth) %
        viewportWidth;
      const sy =
        (((s.y * viewportHeight - camera.y * 0.08) % viewportHeight) + viewportHeight) %
        viewportHeight;

      // Cintilação baseada em função seno: varia suavemente entre 0.25 e 1.0
      const alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;

      const px = Math.floor(sx);
      const py = Math.floor(sy);

      if (s.isCross && alpha > 0.7) {
        // Estrela brilhante em cruz de 5 pixels
        ctx.fillRect(px, py, 1, 1);
        ctx.fillRect(px - 1, py, 1, 1);
        ctx.fillRect(px + 1, py, 1, 1);
        ctx.fillRect(px, py - 1, 1, 1);
        ctx.fillRect(px, py + 1, 1, 1);
      } else {
        ctx.fillRect(px, py, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // ==========================================================================
  // 6. LÓGICA E MATEMÁTICA DO MOVIMENTO ORBITAL (TRIGONOMETRIA PURA)
  // ==========================================================================
  /**
   * COMO A TRIGONOMETRIA MOVE OS PLANETAS:
   *
   * Imagine um círculo de raio `R` (orbitRadius). Para descobrir onde o planeta
   * está nesse círculo em qualquer ângulo `θ` (angle, medido em radianos):
   *
   *   x = centroX + R * Math.cos(θ)
   *   y = centroY + R * Math.sin(θ)
   *
   * - `Math.cos(θ)` calcula o deslocamento horizontal (eixo X), variando de -1 a +1.
   * - `Math.sin(θ)` calcula o deslocamento vertical (eixo Y), variando de -1 a +1.
   *
   * HIERARQUIA ORBITAL (TERRA -> LUA):
   * - Para os planetas, `(centroX, centroY)` é a posição do Sol `(0, 0)`.
   * - Para a Lua, `(centroX, centroY)` é a posição `(x, y)` atual da Terra!
   *   Assim, enquanto a Terra gira ao redor do Sol, a Lua gira ao redor da Terra.
   */
  function updateOrbits(deltaTime) {
    // 1. Atualiza o ângulo e a posição de cada astro na ordem hierárquica
    for (const body of bodies) {
      if (body.id === "pluto" && !state.showPluto) continue;

      // Incrementa o ângulo: Δθ = velocidadeAngular * Δt * multiplicadorDeTempo
      const angularVelocity = BASE_EARTH_SPEED * body.relativeSpeed;
      body.angle += angularVelocity * deltaTime * state.timeSpeed;

      // Mantém o ângulo no intervalo [0, 2π] para evitar números gigantescos após horas rodando
      if (body.angle > Math.PI * 2) {
        body.angle -= Math.PI * 2;
      }

      // Determina o centro da órbita (Sol = 0,0 ou Astro-Pai no caso da Lua)
      let centerX = 0;
      let centerY = 0;
      if (body.parentId) {
        const parent = bodyById[body.parentId];
        centerX = parent.x;
        centerY = parent.y;
      }

      // Aplica a Trigonometria para encontrar a posição Cartesiana (X, Y)
      body.x = centerX + Math.cos(body.angle) * body.orbitRadius;
      body.y = centerY + Math.sin(body.angle) * body.orbitRadius;

      // Atualiza o rastro luminoso (trail) se o tempo estiver correndo
      if (body.orbitRadius > 0 && state.timeSpeed > 0) {
        body.trail.push({ x: body.x, y: body.y });
        const maxTrailLength = body.parentId ? 18 : 42;
        if (body.trail.length > maxTrailLength) {
          body.trail.shift();
        }
      }
    }

    // 2. Se um astro estiver selecionado, trava o destino da câmera nele
    if (state.selectedBody) {
      if (state.selectedBody.id === "pluto" && !state.showPluto) {
        deselectBody();
      } else {
        camera.targetX = state.selectedBody.x;
        camera.targetY = state.selectedBody.y;
      }
    }

    // 3. Interpolação linear suave (Lerp) da câmera e do zoom
    const smoothing = 1 - Math.pow(0.001, deltaTime);
    camera.x += (camera.targetX - camera.x) * smoothing;
    camera.y += (camera.targetY - camera.y) * smoothing;
    camera.zoom += (camera.targetZoom - camera.zoom) * smoothing;
  }

  // ==========================================================================
  // 7. CONVERSÃO DE COORDENADAS (MUNDO <-> TELA)
  // ==========================================================================
  /**
   * Converte uma coordenada do Sistema Solar (onde 0,0 é o Sol) para a
   * coordenada de pixel no Canvas levando em conta o Pan e o Zoom da câmera.
   */
  function worldToScreen(wx, wy) {
    const sx = (wx - camera.x) * camera.zoom + viewportWidth / 2;
    const sy = (wy - camera.y) * camera.zoom + viewportHeight / 2;
    return { x: sx, y: sy };
  }

  function screenToWorld(sx, sy) {
    const wx = (sx - viewportWidth / 2) / camera.zoom + camera.x;
    const wy = (sy - viewportHeight / 2) / camera.zoom + camera.y;
    return { x: wx, y: wy };
  }

  // ==========================================================================
  // 8. RENDERIZAÇÃO DO SISTEMA SOLAR EM PIXEL ART
  // ==========================================================================
  /**
   * Desenha um círculo pontilhado em Pixel Art (para as linhas de órbita).
   * Como o método nativo `ctx.arc` aplica anti-aliasing nas bordas, calculamos
   * pontos discretos ao redor da circunferência usando Seno e Cosseno e
   * pintamos quadrados de 1x1 pixel para manter a estética 100% retrô!
   */
  function drawPixelOrbit(centerX, centerY, radiusWorld, color, isSelected) {
    const centerScreen = worldToScreen(centerX, centerY);
    const radiusScreen = radiusWorld * camera.zoom;

    // Otimização: ignora se a órbita estiver muito pequena na tela
    if (radiusScreen < 4) return;

    // Quantidade de pontos proporcional ao perímetro da órbita (2 * π * R)
    const circumference = 2 * Math.PI * radiusScreen;
    const steps = Math.max(24, Math.min(360, Math.floor(circumference / 4)));

    ctx.fillStyle = isSelected ? "#73eff7" : color;
    ctx.globalAlpha = isSelected ? 0.65 : 0.25;

    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const px = Math.floor(centerScreen.x + Math.cos(theta) * radiusScreen);
      const py = Math.floor(centerScreen.y + Math.sin(theta) * radiusScreen);

      // Só desenha se o pixel estiver visível dentro do viewport
      if (px >= 0 && px < viewportWidth && py >= 0 && py < viewportHeight) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Desenha o brilho pulsante e a animação de calor ao redor do Sol.
   */
  function drawSunHeatEffect(sunScreenX, sunScreenY, time) {
    const sunRadiusScreen = 22 * camera.zoom;

    // Camadas concêntricas pulsantes
    const pulse1 = Math.sin(time * 3.2) * 3 * camera.zoom;
    const pulse2 = Math.cos(time * 2.1) * 5 * camera.zoom;

    // Halo externo suave
    const grad = ctx.createRadialGradient(
      sunScreenX,
      sunScreenY,
      sunRadiusScreen * 0.4,
      sunScreenX,
      sunScreenY,
      sunRadiusScreen * 2.4 + pulse2
    );
    grad.addColorStop(0, "rgba(255, 210, 80, 0.45)");
    grad.addColorStop(0.5, "rgba(255, 110, 30, 0.18)");
    grad.addColorStop(1, "rgba(255, 60, 0, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sunScreenX, sunScreenY, sunRadiusScreen * 2.4 + pulse2, 0, Math.PI * 2);
    ctx.fill();

    // Partículas/flares solares em pixel art dançando na coroa solar
    const flareCount = 16;
    ctx.fillStyle = "#ffdd55";
    for (let i = 0; i < flareCount; i++) {
      const angle = (i / flareCount) * Math.PI * 2 + time * 0.4;
      const wave = Math.sin(time * 6 + i * 1.7) * 3.5;
      const dist = (24 + wave) * camera.zoom + pulse1 * 0.3;
      const fx = Math.floor(sunScreenX + Math.cos(angle) * dist);
      const fy = Math.floor(sunScreenY + Math.sin(angle) * dist);
      const pSize = Math.max(1, Math.round(camera.zoom));
      ctx.fillRect(fx, fy, pSize, pSize);
    }
  }

  /**
   * Desenha o rastro luminoso (trail) deixado pelo movimento orbital de cada astro.
   */
  function drawPlanetTrail(body) {
    const len = body.trail.length;
    if (len < 2) return;

    ctx.fillStyle = body.trailColor;
    for (let i = 0; i < len; i++) {
      const pt = body.trail[i];
      const screenPt = worldToScreen(pt.x, pt.y);
      const ratio = (i + 1) / len;
      ctx.globalAlpha = ratio * 0.55;

      const size = ratio > 0.7 ? Math.max(1, Math.round(camera.zoom * 0.8)) : 1;
      ctx.fillRect(Math.floor(screenPt.x), Math.floor(screenPt.y), size, size);
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Desenha um colchete de mira retrô ao redor do astro selecionado.
   */
  function drawSelectionReticle(screenX, screenY, radiusScreen, time) {
    const pulse = Math.round(Math.sin(time * 6) * 2);
    const boxHalf = Math.max(8, Math.round(radiusScreen + 6 + pulse));
    const cornerLen = Math.max(3, Math.round(boxHalf * 0.35));

    const left = Math.floor(screenX - boxHalf);
    const right = Math.floor(screenX + boxHalf);
    const top = Math.floor(screenY - boxHalf);
    const bottom = Math.floor(screenY + boxHalf);

    ctx.fillStyle = "#73eff7";

    // Canto superior esquerdo
    ctx.fillRect(left, top, cornerLen, 1);
    ctx.fillRect(left, top, 1, cornerLen);

    // Canto superior direito
    ctx.fillRect(right - cornerLen + 1, top, cornerLen, 1);
    ctx.fillRect(right, top, 1, cornerLen);

    // Canto inferior esquerdo
    ctx.fillRect(left, bottom, cornerLen, 1);
    ctx.fillRect(left, bottom - cornerLen + 1, 1, cornerLen);

    // Canto inferior direito
    ctx.fillRect(right - cornerLen + 1, bottom, cornerLen, 1);
    ctx.fillRect(right, bottom - cornerLen + 1, 1, cornerLen);
  }

  /**
   * Renderiza a cena completa do Planetário a cada frame.
   */
  function renderScene() {
    // 1. Fundo do espaço com estrelas cintilantes
    drawStarfield(state.elapsedTime);

    // 2. Linhas de órbita pontilhadas
    if (state.showOrbits) {
      for (const body of bodies) {
        if (body.orbitRadius === 0) continue;
        if (body.id === "pluto" && !state.showPluto) continue;

        let cx = 0;
        let cy = 0;
        if (body.parentId) {
          const parent = bodyById[body.parentId];
          cx = parent.x;
          cy = parent.y;
        }

        const isSelected = state.selectedBody && state.selectedBody.id === body.id;
        drawPixelOrbit(cx, cy, body.orbitRadius, "#4b699e", isSelected);
      }
    }

    // 3. Rastros luminosos (Trails)
    if (state.showTrails) {
      for (const body of bodies) {
        if (body.orbitRadius === 0) continue;
        if (body.id === "pluto" && !state.showPluto) continue;
        drawPlanetTrail(body);
      }
    }

    // 4. Sol e Planetas em Pixel Art
    for (const body of bodies) {
      if (body.id === "pluto" && !state.showPluto) continue;

      const screenPos = worldToScreen(body.x, body.y);

      // Efeito especial de calor para o Sol
      if (body.id === "sun") {
        drawSunHeatEffect(screenPos.x, screenPos.y, state.elapsedTime);
      }

      // Desenha o sprite pixelado do astro centralizado em sua coordenada
      const spriteW = body.sprite.width * camera.zoom;
      const spriteH = body.sprite.height * camera.zoom;
      const drawX = Math.floor(screenPos.x - spriteW / 2);
      const drawY = Math.floor(screenPos.y - spriteH / 2);

      ctx.drawImage(body.sprite, drawX, drawY, Math.ceil(spriteW), Math.ceil(spriteH));

      // Mira de seleção se o astro estiver focado
      if (state.selectedBody && state.selectedBody.id === body.id) {
        drawSelectionReticle(
          screenPos.x,
          screenPos.y,
          body.radius * camera.zoom,
          state.elapsedTime
        );
      }

      // 5. Rótulos com nomes dos planetas
      if (state.showLabels) {
        // Evita sobrepor o nome da Lua com o da Terra quando o zoom estiver muito distante
        if (body.id === "moon" && camera.zoom < 0.85) continue;

        const labelY = Math.floor(screenPos.y + body.radius * camera.zoom + 9);
        ctx.font = "bold 6px 'Courier New', monospace";
        ctx.textAlign = "center";

        // Sombra preta de 1px para leitura nítida no espaço
        ctx.fillStyle = "#000000";
        ctx.fillText(body.name, Math.floor(screenPos.x) + 1, labelY + 1);

        ctx.fillStyle =
          state.selectedBody && state.selectedBody.id === body.id
            ? "#73eff7"
            : "#cbd5e1";
        ctx.fillText(body.name, Math.floor(screenPos.x), labelY);
      }
    }

    // Atualiza a miniatura animada no Card se houver um astro selecionado
    if (state.selectedBody) {
      renderCardPreview(state.selectedBody, state.elapsedTime);
    }
  }

  /**
   * Renderiza a miniatura em Pixel Art do astro dentro do Card de informações.
   */
  function renderCardPreview(body, time) {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Pequenas estrelas de fundo no card
    previewCtx.fillStyle = "rgba(255,255,255,0.25)";
    previewCtx.fillRect(10, 12, 1, 1);
    previewCtx.fillRect(52, 18, 1, 1);
    previewCtx.fillRect(14, 50, 1, 1);
    previewCtx.fillRect(48, 46, 1, 1);

    // Flutuação suave (bobbing) da miniatura
    const bobOffset = Math.round(Math.sin(time * 3) * 1.5);
    const sprite = body.sprite;

    // Calcula uma escala que preencha bem o canvas 64x64 mantendo múltiplos agradáveis
    const maxDim = Math.max(sprite.width, sprite.height);
    const scale = Math.min(3.2, Math.max(1.2, 46 / maxDim));
    const w = Math.floor(sprite.width * scale);
    const h = Math.floor(sprite.height * scale);
    const x = Math.floor((previewCanvas.width - w) / 2);
    const y = Math.floor((previewCanvas.height - h) / 2) + bobOffset;

    previewCtx.drawImage(sprite, x, y, w, h);
  }

  // ==========================================================================
  // 9. INTERATIVIDADE: CLIQUE NOS PLANETAS, PAN, ZOOM E HUD
  // ==========================================================================
  const infoCard = document.getElementById("info-card");
  const cardType = document.getElementById("card-type");
  const cardName = document.getElementById("card-name");
  const cardDistance = document.getElementById("card-distance");
  const cardPeriod = document.getElementById("card-period");
  const cardTemp = document.getElementById("card-temp");
  const cardFact = document.getElementById("card-fact");
  const zoomDisplay = document.getElementById("zoom-display");

  function updateZoomReadout() {
    zoomDisplay.textContent = `${Math.round(camera.targetZoom * 100)}%`;
  }

  function selectBody(body) {
    state.selectedBody = body;

    // Preenche o Card Retrô com os dados científicos do astro
    cardType.textContent = body.type;
    cardName.textContent = body.name;
    cardDistance.textContent = body.distanceText;
    cardPeriod.textContent = body.periodText;
    cardTemp.textContent = body.tempText;
    cardFact.textContent = body.fact;

    infoCard.classList.remove("hidden");

    // Ajusta o zoom automaticamente se estiver muito afastado para ver o planeta de perto
    if (camera.targetZoom < 1.5 && body.id !== "sun") {
      camera.targetZoom = body.radius <= 5 ? 2.2 : 1.6;
      updateZoomReadout();
    }
  }

  function deselectBody() {
    state.selectedBody = null;
    infoCard.classList.add("hidden");
  }

  function resetCamera() {
    deselectBody();
    camera.targetX = 0;
    camera.targetY = 0;
    camera.targetZoom = 1.0;
    updateZoomReadout();
  }

  // --- Eventos de Mouse no Canvas (Pan & Clique em Planetas) ---
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    camera.isDragging = true;
    camera.hasMovedDuringClick = false;
    camera.dragStartX = e.clientX;
    camera.dragStartY = e.clientY;
    camera.camStartX = camera.targetX;
    camera.camStartY = camera.targetY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!camera.isDragging) {
      // Muda o cursor para "pointer" se estiver sobre algum planeta
      const hovered = getBodyAtClientPos(e.clientX, e.clientY);
      canvas.style.cursor = hovered ? "pointer" : "grab";
      return;
    }

    const dx = e.clientX - camera.dragStartX;
    const dy = e.clientY - camera.dragStartY;

    if (Math.hypot(dx, dy) > 5) {
      camera.hasMovedDuringClick = true;
      // Ao arrastar manualmente, destrava a câmera do planeta selecionado
      if (state.selectedBody) {
        state.selectedBody = null;
        infoCard.classList.add("hidden");
      }
      camera.targetX = camera.camStartX - dx / (PIXEL_SCALE * camera.zoom);
      camera.targetY = camera.camStartY - dy / (PIXEL_SCALE * camera.zoom);
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (!camera.isDragging) return;
    camera.isDragging = false;

    // Se foi um clique rápido (sem arrastar a tela), verifica se clicou em um planeta
    if (!camera.hasMovedDuringClick) {
      const clickedBody = getBodyAtClientPos(e.clientX, e.clientY);
      if (clickedBody) {
        selectBody(clickedBody);
      } else {
        deselectBody();
      }
    }
  });

  // --- Zoom com a Roda do Mouse (Scroll) ---
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
      const nextZoom = Math.min(
        camera.maxZoom,
        Math.max(camera.minZoom, camera.targetZoom * zoomFactor)
      );

      // Se não estiver travado em um astro, faz zoom na direção do cursor
      if (!state.selectedBody) {
        const canvasX = e.clientX / PIXEL_SCALE;
        const canvasY = e.clientY / PIXEL_SCALE;
        const beforeWorld = screenToWorld(canvasX, canvasY);

        camera.targetZoom = nextZoom;

        const afterWorldX =
          (canvasX - viewportWidth / 2) / camera.targetZoom + camera.targetX;
        const afterWorldY =
          (canvasY - viewportHeight / 2) / camera.targetZoom + camera.targetY;

        camera.targetX += beforeWorld.x - afterWorldX;
        camera.targetY += beforeWorld.y - afterWorldY;
      } else {
        camera.targetZoom = nextZoom;
      }

      updateZoomReadout();
    },
    { passive: false }
  );

  // --- Suporte básico a Touch (Dispositivos Móveis) ---
  let touchStartDist = 0;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        camera.isDragging = true;
        camera.hasMovedDuringClick = false;
        camera.dragStartX = t.clientX;
        camera.dragStartY = t.clientY;
        camera.camStartX = camera.targetX;
        camera.camStartY = camera.targetY;
      } else if (e.touches.length === 2) {
        camera.isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 1 && camera.isDragging) {
        const t = e.touches[0];
        const dx = t.clientX - camera.dragStartX;
        const dy = t.clientY - camera.dragStartY;
        if (Math.hypot(dx, dy) > 6) {
          camera.hasMovedDuringClick = true;
          state.selectedBody = null;
          infoCard.classList.add("hidden");
          camera.targetX = camera.camStartX - dx / (PIXEL_SCALE * camera.zoom);
          camera.targetY = camera.camStartY - dy / (PIXEL_SCALE * camera.zoom);
        }
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = newDist / touchStartDist;
        touchStartDist = newDist;
        camera.targetZoom = Math.min(
          camera.maxZoom,
          Math.max(camera.minZoom, camera.targetZoom * ratio)
        );
        updateZoomReadout();
      }
    },
    { passive: true }
  );

  canvas.addEventListener("touchend", (e) => {
    if (camera.isDragging && !camera.hasMovedDuringClick && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const clickedBody = getBodyAtClientPos(t.clientX, t.clientY);
      if (clickedBody) selectBody(clickedBody);
    }
    camera.isDragging = false;
  });

  /**
   * Detecta qual planeta foi clicado usando a Distância Euclidiana (Teorema de Pitágoras):
   *   distância = √((x2 - x1)² + (y2 - y1)²)
   * Damos prioridade para satélites menores (como a Lua) caso estejam próximos do planeta.
   */
  function getBodyAtClientPos(clientX, clientY) {
    const canvasX = clientX / PIXEL_SCALE;
    const canvasY = clientY / PIXEL_SCALE;
    const worldPos = screenToWorld(canvasX, canvasY);

    // Percorre de trás para frente (ou priorizando luas menores)
    const orderedBodies = [...bodies].sort((a, b) => (a.parentId ? -1 : b.parentId ? 1 : 0));

    for (const body of orderedBodies) {
      if (body.id === "pluto" && !state.showPluto) continue;

      const hitR = body.hitRadius || body.radius;
      // Garante uma área mínima de clique confortável mesmo com zoom afastado
      const effectiveRadius = Math.max(hitR + 3, 8 / camera.zoom);
      const dist = Math.hypot(worldPos.x - body.x, worldPos.y - body.y);

      if (dist <= effectiveRadius) {
        return body;
      }
    }
    return null;
  }

  // ==========================================================================
  // 10. CONTROLES DA INTERFACE (HUD RETRÔ)
  // ==========================================================================
  const speedSlider = document.getElementById("speed-slider");
  const speedDisplay = document.getElementById("speed-display");
  const presetButtons = document.querySelectorAll(".preset-btn");

  function setTimeSpeed(newSpeed) {
    state.timeSpeed = newSpeed;
    speedSlider.value = newSpeed;
    speedDisplay.textContent = newSpeed === 0 ? "PAUSADO" : `${newSpeed}x`;

    presetButtons.forEach((btn) => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      btn.classList.toggle("active", btnSpeed === newSpeed);
    });
  }

  speedSlider.addEventListener("input", (e) => {
    setTimeSpeed(parseFloat(e.target.value));
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setTimeSpeed(parseFloat(btn.dataset.speed));
    });
  });

  // Botões de Toggle (Órbitas, Nomes, Rastro, Plutão)
  const toggleOrbitsBtn = document.getElementById("toggle-orbits");
  const toggleLabelsBtn = document.getElementById("toggle-labels");
  const toggleTrailsBtn = document.getElementById("toggle-trails");
  const togglePlutoBtn = document.getElementById("toggle-pluto");

  toggleOrbitsBtn.addEventListener("click", () => {
    state.showOrbits = !state.showOrbits;
    toggleOrbitsBtn.classList.toggle("active", state.showOrbits);
    toggleOrbitsBtn.textContent = `ÓRBITAS: ${state.showOrbits ? "ON" : "OFF"}`;
  });

  toggleLabelsBtn.addEventListener("click", () => {
    state.showLabels = !state.showLabels;
    toggleLabelsBtn.classList.toggle("active", state.showLabels);
    toggleLabelsBtn.textContent = `NOMES: ${state.showLabels ? "ON" : "OFF"}`;
  });

  toggleTrailsBtn.addEventListener("click", () => {
    state.showTrails = !state.showTrails;
    if (!state.showTrails) {
      bodies.forEach((b) => (b.trail = []));
    }
    toggleTrailsBtn.classList.toggle("active", state.showTrails);
    toggleTrailsBtn.textContent = `RASTRO: ${state.showTrails ? "ON" : "OFF"}`;
  });

  togglePlutoBtn.addEventListener("click", () => {
    state.showPluto = !state.showPluto;
    togglePlutoBtn.classList.toggle("active", state.showPluto);
    togglePlutoBtn.textContent = `PLUTÃO: ${state.showPluto ? "ON" : "OFF"}`;
  });

  // Botões de Câmera (+, -, Resetar, Fechar Card)
  document.getElementById("zoom-in").addEventListener("click", () => {
    camera.targetZoom = Math.min(camera.maxZoom, camera.targetZoom * 1.25);
    updateZoomReadout();
  });

  document.getElementById("zoom-out").addEventListener("click", () => {
    camera.targetZoom = Math.max(camera.minZoom, camera.targetZoom * 0.8);
    updateZoomReadout();
  });

  document.getElementById("reset-camera").addEventListener("click", resetCamera);
  document.getElementById("close-card").addEventListener("click", deselectBody);

  // ==========================================================================
  // 11. GAME LOOP PRINCIPAL (requestAnimationFrame)
  // ==========================================================================
  let lastTimestamp = performance.now();

  function gameLoop(currentTimestamp) {
    // Calcula o Delta Time em segundos (limitado a 0.1s caso o usuário troque de aba)
    const deltaTime = Math.min(0.1, (currentTimestamp - lastTimestamp) / 1000);
    lastTimestamp = currentTimestamp;

    state.elapsedTime += deltaTime;

    updateOrbits(deltaTime);
    renderScene();

    requestAnimationFrame(gameLoop);
  }

  // Inicia o simulador!
  requestAnimationFrame(gameLoop);
})();
