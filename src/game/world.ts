import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import {
  AutomatonKind,
  AutomatonModel,
  RepairStationModel,
  buildAutomaton,
  buildRepairStation,
  createMaterials,
} from './models';
import { RepairKind, ZoneId } from './types';

export interface PlatformBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
  icy?: boolean;
}

export interface WallCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

export interface RepairNodeData {
  id: string;
  zoneId: ZoneId;
  kind: RepairKind;
  label: string;
  pos: THREE.Vector3;
  progress: number;
  repaired: boolean;
  model: RepairStationModel;
  linkedPressIndex?: number;
}

export interface GrappleAnchorData {
  pos: THREE.Vector3;
  mesh: THREE.Mesh;
}

export interface GrabbableData {
  id: string;
  label: string;
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  held: boolean;
  thrown: boolean;
  mass: number;
  radius: number;
  isEnemyProjectile?: boolean;
}

export interface HydraulicPressData {
  ramMesh: THREE.Mesh;
  anvilPos: THREE.Vector3;
  restY: number;
  slamTimer: number; // > 0 when slamming/retracting
  cooldown: number;
}

export interface EnemyEntityData {
  id: string;
  kind: AutomatonKind;
  zoneId: ZoneId;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
  hp: number;
  maxHp: number;
  stunTimer: number;
  attackTimer: number;
  defeated: boolean;
  homePos: THREE.Vector3;
  model: AutomatonModel;
  platesDetached: number;
  radius: number;
  shielded?: boolean;
}

export interface WorldData {
  platforms: PlatformBox[];
  walls: WallCollider[];
  repairs: RepairNodeData[];
  grappleAnchors: GrappleAnchorData[];
  grabbables: GrabbableData[];
  presses: HydraulicPressData[];
  enemies: EnemyEntityData[];
  rotatingTurbines: THREE.Object3D[];
  dataRings: THREE.Object3D[];
  teslaArcLines: Array<{ line: THREE.Line; a: THREE.Vector3; b: THREE.Vector3 }>;
  steamVents: Array<{ pos: THREE.Vector3; valveId: string }>;
  bossEntity: EnemyEntityData;
}

export function buildIndustrialWorld(
  scene: THREE.Scene,
  tex: ProceduralTextureSet,
  isSoftwareGl: boolean,
): WorldData {
  const mats = createMaterials(tex, isSoftwareGl);

  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x626b75,
    map: tex.grateAlbedo,
    bumpMap: tex.grateBump,
    bumpScale: 0.04,
    metalness: 0.78,
    roughness: 0.52,
  });

  const cryoFloorMat = new THREE.MeshPhysicalMaterial({
    color: 0x8ccbe6,
    map: tex.cryoIceAlbedo,
    metalness: 0.12,
    roughness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });

  const foundryMoltenMat = new THREE.MeshStandardMaterial({
    color: 0xff6a1a,
    emissive: 0xff4500,
    emissiveIntensity: 1.9,
    roughness: 0.3,
  });

  const platforms: PlatformBox[] = [];
  const walls: WallCollider[] = [];
  const repairs: RepairNodeData[] = [];
  const grappleAnchors: GrappleAnchorData[] = [];
  const grabbables: GrabbableData[] = [];
  const presses: HydraulicPressData[] = [];
  const enemies: EnemyEntityData[] = [];
  const rotatingTurbines: THREE.Object3D[] = [];
  const dataRings: THREE.Object3D[] = [];
  const teslaArcLines: Array<{ line: THREE.Line; a: THREE.Vector3; b: THREE.Vector3 }> = [];
  const steamVents: Array<{ pos: THREE.Vector3; valveId: string }> = [];

  const addFloor = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    mat: THREE.Material,
    icy = false,
  ) => {
    const thickness = 0.6;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), mat);
    mesh.position.set(x, y - thickness * 0.5, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    platforms.push({
      minX: x - w * 0.5,
      maxX: x + w * 0.5,
      minZ: z - d * 0.5,
      maxZ: z + d * 0.5,
      topY: y,
      icy,
    });
    return mesh;
  };

  const addWallBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    collide = true,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h * 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collide) {
      walls.push({
        minX: x - w * 0.5,
        maxX: x + w * 0.5,
        minZ: z - d * 0.5,
        maxZ: z + d * 0.5,
        minY: y,
        maxY: y + h,
      });
    }
    return mesh;
  };

  const addOverheadGrapplePipe = (x: number, y: number, z: number, spanX = 5.5) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, spanX, 12), mats.copperMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(x, y, z);
    scene.add(pipe);

    const anchorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.06, 8, 18),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        metalness: 0.7,
        roughness: 0.25,
      }),
    );
    anchorRing.rotation.y = Math.PI / 2;
    anchorRing.position.set(x, y, z);
    scene.add(anchorRing);
    grappleAnchors.push({ pos: new THREE.Vector3(x, y, z), mesh: anchorRing });
  };

  const addGrabbable = (
    id: string,
    label: string,
    x: number,
    y: number,
    z: number,
    kind: 'beam' | 'crate',
  ) => {
    const geo =
      kind === 'beam'
        ? new THREE.BoxGeometry(0.38, 0.34, 2.2)
        : new THREE.BoxGeometry(0.75, 0.75, 0.75);
    const mesh = new THREE.Mesh(geo, kind === 'beam' ? mats.titaniumMat : mats.copperMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    grabbables.push({
      id,
      label,
      mesh,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      held: false,
      thrown: false,
      mass: kind === 'beam' ? 1.4 : 1.0,
      radius: kind === 'beam' ? 0.8 : 0.55,
    });
  };

  const spawnEnemy = (
    id: string,
    kind: AutomatonKind,
    zoneId: ZoneId,
    x: number,
    y: number,
    z: number,
    hp: number,
  ): EnemyEntityData => {
    const model = buildAutomaton(kind, tex, isSoftwareGl);
    model.root.position.set(x, y, z);
    scene.add(model.root);
    const entity: EnemyEntityData = {
      id,
      kind,
      zoneId,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      rotY: 0,
      hp,
      maxHp: hp,
      stunTimer: 0,
      attackTimer: 1.5 + Math.random() * 1.5,
      defeated: false,
      homePos: new THREE.Vector3(x, y, z),
      model,
      platesDetached: 0,
      radius: kind === 'rogueMainframe' ? 2.1 : kind === 'foundryEnforcer' ? 1.05 : 0.78,
      shielded: kind === 'rogueMainframe',
    };
    enemies.push(entity);
    return entity;
  };

  // =========================================================================
  // ZONE 1: ANA GÜÇ İSTASYONU VE TÜRBİN SALONU (The Turbine Hall) Z: +10 to -34
  // =========================================================================
  addFloor(0, 0, -12, 22, 44, grateMat);
  // Elevated catwalk on left flank
  addFloor(-7.5, 3.4, -14, 4.5, 18, grateMat);
  addOverheadGrapplePipe(-7.5, 7.2, -10, 4.2);
  addOverheadGrapplePipe(0, 7.8, -22, 5.5);

  // Side walls & columns
  addWallBox(-11.5, 0, -12, 1, 11, 44, mats.darkIronMat);
  addWallBox(11.5, 0, -12, 1, 11, 44, mats.darkIronMat);
  addWallBox(0, 0, 10.5, 22, 11, 1, mats.darkIronMat); // Rear bulkhead behind spawn

  // Giant rotating copper & steel steam turbines
  for (const [tx, tz] of [
    [7.2, -6],
    [7.2, -20],
    [-7.8, -26],
  ]) {
    const turbine = new THREE.Group();
    turbine.position.set(tx, 3.6, tz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16), mats.copperMat);
    hub.rotation.z = Math.PI / 2;
    turbine.add(hub);
    for (let b = 0; b < 8; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 2.9), mats.steelMat);
      blade.rotation.x = (b / 8) * Math.PI * 2;
      turbine.add(blade);
    }
    scene.add(turbine);
    rotatingTurbines.push(turbine);

    // Overhead copper manifold pipes
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 18, 12), mats.copperMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 9.2, tz);
    scene.add(pipe);
  }

  // Zone 1 Repair Stations
  const z1Valve = buildRepairStation('valve', tex, isSoftwareGl);
  z1Valve.root.position.set(5.4, 0, -12);
  z1Valve.root.rotation.y = -Math.PI / 2;
  scene.add(z1Valve.root);
  repairs.push({
    id: 'z1_valve',
    zoneId: 'turbine',
    kind: 'valve',
    label: 'Ana Buhar Tahliye Vanası',
    pos: new THREE.Vector3(5.4, 0, -12),
    progress: 0,
    repaired: false,
    model: z1Valve,
  });
  steamVents.push({ pos: new THREE.Vector3(5.0, 1.3, -12), valveId: 'z1_valve' });

  const z1Panel = buildRepairStation('panel', tex, isSoftwareGl);
  z1Panel.root.position.set(-7.5, 3.4, -19);
  scene.add(z1Panel.root);
  repairs.push({
    id: 'z1_panel',
    zoneId: 'turbine',
    kind: 'panel',
    label: 'Türbin Dağıtım Panosu',
    pos: new THREE.Vector3(-7.5, 3.4, -19),
    progress: 0,
    repaired: false,
    model: z1Panel,
  });

  addGrabbable('z1_beam1', 'Çelik Kiriş', -2.8, 0.3, -8, 'beam');
  addGrabbable('z1_crate1', 'Bakır Sandık', 3.2, 0.45, -18, 'crate');
  spawnEnemy('z1_sen1', 'sentinel', 'turbine', -2.5, 0, -15, 100);
  spawnEnemy('z1_sen2', 'sentinel', 'turbine', 3.5, 0, -26, 110);

  // =========================================================================
  // ZONE 2: SOĞUTMA KULELERİ VE KRİYOJENİK MAHZEN (The Cryo-Vaults) Z: -34 to -68
  // =========================================================================
  addFloor(0, 0, -51, 22, 34, cryoFloorMat, true);
  addWallBox(-11.5, 0, -51, 1, 11, 34, mats.steelMat);
  addWallBox(11.5, 0, -51, 1, 11, 34, mats.steelMat);

  // Cryo liquid nitrogen glass columns
  for (const [cx, cz] of [
    [-7.5, -43],
    [7.5, -43],
    [-7.5, -59],
    [7.5, -59],
  ]) {
    addWallBox(cx, 0, cz, 2.2, 0.9, 2.2, mats.darkIronMat);
    const cryoCol = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 8.2, 16), mats.glassMat);
    cryoCol.position.set(cx, 5.0, cz);
    scene.add(cryoCol);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 7.8, 12),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }),
    );
    core.position.set(cx, 5.0, cz);
    scene.add(core);
  }
  addOverheadGrapplePipe(0, 7.6, -50, 6);

  const z2Valve = buildRepairStation('valve', tex, isSoftwareGl);
  z2Valve.root.position.set(-5.2, 0, -52);
  z2Valve.root.rotation.y = Math.PI / 2;
  scene.add(z2Valve.root);
  repairs.push({
    id: 'z2_valve',
    zoneId: 'cryo',
    kind: 'valve',
    label: 'Sıvı Azot Soğutma Vanası',
    pos: new THREE.Vector3(-5.2, 0, -52),
    progress: 0,
    repaired: false,
    model: z2Valve,
  });
  steamVents.push({ pos: new THREE.Vector3(-4.8, 1.3, -52), valveId: 'z2_valve' });

  addGrabbable('z2_crate1', 'Kriyo Konteyner', 3.4, 0.45, -46, 'crate');
  spawnEnemy('z2_drone1', 'cryoDrone', 'cryo', -3, 0, -48, 95);
  spawnEnemy('z2_drone2', 'cryoDrone', 'cryo', 3.5, 0, -60, 105);

  // =========================================================================
  // ZONE 3: SİLİKON VE DEVRE DÖKÜMHANESİ (The Silicon Foundry) Z: -68 to -104
  // =========================================================================
  addFloor(0, 0, -86, 24, 36, grateMat);
  addWallBox(-12.5, 0, -86, 1, 12, 36, mats.darkIronMat);
  addWallBox(12.5, 0, -86, 1, 12, 36, mats.darkIronMat);

  // Molten silicon crucibles along sides
  for (const sx of [-9.5, 9.5]) {
    const vat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 18), mats.darkIronMat);
    vat.position.set(sx, 0.55, -86);
    scene.add(vat);
    const molten = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 17), foundryMoltenMat);
    molten.position.set(sx, 1.05, -86);
    scene.add(molten);
  }

  // Two Interactive Hydraulic Stamping Presses!
  const pressCoords: Array<[number, number, string, string]> = [
    [-3.2, -82, 'z3_press1', '1. Hidrolik Döküm Presi'],
    [3.2, -93, 'z3_press2', '2. Hidrolik Döküm Presi'],
  ];

  pressCoords.forEach(([px, pz, pid, plabel], idx) => {
    // Press frame pillars
    addWallBox(px - 2.1, 0, pz, 0.45, 7.5, 0.8, mats.darkIronMat, false);
    addWallBox(px + 2.1, 0, pz, 0.45, 7.5, 0.8, mats.darkIronMat, false);
    const beamTop = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.8, 1.2), mats.steelMat);
    beamTop.position.set(px, 7.5, pz);
    scene.add(beamTop);

    const ramMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 2.8), mats.copperMat);
    ramMesh.position.set(px, 5.4, pz);
    ramMesh.castShadow = true;
    scene.add(ramMesh);

    presses.push({
      ramMesh,
      anvilPos: new THREE.Vector3(px, 0, pz),
      restY: 5.4,
      slamTimer: 0,
      cooldown: 0,
    });

    const pressConsole = buildRepairStation('press', tex, isSoftwareGl);
    pressConsole.root.position.set(px + (idx === 0 ? -3.4 : 3.4), 0, pz + 2.0);
    scene.add(pressConsole.root);
    repairs.push({
      id: pid,
      zoneId: 'foundry',
      kind: 'press',
      label: plabel,
      pos: pressConsole.root.position.clone(),
      progress: 0,
      repaired: false,
      model: pressConsole,
      linkedPressIndex: idx,
    });
  });

  addGrabbable('z3_beam1', 'Ağır Döküm Kirişi', 0, 0.3, -76, 'beam');
  addGrabbable('z3_beam2', 'Çelik Travers', -2.4, 0.3, -89, 'beam');
  spawnEnemy('z3_enf1', 'foundryEnforcer', 'foundry', -2.8, 0, -82, 155);
  spawnEnemy('z3_enf2', 'foundryEnforcer', 'foundry', 3.0, 0, -93, 165);

  // =========================================================================
  // ZONE 4: YÜKSEK VOLTAJ İLETİM KÖPRÜLERİ (The Tesla Viaduct) Z: -104 to -142
  // =========================================================================
  // Viaduct split across a chasm with a jump/grapple gap from Z: -120 to -126!
  addFloor(0, 0, -112, 9.5, 16, grateMat);
  addFloor(0, 0, -134, 9.5, 16, grateMat);
  // Side safety girder curbs (low)
  addWallBox(-4.6, 0, -112, 0.4, 0.9, 16, mats.steelMat);
  addWallBox(4.6, 0, -112, 0.4, 0.9, 16, mats.steelMat);
  addWallBox(-4.6, 0, -134, 0.4, 0.9, 16, mats.steelMat);
  addWallBox(4.6, 0, -134, 0.4, 0.9, 16, mats.steelMat);

  // Overhead grapple pipes spanning the broken chasm!
  addOverheadGrapplePipe(0, 6.4, -123, 6.2);
  addOverheadGrapplePipe(0, 6.8, -134, 6.2);

  // 6 Towering Copper Tesla Coils flanking the abyss
  const coilPositions: Array<[number, number]> = [
    [-7.5, -112],
    [7.5, -112],
    [-7.5, -123],
    [7.5, -123],
    [-7.5, -134],
    [7.5, -134],
  ];
  coilPositions.forEach(([tx, tz]) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 2.2, 12), mats.darkIronMat);
    base.position.set(tx, -1.5, tz);
    scene.add(base);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.65, 8.8, 14), mats.copperMat);
    tower.position.set(tx, 3.8, tz);
    scene.add(tower);

    const toroid = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.28, 10, 22), mats.titaniumMat);
    toroid.rotation.x = Math.PI / 2;
    toroid.position.set(tx, 8.3, tz);
    scene.add(toroid);
  });

  // Live jagged Tesla arcs between left & right coils
  for (const az of [-112, -123, -134]) {
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    const arcMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    scene.add(arcLine);
    teslaArcLines.push({
      line: arcLine,
      a: new THREE.Vector3(-6.4, 8.3, az),
      b: new THREE.Vector3(6.4, 8.3, az),
    });
  }

  const z4Panel = buildRepairStation('panel', tex, isSoftwareGl);
  z4Panel.root.position.set(3.4, 0, -133);
  z4Panel.root.rotation.y = -Math.PI / 2;
  scene.add(z4Panel.root);
  repairs.push({
    id: 'z4_panel',
    zoneId: 'tesla',
    kind: 'panel',
    label: 'Köprü Voltaj Regülatörü',
    pos: new THREE.Vector3(3.4, 0, -133),
    progress: 0,
    repaired: false,
    model: z4Panel,
  });

  spawnEnemy('z4_drone1', 'cryoDrone', 'tesla', 0, 0, -131, 115);

  // =========================================================================
  // ZONE 5: ÇEKİRDEK KOMUTA MERKEZİ (The Sovereign Core) Z: -142 to -188
  // =========================================================================
  addFloor(0, 0, -165, 32, 46, grateMat);
  addWallBox(-16.5, 0, -165, 1, 14, 46, mats.darkIronMat);
  addWallBox(16.5, 0, -165, 1, 14, 46, mats.darkIronMat);
  addWallBox(0, 0, -188.5, 32, 14, 1, mats.darkIronMat);

  // 3 Giant Rotating Data-Platter Rings overhead
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.5 + r * 2.6, 0.24, 10, 48),
      r % 2 === 0 ? mats.copperMat : mats.pcbMat,
    );
    ring.position.set(0, 7.5 + r * 1.1, -168);
    ring.rotation.x = Math.PI * 0.32 + r * 0.25;
    scene.add(ring);
    dataRings.push(ring);
  }

  addOverheadGrapplePipe(-7.5, 7.4, -162, 5.2);
  addOverheadGrapplePipe(7.5, 7.4, -162, 5.2);

  // Two Shield Overload Conduits flanking the Sovereign Core arena
  const z5ConduitL = buildRepairStation('conduit', tex, isSoftwareGl);
  z5ConduitL.root.position.set(-10.5, 0, -162);
  z5ConduitL.root.rotation.y = Math.PI / 2;
  scene.add(z5ConduitL.root);
  repairs.push({
    id: 'z5_conduit_l',
    zoneId: 'core',
    kind: 'conduit',
    label: 'Sol Kalkan İletim Hattı',
    pos: new THREE.Vector3(-10.5, 0, -162),
    progress: 0,
    repaired: false,
    model: z5ConduitL,
  });

  const z5ConduitR = buildRepairStation('conduit', tex, isSoftwareGl);
  z5ConduitR.root.position.set(10.5, 0, -162);
  z5ConduitR.root.rotation.y = -Math.PI / 2;
  scene.add(z5ConduitR.root);
  repairs.push({
    id: 'z5_conduit_r',
    zoneId: 'core',
    kind: 'conduit',
    label: 'Sağ Kalkan İletim Hattı',
    pos: new THREE.Vector3(10.5, 0, -162),
    progress: 0,
    repaired: false,
    model: z5ConduitR,
  });

  addGrabbable('z5_beam1', 'Çekirdek Kirişi', -6.5, 0.3, -155, 'beam');
  addGrabbable('z5_beam2', 'Titanyum Kiriş', 6.5, 0.3, -155, 'beam');
  addGrabbable('z5_crate1', 'Yedek Güç Hücresi', 0, 0.45, -153, 'crate');

  // The Rogue Mainframe Boss!
  const bossEntity = spawnEnemy('z5_boss', 'rogueMainframe', 'core', 0, 0, -172, 420);

  return {
    platforms,
    walls,
    repairs,
    grappleAnchors,
    grabbables,
    presses,
    enemies,
    rotatingTurbines,
    dataRings,
    teslaArcLines,
    steamVents,
    bossEntity,
  };
}
