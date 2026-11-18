import * as THREE from 'three';

export interface ProceduralTextureSet {
  sandstone: THREE.CanvasTexture;
  sandFloor: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  crate: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
  door: THREE.CanvasTexture;
  siteA: THREE.CanvasTexture;
  siteB: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function addGrain(ctx: CanvasRenderingContext2D, size: number, amount: number): void {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function finalizeTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Dust Sandstone Masonry Wall
  const [sandC, sandCtx] = makeCanvas(256);
  sandCtx.fillStyle = '#c8aa7e';
  sandCtx.fillRect(0, 0, 256, 256);
  // Subtle horizontal stone courses
  sandCtx.strokeStyle = 'rgba(110, 84, 54, 0.28)';
  sandCtx.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) {
    sandCtx.beginPath();
    sandCtx.moveTo(0, y);
    sandCtx.lineTo(256, y);
    sandCtx.stroke();
    const offset = (y / 32) % 2 === 0 ? 0 : 32;
    for (let x = offset; x < 256; x += 64) {
      sandCtx.beginPath();
      sandCtx.moveTo(x, y);
      sandCtx.lineTo(x, y + 32);
      sandCtx.stroke();
    }
  }
  // Subtle plaster patches
  sandCtx.fillStyle = 'rgba(225, 202, 165, 0.22)';
  sandCtx.fillRect(24, 40, 88, 52);
  sandCtx.fillRect(148, 150, 74, 48);
  addGrain(sandCtx, 256, 18);
  const sandstone = finalizeTex(sandC, aniso, 2, 1);

  // 2. Sandy Courtyard Floor (richer warm ochre to contrast sandstone walls)
  const [floorC, floorCtx] = makeCanvas(256);
  floorCtx.fillStyle = '#a48358';
  floorCtx.fillRect(0, 0, 256, 256);
  floorCtx.strokeStyle = 'rgba(72, 52, 30, 0.24)';
  floorCtx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    floorCtx.beginPath();
    floorCtx.moveTo(i, 0);
    floorCtx.lineTo(i, 256);
    floorCtx.stroke();
    floorCtx.beginPath();
    floorCtx.moveTo(0, i);
    floorCtx.lineTo(256, i);
    floorCtx.stroke();
  }
  addGrain(floorCtx, 256, 24);
  const sandFloor = finalizeTex(floorC, aniso, 16, 18);

  // 3. Concrete Platform / Catwalk
  const [concC, concCtx] = makeCanvas(256);
  concCtx.fillStyle = '#8b8f94';
  concCtx.fillRect(0, 0, 256, 256);
  concCtx.strokeStyle = 'rgba(40, 44, 52, 0.25)';
  concCtx.lineWidth = 3;
  concCtx.strokeRect(2, 2, 252, 252);
  addGrain(concCtx, 256, 16);
  const concrete = finalizeTex(concC, aniso, 2, 2);

  // 4. Wooden Tactical Crate
  const [crateC, crateCtx] = makeCanvas(256);
  crateCtx.fillStyle = '#9a6b3e';
  crateCtx.fillRect(0, 0, 256, 256);
  // Plank lines
  crateCtx.strokeStyle = '#5c3c1e';
  crateCtx.lineWidth = 3;
  for (let y = 32; y < 256; y += 32) {
    crateCtx.beginPath();
    crateCtx.moveTo(0, y);
    crateCtx.lineTo(256, y);
    crateCtx.stroke();
  }
  // Outer frame + diagonal brace
  crateCtx.fillStyle = '#7e542d';
  crateCtx.fillRect(0, 0, 256, 20);
  crateCtx.fillRect(0, 236, 256, 20);
  crateCtx.fillRect(0, 0, 20, 256);
  crateCtx.fillRect(236, 0, 20, 256);
  crateCtx.beginPath();
  crateCtx.lineWidth = 18;
  crateCtx.strokeStyle = '#7e542d';
  crateCtx.moveTo(16, 16);
  crateCtx.lineTo(240, 240);
  crateCtx.stroke();
  addGrain(crateCtx, 256, 14);
  const crate = finalizeTex(crateC, aniso, 1, 1);

  // 5. Ribbed Shipping Container / Metal
  const [metalC, metalCtx] = makeCanvas(256);
  metalCtx.fillStyle = '#3b5949';
  metalCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 24) {
    metalCtx.fillStyle = 'rgba(0,0,0,0.22)';
    metalCtx.fillRect(x, 0, 8, 256);
    metalCtx.fillStyle = 'rgba(255,255,255,0.08)';
    metalCtx.fillRect(x + 8, 0, 4, 256);
  }
  addGrain(metalCtx, 256, 10);
  const metal = finalizeTex(metalC, aniso, 2, 1);

  // 6. Heavy Double Door Wood
  const [doorC, doorCtx] = makeCanvas(256);
  doorCtx.fillStyle = '#6f4c2f';
  doorCtx.fillRect(0, 0, 256, 256);
  doorCtx.fillStyle = '#2d3138';
  doorCtx.fillRect(0, 40, 256, 16);
  doorCtx.fillRect(0, 200, 256, 16);
  addGrain(doorCtx, 256, 16);
  const door = finalizeTex(doorC, aniso, 1, 1);

  // 7. Site A & Site B Tactical Stencils
  const makeSiteStencil = (letter: 'A' | 'B') => {
    const [c, ctx] = makeCanvas(256);
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d9483b';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, 220, 220);
    ctx.fillStyle = 'rgba(217, 72, 59, 0.85)';
    ctx.font = '900 155px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 128, 134);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };

  const siteA = makeSiteStencil('A');
  const siteB = makeSiteStencil('B');

  return {
    sandstone,
    sandFloor,
    concrete,
    crate,
    metal,
    door,
    siteA,
    siteB,
    dispose: () => {
      sandstone.dispose();
      sandFloor.dispose();
      concrete.dispose();
      crate.dispose();
      metal.dispose();
      door.dispose();
      siteA.dispose();
      siteB.dispose();
    },
  };
}
