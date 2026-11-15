console.log("TRSTIN LIFE FUNGUJE");
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// TRSTIN LIFE – skutočná mapa Trstína
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  70, window.innerWidth / window.innerHeight, 0.5, 10000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Hmla a slnko
scene.fog = new THREE.Fog(0xcfe3f2, 250, 1600);

scene.add(new THREE.HemisphereLight(0xbfdfff, 0x6b7a4a, 1.1));

const sunlight = new THREE.DirectionalLight(0xfff1d6, 3.2);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -90;
sunlight.shadow.camera.right = 90;
sunlight.shadow.camera.top = 90;
sunlight.shadow.camera.bottom = -90;
sunlight.shadow.camera.near = 1;
sunlight.shadow.camera.far = 500;
sunlight.shadow.bias = -0.0005;
sunlight.shadow.normalBias = 0.05;
scene.add(sunlight);
scene.add(sunlight.target);
const sunOffset = new THREE.Vector3(120, 200, 80);

// Obloha (prechod farby od horizontu po zenit)
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(4000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2f7fd6) },
      horizonColor: { value: new THREE.Color(0xcfe3f2) }
    },
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying float vHeight;
      void main() {
        float t = pow(clamp(vHeight, 0.0, 1.0), 0.6);
        gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
      }`
  })
);
scene.add(sky);

// Stred obce Trstín
const centerLat = 48.52739;
const centerLon = 17.46416;

const mapGroup = new THREE.Group();
scene.add(mapGroup);

// Prevod GPS súradníc na 3D súradnice
function gpsToWorld(lat, lon) {
  const x = (lon - centerLon) * 111320 * Math.cos(centerLat * Math.PI / 180);
  const z = -(lat - centerLat) * 111320;
  return new THREE.Vector3(x, 0, z);
}

// Zem
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(3000, 3000),
  new THREE.MeshStandardMaterial({ color: 0x668b45 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.15;
ground.receiveShadow = true;
mapGroup.add(ground);

// =====================================================
// CESTY A CHODNÍKY
// =====================================================

function createAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#383838';
  ctx.fillRect(0, 0, 512, 512);

  let seed = 123456;

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 22000; i++) {
    const x = random() * 512;
    const y = random() * 512;
    const size = 0.4 + random() * 1.8;
    const shade = Math.floor(35 + random() * 55);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.15 + random() * 0.35})`;
    ctx.fillRect(x, y, size, size);
  }

  for (let i = 0; i < 90; i++) {
    const x = random() * 512;
    const y = random() * 512;
    const radius = 3 + random() * 18;
    const shade = random() > 0.5 ? 90 : 15;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.08)`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const asphaltTexture = createAsphaltTexture();

// ---------- textúry trávy, poľa a trávnych chumáčov ----------

function wrapDraw(size, x, y, r, fn) {
  // kreslí aj cez okraj textúry, aby nebol vidieť šev pri opakovaní
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      const px = x + dx, py = y + dy;
      if (px > -r && px < size + r && py > -r && py < size + r) fn(px, py);
    }
  }
}

function finishTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createGrassTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = makeRandom(777);

  ctx.fillStyle = '#5d8a3a';
  ctx.fillRect(0, 0, size, size);

  // veľké svetlejšie a tmavšie škvrny
  for (let i = 0; i < 90; i++) {
    const x = rand() * size, y = rand() * size, r = 30 + rand() * 70;
    const rgb = rand() > 0.5 ? '150,190,80' : '30,70,25';

    wrapDraw(size, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${rgb},0.22)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }

  // tisíce stebiel
  const palette = ['#3f6f2a', '#4f8233', '#6a9a3f', '#7cae4a', '#2f5a22', '#8fba55'];

  for (let i = 0; i < 14000; i++) {
    const x = rand() * size, y = rand() * size;
    const len = 3 + rand() * 7;
    const ang = (rand() - 0.5) * 1.2;

    ctx.strokeStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.35 + rand() * 0.4;
    ctx.lineWidth = 0.8 + rand() * 0.8;

    wrapDraw(size, x, y, 10, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.sin(ang) * len, py - Math.cos(ang) * len);
      ctx.stroke();
    });
  }

  ctx.globalAlpha = 1;
  return finishTexture(canvas);
}

// riadky na poli (svetlé a tmavé pásy), farba sa dodá podľa plodiny
function createFieldTexture() {
  const size = 256;
  const period = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = makeRandom(4242);

  ctx.fillStyle = '#d6d6d6';
  ctx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += period) {
    ctx.fillStyle = 'rgba(60,50,30,0.28)';
    ctx.fillRect(x + period / 2 - 2, 0, 4, size);
    ctx.fillStyle = 'rgba(255,255,240,0.18)';
    ctx.fillRect(x, 0, 3, size);
  }

  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.06})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }

  return finishTexture(canvas);
}

// priehľadná textúra chumáča trávy (steblá)
function createBladeTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = makeRandom(99);

  for (let i = 0; i < 9; i++) {
    const baseX = 14 + i * 12 + rand() * 6;
    const tipX = baseX + (rand() - 0.5) * 40;
    const tipY = 8 + rand() * 50;
    const w = 7 + rand() * 4;

    const g = ctx.createLinearGradient(0, size, 0, tipY);
    g.addColorStop(0, '#2f5a22');
    g.addColorStop(1, '#93be58');
    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.moveTo(baseX - w / 2, size);
    ctx.quadraticCurveTo(baseX, (size + tipY) / 2, tipX, tipY);
    ctx.quadraticCurveTo(baseX + w / 2, (size + tipY) / 2, baseX + w / 2, size);
    ctx.closePath();
    ctx.fill();
  }

  return finishTexture(canvas);
}

const grassTexture = createGrassTexture();

// Zem sa pokryje trávou (jedna dlaždica = 8 m)
const groundGrassTexture = grassTexture.clone();
groundGrassTexture.repeat.set(375, 375);
groundGrassTexture.needsUpdate = true;
ground.material.map = groundGrassTexture;
ground.material.color.set(0xffffff);
ground.material.needsUpdate = true;

// Plochy v krajine (ShapeGeometry má UV v metroch, preto 1/8)
const landGrassTexture = grassTexture;
landGrassTexture.repeat.set(0.125, 0.125);

const landFieldTexture = createFieldTexture();
landFieldTexture.repeat.set(0.125, 0.125);

const bladeTexture = createBladeTexture();


const asphaltMaterial = new THREE.MeshStandardMaterial({
  map: asphaltTexture,
  color: 0xffffff,
  roughness: 0.96,
  metalness: 0,
  side: THREE.DoubleSide
});

const gravelMaterial = new THREE.MeshStandardMaterial({
  color: 0x777365,
  roughness: 1,
  side: THREE.DoubleSide
});

const roadMarkingMaterial = new THREE.MeshStandardMaterial({
  color: 0xe8e5d6,
  roughness: 0.8,
  side: THREE.DoubleSide
});

const sidewalkMaterial = new THREE.MeshStandardMaterial({
  color: 0x999994,
  roughness: 0.95,
  side: THREE.DoubleSide
});

const curbMaterial = new THREE.MeshStandardMaterial({
  color: 0xb9b8ae,
  roughness: 0.9,
  side: THREE.DoubleSide
});

const shoulderMaterial = new THREE.MeshStandardMaterial({
  color: 0x77766c,
  roughness: 1,
  side: THREE.DoubleSide
});

// Odstránenie duplicitných bodov
function cleanRoadPoints(points) {
  const result = [];

  for (const p of points) {
    if (!result.length || result[result.length - 1].distanceTo(p) > 0.05) {
      result.push(p);
    }
  }

  return result;
}

// Výpočet okrajov cesty s miter spojmi
function getRoadEdges(points, width) {
  const left = [];
  const right = [];
  const half = width / 2;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    let n1 = new THREE.Vector2();
    let n2 = new THREE.Vector2();

    if (i > 0) {
      const d = new THREE.Vector2(
        p.x - points[i - 1].x,
        p.z - points[i - 1].z
      ).normalize();

      n1.set(-d.y, d.x);
    }

    if (i < points.length - 1) {
      const d = new THREE.Vector2(
        points[i + 1].x - p.x,
        points[i + 1].z - p.z
      ).normalize();

      n2.set(-d.y, d.x);
    }

    let normal;
    let miter = 1;

    if (i === 0) {
      normal = n2;
    } else if (i === points.length - 1) {
      normal = n1;
    } else {
      normal = n1.clone().add(n2);

      if (normal.lengthSq() < 0.0001) {
        normal.copy(n2);
      }

      normal.normalize();

      const dot = Math.abs(normal.dot(n2));
      miter = Math.min(2.5, 1 / Math.max(dot, 0.4));
    }

    const offset = half * miter;

    left.push(new THREE.Vector3(
      p.x + normal.x * offset,
      0,
      p.z + normal.y * offset
    ));

    right.push(new THREE.Vector3(
      p.x - normal.x * offset,
      0,
      p.z - normal.y * offset
    ));
  }

  return { left, right };
}

// Súvislá geometria cesty po celej trase
function createRoadSurface(points, width, material, y, uvScale = 4) {
  points = cleanRoadPoints(points);
  if (points.length < 2 || width <= 0) return;

  const edges = getRoadEdges(points, width);
  const vertices = [];
  const uvs = [];
  const indices = [];

  let distance = 0;

  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      distance += points[i].distanceTo(points[i - 1]);
    }

    const l = edges.left[i];
    const r = edges.right[i];

    vertices.push(
      l.x, y, l.z,
      r.x, y, r.z
    );

    uvs.push(
      0, distance / uvScale,
      1, distance / uvScale
    );

    if (i < points.length - 1) {
      const n = i * 2;

      indices.push(
        n, n + 1, n + 2,
        n + 1, n + 3, n + 2
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mapGroup.add(mesh);
}

// Posunutie bodov vedľa cesty
function offsetRoadPoints(points, offset) {
  const result = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    let dx;
    let dz;

    if (i === 0) {
      dx = points[1].x - p.x;
      dz = points[1].z - p.z;
    } else if (i === points.length - 1) {
      dx = p.x - points[i - 1].x;
      dz = p.z - points[i - 1].z;
    } else {
      dx = points[i + 1].x - points[i - 1].x;
      dz = points[i + 1].z - points[i - 1].z;
    }

    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;

    result.push(new THREE.Vector3(
      p.x + nx * offset,
      0,
      p.z + nz * offset
    ));
  }

  return result;
}

// Čiary a značenie sa zbierajú do jedného objektu (inak by ich boli tisíce)
const dashPositions = [];
const dashIndices = [];

function addDashQuad(p1, p2, width, y) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return;

  const nx = -dz / len * width / 2;
  const nz = dx / len * width / 2;
  const base = dashPositions.length / 3;

  dashPositions.push(
    p1.x + nx, y, p1.z + nz,
    p1.x - nx, y, p1.z - nz,
    p2.x + nx, y, p2.z + nz,
    p2.x - nx, y, p2.z - nz
  );

  dashIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
}

function flushDashes() {
  if (!dashIndices.length) return;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(dashPositions, 3));
  geometry.setIndex(dashIndices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, roadMarkingMaterial);
  mesh.receiveShadow = true;
  mapGroup.add(mesh);

  dashPositions.length = 0;
  dashIndices.length = 0;
}

// Dôležitosť cesty: hlavná cesta má prednosť pred vedľajšou
const ROAD_RANK = {
  motorway: 6, trunk: 6, primary: 5, secondary: 4, tertiary: 3,
  unclassified: 2, residential: 2, living_street: 2, service: 1, track: 1
};

function roadRank(highway) {
  return ROAD_RANK[highway] || 0;
}

const markingJobs = [];

// Čiara pozdĺž cesty (plná alebo prerušovaná). Tam, kde cez cestu ide iná cesta,
// sa čiara preruší, ako v skutočnosti.
function createMarkingLine(points, offset, lineWidth, dash, gap, wayId, minOtherRank) {
  points = cleanRoadPoints(points);
  if (points.length < 2) return;

  const solid = gap <= 0;
  let drawing = true;
  let remaining = solid ? Infinity : dash;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) continue;

    const ux = dx / length;
    const uz = dz / length;
    const nx = -uz;
    const nz = ux;

    let travelled = 0;

    while (travelled < length) {
      const step = Math.min(remaining, length - travelled, 1.0);

      if (drawing && step > 0.02) {
        const s = travelled;
        const e = travelled + step;
        const m = (s + e) / 2;

        const mx = a.x + ux * m + nx * offset;
        const mz = a.z + uz * m + nz * offset;

        if (!insideOtherRoad(mx, mz, wayId, minOtherRank)) {
          addDashQuad(
            { x: a.x + ux * s + nx * offset, z: a.z + uz * s + nz * offset },
            { x: a.x + ux * e + nx * offset, z: a.z + uz * e + nz * offset },
            lineWidth,
            0.078
          );
        }
      }

      travelled += step;
      remaining -= step;

      if (!solid && remaining <= 0.001) {
        drawing = !drawing;
        remaining = drawing ? dash : gap;
      }
    }
  }
}

// Priechod pre chodcov ("zebra") v mieste uzla highway=crossing
function buildCrosswalk(pos) {
  const seg = nearestRoadSegment(pos.x, pos.z, 6, 2);
  if (!seg) return;

  const dx = seg.bx - seg.ax;
  const dz = seg.bz - seg.az;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const nx = -uz;
  const nz = ux;

  // uzol sa priloží na os cesty
  const t = (pos.x - seg.ax) * ux + (pos.z - seg.az) * uz;
  const px = seg.ax + ux * t;
  const pz = seg.az + uz * t;

  for (let k = -seg.hw + 0.55; k <= seg.hw - 0.55; k += 1.0) {
    const cx = px + nx * k;
    const cz = pz + nz * k;

    addDashQuad(
      { x: cx - ux * 2.0, z: cz - uz * 2.0 },
      { x: cx + ux * 2.0, z: cz + uz * 2.0 },
      0.5,
      0.079
    );
  }
}

// Zavolá sa raz, keď sú načítané všetky cesty (až vtedy sa vie, kde sa križujú)
function buildRoadMarkings(crossings) {
  markingJobs.forEach(job => {
    const { points, width, tags, id } = job;
    const rank = roadRank(tags.highway);
    if (rank < 3) return;   // obytné ulice a vedľajšie cesty čiary nemajú

    const lanes = Number.parseInt(tags.lanes, 10) || (width >= 5.5 ? 2 : 1);
    const edgeOffset = width / 2 - 0.3;

    // hlavné cesty: plné okrajové čiary
    if (rank >= 4) {
      createMarkingLine(points, edgeOffset, 0.12, 0, 0, id, 1);
      createMarkingLine(points, -edgeOffset, 0.12, 0, 0, id, 1);
    }

    // prerušovaná stredová čiara (len ak sú aspoň 2 pruhy)
    if (lanes >= 2) {
      createMarkingLine(points, 0, 0.12, 3, 6, id, rank);
    }
  });

  crossings.forEach(buildCrosswalk);
  markingJobs.length = 0;
}

// Chodník a obrubník
function createSidewalk(points, roadWidth, side) {
  const curbPoints = offsetRoadPoints(points, side * (roadWidth / 2 + 0.13));
  const sidewalkPoints = offsetRoadPoints(points, side * (roadWidth / 2 + 1.02));
  const outerPoints = offsetRoadPoints(points, side * (roadWidth / 2 + 1.9));

  createRoadSurface(curbPoints, 0.24, curbMaterial, 0.13, 4);
  createRoadSurface(sidewalkPoints, 1.65, sidewalkMaterial, 0.105, 4);
  createRoadSurface(outerPoints, 0.08, curbMaterial, 0.075, 4);
}

const pavingMaterial = new THREE.MeshStandardMaterial({
  color: 0x8e8a80,
  roughness: 0.95,
  side: THREE.DoubleSide
});

// Vytvorenie celej cesty
function createRoad(points, width, tags = {}, wayId = '') {
  points = cleanRoadPoints(points);
  if (points.length < 2) return;

  const highway = tags.highway || 'residential';

  // stromy a kríky nesmú rásť na ceste, čiary sa prerušujú na križovatkách
  for (let i = 0; i < points.length - 1; i++) {
    registerRoadSegment(points[i], points[i + 1], width / 2, wayId, roadRank(highway));
  }

  const surface = (tags.surface || '').toLowerCase();

  const isFootway = ['footway', 'pedestrian', 'steps'].includes(highway);

  // poľné cesty a chodníčky bez uvedeného povrchu sú štrkové, nie asfaltové
  const isUnpaved = [
    'gravel', 'ground', 'dirt', 'earth',
    'grass', 'sand', 'unpaved', 'compacted', 'fine_gravel'
  ].includes(surface) || (!surface && ['track', 'path', 'bridleway'].includes(highway));

  const isPaving = ['paving_stones', 'sett', 'cobblestone', 'concrete:plates'].includes(surface);

  let roadMaterial = asphaltMaterial;
  if (isUnpaved) roadMaterial = gravelMaterial;
  else if (isFootway) roadMaterial = sidewalkMaterial;
  else if (isPaving) roadMaterial = pavingMaterial;

  createRoadSurface(points, width, roadMaterial, 0.055, 4);

  const isAsphalt = roadMaterial === asphaltMaterial;

  if (isAsphalt && width >= 7) {
    createRoadSurface(
      offsetRoadPoints(points, width / 2 - 0.08),
      0.16, shoulderMaterial, 0.047, 4
    );

    createRoadSurface(
      offsetRoadPoints(points, -(width / 2 - 0.08)),
      0.16, shoulderMaterial, 0.047, 4
    );
  }

  if (isAsphalt) {
    markingJobs.push({ points, width, tags, id: wayId });
  }

  const sidewalk = (tags.sidewalk || '').toLowerCase();

  if (sidewalk === 'both' || sidewalk === 'yes') {
    createSidewalk(points, width, 1);
    createSidewalk(points, width, -1);
  } else if (sidewalk === 'left') {
    createSidewalk(points, width, 1);
  } else if (sidewalk === 'right') {
    createSidewalk(points, width, -1);
  }
}

// ===== BUDOVY START =====
// Všetky domy sa zlučujú do pár veľkých objektov (steny, strechy) a okná/dvere
// sa kreslia hromadne (instancovanie), aby hra zostala plynulá.
const wallData = { pos: [], col: [] };
const roofData = { pos: [], col: [] };
const windowMatrices = [];
const frameMatrices = [];
const doorMatrices = [];

const houseWalls = [
  0xe9dfc8, 0xf1e7d0, 0xe4d3b0, 0xd9c8a6, 0xeadad0, 0xdfe6d8,
  0xe8d3c8, 0xcfd6cf, 0xf0ede4, 0xddc9a3, 0xe7caa8
].map(c => new THREE.Color(c));
const houseRoofs = [
  0xa8482f, 0xb5533a, 0x8f3f2a, 0x7a4632, 0x5d4a45, 0x4c4c52
].map(c => new THREE.Color(c));

function hashSeed(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Náhodné čísla podľa ID budovy – dom vyzerá pri každom načítaní rovnako
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pushTri(data, color, a, b, c) {
  data.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < 3; i++) data.col.push(color.r, color.g, color.b);
}

function pushQuad(data, color, a, b, c, d) {
  pushTri(data, color, a, b, c);
  pushTri(data, color, a, c, d);
}

function addBox(data, color, cx, cy, cz, sx, sy, sz, rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const P = (lx, ly, lz) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
  const v = [
    P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz),
    P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(-hx, hy, hz)
  ];
  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    .forEach(f => pushQuad(data, color, v[f[0]], v[f[1]], v[f[2]], v[f[3]]));
}

function addPyramid(data, color, cx, baseY, cz, hx, hz, h, rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const P = (lx, lz) => [cx + lx * c + lz * s, baseY, cz - lx * s + lz * c];
  const apex = [cx, baseY + h, cz];
  const b = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
  for (let i = 0; i < 4; i++) pushTri(data, color, b[i], b[(i + 1) % 4], apex);
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function pushInstance(list, x, y, z, angle, sx, sy, sz) {
  _e.set(0, angle, 0);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  list.push(new THREE.Matrix4().compose(_p, _q, _s));
}

// Najmenší obdĺžnik, ktorý obalí pôdorys domu (určuje smer strechy)
function minAreaRect(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const ux = dx / len, uz = dz / len, vx = -uz, vz = ux;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of pts) {
      const pu = p.x * ux + p.z * uz;
      const pv = p.x * vx + p.z * vz;
      if (pu < minU) minU = pu;
      if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv;
      if (pv > maxV) maxV = pv;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { area, ux, uz, vx, vz, minU, maxU, minV, maxV };
  }
  if (!best) return null;
  let hu = (best.maxU - best.minU) / 2;
  let hv = (best.maxV - best.minV) / 2;
  const cu = (best.maxU + best.minU) / 2;
  const cv = (best.maxV + best.minV) / 2;
  let ux = best.ux, uz = best.uz, vx = best.vx, vz = best.vz;
  const cx = cu * ux + cv * vx;
  const cz = cu * uz + cv * vz;
  if (hv > hu) {
    [hu, hv] = [hv, hu];
    [ux, uz, vx, vz] = [vx, vz, ux, uz];
  }
  return { cx, cz, ux, uz, vx, vz, hu, hv };
}

function polygonArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

// Sedlová alebo valbová strecha nad obdĺžnikom
function addRidgeRoof(obb, H, rh, roofColor, wallColor, hip) {
  const { cx, cz, ux, uz, vx, vz, hu, hv } = obb;
  const hu2 = hu + 0.25, hv2 = hv + 0.35;
  const corner = (su, sv) => [
    cx + ux * hu2 * su + vx * hv2 * sv, H,
    cz + uz * hu2 * su + vz * hv2 * sv
  ];
  const A = corner(-1, -1), B = corner(1, -1), C = corner(1, 1), D = corner(-1, 1);
  const rl = hip ? Math.max(hu2 - hv2, 0.3) : hu2;
  const R1 = [cx - ux * rl, H + rh, cz - uz * rl];
  const R2 = [cx + ux * rl, H + rh, cz + uz * rl];

  pushQuad(roofData, roofColor, A, B, R2, R1);
  pushQuad(roofData, roofColor, D, C, R2, R1);
  if (hip) {
    pushTri(roofData, roofColor, A, D, R1);
    pushTri(roofData, roofColor, B, C, R2);
  } else {
    pushTri(wallData, wallColor, A, D, R1);
    pushTri(wallData, wallColor, B, C, R2);
  }
}

// Strecha zo stredu pôdorysu (pre nepravidelné tvary)
function addFanRoof(coords, H, rh, color) {
  let cx = 0, cz = 0;
  coords.forEach(p => { cx += p.x; cz += p.z; });
  cx /= coords.length;
  cz /= coords.length;
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i], b = coords[(i + 1) % coords.length];
    pushTri(roofData, color, [a.x, H, a.z], [b.x, H, b.z], [cx, H + rh, cz]);
  }
}

function addWalls(coords, y0, H, color) {
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i], b = coords[(i + 1) % coords.length];
    pushQuad(wallData, color,
      [a.x, y0, a.z], [b.x, y0, b.z], [b.x, H, b.z], [a.x, H, a.z]);
  }
}

// Okná a dvere na všetkých stenách
function addOpenings(coords, o) {
  let longest = 0, longestLen = 0;
  coords.forEach((a, i) => {
    const b = coords[(i + 1) % coords.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L > longestLen) { longestLen = L; longest = i; }
  });

  for (let i = 0; i < coords.length; i++) {
    const a = coords[i], b = coords[(i + 1) % coords.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz);
    if (L < 2.8) continue;

    const angle = Math.atan2(-dz, dx);
    const n = Math.max(1, Math.floor(L / o.spacing));

    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = a.x + dx * t, z = a.z + dz * t;
      const isDoor = o.door && i === longest && k === Math.floor(n / 2);

      for (let f = 0; f < o.floors; f++) {
        if (isDoor && f === 0) {
          pushInstance(doorMatrices, x, 0.05 + o.doorH / 2, z, angle, o.doorW, o.doorH, 0.16);
          continue;
        }
        const y = 0.05 + f * o.floorH + o.winY;
        pushInstance(windowMatrices, x, y, z, angle, o.winW, o.winH, 0.18);
        pushInstance(frameMatrices, x, y, z, angle, o.winW + 0.22, o.winH + 0.22, 0.1);
      }
    }
  }
}

function createBuilding(coords0, levelsTag, tags, id) {
  const coords = coords0.slice();
  if (coords.length > 1 && coords[0] === coords[coords.length - 1]) coords.pop();
  if (coords.length < 3) return;

  registerFootprint(coords);

  const rand = makeRandom(hashSeed(id));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const clamp = THREE.MathUtils.clamp;

  const obb = minAreaRect(coords);
  if (!obb) return;
  const area = polygonArea(coords);
  const ratio = area / Math.max(4 * obb.hu * obb.hv, 0.01);
  const y0 = 0.05;

  const isChurch = tags.building === 'church' || tags.building === 'chapel' ||
    tags.amenity === 'place_of_worship';
  const isManor = !isChurch &&
    (tags.historic === 'manor' || /kaštieľ/i.test(tags.name || ''));

  // ---------- KOSTOL / KAPLNKA ----------
  if (isChurch) {
    const chapel = tags.building === 'chapel' || area < 120;
    const wallH = chapel ? 5.5 : 9;
    const H = y0 + wallH;
    const wallColor = new THREE.Color(0xf2eee3);
    const roofColor = new THREE.Color(0x5b6068);
    const spireColor = new THREE.Color(0x6f8f86);
    const crossColor = new THREE.Color(0x222222);
    const { cx, cz, ux, uz, vx, vz, hu, hv } = obb;

    addWalls(coords, y0, H, wallColor);
    if (ratio >= 0.72) {
      addRidgeRoof(obb, H, clamp(hv * 0.7, 1.5, 5), roofColor, wallColor, false);
    } else {
      addFanRoof(coords, H, clamp(hv * 0.6, 1.5, 4), roofColor);
    }

    // Veža so špicatou strechou a krížom
    const ts = clamp(hv * 1.3, 2.6, 5.2);
    const towerH = chapel ? wallH + 3.5 : wallH + 9;
    const spireH = chapel ? 3.5 : 9;
    const tcx = cx + ux * (hu - ts / 2 - 0.1);
    const tcz = cz + uz * (hu - ts / 2 - 0.1);
    const ang = Math.atan2(-uz, ux);

    addBox(wallData, wallColor, tcx, y0 + towerH / 2, tcz, ts, towerH, ts, ang);
    addPyramid(roofData, spireColor, tcx, y0 + towerH, tcz, ts / 2 + 0.25, ts / 2 + 0.25, spireH, ang);
    addBox(roofData, crossColor, tcx, y0 + towerH + spireH + 0.6, tcz, 0.12, 1.2, 0.12, 0);
    addBox(roofData, crossColor, tcx, y0 + towerH + spireH + 0.85, tcz, 0.7, 0.12, 0.12, ang);

    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([su, sv]) => {
      const px = tcx + ux * su * ts / 2 + vx * sv * ts / 2;
      const pz = tcz + uz * su * ts / 2 + vz * sv * ts / 2;
      const dir = su !== 0 ? [vx, vz] : [ux, uz];
      pushInstance(windowMatrices, px, y0 + towerH - 2.5, pz,
        Math.atan2(-dir[1], dir[0]), 0.9, 2.0, 0.18);
    });

    addOpenings(coords, {
      floors: 1, floorH: wallH, winY: wallH * 0.5, winW: 0.9, winH: chapel ? 1.8 : 2.4,
      spacing: 5, door: true, doorW: 1.6, doorH: 3.0
    });
    return;
  }

  // ---------- KAŠTIEĽ ----------
  if (isManor) {
    const wallH = 8.6;
    const H = y0 + wallH;
    const wallColor = new THREE.Color(0xe8d9a8);
    const roofColor = new THREE.Color(0x7a3524);
    const turretRoof = new THREE.Color(0x3f3a38);
    const { cx, cz, ux, uz, vx, vz, hu, hv } = obb;

    addWalls(coords, y0, H, wallColor);
    if (ratio >= 0.72) {
      addRidgeRoof(obb, H, clamp(hv * 0.5, 2, 5), roofColor, wallColor, true);
    } else {
      addFanRoof(coords, H, clamp(hv * 0.5, 2, 5), roofColor);
    }

    // Štyri nárožné vežičky na najvzdialenejších rohoch
    const used = new Set();
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([su, sv]) => {
      let bestI = -1, bestScore = -Infinity;
      coords.forEach((p, i) => {
        const score = ((p.x - cx) * ux + (p.z - cz) * uz) * su +
                      ((p.x - cx) * vx + (p.z - cz) * vz) * sv;
        if (score > bestScore) { bestScore = score; bestI = i; }
      });
      if (bestI < 0 || used.has(bestI)) return;
      used.add(bestI);

      const p = coords[bestI];
      let dx = cx - p.x, dz = cz - p.z;
      const dl = Math.hypot(dx, dz) || 1;
      const tx = p.x + dx / dl, tz = p.z + dz / dl;
      const ang = Math.atan2(-uz, ux);
      const th = wallH + 3;

      addBox(wallData, wallColor, tx, y0 + th / 2, tz, 3.4, th, 3.4, ang);
      addPyramid(roofData, turretRoof, tx, y0 + th, tz, 1.95, 1.95, 3.5, ang);
    });

    addOpenings(coords, {
      floors: 2, floorH: 4.3, winY: 2.3, winW: 1.1, winH: 2.0,
      spacing: 3.6, door: true, doorW: 1.8, doorH: 3.0
    });
    return;
  }

  // ---------- BEŽNÉ DOMY ----------
  const isRuins = tags.building === 'ruins';
  const isIndustrial = tags.building === 'industrial';
  const isApartments = tags.building === 'apartments';

  let levels = Number(levelsTag);
  if (!Number.isFinite(levels) || levels < 1) {
    if (isApartments) levels = 4;
    else if (isIndustrial || area < 35) levels = 1;
    else levels = rand() < 0.65 ? 2 : 1;
  }

  const floorH = isIndustrial ? 5.5 : 3;
  const wallH = isRuins ? 2.5 : levels * floorH;
  const H = y0 + wallH;
  const wallColor = isIndustrial ? new THREE.Color(0xb9bbb8) : pick(houseWalls);
  const roofColor = isIndustrial ? new THREE.Color(0x6d7075) : pick(houseRoofs);

  addWalls(coords, y0, H, wallColor);
  if (isRuins) return;

  const flat = isIndustrial || isApartments;

  if (flat) {
    addFanRoof(coords, H, 0.2, roofColor);
  } else if (ratio >= 0.72) {
    const rh = clamp(obb.hv * 0.62, 1.2, 4.5);
    const hip = rand() < 0.25;
    addRidgeRoof(obb, H, rh, roofColor, wallColor, hip);

    if (area > 45 && rand() < 0.6) {
      const along = (rand() - 0.5) * obb.hu * 1.2;
      const chx = obb.cx + obb.ux * along;
      const chz = obb.cz + obb.uz * along;
      addBox(wallData, new THREE.Color(0x8a4b3a), chx, H + (rh + 0.7) / 2 - 0.2, chz,
        0.5, rh + 0.7, 0.5, 0);
    }
  } else {
    addFanRoof(coords, H, clamp(Math.min(obb.hv, 6) * 0.5, 1.2, 3.2), roofColor);
  }

  if (area >= 25) {
    addOpenings(coords, {
      floors: levels, floorH, winY: isIndustrial ? 3 : 1.6,
      winW: isIndustrial ? 1.6 : 1.0, winH: isIndustrial ? 1.2 : 1.3,
      spacing: isIndustrial ? 6 : 3.4,
      door: !isIndustrial, doorW: 1.0, doorH: 2.1
    });
  }
}

function makeMergedMesh(data, roughness) {
  if (!data.pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness, side: THREE.DoubleSide
  }));
  m.castShadow = true;
  m.receiveShadow = true;
  mapGroup.add(m);
}

function makeInstanced(list, material) {
  if (!list.length) return;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, list.length);
  list.forEach((mat, i) => mesh.setMatrixAt(i, mat));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mapGroup.add(mesh);
}

// Zavolá sa raz po načítaní všetkých budov
function finishBuildings() {
  makeMergedMesh(wallData, 0.92);
  makeMergedMesh(roofData, 0.85);
  makeInstanced(windowMatrices, new THREE.MeshStandardMaterial({
    color: 0x6f9fbf, roughness: 0.15, metalness: 0.4
  }));
  makeInstanced(frameMatrices, new THREE.MeshStandardMaterial({
    color: 0xf4f4f0, roughness: 0.7
  }));
  makeInstanced(doorMatrices, new THREE.MeshStandardMaterial({
    color: 0x4a2f1f, roughness: 0.85
  }));
}
// ===== BUDOVY END =====


// ===== KOLIZIE START =====
// Pôdorysy budov sa uložia do mriežky (po 25 m), aby sa kontrolovali len domy v okolí auta.
const COLLISION_CELL = 25;
const footprints = [];
const footprintGrid = new Map();
const circleGrid = new Map();

// Kruhové prekážky (kmene stromov, stĺpiky plotov)
function registerCircleCollider(x, z, r) {
  const key = Math.floor(x / COLLISION_CELL) + ',' + Math.floor(z / COLLISION_CELL);
  if (!circleGrid.has(key)) circleGrid.set(key, []);
  circleGrid.get(key).push({ x, z, r });
}

function registerFootprint(coords) {
  const pts = coords.map(p => ({ x: p.x, z: p.z }));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  pts.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });
  const fp = { pts, minX, maxX, minZ, maxZ };
  footprints.push(fp);

  const x0 = Math.floor(minX / COLLISION_CELL), x1 = Math.floor(maxX / COLLISION_CELL);
  const z0 = Math.floor(minZ / COLLISION_CELL), z1 = Math.floor(maxZ / COLLISION_CELL);
  for (let gx = x0; gx <= x1; gx++) {
    for (let gz = z0; gz <= z1; gz++) {
      const key = gx + ',' + gz;
      if (!footprintGrid.has(key)) footprintGrid.set(key, []);
      footprintGrid.get(key).push(fp);
    }
  }
}

function pointInPolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) &&
        x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

// Vytlačí kruh (x, z, r) von z domu. Vráti posun alebo null.
function pushCircleOutOfFootprint(x, z, r, fp) {
  if (x + r < fp.minX || x - r > fp.maxX || z + r < fp.minZ || z - r > fp.maxZ) return null;

  const pts = fp.pts;
  let bestDist = Infinity, bestX = 0, bestZ = 0;

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + dx * t, qz = a.z + dz * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < bestDist) { bestDist = d; bestX = qx; bestZ = qz; }
  }

  const inside = pointInPolygon(x, z, pts);

  if (inside) {
    // stred je vnútri domu: von k najbližšej stene
    const d = bestDist || 0.001;
    const nx = (bestX - x) / d, nz = (bestZ - z) / d;
    return { x: nx * (d + r), z: nz * (d + r) };
  }
  if (bestDist < r) {
    const d = bestDist || 0.001;
    const nx = (x - bestX) / d, nz = (z - bestZ) / d;
    return { x: nx * (r - d), z: nz * (r - d) };
  }
  return null;
}

// Auto = tri kruhy za sebou (predok, stred, zadok). Vráti true, ak sa s niečím zrazilo.
const CAR_CIRCLE_RADIUS = 1.1;
const CAR_CIRCLE_OFFSETS = [-1.3, 0, 1.3];

function resolveCollisions(car) {
  let hit = false;

  for (let pass = 0; pass < 4; pass++) {
    const fx = -Math.sin(car.rotation.y);
    const fz = -Math.cos(car.rotation.y);

    for (const off of CAR_CIRCLE_OFFSETS) {
      const cx = car.position.x + fx * off;
      const cz = car.position.z + fz * off;
      const gx = Math.floor(cx / COLLISION_CELL);
      const gz = Math.floor(cz / COLLISION_CELL);

      for (let ix = gx - 1; ix <= gx + 1; ix++) {
        for (let iz = gz - 1; iz <= gz + 1; iz++) {
          const key = ix + ',' + iz;
          const list = footprintGrid.get(key);
          if (list) {
            for (const fp of list) {
              const push = pushCircleOutOfFootprint(
                car.position.x + fx * off, car.position.z + fz * off,
                CAR_CIRCLE_RADIUS, fp
              );
              if (push) {
                car.position.x += push.x;
                car.position.z += push.z;
                hit = true;
              }
            }
          }
          const circles = circleGrid.get(key);
          if (circles) {
            for (const c of circles) {
              const dx = car.position.x + fx * off - c.x;
              const dz = car.position.z + fz * off - c.z;
              const d = Math.hypot(dx, dz);
              const minD = CAR_CIRCLE_RADIUS + c.r;
              if (d < minD) {
                const dd = d || 0.001;
                car.position.x += dx / dd * (minD - d);
                car.position.z += dz / dd * (minD - d);
                hit = true;
              }
            }
          }
        }
      }
    }
  }
  return hit;
}
// ===== KOLIZIE END =====


// ===== PRÍRODA START =====
// Cesty sa ukladajú do mriežky, aby stromy nerástli priamo na ceste.
const ROAD_CELL = 25;
const roadGrid = new Map();

function registerRoadSegment(a, b, hw, wayId = '', rank = 0) {
  const seg = { ax: a.x, az: a.z, bx: b.x, bz: b.z, hw, way: wayId, rank };
  const x0 = Math.floor(Math.min(a.x, b.x) / ROAD_CELL), x1 = Math.floor(Math.max(a.x, b.x) / ROAD_CELL);
  const z0 = Math.floor(Math.min(a.z, b.z) / ROAD_CELL), z1 = Math.floor(Math.max(a.z, b.z) / ROAD_CELL);
  for (let gx = x0; gx <= x1; gx++) {
    for (let gz = z0; gz <= z1; gz++) {
      const key = gx + ',' + gz;
      if (!roadGrid.has(key)) roadGrid.set(key, []);
      roadGrid.get(key).push(seg);
    }
  }
}

function distanceToSegment(x, z, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - s.ax) * dx + (z - s.az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
}

// Je bod na vozovke INEJ cesty (rovnakej alebo vyššej dôležitosti)?
function insideOtherRoad(x, z, wayId, minRank) {
  const gx = Math.floor(x / ROAD_CELL), gz = Math.floor(z / ROAD_CELL);
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const list = roadGrid.get(ix + ',' + iz);
      if (!list) continue;
      for (const s of list) {
        if (s.way === wayId || s.rank < minRank) continue;
        if (distanceToSegment(x, z, s) < s.hw) return true;
      }
    }
  }
  return false;
}

// Najbližší úsek cesty (aspoň danej dôležitosti) do vzdialenosti maxDist
function nearestRoadSegment(x, z, maxDist, minRank) {
  const gx = Math.floor(x / ROAD_CELL), gz = Math.floor(z / ROAD_CELL);
  let best = null, bestD = maxDist;
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const list = roadGrid.get(ix + ',' + iz);
      if (!list) continue;
      for (const s of list) {
        if (s.rank < minRank) continue;
        const d = distanceToSegment(x, z, s);
        if (d < bestD) { bestD = d; best = s; }
      }
    }
  }
  return best;
}

function nearRoad(x, z, margin) {
  const gx = Math.floor(x / ROAD_CELL), gz = Math.floor(z / ROAD_CELL);
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const list = roadGrid.get(ix + ',' + iz);
      if (!list) continue;
      for (const s of list) {
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const len2 = dx * dx + dz * dz;
        let t = len2 > 0 ? ((x - s.ax) * dx + (z - s.az) * dz) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) < s.hw + margin) return true;
      }
    }
  }
  return false;
}

function nearBuilding(x, z, margin) {
  const gx = Math.floor(x / COLLISION_CELL), gz = Math.floor(z / COLLISION_CELL);
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const list = footprintGrid.get(ix + ',' + iz);
      if (!list) continue;
      for (const fp of list) {
        if (pushCircleOutOfFootprint(x, z, margin, fp)) return true;
      }
    }
  }
  return false;
}

// Rovný pás (potok, voda) položený na zem
function createStrip(points, width, color, y) {
  const vertices = [], indices = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const nx = -dz / len, nz = dx / len, h = width / 2;
    const base = vertices.length / 3;
    vertices.push(
      a.x + nx * h, y, a.z + nz * h, a.x - nx * h, y, a.z - nz * h,
      b.x + nx * h, y, b.z + nz * h, b.x - nx * h, y, b.z - nz * h
    );
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  if (!indices.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  }));
  mesh.receiveShadow = true;
  mapGroup.add(mesh);
}

function landKind(tags) {
  if (tags.natural === 'water') return 'water';
  if (tags.natural === 'wood' || tags.landuse === 'forest') return 'forest';
  if (tags.natural === 'scrub') return 'scrub';
  if (tags.landuse === 'farmland') return 'farmland';
  if (tags.landuse === 'meadow' || tags.landuse === 'grass') return 'meadow';
  if (tags.leisure === 'park') return 'park';
  if (tags.landuse === 'cemetery') return 'cemetery';
  if (tags.landuse === 'residential') return 'residential';
  if (tags.landuse === 'farmyard') return 'farmyard';
  if (tags.leisure === 'pitch') return 'pitch';
  if (['industrial', 'commercial', 'retail'].includes(tags.landuse)) return 'industrial';
  if (tags.landuse === 'railway') return 'railway';
  return null;
}

// Poskladá viac kúskov hranice (z multipolygónu) do uzavretých obrysov
function chainWays(list) {
  const rings = [];
  const pool = list.filter(w => w && w.length > 1).map(w => w.slice());
  while (pool.length) {
    let ring = pool.shift();
    let extended = true;
    while (extended && ring[0] !== ring[ring.length - 1]) {
      extended = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        const end = ring[ring.length - 1], start = ring[0];
        if (w[0] === end) ring = ring.concat(w.slice(1));
        else if (w[w.length - 1] === end) ring = ring.concat(w.slice(0, -1).reverse());
        else if (w[w.length - 1] === start) ring = w.slice(0, -1).concat(ring);
        else if (w[0] === start) ring = w.slice(1).reverse().concat(ring);
        else continue;
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

// Farby a výšky plôch. Plochy ležia tesne nad zemou, cesty nad nimi.
const LAND_STYLES = {
  farmland:    { y: -0.08, tex: 'field', colors: [0xd8c070, 0xb0c070, 0x9a7a50, 0xcdb868] },
  meadow:      { y: -0.07, tex: 'grass', colors: [0xffffff, 0xf2ffd8, 0xe0f0c0], tufts: true },
  residential: { y: -0.06, tex: 'grass', colors: [0xeaf5d4, 0xdff0c8], trees: { spacing: 28, skip: 0.5, conifer: 0.1 } },
  farmyard:    { y: -0.05, colors: [0x9a8a63] },
  forest:      { y: -0.05, tex: 'grass', colors: [0x7f9f6f], trees: { spacing: 9, conifer: 0.5 } },
  scrub:       { y: -0.04, tex: 'grass', colors: [0xb0c890], bushes: { spacing: 12 } },
  park:        { y: -0.03, tex: 'grass', colors: [0xf5ffe0], trees: { spacing: 13, conifer: 0.1 }, tufts: true },
  cemetery:    { y: -0.03, tex: 'grass', colors: [0xd8e4c0], trees: { spacing: 16, conifer: 0.5 }, tufts: true },
  industrial:  { y: -0.04, colors: [0x9c9c94] },
  railway:     { y: -0.04, colors: [0x7d7a70] },
  pitch:       { y: -0.02, tex: 'grass', colors: [0xe0ffd0] },
  water:       { y: -0.01, colors: [0x3f7fb5], water: true }
};

function addLandMesh(ring, style, rand) {
  const pts = ring.slice();
  if (pts[0] === pts[pts.length - 1]) pts.pop();
  if (pts.length < 3) return;
  const shape = new THREE.Shape();
  pts.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)));
  const geo = new THREE.ShapeGeometry(shape);

  // riadky na poli ideú rovnobežne s dlhšou stranou poľa
  if (style.tex === 'field') {
    const r = minAreaRect(pts);
    if (r) {
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        uv.setXY(i, x * r.ux - y * r.uz, x * r.uz + y * r.ux);
      }
    }
  }

  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: style.colors[Math.floor(rand() * style.colors.length)],
    map: style.tex === 'grass' ? landGrassTexture : (style.tex === 'field' ? landFieldTexture : null),
    roughness: style.water ? 0.2 : 1,
    metalness: style.water ? 0.1 : 0,
    side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = style.y;
  mesh.receiveShadow = true;
  mapGroup.add(mesh);
}

// Chumáče trávy: lúky, park, cintorín a záhrady okolo domov
function buildGrassTufts(areas, rand) {
  const SPACING = 1.7;      // menšie číslo = hustejšia tráva
  const MAX_TUFTS = 90000;
  const list = [];
  const colors = [];

  function add(x, z) {
    if (list.length >= MAX_TUFTS) return;
    if (nearRoad(x, z, 1.5) || nearBuilding(x, z, 1.0)) return;
    const s = 0.7 + rand() * 0.7;
    pushInstance(list, x, -0.02, z, rand() * Math.PI * 2, s * 1.1, s * 0.8, s * 1.1);
    colors.push(new THREE.Color().setScalar(0.8 + rand() * 0.4));
  }

  areas.forEach(a => {
    const style = LAND_STYLES[a.kind];
    if (!style || !style.tufts) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    a.ring.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    for (let x = minX; x < maxX; x += SPACING) {
      for (let z = minZ; z < maxZ; z += SPACING) {
        const px = x + (rand() - 0.5) * SPACING;
        const pz = z + (rand() - 0.5) * SPACING;
        if (pointInPolygon(px, pz, a.ring)) add(px, pz);
      }
    }
  });

  // trávnik v záhradách okolo domov
  footprints.forEach(fp => {
    let cx = 0, cz = 0;
    fp.pts.forEach(p => { cx += p.x; cz += p.z; });
    cx /= fp.pts.length;
    cz /= fp.pts.length;

    for (let k = 0; k < 18; k++) {
      const i = Math.floor(rand() * fp.pts.length);
      const p = fp.pts[i], q = fp.pts[(i + 1) % fp.pts.length];
      const t = rand();
      const ex = p.x + (q.x - p.x) * t, ez = p.z + (q.z - p.z) * t;
      let dx = ex - cx, dz = ez - cz;
      const dl = Math.hypot(dx, dz) || 1;
      const dist = 1.5 + rand() * 5;
      add(ex + dx / dl * dist + (rand() - 0.5) * 2, ez + dz / dl * dist + (rand() - 0.5) * 2);
    }
  });

  if (!list.length) return 0;

  // dve skrížené plochy so steblami, normály smerujú hore (mäkké osvetlenie)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0,
    0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1
  ], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);

  const mesh = new THREE.InstancedMesh(
    g,
    new THREE.MeshStandardMaterial({
      map: bladeTexture, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1
    }),
    list.length
  );

  list.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, colors[i]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mapGroup.add(mesh);

  return list.length;
}

// Ploty, múry, živé ploty
const fenceData = { pos: [], col: [] };

function buildFence(f) {
  const fenceColor = new THREE.Color(0x8b6b4a);
  const wallColor = new THREE.Color(0xcfc8b8);
  const hedgeColor = new THREE.Color(0x3f6d2e);
  const isWall = f.kind === 'wall' || f.kind === 'retaining_wall' || f.kind === 'city_wall';
  const isHedge = f.kind === 'hedge';

  for (let i = 0; i < f.coords.length - 1; i++) {
    const a = f.coords[i], b = f.coords[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz);
    if (L < 0.2) continue;
    const rot = Math.atan2(-dz, dx);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;

    if (isWall) addBox(fenceData, wallColor, mx, 0.9, mz, L, 1.8, 0.4, rot);
    else if (isHedge) addBox(fenceData, hedgeColor, mx, 0.7, mz, L, 1.4, 0.9, rot);
    else {
      addBox(fenceData, fenceColor, mx, 0.45, mz, L, 0.08, 0.04, rot);
      addBox(fenceData, fenceColor, mx, 0.85, mz, L, 0.08, 0.04, rot);
      const posts = Math.max(1, Math.ceil(L / 2.5));
      for (let k = 0; k <= posts; k++) {
        const t = k / posts;
        addBox(fenceData, fenceColor, a.x + dx * t, 0.55, a.z + dz * t, 0.1, 1.1, 0.1, 0);
      }
    }

    const step = 1.0;
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k <= n; k++) {
      registerCircleCollider(a.x + dx * k / n, a.z + dz * k / n, isHedge ? 0.5 : 0.3);
    }
  }
}

function buildNature(areas, fences) {
  const rand = makeRandom(20260101);
  const trees = [];
  const MAX_TREES = 7000;

  function place(x, z, type, s, margin) {
    if (trees.length >= MAX_TREES) return;
    if (nearRoad(x, z, margin)) return;
    if (nearBuilding(x, z, 2.5)) return;
    trees.push({ x, z, type, s });
  }

  // 1) plochy (polia, lúky, les, voda...) a stromy v nich
  areas.forEach(a => {
    const style = LAND_STYLES[a.kind];
    if (!style) return;
    addLandMesh(a.ring, style, rand);

    const spec = style.trees || style.bushes;
    if (!spec) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    a.ring.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });
    const sp = spec.spacing;
    for (let x = minX; x < maxX; x += sp) {
      for (let z = minZ; z < maxZ; z += sp) {
        const px = x + (rand() - 0.5) * sp * 0.8;
        const pz = z + (rand() - 0.5) * sp * 0.8;
        if (spec.skip && rand() < spec.skip) continue;
        if (!pointInPolygon(px, pz, a.ring)) continue;
        const type = style.bushes ? 'bush' : (rand() < (spec.conifer ?? 0.5) ? 'conifer' : 'broad');
        place(px, pz, type, 0.75 + rand() * 0.6, 3);
      }
    }
  });

  // 2) kríky a stromy pozdĺž okrajov polí
  areas.filter(a => a.kind === 'farmland').forEach(a => {
    for (let i = 0; i < a.ring.length - 1; i++) {
      const p = a.ring[i], q = a.ring[i + 1];
      const dx = q.x - p.x, dz = q.z - p.z;
      const L = Math.hypot(dx, dz);
      for (let d = 0; d < L; d += 14) {
        if (rand() > 0.25) continue;
        const t = d / L;
        place(p.x + dx * t, p.z + dz * t, rand() < 0.7 ? 'broad' : 'bush', 0.7 + rand() * 0.4, 3.5);
      }
    }
  });

  // 3) stromy v záhradách pri domoch
  footprints.forEach(fp => {
    if (rand() > 0.3) return;
    let cx = 0, cz = 0;
    fp.pts.forEach(p => { cx += p.x; cz += p.z; });
    cx /= fp.pts.length;
    cz /= fp.pts.length;
    const i = Math.floor(rand() * fp.pts.length);
    const a = fp.pts[i], b = fp.pts[(i + 1) % fp.pts.length];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    let dx = mx - cx, dz = mz - cz;
    const dl = Math.hypot(dx, dz) || 1;
    const dist = 3.5 + rand() * 3;
    place(mx + dx / dl * dist, mz + dz / dl * dist,
      rand() < 0.15 ? 'conifer' : 'broad', 0.55 + rand() * 0.4, 2);
  });

  // 4) vykreslenie stromov (hromadne, aby hra bežala plynulo)
  const trunkM = [], broadM = [], broadC = [], coniferM = [], coniferC = [];
  let colliders = 0;

  trees.forEach(t => {
    const yaw = rand() * Math.PI * 2;
    const s = t.s;
    if (t.type === 'bush') {
      pushInstance(broadM, t.x, 0.6 * s, t.z, yaw, 1.4 * s, 1.0 * s, 1.4 * s);
      broadC.push(new THREE.Color().setHSL(0.25 + rand() * 0.08, 0.45, 0.2 + rand() * 0.1));
      return;
    }
    if (t.type === 'conifer') {
      pushInstance(trunkM, t.x, 0, t.z, yaw, 0.35 * s, 1.6 * s, 0.35 * s);
      pushInstance(coniferM, t.x, 1.4 * s, t.z, yaw, 2.1 * s, 7.5 * s, 2.1 * s);
      coniferC.push(new THREE.Color().setHSL(0.38 + rand() * 0.04, 0.4, 0.13 + rand() * 0.07));
    } else {
      pushInstance(trunkM, t.x, 0, t.z, yaw, 0.4 * s, 2.8 * s, 0.4 * s);
      pushInstance(broadM, t.x, 3.9 * s, t.z, yaw, 2.7 * s, 2.5 * s, 2.7 * s);
      broadC.push(new THREE.Color().setHSL(0.22 + rand() * 0.1, 0.45, 0.22 + rand() * 0.12));
    }
    registerCircleCollider(t.x, t.z, 0.45);
    colliders++;
  });

  function instanced(geo, mat, list, colors) {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      if (colors) mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mapGroup.add(mesh);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  coneGeo.translate(0, 0.5, 0);

  instanced(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 1 }), trunkM, null);
  instanced(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), broadM, broadC);
  instanced(coneGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), coniferM, coniferC);

  // 5) ploty a múry
  fences.forEach(buildFence);
  makeMergedMesh(fenceData, 0.9);

  const tufts = buildGrassTufts(areas, rand);

  return { trees: trees.length, colliders, fences: fences.length, tufts };
}
// ===== PRÍRODA END =====


// Načítanie skutočných údajov z OpenStreetMap
 

async function loadMap() {
  const status = document.getElementById('mapStatus');

  status.textContent = 'Načítavam lokálnu mapu Trstína...';

  try {
const response = await fetch('./map 2.osm');
    if (!response.ok) {
      throw new Error('Súbor map 2.osm sa nenašiel.');
    }

    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(
      xmlText,
      'application/xml'
    );

    const parserError = xml.querySelector('parsererror');

if (parserError) {
  console.error('XML CHYBA:', parserError.textContent);
  throw new Error('XML chyba: ' + parserError.textContent.slice(0, 250));
}

    const nodes = new Map();
    const crossingNodes = [];

    // Načítanie GPS bodov
    xml.querySelectorAll('node').forEach(node => {
      const id = node.getAttribute('id');
      const lat = Number(node.getAttribute('lat'));
      const lon = Number(node.getAttribute('lon'));

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const pos = gpsToWorld(lat, lon);
        nodes.set(id, pos);

        // uzly s tagmi (priechody pre chodcov)
        if (node.children.length) {
          const t = {};
          node.querySelectorAll(':scope > tag').forEach(tag => {
            t[tag.getAttribute('k')] = tag.getAttribute('v');
          });

          if (
            t.highway === 'crossing' &&
            (t.crossing === 'zebra' || t.crossing === 'marked' ||
             t['crossing:markings'] === 'zebra')
          ) {
            crossingNodes.push(pos);
          }
        }
      }
    });

    const wayCoords = new Map();
    const landAreas = [];
    const fenceList = [];

    let roadCount = 0;
    let buildingCount = 0;

    // Načítanie ciest a budov
    xml.querySelectorAll('way').forEach(way => {
      const tags = {};

      way.querySelectorAll(':scope > tag').forEach(tag => {
        tags[tag.getAttribute('k')] = tag.getAttribute('v');
      });

      const coords = Array.from(
        way.querySelectorAll(':scope > nd')
      )
        .map(nd => nodes.get(nd.getAttribute('ref')))
        .filter(Boolean);

      if (tags.highway && coords.length > 1) {
        let width = Number.parseFloat(tags.width);

        if (!Number.isFinite(width) || width <= 0) {
          const lanes = Number.parseInt(tags.lanes, 10);

          if (Number.isFinite(lanes) && lanes > 0) {
            const laneWidth =
              tags.highway === 'primary' ? 3.5 :
              tags.highway === 'secondary' ? 3.3 :
              tags.highway === 'tertiary' ? 3.1 : 3.0;

            const isMain = ['primary', 'secondary', 'tertiary'].includes(tags.highway);
            width = Math.max(lanes * laneWidth, isMain ? 4.5 : 3);
          } else {
            width =
              tags.highway === 'motorway' ? 12 :
              tags.highway === 'trunk' ? 10 :
              tags.highway === 'primary' ? 9 :
              tags.highway === 'secondary' ? 8 :
              tags.highway === 'tertiary' ? 7 :
              tags.highway === 'residential' ? 6 :
              tags.highway === 'unclassified' ? 5.5 :
              tags.highway === 'living_street' ? 5 :
              tags.highway === 'service' ? 4 :
              tags.highway === 'track' ? 3 : 2;
          }
        }

        width = THREE.MathUtils.clamp(width, 2, 16);

        createRoad(coords, width, tags, way.getAttribute('id'));
        roadCount++;
      }

      if (tags.building && coords.length >= 4) {
        createBuilding(coords, tags['building:levels'], tags, way.getAttribute('id'));
        buildingCount++;
      }

      wayCoords.set(way.getAttribute('id'), coords);

      const kind = landKind(tags);
      if (kind && !tags.building && coords.length >= 4 &&
          coords[0] === coords[coords.length - 1]) {
        landAreas.push({ kind, ring: coords });
      }

      if (['fence', 'wall', 'hedge', 'retaining_wall'].includes(tags.barrier) &&
          coords.length > 1) {
        fenceList.push({ kind: tags.barrier, coords });
      }

      if (['stream', 'ditch', 'drain', 'river'].includes(tags.waterway) &&
          coords.length > 1) {
        createStrip(coords, tags.waterway === 'river' ? 6 : 1.8, 0x3f7fb5, -0.02);
      }
    });

    // Veľké lesy a polia sú v mape zapísané ako multipolygóny
    xml.querySelectorAll('relation').forEach(rel => {
      const rtags = {};
      rel.querySelectorAll(':scope > tag').forEach(t => {
        rtags[t.getAttribute('k')] = t.getAttribute('v');
      });
      if (rtags.type !== 'multipolygon' || rtags.building) return;
      const kind = landKind(rtags);
      if (!kind) return;

      const outers = Array.from(rel.querySelectorAll(':scope > member'))
        .filter(m => m.getAttribute('type') === 'way' && m.getAttribute('role') !== 'inner')
        .map(m => wayCoords.get(m.getAttribute('ref')));

      chainWays(outers).forEach(ring => landAreas.push({ kind, ring }));
    });

    buildRoadMarkings(crossingNodes);
    flushDashes();
    finishBuildings();
    const nature = buildNature(landAreas, fenceList);

    status.textContent =
      `Mapa načítaná! Cesty: ${roadCount}, budovy: ${buildingCount}, stromy: ${nature.trees}`;

    console.log('Trstín Life mapa:', {
      roads: roadCount,
      buildings: buildingCount,
      nodes: nodes.size
    });

  } catch (error) {
    console.error('Chyba mapy:', error);
    status.textContent = 'Chyba mapy: ' + error.message;
  }
}

    


// Auto
const car = new THREE.Group();

const paint = new THREE.MeshStandardMaterial({
  color: 0x0755ff, metalness: 0.6, roughness: 0.3
});
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x1b2a3a, metalness: 0.8, roughness: 0.1,
  transparent: true, opacity: 0.85
});

// Spodná karoséria
const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.2), paint);
body.position.y = 0.75;
car.add(body);

// Kabína (sklo) + strecha
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.7, 2.0), glassMat);
cabin.position.set(0, 1.45, 0.3);
car.add(cabin);

const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 2.1), paint);
roof.position.set(0, 1.84, 0.3);
car.add(roof);

// Nárazníky
const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.2), darkMat);
frontBumper.position.set(0, 0.5, -2.15);
car.add(frontBumper);

const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.2), darkMat);
rearBumper.position.set(0, 0.5, 2.15);
car.add(rearBumper);

// Predné svetlá
const headMat = new THREE.MeshStandardMaterial({
  color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.5
});
[-0.7, 0.7].forEach(x => {
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
  light.position.set(x, 0.85, -2.12);
  car.add(light);
});

// Zadné svetlá (pri brzdení svietia viac)
const tailMat = new THREE.MeshStandardMaterial({
  color: 0x880000, emissive: 0xff0000, emissiveIntensity: 0.6
});
[-0.7, 0.7].forEach(x => {
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
  light.position.set(x, 0.85, 2.12);
  car.add(light);
});

// Kolesá
const wheelRadius = 0.45;
const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.35, 20);
wheelGeometry.rotateZ(Math.PI / 2);
const rimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.37, 12);
rimGeometry.rotateZ(Math.PI / 2);
const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.3 });

const wheels = [];       // točia sa podľa rýchlosti
const frontPivots = [];  // zatáčajú

function makeWheel(x, z, isFront) {
  const pivot = new THREE.Group();
  pivot.position.set(x, wheelRadius, z);

  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(wheelGeometry, darkMat));
  wheel.add(new THREE.Mesh(rimGeometry, rimMat));

  pivot.add(wheel);
  car.add(pivot);

  wheels.push(wheel);
  if (isFront) frontPivots.push(pivot);
}

makeWheel(-1.05, -1.4, true);
makeWheel(1.05, -1.4, true);
makeWheel(-1.05, 1.4, false);
makeWheel(1.05, 1.4, false);

car.position.set(0, 0, 0);
car.traverse(obj => {
  if (obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = true;
  }
});
scene.add(car);

// =====================================================
// 3D MODEL AUTA (VW Golf GTI) – priečinok cars
// =====================================================

const CAR_MODEL_URL = './cars/volkswagen_golf_gti_2025.glb';
const CAR_MODEL_LENGTH = 4.3;   // dĺžka auta v metroch (Golf 8 = 4,29 m)

let carModelHolder = null;      // sem sa vloží model (kláves F ho otočí o 180°)

// GLTFLoader z CDN potrebuje importovať "three". V obyčajnom prehliadači to
// nejde, preto jeho kód stiahneme a odkaz na "three" prepíšeme na ten náš.
async function loadGLTFLoaderClass() {
  const base = 'https://cdn.jsdelivr.net/npm/three@0.160.0';
  const threeUrl = base + '/build/three.module.js';

  async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Nepodarilo sa stiahnuť ' + url);
    return r.text();
  }

  function makeModuleUrl(code) {
    return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }

  const utilsCode = (await fetchText(base + '/examples/jsm/utils/BufferGeometryUtils.js'))
    .replace(/from\s+['"]three['"]/g, `from '${threeUrl}'`);
  const utilsUrl = makeModuleUrl(utilsCode);

  const loaderCode = (await fetchText(base + '/examples/jsm/loaders/GLTFLoader.js'))
    .replace(/from\s+['"]three['"]/g, `from '${threeUrl}'`)
    .replace(/from\s+['"]\.\.\/utils\/BufferGeometryUtils\.js['"]/g, `from '${utilsUrl}'`);

  const module = await import(makeModuleUrl(loaderCode));
  return module.GLTFLoader;
}

// Prostredie pre odlesky na laku a skle (bez neho by lakované auto vyzeralo čierne)
function makeCarEnvironment() {
  const envScene = new THREE.Scene();

  envScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x4f95e0) },
        horizonColor: { value: new THREE.Color(0xdfeaf2) },
        groundColor: { value: new THREE.Color(0x5b6b45) }
      },
      vertexShader: `
        varying float vHeight;
        void main() {
          vHeight = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        varying float vHeight;
        void main() {
          vec3 up = mix(horizonColor, topColor, pow(clamp(vHeight, 0.0, 1.0), 0.6));
          vec3 down = mix(horizonColor, groundColor, clamp(-vHeight * 3.0, 0.0, 1.0));
          gl_FragColor = vec4(vHeight > 0.0 ? up : down, 1.0);
        }`
    })
  ));

  // jasné "slnko" kvôli lesku
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(6, 16, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.5, 4.5) })
  );
  sun.position.copy(sunOffset).normalize().multiplyScalar(40);
  envScene.add(sun);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  return texture;
}

const carEnvTexture = makeCarEnvironment();

function applyCarMaterials(root) {
  root.traverse(obj => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => {
      if (m && m.isMeshStandardMaterial) {
        m.envMap = carEnvTexture;
        m.envMapIntensity = 1.0;
        m.needsUpdate = true;
      }
    });
  });
}

// aj pôvodné auto dostane odlesky
[paint, glassMat, rimMat].forEach(m => {
  m.envMap = carEnvTexture;
  m.needsUpdate = true;
});

function setCarStatus(text) {
  const el = document.getElementById('carStatus');
  if (el) el.textContent = text;
}

// Nájde štyri kolesá podľa tvaru a polohy (okrúhle predmety pri zemi v rohoch auta)
// a vloží ich do skupín, ktoré sa dajú točiť a natáčať.
function setupWheels(holder) {
  holder.updateMatrixWorld(true);

  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  function measure(obj) {
    box.setFromObject(obj);
    if (box.isEmpty()) return null;
    box.getSize(size);
    box.getCenter(center);
    return { sx: size.x, sy: size.y, sz: size.z, cx: center.x, cy: center.y, cz: center.z };
  }

  function looksLikeWheel(m) {
    const diameter = Math.max(m.sy, m.sz);
    const smaller = Math.min(m.sy, m.sz);

    return (
      diameter >= 0.45 && diameter <= 0.9 &&   // kolo má približne 0,5 – 0,8 m
      smaller >= diameter * 0.7 &&             // je okrúhle, nie pologuľaté
      m.sx <= diameter * 0.6 &&                // je užšie než široké
      m.cy >= 0.2 && m.cy <= 0.6 &&            // stred je blízko zeme
      Math.abs(m.cx) >= 0.55 &&                // vľavo alebo vpravo od stredu auta
      Math.abs(m.cz) >= 0.8 && Math.abs(m.cz) <= 2.0
    );
  }

  const candidates = [];

  function visit(obj) {
    for (const child of obj.children.slice()) {
      const m = measure(child);

      if (m && looksLikeWheel(m)) {
        candidates.push({ obj: child, m });
      } else {
        visit(child);
      }
    }
  }

  visit(holder);

  const quadrants = {};

  candidates.forEach(c => {
    const key = (c.m.cx < 0 ? 'L' : 'R') + (c.m.cz < 0 ? 'F' : 'B');
    (quadrants[key] = quadrants[key] || []).push(c);
  });

  const needed = ['LF', 'RF', 'LB', 'RB'];

  if (!needed.every(k => quadrants[k])) {
    const nearby = [];

    holder.traverse(o => {
      if (!o.isMesh) return;
      const m = measure(o);
      if (m && m.cy < 0.9 && Math.max(m.sy, m.sz) > 0.2 && Math.max(m.sy, m.sz) < 1.2) {
        nearby.push({
          nazov: o.name,
          velkost: [m.sx, m.sy, m.sz].map(v => +v.toFixed(2)),
          stred: [m.cx, m.cy, m.cz].map(v => +v.toFixed(2))
        });
      }
    });

    console.log('Kolesá sa nenašli. Nálezené kandidáty:', candidates.length, nearby.slice(0, 40));
    return false;
  }

  const union = new THREE.Box3();

  needed.forEach(key => {
    union.makeEmpty();

    quadrants[key].forEach(c => {
      box.setFromObject(c.obj);
      union.union(box);
    });

    union.getCenter(center);
    const diameter = Math.max(
      union.max.y - union.min.y,
      union.max.z - union.min.z
    );

    const steer = new THREE.Group();   // natáčanie doľava / doprava
    const spin = new THREE.Group();    // točenie okolo osi

    steer.position.copy(center);
    steer.add(spin);
    holder.add(steer);
    holder.updateMatrixWorld(true);

    quadrants[key].forEach(c => spin.attach(c.obj));

    spin.userData.radius = diameter / 2;
    wheels.push(spin);

    if (key.endsWith('F')) {
      frontPivots.push(steer);
    }
  });

  return true;
}

async function loadCarModel() {
  setCarStatus('Načítavam model auta...');

  try {
    const GLTFLoader = await loadGLTFLoaderClass();
    const gltf = await new GLTFLoader().loadAsync(CAR_MODEL_URL);
    const model = gltf.scene;

    // holder (otočenie o 180°) -> fix (osi, mierka, poloha) -> model
    const holder = new THREE.Group();
    const fix = new THREE.Group();
    fix.add(model);
    holder.add(fix);

    // dlhšia strana auta musí ísť v smere osi Z
    holder.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(holder);
    let size = box.getSize(new THREE.Vector3());

    if (size.x > size.z) {
      fix.rotation.y = Math.PI / 2;
    }

    // mierka podľa skutočnej dĺžky
    holder.updateMatrixWorld(true);
    box.setFromObject(holder);
    size = box.getSize(new THREE.Vector3());
    fix.scale.setScalar(CAR_MODEL_LENGTH / Math.max(size.z, 0.001));

    // stred na (0,0), kolesá na zemi
    holder.updateMatrixWorld(true);
    box.setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    fix.position.set(-center.x, -box.min.y, -center.z);

    // tento model má predok už na správnej strane (-Z); keby sa zmenil model
    // a bol otočený opačne, stačí zmeniť 0 na Math.PI (alebo stlačiť F v hre)
    holder.rotation.y = 0;

    applyCarMaterials(holder);

    // pôvodné auto z kociek sa odstráni
    car.children.slice().forEach(c => car.remove(c));
    wheels.length = 0;
    frontPivots.length = 0;

    const wheelsFound = setupWheels(holder);

    car.add(holder);
    carModelHolder = holder;

    const names = [];
    model.traverse(o => names.push(o.name));
    console.log('Model auta načítaný:', {
      povodnaVelkost: size,
      nazvyObjektov: names
    });

    setCarStatus(
      wheelsFound
        ? 'Model auta: VW Golf GTI'
        : 'Model auta: VW Golf GTI (kolesá sa nepodarilo nájsť)'
    );

  } catch (error) {
    console.error('Model auta sa nepodarilo načítať:', error);
    setCarStatus('Model auta sa nenačítal – používam jednoduché auto');
  }
}

loadCarModel();

// =====================================================
// OVLÁDANIE AUTA – ŠTÝL FARMING SIMULATOR
// =====================================================

const keys = {};

let topView = false;
let topHeight = 300;

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();

  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
    e.preventDefault();
  }

  if (k === 'm' && !keys.m) {
    topView = !topView;
  }

  // ak je model auta otočený dozadu, kláves F ho otočí o 180°
  if (k === 'f' && !keys.f && carModelHolder) {
    carModelHolder.rotation.y += Math.PI;
  }

  keys[k] = true;
});

window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

window.addEventListener('blur', () => {
  Object.keys(keys).forEach(k => keys[k] = false);
});

// Fyzika auta
const clock = new THREE.Clock();

let speed = 0;
let steering = 0;
let steeringInput = 0;

const MAX_FORWARD_SPEED = 13.9;
const MAX_REVERSE_SPEED = 4.5;

const ACCELERATION = 4.0;
const BRAKING = 7.0;
const ROLLING_RESISTANCE = 0.8;
const AIR_RESISTANCE = 0.018;

const WHEELBASE = 2.8;
const MAX_STEERING_ANGLE = 0.55;

const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();

// Tento vektor vždy predstavuje predok auta (-Z)
const carForward = new THREE.Vector3(0, 0, -1);

// =====================================================
// HLAVNÁ HERNÁ SLUČKA
// =====================================================

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  // Vstupy
  const forwardPressed = keys.w || keys.arrowup;
  const reversePressed = keys.s || keys.arrowdown;
  const handbrake = keys[' '];

  const leftPressed = keys.a || keys.arrowleft;
  const rightPressed = keys.d || keys.arrowright;

  // Plyn a brzdenie
  if (forwardPressed) {
    if (speed < -0.1) {
      speed += BRAKING * dt;
    } else {
      speed += ACCELERATION * dt;
    }
  }

  if (reversePressed) {
    if (speed > 0.1) {
      speed -= BRAKING * dt;
    } else {
      speed -= ACCELERATION * 0.65 * dt;
    }
  }

  // Zotrvačnosť a odpor vzduchu
  if (!forwardPressed && !reversePressed) {
    const resistance =
      ROLLING_RESISTANCE * dt +
      AIR_RESISTANCE * speed * speed * dt;

    if (Math.abs(speed) <= resistance) {
      speed = 0;
    } else {
      speed -= Math.sign(speed) * resistance;
    }
  }

  // Ručná brzda
  if (handbrake) {
    const handbrakeAmount = 10 * dt;

    if (Math.abs(speed) <= handbrakeAmount) {
      speed = 0;
    } else {
      speed -= Math.sign(speed) * handbrakeAmount;
    }
  }

  speed = THREE.MathUtils.clamp(
    speed,
    -MAX_REVERSE_SPEED,
    MAX_FORWARD_SPEED
  );

  // Riadenie
  let targetSteering = 0;

  if (leftPressed) targetSteering = 1;
  if (rightPressed) targetSteering = -1;

  const steeringSpeed = 3.2;

  steeringInput = THREE.MathUtils.damp(
    steeringInput,
    targetSteering,
    steeringSpeed,
    dt
  );

  // Pri vyššej rýchlosti sa zmenší maximálny uhol riadenia
  const speedFactor = THREE.MathUtils.clamp(
    1 - Math.abs(speed) / 25,
    0.45,
    1
  );

  const targetWheelAngle =
    steeringInput * MAX_STEERING_ANGLE * speedFactor;

  steering = THREE.MathUtils.damp(
    steering,
    targetWheelAngle,
    5,
    dt
  );

  // Fyzika zatáčania
  const yawRate = speed / WHEELBASE * Math.tan(steering);
  car.rotation.y += yawRate * dt;

  // Predný smer auta (lokálna os -Z otočená podľa auta)
  carForward
    .set(0, 0, -1)
    .applyQuaternion(car.quaternion)
    .normalize();

  car.position.addScaledVector(carForward, speed * dt);

  // Kolízie s budovami, stromami a plotmi
  if (resolveCollisions(car)) {
    speed *= 0.25;
  }

  // Otáčanie kolies podľa prejdenej vzdialenosti
  wheels.forEach(w => {
    w.rotation.x -= speed * dt / (w.userData.radius || wheelRadius);
  });

  // Natáčanie predných kolies
  frontPivots.forEach(p => {
    p.rotation.y = THREE.MathUtils.damp(
      p.rotation.y,
      steering,
      8,
      dt
    );
  });

  // Brzdové svetlá
  const braking =
    (reversePressed && speed > 0.1) ||
    (forwardPressed && speed < -0.1) ||
    handbrake;

  tailMat.emissiveIntensity = braking ? 3 : 0.6;

  // ===================================================
  // KAMERA
  // ===================================================

  if (topView) {
    if (keys.q) {
      topHeight = Math.max(50, topHeight - 80 * dt);
    }

    if (keys.e) {
      topHeight = Math.min(2000, topHeight + 80 * dt);
    }

    camera.up.set(0, 0, -1);

    desiredCameraPosition.set(
      car.position.x,
      topHeight,
      car.position.z
    );

    camera.position.lerp(
      desiredCameraPosition,
      1 - Math.exp(-5 * dt)
    );

    camera.lookAt(
      car.position.x,
      0,
      car.position.z
    );

  } else {
    camera.up.set(0, 1, 0);

    carForward
      .set(0, 0, -1)
      .applyQuaternion(car.quaternion)
      .normalize();

    // Kamera stojí za autom
    desiredCameraPosition
      .copy(car.position)
      .addScaledVector(carForward, -11);

    desiredCameraPosition.y += 5.5;

    camera.position.lerp(
      desiredCameraPosition,
      1 - Math.exp(-4.5 * dt)
    );

    cameraTarget.copy(car.position);
    cameraTarget.y += 1.2;

    camera.lookAt(cameraTarget);
  }

  // Rýchlosť v km/h
  document.getElementById('speed').textContent =
    Math.round(Math.abs(speed) * 3.6) + ' km/h';

  // Slnko a tiene sledujú auto
  sunlight.position.copy(car.position).add(sunOffset);
  sunlight.target.position.copy(car.position);
  sky.position.copy(camera.position);

  renderer.render(scene, camera);
}

// =====================================================
// INFORMAČNÝ PANEL
// =====================================================

const panel = document.createElement('div');

panel.style.cssText = `
  position:fixed;
  top:15px;
  left:15px;
  color:white;
  background:rgba(10,15,20,0.82);
  padding:15px 18px;
  border-radius:10px;
  font-family:Arial,sans-serif;
  z-index:10;
  min-width:190px;
  line-height:1.6;
  border:1px solid rgba(255,255,255,0.15);
  box-shadow:0 4px 18px rgba(0,0,0,0.3);
`;

panel.innerHTML = `
  <h2 style="margin:0 0 8px;font-size:20px;letter-spacing:1px">
    TRSTIN LIFE
  </h2>

  <div style="font-size:17px;margin-bottom:5px">
    Rýchlosť: <strong id="speed">0 km/h</strong>
  </div>

  <div id="mapStatus" style="font-size:12px;color:#b9d8ff;margin-bottom:4px">
    Načítavam mapu Trstína...
  </div>

  <div id="carStatus" style="font-size:12px;color:#b9d8ff;margin-bottom:10px"></div>

  <div style="font-size:12px;color:#ddd">
    <strong>JAZDA</strong><br>
    W / ↑ – plyn<br>
    S / ↓ – brzda a spiatočka<br>
    A / ← – doľava<br>
    D / → – doprava<br>
    SPACE – ručná brzda<br><br>
    <strong>KAMERA</strong><br>
    M – pohľad zhora<br>
    Q / E – priblížiť / oddialiť<br>
    F – otočiť model auta o 180°
  </div>
`;

document.body.appendChild(panel);

// =====================================================
// ZMENA VEĽKOSTI OKNA
// =====================================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =====================================================
// SPUSTENIE HRY
// =====================================================

loadMap();
animate();