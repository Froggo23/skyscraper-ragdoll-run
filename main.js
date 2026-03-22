import * as THREE from "./libs/three.module.js";
import * as CANNON from "./libs/cannon-es.js";

const WORLD_SIZE = 1400;
const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 6.8;
const RUN_SPEED = 10.8;
const GRAVITY = 26;

const BUILDING_HALF_WIDTH = 14;
const BUILDING_HALF_DEPTH = 10;
const BUILDING_HEIGHT = 260;
const ROOF_Y = BUILDING_HEIGHT;
const WALL_THICKNESS = 0.6;
const WALL_COLLIDER_TOP = ROOF_Y - 2;
const DOOR_WIDTH = 3.8;
const DOOR_HEIGHT = 4.2;

const STAIR_INNER_RADIUS = 4.1;
const STAIR_OUTER_RADIUS = 8.2;
const STAIR_PHASE = Math.PI * 0.5;
const STAIR_STEP_RISE = 0.29;
const STAIR_STEP_ANGLE = 0.33;
const STAIR_COUNT = Math.ceil((ROOF_Y + 2.5) / STAIR_STEP_RISE);
const STAIR_RISE_PER_TURN = STAIR_STEP_RISE * ((Math.PI * 2) / STAIR_STEP_ANGLE);

const TELEPORT_PAD_POSITION = new THREE.Vector3(BUILDING_HALF_WIDTH + 8, 0.12, -2.4);
const TELEPORT_RADIUS = 1.6;
const TELEPORT_DESTINATION = new THREE.Vector3(0, ROOF_Y + 0.05, BUILDING_HALF_DEPTH - 2.4);

const RAGDOLL_SPEC = {
  pelvis: {
    type: "box",
    size: [0.52, 0.32, 0.3],
    mass: 7,
    offset: new THREE.Vector3(0, 1.06, 0),
    color: 0x3d6192,
  },
  torso: {
    type: "box",
    size: [0.62, 0.86, 0.36],
    mass: 8,
    offset: new THREE.Vector3(0, 1.72, 0),
    color: 0x3a6b9b,
  },
  head: {
    type: "sphere",
    radius: 0.23,
    mass: 4,
    offset: new THREE.Vector3(0, 2.52, 0),
    color: 0xd8a97f,
  },
  upperArmL: {
    type: "box",
    size: [0.18, 0.46, 0.18],
    mass: 2.2,
    offset: new THREE.Vector3(-0.43, 1.78, 0),
    color: 0xd8a97f,
  },
  lowerArmL: {
    type: "box",
    size: [0.16, 0.46, 0.16],
    mass: 1.6,
    offset: new THREE.Vector3(-0.43, 1.3, 0),
    color: 0xd8a97f,
  },
  upperArmR: {
    type: "box",
    size: [0.18, 0.46, 0.18],
    mass: 2.2,
    offset: new THREE.Vector3(0.43, 1.78, 0),
    color: 0xd8a97f,
  },
  lowerArmR: {
    type: "box",
    size: [0.16, 0.46, 0.16],
    mass: 1.6,
    offset: new THREE.Vector3(0.43, 1.3, 0),
    color: 0xd8a97f,
  },
  upperLegL: {
    type: "box",
    size: [0.22, 0.56, 0.22],
    mass: 4,
    offset: new THREE.Vector3(-0.19, 0.72, 0),
    color: 0x3a465c,
  },
  lowerLegL: {
    type: "box",
    size: [0.2, 0.56, 0.2],
    mass: 3,
    offset: new THREE.Vector3(-0.19, 0.16, 0),
    color: 0x3a465c,
  },
  upperLegR: {
    type: "box",
    size: [0.22, 0.56, 0.22],
    mass: 4,
    offset: new THREE.Vector3(0.19, 0.72, 0),
    color: 0x3a465c,
  },
  lowerLegR: {
    type: "box",
    size: [0.2, 0.56, 0.2],
    mass: 3,
    offset: new THREE.Vector3(0.19, 0.16, 0),
    color: 0x3a465c,
  },
};

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fcfff, 110, 1200);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2600);
camera.position.set(18, 7, 26);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const toggleDayNightButton = document.getElementById("day-night-toggle");

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ShiftLeft: false,
  ShiftRight: false,
};

let gameStarted = false;
let mode = "walk";

let isDraggingCamera = false;
let cameraYaw = Math.PI * 0.78;
let cameraPitch = 0.34;
let cameraDistance = 8.7;

let walkCycle = 0;
let teleportCooldown = 0;
let currentStatus = "Climb the stairs to the rooftop, then ragdoll and fall.";
let grassWindUniformRef = null;

const player = {
  position: new THREE.Vector3(20, 0, 24),
  yaw: Math.PI,
  velocityY: 0,
  velocityXZ: new THREE.Vector3(),
  spawn: new THREE.Vector3(20, 0, 24),
};

const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const tempVecA = new THREE.Vector3();
const tempVecB = new THREE.Vector3();

const skyUniforms = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uCloudTex: { value: createCloudTexture() },
};

const skyDome = createSkyDome();
scene.add(skyDome);

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(13, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xffecab, transparent: true, opacity: 0.95 })
);
sunMesh.position.set(330, 290, -180);
scene.add(sunMesh);

const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(10, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xdbe5ff, transparent: true, opacity: 0.95 })
);
moonMesh.position.set(-290, 250, 220);
scene.add(moonMesh);

const hemiLight = new THREE.HemisphereLight(0xc6e2ff, 0x4d6f3f, 1.0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(240, 430, 140);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -420;
dirLight.shadow.camera.right = 420;
dirLight.shadow.camera.top = 420;
dirLight.shadow.camera.bottom = -420;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 980;
scene.add(dirLight);

const ambientRimLight = new THREE.DirectionalLight(0x8bbdff, 0.25);
ambientRimLight.position.set(-260, 180, -200);
scene.add(ambientRimLight);

const ground = createGround();
scene.add(ground);

const grass = createGrassField();
scene.add(grass);

const skyscraper = createSkyscraper();
scene.add(skyscraper);

const teleportPad = createTeleportPad();
scene.add(teleportPad);

const humanoid = createHumanoidRig();
scene.add(humanoid.group);

const ragdollVisualGroup = createRagdollVisualGroup();
ragdollVisualGroup.visible = false;
scene.add(ragdollVisualGroup);

const physicsWorld = new CANNON.World({
  gravity: new CANNON.Vec3(0, -30, 0),
});
physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.allowSleep = true;

const groundPhysicsMat = new CANNON.Material("ground");
const ragdollPhysicsMat = new CANNON.Material("ragdoll");
physicsWorld.addContactMaterial(
  new CANNON.ContactMaterial(groundPhysicsMat, ragdollPhysicsMat, {
    friction: 0.58,
    restitution: 0.08,
  })
);

setupStaticPhysicsColliders(groundPhysicsMat);

const ragdollBodies = new Map();
const ragdollConstraints = [];
const ragdollVelocity = new THREE.Vector3();

let nightBlend = 0;
let nightBlendTarget = 0;

setupEvents();
setNightMode(false);
updateHumanoidVisual(0, 0, 0);

const clock = new THREE.Clock();
animate();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  skyUniforms.uTime.value += delta;
  if (grassWindUniformRef) {
    grassWindUniformRef.value = elapsed;
  }
  updateDayNightBlend(delta);

  if (gameStarted) {
    if (mode === "walk") {
      updateWalking(delta, elapsed);
      updateTeleportPad(delta, elapsed);
      updateHumanoidVisual(delta, elapsed, player.velocityXZ.length());
    } else {
      updateRagdoll(delta);
    }
  } else {
    updateHumanoidVisual(delta, elapsed, 0);
  }

  updateCamera(delta);

  renderer.render(scene, camera);
}

function setupEvents() {
  overlay.addEventListener("click", () => {
    gameStarted = true;
    overlay.classList.add("hidden");
    statusEl.textContent = currentStatus;
  });

  toggleDayNightButton.addEventListener("click", () => {
    setNightMode(nightBlendTarget < 0.5);
  });

  window.addEventListener("keydown", (event) => {
    if (event.code in keys) {
      keys[event.code] = true;
    }

    if (event.code === "KeyF" && !event.repeat && gameStarted && mode === "walk") {
      enterRagdollMode();
    }

    if (event.code === "KeyR" && !event.repeat) {
      resetToSpawn();
    }

    if (event.code === "KeyN" && !event.repeat) {
      setNightMode(nightBlendTarget < 0.5);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code in keys) {
      keys[event.code] = false;
    }
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (!gameStarted || event.button !== 0) {
      return;
    }

    isDraggingCamera = true;
    renderer.domElement.setPointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (event.button !== 0) {
      return;
    }

    isDraggingCamera = false;
    renderer.domElement.releasePointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!isDraggingCamera || !gameStarted) {
      return;
    }

    cameraYaw -= event.movementX * 0.0042;
    cameraPitch -= event.movementY * 0.0036;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, 0.1, 1.1);
  });

  renderer.domElement.addEventListener("wheel", (event) => {
    cameraDistance += event.deltaY * 0.01;
    cameraDistance = THREE.MathUtils.clamp(cameraDistance, 4.8, 14.5);
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function updateWalking(delta, elapsed) {
  const forwardInput = Number(keys.KeyW) - Number(keys.KeyS);
  const strafeInput = Number(keys.KeyD) - Number(keys.KeyA);

  tempVecA.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  tempVecB.set(tempVecA.z, 0, -tempVecA.x);

  const moveDir = new THREE.Vector3();
  moveDir.addScaledVector(tempVecA, forwardInput);
  moveDir.addScaledVector(tempVecB, strafeInput);

  if (moveDir.lengthSq() > 1) {
    moveDir.normalize();
  }

  const targetSpeed = keys.ShiftLeft || keys.ShiftRight ? RUN_SPEED : WALK_SPEED;
  const targetVelocity = moveDir.multiplyScalar(targetSpeed);
  const accelBlend = 1 - Math.exp(-16 * delta);
  player.velocityXZ.lerp(targetVelocity, accelBlend);

  const desired = player.position.clone().addScaledVector(player.velocityXZ, delta);
  desired.x = THREE.MathUtils.clamp(desired.x, -WORLD_SIZE * 0.5, WORLD_SIZE * 0.5);
  desired.z = THREE.MathUtils.clamp(desired.z, -WORLD_SIZE * 0.5, WORLD_SIZE * 0.5);

  const resolvedHorizontal = resolveBuildingCollision(player.position, desired, player.position.y);
  player.position.x = resolvedHorizontal.x;
  player.position.z = resolvedHorizontal.z;

  const supportHeight = getSupportHeight(player.position.x, player.position.z, player.position.y);
  const stepDiff = supportHeight - player.position.y;

  if (stepDiff <= 0.45 && player.velocityY <= 0) {
    player.velocityY = 0;
    player.position.y = supportHeight;
  } else {
    player.velocityY -= GRAVITY * delta;
    player.position.y += player.velocityY * delta;

    if (player.position.y < supportHeight) {
      player.position.y = supportHeight;
      player.velocityY = 0;
    }
  }

  if (player.position.y < -35) {
    resetToSpawn();
    return;
  }

  if (targetVelocity.lengthSq() > 0.2) {
    const desiredYaw = Math.atan2(targetVelocity.x, targetVelocity.z);
    player.yaw = dampAngle(player.yaw, desiredYaw, 12, delta);
  }

  walkCycle += delta * (3 + player.velocityXZ.length() * 1.2);

  const topProgress = THREE.MathUtils.clamp(player.position.y / ROOF_Y, 0, 1);
  if (topProgress > 0.95) {
    setStatus("You reached the rooftop. Move to an edge and press F to ragdoll-fall.");
  } else if (topProgress > 0.1) {
    setStatus(`Climbing... ${Math.round(topProgress * 100)}% to rooftop.`);
  } else {
    setStatus("Climb the interior stairs, or step on the floor teleport pad near the building.");
  }

  const pulse = 0.5 + Math.sin(elapsed * 5) * 0.5;
  teleportPad.material.emissiveIntensity = 0.7 + pulse * 1.1;
}

function resolveBuildingCollision(currentPos, desiredPos, footY) {
  if (footY > WALL_COLLIDER_TOP) {
    return desiredPos;
  }

  const insideCurrent =
    Math.abs(currentPos.x) < BUILDING_HALF_WIDTH - PLAYER_RADIUS &&
    Math.abs(currentPos.z) < BUILDING_HALF_DEPTH - PLAYER_RADIUS;

  const insideDesired =
    Math.abs(desiredPos.x) < BUILDING_HALF_WIDTH - PLAYER_RADIUS &&
    Math.abs(desiredPos.z) < BUILDING_HALF_DEPTH - PLAYER_RADIUS;

  if (insideCurrent === insideDesired) {
    return desiredPos;
  }

  const crossingFrontDoor =
    Math.abs(desiredPos.x) < DOOR_WIDTH * 0.5 &&
    desiredPos.z > BUILDING_HALF_DEPTH - 1.6 &&
    desiredPos.z < BUILDING_HALF_DEPTH + 1.8 &&
    footY < DOOR_HEIGHT;

  if (crossingFrontDoor) {
    return desiredPos;
  }

  return currentPos.clone();
}

function getSupportHeight(x, z, currentY) {
  let support = 0;

  const insideBuilding = Math.abs(x) < BUILDING_HALF_WIDTH - 0.5 && Math.abs(z) < BUILDING_HALF_DEPTH - 0.5;

  if (insideBuilding) {
    const stairY = getSpiralStairHeight(x, z, currentY);
    if (stairY !== null) {
      support = Math.max(support, stairY);
    }

    if (currentY > ROOF_Y - 3.4) {
      support = Math.max(support, ROOF_Y);
    }
  }

  return support;
}

function getSpiralStairHeight(x, z, currentY) {
  const radius = Math.hypot(x, z);
  if (radius < STAIR_INNER_RADIUS || radius > STAIR_OUTER_RADIUS) {
    return null;
  }

  let theta = Math.atan2(z, x);
  if (theta < 0) {
    theta += Math.PI * 2;
  }

  let localTheta = theta - STAIR_PHASE;
  if (localTheta < 0) {
    localTheta += Math.PI * 2;
  }

  const baseHeight = (localTheta / (Math.PI * 2)) * STAIR_RISE_PER_TURN;
  const nearestTurn = Math.round((currentY - baseHeight) / STAIR_RISE_PER_TURN);
  const stairHeight = baseHeight + nearestTurn * STAIR_RISE_PER_TURN;

  if (stairHeight < -0.2 || stairHeight > ROOF_Y + STAIR_STEP_RISE * 2) {
    return null;
  }

  return stairHeight;
}

function updateTeleportPad(delta, elapsed) {
  teleportCooldown = Math.max(0, teleportCooldown - delta);

  teleportPad.position.y = 0.12 + Math.sin(elapsed * 4.2) * 0.05;

  if (teleportCooldown > 0) {
    return;
  }

  const dx = player.position.x - TELEPORT_PAD_POSITION.x;
  const dz = player.position.z - TELEPORT_PAD_POSITION.z;

  if (dx * dx + dz * dz <= TELEPORT_RADIUS * TELEPORT_RADIUS && player.position.y < 2.5) {
    player.position.copy(TELEPORT_DESTINATION);
    player.velocityY = 0;
    player.velocityXZ.set(0, 0, 0);
    teleportCooldown = 1.2;
    setStatus("Teleport pad activated. You are now at the rooftop.");
  }
}

function updateHumanoidVisual(delta, elapsed, speed) {
  humanoid.group.visible = true;
  humanoid.group.position.copy(player.position);
  humanoid.group.rotation.y = player.yaw;

  const normalizedSpeed = THREE.MathUtils.clamp(speed / RUN_SPEED, 0, 1);
  const swing = Math.sin(walkCycle * 2.2) * 0.75 * normalizedSpeed;
  const counterSwing = -swing;
  const kneeLeft = Math.max(0, -swing) * 0.95;
  const kneeRight = Math.max(0, swing) * 0.95;

  humanoid.hips.position.y = 1.06 + Math.sin(walkCycle * 4.4) * 0.03 * normalizedSpeed;
  humanoid.spinePivot.rotation.x = Math.sin(elapsed * 2.4) * 0.03 * normalizedSpeed;

  humanoid.leftLegHip.rotation.x = swing;
  humanoid.rightLegHip.rotation.x = counterSwing;
  humanoid.leftKnee.rotation.x = kneeLeft;
  humanoid.rightKnee.rotation.x = kneeRight;

  humanoid.leftShoulder.rotation.x = counterSwing * 0.75;
  humanoid.rightShoulder.rotation.x = swing * 0.75;
  humanoid.leftElbow.rotation.x = Math.max(0, swing) * 0.35;
  humanoid.rightElbow.rotation.x = Math.max(0, -swing) * 0.35;
}

function updateCamera(delta) {
  if (mode === "walk") {
    cameraTarget.set(player.position.x, player.position.y + 1.45, player.position.z);
  } else {
    const torso = ragdollBodies.get("torso");
    if (torso) {
      cameraTarget.set(torso.position.x, torso.position.y + 0.7, torso.position.z);
    }
  }

  desiredCameraPosition.set(
    cameraTarget.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
    cameraTarget.y + Math.sin(cameraPitch) * cameraDistance + 0.5,
    cameraTarget.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance
  );

  if (desiredCameraPosition.y < 0.5) {
    desiredCameraPosition.y = 0.5;
  }

  const cameraBlend = 1 - Math.exp(-10 * delta);
  camera.position.lerp(desiredCameraPosition, cameraBlend);
  camera.lookAt(cameraTarget);
}

function enterRagdollMode() {
  clearRagdoll();

  mode = "ragdoll";
  humanoid.group.visible = false;
  ragdollVisualGroup.visible = true;

  const yaw = player.yaw;
  const moveVel = player.velocityXZ.clone();

  for (const [name, spec] of Object.entries(RAGDOLL_SPEC)) {
    const body = new CANNON.Body({
      mass: spec.mass,
      material: ragdollPhysicsMat,
      linearDamping: 0.08,
      angularDamping: 0.34,
    });

    if (spec.type === "box") {
      body.addShape(new CANNON.Box(new CANNON.Vec3(spec.size[0] * 0.5, spec.size[1] * 0.5, spec.size[2] * 0.5)));
    } else {
      body.addShape(new CANNON.Sphere(spec.radius));
    }

    const offset = rotateOffsetByYaw(spec.offset, yaw);
    body.position.set(player.position.x + offset.x, player.position.y + offset.y, player.position.z + offset.z);
    body.quaternion.setFromEuler(0, yaw, 0, "YZX");

    body.velocity.set(moveVel.x, player.velocityY, moveVel.z);

    physicsWorld.addBody(body);
    ragdollBodies.set(name, body);
  }

  addRagdollConstraints();

  ragdollVelocity.copy(moveVel);
  ragdollVelocity.y = player.velocityY;

  syncRagdollVisuals();
  setStatus("Ragdoll active. Watch your limbs crumple. Press R to respawn.");
}

function addRagdollConstraints() {
  addP2PConstraint("pelvis", "torso", [0, 0.16, 0], [0, -0.43, 0]);
  addP2PConstraint("torso", "head", [0, 0.42, 0], [0, -0.23, 0]);

  addP2PConstraint("torso", "upperArmL", [-0.34, 0.27, 0], [0, 0.23, 0]);
  addP2PConstraint("upperArmL", "lowerArmL", [0, -0.23, 0], [0, 0.23, 0]);

  addP2PConstraint("torso", "upperArmR", [0.34, 0.27, 0], [0, 0.23, 0]);
  addP2PConstraint("upperArmR", "lowerArmR", [0, -0.23, 0], [0, 0.23, 0]);

  addP2PConstraint("pelvis", "upperLegL", [-0.16, -0.16, 0], [0, 0.28, 0]);
  addP2PConstraint("upperLegL", "lowerLegL", [0, -0.28, 0], [0, 0.28, 0]);

  addP2PConstraint("pelvis", "upperLegR", [0.16, -0.16, 0], [0, 0.28, 0]);
  addP2PConstraint("upperLegR", "lowerLegR", [0, -0.28, 0], [0, 0.28, 0]);
}

function addP2PConstraint(bodyAName, bodyBName, pivotA, pivotB) {
  const bodyA = ragdollBodies.get(bodyAName);
  const bodyB = ragdollBodies.get(bodyBName);

  if (!bodyA || !bodyB) {
    return;
  }

  const constraint = new CANNON.PointToPointConstraint(
    bodyA,
    new CANNON.Vec3(pivotA[0], pivotA[1], pivotA[2]),
    bodyB,
    new CANNON.Vec3(pivotB[0], pivotB[1], pivotB[2]),
    4e5
  );

  constraint.collideConnected = false;

  physicsWorld.addConstraint(constraint);
  ragdollConstraints.push(constraint);
}

function updateRagdoll(delta) {
  physicsWorld.step(1 / 60, delta, 5);
  syncRagdollVisuals();

  const pelvisBody = ragdollBodies.get("pelvis");
  if (!pelvisBody) {
    return;
  }

  if (pelvisBody.position.y < -40) {
    resetToSpawn();
  }
}

function syncRagdollVisuals() {
  for (const [name, body] of ragdollBodies.entries()) {
    const mesh = ragdollVisualGroup.userData.meshMap.get(name);
    if (!mesh) {
      continue;
    }

    mesh.position.set(body.position.x, body.position.y, body.position.z);
    mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
  }
}

function clearRagdoll() {
  for (const constraint of ragdollConstraints) {
    physicsWorld.removeConstraint(constraint);
  }
  ragdollConstraints.length = 0;

  for (const body of ragdollBodies.values()) {
    physicsWorld.removeBody(body);
  }
  ragdollBodies.clear();
}

function resetToSpawn() {
  clearRagdoll();

  mode = "walk";
  ragdollVisualGroup.visible = false;
  humanoid.group.visible = true;

  player.position.copy(player.spawn);
  player.velocityY = 0;
  player.velocityXZ.set(0, 0, 0);
  player.yaw = Math.PI;
  walkCycle = 0;

  setStatus("Reset complete. Climb stairs or use the teleport pad to reach the top quickly.");
}

function setStatus(text) {
  currentStatus = text;
  statusEl.textContent = text;
}

function updateDayNightBlend(delta) {
  const blendRate = 1 - Math.exp(-2.4 * delta);
  nightBlend = THREE.MathUtils.lerp(nightBlend, nightBlendTarget, blendRate);

  skyUniforms.uNight.value = nightBlend;

  const dayFog = new THREE.Color(0x9fcfff);
  const nightFog = new THREE.Color(0x0f1726);
  scene.fog.color.copy(dayFog).lerp(nightFog, nightBlend);

  hemiLight.intensity = THREE.MathUtils.lerp(1.0, 0.28, nightBlend);
  dirLight.intensity = THREE.MathUtils.lerp(1.1, 0.33, nightBlend);
  ambientRimLight.intensity = THREE.MathUtils.lerp(0.25, 0.17, nightBlend);

  dirLight.color.setRGB(
    THREE.MathUtils.lerp(1.0, 0.56, nightBlend),
    THREE.MathUtils.lerp(1.0, 0.68, nightBlend),
    THREE.MathUtils.lerp(1.0, 0.95, nightBlend)
  );

  sunMesh.material.opacity = 1 - nightBlend;
  moonMesh.material.opacity = nightBlend;
  sunMesh.visible = sunMesh.material.opacity > 0.01;
  moonMesh.visible = moonMesh.material.opacity > 0.01;
}

function setNightMode(useNight) {
  nightBlendTarget = useNight ? 1 : 0;
  toggleDayNightButton.textContent = useNight ? "Toggle Day" : "Toggle Night";
}

function dampAngle(current, target, lambda, delta) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * delta));
}

function rotateOffsetByYaw(offset, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);

  return new THREE.Vector3(offset.x * c - offset.z * s, offset.y, offset.x * s + offset.z * c);
}

function setupStaticPhysicsColliders(groundMaterial) {
  const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI * 0.5, 0, 0);
  physicsWorld.addBody(groundBody);

  addStaticBoxCollider(
    new CANNON.Vec3(BUILDING_HALF_WIDTH, 0.18, BUILDING_HALF_DEPTH),
    new CANNON.Vec3(0, ROOF_Y, 0),
    groundMaterial
  );

  addStaticBoxCollider(
    new CANNON.Vec3(BUILDING_HALF_WIDTH, BUILDING_HEIGHT * 0.5, WALL_THICKNESS * 0.5),
    new CANNON.Vec3(0, BUILDING_HEIGHT * 0.5, -BUILDING_HALF_DEPTH),
    groundMaterial
  );

  addStaticBoxCollider(
    new CANNON.Vec3(WALL_THICKNESS * 0.5, BUILDING_HEIGHT * 0.5, BUILDING_HALF_DEPTH),
    new CANNON.Vec3(-BUILDING_HALF_WIDTH, BUILDING_HEIGHT * 0.5, 0),
    groundMaterial
  );

  addStaticBoxCollider(
    new CANNON.Vec3(WALL_THICKNESS * 0.5, BUILDING_HEIGHT * 0.5, BUILDING_HALF_DEPTH),
    new CANNON.Vec3(BUILDING_HALF_WIDTH, BUILDING_HEIGHT * 0.5, 0),
    groundMaterial
  );

  const sideSegmentHalfWidth = (BUILDING_HALF_WIDTH - DOOR_WIDTH * 0.5) * 0.5;
  const sideSegmentCenterOffset = (BUILDING_HALF_WIDTH + DOOR_WIDTH * 0.5) * 0.5;

  addStaticBoxCollider(
    new CANNON.Vec3(sideSegmentHalfWidth, BUILDING_HEIGHT * 0.5, WALL_THICKNESS * 0.5),
    new CANNON.Vec3(-sideSegmentCenterOffset, BUILDING_HEIGHT * 0.5, BUILDING_HALF_DEPTH),
    groundMaterial
  );

  addStaticBoxCollider(
    new CANNON.Vec3(sideSegmentHalfWidth, BUILDING_HEIGHT * 0.5, WALL_THICKNESS * 0.5),
    new CANNON.Vec3(sideSegmentCenterOffset, BUILDING_HEIGHT * 0.5, BUILDING_HALF_DEPTH),
    groundMaterial
  );

  const topDoorSegmentHalfY = (BUILDING_HEIGHT - DOOR_HEIGHT) * 0.5;
  addStaticBoxCollider(
    new CANNON.Vec3(DOOR_WIDTH * 0.5, topDoorSegmentHalfY, WALL_THICKNESS * 0.5),
    new CANNON.Vec3(0, DOOR_HEIGHT + topDoorSegmentHalfY, BUILDING_HALF_DEPTH),
    groundMaterial
  );
}

function addStaticBoxCollider(halfExtents, position, material) {
  const body = new CANNON.Body({ mass: 0, material });
  body.addShape(new CANNON.Box(halfExtents));
  body.position.copy(position);
  physicsWorld.addBody(body);
}

function createGround() {
  const groundTexture = createGroundTexture();
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(280, 280);
  groundTexture.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1),
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 1,
      metalness: 0,
    })
  );
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.receiveShadow = true;

  return mesh;
}

function createGrassField() {
  const bladeTexture = createGrassBladeTexture();
  bladeTexture.colorSpace = THREE.SRGBColorSpace;

  const bladeGeometry = new THREE.PlaneGeometry(0.28, 1.4, 1, 4);
  bladeGeometry.translate(0, 0.7, 0);

  const grassMaterial = new THREE.MeshStandardMaterial({
    map: bladeTexture,
    alphaMap: bladeTexture,
    transparent: true,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.95,
    metalness: 0,
    color: 0xb4df96,
  });

  const grassWindUniform = { value: 0 };

  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = grassWindUniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\\nuniform float uWindTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
          float bend = uv.y * uv.y;
          float wind = sin(uWindTime * 2.4 + instanceMatrix[3][0] * 0.39 + instanceMatrix[3][2] * 0.29);
          float gust = cos(uWindTime * 1.35 + instanceMatrix[3][0] * 0.18 - instanceMatrix[3][2] * 0.23);
          transformed.x += (wind * 0.22 + gust * 0.10) * bend;
          transformed.z += (wind * 0.08 - gust * 0.14) * bend;`
      );
  };

  const count = 14000;
  const instancedGrass = new THREE.InstancedMesh(bladeGeometry, grassMaterial, count);
  instancedGrass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedGrass.castShadow = true;

  const dummy = new THREE.Object3D();
  let index = 0;

  while (index < count) {
    const x = THREE.MathUtils.randFloatSpread(WORLD_SIZE * 0.95);
    const z = THREE.MathUtils.randFloatSpread(WORLD_SIZE * 0.95);

    const insideBuildingPad =
      Math.abs(x) < BUILDING_HALF_WIDTH + 10 &&
      Math.abs(z) < BUILDING_HALF_DEPTH + 10;

    if (insideBuildingPad) {
      continue;
    }

    dummy.position.set(x, 0, z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    const scale = THREE.MathUtils.randFloat(0.72, 1.45);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();

    instancedGrass.setMatrixAt(index, dummy.matrix);
    index += 1;
  }

  const group = new THREE.Group();
  group.add(instancedGrass);

  group.userData.windUniform = grassWindUniform;
  group.userData.instanced = instancedGrass;
  grassWindUniformRef = grassWindUniform;

  return group;
}

function createSkyscraper() {
  const building = new THREE.Group();

  const concreteTexture = createConcreteTexture();
  concreteTexture.wrapS = THREE.RepeatWrapping;
  concreteTexture.wrapT = THREE.RepeatWrapping;
  concreteTexture.repeat.set(4, 24);
  concreteTexture.colorSpace = THREE.SRGBColorSpace;

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: concreteTexture,
    roughness: 0.86,
    metalness: 0.08,
    color: 0xd0d5dc,
  });

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b424b,
    roughness: 0.74,
    metalness: 0.12,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc3dbf7,
    roughness: 0.2,
    metalness: 0.22,
    transmission: 0.08,
    transparent: true,
    opacity: 0.9,
  });

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_HALF_WIDTH * 2 + 2.4, 1.2, BUILDING_HALF_DEPTH * 2 + 2.4),
    new THREE.MeshStandardMaterial({ color: 0x8d959f, roughness: 0.95 })
  );
  slab.position.y = 0.6;
  slab.receiveShadow = true;
  slab.castShadow = true;
  building.add(slab);

  const rows = 52;
  building.add(
    createFacadeSide({
      width: BUILDING_HALF_WIDTH * 2,
      height: BUILDING_HEIGHT,
      rows,
      cols: 6,
      wallMaterial,
      frameMaterial,
      glassMaterial,
      y: BUILDING_HEIGHT * 0.5,
      z: BUILDING_HALF_DEPTH,
      rotationY: 0,
      frontWithDoor: true,
    })
  );

  building.add(
    createFacadeSide({
      width: BUILDING_HALF_WIDTH * 2,
      height: BUILDING_HEIGHT,
      rows,
      cols: 6,
      wallMaterial,
      frameMaterial,
      glassMaterial,
      y: BUILDING_HEIGHT * 0.5,
      z: -BUILDING_HALF_DEPTH,
      rotationY: Math.PI,
      frontWithDoor: false,
    })
  );

  building.add(
    createFacadeSide({
      width: BUILDING_HALF_DEPTH * 2,
      height: BUILDING_HEIGHT,
      rows,
      cols: 4,
      wallMaterial,
      frameMaterial,
      glassMaterial,
      y: BUILDING_HEIGHT * 0.5,
      z: BUILDING_HALF_WIDTH,
      rotationY: Math.PI * 0.5,
      frontWithDoor: false,
    })
  );

  building.add(
    createFacadeSide({
      width: BUILDING_HALF_DEPTH * 2,
      height: BUILDING_HEIGHT,
      rows,
      cols: 4,
      wallMaterial,
      frameMaterial,
      glassMaterial,
      y: BUILDING_HEIGHT * 0.5,
      z: -BUILDING_HALF_WIDTH,
      rotationY: -Math.PI * 0.5,
      frontWithDoor: false,
    })
  );

  const cornerMaterial = new THREE.MeshStandardMaterial({ color: 0xbec4cb, roughness: 0.8 });
  const cornerGeo = new THREE.BoxGeometry(0.7, BUILDING_HEIGHT, 0.7);
  const corners = [
    new THREE.Vector3(BUILDING_HALF_WIDTH, BUILDING_HEIGHT * 0.5, BUILDING_HALF_DEPTH),
    new THREE.Vector3(-BUILDING_HALF_WIDTH, BUILDING_HEIGHT * 0.5, BUILDING_HALF_DEPTH),
    new THREE.Vector3(BUILDING_HALF_WIDTH, BUILDING_HEIGHT * 0.5, -BUILDING_HALF_DEPTH),
    new THREE.Vector3(-BUILDING_HALF_WIDTH, BUILDING_HEIGHT * 0.5, -BUILDING_HALF_DEPTH),
  ];

  for (const corner of corners) {
    const col = new THREE.Mesh(cornerGeo, cornerMaterial);
    col.position.copy(corner);
    col.castShadow = true;
    col.receiveShadow = true;
    building.add(col);
  }

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_HALF_WIDTH * 2 - 0.8, 0.35, BUILDING_HALF_DEPTH * 2 - 0.8),
    new THREE.MeshStandardMaterial({ color: 0x9098a1, roughness: 0.92 })
  );
  roof.position.y = ROOF_Y + 0.18;
  roof.receiveShadow = true;
  roof.castShadow = true;
  building.add(roof);

  const parapetMaterial = new THREE.MeshStandardMaterial({ color: 0x646c76, roughness: 0.8 });

  const backParapet = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_HALF_WIDTH * 2 - 0.6, 1.1, 0.5),
    parapetMaterial
  );
  backParapet.position.set(0, ROOF_Y + 0.72, -BUILDING_HALF_DEPTH + 0.22);
  building.add(backParapet);

  const leftParapet = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.1, BUILDING_HALF_DEPTH * 2 - 0.6),
    parapetMaterial
  );
  leftParapet.position.set(-BUILDING_HALF_WIDTH + 0.22, ROOF_Y + 0.72, 0);
  building.add(leftParapet);

  const rightParapet = leftParapet.clone();
  rightParapet.position.x = BUILDING_HALF_WIDTH - 0.22;
  building.add(rightParapet);

  const frontParapetLeft = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_HALF_WIDTH - 2.4, 1.1, 0.5),
    parapetMaterial
  );
  frontParapetLeft.position.set(-BUILDING_HALF_WIDTH * 0.5 - 1.2, ROOF_Y + 0.72, BUILDING_HALF_DEPTH - 0.22);
  building.add(frontParapetLeft);

  const frontParapetRight = frontParapetLeft.clone();
  frontParapetRight.position.x = BUILDING_HALF_WIDTH * 0.5 + 1.2;
  building.add(frontParapetRight);

  const stairs = createSpiralStaircase();
  building.add(stairs);

  const stairCore = new THREE.Mesh(
    new THREE.CylinderGeometry(STAIR_INNER_RADIUS - 0.8, STAIR_INNER_RADIUS - 0.8, BUILDING_HEIGHT, 24),
    new THREE.MeshStandardMaterial({ color: 0x8f98a3, roughness: 0.88 })
  );
  stairCore.position.y = BUILDING_HEIGHT * 0.5;
  stairCore.castShadow = true;
  stairCore.receiveShadow = true;
  building.add(stairCore);

  const entranceFloor = new THREE.Mesh(
    new THREE.CircleGeometry(STAIR_OUTER_RADIUS + 0.6, 40),
    new THREE.MeshStandardMaterial({ color: 0x9aa3af, roughness: 0.9 })
  );
  entranceFloor.rotation.x = -Math.PI * 0.5;
  entranceFloor.position.y = 0.01;
  entranceFloor.receiveShadow = true;
  building.add(entranceFloor);

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH + 0.26, DOOR_HEIGHT + 0.26, 0.36),
    frameMaterial
  );
  doorFrame.position.set(0, DOOR_HEIGHT * 0.5, BUILDING_HALF_DEPTH + 0.02);
  building.add(doorFrame);

  const doorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(DOOR_WIDTH, DOOR_HEIGHT),
    new THREE.MeshPhysicalMaterial({
      color: 0x88aacc,
      roughness: 0.2,
      transmission: 0.1,
      transparent: true,
      opacity: 0.85,
    })
  );
  doorGlass.position.set(0, DOOR_HEIGHT * 0.5, BUILDING_HALF_DEPTH + 0.22);
  building.add(doorGlass);

  return building;
}

function createFacadeSide({
  width,
  height,
  rows,
  cols,
  wallMaterial,
  frameMaterial,
  glassMaterial,
  y,
  z,
  rotationY,
  frontWithDoor,
}) {
  const group = new THREE.Group();
  group.position.set(0, y, z);
  group.rotation.y = rotationY;

  if (frontWithDoor) {
    const sideWidth = (width - DOOR_WIDTH) * 0.5;
    const topHeight = height - DOOR_HEIGHT;

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(sideWidth, height), wallMaterial);
    leftWall.position.x = -DOOR_WIDTH * 0.5 - sideWidth * 0.5;
    leftWall.receiveShadow = true;
    leftWall.castShadow = true;
    group.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = DOOR_WIDTH * 0.5 + sideWidth * 0.5;
    group.add(rightWall);

    const topWall = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_WIDTH, topHeight), wallMaterial);
    topWall.position.y = -height * 0.5 + DOOR_HEIGHT + topHeight * 0.5;
    topWall.receiveShadow = true;
    topWall.castShadow = true;
    group.add(topWall);
  } else {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMaterial);
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);
  }

  const frame = 0.32;
  const cellW = (width - frame * (cols + 1)) / cols;
  const cellH = (height - frame * (rows + 1)) / rows;

  const verticalBars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(frame, height, 0.22),
    frameMaterial,
    cols + 1
  );

  const horizontalBars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(width, frame, 0.22),
    frameMaterial,
    rows + 1
  );

  const dummy = new THREE.Object3D();

  for (let c = 0; c <= cols; c += 1) {
    const x = -width * 0.5 + c * (cellW + frame);
    dummy.position.set(x, 0, 0.12);
    dummy.updateMatrix();
    verticalBars.setMatrixAt(c, dummy.matrix);
  }

  for (let r = 0; r <= rows; r += 1) {
    const yy = -height * 0.5 + r * (cellH + frame);
    dummy.position.set(0, yy, 0.12);
    dummy.updateMatrix();
    horizontalBars.setMatrixAt(r, dummy.matrix);
  }

  verticalBars.castShadow = true;
  horizontalBars.castShadow = true;
  group.add(verticalBars, horizontalBars);

  const windowMatrices = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = -width * 0.5 + frame + cellW * 0.5 + c * (cellW + frame);
      const yy = -height * 0.5 + frame + cellH * 0.5 + r * (cellH + frame);

      const overlapsDoor =
        frontWithDoor &&
        Math.abs(x) < DOOR_WIDTH * 0.5 &&
        yy - cellH * 0.5 < -height * 0.5 + DOOR_HEIGHT;

      if (overlapsDoor) {
        continue;
      }

      dummy.position.set(x, yy, 0.22);
      dummy.updateMatrix();
      windowMatrices.push(dummy.matrix.clone());
    }
  }

  const windows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(cellW * 0.86, cellH * 0.84),
    glassMaterial,
    windowMatrices.length
  );

  for (let i = 0; i < windowMatrices.length; i += 1) {
    windows.setMatrixAt(i, windowMatrices[i]);
  }

  windows.castShadow = true;
  windows.receiveShadow = true;
  group.add(windows);

  return group;
}

function createSpiralStaircase() {
  const stairGroup = new THREE.Group();

  const radialDepth = STAIR_OUTER_RADIUS - STAIR_INNER_RADIUS;
  const stepLength = 2.2;
  const stepGeometry = new THREE.BoxGeometry(radialDepth, STAIR_STEP_RISE * 0.9, stepLength);
  const stepMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d6746,
    roughness: 0.94,
    metalness: 0.03,
  });

  const steps = new THREE.InstancedMesh(stepGeometry, stepMaterial, STAIR_COUNT);
  steps.castShadow = true;
  steps.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const radius = (STAIR_INNER_RADIUS + STAIR_OUTER_RADIUS) * 0.5;

  for (let i = 0; i < STAIR_COUNT; i += 1) {
    const theta = STAIR_PHASE + i * STAIR_STEP_ANGLE;
    const y = i * STAIR_STEP_RISE + STAIR_STEP_RISE * 0.45;

    dummy.position.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
    dummy.rotation.set(0, -theta, 0);
    dummy.updateMatrix();
    steps.setMatrixAt(i, dummy.matrix);
  }

  stairGroup.add(steps);

  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x3b3e44, roughness: 0.6, metalness: 0.4 });
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8);
  const postCount = Math.floor(STAIR_COUNT / 4);
  const posts = new THREE.InstancedMesh(postGeo, railMaterial, postCount);

  for (let i = 0; i < postCount; i += 1) {
    const stepIndex = i * 4;
    const theta = STAIR_PHASE + stepIndex * STAIR_STEP_ANGLE;
    const y = stepIndex * STAIR_STEP_RISE + 0.45;

    dummy.position.set(Math.cos(theta) * (STAIR_OUTER_RADIUS + 0.1), y, Math.sin(theta) * (STAIR_OUTER_RADIUS + 0.1));
    dummy.rotation.set(0, -theta, 0);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  }

  stairGroup.add(posts);

  return stairGroup;
}

function createTeleportPad() {
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.22, 32),
    new THREE.MeshStandardMaterial({
      color: 0x4fc8ff,
      emissive: 0x2bb9ff,
      emissiveIntensity: 1,
      roughness: 0.36,
      metalness: 0.62,
    })
  );
  pad.position.copy(TELEPORT_PAD_POSITION);
  pad.castShadow = true;
  pad.receiveShadow = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.42, 0.08, 14, 44),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x82e4ff, emissiveIntensity: 0.8 })
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = 0.12;
  pad.add(ring);

  return pad;
}

function createHumanoidRig() {
  const group = new THREE.Group();
  group.position.copy(player.position);

  const skin = new THREE.MeshStandardMaterial({ color: 0xd9ab83, roughness: 0.95 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x3e6e9d, roughness: 0.84 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x3c465c, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x2a2a31, roughness: 0.88 });

  const hips = new THREE.Group();
  hips.position.y = 1.06;
  group.add(hips);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.3), shirt);
  pelvis.castShadow = true;
  hips.add(pelvis);

  const spinePivot = new THREE.Group();
  spinePivot.position.y = 0.3;
  hips.add(spinePivot);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.36), shirt);
  torso.position.y = 0.42;
  torso.castShadow = true;
  spinePivot.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 18), skin);
  head.position.y = 1.02;
  head.castShadow = true;
  spinePivot.add(head);

  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.43, 0.73, 0);
  spinePivot.add(leftShoulder);

  const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.48, 14), skin);
  leftUpperArm.position.y = -0.24;
  leftUpperArm.castShadow = true;
  leftShoulder.add(leftUpperArm);

  const leftElbow = new THREE.Group();
  leftElbow.position.y = -0.48;
  leftShoulder.add(leftElbow);

  const leftLowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.48, 14), skin);
  leftLowerArm.position.y = -0.24;
  leftLowerArm.castShadow = true;
  leftElbow.add(leftLowerArm);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.43, 0.73, 0);
  spinePivot.add(rightShoulder);

  const rightUpperArm = leftUpperArm.clone();
  rightShoulder.add(rightUpperArm);

  const rightElbow = new THREE.Group();
  rightElbow.position.y = -0.48;
  rightShoulder.add(rightElbow);

  const rightLowerArm = leftLowerArm.clone();
  rightElbow.add(rightLowerArm);

  const leftLegHip = new THREE.Group();
  leftLegHip.position.set(-0.19, -0.02, 0);
  hips.add(leftLegHip);

  const leftUpperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.56, 14), pants);
  leftUpperLeg.position.y = -0.28;
  leftUpperLeg.castShadow = true;
  leftLegHip.add(leftUpperLeg);

  const leftKnee = new THREE.Group();
  leftKnee.position.y = -0.56;
  leftLegHip.add(leftKnee);

  const leftLowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.56, 14), pants);
  leftLowerLeg.position.y = -0.28;
  leftLowerLeg.castShadow = true;
  leftKnee.add(leftLowerLeg);

  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.35), shoes);
  leftFoot.position.set(0, -0.62, 0.09);
  leftFoot.castShadow = true;
  leftKnee.add(leftFoot);

  const rightLegHip = new THREE.Group();
  rightLegHip.position.set(0.19, -0.02, 0);
  hips.add(rightLegHip);

  const rightUpperLeg = leftUpperLeg.clone();
  rightLegHip.add(rightUpperLeg);

  const rightKnee = new THREE.Group();
  rightKnee.position.y = -0.56;
  rightLegHip.add(rightKnee);

  const rightLowerLeg = leftLowerLeg.clone();
  rightKnee.add(rightLowerLeg);

  const rightFoot = leftFoot.clone();
  rightKnee.add(rightFoot);

  return {
    group,
    hips,
    spinePivot,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftLegHip,
    rightLegHip,
    leftKnee,
    rightKnee,
  };
}

function createRagdollVisualGroup() {
  const group = new THREE.Group();
  const meshMap = new Map();

  for (const [name, spec] of Object.entries(RAGDOLL_SPEC)) {
    let geometry;

    if (spec.type === "box") {
      geometry = new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
    } else {
      geometry = new THREE.SphereGeometry(spec.radius, 20, 16);
    }

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.88, metalness: 0.05 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);
    meshMap.set(name, mesh);
  }

  group.userData.meshMap = meshMap;
  return group;
}

function createSkyDome() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1200, 56, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldDirection;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uNight;
        uniform sampler2D uCloudTex;

        varying vec3 vWorldDirection;
        varying vec2 vUv;

        void main() {
          float h = clamp(vWorldDirection.y * 0.5 + 0.5, 0.0, 1.0);

          vec3 dayTop = vec3(0.35, 0.67, 0.95);
          vec3 dayBottom = vec3(0.79, 0.92, 1.0);

          vec3 nightTop = vec3(0.03, 0.06, 0.12);
          vec3 nightBottom = vec3(0.11, 0.16, 0.27);

          vec3 dayGradient = mix(dayBottom, dayTop, pow(h, 0.62));
          vec3 nightGradient = mix(nightBottom, nightTop, pow(h, 0.85));
          vec3 sky = mix(dayGradient, nightGradient, uNight);

          vec2 cloudUv = vUv * vec2(2.8, 1.8);
          cloudUv.x += uTime * 0.0046;
          cloudUv.y += uTime * 0.0018;

          float cloudSample = texture2D(uCloudTex, cloudUv).r;
          float cloudMask = smoothstep(0.46, 0.83, cloudSample);

          vec3 cloudColor = mix(vec3(1.0), vec3(0.73, 0.79, 0.91), uNight);
          float cloudStrength = mix(0.6, 0.23, uNight);

          vec3 color = mix(sky, cloudColor, cloudMask * cloudStrength * (0.42 + 0.58 * h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
  );
}

function createGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#5f8e52";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 2300; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const shade = 80 + Math.random() * 70;
    ctx.fillStyle = `rgba(${shade - 20}, ${shade + 30}, ${shade - 10}, 0.24)`;
    ctx.fillRect(x, y, 2, 2);
  }

  for (let i = 0; i < 320; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.strokeStyle = "rgba(30, 70, 24, 0.25)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + THREE.MathUtils.randFloat(-8, 8), y + THREE.MathUtils.randFloat(4, 14));
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createGrassBladeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 36; i += 1) {
    const baseX = THREE.MathUtils.randFloat(20, 108);
    const height = THREE.MathUtils.randFloat(150, 240);
    const width = THREE.MathUtils.randFloat(6, 13);

    const gradient = ctx.createLinearGradient(baseX, 256 - height, baseX, 256);
    gradient.addColorStop(0, "rgba(181, 244, 132, 0.0)");
    gradient.addColorStop(0.25, "rgba(167, 236, 117, 0.7)");
    gradient.addColorStop(1, "rgba(80, 154, 59, 1)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(baseX, 256 - height);
    ctx.lineTo(baseX - width, 256);
    ctx.lineTo(baseX + width, 256);
    ctx.closePath();
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function createConcreteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#cfd5dc";
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4200; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const tone = 180 + Math.random() * 45;
    ctx.fillStyle = `rgba(${tone}, ${tone}, ${tone}, 0.25)`;
    ctx.fillRect(x, y, 1, 1);
  }

  for (let i = 0; i < 220; i += 1) {
    const y = Math.random() * 256;
    ctx.strokeStyle = "rgba(100, 108, 118, 0.06)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + THREE.MathUtils.randFloat(-2, 2));
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 540; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = THREE.MathUtils.randFloat(22, 88);

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,0.22)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
