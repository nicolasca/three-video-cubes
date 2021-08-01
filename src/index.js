import * as THREE from "three";
import * as CANNON from "cannon-es";
import * as dat from "dat.gui";
import cannonDebugger from "cannon-es-debugger";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DragControls } from "three/examples/jsm/controls/DragControls.js";

let container;

let camera, scene, renderer;

let video, texture, material, mesh, orbitControls, dragControls, world, gui;

let isDragging = false;
let moveBodies = false;
let bodiesInHoleCount = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

let cube_count;

const meshes = [],
  materials = [],
  bodies = [],
  xgrid = 5,
  ygrid = 3;

const startButton = document.getElementById("startButton");
startButton.addEventListener("click", function () {
  init();
  animate();
  const guiHtml = document.querySelector(".dg.ac ");
  guiHtml.style.zIndex = 1;
});

function init() {
  gui = new dat.GUI();

  const overlay = document.getElementById("overlay");
  overlay.remove();

  container = document.createElement("div");
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.x = 300;
  camera.position.y = 800;
  camera.position.z = 1500;

  const cameraGuiFolder = gui.addFolder("Camera");
  cameraGuiFolder.add(camera.position, "x", -500, 500, 1);
  cameraGuiFolder.add(camera.position, "y", 0, 1000, 1);
  cameraGuiFolder.add(camera.position, "z", 0, 2000, 1);

  scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  const light = new THREE.DirectionalLight(0xffffff);
  light.position.set(0.5, 1, 1).normalize();
  scene.add(light);
  scene.add(ambientLight);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  video = document.getElementById("video");
  video.muted = true;
  video.play();
  video.currentTime = 200;

  texture = new THREE.VideoTexture(video);

  document.addEventListener("keydown", (e) => {
    if (e.key === "p") {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    } else if (e.key === "e") {
      console.log("apply impulse");

      const middleValue = Math.round((xgrid * ygrid - 1) / 2);
      const middleBody = bodies[middleValue];
      const middleBody1 = bodies[middleValue - 1];
      const middleBody2 = bodies[middleValue + 1];

      middleBody.applyImpulse(new CANNON.Vec3(600, 600, 600));
      middleBody1.applyImpulse(new CANNON.Vec3(-600, 600, -50));
      middleBody2.applyImpulse(new CANNON.Vec3(400, -300, 500));
    } else if (e.key === "a") {
      world.gravity.set(0, 9.82, 0);
    } else if (e.key === "m") {
      moveBodies = true;
      moveBodiesToHole(bodies[9]);
      /*   bodies.forEach((body) => {
        moveBodiesToHole(body);
      }); */
    }
  });

  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target.set(0, 0);

  let i, j, ox, oy, geometry;

  const ux = 1 / xgrid;
  const uy = 1 / ygrid;

  const xsize = 1280 / 4 / xgrid;
  const ysize = 534 / 4 / ygrid;

  const parameters = { color: 0xffffff, map: texture };

  cube_count = 0;

  // Add a physical world

  world = new CANNON.World();
  world.gravity.set(0, -59.82, 0);

  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane()
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // make it face up
  groundBody.position.y = -100;
  world.addBody(groundBody);

  // Debugger
  //cannonDebugger(scene, world.bodies);

  for (i = 0; i < xgrid; i++) {
    for (j = 0; j < ygrid; j++) {
      ox = i;
      oy = j;

      geometry = new THREE.BoxGeometry(xsize, ysize, xsize);

      change_uvs(geometry, ux, uy, ox, oy);

      materials[cube_count] = new THREE.MeshLambertMaterial(parameters);

      material = materials[cube_count];

      //material.hue = i / xgrid;
      //material.saturation = 1 - j / ygrid;
      //material.color.setHSL(material.hue, material.saturation, 0.5);

      mesh = new THREE.Mesh(geometry, material);

      mesh.position.x = i * xsize - 160 + xsize / 2;
      mesh.position.y = j * ysize;
      mesh.position.z = 0;

      //mesh.scale.x = mesh.scale.y = mesh.scale.z = 1;

      scene.add(mesh);

      meshes[cube_count] = mesh;
      cube_count += 1;

      // Create physical bodies
      const halfExtents = new CANNON.Vec3(xsize / 2, ysize / 2, xsize / 2);
      const boxShape = new CANNON.Box(halfExtents);
      const body = new CANNON.Body({
        mass: 1,
        shape: boxShape
      });
      body.position.copy(mesh.position);
      bodies.push(body);
      // Add the body to the world
      world.addBody(body);

      mesh.bodyId = body.id;
    }
  }

  /**
   * Create hole
   */
  const holeGeometry = new THREE.CircleGeometry(100, 32);
  const holeMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const holeMesh = new THREE.Mesh(holeGeometry, holeMaterial);
  holeMesh.position.x = 800;
  holeMesh.position.y = -100;
  holeMesh.rotation.x = -Math.PI / 2;

  gui.add(holeMesh.position, "x", -10, 500, 0.001);
  gui.add(holeMesh.position, "y", -100, 500, 0.001);

  scene.add(holeMesh);

  /**
   * Drag controls
   */
  dragControls = new DragControls([...meshes], camera, renderer.domElement);
  dragControls.addEventListener("dragstart", function (event) {
    isDragging = true;
    orbitControls.enabled = false;
    event.object.material.emissive.set(0xaaaaaa);
  });

  dragControls.addEventListener("dragend", function (event) {
    isDragging = false;
    orbitControls.enabled = true;
    event.object.material.emissive.set(0x000000);
  });

  dragControls.addEventListener("drag", (item) => {
    // Update the physical body to the mesh being dragged
    const mesh = item.object;
    const body = bodies.find((body) => body.id === mesh.bodyId);
    body.position.copy(mesh.position);
    body.quaternion.copy(mesh.quaternion);
  });

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function change_uvs(geometry, unitx, unity, offsetx, offsety) {
  const uvs = geometry.attributes.uv.array;

  for (let i = 0; i < uvs.length; i += 2) {
    uvs[i] = (uvs[i] + offsetx) * unitx;
    uvs[i + 1] = (uvs[i + 1] + offsety) * unity;
  }
}

const clock = new THREE.Clock();
let oldElapsedTime = 0;
function animate() {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  // Update physics
  world.step(1 / 60, deltaTime, 3);

  // update meshes position and rotation
  if (!isDragging) {
    meshes.forEach((mesh, index) => {
      mesh.position.copy(bodies[index].position);
      mesh.quaternion.copy(bodies[index].quaternion);
    });
  }

  orbitControls.update();
  render();
  requestAnimationFrame(animate);
}

function render() {
  renderer.render(scene, camera);
}

function moveBodiesToHole(body) {
  console.log("Body n°", bodiesInHoleCount);

  var startPosition = body.position;
  var endPosition = new CANNON.Vec3(80, -10, 0);
  var tweenTime = 3; // seconds

  var direction = new CANNON.Vec3();
  endPosition.vsub(startPosition, direction);
  var totalLength = direction.length();
  direction.normalize();

  var speed = totalLength / tweenTime;
  direction.scale(speed, body.velocity);

  moveBodies = true;
  // Save the start time
  var startTime = world.time;

  var offset = new CANNON.Vec3();

  function postStepListener() {
    var progress = (world.time - startTime) / tweenTime;

    if (progress < 1) {
      // Calculate current position
      direction.scale(progress * totalLength, offset);
      startPosition.vadd(offset, body.position);
      console.log(progress);
    } else {
      // We passed the end position! Stop.
      body.velocity.set(0, 0, 0);
      body.position.copy(endPosition);
      world.removeEventListener("postStep", postStepListener);

      // Check if last arrived
      bodiesInHoleCount++;
      if (bodiesInHoleCount === bodies.length) {
        moveBodies = false;
        console.log("Finished !");
      } else {
        console.log("not finished");
        //moveBodiesToHole();
      }
    }
  }

  world.addEventListener("postStep", postStepListener);
}
