import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { RepairKind } from './types';

export interface EnesRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  coolantLiquid: THREE.Mesh;
  backpackNeedle: THREE.Mesh;
  coilMat: THREE.MeshStandardMaterial;
  gauntletRingMat: THREE.MeshStandardMaterial;
  arcLine: THREE.Line;
}

export interface FirstPersonRig {
  root: THREE.Group;
  rightPivot: THREE.Group;
  leftPivot: THREE.Group;
  coilMat: THREE.MeshStandardMaterial;
  gauntletRingMat: THREE.MeshStandardMaterial;
  wristNeedle: THREE.Mesh;
  arcLine: THREE.Line;
}

export type AutomatonKind = 'sentinel' | 'cryoDrone' | 'foundryEnforcer' | 'rogueMainframe';

export interface AutomatonModel {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  deformableMesh: THREE.Mesh;
  basePositions: Float32Array;
  armorPlates: THREE.Mesh[];
  eyeMesh: THREE.Mesh;
  eyeMat: THREE.MeshStandardMaterial;
  shieldRing?: THREE.Mesh;
  leftLimb?: THREE.Group;
  rightLimb?: THREE.Group;
}

export interface RepairStationModel {
  root: THREE.Group;
  coverPlate?: THREE.Mesh;
  valveWheel?: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
  sparkOrigin: THREE.Vector3;
}

export function createMaterials(tex: ProceduralTextureSet, isSoftwareGl: boolean) {
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x8d959e,
    map: tex.steelAlbedo,
    bumpMap: tex.steelBump,
    bumpScale: 0.035,
    metalness: 0.86,
    roughness: 0.42,
  });

  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x3b414a,
    map: tex.steelAlbedo,
    bumpMap: tex.steelBump,
    bumpScale: 0.025,
    metalness: 0.82,
    roughness: 0.56,
  });

  const titaniumMat = new THREE.MeshPhysicalMaterial({
    color: 0xaab4bf,
    metalness: 0.94,
    roughness: 0.22,
    anisotropy: 0.75,
    clearcoat: 0.25,
  });

  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xd47a4a,
    map: tex.copperAlbedo,
    bumpMap: tex.copperBump,
    bumpScale: 0.02,
    metalness: 0.92,
    roughness: 0.26,
    anisotropy: 0.65,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc99c46,
    metalness: 0.88,
    roughness: 0.3,
  });

  const canvasApronMat = new THREE.MeshStandardMaterial({
    color: 0x30343a,
    map: tex.canvasFabricAlbedo,
    metalness: 0.06,
    roughness: 0.88,
  });

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x4b2f1d,
    metalness: 0.08,
    roughness: 0.78,
  });

  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.siliconCircuit,
    emissive: 0x1a535c,
    emissiveMap: tex.siliconCircuit,
    emissiveIntensity: 0.55,
    metalness: 0.45,
    roughness: 0.48,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6f3ff,
    metalness: 0.05,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.95,
    ior: 1.5,
    thickness: 0.2,
    depthWrite: false,
  });

  const manometerFaceMat = new THREE.MeshStandardMaterial({
    map: tex.manometerDial,
    roughness: 0.4,
    metalness: 0.1,
  });

  return {
    steelMat,
    darkIronMat,
    titaniumMat,
    copperMat,
    brassMat,
    canvasApronMat,
    leatherMat,
    pcbMat,
    glassMat,
    manometerFaceMat,
  };
}

function buildVoltMaulMesh(
  mats: ReturnType<typeof createMaterials>,
  coilMat: THREE.MeshStandardMaterial,
): { group: THREE.Group; arcLine: THREE.Line } {
  const group = new THREE.Group();

  // Oak & leather-wrapped handle
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.78, 10), mats.leatherMat);
  handle.position.y = 0.34;
  handle.castShadow = true;
  group.add(handle);

  // Brass pommel cap
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.06, 10), mats.brassMat);
  pommel.position.y = -0.04;
  group.add(pommel);

  // Forged steel hammer head (beveled profile via scaled octagon + end plates)
  const headCore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.36), mats.titaniumMat);
  headCore.position.y = 0.72;
  headCore.castShadow = true;
  group.add(headCore);

  // Striking face front
  const strikeFace = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 8), mats.steelMat);
  strikeFace.rotation.x = Math.PI / 2;
  strikeFace.position.set(0, 0.72, 0.19);
  group.add(strikeFace);

  // Rear chisel/crow-claw
  const rearSpike = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.14, 4), mats.darkIronMat);
  rearSpike.rotation.x = -Math.PI / 2;
  rearSpike.rotation.z = Math.PI / 4;
  rearSpike.position.set(0, 0.72, -0.22);
  group.add(rearSpike);

  // High-voltage copper induction coils wrapped around the hammer neck
  for (let i = 0; i < 3; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.016, 8, 18), coilMat);
    coil.position.set(0, 0.72, -0.07 + i * 0.07);
    group.add(coil);
  }

  // Diegetic electric arc line around coils
  const arcGeo = new THREE.BufferGeometry();
  const arcPts = new Float32Array(7 * 3);
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPts, 3));
  const arcMat = new THREE.LineBasicMaterial({ color: 0x7ce8ff, transparent: true, opacity: 0.9 });
  const arcLine = new THREE.Line(arcGeo, arcMat);
  arcLine.position.set(0, 0.72, 0.04);
  group.add(arcLine);

  return { group, arcLine };
}

function buildManometerAssembly(mats: ReturnType<typeof createMaterials>): {
  group: THREE.Group;
  needle: THREE.Mesh;
} {
  const group = new THREE.Group();

  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.036, 20), mats.brassMat);
  casing.rotation.x = Math.PI / 2;
  group.add(casing);

  const face = new THREE.Mesh(new THREE.CircleGeometry(0.082, 20), mats.manometerFaceMat);
  face.position.z = 0.019;
  group.add(face);

  // Pivot for needle
  const needleGeo = new THREE.BoxGeometry(0.009, 0.062, 0.005);
  needleGeo.translate(0, 0.024, 0);
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xc92a2a, roughness: 0.3, metalness: 0.2 });
  const needle = new THREE.Mesh(needleGeo, needleMat);
  needle.position.z = 0.022;
  group.add(needle);

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 10), mats.darkIronMat);
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.023;
  group.add(pin);

  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.086, 20), mats.glassMat);
  glass.position.z = 0.026;
  glass.renderOrder = 3;
  group.add(glass);

  return { group, needle };
}

export function buildEnesCharacter(
  tex: ProceduralTextureSet,
  isSoftwareGl: boolean,
): EnesRig {
  const mats = createMaterials(tex, isSoftwareGl);
  const root = new THREE.Group();

  const coilMat = new THREE.MeshStandardMaterial({
    color: 0xd9733a,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.4,
    metalness: 0.85,
    roughness: 0.25,
  });

  const gauntletRingMat = new THREE.MeshStandardMaterial({
    color: 0xd47a4a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
    metalness: 0.85,
    roughness: 0.25,
  });

  // Legs (grounded at y=0)
  const makeLeg = (xOffset: number) => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 0.82, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.72, 10), mats.canvasApronMat);
    thigh.position.y = -0.36;
    thigh.castShadow = true;
    leg.add(thigh);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.26), mats.darkIronMat);
    boot.position.set(0, -0.74, 0.04);
    boot.castShadow = true;
    leg.add(boot);
    return leg;
  };

  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  root.add(leftLeg, rightLeg);

  // Torso group
  const torso = new THREE.Group();
  torso.position.y = 0.84;
  root.add(torso);

  // Heavy dark grey canvas work apron
  const apronBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.78, 12), mats.canvasApronMat);
  apronBody.position.y = 0.28;
  apronBody.castShadow = true;
  torso.add(apronBody);

  // Forged titanium chest plate
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.26), mats.titaniumMat);
  chestPlate.position.set(0, 0.44, 0.03);
  chestPlate.castShadow = true;
  torso.add(chestPlate);

  // Leather tool belt + hanging wrench & energy vials
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.265, 0.1, 14), mats.leatherMat);
  belt.position.y = 0.06;
  torso.add(belt);

  const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.025), mats.steelMat);
  wrench.position.set(0.26, -0.02, 0.06);
  wrench.rotation.z = -0.15;
  torso.add(wrench);

  for (let i = 0; i < 2; i++) {
    const vial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.9 }),
    );
    vial.position.set(-0.26, 0.01, -0.04 + i * 0.09);
    torso.add(vial);
  }

  // Left shoulder forged copper pauldron
  const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mats.copperMat);
  pauldron.position.set(-0.31, 0.56, 0);
  pauldron.rotation.z = 0.42;
  torso.add(pauldron);

  // Back-mounted Steam-Plasma Generator
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.38, -0.22);
  torso.add(backpack);

  const boiler = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.18), mats.darkIronMat);
  boiler.castShadow = true;
  backpack.add(boiler);

  const copperPipe = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16, Math.PI), mats.copperMat);
  copperPipe.position.set(0, 0.22, 0);
  backpack.add(copperPipe);

  // Sloshing coolant glass cylinder
  const coolantTube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.28, 12), mats.glassMat);
  coolantTube.position.set(0.09, 0.02, -0.09);
  coolantTube.renderOrder = 2;
  backpack.add(coolantTube);

  const coolantLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.2, 10),
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    }),
  );
  coolantLiquid.position.set(0.09, -0.01, -0.09);
  backpack.add(coolantLiquid);

  // Diegetic Brass Pressure Manometer on backpack (facing camera in 3rd person!)
  const { group: manoGroup, needle: backpackNeedle } = buildManometerAssembly(mats);
  manoGroup.position.set(-0.08, 0.06, -0.11);
  manoGroup.rotation.y = Math.PI;
  backpack.add(manoGroup);

  // Head + Goggles
  const head = new THREE.Group();
  head.position.set(0, 0.76, 0);
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), mats.canvasApronMat);
  skull.castShadow = true;
  head.add(skull);

  const visorBand = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.156, 0.065, 14), mats.leatherMat);
  visorBand.position.y = 0.02;
  head.add(visorBand);

  for (const gx of [-0.055, 0.055]) {
    const goggle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 10), mats.brassMat);
    goggle.rotation.x = Math.PI / 2;
    goggle.position.set(gx, 0.02, 0.14);
    head.add(goggle);

    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.026, 10),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.8 }),
    );
    lens.position.set(gx, 0.02, 0.162);
    head.add(lens);
  }

  // Right Arm + The Volt-Maul
  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 0.52, 0);
  torso.add(rightArm);

  const rUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.5, 10), mats.canvasApronMat);
  rUpper.position.y = -0.22;
  rightArm.add(rUpper);

  const { group: maulGroup, arcLine } = buildVoltMaulMesh(mats, coilMat);
  maulGroup.position.set(0, -0.46, 0.08);
  maulGroup.rotation.x = Math.PI * 0.42;
  rightArm.add(maulGroup);

  // Left Arm + The Flux Gauntlet
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 0.52, 0);
  torso.add(leftArm);

  const lUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.28, 10), mats.canvasApronMat);
  lUpper.position.y = -0.14;
  leftArm.add(lUpper);

  const gauntletForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.078, 0.28, 10), mats.copperMat);
  gauntletForearm.position.y = -0.36;
  leftArm.add(gauntletForearm);

  const palmRing = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.015, 8, 16), gauntletRingMat);
  palmRing.rotation.x = Math.PI / 2;
  palmRing.position.set(0, -0.5, 0.02);
  leftArm.add(palmRing);

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    coolantLiquid,
    backpackNeedle,
    coilMat,
    gauntletRingMat,
    arcLine,
  };
}

export function buildFirstPersonRig(
  tex: ProceduralTextureSet,
  isSoftwareGl: boolean,
): FirstPersonRig {
  const mats = createMaterials(tex, isSoftwareGl);
  const root = new THREE.Group();

  const coilMat = new THREE.MeshStandardMaterial({
    color: 0xd9733a,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
    metalness: 0.88,
    roughness: 0.22,
  });

  const gauntletRingMat = new THREE.MeshStandardMaterial({
    color: 0xd47a4a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
    metalness: 0.88,
    roughness: 0.24,
  });

  // Right Hand: The Volt-Maul
  const rightPivot = new THREE.Group();
  rightPivot.position.set(0.36, -0.34, -0.54);
  root.add(rightPivot);

  const { group: maulGroup, arcLine } = buildVoltMaulMesh(mats, coilMat);
  maulGroup.rotation.set(-0.28, -0.15, 0.14);
  maulGroup.scale.setScalar(0.86);
  rightPivot.add(maulGroup);

  // Left Hand: The Flux Gauntlet + Diegetic Wrist Manometer
  const leftPivot = new THREE.Group();
  leftPivot.position.set(-0.36, -0.32, -0.52);
  root.add(leftPivot);

  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.34, 12), mats.copperMat);
  forearm.rotation.x = Math.PI * 0.46;
  forearm.position.set(0, -0.05, 0.06);
  leftPivot.add(forearm);

  const guardPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.22), mats.titaniumMat);
  guardPlate.rotation.x = -0.1;
  guardPlate.position.set(0.02, 0.055, 0.02);
  leftPivot.add(guardPlate);

  const emitterRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.014, 8, 18), gauntletRingMat);
  emitterRing.position.set(0.01, 0.02, -0.14);
  leftPivot.add(emitterRing);

  // Wrist-mounted brass manometer facing the player
  const { group: wristGauge, needle: wristNeedle } = buildManometerAssembly(mats);
  wristGauge.scale.setScalar(0.68);
  wristGauge.position.set(0.055, 0.095, 0.04);
  wristGauge.rotation.set(-0.32, 0.22, 0);
  leftPivot.add(wristGauge);

  return {
    root,
    rightPivot,
    leftPivot,
    coilMat,
    gauntletRingMat,
    wristNeedle,
    arcLine,
  };
}

export function buildAutomaton(
  kind: AutomatonKind,
  tex: ProceduralTextureSet,
  isSoftwareGl: boolean,
): AutomatonModel {
  const mats = createMaterials(tex, isSoftwareGl);
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isBoss = kind === 'rogueMainframe';
  const scale = isBoss ? 2.45 : kind === 'foundryEnforcer' ? 1.32 : kind === 'cryoDrone' ? 0.95 : 1.05;

  // Subdivided chassis box so vertex denting/deformation produces real physical dents!
  const chassisGeo = new THREE.BoxGeometry(0.9 * scale, 1.05 * scale, 0.72 * scale, 7, 7, 7);
  const basePositions = new Float32Array(chassisGeo.attributes.position.array);

  const chassisColor =
    kind === 'cryoDrone' ? 0x5c7c94 : kind === 'foundryEnforcer' ? 0x6b4532 : isBoss ? 0x2b2e35 : 0x555d66;

  const chassisMat = new THREE.MeshStandardMaterial({
    color: chassisColor,
    map: tex.steelAlbedo,
    bumpMap: tex.steelBump,
    bumpScale: 0.03,
    metalness: 0.85,
    roughness: 0.42,
  });

  const deformableMesh = new THREE.Mesh(chassisGeo, chassisMat);
  deformableMesh.position.y = (kind === 'cryoDrone' ? 1.55 : 1.1) * scale;
  deformableMesh.castShadow = true;
  deformableMesh.receiveShadow = true;
  bodyGroup.add(deformableMesh);

  // Pedestal legs or hover turbine
  if (kind === 'cryoDrone') {
    const hoverRing = new THREE.Mesh(new THREE.TorusGeometry(0.45 * scale, 0.07 * scale, 8, 16), mats.copperMat);
    hoverRing.rotation.x = Math.PI / 2;
    hoverRing.position.y = 0.85 * scale;
    bodyGroup.add(hoverRing);
  } else {
    const legGeo = new THREE.BoxGeometry(0.22 * scale, 0.62 * scale, 0.28 * scale);
    const lLeg = new THREE.Mesh(legGeo, mats.darkIronMat);
    lLeg.position.set(-0.26 * scale, 0.31 * scale, 0);
    lLeg.castShadow = true;
    const rLeg = new THREE.Mesh(legGeo, mats.darkIronMat);
    rLeg.position.set(0.26 * scale, 0.31 * scale, 0);
    rLeg.castShadow = true;
    bodyGroup.add(lLeg, rLeg);
  }

  // Optic sensor / core eye
  const eyeColor = kind === 'cryoDrone' ? 0x38bdf8 : isBoss ? 0xef4444 : 0xf59e0b;
  const eyeMat = new THREE.MeshStandardMaterial({
    color: eyeColor,
    emissive: eyeColor,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });
  const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 12, 10), eyeMat);
  eyeMesh.position.set(0, (kind === 'cryoDrone' ? 1.58 : 1.2) * scale, 0.36 * scale);
  bodyGroup.add(eyeMesh);

  // Bolted Detachable Armor Plates (can break off on hammer impact!)
  const armorPlates: THREE.Mesh[] = [];
  const plateOffsets: Array<[number, number, number, number]> = [
    [0.5 * scale, (kind === 'cryoDrone' ? 1.55 : 1.15) * scale, 0, 0.15],
    [-0.5 * scale, (kind === 'cryoDrone' ? 1.55 : 1.15) * scale, 0, -0.15],
    [0, (kind === 'cryoDrone' ? 1.88 : 1.48) * scale, 0.34 * scale, 0],
  ];
  if (isBoss) {
    plateOffsets.push([0, 1.0 * scale, 0.42 * scale, 0]);
  }

  for (const [px, py, pz, rz] of plateOffsets) {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.32 * scale, 0.48 * scale, 0.08 * scale),
      kind === 'foundryEnforcer' || isBoss ? mats.copperMat : mats.titaniumMat,
    );
    plate.position.set(px, py, pz);
    plate.rotation.z = rz;
    if (Math.abs(px) > 0.2 * scale) {
      plate.rotation.y = Math.PI / 2;
    }
    plate.castShadow = true;
    bodyGroup.add(plate);
    armorPlates.push(plate);
  }

  // Articulated arms for Enforcers & Rogue Mainframe Boss
  let leftLimb: THREE.Group | undefined;
  let rightLimb: THREE.Group | undefined;
  if (kind === 'foundryEnforcer' || isBoss) {
    leftLimb = new THREE.Group();
    leftLimb.position.set(-0.66 * scale, 1.35 * scale, 0);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.85 * scale, 0.24 * scale), mats.darkIronMat);
    lArmMesh.position.y = -0.32 * scale;
    lArmMesh.castShadow = true;
    leftLimb.add(lArmMesh);
    bodyGroup.add(leftLimb);

    rightLimb = new THREE.Group();
    rightLimb.position.set(0.66 * scale, 1.35 * scale, 0);
    const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.85 * scale, 0.24 * scale), mats.darkIronMat);
    rArmMesh.position.y = -0.32 * scale;
    rArmMesh.castShadow = true;
    rightLimb.add(rArmMesh);
    bodyGroup.add(rightLimb);
  }

  let shieldRing: THREE.Mesh | undefined;
  if (isBoss) {
    shieldRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.07, 10, 36),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 0.72,
      }),
    );
    shieldRing.rotation.x = Math.PI / 2;
    shieldRing.position.y = 2.6;
    root.add(shieldRing);
  }

  return {
    root,
    bodyGroup,
    deformableMesh,
    basePositions,
    armorPlates,
    eyeMesh,
    eyeMat,
    shieldRing,
    leftLimb,
    rightLimb,
  };
}

export function buildRepairStation(
  kind: RepairKind,
  tex: ProceduralTextureSet,
  isSoftwareGl: boolean,
): RepairStationModel {
  const mats = createMaterials(tex, isSoftwareGl);
  const root = new THREE.Group();

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });

  if (kind === 'valve') {
    const pipeVert = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.1, 12), mats.copperMat);
    pipeVert.position.y = 1.05;
    pipeVert.castShadow = true;
    root.add(pipeVert);

    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12), mats.brassMat);
    flange.position.y = 1.3;
    root.add(flange);

    const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 18), new THREE.MeshStandardMaterial({
      color: 0xb93829,
      metalness: 0.5,
      roughness: 0.45,
    }));
    valveWheel.position.set(0, 1.32, 0.28);
    root.add(valveWheel);

    const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.04, 0.03), mats.darkIronMat);
    valveWheel.add(spoke1);
    const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.54, 0.03), mats.darkIronMat);
    valveWheel.add(spoke2);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), beaconMat);
    beacon.position.set(0, 2.2, 0);
    root.add(beacon);

    return {
      root,
      valveWheel,
      beaconMat,
      sparkOrigin: new THREE.Vector3(0, 1.32, 0.3),
    };
  }

  if (kind === 'press') {
    // Press trigger console
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.25, 0.45), mats.darkIronMat);
    pedestal.position.y = 0.625;
    pedestal.castShadow = true;
    root.add(pedestal);

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), mats.copperMat);
    lever.position.set(0, 1.35, 0.1);
    lever.rotation.x = 0.4;
    root.add(lever);

    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.18), beaconMat);
    beacon.position.set(0, 1.32, -0.05);
    root.add(beacon);

    return {
      root,
      valveWheel: lever,
      beaconMat,
      sparkOrigin: new THREE.Vector3(0, 1.35, 0.1),
    };
  }

  // 'panel' or 'conduit'
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.75, 0.46), mats.steelMat);
  cabinet.position.y = 0.875;
  cabinet.castShadow = true;
  root.add(cabinet);

  const pcbBoard = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 0.06), mats.pcbMat);
  pcbBoard.position.set(0, 1.05, 0.22);
  root.add(pcbBoard);

  // Hinged cover plate (swings open during hands-on repair!)
  const coverPlate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.0, 0.05), mats.copperMat);
  coverPlate.position.set(0, 1.05, 0.27);
  coverPlate.castShadow = true;
  root.add(coverPlate);

  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), beaconMat);
  beacon.position.set(0, 1.84, 0);
  root.add(beacon);

  return {
    root,
    coverPlate,
    beaconMat,
    sparkOrigin: new THREE.Vector3(0, 1.08, 0.32),
  };
}
