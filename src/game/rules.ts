import { BOMB_SITES, CT_BUY_ZONE, MAP_BOUNDS, MAP_BOXES, T_BUY_ZONE } from './mapData';
import type { AABB, Team, WeaponId } from './types';
import { KEVLAR_HELMET_PRICE, KEVLAR_PRICE, WEAPON_SPECS } from './weapons';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function groundHeightAt(x: number, z: number, boxes: AABB[] = MAP_BOXES): number {
  let highest = 0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      if (b.isRamp && b.rampAxis === 'x') {
        const t = Math.max(0, Math.min(1, (x - b.minX) / (b.maxX - b.minX)));
        const h = b.minY + (b.rampDir === 1 ? t : 1 - t) * (b.maxY - b.minY);
        if (h > highest) highest = h;
      } else if (!b.isRamp && b.maxY <= 1.45 && b.maxY > highest) {
        // Walkable low platform (e.g. A platform at y=0.8)
        if (b.id === 'a_platform') {
          highest = Math.max(highest, b.maxY);
        }
      }
    }
  }
  return highest;
}

export function resolveCircleMovement(
  x: number,
  y: number,
  z: number,
  radius: number,
  boxes: AABB[] = MAP_BOXES
): { x: number; z: number } {
  let rx = Math.max(MAP_BOUNDS.minX + radius, Math.min(MAP_BOUNDS.maxX - radius, x));
  let rz = Math.max(MAP_BOUNDS.minZ + radius, Math.min(MAP_BOUNDS.maxZ - radius, z));

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.blocksMovement || b.isRamp) continue;
      // Ignore boxes wholly below feet + step tolerance (e.g. platform when standing on it)
      if (b.maxY <= y + 0.45) continue;
      if (b.minY >= y + 1.75) continue;

      const closestX = Math.max(b.minX, Math.min(rx, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(rz, b.maxZ));
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          rx += (dx / dist) * overlap;
          rz += (dz / dist) * overlap;
        } else {
          // Center is inside AABB, push out nearest edge
          const leftPen = rx - b.minX;
          const rightPen = b.maxX - rx;
          const topPen = rz - b.minZ;
          const botPen = b.maxZ - rz;
          const minPen = Math.min(leftPen, rightPen, topPen, botPen);
          if (minPen === leftPen) rx = b.minX - radius;
          else if (minPen === rightPen) rx = b.maxX + radius;
          else if (minPen === topPen) rz = b.minZ - radius;
          else rz = b.maxZ + radius;
        }
      }
    }
  }

  return { x: rx, z: rz };
}

export function rayIntersectsAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  maxDist: number
): number | null {
  let tmin = 0;
  let tmax = maxDist;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (ox < b.minX || ox > b.maxX) return null;
  } else {
    const invD = 1 / dx;
    let t1 = (b.minX - ox) * invD;
    let t2 = (b.maxX - ox) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (oy < b.minY || oy > b.maxY) return null;
  } else {
    const invD = 1 / dy;
    let t1 = (b.minY - oy) * invD;
    let t2 = (b.maxY - oy) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Z slab
  if (Math.abs(dz) < 1e-8) {
    if (oz < b.minZ || oz > b.maxZ) return null;
  } else {
    const invD = 1 / dz;
    let t1 = (b.minZ - oz) * invD;
    let t2 = (b.maxZ - oz) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  return tmin >= 0 && tmin <= maxDist ? tmin : null;
}

export function raycastMapDistance(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist = 140,
  boxes: AABB[] = MAP_BOXES
): number {
  let closest = maxDist;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b.blocksBullets) continue;
    const t = rayIntersectsAABB(ox, oy, oz, dx, dy, dz, b, closest);
    if (t !== null && t < closest) {
      closest = t;
    }
  }
  // Check floor plane y = 0
  if (dy < -1e-6 && oy > 0) {
    const floorT = -oy / dy;
    if (floorT > 0 && floorT < closest) closest = floorT;
  }
  return closest;
}

export function hasLineOfSight(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  boxes: AABB[] = MAP_BOXES
): boolean {
  const vx = bx - ax;
  const vy = by - ay;
  const vz = bz - az;
  const dist = Math.hypot(vx, vy, vz);
  if (dist < 1e-4) return true;
  const dx = vx / dist;
  const dy = vy / dist;
  const dz = vz / dist;
  const hitDist = raycastMapDistance(ax, ay, az, dx, dy, dz, dist, boxes);
  return hitDist >= dist - 0.05;
}

export function calculateWeaponDamage(
  weaponId: WeaponId,
  distance: number,
  hitZone: 'head' | 'body' | 'legs',
  targetArmor: number,
  targetHasHelmet: boolean
): { hpDamage: number; armorDamage: number } {
  const spec = WEAPON_SPECS[weaponId];
  const falloffSteps = distance / 25;
  let raw = spec.damage * Math.pow(spec.rangeFalloff, falloffSteps);

  if (hitZone === 'head') {
    raw *= spec.headMultiplier;
  } else if (hitZone === 'legs') {
    raw *= 0.75;
  }

  const armored =
    targetArmor > 0 &&
    (hitZone === 'body' || (hitZone === 'head' && targetHasHelmet));

  if (!armored) {
    return { hpDamage: Math.round(raw), armorDamage: 0 };
  }

  const hpDmg = Math.max(1, Math.round(raw * spec.armorPenetration));
  const armorDmg = Math.min(targetArmor, Math.max(1, Math.round((raw - hpDmg) * 0.5)));
  return { hpDamage: hpDmg, armorDamage: armorDmg };
}

export function computeCrosshairSpread(
  weaponId: WeaponId,
  horizontalSpeed: number,
  isCrouching: boolean,
  isGrounded: boolean,
  recoilHeat: number,
  isScoped: boolean
): number {
  const spec = WEAPON_SPECS[weaponId];
  const maxMove = 6.5;
  const moveFactor = Math.min(1, horizontalSpeed / maxMove);
  let spread = spec.baseSpread + spec.moveSpread * moveFactor;
  if (isCrouching) spread *= 0.65;
  if (!isGrounded) spread += 0.065;
  spread += recoilHeat * 0.018;
  if (isScoped && weaponId === 'awp') spread *= 0.12;
  return spread;
}

export function isInBuyZone(x: number, z: number, team: Team): boolean {
  const zone = team === 'CT' ? CT_BUY_ZONE : T_BUY_ZONE;
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}

export function getBombSiteAt(x: number, z: number): 'A' | 'B' | null {
  for (const site of BOMB_SITES) {
    const d = Math.hypot(x - site.x, z - site.z);
    if (d <= site.radius) return site.id;
  }
  return null;
}

export function validateWeaponPurchase(
  weaponId: WeaponId,
  team: Team,
  money: number,
  inBuyZone: boolean,
  freeMode = false
): { ok: boolean; reason?: string; cost: number } {
  const spec = WEAPON_SPECS[weaponId];
  if (freeMode) {
    return { ok: true, cost: 0 };
  }
  if (!inBuyZone) return { ok: false, reason: 'Outside buy zone', cost: spec.price };
  if (spec.teamLock && spec.teamLock !== team) {
    return { ok: false, reason: `${spec.teamLock} team only`, cost: spec.price };
  }
  if (money < spec.price) {
    return { ok: false, reason: 'Insufficient funds', cost: spec.price };
  }
  return { ok: true, cost: spec.price };
}

export function validateArmorPurchase(
  hasArmor: boolean,
  hasHelmet: boolean,
  money: number,
  inBuyZone: boolean,
  withHelmet: boolean,
  freeMode = false
): { ok: boolean; cost: number } {
  if (!inBuyZone && !freeMode) return { ok: false, cost: 0 };
  if (withHelmet) {
    if (hasArmor && hasHelmet) return { ok: false, cost: 0 };
    const cost = freeMode ? 0 : hasArmor ? 350 : KEVLAR_HELMET_PRICE;
    return { ok: freeMode || money >= cost, cost };
  } else {
    if (hasArmor) return { ok: false, cost: 0 };
    const cost = freeMode ? 0 : KEVLAR_PRICE;
    return { ok: freeMode || money >= cost, cost };
  }
}

export function checkMatchWinner(ctScore: number, tScore: number, roundsToWin = 5): Team | null {
  if (ctScore >= roundsToWin) return 'CT';
  if (tScore >= roundsToWin) return 'T';
  return null;
}

export function pickSafeDeathmatchSpawn<T extends { x: number; z: number }>(
  spawns: T[],
  enemyPositions: Array<{ x: number; z: number }>
): T {
  if (enemyPositions.length === 0) {
    return spawns[Math.floor(Math.random() * spawns.length)];
  }
  // Score spawns by minimum distance to any active enemy, pick among top 2 safest for variety
  const scored = spawns.map((sp) => {
    let minD = Infinity;
    for (const e of enemyPositions) {
      const d = Math.hypot(sp.x - e.x, sp.z - e.z);
      if (d < minD) minD = d;
    }
    return { sp, minD };
  });
  scored.sort((a, b) => b.minD - a.minD);
  const poolSize = Math.min(2, scored.length);
  return scored[Math.floor(Math.random() * poolSize)].sp;
}

export function resolveDeathmatchWinner(ctKills: number, tKills: number): Team | null {
  if (ctKills > tKills) return 'CT';
  if (tKills > ctKills) return 'T';
  return null;
}

