(() => {
  'use strict';

  const canvas = document.getElementById('ascii-christmas-tree');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const scene = document.createElement('canvas');
  const sceneCtx = scene.getContext('2d', { alpha: false });
  const backdrop = document.createElement('canvas');
  const backdropCtx = backdrop.getContext('2d', { alpha: false });
  const bloom = document.createElement('canvas');
  const bloomCtx = bloom.getContext('2d');
  if (!ctx || !sceneCtx || !backdropCtx || !bloomCtx) return;
  const bloomLevels = [
    { scale: .60, radius: 3.8, gain: .79 },
    { scale: .36, radius: 10, gain: 1.12 },
    { scale: .20, radius: 23, gain: 1.47 },
    { scale: .11, radius: 46, gain: 1.54 }
  ].map(settings => {
    const image = document.createElement('canvas');
    return { ...settings, image, brush: image.getContext('2d') };
  });

  const TAU = 2 * Math.PI;
  const trunkExtension = .72;
  const starHeight = 8.49 + trunkExtension;
  const cameraDistance = 15.8;
  const subjectHeight = 4.44 + trunkExtension * .5;
  const homeYaw = .47;
  const homePitch = .18;
  const orbitSpeed = .21;
  const frameInterval = 1000 / 24;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function unit(x, y, z) {
    const length = Math.hypot(x, y, z);
    return length > 0 ? [x / length, y / length, z / length] : [0, 0, 0];
  }
  const keyLight = unit(-.60, .71, .62);
  const fillLight = unit(.59, .35, -.69);
  const baubleFill = unit(-.39, .52, .77);
  const ivory = [255, 244, 208];
  const mint = [176, 248, 230];
  const pine = [37, 126, 91];
  const lightGreen = [183, 252, 165];
  const amber = [255, 219, 123];
  const neutral = [218, 239, 227];

  function specular(normal, view, light, gloss) {
    const halfway = unit(view[0] + light[0], view[1] + light[1], view[2] + light[2]);
    return Math.pow(Math.max(0, dot(halfway, normal)), gloss);
  }

  function ink(color, value, reflected = 0, warmth = 0, highlight = neutral) {
    const intensity = clamp(.25 + .80 * value, .18, 1.16);
    return 'rgb(' + color.map((channel, i) => {
      const lit = mix(channel * intensity, amber[i], clamp(warmth, 0, .68));
      return Math.round(clamp(mix(lit, highlight[i], clamp(reflected, 0, .96)), 0, 255));
    }).join(',') + ')';
  }

  let randomState = 278173;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }

  const vertices = [];
  const triangles = [];
  const baubles = [];
  const lights = [];
  const sky = [];
  const needles = { color: [83, 195, 125], kind: 'tree' };
  const wood = { color: [182, 131, 86], kind: 'wood' };
  const gold = { color: [255, 211, 110], kind: 'star' };
  const starEdge = { color: [227, 163, 65], kind: 'star' };
  const ornamentColors = [
    [247, 51, 84], [70, 177, 255], [255, 183, 51], [180, 102, 255],
    [249, 70, 180], [65, 242, 206], [251, 99, 71]
  ];
  const ornamentSurface = { kind: 'ornament' };
  const candySurface = { color: [239, 65, 74], kind: 'candy' };
  const stockingSurface = { color: [216, 38, 55], kind: 'stocking' };
  const sugar = [249, 245, 228];
  const snowOnBranches = [224, 235, 235];

  function vertex(x, y, z, light, u = 0, v = 0, normal = null) {
    vertices.push({ x, y, z, light, u, v, normal, reflection: 0, warmth: 0, sx: 0, sy: 0, inverse: 0 });
    return vertices.length - 1;
  }

  function triangle(a, b, c, surface, crossing = false) {
    triangles.push({ a: vertices[a], b: vertices[b], c: vertices[c], surface, crossing });
  }

  function connectRings(rings, count, surface) {
    for (let j = 1; j < rings.length; j++) {
      const lower = rings[j - 1];
      const upper = rings[j];
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        triangle(lower[i], upper[i], upper[next], surface);
        triangle(lower[i], upper[next], lower[next], surface);
      }
    }
  }

  function lightFrom(normal) {
    return .28 + .79 * Math.max(0, dot(normal, keyLight))
      + .20 * Math.max(0, dot(normal, fillLight));
  }

  const skirts = [
    [.83, 3.25, 2.66], [1.83, 4.24, 2.35], [2.85, 5.12, 2.01],
    [3.84, 5.91, 1.67], [4.78, 6.66, 1.32], [5.66, 7.36, .98], [6.51, 7.95, .66]
  ].map(([base, top, radius]) => [base + trunkExtension, top + trunkExtension, radius]);
  const profile = [
    [0, .57], [.075, .94], [.14, 1], [.23, .91], [.35, .78],
    [.49, .62], [.63, .45], [.78, .30], [.90, .16], [1, .012]
  ];

  function boughScale(angle, depth, layer) {
    const phase = angle + layer * .49;
    return (1 + .074 * Math.cos(phase * 8 + depth * 4)
      + .042 * Math.sin(phase * 13 - depth * 7)
      + .036 * Math.cos(phase * 3));
  }

  for (const [layer, [base, top, radius]] of skirts.entries()) {
    const count = 80;
    const rings = profile.map(([depth, taper], row) => {
      const prev = profile[Math.max(row - 1, 0)];
      const next = profile[Math.min(row + 1, profile.length - 1)];
      const slope = (next[1] - prev[1]) * radius / ((next[0] - prev[0]) * (top - base));
      const normalScale = 1 / Math.hypot(1, slope);
      return Array.from({ length: count }, (_, i) => {
        const angle = TAU * i / count;
        const phase = angle + layer * .49;
        const r = radius * taper * boughScale(angle, depth, layer);
        const scallop = (.07 * Math.sin(phase * 8 + .4) + .042 * Math.cos(phase * 17)) * (1 - depth);
        const normal = [Math.cos(angle) * normalScale, -slope * normalScale, Math.sin(angle) * normalScale];
        const light = lightFrom(normal) + .095 * Math.sin(8 * phase + depth * 4)
          + .10 * (random() - .5) - .15 * (1 - clamp(depth * 7, 0, 1));
        const patch = .66 * Math.sin(angle * 6 + layer * 1.29)
          + .22 * Math.sin(angle * 13 + depth * 8 - layer) + .20 * Math.cos(phase * 3);
        const ledge = clamp(1 - Math.abs(depth - .25) / .17, 0, 1);
        const snow = clamp((patch - .24) * 1.9, 0, 1) * ledge * clamp(.20 + normal[1], 0, 1);
        return vertex(r * Math.cos(angle), mix(base, top, depth) + scallop, r * Math.sin(angle), light, snow, 0, normal);
      });
    });
    connectRings(rings, count, needles);
  }

  const trunk = [[0, .46], [.14, .40], [.61, .34], [1.4 + trunkExtension, .26]];
  connectRings(trunk.map(([y, radius]) => Array.from({ length: 36 }, (_, i) => {
    const a = i / 36 * TAU;
    const normal = [Math.cos(a), 0, Math.sin(a)];
    const groove = Math.sin(a * 11 + y * 1.6);
    const barkRadius = radius + groove * .016;
    return vertex(normal[0] * barkRadius, y, normal[2] * barkRadius, lightFrom(normal) + groove * .09);
  })), 36, wood);

  function foliageRadius(y, angle) {
    let radius = 0;
    skirts.forEach(([base, top, size], layer) => {
      const depth = (y - base) / (top - base);
      if (depth < 0 || depth > 1) return;
      const end = profile.findIndex(([height]) => height >= depth);
      const a = profile[Math.max(0, end - 1)];
      const b = profile[end];
      const taper = a === b ? a[1] : mix(a[1], b[1], (depth - a[0]) / (b[0] - a[0]));
      radius = Math.max(radius, size * taper * boughScale(angle, depth, layer));
    });
    return radius;
  }

  function decorationVertex(x, y, z, angle, tilt, size) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const leanCos = Math.cos(tilt);
    const leanSin = Math.sin(tilt);
    return (u, v, w, nx, ny, nz, textureU = u, textureV = v) => {
      const side = (u * leanCos - v * leanSin) * size;
      const up = (u * leanSin + v * leanCos) * size;
      const forward = w * size;
      const normalSide = nx * leanCos - ny * leanSin;
      const normal = unit(normalSide * sin + nz * cos, nx * leanSin + ny * leanCos, -normalSide * cos + nz * sin);
      return vertex(x + side * sin + forward * cos, y + up, z - side * cos + forward * sin,
        lightFrom(normal), textureU, textureV, normal);
    };
  }

  function makeCandyCane(point) {
    const hook = .205;
    const shoulder = .23;
    const path = Array.from({ length: 9 }, (_, i) => [-hook, mix(-.49, shoulder, i / 8)]);
    for (let i = 1; i <= 14; i++) {
      const angle = Math.PI * (1 - i / 14);
      path.push([hook * Math.cos(angle), shoulder + hook * Math.sin(angle)]);
    }
    path.push([hook, shoulder - .085]);
    const count = 12;
    const radius = .098;
    let distance = 0;
    const directions = [];
    const rings = path.map(([x, y], i) => {
      const before = path[Math.max(0, i - 1)];
      const after = path[Math.min(i + 1, path.length - 1)];
      distance += Math.hypot(x - before[0], y - before[1]);
      const [nx, ny] = unit(after[1] - before[1], before[0] - after[0], 0);
      directions.push([nx, ny]);
      return Array.from({ length: count }, (_, j) => {
        const angle = TAU * j / count;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return point(x + radius * nx * c, y + radius * ny * c, radius * s,
          nx * c, ny * c, s, distance, c);
      });
    });
    connectRings(rings, count, candySurface);
    for (const i of [0, rings.length - 1]) {
      const [x, y] = path[i];
      const [nx, ny] = directions[i];
      const end = i === 0 ? point(x, y, 0, -ny, nx, 0, 0, 0)
        : point(x, y, 0, ny, -nx, 0, distance, 0);
      for (let j = 0; j < count; j++) triangle(end, rings[i][j], rings[i][(j + 1) % count], candySurface);
    }
  }

  function makeStocking(point) {
    const silhouette = [
      [-.22, .47], [.20, .47], [.21, -.13], [.40, -.15], [.51, -.25],
      [.49, -.38], [.35, -.47], [-.12, -.50], [-.27, -.42], [-.31, -.28], [-.22, -.13]
    ];
    const heelY = -.24;
    const count = silhouette.length;
    const rings = [-1, -.64, .64, 1].map(section => {
      const face = Math.abs(section) === 1;
      const inset = face ? .9 : 1;
      return silhouette.map(([u, v]) => point(u * inset, mix(heelY, v, inset), section * .119,
        u * (face ? .8 : 3), (v - heelY) * (face ? .5 : 2), section));
    });
    connectRings(rings, count, stockingSurface);
    for (const side of [-1, 1]) {
      const ring = side < 0 ? rings[0] : rings[3];
      const face = point(0, heelY, side * .127, 0, 0, side);
      for (let j = 0; j < count; j++) triangle(face, ring[j], ring[(j + 1) % count], stockingSurface);
    }
  }

  function hangLoop(angle, radius, y) {
    const hookY = y + .15;
    const hookR = Math.min(radius, foliageRadius(hookY, angle) + .08);
    for (let j = 1; j <= 5; j++) {
      const t = j / 5;
      const r = mix(radius, hookR, t);
      lights.push({ x: Math.cos(angle) * r, y: mix(y, hookY, t), z: Math.sin(angle) * r,
        glyph: '|', color: [211, 184, 109], emission: .21 });
    }
  }

  const decorationLayouts = [
    ['bauble', 'candy', 'bauble', 'stocking', 'bauble', null, 'bauble', 'candy', null, 'bauble'],
    ['stocking', 'bauble', 'candy', 'bauble', 'bauble', null, 'bauble', 'stocking', 'bauble'],
    ['bauble', 'bauble', 'stocking', 'bauble', null, 'bauble', 'candy', 'bauble'],
    ['bauble', 'bauble', 'bauble', 'stocking', 'bauble', null, 'bauble'],
    ['bauble', 'candy', 'bauble', 'bauble', null, 'bauble'],
    ['bauble', 'bauble', 'bauble', null, 'bauble'],
    ['bauble', 'bauble', null, 'bauble']
  ];

  for (const [layer, layout] of decorationLayouts.entries()) {
    const [base] = skirts[layer];
    for (const [i, kind] of layout.entries()) {
      const angle = (i + random() * .64 + layer * .47) * TAU / layout.length;
      const y = base + .16 + random() * .54;
      const size = (.184 + random() * .126) * (1 - layer * .039);
      const r = foliageRadius(y, angle) + size * .64;
      if (kind === null) continue;
      if (kind === 'candy' || kind === 'stocking') {
        const hangSize = 1.12 - layer * .062;
        const radius = Math.max(r, foliageRadius(y - .22, angle) + .14);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const point = decorationVertex(x, y, z, angle, kind === 'candy' ? -.17 : .12, hangSize);
        if (kind === 'candy') {
          makeCandyCane(point);
        } else {
          makeStocking(point);
          hangLoop(angle, radius, y + .46 * hangSize);
        }
        continue;
      }
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const color = ornamentColors[(i + layer * 3) % ornamentColors.length];
      baubles.push({ x, y, z, radius: size, color });
      lights.push({ x, y: y + size * .98, z, glyph: '=', color: [255, 212, 137], emission: .46 });
      hangLoop(angle, r, y + size);
    }
  }

  const strandCount = 1100;
  const strand = Array.from({ length: strandCount }, (_, i) => {
    const fraction = i / (strandCount - 1);
    const a = fraction * TAU * 4.55 + 1.6;
    const y = mix(1.04, 7.7, fraction) + trunkExtension;
    const radius = 2.87 * Math.pow(1 - fraction, 1.01) + .18;
    const bulb = i % 19 === 0;
    return {
      x: Math.cos(a) * radius, y, z: Math.sin(a) * radius,
      glyph: bulb ? '#' : '=',
      color: bulb ? [255, 249, 195] : [246, 226, 119],
      emission: bulb ? 1 : .70, strandIndex: i
    };
  });
  lights.push(...strand);

  for (let i = 0; i < 110; i++) {
    const y = mix(1.22, 7.65, Math.pow(random(), 1.23)) + trunkExtension;
    const a = random() * TAU;
    const r = foliageRadius(y, a) + .025;
    const bright = random() > .78;
    lights.push({
      x: r * Math.cos(a), y, z: r * Math.sin(a), glyph: bright ? '*' : '+',
      color: bright ? [255, 231, 165] : [152, 207, 123], emission: bright ? .76 : .3
    });
  }

  // Bevel both sides of the five-pointed topper.
  {
    const cos = Math.cos(homeYaw);
    const sin = Math.sin(homeYaw);
    const starPoint = (x, y, z, brightness) => vertex(x * cos + z * sin, y + starHeight, -x * sin + z * cos, brightness);
    for (const side of [-1, 1]) {
      const rim = [];
      const face = [];
      const center = starPoint(0, 0, side * .19, 1.25);
      for (let i = 0; i < 10; i++) {
        const angle = Math.PI / 2 + TAU * i / 10;
        const r = i % 2 === 0 ? .80 : .29;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        rim.push(starPoint(x, y, 0, .79 + y * .25));
        face.push(starPoint(x * .82, y * .82, side * .105, 1.04 + y * .32 + x * .15));
      }
      for (let i = 0; i < 10; i++) {
        const j = (i + 1) % 10;
        triangle(center, face[i], face[j], gold);
        triangle(face[i], rim[i], rim[j], starEdge);
        triangle(face[i], rim[j], face[j], starEdge);
      }
    }
  }

  const gifts = [
    [-2.77, .43, 1.18, 1.03, .94, -.17, [236, 63, 97], [255, 195, 106]],
    [-.88, 1.95, 1.28, 1.17, 1.04, .19, [164, 100, 243], [255, 206, 113]],
    [1.40, 2.53, 1.32, .59, .86, -.29, [243, 86, 127], [255, 215, 141]],
    [2.40, .92, 1.37, 1.05, .97, .28, [70, 204, 160], [246, 236, 161]],
    [-3.24, -.76, .84, .60, .79, .36, [166, 112, 235], [242, 204, 255]],
    [2.93, -.87, .89, 1.34, .80, -.18, [67, 115, 211], [213, 237, 250]],
    [-1.55, -2.52, .98, .74, .90, -.13, [95, 157, 240], [249, 221, 141]]
  ];
  const giftSpread = 1.55;
  const giftRadius = Math.max(...gifts.map(([x, z, width, , depth]) =>
    Math.hypot(x, z) * giftSpread + Math.hypot(width, depth) / 2
  ));

  gifts.forEach(([cx, cz, width, height, depth, tilt, rgb, ribbon]) => {
    const cos = Math.cos(tilt + homeYaw);
    const sin = Math.sin(tilt + homeYaw);
    const ox = giftSpread * (cx * Math.cos(homeYaw) + cz * Math.sin(homeYaw));
    const oz = giftSpread * (-cx * Math.sin(homeYaw) + cz * Math.cos(homeYaw));
    const pos = (x, y, z) => ({ x: ox + x * cos + z * sin, y, z: oz - x * sin + z * cos });
    const wrapper = { kind: 'gift', color: rgb, ribbon };

    function face(corners, [nx, ny, nz], crossing = false) {
      const normal = [nx * cos + nz * sin, ny, -nx * sin + nz * cos];
      const light = lightFrom(normal);
      const ids = corners.map(([x, y, z], i) => {
        const p = pos(x, y, z);
        return vertex(p.x, p.y, p.z, light, [0, 1, 1, 0][i], [0, 0, 1, 1][i], normal);
      });
      triangle(ids[0], ids[1], ids[2], wrapper, crossing);
      triangle(ids[0], ids[2], ids[3], wrapper, crossing);
    }

    const a = width / 2;
    const b = depth / 2;
    face([[-a, height, -b], [a, height, -b], [a, height, b], [-a, height, b]], [0, 1, 0], true);
    for (const sign of [-1, 1]) {
      const z = b * sign;
      const x = a * sign;
      face([[-a, 0, z], [a, 0, z], [a, height, z], [-a, height, z]], [0, 0, sign]);
      face([[x, 0, -b], [x, 0, b], [x, height, b], [x, height, -b]], [sign, 0, 0]);
      for (let j = 0; j < 35; j++) {
        const t = j / 34 * TAU;
        const loop = .5 - .5 * Math.cos(t);
        const p = pos(sign * loop * a * .65, height + .028 + Math.sin(t / 2) * .20, Math.sin(t) * b * .44);
        lights.push({ ...p, glyph: j % 3 ? '-' : '+', color: ribbon, emission: .56 });
      }
    }
    lights.push({ ...pos(0, height + .07, 0), glyph: '*', color: ribbon, emission: .65 });
  });

  // Nearby bulbs pick out individual needle and ribbon characters.
  const bulbs = lights.filter(lamp => lamp.emission >= .76);
  for (const p of vertices) {
    if (!p.normal) continue;
    for (const bulb of bulbs) {
      const dx = bulb.x - p.x;
      const dy = bulb.y - p.y;
      const dz = bulb.z - p.z;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance >= .49) continue;
      const facing = Math.max(0, dot(p.normal, unit(dx, dy, dz)));
      p.warmth += Math.pow(1 - distance / .49, 2.6) * (.12 + .24 * facing);
    }
  }

  for (let i = 0; i < 32; i++) {
    sky.push({
      x: random(), y: random(), alpha: .13 + random() * .46,
      glyph: i < 2 ? '+' : i < 5 ? '*' : i < 10 ? ':' : '.'
    });
  }

  const snowflakes = Array.from({ length: 86 }, (_, i) => ({
    x: mix(-5.4, 5.4, random()), y: random() * 10,
    z: mix(-4, 4.7, random()), speed: mix(.095, .29, random()),
    phase: random() * TAU, alpha: mix(.19, .64, random()), glyph: i < 8 ? '*' : i < 22 ? '+' : '.'
  }));

  const groundSnowRadius = 10.2;
  const groundSnow = Array.from({ length: 760 }, () => {
    const angle = random() * TAU;
    const radius = Math.sqrt(random()) * groundSnowRadius;
    const shade = 1 - .60 * Math.max(0, 1 - radius / 2.5);
    const fade = 1 - Math.pow(radius / groundSnowRadius, 3);
    return {
      x: radius * Math.cos(angle), y: 0, z: radius * Math.sin(angle),
      alpha: (.13 + .42 * random()) * shade * fade,
      glyph: '.,.-:._'[Math.floor(random() * 7)]
    };
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width, height, cellWidth, cellHeight, cols, rows, size, scale, originY, font;
  let depthBuffer, surfaceBuffer, toneBuffer, uBuffer, vBuffer, ribbonBuffer, texture, reflectionBuffer, warmthBuffer;
  let baubleInk, baubleGlyph;
  const background = getComputedStyle(canvas).getPropertyValue('--background').trim() || '#18191b';
  const snowColor = '#cae8e0';
  let inView = false;
  let animation = 0;
  let lastFrame = 0;
  let time = 0;
  let needsLayout = true;
  let sceneLights;

  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    if (width < 1 || height < 1) return;
    const pixelRatio = clamp(devicePixelRatio || 1, 1.5, 2.5);
    const bloomScale = Math.min(pixelRatio, 1.25);
    backdrop.width = scene.width = canvas.width = Math.round(width * pixelRatio);
    backdrop.height = scene.height = canvas.height = Math.round(height * pixelRatio);
    bloom.width = Math.round(width * bloomScale);
    bloom.height = Math.round(height * bloomScale);
    for (const level of bloomLevels) {
      level.image.width = Math.max(1, Math.round(width * level.scale * bloomScale));
      level.image.height = Math.max(1, Math.round(height * level.scale * bloomScale));
      level.brush.imageSmoothingQuality = 'high';
    }
    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    sceneCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    backdropCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    bloomCtx.setTransform(bloom.width / width, 0, 0, bloom.height / height, 0, 0);
    cellWidth = clamp(width / 195, 3.2, 4.15);
    cellHeight = cellWidth * 1.34;
    cols = Math.ceil(width / cellWidth);
    rows = Math.ceil(height / cellHeight);
    size = cols * rows;
    font = (cellWidth * 1.94).toFixed(2) + 'px "IBM Plex Mono", Consolas, monospace';
    depthBuffer = new Float32Array(size);
    surfaceBuffer = new Array(size);
    toneBuffer = new Float32Array(size);
    uBuffer = new Float32Array(size);
    vBuffer = new Float32Array(size);
    warmthBuffer = new Float32Array(size);
    reflectionBuffer = new Float32Array(size);
    ribbonBuffer = new Uint8Array(size);
    baubleInk = new Array(size);
    baubleGlyph = new Array(size);
    texture = Float32Array.from({ length: size }, () => random());
    needsLayout = true;
    queueFrame();
  }

  const camera = {
    yawCos: Math.cos(homeYaw), yawSin: Math.sin(homeYaw),
    pitchCos: Math.cos(homePitch), pitchSin: Math.sin(homePitch)
  };
  function project(p, out = {}) {
    const x = p.x * camera.yawCos - p.z * camera.yawSin;
    const z = p.x * camera.yawSin + p.z * camera.yawCos;
    const y = p.y - subjectHeight;
    const toward = z * camera.pitchCos + y * camera.pitchSin;
    const inverse = cameraDistance / (cameraDistance - toward);
    out.sx = width * .5 + x * scale * inverse;
    out.sy = originY - (y * camera.pitchCos - z * camera.pitchSin) * scale * inverse;
    out.inverse = inverse;
    return out;
  }

  function toCamera([x, y, z]) {
    const right = x * camera.yawCos - z * camera.yawSin;
    const forward = x * camera.yawSin + z * camera.yawCos;
    return [right, y * camera.pitchCos - forward * camera.pitchSin, forward * camera.pitchCos + y * camera.pitchSin];
  }

  function rasterize({ a, b, c, surface, crossing }) {
    const ux = b.sx - a.sx;
    const uy = b.sy - a.sy;
    const vx = c.sx - a.sx;
    const vy = c.sy - a.sy;
    const area = ux * vy - uy * vx;
    if (Math.abs(area) < .01) return;
    const left = Math.max(0, Math.ceil(Math.min(a.sx, b.sx, c.sx) / cellWidth - .5));
    const right = Math.min(cols - 1, Math.floor(Math.max(a.sx, b.sx, c.sx) / cellWidth - .5));
    const top = Math.max(0, Math.ceil(Math.min(a.sy, b.sy, c.sy) / cellHeight - .5));
    const bottom = Math.min(rows - 1, Math.floor(Math.max(a.sy, b.sy, c.sy) / cellHeight - .5));
    for (let row = top; row <= bottom; row++) {
      const dy = (row + .5) * cellHeight - a.sy;
      for (let col = left; col <= right; col++) {
        const dx = (col + .5) * cellWidth - a.sx;
        const wb = (dx * vy - dy * vx) / area;
        const wc = (ux * dy - uy * dx) / area;
        const wa = 1 - wb - wc;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const pa = wa * a.inverse;
        const pb = wb * b.inverse;
        const pc = wc * c.inverse;
        const inverse = pa + pb + pc;
        const index = row * cols + col;
        if (inverse <= depthBuffer[index]) continue;
        depthBuffer[index] = inverse;
        surfaceBuffer[index] = surface;
        toneBuffer[index] = (pa * a.light + pb * b.light + pc * c.light) / inverse;
        reflectionBuffer[index] = (pa * a.reflection + pb * b.reflection + pc * c.reflection) / inverse;
        warmthBuffer[index] = (pa * a.warmth + pb * b.warmth + pc * c.warmth) / inverse;
        uBuffer[index] = (pa * a.u + pb * b.u + pc * c.u) / inverse;
        vBuffer[index] = (pa * a.v + pb * b.v + pc * c.v) / inverse;
        ribbonBuffer[index] = crossing;
      }
    }
  }

  function rasterizeBauble(bauble, key, fill, up) {
    const center = project(bauble);
    const radius = bauble.radius;
    const span = radius * center.inverse * scale * 1.21;
    const left = Math.max(0, Math.ceil((center.sx - span) / cellWidth - .5));
    const right = Math.min(cols - 1, Math.floor((center.sx + span) / cellWidth - .5));
    const top = Math.max(0, Math.ceil((center.sy - span) / cellHeight - .5));
    const bottom = Math.min(rows - 1, Math.floor((center.sy + span) / cellHeight - .5));
    const [cx, cy, cz] = toCamera([bauble.x, bauble.y - subjectHeight, bauble.z]);
    const offset = [-cx, -cy, cameraDistance - cz];
    const c = dot(offset, offset) - radius * radius;

    // Solve the eye ray against the sphere at each character center.
    for (let row = top; row <= bottom; row++) {
      const rayY = (originY - (row + .5) * cellHeight) / scale;
      for (let col = left; col <= right; col++) {
        const rayX = ((col + .5) * cellWidth - width * .5) / scale;
        const ray = [rayX, rayY, -cameraDistance];
        const a = dot(ray, ray);
        const b = dot(ray, offset);
        const discriminant = b * b - a * c;
        if (discriminant < 0) continue;
        const t = (-b - Math.sqrt(discriminant)) / a;
        const inverse = 1 / t;
        const index = row * cols + col;
        if (inverse <= depthBuffer[index]) continue;

        const normal = offset.map((value, axis) => (value + t * ray[axis]) / radius);
        const view = unit(-rayX, -rayY, cameraDistance);
        const facing = clamp(dot(view, normal), 0, 1);
        const skyward = dot(normal, up);
        const mirrorUp = 2 * facing * skyward - dot(view, up);
        const mirrorBand = Math.exp(-Math.pow((mirrorUp + .12) / .30, 2));
        const keyReflection = specular(normal, view, key, 30);
        const frontReflection = specular(normal, view, baubleFill, 18);
        const gloss = Math.max(keyReflection, frontReflection * .96);
        const reflectedWindow = specular(normal, view, fill, 17);
        const diffuse = .13 + .62 * Math.max(0, dot(normal, key))
          + .32 * Math.max(0, dot(normal, baubleFill))
          + .16 * Math.max(0, dot(normal, fill)) + .18 * facing;
        const rim = Math.pow(1 - facing, 3) * Math.max(0, skyward + .30) * .37;
        const base = bauble.color.map((channel, i) =>
          mix(channel, pine[i], mirrorBand * .16 * (1 - gloss)));
        const polish = Math.max(gloss, reflectedWindow * .62 + rim)
          + .18 * Math.max(0, diffuse - .52);
        const color = gloss > reflectedWindow * .7 ? ivory : mint;
        baubleInk[index] = ink(base, diffuse, polish, .04 * mirrorBand, color);
        baubleGlyph[index] = gloss > .45 ? '@' : reflectedWindow > .31 ? '#' :
          facing < .38 ? 'o' : diffuse > .73 ? '%' : 'O';
        surfaceBuffer[index] = ornamentSurface;
        depthBuffer[index] = inverse;
      }
    }
  }

  function emitGlyph(glyph, color, x, y, strength) {
    bloomCtx.globalAlpha = strength;
    bloomCtx.fillStyle = color;
    bloomCtx.fillText(glyph, x, y);
  }

  function drawSurfaces() {
    const foliage = ['=+', '+x', 'xv', 'xY', 'vx', 'YX', 'X*', '*#', '#%', '%@'];
    const bark = ['|+', 'I|', 'IY', 'Y#', '#%'];
    for (let index = 0; index < size; index++) {
      const surface = surfaceBuffer[index];
      if (!surface) continue;
      const x = (index % cols + .5) * cellWidth;
      const y = (Math.floor(index / cols) + .5) * cellHeight;
      const noise = texture[index] - .5;
      const directLight = Math.max(0, toneBuffer[index] - .64);
      let tone = toneBuffer[index] + (depthBuffer[index] - 1) * .3;
      let color = surface.color;
      let reflection = reflectionBuffer[index];
      const warmth = warmthBuffer[index];
      let highlight = neutral;
      let glyph;
      switch (surface.kind) {
        case 'tree': {
          if (sceneLights.get(index)?.lamp.strandIndex !== undefined) continue;
          tone += noise * .21;
          const band = foliage[clamp(Math.floor(tone * 7.3 + warmth * 3.5), 0, 9)];
          glyph = band[noise > .04 ? 1 : 0];
          highlight = lightGreen;
          tone -= directLight * .17;
          reflection = reflection * (.48 + .52 * (noise + .5)) + directLight * .45;
          if (uBuffer[index] > .34 + noise * .17) {
            color = snowOnBranches;
            highlight = neutral;
            glyph = tone > .64 ? (noise > .06 ? '#' : '+') : (noise > .10 ? 'x' : '=');
            tone = .41 + tone * .40;
            reflection *= .38;
          }
          break;
        }
        case 'candy': {
          const stripe = Math.floor(uBuffer[index] * 6.4 + vBuffer[index] * .51 + 2) % 2 === 0;
          color = stripe ? surface.color : sugar;
          highlight = ivory;
          glyph = stripe ? (noise > .12 ? '#' : '%') : (noise > .08 ? '#' : '=');
          tone = .38 + tone * .67;
          break;
        }
        case 'stocking': {
          const u = uBuffer[index];
          const v = vBuffer[index];
          const cuff = v > .24;
          const toe = u > .37 && v < -.22;
          color = cuff || toe ? sugar : surface.color;
          glyph = cuff ? (noise > 0 ? '#' : '=') : (noise > .02 ? 'x' : '#');
          tone = .27 + tone * .72;
          reflection *= .45;
          break;
        }
        case 'gift': {
          const u = uBuffer[index];
          const v = vBuffer[index];
          const vertical = Math.min(u, 1 - u);
          const horizontal = Math.min(v, 1 - v);
          const stripe = Math.abs(u - .5) < .113 || (ribbonBuffer[index] && Math.abs(v - .5) < .113);
          const edge = vertical < .047 || horizontal < .055;
          const satinBand = Math.max(0, 1 - Math.abs(u * .72 + v * .28 - .63) * 7);
          highlight = ivory;
          reflection = reflection * (.42 + .58 * satinBand) + directLight * .28;
          if (stripe) {
            color = surface.ribbon;
            tone += .20;
            reflection += .12 + .17 * satinBand;
          } else {
            tone -= directLight * .17;
            reflection -= directLight * .08;
          }
          glyph = vertical < .055 && horizontal < .085 ? '+'
            : horizontal < .055 ? '='
            : vertical < .047 ? '|'
            : stripe ? '=+#'[noise > .12 ? 2 : noise > -.15 ? 1 : 0]
            : '=+xXx'[clamp(Math.floor((noise + .5) * 5), 0, 4)];
          tone += .06 + noise * .16;
          if (edge && v > .6) reflection += .13;
          break;
        }
        case 'ornament':
          sceneCtx.fillStyle = baubleInk[index];
          sceneCtx.fillText(baubleGlyph[index], x, y);
          if (baubleGlyph[index] === '@') emitGlyph('@', baubleInk[index], x, y, .58);
          continue;
        case 'star':
          glyph = tone > 1.12 ? '@' : tone > .9 ? '#' : 'x';
          highlight = ivory;
          reflection += clamp((tone - .81) * .59, 0, .31);
          if (tone > .77) emitGlyph(glyph, '#efa951', x, y, .37);
          tone += .06;
          break;
        case 'wood':
          glyph = bark[clamp(Math.floor(tone * 5), 0, 4)][noise > .16 ? 1 : 0];
          tone += .13 - directLight * .13;
      }
      sceneCtx.fillStyle = ink(color, tone, reflection, warmth, highlight);
      sceneCtx.fillText(glyph, x, y);
    }
  }

  function activeLights() {
    const visible = new Map();
    for (const lamp of lights) {
      const p = project(lamp);
      const col = Math.floor(p.sx / cellWidth);
      const row = Math.floor(p.sy / cellHeight);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const index = row * cols + col;
      const depth = depthBuffer[index];
      if (p.inverse < depth - .001) continue;
      const earlier = visible.get(index);
      if (!earlier || p.inverse > earlier.inverse + .017 ||
          (p.inverse >= earlier.inverse - .017 && lamp.emission > earlier.lamp.emission)) {
        let glyph = lamp.glyph;
        if (glyph === '=' && lamp.strandIndex !== undefined) {
          const next = project(strand[Math.min(lamp.strandIndex + 1, strand.length - 1)]);
          const previous = project(strand[Math.max(lamp.strandIndex - 1, 0)]);
          const dx = (next.sx - previous.sx) / cellWidth;
          const dy = (next.sy - previous.sy) / cellHeight;
          if (Math.abs(dy) > Math.abs(dx) * 1.8) glyph = '|';
          else if (Math.abs(dy) > Math.abs(dx) * .45) glyph = dx * dy > 0 ? '\\' : '/';
        }
        visible.set(index, {
          lamp, glyph, phase: index * .81, inverse: p.inverse,
          sx: (col + .5) * cellWidth, sy: (row + .5) * cellHeight
        });
      }
    }
    return visible;
  }

  function paintMist(x, y, rx, ry, color, opacity) {
    backdropCtx.save();
    backdropCtx.translate(x, y);
    backdropCtx.scale(rx, ry);
    const gradient = backdropCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, 'rgba(' + color + ',' + opacity + ')');
    gradient.addColorStop(.46, 'rgba(' + color + ',' + opacity * .58 + ')');
    gradient.addColorStop(.77, 'rgba(' + color + ',' + opacity * .16 + ')');
    gradient.addColorStop(1, 'rgba(' + color + ',0)');
    backdropCtx.fillStyle = gradient;
    backdropCtx.fillRect(-1, -1, 2, 2);
    backdropCtx.restore();
  }

  function paintBackdrop() {
    backdropCtx.globalAlpha = 1;
    backdropCtx.fillStyle = background;
    backdropCtx.fillRect(0, 0, width, height);
    const mistCenter = project({ x: 0, y: 4.2, z: 0 });
    paintMist(mistCenter.sx, mistCenter.sy, Math.min(width * .48, scale * 5.25),
      scale * 5.6, '55,101,88', .30);
    paintMist(mistCenter.sx + scale * .63, mistCenter.sy + scale * 1.02,
      Math.min(width * .43, scale * 4.3), scale * 3.6, '125,104,65', .14);
    const floor = project({ x: 0, y: .26, z: 0 });
    paintMist(floor.sx, floor.sy - scale * .34,
      Math.min(width * .47, scale * 8), scale * 1.58, '95,133,123', .18);
    backdropCtx.font = font;
    backdropCtx.textAlign = 'center';
    backdropCtx.textBaseline = 'middle';
    backdropCtx.fillStyle = snowColor;
    for (const speck of sky) {
      backdropCtx.globalAlpha = speck.alpha * (1 - .82 * Math.pow(speck.y, 3));
      backdropCtx.fillText(speck.glyph, speck.x * width, speck.y * height);
    }
  }

  function paintScene() {
    sceneCtx.globalAlpha = 1;
    sceneCtx.drawImage(backdrop, 0, 0, width, height);
    sceneCtx.font = font;
    sceneCtx.textAlign = 'center';
    sceneCtx.textBaseline = 'middle';
    sceneCtx.fillStyle = snowColor;
    const point = {};
    for (const flake of groundSnow) {
      project(flake, point);
      const edge = Math.min(point.sx, width - point.sx, height - point.sy);
      sceneCtx.globalAlpha = flake.alpha * clamp(edge / 20, 0, 1);
      sceneCtx.fillText(flake.glyph, point.sx, point.sy);
    }
    sceneCtx.globalAlpha = 1;
    bloomCtx.clearRect(0, 0, width, height);
    bloomCtx.font = font;
    bloomCtx.textAlign = 'center';
    bloomCtx.textBaseline = 'middle';
    drawSurfaces();

    for (const { lamp, glyph, sx, sy } of sceneLights.values()) {
      if (lamp.strandIndex === undefined && lamp.emission < .76) continue;
      const strength = lamp.emission >= 1 ? .87 : lamp.strandIndex === undefined ? .47 : .62;
      emitGlyph(glyph, ink(lamp.color, 1.1), sx, sy, strength);
    }

    // Downsample the highlights at several scales and add their blurred light.
    sceneCtx.save();
    sceneCtx.globalCompositeOperation = 'lighter';
    sceneCtx.imageSmoothingQuality = 'high';
    for (const { image, brush, radius, gain } of bloomLevels) {
      brush.clearRect(0, 0, image.width, image.height);
      brush.filter = 'blur(' + radius * image.width / width + 'px)';
      brush.drawImage(bloom, 0, 0, image.width, image.height);
      sceneCtx.globalAlpha = Math.min(1, gain);
      sceneCtx.drawImage(image, 0, 0, width, height);
      if (gain > 1) {
        sceneCtx.globalAlpha = gain - 1;
        sceneCtx.drawImage(image, 0, 0, width, height);
      }
    }
    sceneCtx.restore();
  }

  function drawFlakes(t) {
    ctx.fillStyle = snowColor;
    for (const flake of snowflakes) {
      const y = (flake.y - t * flake.speed % 10 + 10) % 10;
      const p = project({ x: flake.x + .22 * Math.sin(t * .35 + flake.phase), y, z: flake.z });
      const col = Math.floor(p.sx / cellWidth);
      const row = Math.floor(p.sy / cellHeight);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      if (p.inverse < depthBuffer[row * cols + col]) continue;
      ctx.globalAlpha = flake.alpha * clamp(y * 2, 0, 1) * clamp((10 - y) * 2, 0, 1);
      ctx.fillText(flake.glyph, p.sx, p.sy);
    }
    ctx.globalAlpha = 1;
  }

  function prepareView(yaw) {
    camera.yawCos = Math.cos(yaw);
    camera.yawSin = Math.sin(yaw);

    if (needsLayout) {
      // Fit the topper and the closest gift before painting the backdrop.
      const upperY = 9.35 + trunkExtension - subjectHeight;
      const top = upperY * camera.pitchCos * cameraDistance / (cameraDistance - upperY * camera.pitchSin - .32);
      const bottom = (subjectHeight * camera.pitchCos + giftRadius * camera.pitchSin) * cameraDistance
        / (cameraDistance - giftRadius * camera.pitchCos + subjectHeight * camera.pitchSin);
      scale = Math.min(width / 9.35, (height - 45) / (top + bottom));
      originY = height * .5 + (top - bottom) * scale * .5;
      paintBackdrop();
      needsLayout = false;
    }

    depthBuffer.fill(0);
    surfaceBuffer.fill(null);
    const eyeX = cameraDistance * camera.pitchCos * camera.yawSin;
    const eyeY = subjectHeight + cameraDistance * camera.pitchSin;
    const eyeZ = cameraDistance * camera.pitchCos * camera.yawCos;
    for (const p of vertices) {
      project(p, p);
      if (!p.normal) continue;
      const view = unit(eyeX - p.x, eyeY - p.y, eyeZ - p.z);
      p.reflection = .47 * specular(p.normal, view, keyLight, 13)
        + .24 * specular(p.normal, view, fillLight, 9);
    }
    for (const face of triangles) rasterize(face);

    const key = toCamera(keyLight);
    const fill = toCamera(fillLight);
    const up = toCamera([0, 1, 0]);
    for (const bauble of baubles) rasterizeBauble(bauble, key, fill, up);
    sceneLights = activeLights();
    paintScene();
  }

  function render(t) {
    ctx.globalAlpha = 1;
    ctx.drawImage(scene, 0, 0, width, height);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { lamp, glyph, phase, sx, sy } of sceneLights.values()) {
      const pulse = .94 + .06 * Math.cos(phase + t * 2.55);
      ctx.fillStyle = ink(lamp.color, (.51 + lamp.emission * .70) * pulse,
        lamp.emission >= 1 ? .25 * pulse : 0, 0, ivory);
      ctx.fillText(glyph, sx, sy);
    }
    ctx.globalAlpha = .84;
    ctx.fillStyle = '#ffdf96';
    for (const [dx, dy, glyph] of [[-.86, .21, '+'], [.88, .28, '*'], [.96, -.39, '+'], [-.99, -.37, '+'], [.32, .77, '+']]) {
      const p = project({ x: dx * camera.yawCos, y: starHeight + dy, z: -dx * camera.yawSin });
      ctx.fillText(glyph, p.sx, p.sy);
    }
    drawFlakes(t);
  }

  function frame(now) {
    animation = 0;
    if (!size) return;

    const animate = inView && !document.hidden && !reduced.matches;
    if (!needsLayout && !animate) {
      lastFrame = 0;
      return;
    }
    if (!needsLayout && lastFrame && now - lastFrame < frameInterval) {
      queueFrame();
      return;
    }

    if (animate && lastFrame) time += Math.min(now - lastFrame, 65) * .001;
    prepareView((homeYaw + time * orbitSpeed) % TAU);
    render(time);
    lastFrame = animate ? now : 0;
    if (animate) queueFrame();
  }

  function queueFrame() {
    if (!animation) animation = requestAnimationFrame(frame);
  }

  reduced.addEventListener('change', queueFrame);
  document.addEventListener('visibilitychange', queueFrame);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) queueFrame();
  }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
})();
