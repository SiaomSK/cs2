export type Team = 'CT' | 'T';

export type GameMode = 'defusal' | 'deathmatch';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type RoundPhase = 'buy' | 'live' | 'planted' | 'round_end';

export type QualityPreset = 'potato' | 'standard' | 'high';

export type Difficulty = 'casual' | 'competitive';

export type WeaponSlot = 'primary' | 'secondary' | 'knife' | 'utility';

export type WeaponId =
  | 'knife'
  | 'usp'
  | 'glock'
  | 'deagle'
  | 'mp9'
  | 'ak47'
  | 'm4a4'
  | 'awp'
  | 'he'
  | 'smoke'
  | 'flash';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  slot: WeaponSlot;
  teamLock?: Team;
  price: number;
  killReward: number;
  damage: number;
  headMultiplier: number;
  armorPenetration: number;
  fireInterval: number; // seconds between shots
  automatic: boolean;
  magSize: number;
  reserveMax: number;
  reloadTime: number;
  baseSpread: number; // radians
  moveSpread: number; // extra radians when moving at full speed
  recoilKickPitch: number; // radians per shot
  recoilKickYaw: number;
  rangeFalloff: number; // multiplier per 25m
  scopedFov?: number;
  moveSpeedMultiplier: number;
  isGrenade?: boolean;
  description: string;
}

export interface AABB {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  material: 'sandstone' | 'concrete' | 'crate' | 'metal' | 'door' | 'container' | 'floor' | 'ramp';
  blocksBullets: boolean;
  blocksMovement: boolean;
  isRamp?: boolean;
  rampAxis?: 'x' | 'z';
  rampDir?: 1 | -1;
}

export interface BombSite {
  id: 'A' | 'B';
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface Waypoint {
  id: string;
  x: number;
  y: number;
  z: number;
  neighbors: string[];
  tag?: 'ct_spawn' | 't_spawn' | 'mid' | 'a_site' | 'b_site' | 'a_long' | 'b_tunnels' | 'catwalk';
}

export type BotRole = 'entry' | 'anchor' | 'sniper' | 'flanker';

export interface KillFeedItem {
  id: number;
  killerName: string;
  killerTeam: Team;
  victimName: string;
  victimTeam: Team;
  weaponId: WeaponId;
  headshot: boolean;
  timestamp: number;
}

export interface RadarBlip {
  id: string;
  x: number;
  z: number;
  team: Team;
  alive: boolean;
  isPlayer?: boolean;
  yaw?: number;
  spotted?: boolean;
}

export interface BombState {
  status: 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded';
  carrierId: string | null;
  x: number;
  y: number;
  z: number;
  site: 'A' | 'B' | null;
  timer: number; // seconds left until detonation
  defuseProgress: number; // 0..1
  plantProgress: number; // 0..1
}

export interface ScoreboardEntry {
  id: string;
  name: string;
  team: Team;
  alive: boolean;
  kills: number;
  deaths: number;
  assists: number;
  money: number;
  isPlayer: boolean;
}

export interface HudSnapshot {
  gamePhase: GamePhase;
  gameMode: GameMode;
  roundPhase: RoundPhase;
  roundNumber: number;
  maxRounds: number;
  ctScore: number;
  tScore: number;
  roundTimer: number;
  buyTimer: number;
  spawnProtected: boolean;
  playerTeam: Team;
  hp: number;
  armor: number;
  hasHelmet: boolean;
  money: number;
  inBuyZone: boolean;
  activeSlot: WeaponSlot;
  weapons: {
    primary: WeaponId | null;
    secondary: WeaponId | null;
    knife: WeaponId;
    utility: WeaponId | null;
  };
  ammo: Record<WeaponSlot, { clip: number; reserve: number }>;
  isReloading: boolean;
  reloadProgress: number;
  isScoped: boolean;
  crosshairSpread: number;
  hitmarkerType: 'none' | 'body' | 'head' | 'kill';
  flashAlpha: number;
  damageFlash: number;
  inBombSite: 'A' | 'B' | null;
  hasBomb: boolean;
  bomb: BombState;
  canDefuse: boolean;
  aliveCT: number;
  aliveT: number;
  ctAlivePips: boolean[];
  tAlivePips: boolean[];
  killFeed: KillFeedItem[];
  radarBlips: RadarBlip[];
  playerPos: { x: number; z: number; yaw: number };
  roundBanner: { title: string; subtitle: string; team: Team | null } | null;
  pointerLocked: boolean;
  fps: number;
  quality: QualityPreset;
  difficulty: Difficulty;
  scoreboard: ScoreboardEntry[];
  matchStats: {
    kills: number;
    deaths: number;
    headshots: number;
    shotsFired: number;
    shotsHit: number;
    damageDealt: number;
    roundsWon: number;
    winner: Team | null;
  };
}
