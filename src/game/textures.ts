import * as THREE from 'three';

export interface ProceduralTextureSet {
  steelAlbedo: THREE.CanvasTexture;
  steelBump: THREE.CanvasTexture;
  copperAlbedo: THREE.CanvasTexture;
  copperBump: THREE.CanvasTexture;
  siliconCircuit: THREE.CanvasTexture;
  grateAlbedo: THREE.CanvasTexture;
  grateBump: THREE.CanvasTexture;
  cryoIceAlbedo: THREE.CanvasTexture;
  canvasFabricAlbedo: THREE.CanvasTexture;
  manometerDial: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Forged Rusted Steel Albedo & Bump
  const [steelC, steelCtx] = makeCanvas(512, 512);
  const [steelBC, steelBCtx] = makeCanvas(512, 512);

  steelCtx.fillStyle = '#333940';
  steelCtx.fillRect(0, 0, 512, 512);
  steelBCtx.fillStyle = '#808080';
  steelBCtx.fillRect(0, 0, 512, 512);

  // Brushed directional metal grain
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 18 + Math.random() * 64;
    const v = Math.floor(48 + Math.random() * 44);
    steelCtx.strokeStyle = `rgba(${v},${v + 4},${v + 8},0.22)`;
    steelCtx.lineWidth = 1 + Math.random() * 1.4;
    steelCtx.beginPath();
    steelCtx.moveTo(x, y);
    steelCtx.lineTo(x + len, y + (Math.random() - 0.5) * 2);
    steelCtx.stroke();

    const bv = Math.floor(110 + Math.random() * 45);
    steelBCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.3)`;
    steelBCtx.beginPath();
    steelBCtx.moveTo(x, y);
    steelBCtx.lineTo(x + len, y);
    steelBCtx.stroke();
  }

  // Rust patches near seams
  for (let i = 0; i < 38; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 10 + Math.random() * 34;
    const grad = steelCtx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(118, 56, 26, 0.36)');
    grad.addColorStop(1, 'rgba(118, 56, 26, 0)');
    steelCtx.fillStyle = grad;
    steelCtx.beginPath();
    steelCtx.arc(x, y, r, 0, Math.PI * 2);
    steelCtx.fill();
  }

  // Panel seams & hand-forged rivets
  steelCtx.strokeStyle = '#1b1e23';
  steelCtx.lineWidth = 4;
  steelCtx.strokeRect(4, 4, 504, 504);
  steelCtx.beginPath();
  steelCtx.moveTo(0, 256);
  steelCtx.lineTo(512, 256);
  steelCtx.moveTo(256, 0);
  steelCtx.lineTo(256, 512);
  steelCtx.stroke();

  steelBCtx.strokeStyle = '#252525';
  steelBCtx.lineWidth = 5;
  steelBCtx.strokeRect(4, 4, 504, 504);
  steelBCtx.beginPath();
  steelBCtx.moveTo(0, 256);
  steelBCtx.lineTo(512, 256);
  steelBCtx.moveTo(256, 0);
  steelBCtx.lineTo(256, 512);
  steelBCtx.stroke();

  const rivetCoords = [20, 128, 236, 276, 384, 492];
  for (const rx of rivetCoords) {
    for (const ry of [20, 236, 276, 492]) {
      steelCtx.fillStyle = '#5a626c';
      steelCtx.beginPath();
      steelCtx.arc(rx, ry, 5, 0, Math.PI * 2);
      steelCtx.fill();
      steelCtx.strokeStyle = '#1c1f24';
      steelCtx.lineWidth = 1.5;
      steelCtx.stroke();

      steelBCtx.fillStyle = '#dedede';
      steelBCtx.beginPath();
      steelBCtx.arc(rx, ry, 5, 0, Math.PI * 2);
      steelBCtx.fill();
    }
  }

  // 2. Brushed Copper & Coil Winding
  const [copC, copCtx] = makeCanvas(512, 512);
  const [copBC, copBCtx] = makeCanvas(512, 512);
  copCtx.fillStyle = '#a85a32';
  copCtx.fillRect(0, 0, 512, 512);
  copBCtx.fillStyle = '#808080';
  copBCtx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 6) {
    const shade = Math.sin(y * 0.45) * 18;
    copCtx.fillStyle = `rgb(${Math.min(255, 175 + shade)}, ${Math.min(255, 96 + shade * 0.6)}, ${Math.max(0, 52 + shade * 0.4)})`;
    copCtx.fillRect(0, y, 512, 4);
    const b = Math.floor(128 + Math.sin(y * 0.45) * 48);
    copBCtx.fillStyle = `rgb(${b},${b},${b})`;
    copBCtx.fillRect(0, y, 512, 4);
  }
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    copCtx.fillStyle = 'rgba(46, 98, 86, 0.14)'; // subtle verdigris patina
    copCtx.fillRect(x, y, 16 + Math.random() * 26, 2);
  }

  // 3. Silicon Wafer & Copper PCB Traces
  const [pcbC, pcbCtx] = makeCanvas(512, 512);
  pcbCtx.fillStyle = '#0e171b';
  pcbCtx.fillRect(0, 0, 512, 512);
  pcbCtx.strokeStyle = '#c87338';
  pcbCtx.lineWidth = 3;
  for (let i = 0; i < 42; i++) {
    const x0 = Math.floor(Math.random() * 16) * 32 + 16;
    const y0 = Math.floor(Math.random() * 16) * 32 + 16;
    const dx = (Math.floor(Math.random() * 5) - 2) * 32;
    const dy = (Math.floor(Math.random() * 5) - 2) * 32;
    pcbCtx.beginPath();
    pcbCtx.moveTo(x0, y0);
    pcbCtx.lineTo(x0 + dx * 0.5, y0);
    pcbCtx.lineTo(x0 + dx, y0 + dy);
    pcbCtx.stroke();
    pcbCtx.fillStyle = '#e59c54';
    pcbCtx.beginPath();
    pcbCtx.arc(x0, y0, 4, 0, Math.PI * 2);
    pcbCtx.arc(x0 + dx, y0 + dy, 4, 0, Math.PI * 2);
    pcbCtx.fill();
  }
  // Subtle silicon wafer grid
  pcbCtx.strokeStyle = 'rgba(72, 180, 175, 0.16)';
  pcbCtx.lineWidth = 1;
  for (let g = 0; g < 512; g += 32) {
    pcbCtx.beginPath();
    pcbCtx.moveTo(g, 0);
    pcbCtx.lineTo(g, 512);
    pcbCtx.moveTo(0, g);
    pcbCtx.lineTo(512, g);
    pcbCtx.stroke();
  }

  // 4. Industrial Floor Grating
  const [grateC, grateCtx] = makeCanvas(512, 512);
  const [grateBC, grateBCtx] = makeCanvas(512, 512);
  grateCtx.fillStyle = '#181c21';
  grateCtx.fillRect(0, 0, 512, 512);
  grateBCtx.fillStyle = '#202020';
  grateBCtx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 32) {
    for (let y = 0; y < 512; y += 32) {
      grateCtx.fillStyle = '#2b323b';
      grateCtx.fillRect(x + 3, y + 3, 26, 26);
      grateCtx.fillStyle = '#121519';
      grateCtx.fillRect(x + 7, y + 7, 18, 18);

      grateBCtx.fillStyle = '#cfcfcf';
      grateBCtx.fillRect(x + 3, y + 3, 26, 26);
      grateBCtx.fillStyle = '#282828';
      grateBCtx.fillRect(x + 7, y + 7, 18, 18);
    }
  }
  // Hazard stripe edge
  grateCtx.save();
  grateCtx.fillStyle = '#b4771e';
  grateCtx.fillRect(0, 0, 512, 14);
  grateCtx.fillStyle = '#15171a';
  for (let sx = -32; sx < 544; sx += 28) {
    grateCtx.beginPath();
    grateCtx.moveTo(sx, 0);
    grateCtx.lineTo(sx + 14, 0);
    grateCtx.lineTo(sx + 2, 14);
    grateCtx.lineTo(sx - 12, 14);
    grateCtx.closePath();
    grateCtx.fill();
  }
  grateCtx.restore();

  // 5. Frosted Cryo-Ice Floor
  const [iceC, iceCtx] = makeCanvas(512, 512);
  iceCtx.fillStyle = '#1e3545';
  iceCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 18 + Math.random() * 60;
    const g = iceCtx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(176, 226, 245, 0.25)');
    g.addColorStop(1, 'rgba(30, 53, 69, 0)');
    iceCtx.fillStyle = g;
    iceCtx.beginPath();
    iceCtx.arc(x, y, r, 0, Math.PI * 2);
    iceCtx.fill();
  }
  iceCtx.strokeStyle = 'rgba(214, 244, 255, 0.35)';
  iceCtx.lineWidth = 1.5;
  for (let i = 0; i < 48; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    iceCtx.beginPath();
    iceCtx.moveTo(x, y);
    iceCtx.lineTo(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90);
    iceCtx.stroke();
  }

  // 6. Heavy Charcoal Canvas Apron Fabric
  const [fabC, fabCtx] = makeCanvas(256, 256);
  fabCtx.fillStyle = '#25292e';
  fabCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    fabCtx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    fabCtx.fillRect(0, y, 256, 1.5);
  }
  for (let x = 0; x < 256; x += 3) {
    fabCtx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
    fabCtx.fillRect(x, 0, 1.5, 256);
  }

  // 7. Diegetic Brass Pressure Manometer Dial (0..120 PSI)
  const [dialC, dialCtx] = makeCanvas(512, 512);
  dialCtx.fillStyle = '#efe5ce';
  dialCtx.beginPath();
  dialCtx.arc(256, 256, 246, 0, Math.PI * 2);
  dialCtx.fill();

  dialCtx.strokeStyle = '#33291e';
  dialCtx.lineWidth = 12;
  dialCtx.beginPath();
  dialCtx.arc(256, 256, 236, 0, Math.PI * 2);
  dialCtx.stroke();

  // Danger arc (0 - 35 PSI)
  dialCtx.strokeStyle = '#b93829';
  dialCtx.lineWidth = 22;
  dialCtx.beginPath();
  dialCtx.arc(256, 256, 192, Math.PI * 0.75, Math.PI * 1.18);
  dialCtx.stroke();

  // Optimal green/brass arc
  dialCtx.strokeStyle = '#3c6e57';
  dialCtx.lineWidth = 14;
  dialCtx.beginPath();
  dialCtx.arc(256, 256, 192, Math.PI * 1.22, Math.PI * 2.25);
  dialCtx.stroke();

  // Tick marks
  for (let i = 0; i <= 24; i++) {
    const ang = Math.PI * 0.75 + (i / 24) * Math.PI * 1.5;
    const isMajor = i % 4 === 0;
    const r0 = isMajor ? 154 : 172;
    const r1 = 212;
    dialCtx.strokeStyle = '#1f1a15';
    dialCtx.lineWidth = isMajor ? 5 : 2;
    dialCtx.beginPath();
    dialCtx.moveTo(256 + Math.cos(ang) * r0, 256 + Math.sin(ang) * r0);
    dialCtx.lineTo(256 + Math.cos(ang) * r1, 256 + Math.sin(ang) * r1);
    dialCtx.stroke();

    if (isMajor) {
      const val = i * 5;
      dialCtx.fillStyle = '#1f1a15';
      dialCtx.font = 'bold 28px monospace';
      dialCtx.textAlign = 'center';
      dialCtx.textBaseline = 'middle';
      dialCtx.fillText(String(val), 256 + Math.cos(ang) * 124, 256 + Math.sin(ang) * 124);
    }
  }
  dialCtx.fillStyle = '#3b2d1f';
  dialCtx.font = 'bold 26px serif';
  dialCtx.textAlign = 'center';
  dialCtx.fillText('BAR / PSI', 256, 336);
  dialCtx.font = '600 20px monospace';
  dialCtx.fillText('ENES-CORE', 256, 372);

  const steelAlbedo = finalizeTexture(steelC, true, maxAnisotropy, 1, 1);
  const steelBump = finalizeTexture(steelBC, false, maxAnisotropy, 1, 1);
  const copperAlbedo = finalizeTexture(copC, true, maxAnisotropy, 1, 1);
  const copperBump = finalizeTexture(copBC, false, maxAnisotropy, 1, 1);
  const siliconCircuit = finalizeTexture(pcbC, true, maxAnisotropy, 2, 2);
  const grateAlbedo = finalizeTexture(grateC, true, maxAnisotropy, 6, 12);
  const grateBump = finalizeTexture(grateBC, false, maxAnisotropy, 6, 12);
  const cryoIceAlbedo = finalizeTexture(iceC, true, maxAnisotropy, 4, 8);
  const canvasFabricAlbedo = finalizeTexture(fabC, true, maxAnisotropy, 2, 2);
  const manometerDial = finalizeTexture(dialC, true, maxAnisotropy, 1, 1);

  return {
    steelAlbedo,
    steelBump,
    copperAlbedo,
    copperBump,
    siliconCircuit,
    grateAlbedo,
    grateBump,
    cryoIceAlbedo,
    canvasFabricAlbedo,
    manometerDial,
    dispose: () => {
      steelAlbedo.dispose();
      steelBump.dispose();
      copperAlbedo.dispose();
      copperBump.dispose();
      siliconCircuit.dispose();
      grateAlbedo.dispose();
      grateBump.dispose();
      cryoIceAlbedo.dispose();
      canvasFabricAlbedo.dispose();
      manometerDial.dispose();
    },
  };
}
