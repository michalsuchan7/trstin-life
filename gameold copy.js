
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// SCÉNA
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 100, 450);

const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// SVETLO
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-50, 100, 50);
sun.castShadow = true;
scene.add(sun);

scene.add(new THREE.HemisphereLight(0xffffff, 0x567044, 2));

// TERÉN
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ color: 0x558b43 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

// CESTA
const road = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 1000),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
scene.add(road);

// STREDOVÁ ČIARA
for (let z = -480; z < 500; z += 12) {
    const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.03, z);
    scene.add(line);
}

// DOMY
function createHouse(x, z, color) {
    const house = new THREE.Group();

    const walls = new THREE.Mesh(
        new THREE.BoxGeometry(9, 6, 9),
        new THREE.MeshStandardMaterial({ color })
    );
    walls.position.y = 3;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);

    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(7.2, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x713b2b })
    );
    roof.position.y = 8;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);

    const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 3, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x49301f })
    );
    door.position.set(0, 1.5, 4.6);
    house.add(door);

    house.position.set(x, 0, z);
    scene.add(house);
}

// STROMY
function createTree(x, z) {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x68452c })
    );
    trunk.position.y = 2;
    tree.add(trunk);

    const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x246b32 })
    );
    leaves.position.y = 5;
    leaves.castShadow = true;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    scene.add(tree);
}

// ROZLOŽENIE DEDINY
const houseColors = [0xe8d8bd, 0xd7c4a5, 0xd5d5d5, 0xe5c9a5];

for (let z = -200; z < 220; z += 35) {
    createHouse(-22, z, houseColors[Math.floor(Math.random() * 4)]);
    createHouse(22, z + 15, houseColors[Math.floor(Math.random() * 4)]);

    createTree(-38, z + 12);
    createTree(38, z - 10);
}

// AUTO
const car = new THREE.Group();

const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.8, 4.5),
    new THREE.MeshStandardMaterial({
        color: 0x1769aa,
        metalness: 0.5,
        roughness: 0.3
    })
);
body.position.y = 0.9;
body.castShadow = true;
car.add(body);

const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.9, 2.2),
    new THREE.MeshStandardMaterial({
        color: 0x263d4a,
        metalness: 0.3,
        roughness: 0.2
    })
);
cabin.position.set(0, 1.7, -0.25);
cabin.castShadow = true;
car.add(cabin);

// KOLESÁ
const wheels = [];

for (const x of [-1.15, 1.15]) {
    for (const z of [-1.45, 1.45]) {
        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.45, 0.3, 20),
            new THREE.MeshStandardMaterial({ color: 0x151515 })
        );

        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.48, z);
        wheel.castShadow = true;
        car.add(wheel);
        wheels.push(wheel);
    }
}

car.position.set(0, 0, 0);
scene.add(car);

// OVLÁDANIE
const keys = {};

window.addEventListener('keydown', e => {
    keys[e.code] = true;
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

let speed = 0;
let rotation = 0;

const speedDisplay = document.getElementById('speed');
const clock = new THREE.Clock();

// KAMERA
const cameraTarget = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    // PLYN A BRZDA
    if (keys['KeyW'] || keys['ArrowUp']) {
        speed += 18 * delta;
    } else if (keys['KeyS'] || keys['ArrowDown']) {
        speed -= 22 * delta;
    } else {
        speed *= Math.pow(0.96, delta * 60);
    }

    if (keys['Space']) {
        speed *= Math.pow(0.88, delta * 60);
    }

    speed = THREE.MathUtils.clamp(speed, -12, 45);

    // ZATÁČANIE
    if (Math.abs(speed) > 0.5) {
        const steering =
            (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) -
            (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);

        rotation += steering * 1.5 * delta * Math.sign(speed);
    }

    car.rotation.y = rotation;

    // POHYB AUTA
    car.position.x += Math.sin(rotation) * speed * delta;
    car.position.z += Math.cos(rotation) * speed * delta;

    // OTÁČANIE KOLIES
    wheels.forEach(wheel => {
        wheel.rotation.x += speed * delta * 0.7;
    });

    // KAMERA ZA AUTOM
    const behind = new THREE.Vector3(
        -Math.sin(rotation) * 9,
        5,
        -Math.cos(rotation) * 9
    );

    const desiredCamera = car.position.clone().add(behind);

    camera.position.lerp(
        desiredCamera,
        1 - Math.pow(0.001, delta)
    );

    cameraTarget.copy(car.position);
    cameraTarget.y += 1.5;
    camera.lookAt(cameraTarget);

    // RÝCHLOMER
    speedDisplay.textContent =
        Math.round(Math.abs(speed) * 3.6) + ' km/h';

    renderer.render(scene, camera);
}

animate();

// SKRYTIE NAČÍTAVANIA
document.getElementById('loading').style.display = 'none';

// ZMENA VEĽKOSTI OKNA
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
