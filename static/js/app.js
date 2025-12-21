import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer;
let controller, reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

// STATE
let currentModelConfig = null; 
let placedObjects = [];
const loader = new GLTFLoader();

init();

async function init() {
    // 1. Scene & Lights
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2); // Stronger light
    dirLight.position.set(0, 5, 0);
    scene.add(dirLight);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 3. Setup Dock & Undo Button
    const dock = document.getElementById('wishlist-dock');
    
    // Add Undo Button
    const undoBtn = document.createElement('div');
    undoBtn.className = 'item-card';
    undoBtn.style.background = '#8B0000'; // Dark Red
    undoBtn.innerHTML = '<span class="item-icon">↩</span><span>Undo</span>';
    undoBtn.onclick = () => {
        if (placedObjects.length > 0) {
            const last = placedObjects.pop();
            scene.remove(last);
        }
    };
    dock.appendChild(undoBtn);

    // 4. Fetch Wishlist from FastAPI
    try {
        const res = await fetch('/api/models'); // Relative path works automatically now!
        const models = await res.json();

        models.forEach(model => {
            const btn = document.createElement('div');
            btn.className = 'item-card';
            btn.innerHTML = `<span class="item-icon">${model.icon}</span><span>${model.name}</span>`;
            btn.onclick = () => {
                currentModelConfig = model;
                document.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
            };
            dock.appendChild(btn);
        });
    } catch (e) {
        console.error("Error loading models:", e);
    }

    // 5. AR Button
    document.body.appendChild(ARButton.createButton(renderer, { 
        requiredFeatures: ['hit-test'], 
        optionalFeatures: ['dom-overlay'], 
        domOverlay: { root: dock } 
    }));

    // 6. Reticle (The Ring)
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // 7. Tap Listener
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    renderer.setAnimationLoop(render);
}

function onSelect() {
    if (reticle.visible && currentModelConfig) {
        document.getElementById('loading').style.display = 'block';
        
        loader.load(currentModelConfig.path, (gltf) => {
            const model = gltf.scene;
            model.position.setFromMatrixPosition(reticle.matrix);
            
            // Scale Model
            const s = currentModelConfig.scale;
            model.scale.set(s, s, s);
            
            scene.add(model);
            placedObjects.push(model);
            document.getElementById('loading').style.display = 'none';
        }, undefined, (err) => {
            console.error("Error loading GLB:", err);
            document.getElementById('loading').style.display = 'none';
        });
    }
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then((refSpace) => {
                session.requestHitTestSource({ space: refSpace }).then((source) => {
                    hitTestSource = source;
                });
            });
            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}