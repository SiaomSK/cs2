import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tacticalAudio } from './audio';
import {
  BOMB_SITES,
  CT_SPAWN_POS,
  DEATHMATCH_SPAWNS,
  MAP_BOXES,
  MAP_WAYPOINTS,
  T_SPAWN_POS,
} from './mapData';
import { createOperatorRig, createPlantedBombMesh, createViewmodelWeapon, type OperatorRig } from './models';
import {
  calculateWeaponDamage,
  checkMatchWinner,
  computeCrosshairSpread,
  getBombSiteAt,
  groundHeightAt,
  hasLineOfSight,
  isInBuyZone,
  pickSafeDeathmatchSpawn,
  raycastMapDistance,
  rayIntersectsAABB,
  resolveCircleMovement,
  resolveDeathmatchWinner,
  validateArmorPurchase,
  validateWeaponPurchase,
} from './rules';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import type {
  BombState,
  BotRole,
  Difficulty,
  GameMode,
  GamePhase,
  HudSnapshot,
  KillFeedItem,
  QualityPreset,
  RadarBlip,
  RoundPhase,
  ScoreboardEntry,
  Team,
  WeaponId,
  WeaponSlot,
} from './types';
import { WEAPON_SPECS } from './weapons';

interface BotActor {
  id: string;
  name: string;
  team: Team;
  role: BotRole;
  alive: boolean;
  hp: number;
  armor: number;
  hasHelmet: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  weaponId: WeaponId;
  clip: number;
  fireCooldown: number;
  reloadTimer: number;
  burstLeft: number;
  burstPause: number;
  waypointId: string;
  targetWaypointId: string;
  goalSite: 'A' | 'B';
  reactionTimer: number;
  hitFlashTimer: number;
  deathTimer: number;
  kills: number;
  deaths: number;
  assists: number;
  money: number;
  rig: OperatorRig;
  flashTimer: number;
  walkPhase: number;
}

interface PooledSpark {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface PooledTracer {
  line: THREE.Line;
  positions: Float32Array;
  life: number;
}

interface ActiveGrenade {
  type: 'he' | 'smoke' | 'flash';
  ownerId: string;
  ownerTeam: Team;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
}

interface ActiveSmoke {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  radius: number;
  life: number;
}

const CT_NAMES = ['Viper', 'Kestrel', 'Bastion', 'Atlas'];
const T_NAMES = ['Scorpion', 'Mirage', 'Jackal', 'Nomad'];

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class CS2Engine {
  private container: HTMLElement;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private textures: ProceduralTextureSet;

  // Viewmodel rig attached to camera
  private viewmodelPivot: THREE.Group;
  private viewmodelMesh: THREE.Group | null = null;
  private viewmodelWeaponId: WeaponId | null = null;
  private viewmodelRecoil = 0;
  private viewmodelEquipAnim = 0;
  private viewmodelMuzzleFlash: THREE.Mesh;
  private muzzleFlashTimer = 0;

  // Pooled FX
  private sparkPool: PooledSpark[] = [];
  private sparkIdx = 0;
  private tracerPool: PooledTracer[] = [];
  private tracerIdx = 0;
  private grenades: ActiveGrenade[] = [];
  private smokes: ActiveSmoke[] = [];
  private plantedBombVisual: { group: THREE.Group; ledMesh: THREE.Mesh };
  private bombBeepAccum = 0;

  // Loop & timing
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private hudThrottle = 0;
  private fpsSamples: number[] = [];
  private currentFps = 60;
  private titleOrbitAngle = 0.4;

  // Settings & match state
  private quality: QualityPreset = 'standard';
  private difficulty: Difficulty = 'casual';
  private gameMode: GameMode = 'defusal';
  private gamePhase: GamePhase = 'title';
  private roundPhase: RoundPhase = 'buy';
  private roundNumber = 1;
  private maxRounds = 9; // First to 5 wins
  private ctScore = 0;
  private tScore = 0;
  private roundTimer = 115;
  private buyTimer = 18;
  private roundEndTimer = 0;
  private playerRespawnTimer = 0;
  private spawnProtectTimer = 0;
  private roundBanner: { title: string; subtitle: string; team: Team | null } | null = null;
  private hitstopTimer = 0;
  private trauma = 0;

  // Player state
  private playerTeam: Team = 'CT';
  private playerX = CT_SPAWN_POS.x;
  private playerY = 0;
  private playerZ = CT_SPAWN_POS.z;
  private playerVx = 0;
  private playerVy = 0;
  private playerVz = 0;
  private playerYaw = CT_SPAWN_POS.yaw;
  private playerPitch = 0;
  private isGrounded = true;
  private isCrouching = false;
  private eyeHeight = 1.65;
  private walkBobPhase = 0;

  private playerHp = 100;
  private playerArmor = 100;
  private playerHasHelmet = true;
  private playerMoney = 800;
  private playerKills = 0;
  private playerDeaths = 0;
  private playerHeadshots = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private damageDealt = 0;

  // Weapons & inventory
  private activeSlot: WeaponSlot = 'secondary';
  private weapons: {
    primary: WeaponId | null;
    secondary: WeaponId | null;
    knife: WeaponId;
    utility: WeaponId | null;
  } = {
    primary: null,
    secondary: 'usp',
    knife: 'knife',
    utility: null,
  };
  private ammo: Record<WeaponSlot, { clip: number; reserve: number }> = {
    primary: { clip: 0, reserve: 0 },
    secondary: { clip: 12, reserve: 24 },
    knife: { clip: 0, reserve: 0 },
    utility: { clip: 0, reserve: 0 },
  };
  private fireCooldown = 0;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadTotal = 0;
  private isScoped = false;
  private recoilHeat = 0;
  private recoilRecoveryPitch = 0;
  private recoilRecoveryYaw = 0;
  private hitmarkerType: 'none' | 'body' | 'head' | 'kill' = 'none';
  private hitmarkerTimer = 0;
  private flashAlpha = 0;
  private damageFlash = 0;
  private sensitivity = 0.0021;

  // Bomb & killfeed
  private bomb: BombState = {
    status: 'carried',
    carrierId: null,
    x: 0,
    y: 0,
    z: 0,
    site: null,
    timer: 35,
    defuseProgress: 0,
    plantProgress: 0,
  };
  private killFeed: KillFeedItem[] = [];
  private nextKillId = 1;
  private bots: BotActor[] = [];
  private waypointMap = new Map(MAP_WAYPOINTS.map((w) => [w.id, w]));

  // Input state
  private keys = new Set<string>();
  private mouseDownLeft = false;
  private semiFiredThisPress = false;
  private pointerLocked = false;
  private justLockedAt = 0;
  private dragAiming = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private attackTokenCount = 0;

  constructor(container: HTMLElement, onHudUpdate: (snap: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.quality = this.isSoftwareGl ? 'potato' : 'standard';

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyQualitySettings();

    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x88b4de);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xd8cab2, 0.0068);

    this.camera = new THREE.PerspectiveCamera(
      72,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.08,
      200
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Studio / Outdoor Environment Reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Warm desert sun + cool sky/ground hemisphere fill
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0xb89668, 0.72);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.sunLight.position.set(28, 48, 22);
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 130;
    this.sunLight.shadow.camera.left = -45;
    this.sunLight.shadow.camera.right = 45;
    this.sunLight.shadow.camera.top = 45;
    this.sunLight.shadow.camera.bottom = -45;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    rimLight.position.set(-25, 22, -30);
    this.scene.add(rimLight);

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.buildArenaGeometry();
    this.initPools();

    // Viewmodel setup
    this.viewmodelPivot = new THREE.Group();
    this.camera.add(this.viewmodelPivot);
    this.viewmodelMuzzleFlash = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.065, 0),
      new THREE.MeshBasicMaterial({ color: 0xffdf78 })
    );
    this.viewmodelMuzzleFlash.position.set(0.16, -0.1, -0.95);
    this.viewmodelMuzzleFlash.visible = false;
    this.viewmodelPivot.add(this.viewmodelMuzzleFlash);

    this.plantedBombVisual = createPlantedBombMesh();
    this.plantedBombVisual.group.visible = false;
    this.scene.add(this.plantedBombVisual.group);

    this.spawnBots();
    this.equipViewmodel('usp');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.syncBodyState();
    this.pushHud(true);
    this.scheduleNextTick();
  }

  private applyQualitySettings(): void {
    const isPotato = this.quality === 'potato';
    const isHigh = this.quality === 'high';
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(isPotato ? 0.65 : 1);
      this.renderer.shadowMap.enabled = false;
    } else {
      const dpr = window.devicePixelRatio || 1;
      const ratio = isPotato ? 0.65 : isHigh ? Math.min(dpr, 2) : Math.min(dpr, 1.15);
      this.renderer.setPixelRatio(ratio);
      this.renderer.shadowMap.enabled = isHigh;
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.sunLight) {
      this.sunLight.castShadow = !this.isSoftwareGl && isHigh;
    }
  }

  private buildArenaGeometry(): void {
    // Extended desert horizon floor (so outdoor world never looks boxed in a void)
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.MeshStandardMaterial({ color: 0xc9ae83, roughness: 0.95, metalness: 0 })
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.04;
    outerGround.receiveShadow = true;
    this.scene.add(outerGround);

    // Arena courtyard floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.sandFloor,
      roughness: 0.92,
      metalness: 0.02,
    });
    const arenaFloor = new THREE.Mesh(new THREE.PlaneGeometry(74, 86), floorMat);
    arenaFloor.rotation.x = -Math.PI / 2;
    arenaFloor.position.y = 0;
    arenaFloor.receiveShadow = true;
    this.scene.add(arenaFloor);

    // Shared materials
    const mats: Record<string, THREE.MeshStandardMaterial> = {
      sandstone: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.sandstone,
        roughness: 0.88,
        metalness: 0.02,
      }),
      concrete: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.concrete,
        roughness: 0.85,
        metalness: 0.05,
      }),
      crate: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.crate,
        roughness: 0.78,
        metalness: 0.05,
      }),
      container: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.metal,
        roughness: 0.48,
        metalness: 0.45,
      }),
      door: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.textures.door,
        roughness: 0.72,
        metalness: 0.15,
      }),
      metal: new THREE.MeshStandardMaterial({
        color: 0x3f4c59,
        roughness: 0.38,
        metalness: 0.65,
      }),
    };

    for (const b of MAP_BOXES) {
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const d = b.maxZ - b.minZ;
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const cz = (b.minZ + b.maxZ) / 2;

      if (b.isRamp) {
        // Build clean sloped wedge for A ramp
        const rampGeo = new THREE.BoxGeometry(w, h, d);
        const ramp = new THREE.Mesh(rampGeo, mats.concrete);
        ramp.position.set(cx, b.minY + h * 0.5 - 0.1, cz);
        ramp.rotation.z = Math.atan2(h, w);
        ramp.receiveShadow = true;
        this.scene.add(ramp);
        continue;
      }

      if (b.material === 'metal') {
        // Multi-part ribbed tactical steel drum barrel
        const barrelGroup = new THREE.Group();
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.48, h, 12), mats.metal);
        cyl.position.y = h / 2;
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.5 });
        const topRim = new THREE.Mesh(new THREE.TorusGeometry(w * 0.47, 0.03, 6, 14), rimMat);
        topRim.rotation.x = Math.PI / 2;
        topRim.position.y = h - 0.04;
        const midBand = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, 0.14, 12), rimMat);
        midBand.position.y = h * 0.52;
        barrelGroup.add(cyl, topRim, midBand);
        barrelGroup.position.set(cx, b.minY, cz);
        this.scene.add(barrelGroup);
        continue;
      }

      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mats[b.material] || mats.sandstone);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = h > 1.0 && b.id !== 'a_platform';
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Subtle architectural coping trim along top of sandstone walls for crisp sky contrast
      if (b.material === 'sandstone' && h >= 5.0 && !b.id.startsWith('wall_')) {
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.14, 0.24, d + 0.14),
          mats.concrete
        );
        cap.position.set(cx, b.maxY + 0.12, cz);
        this.scene.add(cap);
      }
    }

    // Iconic Mid Archway lintel & A-Long Archway lintel for strong architectural silhouettes
    const archMat = mats.sandstone;
    const midLintel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.4, 1.6), archMat);
    midLintel.position.set(0, 4.9, 2);
    const aLintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.4, 2.0), archMat);
    aLintel.position.set(24.75, 5.3, -16);
    const bLintel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.6, 2.2), archMat);
    bLintel.position.set(-25, 5.4, 2);
    this.scene.add(midLintel, aLintel, bLintel);

    // Site A and Site B floor stencil decals (offset +0.02 on Y to prevent Z-fighting)
    const decalA = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 3.8),
      new THREE.MeshBasicMaterial({ map: this.textures.siteA, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    decalA.rotation.x = -Math.PI / 2;
    decalA.position.set(BOMB_SITES[0].x, BOMB_SITES[0].y + 0.02, BOMB_SITES[0].z);

    const decalB = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 3.8),
      new THREE.MeshBasicMaterial({ map: this.textures.siteB, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    decalB.rotation.x = -Math.PI / 2;
    decalB.position.set(BOMB_SITES[1].x, BOMB_SITES[1].y + 0.02, BOMB_SITES[1].z);
    this.scene.add(decalA, decalB);

    // Distant sandstone citadel towers & desert palms outside arena walls for horizon depth
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xb7996e, roughness: 0.92 });
    const minaretCapMat = new THREE.MeshStandardMaterial({ color: 0x3b6e8c, roughness: 0.55 });
    const distantCoords = [
      { x: -55, z: -58, w: 12, h: 19, d: 12 },
      { x: 52, z: -50, w: 10, h: 24, d: 10, domed: true },
      { x: -58, z: 48, w: 14, h: 16, d: 14 },
      { x: 56, z: 54, w: 11, h: 21, d: 11, domed: true },
      { x: 0, z: -68, w: 22, h: 15, d: 10 },
    ];
    for (const tc of distantCoords) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(tc.w, tc.h, tc.d), towerMat);
      base.position.y = tc.h / 2;
      g.add(base);
      if (tc.domed) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(tc.w * 0.42, 10, 8), minaretCapMat);
        dome.position.y = tc.h;
        g.add(dome);
      }
      g.position.set(tc.x, 0, tc.z);
      this.scene.add(g);
    }
  }

  private initPools(): void {
    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparkPool.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.25 });
    }

    const tracerMat = new THREE.LineBasicMaterial({
      color: 0xffe082,
      transparent: true,
      opacity: 0.78,
    });
    for (let i = 0; i < 20; i++) {
      const positions = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geo, tracerMat);
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.tracerPool.push({ line, positions, life: 0 });
    }
  }

  private spawnSparkBurst(x: number, y: number, z: number, count: number, colorHex?: number): void {
    for (let i = 0; i < count; i++) {
      const sp = this.sparkPool[this.sparkIdx];
      this.sparkIdx = (this.sparkIdx + 1) % this.sparkPool.length;
      if (colorHex !== undefined) {
        (sp.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      }
      sp.mesh.position.set(x, y, z);
      sp.mesh.visible = true;
      sp.vx = (Math.random() - 0.5) * 6;
      sp.vy = 1.5 + Math.random() * 4.5;
      sp.vz = (Math.random() - 0.5) * 6;
      sp.maxLife = 0.16 + Math.random() * 0.18;
      sp.life = sp.maxLife;
    }
  }

  private spawnTracer(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    const tr = this.tracerPool[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % this.tracerPool.length;
    tr.positions[0] = ax;
    tr.positions[1] = ay;
    tr.positions[2] = az;
    tr.positions[3] = bx;
    tr.positions[4] = by;
    tr.positions[5] = bz;
    tr.line.geometry.attributes.position.needsUpdate = true;
    tr.line.visible = true;
    tr.life = 0.065;
  }

  private spawnBots(): void {
    for (const b of this.bots) {
      this.scene.remove(b.rig.root);
      b.rig.dispose();
    }
    this.bots = [];

    const roles: BotRole[] = ['entry', 'anchor', 'sniper', 'flanker'];
    const castShadow = !this.isSoftwareGl && this.quality === 'high';

    // 3 Teammates (with player = 4v4) + 4 Enemies
    const friendlyCount = 3;
    const enemyCount = 4;

    const addBot = (team: Team, idx: number, name: string) => {
      const rig = createOperatorRig(team, castShadow);
      this.scene.add(rig.root);
      this.bots.push({
        id: `bot_${team}_${idx}`,
        name,
        team,
        role: roles[idx % roles.length],
        alive: true,
        hp: 100,
        armor: 100,
        hasHelmet: true,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        yaw: 0,
        weaponId: team === 'CT' ? 'usp' : 'glock',
        clip: 12,
        fireCooldown: 0,
        reloadTimer: 0,
        burstLeft: 0,
        burstPause: 0,
        waypointId: team === 'CT' ? 'ct_spawn' : 't_spawn',
        targetWaypointId: team === 'CT' ? 'ct_mid' : 't_mid',
        goalSite: idx % 2 === 0 ? 'A' : 'B',
        reactionTimer: 0,
        hitFlashTimer: 0,
        deathTimer: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        money: 800,
        rig,
        flashTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
      });
    };

    const friendNames = this.playerTeam === 'CT' ? CT_NAMES : T_NAMES;
    const enemyNames = this.playerTeam === 'CT' ? T_NAMES : CT_NAMES;
    const enemyTeam: Team = this.playerTeam === 'CT' ? 'T' : 'CT';

    for (let i = 0; i < friendlyCount; i++) {
      addBot(this.playerTeam, i, friendNames[i]);
    }
    for (let i = 0; i < enemyCount; i++) {
      addBot(enemyTeam, i, enemyNames[i]);
    }

    this.resetRoundPositions(true);
  }

  private resetRoundPositions(isMatchStart: boolean): void {
    // Clear transient world objects
    for (const g of this.grenades) this.scene.remove(g.mesh);
    this.grenades = [];
    for (const s of this.smokes) this.scene.remove(s.group);
    this.smokes = [];
    this.plantedBombVisual.group.visible = false;

    const pSpawn = this.playerTeam === 'CT' ? CT_SPAWN_POS : T_SPAWN_POS;
    this.playerX = pSpawn.x;
    this.playerY = 0;
    this.playerZ = pSpawn.z;
    this.playerVx = 0;
    this.playerVy = 0;
    this.playerVz = 0;
    this.playerYaw = pSpawn.yaw;
    this.playerPitch = 0;
    this.isGrounded = true;
    this.isCrouching = false;
    this.eyeHeight = 1.65;
    this.playerHp = 100;
    this.isScoped = false;
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
    this.recoilHeat = 0;
    this.flashAlpha = 0;
    this.damageFlash = 0;
    this.isReloading = false;
    this.reloadTimer = 0;

    if (this.gameMode === 'deathmatch') {
      this.playerArmor = 100;
      this.playerHasHelmet = true;
      this.playerMoney = 16000;
      this.spawnProtectTimer = 1.5;
      this.playerRespawnTimer = 0;

      const defPri: WeaponId = this.playerTeam === 'CT' ? 'm4a4' : 'ak47';
      const defSec: WeaponId = this.playerTeam === 'CT' ? 'usp' : 'glock';
      this.weapons = { primary: defPri, secondary: defSec, knife: 'knife', utility: 'he' };
      this.ammo = {
        primary: { clip: WEAPON_SPECS[defPri].magSize, reserve: WEAPON_SPECS[defPri].reserveMax },
        secondary: { clip: WEAPON_SPECS[defSec].magSize, reserve: WEAPON_SPECS[defSec].reserveMax },
        knife: { clip: 0, reserve: 0 },
        utility: { clip: 1, reserve: 0 },
      };
      this.activeSlot = 'primary';
      this.equipViewmodel(defPri);

      const dmPool: WeaponId[] = ['ak47', 'm4a4', 'mp9', 'awp'];
      for (let i = 0; i < this.bots.length; i++) {
        const bot = this.bots[i];
        const sp = DEATHMATCH_SPAWNS[(i + 2) % DEATHMATCH_SPAWNS.length];
        bot.alive = true;
        bot.hp = 100;
        bot.armor = 100;
        bot.hasHelmet = true;
        bot.rig.root.visible = true;
        bot.rig.bodyGroup.rotation.set(0, 0, 0);
        bot.rig.bodyGroup.position.set(0, 0, 0);
        bot.deathTimer = 0;
        bot.hitFlashTimer = 0;
        bot.flashTimer = 0;
        bot.reactionTimer = 0;
        bot.vx = 0;
        bot.vz = 0;
        bot.weaponId = bot.role === 'sniper' ? 'awp' : dmPool[i % dmPool.length];
        bot.clip = WEAPON_SPECS[bot.weaponId].magSize;
        bot.x = sp.x;
        bot.z = sp.z;
        bot.y = groundHeightAt(sp.x, sp.z);
        bot.yaw = sp.yaw;
        bot.waypointId = sp.waypointId;
        const wp = this.waypointMap.get(sp.waypointId);
        bot.targetWaypointId = wp && wp.neighbors.length > 0
          ? wp.neighbors[Math.floor(Math.random() * wp.neighbors.length)]
          : sp.waypointId;
        bot.rig.root.position.set(bot.x, bot.y, bot.z);
        bot.rig.root.rotation.y = bot.yaw;
      }

      this.bomb = {
        status: 'carried',
        carrierId: null,
        x: 0,
        y: 0,
        z: 0,
        site: null,
        timer: 35,
        defuseProgress: 0,
        plantProgress: 0,
      };

      this.roundPhase = 'live';
      this.buyTimer = 0;
      this.roundTimer = 180;
      this.roundBanner = {
        title: 'Deathmatch',
        subtitle: 'Instant Respawn · Press [B] for Free Loadout · 3:00',
        team: null,
      };
      return;
    }

    if (isMatchStart) {
      this.playerArmor = 100;
      this.playerHasHelmet = true;
      this.playerMoney = 3200; // Tactical start budget so player can experience buying rifles/SMGs right away!
      const defSec: WeaponId = this.playerTeam === 'CT' ? 'usp' : 'glock';
      this.weapons = { primary: null, secondary: defSec, knife: 'knife', utility: 'he' };
      this.ammo = {
        primary: { clip: 0, reserve: 0 },
        secondary: { clip: WEAPON_SPECS[defSec].magSize, reserve: WEAPON_SPECS[defSec].reserveMax },
        knife: { clip: 0, reserve: 0 },
        utility: { clip: 1, reserve: 0 },
      };
      this.activeSlot = 'secondary';
      this.equipViewmodel(defSec);
    } else {
      // Refill ammo for alive/surviving player or restore default pistol
      if (!this.weapons.secondary) {
        const defSec: WeaponId = this.playerTeam === 'CT' ? 'usp' : 'glock';
        this.weapons.secondary = defSec;
      }
      (['primary', 'secondary', 'utility'] as WeaponSlot[]).forEach((slot) => {
        const wid = this.weapons[slot];
        if (wid) {
          this.ammo[slot] = {
            clip: WEAPON_SPECS[wid].magSize,
            reserve: WEAPON_SPECS[wid].reserveMax,
          };
        }
      });
      this.activeSlot = this.weapons.primary ? 'primary' : 'secondary';
      this.equipViewmodel(this.weapons[this.activeSlot] || 'knife');
    }

    // Place bots around their team spawns
    let ctIdx = 0;
    let tIdx = 0;
    let tBombAssigned = false;

    for (const bot of this.bots) {
      bot.alive = true;
      bot.hp = 100;
      bot.armor = this.roundNumber === 1 ? 50 : 100;
      bot.hasHelmet = this.roundNumber > 1;
      bot.rig.root.visible = true;
      bot.rig.bodyGroup.rotation.set(0, 0, 0);
      bot.rig.bodyGroup.position.set(0, 0, 0);
      bot.deathTimer = 0;
      bot.hitFlashTimer = 0;
      bot.flashTimer = 0;
      bot.vx = 0;
      bot.vz = 0;

      // Upgrade bot weapons as rounds progress
      if (isMatchStart) {
        bot.weaponId = bot.team === 'CT' ? 'usp' : 'glock';
      } else if (this.roundNumber >= 2) {
        const pool: WeaponId[] =
          bot.role === 'sniper' && this.roundNumber >= 3
            ? ['awp']
            : bot.team === 'CT'
            ? ['m4a4', 'mp9']
            : ['ak47', 'mp9'];
        bot.weaponId = pool[Math.floor(Math.random() * pool.length)];
      }
      bot.clip = WEAPON_SPECS[bot.weaponId].magSize;

      const isCT = bot.team === 'CT';
      const offsetIdx = isCT ? ++ctIdx : ++tIdx;
      const spreadX = (offsetIdx - 2) * 2.4;
      bot.x = spreadX;
      bot.z = isCT ? CT_SPAWN_POS.z - 2.2 : T_SPAWN_POS.z + 2.2;
      bot.y = groundHeightAt(bot.x, bot.z);
      bot.yaw = isCT ? Math.PI : 0;
      bot.waypointId = isCT ? 'ct_spawn' : 't_spawn';
      bot.goalSite = Math.random() < 0.55 ? 'A' : 'B';
      bot.targetWaypointId = isCT
        ? bot.goalSite === 'A'
          ? 'ct_a_link'
          : 'ct_b_link'
        : bot.goalSite === 'A'
        ? 't_a_link'
        : 't_b_link';
      bot.rig.root.position.set(bot.x, bot.y, bot.z);
      bot.rig.root.rotation.y = bot.yaw;

      if (!isCT && !tBombAssigned && this.playerTeam === 'CT') {
        tBombAssigned = true;
        this.bomb = {
          status: 'carried',
          carrierId: bot.id,
          x: bot.x,
          y: bot.y,
          z: bot.z,
          site: null,
          timer: 35,
          defuseProgress: 0,
          plantProgress: 0,
        };
      }
    }

    if (this.playerTeam === 'T') {
      this.bomb = {
        status: 'carried',
        carrierId: 'player',
        x: this.playerX,
        y: this.playerY,
        z: this.playerZ,
        site: null,
        timer: 35,
        defuseProgress: 0,
        plantProgress: 0,
      };
    }

    this.roundPhase = 'buy';
    this.buyTimer = 18;
    this.roundTimer = 115;
    this.roundBanner = {
      title: `Round ${this.roundNumber}`,
      subtitle: 'Buy Phase · Press [B] to equip loadout',
      team: null,
    };
  }

  private getOpposingPositions(team: Team): Array<{ x: number; z: number }> {
    const out: Array<{ x: number; z: number }> = [];
    for (const b of this.bots) {
      if (b.alive && b.team !== team) {
        out.push({ x: b.x, z: b.z });
      }
    }
    if (this.playerTeam !== team && this.playerHp > 0) {
      out.push({ x: this.playerX, z: this.playerZ });
    }
    return out;
  }

  private respawnPlayerDeathmatch(): void {
    const sp = pickSafeDeathmatchSpawn(DEATHMATCH_SPAWNS, this.getOpposingPositions(this.playerTeam));
    this.playerX = sp.x;
    this.playerZ = sp.z;
    this.playerY = groundHeightAt(sp.x, sp.z);
    this.playerVx = 0;
    this.playerVy = 0;
    this.playerVz = 0;
    this.playerYaw = sp.yaw;
    this.playerPitch = 0;
    this.isGrounded = true;
    this.isCrouching = false;
    this.eyeHeight = 1.65;
    this.playerHp = 100;
    this.playerArmor = 100;
    this.playerHasHelmet = true;
    this.spawnProtectTimer = 1.5;
    this.playerRespawnTimer = 0;
    this.isScoped = false;
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
    this.recoilHeat = 0;
    this.recoilRecoveryPitch = 0;
    this.recoilRecoveryYaw = 0;
    this.flashAlpha = 0;
    this.damageFlash = 0;
    this.isReloading = false;
    this.reloadTimer = 0;

    if (!this.weapons.utility) {
      this.weapons.utility = 'he';
    }
    (['primary', 'secondary', 'utility'] as WeaponSlot[]).forEach((slot) => {
      const wid = this.weapons[slot];
      if (wid) {
        this.ammo[slot] = {
          clip: WEAPON_SPECS[wid].magSize,
          reserve: WEAPON_SPECS[wid].reserveMax,
        };
      }
    });
    this.activeSlot = this.weapons.primary ? 'primary' : 'secondary';
    this.equipViewmodel(this.weapons[this.activeSlot] || 'knife');
    this.pushHud(true);
  }

  private respawnBotDeathmatch(bot: BotActor): void {
    const sp = pickSafeDeathmatchSpawn(DEATHMATCH_SPAWNS, this.getOpposingPositions(bot.team));
    bot.alive = true;
    bot.hp = 100;
    bot.armor = 100;
    bot.hasHelmet = true;
    bot.x = sp.x;
    bot.z = sp.z;
    bot.y = groundHeightAt(sp.x, sp.z);
    bot.yaw = sp.yaw;
    bot.vx = 0;
    bot.vz = 0;
    bot.deathTimer = 0;
    bot.hitFlashTimer = 0;
    bot.flashTimer = 0;
    bot.reactionTimer = 0;
    bot.fireCooldown = 0.4;

    const dmPool: WeaponId[] = bot.role === 'sniper' ? ['awp', 'ak47'] : ['ak47', 'm4a4', 'mp9'];
    bot.weaponId = dmPool[Math.floor(Math.random() * dmPool.length)];
    bot.clip = WEAPON_SPECS[bot.weaponId].magSize;

    bot.waypointId = sp.waypointId;
    const wp = this.waypointMap.get(sp.waypointId);
    bot.targetWaypointId = wp && wp.neighbors.length > 0
      ? wp.neighbors[Math.floor(Math.random() * wp.neighbors.length)]
      : sp.waypointId;

    bot.rig.root.visible = true;
    bot.rig.bodyGroup.rotation.set(0, 0, 0);
    bot.rig.bodyGroup.position.set(0, 0, 0);
    bot.rig.root.position.set(bot.x, bot.y, bot.z);
    bot.rig.root.rotation.y = bot.yaw;
  }

  private equipViewmodel(weaponId: WeaponId): void {
    if (this.viewmodelWeaponId === weaponId && this.viewmodelMesh) return;
    if (this.viewmodelMesh) {
      this.viewmodelPivot.remove(this.viewmodelMesh);
    }
    this.viewmodelMesh = createViewmodelWeapon(weaponId, this.playerTeam);
    this.viewmodelPivot.add(this.viewmodelMesh);
    this.viewmodelWeaponId = weaponId;
    this.viewmodelEquipAnim = 1;
    this.isScoped = false;
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
  }

  public startMatch(
    team: Team,
    difficulty: Difficulty,
    quality: QualityPreset,
    mode: GameMode = 'defusal'
  ): void {
    tacticalAudio.unlock();
    this.playerTeam = team;
    this.difficulty = difficulty;
    this.quality = quality;
    this.gameMode = mode;
    this.maxRounds = mode === 'deathmatch' ? 1 : 9;
    this.applyQualitySettings();

    this.roundNumber = 1;
    this.ctScore = 0;
    this.tScore = 0;
    this.playerKills = 0;
    this.playerDeaths = 0;
    this.playerHeadshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.damageDealt = 0;
    this.playerRespawnTimer = 0;
    this.spawnProtectTimer = 0;
    this.killFeed = [];

    this.spawnBots();
    this.gamePhase = 'playing';
    this.keys.clear();
    this.mouseDownLeft = false;
    this.syncBodyState();
    this.pushHud(true);

    // Clear focus from title button so Space/Enter don't re-trigger UI
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  public setQuality(q: QualityPreset): void {
    this.quality = q;
    this.applyQualitySettings();
    this.pushHud(true);
  }

  public setSensitivity(val: number): void {
    this.sensitivity = val;
  }

  public setPaused(paused: boolean): void {
    if (this.gamePhase === 'title' || this.gamePhase === 'gameover') return;
    this.gamePhase = paused ? 'paused' : 'playing';
    if (paused) {
      this.keys.clear();
      this.mouseDownLeft = false;
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
    this.syncBodyState();
    this.pushHud(true);
  }

  public returnToTitle(): void {
    this.gamePhase = 'title';
    this.keys.clear();
    this.mouseDownLeft = false;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.syncBodyState();
    this.pushHud(true);
  }

  public requestPointerLock(): void {
    if (this.gamePhase === 'playing' && !this.pointerLocked) {
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch {
        // Ignore in headless/sandbox environments
      }
    }
  }

  public switchSlot(slot: WeaponSlot): void {
    if (this.gamePhase !== 'playing' || this.playerHp <= 0) return;
    const wid = this.weapons[slot];
    if (!wid) return;
    if (slot === 'utility' && this.ammo.utility.clip <= 0) return;
    this.activeSlot = slot;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.equipViewmodel(wid);
    this.pushHud(true);
  }

  public buyWeapon(weaponId: WeaponId): boolean {
    if (this.gamePhase !== 'playing') return false;
    const freeMode = this.gameMode === 'deathmatch';
    const inZone =
      freeMode || (isInBuyZone(this.playerX, this.playerZ, this.playerTeam) && this.roundPhase === 'buy');
    const check = validateWeaponPurchase(weaponId, this.playerTeam, this.playerMoney, inZone, freeMode);
    if (!check.ok) return false;

    this.playerMoney -= check.cost;
    const spec = WEAPON_SPECS[weaponId];
    this.weapons[spec.slot] = weaponId;
    this.ammo[spec.slot] = { clip: spec.magSize, reserve: spec.reserveMax };
    this.activeSlot = spec.slot;
    this.isReloading = false;
    this.equipViewmodel(weaponId);
    tacticalAudio.playBuy();
    this.pushHud(true);
    return true;
  }

  public buyArmor(withHelmet: boolean): boolean {
    if (this.gamePhase !== 'playing') return false;
    const freeMode = this.gameMode === 'deathmatch';
    const inZone =
      freeMode || (isInBuyZone(this.playerX, this.playerZ, this.playerTeam) && this.roundPhase === 'buy');
    const check = validateArmorPurchase(
      this.playerArmor > 0,
      this.playerHasHelmet,
      this.playerMoney,
      inZone,
      withHelmet,
      freeMode
    );
    if (!check.ok || (!freeMode && check.cost <= 0)) return false;
    this.playerMoney -= check.cost;
    this.playerArmor = 100;
    if (withHelmet) this.playerHasHelmet = true;
    tacticalAudio.playBuy();
    this.pushHud(true);
    return true;
  }

  private triggerReload(): void {
    const wid = this.weapons[this.activeSlot];
    if (!wid) return;
    const spec = WEAPON_SPECS[wid];
    if (spec.magSize <= 0) return;
    const slotAmmo = this.ammo[this.activeSlot];
    if (this.isReloading || slotAmmo.clip >= spec.magSize || slotAmmo.reserve <= 0) return;
    this.isReloading = true;
    this.reloadTotal = spec.reloadTime;
    this.reloadTimer = spec.reloadTime;
    this.isScoped = false;
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
    tacticalAudio.playReload();
  }

  private getForwardVector(yaw: number, pitch: number, out: THREE.Vector3): THREE.Vector3 {
    const cp = Math.cos(pitch);
    out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp).normalize();
    return out;
  }

  private playerFire(): void {
    if (this.playerHp <= 0 || this.isReloading || this.fireCooldown > 0) return;
    const wid = this.weapons[this.activeSlot];
    if (!wid) return;
    const spec = WEAPON_SPECS[wid];
    if (this.gameMode === 'deathmatch') {
      this.spawnProtectTimer = 0;
    }

    if (spec.isGrenade) {
      if (this.ammo.utility.clip <= 0) return;
      this.ammo.utility.clip = 0;
      this.throwGrenade(wid as 'he' | 'smoke' | 'flash');
      this.fireCooldown = spec.fireInterval;
      this.weapons.utility = null;
      this.switchSlot(this.weapons.primary ? 'primary' : 'secondary');
      return;
    }

    if (wid !== 'knife') {
      if (this.ammo[this.activeSlot].clip <= 0) {
        this.triggerReload();
        return;
      }
      this.ammo[this.activeSlot].clip -= 1;
    }

    this.fireCooldown = spec.fireInterval;
    this.viewmodelRecoil = 1;
    this.muzzleFlashTimer = 0.045;
    this.viewmodelMuzzleFlash.visible = wid !== 'knife' && wid !== 'usp';
    tacticalAudio.playShot(wid, 1);

    const hSpeed = Math.hypot(this.playerVx, this.playerVz);
    const spread = computeCrosshairSpread(
      wid,
      hSpeed,
      this.isCrouching,
      this.isGrounded,
      this.recoilHeat,
      this.isScoped
    );

    if (wid !== 'knife') {
      this.shotsFired += 1;
      this.recoilHeat = Math.min(8, this.recoilHeat + 1);
      const kickP = spec.recoilKickPitch * (0.85 + Math.random() * 0.3);
      const kickY = (Math.random() - 0.5) * spec.recoilKickYaw * 2;
      this.playerPitch = Math.max(-1.45, Math.min(1.45, this.playerPitch + kickP));
      this.playerYaw += kickY;
      this.recoilRecoveryPitch += kickP;
      this.recoilRecoveryYaw += kickY;
      this.trauma = Math.min(0.45, this.trauma + (wid === 'awp' ? 0.35 : 0.09));
    }

    // Ray origin at player eye
    const ox = this.playerX;
    const oy = this.playerY + this.eyeHeight;
    const oz = this.playerZ;
    const spreadYaw = (Math.random() - 0.5) * 2 * spread;
    const spreadPitch = (Math.random() - 0.5) * 2 * spread;
    this.getForwardVector(this.playerYaw + spreadYaw, this.playerPitch + spreadPitch, _v1);

    const maxRange = wid === 'knife' ? 2.4 : 130;
    const wallDist = raycastMapDistance(ox, oy, oz, _v1.x, _v1.y, _v1.z, maxRange);

    // Check enemy bots for closest hit
    let hitBot: BotActor | null = null;
    let hitDist = wallDist;
    let hitZone: 'head' | 'body' | 'legs' = 'body';

    for (const bot of this.bots) {
      if (!bot.alive || bot.team === this.playerTeam) continue;
      // Head AABB
      const headHit = rayIntersectsAABB(
        ox,
        oy,
        oz,
        _v1.x,
        _v1.y,
        _v1.z,
        {
          minX: bot.x - 0.18,
          maxX: bot.x + 0.18,
          minY: bot.y + 1.4,
          maxY: bot.y + 1.74,
          minZ: bot.z - 0.18,
          maxZ: bot.z + 0.18,
        },
        hitDist
      );
      if (headHit !== null && headHit < hitDist) {
        hitDist = headHit;
        hitBot = bot;
        hitZone = 'head';
        continue;
      }

      // Torso AABB
      const bodyHit = rayIntersectsAABB(
        ox,
        oy,
        oz,
        _v1.x,
        _v1.y,
        _v1.z,
        {
          minX: bot.x - 0.3,
          maxX: bot.x + 0.3,
          minY: bot.y + 0.72,
          maxY: bot.y + 1.4,
          minZ: bot.z - 0.28,
          maxZ: bot.z + 0.28,
        },
        hitDist
      );
      if (bodyHit !== null && bodyHit < hitDist) {
        hitDist = bodyHit;
        hitBot = bot;
        hitZone = 'body';
        continue;
      }

      // Legs AABB
      const legHit = rayIntersectsAABB(
        ox,
        oy,
        oz,
        _v1.x,
        _v1.y,
        _v1.z,
        {
          minX: bot.x - 0.26,
          maxX: bot.x + 0.26,
          minY: bot.y,
          maxY: bot.y + 0.72,
          minZ: bot.z - 0.24,
          maxZ: bot.z + 0.24,
        },
        hitDist
      );
      if (legHit !== null && legHit < hitDist) {
        hitDist = legHit;
        hitBot = bot;
        hitZone = 'legs';
      }
    }

    const endX = ox + _v1.x * hitDist;
    const endY = oy + _v1.y * hitDist;
    const endZ = oz + _v1.z * hitDist;

    if (wid !== 'knife') {
      // Muzzle tracer offset slightly down-right
      this.spawnTracer(ox + 0.15, oy - 0.08, oz, endX, endY, endZ);
    }

    if (hitBot) {
      this.shotsHit += 1;
      const { hpDamage, armorDamage } = calculateWeaponDamage(
        wid,
        hitDist,
        hitZone,
        hitBot.armor,
        hitBot.hasHelmet
      );
      hitBot.hp = Math.max(0, hitBot.hp - hpDamage);
      hitBot.armor = Math.max(0, hitBot.armor - armorDamage);
      hitBot.hitFlashTimer = 0.07;
      this.damageDealt += hpDamage;
      this.spawnSparkBurst(endX, endY, endZ, hitZone === 'head' ? 14 : 8, 0xef4444);
      tacticalAudio.playHitmarker(hitZone === 'head');

      if (hitBot.hp <= 0) {
        this.handleBotKilled(hitBot, 'You', this.playerTeam, wid, hitZone === 'head');
        this.hitmarkerType = 'kill';
        this.hitstopTimer = 0.035;
      } else {
        this.hitmarkerType = hitZone === 'head' ? 'head' : 'body';
      }
      this.hitmarkerTimer = 0.16;
    } else if (wallDist < maxRange) {
      this.spawnSparkBurst(endX, endY, endZ, 6, 0xfbbf24);
    }

    // Unscope AWP after shot
    if (wid === 'awp' && this.isScoped) {
      this.isScoped = false;
      this.camera.fov = 72;
      this.camera.updateProjectionMatrix();
    }

    if (wid !== 'knife' && this.ammo[this.activeSlot].clip === 0 && this.ammo[this.activeSlot].reserve > 0) {
      this.triggerReload();
    }
  }

  private throwGrenade(type: 'he' | 'smoke' | 'flash'): void {
    this.getForwardVector(this.playerYaw, this.playerPitch, _v1);
    const color = type === 'he' ? 0x3b4d36 : type === 'smoke' ? 0x94a3b8 : 0xf1f5f9;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
    );
    const sx = this.playerX + _v1.x * 0.6;
    const sy = this.playerY + this.eyeHeight - 0.1 + _v1.y * 0.6;
    const sz = this.playerZ + _v1.z * 0.6;
    mesh.position.set(sx, sy, sz);
    this.scene.add(mesh);

    this.grenades.push({
      type,
      ownerId: 'player',
      ownerTeam: this.playerTeam,
      mesh,
      x: sx,
      y: sy,
      z: sz,
      vx: _v1.x * 16 + this.playerVx * 0.3,
      vy: _v1.y * 16 + 3.6,
      vz: _v1.z * 16 + this.playerVz * 0.3,
      fuse: type === 'flash' ? 1.35 : 1.7,
    });
  }

  private detonateGrenade(g: ActiveGrenade): void {
    this.scene.remove(g.mesh);
    g.mesh.geometry.dispose();
    (g.mesh.material as THREE.Material).dispose();

    const playerDist = Math.hypot(g.x - this.playerX, g.z - this.playerZ);
    const atten = Math.max(0.15, 1 - playerDist / 45);

    if (g.type === 'he') {
      tacticalAudio.playExplosion(atten);
      this.spawnSparkBurst(g.x, g.y + 0.3, g.z, 26, 0xf97316);
      this.trauma = Math.min(0.8, this.trauma + Math.max(0, 0.55 - playerDist * 0.025));

      // Damage bots in radius
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        const d = Math.hypot(bot.x - g.x, bot.y + 0.9 - g.y, bot.z - g.z);
        if (d < 7.5 && hasLineOfSight(g.x, g.y + 0.3, g.z, bot.x, bot.y + 1.0, bot.z)) {
          const dmg = Math.round(92 * (1 - d / 7.5));
          bot.hp = Math.max(0, bot.hp - dmg);
          bot.hitFlashTimer = 0.08;
          if (g.ownerId === 'player') {
            this.damageDealt += dmg;
            tacticalAudio.playHitmarker(false);
            this.hitmarkerType = bot.hp <= 0 ? 'kill' : 'body';
            this.hitmarkerTimer = 0.18;
          }
          if (bot.hp <= 0) {
            this.handleBotKilled(bot, 'You', this.playerTeam, 'he', false);
          }
        }
      }
      // Self/player blast damage
      if (this.playerHp > 0 && playerDist < 6.5 && hasLineOfSight(g.x, g.y + 0.3, g.z, this.playerX, this.playerY + 1.0, this.playerZ)) {
        const dmg = Math.round(55 * (1 - playerDist / 6.5));
        this.damagePlayer(dmg, g.ownerId, g.ownerTeam, 'he', false);
      }
    } else if (g.type === 'smoke') {
      tacticalAudio.playExplosion(atten * 0.45);
      const smokeGroup = new THREE.Group();
      const smokeMat = new THREE.MeshStandardMaterial({
        color: 0xdbe2ea,
        roughness: 0.95,
        metalness: 0,
        transparent: true,
        opacity: 0.88,
      });
      const puffOffsets = [
        [0, 1.1, 0, 2.2],
        [-1.3, 0.9, 0.8, 1.8],
        [1.3, 0.9, -0.7, 1.85],
        [0.5, 1.5, 1.2, 1.7],
        [-0.7, 1.4, -1.1, 1.7],
      ];
      for (const [px, py, pz, r] of puffOffsets) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), smokeMat);
        puff.position.set(px, py, pz);
        smokeGroup.add(puff);
      }
      smokeGroup.position.set(g.x, g.y, g.z);
      this.scene.add(smokeGroup);
      this.smokes.push({ group: smokeGroup, x: g.x, y: g.y, z: g.z, radius: 3.4, life: 12 });
    } else if (g.type === 'flash') {
      tacticalAudio.playExplosion(atten * 0.65);
      this.spawnSparkBurst(g.x, g.y + 0.3, g.z, 18, 0xffffff);
      // Blind bots in LOS
      for (const bot of this.bots) {
        if (!bot.alive) continue;
        const d = Math.hypot(bot.x - g.x, bot.z - g.z);
        if (d < 18 && hasLineOfSight(g.x, g.y + 0.2, g.z, bot.x, bot.y + 1.5, bot.z)) {
          bot.flashTimer = Math.max(bot.flashTimer, 3.2 * (1 - d / 22));
        }
      }
      // Flash player if looking toward flashbang
      if (playerDist < 20 && hasLineOfSight(g.x, g.y + 0.2, g.z, this.playerX, this.playerY + this.eyeHeight, this.playerZ)) {
        this.getForwardVector(this.playerYaw, this.playerPitch, _v1);
        _v2.set(g.x - this.playerX, g.y - (this.playerY + this.eyeHeight), g.z - this.playerZ).normalize();
        const dot = _v1.dot(_v2);
        if (dot > 0.25) {
          this.flashAlpha = Math.min(1, 0.95 * dot);
        }
      }
    }
  }

  private handleBotKilled(
    bot: BotActor,
    killerName: string,
    killerTeam: Team,
    weaponId: WeaponId,
    headshot: boolean
  ): void {
    bot.alive = false;
    bot.deaths += 1;
    bot.deathTimer = this.gameMode === 'deathmatch' ? 0.25 : 0.45;
    if (killerName === 'You') {
      this.playerKills += 1;
      if (headshot) this.playerHeadshots += 1;
      this.playerMoney = Math.min(16000, this.playerMoney + WEAPON_SPECS[weaponId].killReward);
      if (this.gameMode === 'deathmatch' && this.playerHp > 0) {
        this.playerHp = Math.min(100, this.playerHp + 25);
      }
    }

    if (this.gameMode === 'deathmatch') {
      if (killerTeam === 'CT') this.ctScore += 1;
      else this.tScore += 1;
    } else if (this.bomb.status === 'carried' && this.bomb.carrierId === bot.id) {
      // Drop bomb if carrier died in Defusal
      this.bomb.status = 'dropped';
      this.bomb.carrierId = null;
      this.bomb.x = bot.x;
      this.bomb.y = bot.y;
      this.bomb.z = bot.z;
    }

    this.killFeed.unshift({
      id: this.nextKillId++,
      killerName,
      killerTeam,
      victimName: bot.name,
      victimTeam: bot.team,
      weaponId,
      headshot,
      timestamp: performance.now(),
    });
    if (this.killFeed.length > 5) this.killFeed.pop();
    if (this.gameMode !== 'deathmatch') {
      this.checkRoundEndConditions();
    }
  }

  private damagePlayer(
    rawDmg: number,
    attackerName: string,
    attackerTeam: Team,
    weaponId: WeaponId,
    headshot: boolean
  ): void {
    if (this.playerHp <= 0 || this.roundPhase === 'round_end') return;
    if (this.gameMode === 'deathmatch' && this.spawnProtectTimer > 0) return;

    this.playerHp = Math.max(0, this.playerHp - rawDmg);
    this.damageFlash = 0.65;
    this.trauma = Math.min(0.75, this.trauma + 0.32);

    if (this.playerHp <= 0) {
      this.playerDeaths += 1;
      this.isScoped = false;
      this.camera.fov = 72;
      this.camera.updateProjectionMatrix();

      if (this.gameMode === 'deathmatch') {
        if (attackerName !== 'player' && attackerTeam !== this.playerTeam) {
          if (attackerTeam === 'CT') this.ctScore += 1;
          else this.tScore += 1;
        }
        this.playerRespawnTimer = 0.15;
      } else if (this.bomb.status === 'carried' && this.bomb.carrierId === 'player') {
        this.bomb.status = 'dropped';
        this.bomb.carrierId = null;
        this.bomb.x = this.playerX;
        this.bomb.y = this.playerY;
        this.bomb.z = this.playerZ;
      }

      this.killFeed.unshift({
        id: this.nextKillId++,
        killerName: attackerName === 'player' ? 'You' : attackerName,
        killerTeam: attackerTeam,
        victimName: 'You',
        victimTeam: this.playerTeam,
        weaponId,
        headshot,
        timestamp: performance.now(),
      });
      if (this.killFeed.length > 5) this.killFeed.pop();
      if (this.gameMode !== 'deathmatch') {
        this.checkRoundEndConditions();
      }
    }
  }

  private checkRoundEndConditions(): void {
    if (this.gameMode === 'deathmatch' || this.roundPhase === 'round_end') return;
    const aliveCT = (this.playerTeam === 'CT' && this.playerHp > 0 ? 1 : 0) +
      this.bots.filter((b) => b.team === 'CT' && b.alive).length;
    const aliveT = (this.playerTeam === 'T' && this.playerHp > 0 ? 1 : 0) +
      this.bots.filter((b) => b.team === 'T' && b.alive).length;

    if (aliveT === 0 && this.bomb.status !== 'planted') {
      this.endRound('CT', 'Counter-Terrorists Win', 'Terrorist squad eliminated');
    } else if (aliveCT === 0) {
      this.endRound('T', 'Terrorists Win', 'Counter-Terrorist squad eliminated');
    }
  }

  private endRound(winner: Team, title: string, subtitle: string): void {
    if (this.roundPhase === 'round_end') return;
    this.roundPhase = 'round_end';
    this.roundEndTimer = 3.6;
    if (winner === 'CT') this.ctScore += 1;
    else this.tScore += 1;

    this.roundBanner = { title, subtitle, team: winner };
    const playerWonRound = winner === this.playerTeam;
    this.playerMoney = Math.min(16000, this.playerMoney + (playerWonRound ? 3250 : 2100));
    tacticalAudio.playRoundEnd(playerWonRound);

    const matchWinner = checkMatchWinner(this.ctScore, this.tScore, 5);
    if (matchWinner) {
      this.roundEndTimer = 1.6; // Shorter pause before match summary modal
    }
    this.pushHud(true);
  }

  private isObstructedBySmoke(ax: number, az: number, bx: number, bz: number): boolean {
    for (const s of this.smokes) {
      // Closest point on segment AB to smoke center
      const dx = bx - ax;
      const dz = bz - az;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 1e-4) continue;
      const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.z - az) * dz) / lenSq));
      const cx = ax + t * dx;
      const cz = az + t * dz;
      if (Math.hypot(cx - s.x, cz - s.z) < s.radius * 0.85) return true;
    }
    return false;
  }

  private updatePlayer(dt: number): void {
    if (this.spawnProtectTimer > 0) {
      this.spawnProtectTimer = Math.max(0, this.spawnProtectTimer - dt);
    }

    // Allow fallback arrow-key aiming for laptops/headless testing
    const lookSpeed = 1.9;
    if (this.keys.has('ArrowLeft')) this.playerYaw += lookSpeed * dt;
    if (this.keys.has('ArrowRight')) this.playerYaw -= lookSpeed * dt;
    if (this.keys.has('ArrowUp')) this.playerPitch = Math.min(1.4, this.playerPitch + lookSpeed * 0.75 * dt);
    if (this.keys.has('ArrowDown')) this.playerPitch = Math.max(-1.4, this.playerPitch - lookSpeed * 0.75 * dt);

    if (this.playerHp <= 0) {
      if (this.gameMode === 'deathmatch') {
        this.playerRespawnTimer -= dt;
        if (this.playerRespawnTimer <= 0) {
          this.respawnPlayerDeathmatch();
          return;
        }
      }
      // Dead spectator tilt
      this.camera.position.set(this.playerX, this.playerY + 0.45, this.playerZ);
      this.camera.rotation.set(this.playerPitch, this.playerYaw, 0.25, 'YXZ');
      this.viewmodelPivot.visible = false;
      return;
    }
    this.viewmodelPivot.visible = !this.isScoped;

    const crouchHeld = this.keys.has('ControlLeft') || this.keys.has('KeyC');
    this.isCrouching = crouchHeld;
    const targetEye = crouchHeld ? 1.12 : 1.65;
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 14, dt);

    const wid = this.weapons[this.activeSlot] || 'knife';
    const spec = WEAPON_SPECS[wid];
    let maxSpeed = 6.4 * spec.moveSpeedMultiplier;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) maxSpeed *= 0.54;
    if (crouchHeld) maxSpeed *= 0.52;
    if (this.isScoped) maxSpeed *= 0.55;

    // Input direction in camera horizontal plane
    let fInput = 0;
    let rInput = 0;
    if (this.keys.has('KeyW')) fInput += 1;
    if (this.keys.has('KeyS')) fInput -= 1;
    if (this.keys.has('KeyD')) rInput += 1;
    if (this.keys.has('KeyA')) rInput -= 1;

    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);
    // Forward is (-sinY, -cosY), Right is (cosY, -sinY)
    let wishX = -sinY * fInput + cosY * rInput;
    let wishZ = -cosY * fInput - sinY * rInput;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1e-4) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const accel = this.isGrounded ? 44 : 10;
    const friction = this.isGrounded ? 10 : 1.2;

    if (wishLen > 0) {
      this.playerVx += wishX * accel * dt;
      this.playerVz += wishZ * accel * dt;
    } else if (this.isGrounded) {
      const drop = Math.exp(-friction * dt);
      this.playerVx *= drop;
      this.playerVz *= drop;
    }

    const curSpeed = Math.hypot(this.playerVx, this.playerVz);
    if (curSpeed > maxSpeed) {
      this.playerVx = (this.playerVx / curSpeed) * maxSpeed;
      this.playerVz = (this.playerVz / curSpeed) * maxSpeed;
    }

    // Jump
    if (this.keys.has('Space') && this.isGrounded) {
      this.playerVy = 6.2;
      this.isGrounded = false;
    }
    this.playerVy -= 18.5 * dt;

    const nextX = this.playerX + this.playerVx * dt;
    const nextZ = this.playerZ + this.playerVz * dt;
    const resolved = resolveCircleMovement(nextX, this.playerY, nextZ, 0.42);
    this.playerX = resolved.x;
    this.playerZ = resolved.z;

    this.playerY += this.playerVy * dt;
    const floorH = groundHeightAt(this.playerX, this.playerZ);
    if (this.playerY <= floorH) {
      this.playerY = floorH;
      this.playerVy = 0;
      this.isGrounded = true;
    } else if (this.playerY > floorH + 0.05) {
      this.isGrounded = false;
    }

    // Footstep audio & weapon walk bob
    const moveSpeed = Math.hypot(this.playerVx, this.playerVz);
    if (this.isGrounded && moveSpeed > 3.9 && !crouchHeld) {
      tacticalAudio.playFootstep();
    }
    if (this.isGrounded && moveSpeed > 0.3) {
      this.walkBobPhase += moveSpeed * dt * 2.1;
    }

    if (this.gameMode !== 'deathmatch') {
      // Pick up dropped bomb if T
      if (
        this.playerTeam === 'T' &&
        this.bomb.status === 'dropped' &&
        Math.hypot(this.playerX - this.bomb.x, this.playerZ - this.bomb.z) < 1.3
      ) {
        this.bomb.status = 'carried';
        this.bomb.carrierId = 'player';
      }

      // Bomb Plant (T with E) or Defuse (CT with E)
      const siteHere = getBombSiteAt(this.playerX, this.playerZ);
      if (this.keys.has('KeyE') && this.roundPhase !== 'round_end') {
        if (this.playerTeam === 'T' && this.bomb.status === 'carried' && this.bomb.carrierId === 'player' && siteHere) {
          this.bomb.plantProgress = Math.min(1, this.bomb.plantProgress + dt / 2.6);
          if (this.bomb.plantProgress >= 1) {
            this.plantBomb(siteHere, this.playerX, this.playerY, this.playerZ);
          }
        } else if (
          this.playerTeam === 'CT' &&
          this.bomb.status === 'planted' &&
          Math.hypot(this.playerX - this.bomb.x, this.playerZ - this.bomb.z) < 2.3
        ) {
          this.bomb.defuseProgress = Math.min(1, this.bomb.defuseProgress + dt / 4.2);
          if (this.bomb.defuseProgress >= 1) {
            this.bomb.status = 'defused';
            this.endRound('CT', 'Bomb Defused', 'Counter-Terrorists Win');
          }
        }
      } else {
        this.bomb.plantProgress = Math.max(0, this.bomb.plantProgress - dt * 2);
        this.bomb.defuseProgress = Math.max(0, this.bomb.defuseProgress - dt * 2);
      }
    }

    // Reloading & firing timers
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const slotAmmo = this.ammo[this.activeSlot];
        const need = spec.magSize - slotAmmo.clip;
        const take = Math.min(need, slotAmmo.reserve);
        slotAmmo.clip += take;
        slotAmmo.reserve -= take;
      }
    }

    if (this.mouseDownLeft) {
      if (spec.automatic || !this.semiFiredThisPress) {
        this.playerFire();
        this.semiFiredThisPress = true;
      }
    } else {
      this.semiFiredThisPress = false;
    }

    // Recoil recovery & decay
    this.recoilHeat = Math.max(0, this.recoilHeat - dt * 7.5);
    if (!this.mouseDownLeft && this.recoilRecoveryPitch > 0.0005) {
      const recP = this.recoilRecoveryPitch * Math.min(1, dt * 8);
      const recY = this.recoilRecoveryYaw * Math.min(1, dt * 8);
      this.playerPitch = Math.max(-1.45, Math.min(1.45, this.playerPitch - recP));
      this.playerYaw -= recY;
      this.recoilRecoveryPitch -= recP;
      this.recoilRecoveryYaw -= recY;
    }

    // Camera + trauma shake
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const shake = this.trauma * this.trauma * 0.035;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    this.camera.position.set(this.playerX, this.playerY + this.eyeHeight, this.playerZ);
    this.camera.rotation.set(this.playerPitch + sx, this.playerYaw + sy, 0, 'YXZ');

    // Viewmodel recoil, walk bob & reload animation
    this.viewmodelRecoil = THREE.MathUtils.damp(this.viewmodelRecoil, 0, 18, dt);
    this.viewmodelEquipAnim = THREE.MathUtils.damp(this.viewmodelEquipAnim, 0, 14, dt);
    const bobX = Math.cos(this.walkBobPhase * 0.5) * (moveSpeed / 6.5) * 0.012;
    const bobY = Math.abs(Math.sin(this.walkBobPhase)) * (moveSpeed / 6.5) * 0.012;
    const reloadDip = this.isReloading ? Math.sin((this.reloadTimer / Math.max(0.1, this.reloadTotal)) * Math.PI) * 0.14 : 0;

    this.viewmodelPivot.position.set(
      bobX,
      -bobY - reloadDip - this.viewmodelEquipAnim * 0.16,
      this.viewmodelRecoil * 0.065
    );
    this.viewmodelPivot.rotation.set(
      this.viewmodelRecoil * 0.11 - reloadDip * 1.6,
      0,
      -this.viewmodelEquipAnim * 0.35
    );

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) this.viewmodelMuzzleFlash.visible = false;
    }
  }

  private plantBomb(site: 'A' | 'B', x: number, y: number, z: number): void {
    this.bomb.status = 'planted';
    this.bomb.carrierId = null;
    this.bomb.site = site;
    this.bomb.x = x;
    this.bomb.y = y;
    this.bomb.z = z;
    this.bomb.timer = 35;
    this.bomb.plantProgress = 0;
    this.roundPhase = 'planted';
    this.plantedBombVisual.group.position.set(x, y, z);
    this.plantedBombVisual.group.visible = true;
    this.roundBanner = {
      title: `Bomb Planted at Site ${site}`,
      subtitle: '35s until detonation',
      team: 'T',
    };
    tacticalAudio.playBombBeep(true);
  }

  private updateBots(dt: number): void {
    this.attackTokenCount = 0;
    const isComp = this.difficulty === 'competitive';
    const reactionDelay = isComp ? 0.22 : 0.44;
    const accuracyJitter = isComp ? 0.045 : 0.085;

    const deathAnimDur = this.gameMode === 'deathmatch' ? 0.25 : 0.45;
    for (const bot of this.bots) {
      if (!bot.alive) {
        if (bot.deathTimer > 0) {
          bot.deathTimer = Math.max(0, bot.deathTimer - dt);
          const p = 1 - bot.deathTimer / deathAnimDur;
          bot.rig.bodyGroup.rotation.x = -p * (Math.PI / 2);
          bot.rig.bodyGroup.position.y = p * 0.22;
        } else if (this.gameMode === 'deathmatch') {
          this.respawnBotDeathmatch(bot);
        } else {
          bot.rig.root.visible = false;
        }
        continue;
      }

      if (bot.hitFlashTimer > 0) {
        bot.hitFlashTimer -= dt;
        const c = bot.hitFlashTimer > 0 ? 0xffffff : 0x000000;
        for (const m of bot.rig.hitFlashMaterials) m.emissive.setHex(c);
      }
      if (bot.flashTimer > 0) {
        bot.flashTimer = Math.max(0, bot.flashTimer - dt);
      }
      if (bot.fireCooldown > 0) bot.fireCooldown -= dt;

      // Determine visible enemies (player + opposing bots)
      let bestTarget: { x: number; y: number; z: number; dist: number; isPlayer: boolean; botRef?: BotActor } | null = null;
      if (bot.flashTimer <= 0.3) {
        if (bot.team !== this.playerTeam && this.playerHp > 0) {
          const d = Math.hypot(this.playerX - bot.x, this.playerZ - bot.z);
          if (
            d < 46 &&
            !this.isObstructedBySmoke(bot.x, bot.z, this.playerX, this.playerZ) &&
            hasLineOfSight(bot.x, bot.y + 1.5, bot.z, this.playerX, this.playerY + 1.45, this.playerZ)
          ) {
            bestTarget = { x: this.playerX, y: this.playerY + 1.35, z: this.playerZ, dist: d, isPlayer: true };
          }
        }
        for (const other of this.bots) {
          if (!other.alive || other.team === bot.team) continue;
          const d = Math.hypot(other.x - bot.x, other.z - bot.z);
          if (
            d < 44 &&
            (!bestTarget || d < bestTarget.dist) &&
            !this.isObstructedBySmoke(bot.x, bot.z, other.x, other.z) &&
            hasLineOfSight(bot.x, bot.y + 1.5, bot.z, other.x, other.y + 1.4, other.z)
          ) {
            bestTarget = { x: other.x, y: other.y + 1.3, z: other.z, dist: d, isPlayer: false, botRef: other };
          }
        }
      }

      if (bestTarget && this.attackTokenCount < 4) {
        this.attackTokenCount += 1;
        // Aim smoothly toward target
        const desiredYaw = Math.atan2(bestTarget.x - bot.x, bestTarget.z - bot.z);
        let diff = desiredYaw - bot.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.yaw += diff * Math.min(1, dt * 10);

        bot.reactionTimer += dt;
        // Stop/strafe while shooting (snipers hold steady, entry bots slow-strafe)
        bot.vx *= Math.exp(-8 * dt);
        bot.vz *= Math.exp(-8 * dt);

        if (bot.reactionTimer >= reactionDelay && bot.fireCooldown <= 0) {
          const spec = WEAPON_SPECS[bot.weaponId];
          bot.fireCooldown = spec.fireInterval * (bot.weaponId === 'awp' ? 1.2 : 1.7);
          const distToPlayer = Math.hypot(bot.x - this.playerX, bot.z - this.playerZ);
          tacticalAudio.playShot(bot.weaponId, Math.max(0.05, 1 - distToPlayer / 55));

          bot.rig.flashMesh.visible = true;
          setTimeout(() => {
            if (!this.disposed) bot.rig.flashMesh.visible = false;
          }, 45);

          // Tracer + hit check
          const ox = bot.x;
          const oy = bot.y + 1.45;
          const oz = bot.z;
          _v1.set(
            bestTarget.x - ox + (Math.random() - 0.5) * accuracyJitter * bestTarget.dist,
            bestTarget.y - oy + (Math.random() - 0.5) * accuracyJitter * bestTarget.dist,
            bestTarget.z - oz + (Math.random() - 0.5) * accuracyJitter * bestTarget.dist
          ).normalize();

          const wallD = raycastMapDistance(ox, oy, oz, _v1.x, _v1.y, _v1.z, bestTarget.dist + 2);
          this.spawnTracer(ox, oy, oz, ox + _v1.x * Math.min(wallD, bestTarget.dist), oy + _v1.y * Math.min(wallD, bestTarget.dist), oz + _v1.z * Math.min(wallD, bestTarget.dist));

          if (wallD >= bestTarget.dist - 0.5) {
            const hitRoll = Math.random();
            const hitChance = Math.max(0.18, (isComp ? 0.62 : 0.42) - bestTarget.dist * 0.008);
            if (hitRoll < hitChance) {
              const isHead = Math.random() < (isComp ? 0.22 : 0.12);
              const hitZone = isHead ? 'head' : 'body';
              if (bestTarget.isPlayer) {
                const { hpDamage, armorDamage } = calculateWeaponDamage(
                  bot.weaponId,
                  bestTarget.dist,
                  hitZone,
                  this.playerArmor,
                  this.playerHasHelmet
                );
                this.playerArmor = Math.max(0, this.playerArmor - armorDamage);
                this.damagePlayer(hpDamage, bot.name, bot.team, bot.weaponId, isHead);
              } else if (bestTarget.botRef) {
                const target = bestTarget.botRef;
                const { hpDamage, armorDamage } = calculateWeaponDamage(
                  bot.weaponId,
                  bestTarget.dist,
                  hitZone,
                  target.armor,
                  target.hasHelmet
                );
                target.hp = Math.max(0, target.hp - hpDamage);
                target.armor = Math.max(0, target.armor - armorDamage);
                target.hitFlashTimer = 0.06;
                if (target.hp <= 0) {
                  bot.kills += 1;
                  this.handleBotKilled(target, bot.name, bot.team, bot.weaponId, isHead);
                }
              }
            }
          }
        }
      } else {
        bot.reactionTimer = Math.max(0, bot.reactionTimer - dt * 2);
        // Tactical navigation by role & bomb state
        let destX = 0;
        let destZ = 0;

        if (this.bomb.status === 'planted') {
          // Both teams converge on planted bomb!
          destX = this.bomb.x;
          destZ = this.bomb.z;
          // CT bot attempts defuse if right next to bomb
          if (bot.team === 'CT' && Math.hypot(bot.x - this.bomb.x, bot.z - this.bomb.z) < 2.0) {
            this.bomb.defuseProgress += dt / 5.0;
            if (this.bomb.defuseProgress >= 1) {
              this.bomb.status = 'defused';
              this.endRound('CT', 'Bomb Defused', 'CT teammate defused the C4');
            }
          }
        } else {
          // Follow waypoint graph toward role objective
          const wp = this.waypointMap.get(bot.targetWaypointId) || MAP_WAYPOINTS[0];
          destX = wp.x;
          destZ = wp.z;

          if (Math.hypot(bot.x - wp.x, bot.z - wp.z) < 2.2) {
            bot.waypointId = wp.id;
            // T bomb carrier plants at site
            if (
              bot.team === 'T' &&
              this.bomb.status === 'carried' &&
              this.bomb.carrierId === bot.id
            ) {
              const s = getBombSiteAt(bot.x, bot.z);
              if (s) {
                this.plantBomb(s, bot.x, bot.y, bot.z);
                continue;
              }
            }
            // Pick next waypoint based on role
            const neighbors = wp.neighbors;
            let chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
            const goalTag =
              bot.role === 'sniper'
                ? 'mid'
                : bot.goalSite === 'A'
                ? 'a_site'
                : 'b_site';
            const goalSitePos = bot.goalSite === 'A' ? BOMB_SITES[0] : BOMB_SITES[1];
            let bestScore = Infinity;
            for (const nid of neighbors) {
              const nw = this.waypointMap.get(nid);
              if (!nw) continue;
              const dGoal =
                bot.role === 'sniper'
                  ? Math.hypot(nw.x - 0, nw.z - (bot.team === 'CT' ? 8 : -10))
                  : Math.hypot(nw.x - goalSitePos.x, nw.z - goalSitePos.z);
              const jitter = bot.role === 'flanker' ? Math.random() * 16 : Math.random() * 6;
              if (nw.tag === goalTag) {
                if (dGoal - 8 + jitter < bestScore) {
                  bestScore = dGoal - 8 + jitter;
                  chosen = nid;
                }
              } else if (dGoal + jitter < bestScore) {
                bestScore = dGoal + jitter;
                chosen = nid;
              }
            }
            bot.targetWaypointId = chosen;
          }
        }

        const dx = destX - bot.x;
        const dz = destZ - bot.z;
        const dLen = Math.hypot(dx, dz);
        const speed = bot.role === 'sniper' ? 3.9 : 4.6;
        if (dLen > 0.4) {
          bot.vx = (dx / dLen) * speed;
          bot.vz = (dz / dLen) * speed;
          const desiredYaw = Math.atan2(dx, dz);
          let diff = desiredYaw - bot.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          bot.yaw += diff * Math.min(1, dt * 7);
        } else {
          bot.vx = 0;
          bot.vz = 0;
        }
      }

      const res = resolveCircleMovement(bot.x + bot.vx * dt, bot.y, bot.z + bot.vz * dt, 0.42);
      bot.x = res.x;
      bot.z = res.z;
      bot.y = groundHeightAt(bot.x, bot.z);
      bot.rig.root.position.set(bot.x, bot.y, bot.z);
      bot.rig.root.rotation.y = bot.yaw;

      const bSpeed = Math.hypot(bot.vx, bot.vz);
      if (bSpeed > 0.2) {
        bot.walkPhase += bSpeed * dt * 2.2;
        const swing = Math.sin(bot.walkPhase) * 0.45;
        bot.rig.leftLeg.rotation.x = swing;
        bot.rig.rightLeg.rotation.x = -swing;
      } else {
        bot.rig.leftLeg.rotation.x = THREE.MathUtils.damp(bot.rig.leftLeg.rotation.x, 0, 10, dt);
        bot.rig.rightLeg.rotation.x = THREE.MathUtils.damp(bot.rig.rightLeg.rotation.x, 0, 10, dt);
      }

      if (this.bomb.status === 'carried' && this.bomb.carrierId === bot.id) {
        this.bomb.x = bot.x;
        this.bomb.y = bot.y;
        this.bomb.z = bot.z;
      }
    }
  }

  private updateEffectsAndWorld(dt: number): void {
    // Sparks
    for (const sp of this.sparkPool) {
      if (sp.life <= 0) continue;
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.mesh.visible = false;
        continue;
      }
      sp.vy -= 14 * dt;
      sp.mesh.position.x += sp.vx * dt;
      sp.mesh.position.y = Math.max(0.03, sp.mesh.position.y + sp.vy * dt);
      sp.mesh.position.z += sp.vz * dt;
      const s = sp.life / sp.maxLife;
      sp.mesh.scale.setScalar(s);
    }

    // Tracers
    for (const tr of this.tracerPool) {
      if (tr.life <= 0) continue;
      tr.life -= dt;
      if (tr.life <= 0) tr.line.visible = false;
    }

    // Grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vy -= 17 * dt;
      const nx = g.x + g.vx * dt;
      const nz = g.z + g.vz * dt;
      const res = resolveCircleMovement(nx, g.y, nz, 0.15);
      if (Math.abs(res.x - nx) > 0.02) g.vx *= -0.55;
      if (Math.abs(res.z - nz) > 0.02) g.vz *= -0.55;
      g.x = res.x;
      g.z = res.z;
      g.y += g.vy * dt;
      const floor = groundHeightAt(g.x, g.z) + 0.1;
      if (g.y < floor) {
        g.y = floor;
        g.vy = Math.abs(g.vy) * 0.42;
        g.vx *= 0.72;
        g.vz *= 0.72;
      }
      g.mesh.position.set(g.x, g.y, g.z);
      if (g.fuse <= 0) {
        this.grenades.splice(i, 1);
        this.detonateGrenade(g);
      }
    }

    // Smokes
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.life -= dt;
      if (s.life < 1.8) {
        const sc = Math.max(0.05, s.life / 1.8);
        s.group.scale.setScalar(sc);
      }
      if (s.life <= 0) {
        this.scene.remove(s.group);
        this.smokes.splice(i, 1);
      }
    }

    // Screen flashes & hitmarkers
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 0.45);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) this.hitmarkerType = 'none';
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (rawDt > 0.001) {
      this.fpsSamples.push(1 / rawDt);
      if (this.fpsSamples.length > 20) this.fpsSamples.shift();
      this.currentFps = Math.round(
        this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length
      );
    }

    if (this.gamePhase === 'title') {
      // Smooth orbital flyover overlooking Mid Double Doors, A Site & B Site
      this.titleOrbitAngle += dt * 0.16;
      const radius = 28;
      this.camera.position.set(
        Math.cos(this.titleOrbitAngle) * radius,
        11.5 + Math.sin(this.titleOrbitAngle * 2) * 1.8,
        Math.sin(this.titleOrbitAngle) * radius
      );
      this.camera.lookAt(0, 1.5, 2);
      this.viewmodelPivot.visible = false;
      // Gentle ambient bot idle/patrol
      for (const b of this.bots) {
        b.rig.root.rotation.y += dt * 0.2;
      }
    } else if (this.gamePhase === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
        this.updateEffectsAndWorld(dt);
      } else if (this.gameMode === 'deathmatch') {
        this.roundTimer -= dt;
        if (this.roundTimer <= 176.5 && this.roundBanner?.title === 'Deathmatch') {
          this.roundBanner = null;
        }
        if (this.roundTimer <= 0) {
          this.gamePhase = 'gameover';
          if (document.pointerLockElement) document.exitPointerLock?.();
          this.syncBodyState();
          this.pushHud(true);
        } else {
          this.updatePlayer(dt);
          this.updateBots(dt);
          this.updateEffectsAndWorld(dt);
        }
      } else {
        // Round state timers
        if (this.roundPhase === 'buy') {
          this.buyTimer -= dt;
          if (this.buyTimer <= 13.5 && this.roundBanner?.title.startsWith('Round')) {
            this.roundBanner = null;
          }
          if (this.buyTimer <= 0) {
            this.roundPhase = 'live';
            this.roundBanner = null;
          }
        }
        if (this.roundPhase === 'live' || this.roundPhase === 'buy') {
          this.roundTimer -= dt;
          if (this.roundTimer <= 0 && this.bomb.status !== 'planted') {
            this.endRound('CT', 'Time Expired', 'Counter-Terrorists defended the sites');
          }
        } else if (this.roundPhase === 'planted') {
          this.bomb.timer -= dt;
          const beepInterval = this.bomb.timer < 8 ? 0.28 : this.bomb.timer < 18 ? 0.55 : 0.95;
          this.bombBeepAccum += dt;
          if (this.bombBeepAccum >= beepInterval) {
            this.bombBeepAccum = 0;
            this.plantedBombVisual.ledMesh.visible = !this.plantedBombVisual.ledMesh.visible;
            tacticalAudio.playBombBeep(this.bomb.timer < 8);
          }
          if (this.bomb.timer <= 0) {
            this.bomb.status = 'exploded';
            this.plantedBombVisual.group.visible = false;
            tacticalAudio.playExplosion(1);
            this.spawnSparkBurst(this.bomb.x, this.bomb.y + 0.5, this.bomb.z, 36, 0xf97316);
            this.endRound('T', 'Target Destroyed', 'Terrorists Win');
          }
        } else if (this.roundPhase === 'round_end') {
          this.roundEndTimer -= dt;
          if (this.roundEndTimer <= 0) {
            const matchWinner = checkMatchWinner(this.ctScore, this.tScore, 5);
            if (matchWinner) {
              this.gamePhase = 'gameover';
              if (document.pointerLockElement) document.exitPointerLock?.();
              this.syncBodyState();
              this.pushHud(true);
            } else {
              this.roundNumber += 1;
              this.resetRoundPositions(false);
            }
          }
        }

        this.updatePlayer(dt);
        this.updateBots(dt);
        this.updateEffectsAndWorld(dt);
      }

      this.hudThrottle += dt;
      if (this.hudThrottle >= 0.085) {
        this.hudThrottle = 0;
        this.pushHud(false);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (sync && state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(this.tick, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private syncBodyState(): void {
    document.body.dataset.state = this.gamePhase;
  }

  private pushHud(force: boolean): void {
    if (!force && this.gamePhase === 'title') return;
    const wid = this.weapons[this.activeSlot] || 'knife';
    const hSpeed = Math.hypot(this.playerVx, this.playerVz);
    const spread = computeCrosshairSpread(
      wid,
      hSpeed,
      this.isCrouching,
      this.isGrounded,
      this.recoilHeat,
      this.isScoped
    );

    const radarBlips: RadarBlip[] = [
      {
        id: 'player',
        x: this.playerX,
        z: this.playerZ,
        team: this.playerTeam,
        alive: this.playerHp > 0,
        isPlayer: true,
        yaw: this.playerYaw,
      },
      ...this.bots.map((b) => {
        const isFriendly = b.team === this.playerTeam;
        const spotted =
          isFriendly ||
          (b.alive &&
            this.playerHp > 0 &&
            Math.hypot(b.x - this.playerX, b.z - this.playerZ) < 38 &&
            hasLineOfSight(this.playerX, this.playerY + 1.5, this.playerZ, b.x, b.y + 1.4, b.z));
        return {
          id: b.id,
          x: b.x,
          z: b.z,
          team: b.team,
          alive: b.alive,
          spotted,
        };
      }),
    ];

    const ctBots = this.bots.filter((b) => b.team === 'CT');
    const tBots = this.bots.filter((b) => b.team === 'T');
    const ctAlivePips = [
      ...(this.playerTeam === 'CT' ? [this.playerHp > 0] : []),
      ...ctBots.map((b) => b.alive),
    ];
    const tAlivePips = [
      ...(this.playerTeam === 'T' ? [this.playerHp > 0] : []),
      ...tBots.map((b) => b.alive),
    ];

    const scoreboard: ScoreboardEntry[] = [
      {
        id: 'player',
        name: 'You',
        team: this.playerTeam,
        alive: this.playerHp > 0,
        kills: this.playerKills,
        deaths: this.playerDeaths,
        assists: 0,
        money: this.playerMoney,
        isPlayer: true,
      },
      ...this.bots.map((b) => ({
        id: b.id,
        name: b.name,
        team: b.team,
        alive: b.alive,
        kills: b.kills,
        deaths: b.deaths,
        assists: b.assists,
        money: b.money,
        isPlayer: false,
      })),
    ];

    const inSite = getBombSiteAt(this.playerX, this.playerZ);
    const canDefuse =
      this.playerTeam === 'CT' &&
      this.playerHp > 0 &&
      this.bomb.status === 'planted' &&
      Math.hypot(this.playerX - this.bomb.x, this.playerZ - this.bomb.z) < 2.3;

    this.onHudUpdate({
      gamePhase: this.gamePhase,
      gameMode: this.gameMode,
      roundPhase: this.roundPhase,
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds,
      ctScore: this.ctScore,
      tScore: this.tScore,
      roundTimer: Math.max(0, Math.ceil(this.roundTimer)),
      buyTimer: Math.max(0, Math.ceil(this.buyTimer)),
      spawnProtected: this.gameMode === 'deathmatch' && this.spawnProtectTimer > 0,
      playerTeam: this.playerTeam,
      hp: Math.round(this.playerHp),
      armor: Math.round(this.playerArmor),
      hasHelmet: this.playerHasHelmet,
      money: this.playerMoney,
      inBuyZone:
        this.gameMode === 'deathmatch' ||
        (isInBuyZone(this.playerX, this.playerZ, this.playerTeam) && this.roundPhase === 'buy'),
      activeSlot: this.activeSlot,
      weapons: { ...this.weapons },
      ammo: {
        primary: { ...this.ammo.primary },
        secondary: { ...this.ammo.secondary },
        knife: { ...this.ammo.knife },
        utility: { ...this.ammo.utility },
      },
      isReloading: this.isReloading,
      reloadProgress: this.reloadTotal > 0 ? 1 - this.reloadTimer / this.reloadTotal : 0,
      isScoped: this.isScoped,
      crosshairSpread: spread,
      hitmarkerType: this.hitmarkerType,
      flashAlpha: this.flashAlpha,
      damageFlash: this.damageFlash,
      inBombSite: this.gameMode === 'deathmatch' ? null : inSite,
      hasBomb: this.gameMode !== 'deathmatch' && this.bomb.status === 'carried' && this.bomb.carrierId === 'player',
      bomb: { ...this.bomb },
      canDefuse: this.gameMode !== 'deathmatch' && canDefuse,
      aliveCT: ctAlivePips.filter(Boolean).length,
      aliveT: tAlivePips.filter(Boolean).length,
      ctAlivePips,
      tAlivePips,
      killFeed: [...this.killFeed],
      radarBlips,
      playerPos: { x: this.playerX, z: this.playerZ, yaw: this.playerYaw },
      roundBanner: this.roundBanner,
      pointerLocked: this.pointerLocked,
      fps: this.currentFps,
      quality: this.quality,
      difficulty: this.difficulty,
      scoreboard,
      matchStats: {
        kills: this.playerKills,
        deaths: this.playerDeaths,
        headshots: this.playerHeadshots,
        shotsFired: this.shotsFired,
        shotsHit: this.shotsHit,
        damageDealt: this.damageDealt,
        roundsWon: this.playerTeam === 'CT' ? this.ctScore : this.tScore,
        winner:
          this.gameMode === 'deathmatch'
            ? resolveDeathmatchWinner(this.ctScore, this.tScore)
            : checkMatchWinner(this.ctScore, this.tScore, 5),
      },
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (this.gamePhase !== 'playing') return;

    if (e.code === 'Digit1') this.switchSlot('primary');
    else if (e.code === 'Digit2') this.switchSlot('secondary');
    else if (e.code === 'Digit3') this.switchSlot('knife');
    else if (e.code === 'Digit4') this.switchSlot('utility');
    else if (e.code === 'KeyR') this.triggerReload();
    else if (e.code === 'KeyQ') {
      // Quick-switch last/primary-secondary
      const next: WeaponSlot =
        this.activeSlot === 'primary' ? 'secondary' : this.weapons.primary ? 'primary' : 'knife';
      this.switchSlot(next);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.gamePhase !== 'playing' || this.playerHp <= 0) return;
    if (this.pointerLocked) {
      if (performance.now() - this.justLockedAt < 80) return;
      if (Math.abs(e.movementX) > 220 || Math.abs(e.movementY) > 220) return;
      const sens = this.isScoped ? this.sensitivity * 0.45 : this.sensitivity;
      this.playerYaw -= e.movementX * sens;
      this.playerPitch = Math.max(-1.45, Math.min(1.45, this.playerPitch - e.movementY * sens));
    } else if (this.dragAiming) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (Math.abs(dx) > 180 || Math.abs(dy) > 180) return;
      const sens = this.sensitivity * 1.4;
      this.playerYaw -= dx * sens;
      this.playerPitch = Math.max(-1.45, Math.min(1.45, this.playerPitch - dy * sens));
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.gamePhase !== 'playing') return;
    if (e.target !== this.renderer.domElement) return;
    tacticalAudio.unlock();

    if (e.button === 0) {
      this.mouseDownLeft = true;
      this.semiFiredThisPress = false;
      if (!this.pointerLocked) {
        this.dragAiming = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.requestPointerLock();
      }
    } else if (e.button === 2) {
      const wid = this.weapons[this.activeSlot];
      if (wid === 'awp' && !this.isReloading) {
        this.isScoped = !this.isScoped;
        this.camera.fov = this.isScoped ? 32 : 72;
        this.camera.updateProjectionMatrix();
        this.pushHud(true);
      }
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.mouseDownLeft = false;
      this.dragAiming = false;
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    if (this.gamePhase === 'playing') e.preventDefault();
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (this.pointerLocked) {
      this.justLockedAt = performance.now();
    }
    this.pushHud(true);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.mouseDownLeft = false;
    this.dragAiming = false;
  };

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);

    for (const b of this.bots) b.rig.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
