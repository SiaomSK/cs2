import * as THREE from 'three';
import type { Team, WeaponId } from './types';

export interface OperatorRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Group;
  flashMesh: THREE.Mesh;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

function makeContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.52)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (!sharedShadowTex) sharedShadowTex = makeContactShadowTexture();
  return sharedShadowTex;
}

export function createOperatorRig(team: Team, castShadow: boolean): OperatorRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isCT = team === 'CT';
  const uniformMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x2c4159 : 0x7c6448,
    roughness: 0.85,
    metalness: 0.05,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x1d2733 : 0x454932,
    roughness: 0.58,
    metalness: 0.15,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc99c7b,
    roughness: 0.72,
    metalness: 0.02,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x38bdf8 : 0x18181b,
    roughness: 0.16,
    metalness: 0.65,
  });
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x272a30,
    roughness: 0.35,
    metalness: 0.72,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c20,
    roughness: 0.9,
    metalness: 0.05,
  });

  const hitFlashMaterials = [uniformMat, vestMat, skinMat];

  // Contact shadow disc at y = 0.015
  const shadowGeo = new THREE.CircleGeometry(0.45, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getShadowTex(),
    transparent: true,
    depthWrite: false,
    opacity: 0.75,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Legs (pivot at hip y = 0.82)
  const legGeo = new THREE.BoxGeometry(0.18, 0.78, 0.2);
  legGeo.translate(0, -0.39, 0);
  const leftLeg = new THREE.Mesh(legGeo, uniformMat);
  leftLeg.position.set(-0.13, 0.82, 0);
  const rightLeg = new THREE.Mesh(legGeo, uniformMat);
  rightLeg.position.set(0.13, 0.82, 0);

  // Boots
  const bootGeo = new THREE.BoxGeometry(0.19, 0.14, 0.27);
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(0, -0.75, 0.03);
  leftLeg.add(leftBoot);
  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0, -0.75, 0.03);
  rightLeg.add(rightBoot);

  bodyGroup.add(leftLeg, rightLeg);

  // Torso + Tactical Kevlar Vest + Rig pouches
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.26), uniformMat);
  torso.position.set(0, 1.12, 0);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.44, 0.3), vestMat);
  vest.position.set(0, 1.14, 0);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.12), vestMat);
  pack.position.set(0, 1.14, -0.18);
  bodyGroup.add(torso, vest, pack);

  // Left support arm
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.15), uniformMat);
  leftArm.position.set(-0.31, 1.16, 0.12);
  leftArm.rotation.x = -0.65;
  leftArm.rotation.z = 0.15;
  bodyGroup.add(leftArm);

  // Right weapon arm + Rifle silhouette
  const rightArm = new THREE.Group();
  rightArm.position.set(0.3, 1.32, 0.04);
  const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.15), uniformMat);
  armMesh.position.set(0, -0.18, 0.16);
  armMesh.rotation.x = -1.25;
  rightArm.add(armMesh);

  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.62), gunMat);
  gunBody.position.set(-0.12, -0.16, 0.42);
  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), gunMat);
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(-0.12, -0.13, 0.84);
  const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.08), gunMat);
  gunMag.position.set(-0.12, -0.27, 0.45);
  gunMag.rotation.x = 0.22;

  const flashMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd166 })
  );
  flashMesh.position.set(-0.12, -0.13, 1.04);
  flashMesh.visible = false;

  rightArm.add(gunBody, gunBarrel, gunMag, flashMesh);
  bodyGroup.add(rightArm);

  // Head + Helmet / Balaclava + Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.27, 0.26), skinMat);
  headGroup.add(skull);

  if (isCT) {
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.31), vestMat);
    helmet.position.set(0, 0.08, -0.01);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.09, 0.06), visorMat);
    visor.position.set(0, 0.03, 0.13);
    headGroup.add(helmet, visor);
  } else {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), vestMat);
    hood.position.set(0, 0.07, -0.01);
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.05), visorMat);
    glasses.position.set(0, 0.03, 0.13);
    headGroup.add(hood, glasses);
  }
  bodyGroup.add(headGroup);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadowDisc && obj !== flashMesh) {
      obj.castShadow = castShadow;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    bodyGroup,
    headGroup,
    leftLeg,
    rightLeg,
    rightArm,
    flashMesh,
    hitFlashMaterials,
    dispose: () => {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
    },
  };
}

export function createViewmodelWeapon(weaponId: WeaponId, team: Team): THREE.Group {
  const group = new THREE.Group();

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: team === 'CT' ? 0x26384d : 0x6b563c,
    roughness: 0.85,
  });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.65 });
  const gunSteelMat = new THREE.MeshStandardMaterial({
    color: 0x252830,
    roughness: 0.34,
    metalness: 0.78,
  });
  const darkPolymerMat = new THREE.MeshStandardMaterial({
    color: 0x14161a,
    roughness: 0.62,
    metalness: 0.18,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4824, roughness: 0.68, metalness: 0.05 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.18, metalness: 0.92 });
  const awpOliveMat = new THREE.MeshStandardMaterial({ color: 0x3f5438, roughness: 0.52, metalness: 0.2 });

  // Right forearm & glove
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.38), sleeveMat);
  rightArm.position.set(0.24, -0.24, -0.15);
  rightArm.rotation.set(0.25, 0.25, 0);
  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.1), gloveMat);
  rightHand.position.set(0.18, -0.17, -0.34);
  group.add(rightArm, rightHand);

  if (weaponId === 'knife') {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.13), darkPolymerMat);
    handle.position.set(0.16, -0.15, -0.4);
    handle.rotation.set(-0.4, 0.2, 0.25);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.015), gunSteelMat);
    guard.position.set(0.15, -0.12, -0.46);
    guard.rotation.set(-0.4, 0.2, 0.25);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.035, 0.18), chromeMat);
    blade.position.set(0.13, -0.07, -0.55);
    blade.rotation.set(-0.4, 0.2, 0.25);
    group.add(handle, guard, blade);
    return group;
  }

  if (weaponId === 'he' || weaponId === 'smoke' || weaponId === 'flash') {
    const color = weaponId === 'he' ? 0x3b4d36 : weaponId === 'smoke' ? 0x64748b : 0xd4d4d8;
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });
    const body =
      weaponId === 'he'
        ? new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), bodyMat)
        : new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.13, 10), bodyMat);
    body.position.set(0.15, -0.13, -0.38);
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.065, 0.02), gunSteelMat);
    spoon.position.set(0.17, -0.09, -0.38);
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.004, 6, 12), chromeMat);
    pin.position.set(0.15, -0.06, -0.38);
    group.add(body, spoon, pin);
    return group;
  }

  if (weaponId === 'usp' || weaponId === 'glock' || weaponId === 'deagle') {
    const slideMat = weaponId === 'deagle' ? chromeMat : gunSteelMat;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.22), darkPolymerMat);
    frame.position.set(0.16, -0.14, -0.44);
    const slide = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.042, weaponId === 'deagle' ? 0.26 : 0.22),
      slideMat
    );
    slide.position.set(0.16, -0.105, -0.45);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.055), darkPolymerMat);
    grip.position.set(0.16, -0.19, -0.36);
    grip.rotation.x = 0.22;
    group.add(frame, slide, grip);

    if (weaponId === 'usp') {
      const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 10), darkPolymerMat);
      suppressor.rotation.x = Math.PI / 2;
      suppressor.position.set(0.16, -0.108, -0.64);
      group.add(suppressor);
    }
    return group;
  }

  // Two-handed rifles / SMG: add left support arm
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.36), sleeveMat);
  leftArm.position.set(-0.08, -0.25, -0.25);
  leftArm.rotation.set(0.25, -0.42, 0);
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.09), gloveMat);
  leftHand.position.set(0.14, -0.16, -0.52);
  group.add(leftArm, leftHand);

  if (weaponId === 'mp9') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.32), darkPolymerMat);
    body.position.set(0.16, -0.13, -0.45);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8), gunSteelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.16, -0.11, -0.66);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.16, 0.04), darkPolymerMat);
    mag.position.set(0.16, -0.24, -0.42);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), gunSteelMat);
    sight.position.set(0.16, -0.075, -0.42);
    group.add(body, barrel, mag, sight);
  } else if (weaponId === 'ak47') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.08, 0.38), gunSteelMat);
    receiver.position.set(0.16, -0.13, -0.44);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.068, 0.22), woodMat);
    handguard.position.set(0.16, -0.125, -0.68);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.09, 0.22), woodMat);
    stock.position.set(0.16, -0.15, -0.2);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), gunSteelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.16, -0.11, -0.88);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.19, 0.055), woodMat);
    mag.position.set(0.16, -0.24, -0.5);
    mag.rotation.x = 0.28;
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.035, 0.018), gunSteelMat);
    frontSight.position.set(0.16, -0.085, -0.94);
    group.add(receiver, handguard, stock, barrel, mag, frontSight);
  } else if (weaponId === 'm4a4') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.085, 0.38), gunSteelMat);
    receiver.position.set(0.16, -0.13, -0.44);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.062, 0.26), darkPolymerMat);
    rail.position.set(0.16, -0.12, -0.7);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.09, 0.2), darkPolymerMat);
    stock.position.set(0.16, -0.14, -0.2);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), gunSteelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.16, -0.115, -0.88);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.052), gunSteelMat);
    mag.position.set(0.16, -0.23, -0.5);
    mag.rotation.x = 0.12;
    const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.035, 0.14), darkPolymerMat);
    carryHandle.position.set(0.16, -0.072, -0.42);
    group.add(receiver, rail, stock, barrel, mag, carryHandle);
  } else if (weaponId === 'awp') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.085, 0.56), awpOliveMat);
    chassis.position.set(0.16, -0.135, -0.46);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.56, 8), gunSteelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.16, -0.105, -0.92);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 10), darkPolymerMat);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0.16, -0.06, -0.48);
    const scopeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.09, 10), darkPolymerMat);
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.position.set(0.16, -0.06, -0.64);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.07), darkPolymerMat);
    mag.position.set(0.16, -0.19, -0.48);
    group.add(chassis, barrel, scopeTube, scopeBell, mag);
  }

  return group;
}

export function createPlantedBombMesh(): { group: THREE.Group; ledMesh: THREE.Mesh } {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x333842, roughness: 0.5, metalness: 0.4 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.8 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.24), caseMat);
  body.position.y = 0.055;
  const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), padMat);
  keypad.position.set(-0.06, 0.115, 0);
  const wire = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.04), wireMat);
  wire.position.set(0.09, 0.115, 0.04);
  const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), ledMat);
  ledMesh.position.set(0.1, 0.12, -0.05);

  group.add(body, keypad, wire, ledMesh);
  return { group, ledMesh };
}
