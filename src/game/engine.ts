import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WorkshopAudioEngine } from './audio';
import {
  EnesRig,
  FirstPersonRig,
  buildEnesCharacter,
  buildFirstPersonRig,
} from './models';
import { ProceduralTextureSet, createProceduralTextures } from './textures';
import { CameraMode, GameSnapshot, ZONES, ZoneId } from './types';
import {
  EnemyEntityData,
  GrabbableData,
  RepairNodeData,
  WorldData,
  buildIndustrialWorld,
} from './world';

// Pre-allocated scratch math helpers (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

interface ParticleSlot {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  kind: 'spark' | 'steam' | 'cryo';
}

export class EnesCoreEngine {
  private container: HTMLElement;
  private onSnapshot: (snap: GameSnapshot) => void;
  private onContextLostCb: () => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  private tex!: ProceduralTextureSet;
  private audio = new WorkshopAudioEngine();
  private world!: WorldData;
  private enesRig!: EnesRig;
  private fpRig!: FirstPersonRig;

  private grappleLine!: THREE.Line;
  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];

  private zoneKeyLight!: THREE.DirectionalLight;
  private zonePointLight!: THREE.PointLight;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Player state
  private started = false;
  private cameraMode: CameraMode = 'first';
  private playerPos = new THREE.Vector3(0, 0, 2);
  private playerVel = new THREE.Vector3();
  private yaw = 0;
  private pitch = -0.05;
  private grounded = true;
  private onIce = false;
  private crouching = false;
  private health = 100;
  private maxHealth = 100;
  private voltage = 1.0; // 0..1 Volt-Maul charge
  private notebookOpen = false;
  private pointerLocked = false;
  private draggingLook = false;

  // Action timers
  private swingTimer = 0;
  private swingHitApplied = false;
  private hitstopTimer = 0;
  private slamPending = false;
  private grappleTarget: THREE.Vector3 | null = null;
  private grappleTimer = 0;
  private heldObject: GrabbableData | null = null;
  private gauntletPulse = 0;
  private damageFlash = 0;
  private lastSnapshotTime = 0;
  private steamEmitTimer = 0;
  private currentZone: ZoneId = 'turbine';
  private victory = false;
  private playerDefeated = false;

  private keys: Record<string, boolean> = {};

  constructor(
    container: HTMLElement,
    onSnapshot: (snap: GameSnapshot) => void,
    onContextLost: () => void,
  ) {
    this.container = container;
    this.onSnapshot = onSnapshot;
    this.onContextLostCb = onContextLost;
    this.init();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private init(): void {
    this.isSoftwareGl = this.detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLostCb();
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1015);
    this.scene.fog = new THREE.FogExp2(0x0d1015, 0.017);

    // Mandatory studio environment map via PMREMGenerator + RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.1, 220);
    this.scene.add(this.camera);

    // Warm/cool 3-point industrial lighting rig
    const hemi = new THREE.HemisphereLight(0x88b4d8, 0x3b2a1e, 0.72);
    this.scene.add(hemi);

    this.zoneKeyLight = new THREE.DirectionalLight(0xffe1b8, 1.55);
    this.zoneKeyLight.position.set(12, 24, 10);
    this.zoneKeyLight.castShadow = !this.isSoftwareGl;
    this.zoneKeyLight.shadow.mapSize.set(1024, 1024);
    this.zoneKeyLight.shadow.camera.near = 1;
    this.zoneKeyLight.shadow.camera.far = 75;
    this.zoneKeyLight.shadow.camera.left = -22;
    this.zoneKeyLight.shadow.camera.right = 22;
    this.zoneKeyLight.shadow.camera.top = 22;
    this.zoneKeyLight.shadow.camera.bottom = -22;
    this.zoneKeyLight.shadow.bias = -0.0005;
    this.zoneKeyLight.shadow.normalBias = 0.02;
    this.scene.add(this.zoneKeyLight);
    this.scene.add(this.zoneKeyLight.target);

    const rimLight = new THREE.DirectionalLight(0x7cc4fa, 0.65);
    rimLight.position.set(-14, 12, -20);
    this.scene.add(rimLight);

    this.zonePointLight = new THREE.PointLight(0xff9b42, 3.2, 26, 1.5);
    this.zonePointLight.position.set(0, 5, 0);
    this.scene.add(this.zonePointLight);

    // Procedural PBR textures
    this.tex = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // Build 5 seamless zones
    this.world = buildIndustrialWorld(this.scene, this.tex, this.isSoftwareGl);

    // Build Enes character (3rd person) & First-Person Rig
    this.enesRig = buildEnesCharacter(this.tex, this.isSoftwareGl);
    this.enesRig.root.visible = false;
    this.scene.add(this.enesRig.root);

    this.fpRig = buildFirstPersonRig(this.tex, this.isSoftwareGl);
    this.camera.add(this.fpRig.root);

    // Grapple energy tether line
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.grappleLine = new THREE.Line(
      gGeo,
      new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95 }),
    );
    this.grappleLine.visible = false;
    this.grappleLine.frustumCulled = false;
    this.scene.add(this.grappleLine);

    // Instanced Particle Pool (sparks, steam, cryo mist)
    const pCount = 90;
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.11, 0.11, 0.11),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      pCount,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    for (let i = 0; i < pCount; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        kind: 'spark',
      });
      _mat4.makeTranslation(0, -100, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.setHex(0xfbbf24));
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitSnapshot();
    this.tick();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitSnapshot();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (!this.started) return;

    if (e.code === 'Tab' || e.code === 'KeyN') {
      e.preventDefault();
      this.toggleNotebook();
      return;
    }

    if (this.notebookOpen || this.victory || this.playerDefeated) return;

    if (e.code === 'KeyV') {
      this.toggleCameraMode();
    } else if (e.code === 'KeyC') {
      this.crouching = !this.crouching;
    } else if (e.code === 'KeyQ') {
      this.triggerGrapple();
    } else if (e.code === 'KeyF') {
      this.triggerFluxGauntlet();
    } else if (e.code === 'KeyJ') {
      this.triggerVoltMaulSwing();
    } else if (e.code === 'Space' && this.grounded) {
      this.playerVel.y = 8.4;
      this.grounded = false;
      this.crouching = false;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.started || this.notebookOpen || this.victory || this.playerDefeated) return;
    this.audio.init();

    // Try pointer lock on canvas click for crisp FPS mouse look
    if (!this.pointerLocked && document.pointerLockElement !== this.renderer.domElement) {
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch {
        // Fallback drag look still works seamlessly
      }
    }

    if (e.button === 0) {
      this.draggingLook = true;
      this.triggerVoltMaulSwing();
    } else if (e.button === 2) {
      this.triggerFluxGauntlet();
    }
  };

  private handleMouseUp = (): void => {
    this.draggingLook = false;
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.started || this.notebookOpen || this.victory || this.playerDefeated) return;
    if (this.pointerLocked || this.draggingLook) {
      const sens = 0.0024;
      this.yaw -= e.movementX * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sens, -1.22, 1.22);
    }
  };

  public startGame(): void {
    this.audio.init();
    this.started = true;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignore if iframe restricts pointer lock
    }
    this.emitSnapshot();
  }

  public toggleCameraMode(): void {
    this.cameraMode = this.cameraMode === 'first' ? 'third' : 'first';
    this.fpRig.root.visible = this.cameraMode === 'first';
    this.enesRig.root.visible = this.cameraMode === 'third';
    this.emitSnapshot();
  }

  public toggleNotebook(): void {
    this.notebookOpen = !this.notebookOpen;
    if (this.notebookOpen && this.pointerLocked) {
      document.exitPointerLock?.();
    }
    this.emitSnapshot();
  }

  public toggleMute(): void {
    this.audio.init();
    this.audio.setMuted(!this.audio.isMuted());
    this.emitSnapshot();
  }

  public warpToZone(zoneId: ZoneId): void {
    const z = ZONES.find((item) => item.id === zoneId);
    if (!z) return;
    this.playerPos.set(z.spawnPos[0], z.spawnPos[1], z.spawnPos[2]);
    this.playerVel.set(0, 0, 0);
    this.grappleTarget = null;
    this.notebookOpen = false;
    this.currentZone = zoneId;
    this.emitSnapshot();
  }

  public restartMission(): void {
    this.health = this.maxHealth;
    this.voltage = 1.0;
    this.playerDefeated = false;
    this.victory = false;
    this.heldObject = null;
    this.grappleTarget = null;
    this.playerPos.set(0, 0, 2);
    this.playerVel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.05;
    this.world.enemies.forEach((e) => {
      e.hp = e.maxHp;
      e.defeated = false;
      e.pos.copy(e.homePos);
      e.model.root.position.copy(e.homePos);
      e.model.root.visible = true;
      e.model.bodyGroup.rotation.set(0, 0, 0);
      e.shielded = e.kind === 'rogueMainframe';
      if (e.model.shieldRing) e.model.shieldRing.visible = true;
      // Restore geometry vertices
      const posAttr = e.model.deformableMesh.geometry.attributes.position as THREE.BufferAttribute;
      posAttr.array.set(e.model.basePositions);
      posAttr.needsUpdate = true;
      e.model.deformableMesh.geometry.computeVertexNormals();
      e.model.armorPlates.forEach((p) => (p.visible = true));
      e.platesDetached = 0;
    });
    this.emitSnapshot();
  }

  private getLookForward(out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();
    return out;
  }

  private triggerVoltMaulSwing(): void {
    if (this.swingTimer > 0) return;
    this.swingTimer = 0.38;
    this.swingHitApplied = false;
    this.audio.playHammerSwing();
  }

  private triggerGrapple(): void {
    if (this.voltage < 0.2) return;
    const forward = this.getLookForward(_v1);
    const eyePos = _v2.set(this.playerPos.x, this.playerPos.y + 1.55, this.playerPos.z);

    let bestAnchor: THREE.Vector3 | null = null;
    let bestScore = -Infinity;

    for (const anchor of this.world.grappleAnchors) {
      const toAnchor = _v3.subVectors(anchor.pos, eyePos);
      const dist = toAnchor.length();
      if (dist > 28 || dist < 2.2) continue;
      const dot = toAnchor.normalize().dot(forward);
      if (dot > 0.55) {
        const score = dot * 20 - dist * 0.25;
        if (score > bestScore) {
          bestScore = score;
          bestAnchor = anchor.pos;
        }
      }
    }

    if (bestAnchor) {
      this.grappleTarget = bestAnchor.clone();
      this.grappleTimer = 0.62;
      this.grounded = false;
      this.slamPending = true;
      this.voltage = Math.max(0, this.voltage - 0.16);
      this.audio.playGrappleZip();
    }
  }

  private triggerFluxGauntlet(): void {
    this.gauntletPulse = 0.35;
    const forward = this.getLookForward(_v1);
    const eyePos = _v2.set(this.playerPos.x, this.playerPos.y + 1.55, this.playerPos.z);

    if (this.heldObject) {
      // Hurl held metal object at high velocity!
      const obj = this.heldObject;
      obj.held = false;
      obj.thrown = true;
      obj.isEnemyProjectile = false;
      obj.vel.copy(forward).multiplyScalar(32);
      obj.vel.y += 2.2;
      obj.angVel.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      this.heldObject = null;
      this.voltage = Math.max(0, this.voltage - 0.12);
      this.audio.playFluxThrow();
      return;
    }

    // Find nearest grabbable in front of Enes
    let best: GrabbableData | null = null;
    let bestScore = -Infinity;
    for (const g of this.world.grabbables) {
      if (g.held) continue;
      const toObj = _v3.subVectors(g.mesh.position, eyePos);
      const dist = toObj.length();
      if (dist > 18) continue;
      const dot = toObj.normalize().dot(forward);
      if (dot > 0.65) {
        const score = dot * 15 - dist * 0.3;
        if (score > bestScore) {
          bestScore = score;
          best = g;
        }
      }
    }

    if (best) {
      best.held = true;
      best.thrown = false;
      best.vel.set(0, 0, 0);
      this.heldObject = best;
      this.audio.playFluxPull();
    }
  }

  private spawnParticles(
    origin: THREE.Vector3,
    count: number,
    kind: 'spark' | 'steam' | 'cryo',
    speed = 5,
  ): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.kind = kind;
      p.pos.copy(origin);
      p.pos.x += (Math.random() - 0.5) * 0.3;
      p.pos.y += (Math.random() - 0.5) * 0.3;
      p.pos.z += (Math.random() - 0.5) * 0.3;
      if (kind === 'spark') {
        p.vel.set((Math.random() - 0.5) * speed * 2, Math.random() * speed + 1.5, (Math.random() - 0.5) * speed * 2);
        p.maxLife = 0.25 + Math.random() * 0.35;
        p.size = 0.65 + Math.random() * 0.6;
      } else {
        p.vel.set((Math.random() - 0.5) * 1.4, 2.2 + Math.random() * 2.4, (Math.random() - 0.5) * 1.4);
        p.maxLife = 0.65 + Math.random() * 0.45;
        p.size = 1.6 + Math.random() * 1.4;
      }
      p.life = p.maxLife;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private deformAutomatonMesh(enemy: EnemyEntityData, worldHitPos: THREE.Vector3, depth = 0.24): void {
    const mesh = enemy.model.deformableMesh;
    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const localHit = _v3.copy(worldHitPos);
    mesh.worldToLocal(localHit);

    const radius = enemy.kind === 'rogueMainframe' ? 1.15 : 0.62;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const dx = vx - localHit.x;
      const dy = vy - localHit.y;
      const dz = vz - localHit.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < radius * radius) {
        const factor = (1 - Math.sqrt(dSq) / radius) * depth;
        // Dent inward toward chassis center (0,0,0)
        const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        posAttr.setXYZ(i, vx - (vx / len) * factor, vy - (vy / len) * factor, vz - (vz / len) * factor);
      }
    }
    posAttr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  private detachArmorPlate(enemy: EnemyEntityData, impulseDir: THREE.Vector3): void {
    const idx = enemy.platesDetached;
    if (idx >= enemy.model.armorPlates.length) return;
    const plate = enemy.model.armorPlates[idx];
    if (!plate.visible) return;

    const worldPos = new THREE.Vector3();
    plate.getWorldPosition(worldPos);
    plate.visible = false;
    enemy.platesDetached++;

    // Spawn real physical debris piece that can also be grabbed with Flux Gauntlet!
    const debrisGeo = new THREE.BoxGeometry(0.42, 0.52, 0.1);
    const debrisMat = (plate.material as THREE.Material).clone();
    const debris = new THREE.Mesh(debrisGeo, debrisMat);
    debris.position.copy(worldPos);
    debris.castShadow = true;
    this.scene.add(debris);

    this.world.grabbables.push({
      id: `debris_${enemy.id}_${idx}_${Date.now()}`,
      label: 'Kopmuş Zırh Plakası',
      mesh: debris,
      vel: new THREE.Vector3(
        impulseDir.x * 5 + (Math.random() - 0.5) * 4,
        4.2 + Math.random() * 2.5,
        impulseDir.z * 5 + (Math.random() - 0.5) * 4,
      ),
      angVel: new THREE.Vector3(6, 8, 5),
      held: false,
      thrown: false,
      mass: 0.75,
      radius: 0.45,
    });
  }

  private damageEnemy(enemy: EnemyEntityData, dmg: number, hitPos: THREE.Vector3, dir: THREE.Vector3, heavy: boolean): void {
    if (enemy.defeated) return;

    if (enemy.shielded) {
      // Rogue Mainframe shield reduces damage until both Zone 5 conduits are welded/overloaded
      dmg *= 0.22;
      this.spawnParticles(hitPos, 10, 'cryo', 6);
    } else {
      this.spawnParticles(hitPos, heavy ? 22 : 14, 'spark', heavy ? 8 : 5.5);
    }

    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.stunTimer = heavy ? 1.15 : 0.55;
    enemy.vel.addScaledVector(dir, heavy ? 7.5 : 4.2);

    this.deformAutomatonMesh(enemy, hitPos, heavy ? 0.34 : 0.2);
    if (enemy.hp < enemy.maxHp * 0.75 && enemy.platesDetached === 0) {
      this.detachArmorPlate(enemy, dir);
    } else if (enemy.hp < enemy.maxHp * 0.4 && enemy.platesDetached <= 1) {
      this.detachArmorPlate(enemy, dir);
    }

    this.audio.playHammerClang(heavy);
    this.hitstopTimer = heavy ? 0.055 : 0.028;

    if (enemy.hp <= 0) {
      enemy.defeated = true;
      this.detachArmorPlate(enemy, dir);
      this.spawnParticles(enemy.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 26, 'spark', 9);
      enemy.model.eyeMat.emissiveIntensity = 0;
      if (enemy.kind === 'rogueMainframe') {
        this.victory = true;
        this.audio.playRepairComplete();
      }
    }
  }

  private activateHydraulicPress(pressIdx: number): void {
    const press = this.world.presses[pressIdx];
    if (!press || press.slamTimer > 0 || press.cooldown > 0) return;
    press.slamTimer = 1.6;
    press.cooldown = 3.0;
    this.audio.playSteamBurst();
  }

  private applyHammerImpact(heavySlam: boolean): void {
    const forward = this.getLookForward(_v1);
    const origin = _v2.set(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);
    const reach = heavySlam ? 4.8 : 3.4;

    let hitSomething = false;

    for (const enemy of this.world.enemies) {
      if (enemy.defeated) continue;
      const toEnemy = _v3.subVectors(enemy.pos, this.playerPos);
      const dist = toEnemy.length();
      if (dist <= reach + enemy.radius) {
        const dot = dist < 1.2 ? 1 : toEnemy.normalize().dot(forward);
        if (heavySlam || dot > 0.35) {
          const hitPoint = enemy.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
          const dmg = (heavySlam ? 72 : 38) * (0.65 + this.voltage * 0.55);
          this.damageEnemy(enemy, dmg, hitPoint, forward, heavySlam);
          this.voltage = Math.max(0.12, this.voltage - (heavySlam ? 0.25 : 0.1));
          hitSomething = true;
        }
      }
    }

    // Check if hammer hit a hydraulic press console or loose metal crate!
    for (const rep of this.world.repairs) {
      if (rep.kind === 'press' && rep.linkedPressIndex !== undefined) {
        if (rep.pos.distanceTo(this.playerPos) < 3.4) {
          this.activateHydraulicPress(rep.linkedPressIndex);
          this.audio.playHammerClang(true);
          this.spawnParticles(rep.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 14, 'spark', 6);
          hitSomething = true;
        }
      }
    }

    for (const g of this.world.grabbables) {
      if (g.held) continue;
      if (g.mesh.position.distanceTo(origin) < reach) {
        g.vel.copy(forward).multiplyScalar(16);
        g.vel.y += 4;
        g.thrown = true;
        this.audio.playHammerClang(false);
        this.spawnParticles(g.mesh.position, 10, 'spark', 5);
        hitSomething = true;
      }
    }

    if (heavySlam && !hitSomething) {
      this.audio.playHammerClang(true);
      this.spawnParticles(this.playerPos, 18, 'spark', 7);
    }
  }

  private getFloorHeightAt(x: number, z: number, currentY: number): { y: number; icy: boolean } {
    let bestY = -40;
    let icy = false;
    for (const p of this.world.platforms) {
      if (x >= p.minX - 0.35 && x <= p.maxX + 0.35 && z >= p.minZ - 0.35 && z <= p.maxZ + 0.35) {
        if (p.topY <= currentY + 1.15 && p.topY > bestY) {
          bestY = p.topY;
          icy = Boolean(p.icy);
        }
      }
    }
    return { y: bestY, icy };
  }

  private resolveWalls(pos: THREE.Vector3): void {
    const r = 0.48;
    for (const w of this.world.walls) {
      if (pos.y + 1.6 < w.minY || pos.y > w.maxY) continue;
      if (pos.x + r > w.minX && pos.x - r < w.maxX && pos.z + r > w.minZ && pos.z - r < w.maxZ) {
        const dx1 = Math.abs(pos.x + r - w.minX);
        const dx2 = Math.abs(w.maxX - (pos.x - r));
        const dz1 = Math.abs(pos.z + r - w.minZ);
        const dz2 = Math.abs(w.maxZ - (pos.z - r));
        const m = Math.min(dx1, dx2, dz1, dz2);
        if (m === dx1) pos.x = w.minX - r;
        else if (m === dx2) pos.x = w.maxX + r;
        else if (m === dz1) pos.z = w.minZ - r;
        else pos.z = w.maxZ + r;
      }
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= rawDt;
      this.renderer.render(this.scene, this.camera);
      this.scheduleNextFrame();
      return;
    }

    const dt = rawDt;

    if (this.started && !this.notebookOpen && !this.victory && !this.playerDefeated) {
      this.updatePlayer(dt, elapsed);
      this.updateRepairs(dt);
      this.updateEnemies(dt, elapsed);
      this.updateGrabbables(dt);
      this.updatePresses(dt);
    }

    this.updateEnvironmentAnimations(dt, elapsed);
    this.updateParticles(dt);
    this.updateDiegeticEquipment(dt, elapsed);
    this.updateCameraAndLighting(dt, elapsed);

    this.renderer.render(this.scene, this.camera);

    if (elapsed - this.lastSnapshotTime > 0.12) {
      this.lastSnapshotTime = elapsed;
      this.emitSnapshot();
    }

    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updatePlayer(dt: number, elapsed: number): void {
    // Keyboard yaw turn fallback
    if (this.keys['ArrowLeft']) this.yaw += 2.2 * dt;
    if (this.keys['ArrowRight']) this.yaw -= 2.2 * dt;

    // Regenerate Volt-Maul copper coil charge organically
    this.voltage = Math.min(1, this.voltage + dt * 0.14);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);

    // Magnetic grapple flight
    if (this.grappleTarget && this.grappleTimer > 0) {
      this.grappleTimer -= dt;
      const toTarget = _v1.subVectors(this.grappleTarget, this.playerPos);
      const dist = toTarget.length();
      if (dist < 2.2 || this.grappleTimer <= 0) {
        this.grappleTarget = null;
        this.grappleLine.visible = false;
      } else {
        toTarget.normalize();
        this.playerVel.copy(toTarget).multiplyScalar(22);
        this.playerPos.addScaledVector(this.playerVel, dt);
        this.grappleLine.visible = true;
        const arr = (this.grappleLine.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        arr[0] = this.playerPos.x - Math.cos(this.yaw) * 0.4;
        arr[1] = this.playerPos.y + 1.3;
        arr[2] = this.playerPos.z + Math.sin(this.yaw) * 0.4;
        arr[3] = this.grappleTarget.x;
        arr[4] = this.grappleTarget.y;
        arr[5] = this.grappleTarget.z;
        this.grappleLine.geometry.attributes.position.needsUpdate = true;
        return;
      }
    } else {
      this.grappleLine.visible = false;
    }

    // Horizontal WASD movement
    const forwardInput = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const strafeInput = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const moveDirX = -sinY * forwardInput + cosY * strafeInput;
    const moveDirZ = -cosY * forwardInput - sinY * strafeInput;
    const moveLen = Math.hypot(moveDirX, moveDirZ);

    const sprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.crouching;
    const maxSpeed = this.crouching ? 4.4 : sprinting ? 10.2 : 7.0;
    const accel = this.onIce ? 14 : 46;
    const friction = this.onIce ? 1.8 : 11;

    if (moveLen > 0.01) {
      const nx = moveDirX / moveLen;
      const nz = moveDirZ / moveLen;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, nx * maxSpeed, accel * 0.25, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, nz * maxSpeed, accel * 0.25, dt);
      if (this.grounded) {
        this.audio.playFootstep(this.onIce);
      }
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, friction, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, friction, dt);
    }

    // Gravity & floor collision
    this.playerVel.y -= 21 * dt;
    this.playerPos.x += this.playerVel.x * dt;
    this.playerPos.z += this.playerVel.z * dt;
    this.playerPos.y += this.playerVel.y * dt;

    this.resolveWalls(this.playerPos);

    const floor = this.getFloorHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    this.onIce = floor.icy;

    if (this.playerPos.y <= floor.y && this.playerVel.y <= 0 && floor.y > -30) {
      if (!this.grounded && this.slamPending) {
        // Ground-slam after grapple!
        this.slamPending = false;
        this.applyHammerImpact(true);
      }
      this.playerPos.y = floor.y;
      this.playerVel.y = 0;
      this.grounded = true;
    } else if (this.playerPos.y > floor.y + 0.15) {
      this.grounded = false;
    }

    // Abyss safety respawn (Tesla Viaduct chasm)
    if (this.playerPos.y < -12) {
      this.health = Math.max(15, this.health - 18);
      const zone = ZONES.find((z) => z.id === this.currentZone) ?? ZONES[0];
      this.playerPos.set(zone.spawnPos[0], zone.spawnPos[1], zone.spawnPos[2]);
      this.playerVel.set(0, 0, 0);
      this.slamPending = false;
    }

    // Volt-Maul swing hit window
    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      if (!this.swingHitApplied && this.swingTimer < 0.22) {
        this.swingHitApplied = true;
        this.applyHammerImpact(false);
      }
    }

    if (this.gauntletPulse > 0) {
      this.gauntletPulse = Math.max(0, this.gauntletPulse - dt);
    }

    // Determine current seamless zone from Z coordinate
    const pz = this.playerPos.z;
    for (const z of ZONES) {
      if (pz <= z.zStart && pz > z.zEnd) {
        this.currentZone = z.id;
        break;
      }
    }

    // Slowly vent steam if player is next to an unrepaired steam vent
    this.steamEmitTimer += dt;
    if (this.steamEmitTimer > 0.14) {
      this.steamEmitTimer = 0;
      for (const vent of this.world.steamVents) {
        const rep = this.world.repairs.find((r) => r.id === vent.valveId);
        if (rep && !rep.repaired) {
          this.spawnParticles(vent.pos, 2, rep.zoneId === 'cryo' ? 'cryo' : 'steam', 2.5);
        }
      }
    }

    // Subtle pressure regeneration when out of danger
    this.health = Math.min(this.maxHealth, this.health + dt * 1.4);

    // Update adaptive workshop audio
    let combatIntensity = 0;
    for (const e of this.world.enemies) {
      if (!e.defeated && e.pos.distanceTo(this.playerPos) < 18) {
        combatIntensity = Math.max(combatIntensity, e.kind === 'rogueMainframe' ? 1 : 0.65);
      }
    }
    this.audio.updateAtmosphere(combatIntensity, this.health / this.maxHealth);
    void elapsed;
  }

  private findNearbyRepair(): RepairNodeData | null {
    let best: RepairNodeData | null = null;
    let bestDist = 3.2;
    for (const r of this.world.repairs) {
      if (r.repaired && r.kind !== 'press') continue;
      const d = r.pos.distanceTo(this.playerPos);
      if (d < bestDist) {
        bestDist = d;
        best = r;
      }
    }
    return best;
  }

  private updateRepairs(dt: number): void {
    const nearby = this.findNearbyRepair();
    if (!nearby || !this.keys['KeyE']) return;

    if (nearby.kind === 'press' && nearby.linkedPressIndex !== undefined) {
      this.activateHydraulicPress(nearby.linkedPressIndex);
      return;
    }

    nearby.progress = Math.min(1, nearby.progress + dt * 0.55);
    this.audio.playWeldTick();

    // Physical 3D animation of hands-on hardware repair!
    if (nearby.model.coverPlate) {
      nearby.model.coverPlate.rotation.y = THREE.MathUtils.lerp(0, -1.65, Math.min(1, nearby.progress * 2.2));
      nearby.model.coverPlate.position.x = -0.35 * Math.min(1, nearby.progress * 2.2);
    }
    if (nearby.model.valveWheel) {
      nearby.model.valveWheel.rotation.z += dt * 7.5;
    }

    const worldSpark = nearby.model.sparkOrigin.clone().applyMatrix4(nearby.model.root.matrixWorld);
    if (Math.random() < 0.45) {
      this.spawnParticles(worldSpark, 2, 'spark', 4.5);
    }

    if (nearby.progress >= 1 && !nearby.repaired) {
      nearby.repaired = true;
      nearby.model.beaconMat.color.setHex(0x22c55e);
      nearby.model.beaconMat.emissive.setHex(0x16a34a);
      this.audio.playRepairComplete();
      this.health = Math.min(this.maxHealth, this.health + 22);

      // Check if both Sovereign Core conduits are welded/overloaded -> drop Boss shield!
      const coreConduits = this.world.repairs.filter((r) => r.zoneId === 'core');
      if (coreConduits.every((c) => c.repaired)) {
        this.world.bossEntity.shielded = false;
        if (this.world.bossEntity.model.shieldRing) {
          this.world.bossEntity.model.shieldRing.visible = false;
        }
        this.spawnParticles(this.world.bossEntity.pos.clone().add(new THREE.Vector3(0, 2.5, 0)), 28, 'spark', 9);
      }
    }
  }

  private updatePresses(dt: number): void {
    for (const p of this.world.presses) {
      if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.slamTimer > 0) {
        p.slamTimer = Math.max(0, p.slamTimer - dt);
        const phase = 1 - p.slamTimer / 1.6;
        if (phase < 0.25) {
          // Slam down fast!
          const t = phase / 0.25;
          p.ramMesh.position.y = THREE.MathUtils.lerp(p.restY, 1.05, t * t);
          if (t > 0.88) {
            this.audio.playHammerClang(true);
            this.spawnParticles(p.anvilPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 20, 'spark', 8);
            // Crush any automatons caught under the hydraulic press!
            for (const enemy of this.world.enemies) {
              if (!enemy.defeated && enemy.pos.distanceTo(p.anvilPos) < 3.4) {
                this.damageEnemy(enemy, 165, enemy.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0), true);
              }
            }
          }
        } else {
          // Retract up
          const t = (phase - 0.25) / 0.75;
          p.ramMesh.position.y = THREE.MathUtils.lerp(1.05, p.restY, t);
        }
      }
    }
  }

  private updateEnemies(dt: number, elapsed: number): void {
    for (const e of this.world.enemies) {
      if (e.defeated) {
        // Tip defeated automaton onto floor
        e.model.bodyGroup.rotation.x = THREE.MathUtils.damp(e.model.bodyGroup.rotation.x, Math.PI * 0.48, 6, dt);
        e.model.bodyGroup.position.y = THREE.MathUtils.damp(e.model.bodyGroup.position.y, -0.35, 6, dt);
        continue;
      }

      if (e.stunTimer > 0) {
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        e.model.root.position.x = e.pos.x + Math.sin(elapsed * 55) * 0.06;
        e.model.root.position.z = e.pos.z + Math.cos(elapsed * 48) * 0.06;
        e.vel.multiplyScalar(0.9);
        e.pos.addScaledVector(e.vel, dt);
        continue;
      }

      const toPlayer = _v1.subVectors(this.playerPos, e.pos);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      const aggroRange = e.kind === 'rogueMainframe' ? 28 : 18;
      if (dist < aggroRange) {
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        e.rotY = targetYaw;
        e.model.root.rotation.y = e.rotY;

        if (dist > e.radius + 1.8) {
          toPlayer.normalize();
          const speed = e.kind === 'cryoDrone' ? 4.4 : e.kind === 'rogueMainframe' ? 3.2 : 3.6;
          e.pos.addScaledVector(toPlayer, speed * dt);
        }

        // Melee / projectile attack
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          if (dist < e.radius + 2.4) {
            e.attackTimer = e.kind === 'rogueMainframe' ? 1.6 : 1.9;
            this.health = Math.max(0, this.health - (e.kind === 'rogueMainframe' ? 16 : 10));
            this.damageFlash = 1;
            this.audio.playHammerClang(false);
            if (this.health <= 0) {
              this.playerDefeated = true;
              this.emitSnapshot();
            }
          } else if (e.kind === 'cryoDrone' || e.kind === 'rogueMainframe') {
            e.attackTimer = e.kind === 'rogueMainframe' ? 2.4 : 3.2;
            this.fireAutomatonBolt(e);
          }
        }
      }

      // Clamp enemy onto its floor zone
      const floor = this.getFloorHeightAt(e.pos.x, e.pos.z, e.pos.y + 1);
      if (floor.y > -30) e.pos.y = floor.y;
      e.model.root.position.copy(e.pos);

      if (e.kind === 'cryoDrone') {
        e.model.bodyGroup.position.y = Math.sin(elapsed * 3.5) * 0.18;
      }
      if (e.model.leftLimb && e.model.rightLimb) {
        e.model.leftLimb.rotation.x = Math.sin(elapsed * 3.2) * 0.25;
        e.model.rightLimb.rotation.x = -Math.sin(elapsed * 3.2) * 0.25;
      }
      if (e.model.shieldRing && e.model.shieldRing.visible) {
        e.model.shieldRing.rotation.z += dt * 1.6;
      }
    }
  }

  private fireAutomatonBolt(enemy: EnemyEntityData): void {
    const startPos = enemy.pos.clone().add(new THREE.Vector3(0, enemy.kind === 'rogueMainframe' ? 2.6 : 1.4, 0));
    const dir = this.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(startPos).normalize();
    const boltMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 2.2,
        metalness: 0.7,
        roughness: 0.2,
      }),
    );
    boltMesh.position.copy(startPos);
    this.scene.add(boltMesh);

    this.world.grabbables.push({
      id: `bolt_${Date.now()}_${Math.random()}`,
      label: 'Plazma Çekirdek Mermisi',
      mesh: boltMesh,
      vel: dir.multiplyScalar(14),
      angVel: new THREE.Vector3(6, 8, 4),
      held: false,
      thrown: true,
      mass: 0.4,
      radius: 0.4,
      isEnemyProjectile: true,
    });
  }

  private updateGrabbables(dt: number): void {
    const forward = this.getLookForward(_v1);
    const holdTarget = _v2
      .set(this.playerPos.x, this.playerPos.y + 1.42, this.playerPos.z)
      .addScaledVector(forward, 1.85);
    // Offset slightly left toward Flux Gauntlet
    holdTarget.x -= Math.cos(this.yaw) * 0.45;
    holdTarget.z += Math.sin(this.yaw) * 0.45;

    for (let i = this.world.grabbables.length - 1; i >= 0; i--) {
      const g = this.world.grabbables[i];
      if (g.held) {
        g.mesh.position.lerp(holdTarget, 1 - Math.exp(-16 * dt));
        g.mesh.rotation.y += dt * 2.5;
        continue;
      }

      if (!g.isEnemyProjectile) {
        g.vel.y -= 18 * dt;
      }
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += g.angVel.x * dt;
      g.mesh.rotation.y += g.angVel.y * dt;

      // Enemy projectile hits player
      if (g.isEnemyProjectile && g.mesh.position.distanceTo(this.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0))) < 1.05) {
        this.health = Math.max(0, this.health - 12);
        this.damageFlash = 1;
        this.spawnParticles(g.mesh.position, 10, 'spark', 5);
        this.scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        this.world.grabbables.splice(i, 1);
        if (this.health <= 0) {
          this.playerDefeated = true;
          this.emitSnapshot();
        }
        continue;
      }

      // Thrown metal hits automatons!
      if (g.thrown && !g.isEnemyProjectile) {
        let hitEnemy = false;
        for (const e of this.world.enemies) {
          if (e.defeated) continue;
          const center = e.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
          if (g.mesh.position.distanceTo(center) < e.radius + g.radius + 0.35) {
            const dir = g.vel.clone().normalize();
            this.damageEnemy(e, 58 * g.mass, g.mesh.position, dir, true);
            g.vel.multiplyScalar(-0.3);
            g.thrown = false;
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) continue;
      }

      // Floor collision for physical objects
      const floor = this.getFloorHeightAt(g.mesh.position.x, g.mesh.position.z, g.mesh.position.y + 0.5);
      if (floor.y > -30 && g.mesh.position.y - 0.35 <= floor.y) {
        if (g.isEnemyProjectile) {
          this.spawnParticles(g.mesh.position, 6, 'spark', 4);
          this.scene.remove(g.mesh);
          g.mesh.geometry.dispose();
          this.world.grabbables.splice(i, 1);
          continue;
        }
        g.mesh.position.y = floor.y + 0.35;
        if (Math.abs(g.vel.y) > 2.5) {
          g.vel.y = -g.vel.y * 0.32;
          this.audio.playHammerClang(false);
        } else {
          g.vel.y = 0;
        }
        g.vel.x *= 0.85;
        g.vel.z *= 0.85;
        g.angVel.multiplyScalar(0.82);
        if (g.vel.lengthSq() < 0.8) g.thrown = false;
      } else if (g.mesh.position.y < -28) {
        if (g.isEnemyProjectile) {
          this.scene.remove(g.mesh);
          g.mesh.geometry.dispose();
          this.world.grabbables.splice(i, 1);
        }
      }
    }
  }

  private updateEnvironmentAnimations(dt: number, elapsed: number): void {
    for (const turb of this.world.rotatingTurbines) {
      turb.rotation.x += dt * 1.45;
    }
    this.world.dataRings.forEach((ring, idx) => {
      ring.rotation.z += dt * (0.45 + idx * 0.22) * (idx % 2 === 0 ? 1 : -1);
      ring.rotation.y += dt * 0.18;
    });

    // Jagged real-time Tesla coil electric arcs
    for (const arc of this.world.teslaArcLines) {
      const attr = arc.line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const jitter = i === 0 || i === 11 ? 0 : 0.65;
        attr.setXYZ(
          i,
          THREE.MathUtils.lerp(arc.a.x, arc.b.x, t) + (Math.random() - 0.5) * jitter,
          THREE.MathUtils.lerp(arc.a.y, arc.b.y, t) + (Math.random() - 0.5) * jitter + Math.sin(t * Math.PI) * 0.9,
          THREE.MathUtils.lerp(arc.a.z, arc.b.z, t) + (Math.random() - 0.5) * jitter,
        );
      }
      attr.needsUpdate = true;
      void elapsed;
    }
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        _mat4.makeTranslation(0, -100, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeTranslation(0, -100, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      if (p.kind === 'spark') p.vel.y -= 14 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const s = p.size * (p.life / p.maxLife);
      _scale.set(s, s, s);
      _quat.identity();
      _mat4.compose(p.pos, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);

      if (p.kind === 'spark') _color.setHex(0xfbbf24);
      else if (p.kind === 'cryo') _color.setHex(0x7dd3fc);
      else _color.setHex(0xd1d5db);
      this.particleMesh.setColorAt(i, _color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  private updateDiegeticEquipment(dt: number, elapsed: number): void {
    const speed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const bob = this.grounded && speed > 0.5 ? Math.sin(elapsed * 10) * 0.028 : 0;

    // 1. Diegetic Brass Pressure Manometer needle angle (0..120 PSI mapped from health!)
    const hpRatio = THREE.MathUtils.clamp(this.health / this.maxHealth, 0, 1);
    const jitter = hpRatio < 0.35 ? Math.sin(elapsed * 32) * 0.08 : Math.sin(elapsed * 6) * 0.015;
    const needleAngle = THREE.MathUtils.lerp(2.15, -2.15, hpRatio) + jitter;

    this.fpRig.wristNeedle.rotation.z = needleAngle;
    this.enesRig.backpackNeedle.rotation.z = needleAngle;

    // 2. Volt-Maul copper coil emissive intensity & electric arcs (shows Energy/Voltage!)
    const coilGlow = 0.25 + this.voltage * 2.1 + (this.swingTimer > 0 ? 1.4 : 0);
    this.fpRig.coilMat.emissiveIntensity = coilGlow;
    this.enesRig.coilMat.emissiveIntensity = coilGlow;

    const updateArc = (line: THREE.Line) => {
      line.visible = this.voltage > 0.28;
      if (!line.visible) return;
      const attr = line.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 7; i++) {
        const z = -0.1 + (i / 6) * 0.2;
        const j = 0.085 + this.voltage * 0.04;
        attr.setXYZ(i, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j, z);
      }
      attr.needsUpdate = true;
    };
    updateArc(this.fpRig.arcLine);
    updateArc(this.enesRig.arcLine);

    // 3. Flux Gauntlet glow when pulling or holding metal
    const gGlow = this.heldObject ? 2.4 : this.gauntletPulse > 0 ? 2.0 : 0.7;
    this.fpRig.gauntletRingMat.emissiveIntensity = gGlow;
    this.enesRig.gauntletRingMat.emissiveIntensity = gGlow;

    // 4. Keyframed Volt-Maul swing in First-Person & Third-Person
    let swingRotX = 0;
    let swingRotZ = 0;
    if (this.swingTimer > 0) {
      const t = 1 - this.swingTimer / 0.38;
      if (t < 0.32) {
        const wind = t / 0.32;
        swingRotX = wind * 0.65;
        swingRotZ = -wind * 0.35;
      } else {
        const strike = (t - 0.32) / 0.68;
        swingRotX = THREE.MathUtils.lerp(0.65, -1.45, Math.sin(strike * Math.PI));
        swingRotZ = THREE.MathUtils.lerp(-0.35, 0.45, Math.sin(strike * Math.PI));
      }
    }

    this.fpRig.rightPivot.rotation.set(swingRotX, 0, swingRotZ);
    this.fpRig.rightPivot.position.y = -0.34 + bob;
    this.fpRig.leftPivot.position.y = -0.32 - bob * 0.8;
    this.fpRig.leftPivot.position.z = this.heldObject || this.gauntletPulse > 0 ? -0.62 : -0.52;

    // 5. Third-Person Enes Rig kinematics & sloshing coolant cylinder
    this.enesRig.root.position.copy(this.playerPos);
    this.enesRig.root.rotation.y = this.yaw + Math.PI;
    const stride = this.grounded ? Math.sin(elapsed * 9.5) * Math.min(1, speed / 6.5) * 0.55 : 0.25;
    this.enesRig.leftLeg.rotation.x = stride;
    this.enesRig.rightLeg.rotation.x = -stride;
    this.enesRig.rightArm.rotation.x = -stride * 0.45 + swingRotX;
    this.enesRig.leftArm.rotation.x = this.heldObject ? -1.1 : stride * 0.45;
    this.enesRig.coolantLiquid.rotation.z = THREE.MathUtils.damp(
      this.enesRig.coolantLiquid.rotation.z,
      Math.sin(elapsed * 6) * 0.14 + (speed > 1 ? 0.16 : 0),
      8,
      dt,
    );
  }

  private updateCameraAndLighting(dt: number, elapsed: number): void {
    const eyeHeight = this.crouching ? 1.08 : 1.62;
    const targetFov = this.grappleTarget ? 84 : this.keys['ShiftLeft'] ? 77 : 72;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 'first') {
      const targetPos = _v1.set(
        this.playerPos.x,
        this.playerPos.y + eyeHeight,
        this.playerPos.z,
      );
      if (this.damageFlash > 0) {
        targetPos.x += Math.sin(elapsed * 45) * 0.06 * this.damageFlash;
      }
      this.camera.position.copy(targetPos);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      // Smooth damped 3rd-person over-the-shoulder camera
      const lookTarget = _v1.set(this.playerPos.x, this.playerPos.y + 1.48, this.playerPos.z);
      const backDir = _v2.set(0, 0, 1).applyEuler(new THREE.Euler(this.pitch * 0.55, this.yaw, 0, 'YXZ'));
      const desiredCam = _v3.copy(lookTarget).addScaledVector(backDir, 3.6);
      desiredCam.y = Math.max(this.playerPos.y + 0.8, desiredCam.y + 0.55);
      // Slight right shoulder offset so backpack manometer is clearly visible!
      desiredCam.x += Math.cos(this.yaw) * 0.55;
      desiredCam.z -= Math.sin(this.yaw) * 0.55;

      this.camera.position.lerp(desiredCam, 1 - Math.exp(-12 * dt));
      this.camera.lookAt(lookTarget);
    }

    // Move key light & point light smoothly across the 5 seamless zones
    this.zoneKeyLight.position.set(this.playerPos.x + 12, this.playerPos.y + 24, this.playerPos.z + 10);
    this.zoneKeyLight.target.position.copy(this.playerPos);
    this.zonePointLight.position.set(this.playerPos.x, this.playerPos.y + 5.5, this.playerPos.z - 4);

    // Zone-reactive atmospheric color grading
    const zoneColors: Record<ZoneId, { fog: number; light: number }> = {
      turbine: { fog: 0x101318, light: 0xff9b42 },
      cryo: { fog: 0x0b1926, light: 0x38bdf8 },
      foundry: { fog: 0x1c100b, light: 0xff5a1f },
      tesla: { fog: 0x0d1220, light: 0x60a5fa },
      core: { fog: 0x130d16, light: 0xf43f5e },
    };
    const targetColors = zoneColors[this.currentZone];
    (this.scene.fog as THREE.FogExp2).color.lerp(_color.setHex(targetColors.fog), dt * 2.5);
    (this.scene.background as THREE.Color).copy((this.scene.fog as THREE.FogExp2).color);
    this.zonePointLight.color.lerp(_color.setHex(targetColors.light), dt * 2.5);
  }

  private emitSnapshot(): void {
    const nearby = this.findNearbyRepair();
    let prompt: string | null = null;
    if (nearby) {
      prompt =
        nearby.kind === 'press'
          ? `[E / Çekiç] ${nearby.label} — Presi İndir`
          : `[E Basılı Tut] ${nearby.label} — El İle Onar`;
    }

    const activeRepair = nearby && this.keys['KeyE'] && !nearby.repaired ? nearby : null;

    // Check if grapple pipe is in sight
    const forward = this.getLookForward(_v1);
    const eyePos = _v2.set(this.playerPos.x, this.playerPos.y + 1.55, this.playerPos.z);
    let grappleReady = false;
    for (const a of this.world.grappleAnchors) {
      const d = _v3.subVectors(a.pos, eyePos);
      const dist = d.length();
      if (dist <= 28 && dist > 2.2 && d.normalize().dot(forward) > 0.55) {
        grappleReady = true;
        break;
      }
    }

    this.onSnapshot({
      started: this.started,
      cameraMode: this.cameraMode,
      currentZone: this.currentZone,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      voltage: this.voltage,
      isRepairing: Boolean(activeRepair),
      activeRepairLabel: activeRepair?.label ?? null,
      activeRepairProgress: activeRepair?.progress ?? 0,
      nearbyPrompt: prompt,
      heldObjectName: this.heldObject?.label ?? null,
      grappleReady,
      notebookOpen: this.notebookOpen,
      muted: this.audio.isMuted(),
      pointerLocked: this.pointerLocked,
      repairs: this.world.repairs.map((r) => ({
        id: r.id,
        zoneId: r.zoneId,
        kind: r.kind,
        label: r.label,
        progress: r.progress,
        repaired: r.repaired,
      })),
      enemiesDefeated: this.world.enemies.filter((e) => e.defeated).length,
      totalEnemies: this.world.enemies.length,
      bossHealth: Math.round(this.world.bossEntity.hp),
      bossMaxHealth: this.world.bossEntity.maxHp,
      bossActive: this.currentZone === 'core' && !this.world.bossEntity.defeated,
      bossDefeated: this.world.bossEntity.defeated,
      victory: this.victory,
      playerDefeated: this.playerDefeated,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);

    this.audio.dispose();
    this.tex.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
