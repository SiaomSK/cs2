import test from 'node:test';
import assert from 'node:assert/strict';
import { CT_SPAWN_POS, DEATHMATCH_SPAWNS, T_SPAWN_POS } from './mapData';
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
  resolveCircleMovement,
  resolveDeathmatchWinner,
  validateArmorPurchase,
  validateWeaponPurchase,
} from './rules';

test('CT and T spawns start in clear open lanes with unobstructed initial view', () => {
  const ctClearDist = raycastMapDistance(CT_SPAWN_POS.x, 1.65, CT_SPAWN_POS.z, 0, 0, -1, 50);
  const tClearDist = raycastMapDistance(T_SPAWN_POS.x, 1.65, T_SPAWN_POS.z, 0, 0, 1, 50);
  assert.ok(ctClearDist > 20, `CT spawn should have >20m clear view ahead, got ${ctClearDist}`);
  assert.ok(tClearDist > 20, `T spawn should have >20m clear view ahead, got ${tClearDist}`);
});

test('All Deathmatch spawns sit on open ground with clear sightlines ahead', () => {
  for (const sp of DEATHMATCH_SPAWNS) {
    const dx = -Math.sin(sp.yaw);
    const dz = -Math.cos(sp.yaw);
    const clearDist = raycastMapDistance(sp.x, sp.y + 1.65, sp.z, dx, 0, dz, 30);
    assert.ok(clearDist >= 5, `DM spawn (${sp.x},${sp.z}) facing wall: clear=${clearDist}`);
  }
});

test('pickSafeDeathmatchSpawn avoids spawns occupied by enemies', () => {
  const candidates = [
    { id: 'near', x: 0, z: 0 },
    { id: 'mid', x: 10, z: 10 },
    { id: 'far1', x: 30, z: 30 },
    { id: 'far2', x: -30, z: -30 },
  ];
  const chosen = pickSafeDeathmatchSpawn(candidates, [{ x: 0, z: 1 }]);
  assert.ok(chosen.id === 'far1' || chosen.id === 'far2', `Expected far spawn, got ${chosen.id}`);
});

test('Deathmatch free loadout allows cross-team weapon purchase outside buy zone', () => {
  assert.equal(validateWeaponPurchase('ak47', 'CT', 0, false, true).ok, true);
  assert.equal(validateWeaponPurchase('m4a4', 'T', 0, false, true).ok, true);
  assert.equal(validateWeaponPurchase('ak47', 'CT', 0, false, true).cost, 0);
});

test('Deathmatch winner resolves by team kill lead or tie', () => {
  assert.equal(resolveDeathmatchWinner(18, 12), 'CT');
  assert.equal(resolveDeathmatchWinner(10, 15), 'T');
  assert.equal(resolveDeathmatchWinner(14, 14), null);
});

test('A platform ramp transitions ground height smoothly from 0 to 0.8m', () => {
  assert.equal(groundHeightAt(0, 0), 0);
  assert.equal(groundHeightAt(26, 16), 0.8);
  const midRamp = groundHeightAt(17.5, 16);
  assert.ok(Math.abs(midRamp - 0.4) < 0.05, `Expected ramp midpoint ~0.4, got ${midRamp}`);
});

test('Circle collision prevents walking through Mid wall', () => {
  // Mid east wall is centered at x=8.5, width 2.5 => x in [7.25, 9.75] at z=20
  const pushed = resolveCircleMovement(7.3, 0, 20, 0.45);
  assert.ok(pushed.x <= 7.25 - 0.45 + 0.001, `Player should be pushed outside wall, got x=${pushed.x}`);
});

test('Line of sight is blocked by Mid wall but open through Mid double doors gap', () => {
  assert.equal(hasLineOfSight(0, 1.5, 25, 0, 1.5, -25), true);
  assert.equal(hasLineOfSight(6, 1.5, 20, 14, 1.5, 20), false);
});

test('AK-47 headshot deals lethal >100 damage even through helmet at close range', () => {
  const dmg = calculateWeaponDamage('ak47', 10, 'head', 100, true);
  assert.ok(dmg.hpDamage >= 100, `AK headshot should kill (got ${dmg.hpDamage})`);
});

test('USP-S headshot vs helmet is non-lethal while unarmored headshot is lethal', () => {
  const vsHelmet = calculateWeaponDamage('usp', 10, 'head', 100, true);
  const vsNoHelmet = calculateWeaponDamage('usp', 10, 'head', 0, false);
  assert.ok(vsHelmet.hpDamage < 100, `USP vs helmet should not 1-tap (${vsHelmet.hpDamage})`);
  assert.ok(vsNoHelmet.hpDamage >= 100, `USP vs unarmored head should 1-tap (${vsNoHelmet.hpDamage})`);
});

test('Crosshair spread tightens when crouching and widens when moving or airborne', () => {
  const standingStill = computeCrosshairSpread('ak47', 0, false, true, 0, false);
  const crouching = computeCrosshairSpread('ak47', 0, true, true, 0, false);
  const running = computeCrosshairSpread('ak47', 6.5, false, true, 0, false);
  const jumping = computeCrosshairSpread('ak47', 0, false, false, 0, false);
  assert.ok(crouching < standingStill);
  assert.ok(running > standingStill);
  assert.ok(jumping > running);
});

test('Buy zone, bomb site, and team weapon restrictions validate accurately', () => {
  assert.equal(isInBuyZone(0, 35, 'CT'), true);
  assert.equal(isInBuyZone(0, 0, 'CT'), false);
  assert.equal(getBombSiteAt(26, 16), 'A');
  assert.equal(getBombSiteAt(-25, 16), 'B');
  assert.equal(getBombSiteAt(0, 0), null);

  assert.equal(validateWeaponPurchase('ak47', 'CT', 5000, true).ok, false);
  assert.equal(validateWeaponPurchase('ak47', 'T', 2700, true).ok, true);
  assert.equal(validateWeaponPurchase('ak47', 'T', 2600, true).ok, false);
  assert.equal(validateWeaponPurchase('awp', 'CT', 4750, false).ok, false);

  assert.equal(validateArmorPurchase(false, false, 1000, true, true).ok, true);
  assert.equal(validateArmorPurchase(true, false, 350, true, true).cost, 350);
});

test('Match winner triggers at target round wins', () => {
  assert.equal(checkMatchWinner(4, 3, 5), null);
  assert.equal(checkMatchWinner(5, 3, 5), 'CT');
  assert.equal(checkMatchWinner(2, 5, 5), 'T');
});
