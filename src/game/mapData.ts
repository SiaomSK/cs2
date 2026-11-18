import type { AABB, BombSite, Waypoint } from './types';

export const MAP_BOUNDS = {
  minX: -36,
  maxX: 36,
  minZ: -42,
  maxZ: 42,
};

export const CT_SPAWN_POS = { x: 0, y: 0, z: 35, yaw: 0 };
export const T_SPAWN_POS = { x: 0, y: 0, z: -35, yaw: Math.PI };

export const CT_BUY_ZONE = { minX: -12, maxX: 12, minZ: 27, maxZ: 41 };
export const T_BUY_ZONE = { minX: -12, maxX: 12, minZ: -41, maxZ: -27 };

export const BOMB_SITES: BombSite[] = [
  { id: 'A', x: 26, y: 0.8, z: 16, radius: 5.5 },
  { id: 'B', x: -25, y: 0, z: 16, radius: 5.5 },
];

function box(
  id: string,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  material: AABB['material'],
  opts?: Partial<AABB>
): AABB {
  return {
    id,
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minY: cy,
    maxY: cy + h,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
    material,
    blocksBullets: true,
    blocksMovement: true,
    ...opts,
  };
}

// Dust-inspired tactical 3-lane arena (A Long / Mid / B Tunnels)
// Every lane >= 5m wide, zero trapped pockets, spawns face clear vistas
export const MAP_BOXES: AABB[] = [
  // Outer perimeter sandstone walls (tall canyon walls)
  box('wall_north', 0, 0, -42.5, 74, 8, 1.5, 'sandstone'),
  box('wall_south', 0, 0, 42.5, 74, 8, 1.5, 'sandstone'),
  box('wall_west', -36.5, 0, 0, 1.5, 8, 86, 'sandstone'),
  box('wall_east', 36.5, 0, 0, 1.5, 8, 86, 'sandstone'),

  // === MID LANE DIVIDERS (separating Mid from A-side and B-side) ===
  // East Mid wall (between Mid and A Long / Catwalk)
  box('mid_wall_e_north', 8.5, 0, -20, 2.5, 6.2, 22, 'sandstone'),
  box('mid_wall_e_south', 8.5, 0, 20, 2.5, 6.2, 14, 'sandstone'),
  // Gap at z in [-9, 13] forms Mid-to-Catwalk & A Short connector!

  // West Mid wall (between Mid and B Tunnels / B Site)
  box('mid_wall_w_north', -8.5, 0, -16, 2.5, 6.2, 26, 'sandstone'),
  box('mid_wall_w_south', -8.5, 0, 25, 2.5, 6.2, 12, 'sandstone'),
  // Gap at z in [-3, 19] forms B Window / CT Mid connector!

  // Iconic Mid Double Doors at z = 2 (leaves 3.6m center gap x in [-1.8, 1.8])
  box('mid_door_wall_w', -5.2, 0, 2, 4.6, 5.5, 1.4, 'sandstone'),
  box('mid_door_wall_e', 5.2, 0, 2, 4.6, 5.5, 1.4, 'sandstone'),
  box('mid_door_leaf_w', -2.35, 0, 2, 1.1, 4.2, 0.35, 'door'),
  box('mid_door_leaf_e', 2.35, 0, 2, 1.1, 4.2, 0.35, 'door'),

  // Mid tactical cover: Xbox & palm concrete planter
  box('mid_xbox', 2.8, 0, -8.5, 2.2, 1.35, 2.2, 'crate'),
  box('mid_ct_box', -3.2, 0, 16, 2.0, 1.3, 2.0, 'crate'),

  // === A LONG & A SITE (East Wing) ===
  // A Long dividing wall (leaves Long Doors at z=-16)
  box('a_long_divider_w', 16.5, 0, -16, 12, 6, 1.8, 'sandstone'),
  box('a_long_divider_e', 31.5, 0, -16, 9, 6, 1.8, 'sandstone'),
  // Gap at x in [22.5, 27] is A Long Double Doors!

  // A Long pit cover crates
  box('a_long_crate_1', 21, 0, -4, 2.0, 1.4, 2.0, 'crate'),
  box('a_long_crate_2', 30, 0, 2, 2.2, 1.6, 2.2, 'crate'),

  // A Site Elevated Platform (y = 0 -> 0.8) & A Ramp
  box('a_platform', 27.5, 0, 16, 16, 0.8, 16, 'concrete', { blocksBullets: true }),
  box('a_ramp', 17.5, 0, 16, 4.0, 0.8, 8.0, 'ramp', {
    isRamp: true,
    rampAxis: 'x',
    rampDir: 1,
    blocksBullets: false,
  }),

  // A Site cover crates & barrels (sitting on platform y = 0.8)
  box('a_site_crate_main', 24.5, 0.8, 13.5, 2.3, 1.5, 2.3, 'crate'),
  box('a_site_crate_stack', 29.5, 0.8, 18.5, 2.2, 2.1, 2.2, 'crate'),
  box('a_site_barrel', 22.0, 0.8, 19.5, 1.1, 1.4, 1.1, 'metal'),

  // Catwalk / A Short ledge cover
  box('catwalk_cover', 13.5, 0, 5.5, 2.0, 1.25, 2.4, 'concrete'),

  // === B TUNNELS & B SITE (West Wing) ===
  // B Tunnel entrance wall separating T-side from B Site (leaves doorway x in [-28, -22])
  box('b_tunnel_wall_e', -15.5, 0, 2, 13, 6.2, 2.0, 'sandstone'),
  box('b_tunnel_wall_w', -32.2, 0, 2, 8.0, 6.2, 2.0, 'sandstone'),

  // B Tunnels internal pillar
  box('b_tunnel_pillar', -25, 0, -14, 3.2, 6, 3.2, 'sandstone'),

  // B Site cover: Shipping Container, Double Stack Crates, Back Pillar
  box('b_site_container', -21.5, 0, 15.5, 3.2, 2.8, 6.8, 'container'),
  box('b_site_crate_1', -29.5, 0, 11.5, 2.2, 1.45, 2.2, 'crate'),
  box('b_site_crate_2', -28.5, 0, 21.5, 2.2, 2.0, 2.2, 'crate'),
  box('b_site_barrel', -16.5, 0, 21.0, 1.1, 1.4, 1.1, 'metal'),

  // === SPAWN COVER ===
  box('ct_spawn_crate_l', -5.5, 0, 31.5, 2.2, 1.35, 1.8, 'crate'),
  box('ct_spawn_crate_r', 5.5, 0, 31.5, 2.2, 1.35, 1.8, 'crate'),
  box('t_spawn_crate_l', -5.5, 0, -31.5, 2.2, 1.35, 1.8, 'crate'),
  box('t_spawn_crate_r', 5.5, 0, -31.5, 2.2, 1.35, 1.8, 'crate'),
];

export const MAP_WAYPOINTS: Waypoint[] = [
  { id: 'ct_spawn', x: 0, y: 0, z: 35, neighbors: ['ct_mid', 'ct_b_link', 'ct_a_link'], tag: 'ct_spawn' },
  { id: 'ct_mid', x: 0, y: 0, z: 22, neighbors: ['ct_spawn', 'mid_south', 'ct_b_link', 'ct_a_link'], tag: 'mid' },
  { id: 'ct_a_link', x: 13, y: 0, z: 29, neighbors: ['ct_spawn', 'ct_mid', 'a_ramp_base'], tag: 'a_site' },
  { id: 'a_ramp_base', x: 14, y: 0, z: 16, neighbors: ['ct_a_link', 'a_site_center', 'catwalk_mid'], tag: 'a_site' },
  { id: 'a_site_center', x: 26, y: 0.8, z: 16, neighbors: ['a_ramp_base', 'a_long_exit'], tag: 'a_site' },
  { id: 'a_long_exit', x: 25, y: 0, z: 4, neighbors: ['a_site_center', 'a_long_mid'], tag: 'a_long' },
  { id: 'a_long_mid', x: 25, y: 0, z: -12, neighbors: ['a_long_exit', 'a_long_doors'], tag: 'a_long' },
  { id: 'a_long_doors', x: 25, y: 0, z: -26, neighbors: ['a_long_mid', 't_a_link'], tag: 'a_long' },
  { id: 't_a_link', x: 14, y: 0, z: -32, neighbors: ['a_long_doors', 't_spawn'], tag: 't_spawn' },
  { id: 'catwalk_mid', x: 11, y: 0, z: 6, neighbors: ['a_ramp_base', 'mid_north', 'mid_south'], tag: 'catwalk' },

  { id: 'mid_south', x: 0, y: 0, z: 8, neighbors: ['ct_mid', 'mid_north', 'catwalk_mid', 'b_window'], tag: 'mid' },
  { id: 'mid_north', x: 0, y: 0, z: -10, neighbors: ['mid_south', 't_mid', 'catwalk_mid'], tag: 'mid' },
  { id: 't_mid', x: 0, y: 0, z: -24, neighbors: ['mid_north', 't_spawn'], tag: 'mid' },
  { id: 't_spawn', x: 0, y: 0, z: -35, neighbors: ['t_mid', 't_a_link', 't_b_link'], tag: 't_spawn' },

  { id: 'ct_b_link', x: -13, y: 0, z: 29, neighbors: ['ct_spawn', 'ct_mid', 'b_site_east'], tag: 'b_site' },
  { id: 'b_window', x: -12, y: 0, z: 10, neighbors: ['mid_south', 'b_site_east'], tag: 'b_site' },
  { id: 'b_site_east', x: -15, y: 0, z: 16, neighbors: ['ct_b_link', 'b_window', 'b_site_center'], tag: 'b_site' },
  { id: 'b_site_center', x: -25, y: 0, z: 16, neighbors: ['b_site_east', 'b_tunnels_exit'], tag: 'b_site' },
  { id: 'b_tunnels_exit', x: -25, y: 0, z: 2, neighbors: ['b_site_center', 'b_tunnels_mid'], tag: 'b_tunnels' },
  { id: 'b_tunnels_mid', x: -20, y: 0, z: -14, neighbors: ['b_tunnels_exit', 'b_tunnels_entry'], tag: 'b_tunnels' },
  { id: 'b_tunnels_entry', x: -24, y: 0, z: -28, neighbors: ['b_tunnels_mid', 't_b_link'], tag: 'b_tunnels' },
  { id: 't_b_link', x: -13, y: 0, z: -33, neighbors: ['b_tunnels_entry', 't_spawn'], tag: 't_spawn' },
];

export interface DeathmatchSpawn {
  x: number;
  y: number;
  z: number;
  yaw: number;
  waypointId: string;
}

export const DEATHMATCH_SPAWNS: DeathmatchSpawn[] = [
  { x: 0, y: 0, z: 35, yaw: 0, waypointId: 'ct_spawn' },
  { x: 0, y: 0, z: -35, yaw: Math.PI, waypointId: 't_spawn' },
  { x: 26, y: 0.8, z: 16, yaw: Math.PI / 2, waypointId: 'a_site_center' },
  { x: -16, y: 0, z: 26, yaw: 0, waypointId: 'b_site_east' },
  { x: 25, y: 0, z: -8, yaw: 0, waypointId: 'a_long_mid' },
  { x: -20, y: 0, z: -14, yaw: Math.PI, waypointId: 'b_tunnels_mid' },
  { x: 11, y: 0, z: 6, yaw: Math.PI / 2, waypointId: 'catwalk_mid' },
  { x: -13, y: 0, z: 29, yaw: 0, waypointId: 'ct_b_link' },
  { x: 13, y: 0, z: 29, yaw: 0, waypointId: 'ct_a_link' },
  { x: 0, y: 0, z: 8, yaw: 0, waypointId: 'mid_south' },
];

