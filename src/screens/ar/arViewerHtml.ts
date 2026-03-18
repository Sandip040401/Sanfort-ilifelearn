export function buildARViewerHtml(modelFileUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>3D Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; touch-action: none; }
    canvas { display: block; width: 100%; height: 100%; touch-action: none; }
    #status {
      position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      color: white; font-family: system-ui; font-size: 12px; font-weight: 600;
      background: rgba(0,0,0,0.5); padding: 6px 14px; border-radius: 20px; z-index: 10;
      transition: opacity 0.5s;
    }
    #status.hidden { opacity: 0; pointer-events: none; }
    #paintIndicator {
      position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
      color: white; font-family: system-ui; font-size: 11px; font-weight: 600;
      background: rgba(108,76,255,0.8); padding: 4px 12px; border-radius: 12px;
      z-index: 10; transition: opacity 0.3s; opacity: 0; pointer-events: none;
    }
    #paintIndicator.visible { opacity: 1; }
  </style>
  <script type="importmap">
  { "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/"
  }}
  </script>
</head>
<body>
  <div id="status">Loading model...</div>
  <div id="paintIndicator">Paint Mode</div>
  <script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

  function arrayBufferToBase64(buffer) {
    return new Promise((resolve) => {
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  const status = document.getElementById('status');
  const paintIndicator = document.getElementById('paintIndicator');
  function postMsg(obj) { try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {} }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(2, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.5;
  controls.minDistance = 1;
  controls.maxDistance = 20;

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
  dirLight.position.set(10, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const pointLight = new THREE.PointLight(0xffffff, 1.5);
  pointLight.position.set(-10, -10, -10);
  scene.add(pointLight);

  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.4;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(20, 20, 0x0ea5a4, 0x063047);
  grid.position.y = -1.4;
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);

  let loadedModel = null;
  let mixer = null;
  let paintingEnabled = false;
  let brushColor = '#ff0000';
  let brushSize = 12;
  let pointerDown = false;
  let isPlaying = true;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const lastPoints = new Map();
  const PAINT_TEX_SIZE = 1024;

  function getMeshMaterials(mesh) {
    if (!mesh || !mesh.material) return [];
    return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  }

  function applyTextureToMesh(mesh, texture, forceWhite) {
    const materials = getMeshMaterials(mesh);
    materials.forEach((material) => {
      if (!material) return;
      material.map = texture;
      if (forceWhite && material.color) {
        material.color.set('#ffffff');
      }
      material.needsUpdate = true;
    });
  }

  function restoreOriginalMaterial(mesh) {
    const materials = getMeshMaterials(mesh);
    materials.forEach((material, index) => {
      if (!material || !mesh.userData.paint) return;
      material.map = mesh.userData.paint.origMaps[index] || null;
      const origColor = mesh.userData.paint.origColors[index];
      if (material.color && origColor) {
        material.color.copy(origColor);
      }
      material.needsUpdate = true;
    });
  }

  function showStoredTargetTexture() {
    if (!loadedModel) return;
    loadedModel.traverse(c => {
      if (c.isMesh && c.userData.paint && c.userData.paint.targetTex) {
        applyTextureToMesh(c, c.userData.paint.targetTex, true);
      }
    });
  }

  const loader = new GLTFLoader();
  loader.load(
    '${modelFileUrl}',
    (gltf) => {
      loadedModel = gltf.scene;
      scene.add(loadedModel);

      const box = new THREE.Box3().setFromObject(loadedModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.5 / maxDim;
      loadedModel.scale.setScalar(scale);
      loadedModel.position.sub(center.multiplyScalar(scale));
      loadedModel.position.y -= (box.min.y * scale);

      loadedModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          setupPaintCanvas(child);
        }
      });

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(loadedModel);
        window._gltfAnimations = gltf.animations;
        const names = gltf.animations.map(a => a.name || 'Action');
        postMsg({ type: 'animations', list: names });
        window._currentAnimation = gltf.animations[0];
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
      }

      status.classList.add('hidden');
      postMsg({ type: 'loaded' });
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        status.textContent = 'Loading... ' + pct + '%';
        postMsg({ type: 'progress', percent: pct });
      }
    },
    (error) => {
      status.textContent = 'Failed to load model';
      postMsg({ type: 'error', message: error.message || 'Load error' });
    }
  );

  function setupPaintCanvas(mesh) {
    if (!mesh.geometry || !mesh.geometry.attributes.uv) return;
    const canvas = document.createElement('canvas');
    canvas.width = PAINT_TEX_SIZE;
    canvas.height = PAINT_TEX_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAINT_TEX_SIZE, PAINT_TEX_SIZE);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    const materials = getMeshMaterials(mesh).map(material => material.clone());
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    const currentMaterials = getMeshMaterials(mesh);
    const origMaps = currentMaterials.map(material => (material && material.map) ? material.map : null);
    const origColors = currentMaterials.map(material => (material && material.color) ? material.color.clone() : null);
    mesh.userData.paint = { canvas, ctx, tex, targetTex: null, origMaps, origColors, size: PAINT_TEX_SIZE };
  }

  function paintAt(intersect) {
    if (!intersect) return;
    const uv = intersect.uv;
    const mesh = intersect.object;
    if (!mesh || !mesh.userData.paint || !uv) return;
    const p = mesh.userData.paint;
    const px = Math.floor(Math.max(0, Math.min(1, uv.x)) * p.size);
    const py = Math.floor((1 - Math.max(0, Math.min(1, uv.y))) * p.size);
    p.ctx.fillStyle = brushColor;
    p.ctx.beginPath();
    p.ctx.arc(px, py, brushSize, 0, Math.PI * 2);
    p.ctx.fill();
    const key = mesh.uuid;
    const prev = lastPoints.get(key);
    if (prev) {
      p.ctx.strokeStyle = brushColor;
      p.ctx.lineWidth = brushSize * 2;
      p.ctx.lineCap = 'round';
      p.ctx.beginPath();
      p.ctx.moveTo(prev.x, prev.y);
      p.ctx.lineTo(px, py);
      p.ctx.stroke();
    }
    lastPoints.set(key, { x: px, y: py });
    p.tex.needsUpdate = true;
  }

  function getPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!paintingEnabled) return;
    pointerDown = true;
    getPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(scene, true);
    if (hits.length > 0) paintAt(hits[0]);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!paintingEnabled || !pointerDown) return;
    getPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(scene, true);
    if (hits.length > 0) paintAt(hits[0]);
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
    lastPoints.clear();
  });

  function handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'toggleRotate') controls.autoRotate = data.value;
      if (data.type === 'togglePlay') {
        isPlaying = data.value;
        if (mixer) mixer.timeScale = isPlaying ? 1 : 0;
      }
      if (data.type === 'setAnimation') {
        if (mixer && window._gltfAnimations) {
          mixer.stopAllAction();
          const clip = window._gltfAnimations.find(a => (a.name || 'Action') === data.value);
          if (clip) {
            window._currentAnimation = clip;
            const action = mixer.clipAction(clip);
            action.play();
            mixer.timeScale = isPlaying ? 1 : 0;
          }
        }
      }
      if (data.type === 'toggleWireframe') {
        if (loadedModel) {
          loadedModel.traverse(c => {
            if (c.isMesh) { c.material.wireframe = data.value; c.material.needsUpdate = true; }
          });
        }
      }
      if (data.type === 'enablePaint') {
        paintingEnabled = data.value;
        controls.enabled = !data.value;
        paintIndicator.classList.toggle('visible', data.value);
      }
      if (data.type === 'setBrushColor') brushColor = data.value;
      if (data.type === 'setBrushSize') brushSize = data.value;
      if (data.type === 'clearPaint') {
        if (loadedModel) {
          loadedModel.traverse(c => {
            if (c.isMesh && c.userData.paint) {
              c.userData.paint.ctx.fillStyle = '#ffffff';
              c.userData.paint.ctx.fillRect(0, 0, c.userData.paint.size, c.userData.paint.size);
              c.userData.paint.tex.needsUpdate = true;
            }
          });
        }
      }
      if (data.type === 'showPaintTexture') {
        if (loadedModel) {
          loadedModel.traverse(c => {
            if (c.isMesh && c.userData.paint) {
              applyTextureToMesh(c, c.userData.paint.tex, true);
            }
          });
        }
      }
      if (data.type === 'showTargetTexture') {
        showStoredTargetTexture();
      }
      if (data.type === 'showOriginalTexture') {
        if (loadedModel) {
          loadedModel.traverse(c => {
            if (c.isMesh && c.userData.paint) {
              restoreOriginalMaterial(c);
            }
          });
        }
      }
      if (data.type === 'applyTargetTexture' && data.dataUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || PAINT_TEX_SIZE;
          canvas.height = img.naturalHeight || img.height || PAINT_TEX_SIZE;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const tex = new THREE.CanvasTexture(canvas);
          tex.flipY = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          if (loadedModel) {
            loadedModel.traverse(c => {
              if (c.isMesh && c.userData.paint) {
                c.userData.paint.targetTex = tex;
                applyTextureToMesh(c, tex, true);
              }
            });
          }
        };
        img.src = data.dataUrl;
      }
      if (data.type === 'exportGLB') {
        if (!loadedModel) return;
        postMsg({ type: 'exportStatus', status: 'Exporting 3D scene...' });
        loadedModel.traverse(c => {
          getMeshMaterials(c).forEach(material => {
            if (material && material.map) {
              material.map.needsUpdate = true;
            }
          });
        });

        renderer.render(scene, camera);
        const exporter = new GLTFExporter();
        const exportAnims = window._gltfAnimations || [];
        exporter.parse(
          loadedModel,
          async function(gltf) {
            postMsg({ type: 'exportStatus', status: 'Converting file format...' });
            try {
              const base64 = await arrayBufferToBase64(gltf);
              postMsg({ type: 'glbData', base64: base64 });
            } catch (e) {
              postMsg({ type: 'error', message: 'Base64 conversion failed: ' + e.message });
            }
          },
          function(error) {
            postMsg({ type: 'error', message: 'Export failed: ' + error });
          },
          { binary: true, animations: exportAnims }
        );
      }
    } catch(e) {}
  }

  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  </script>
</body>
</html>`;
}

export function buildColorSheetHtml(targetUrl: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f0f0f0; touch-action: none; display: flex; align-items: center; justify-content: center; }
    #wrapper { position: relative; display: inline-block; }
    canvas { display: block; touch-action: none; }
    #bgCanvas { position: absolute; top: 0; left: 0; pointer-events: none; }
    #drawCanvas { position: absolute; top: 0; left: 0; cursor: crosshair; }
    #loading {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: #666; font-family: system-ui; pointer-events: none; user-select: none; -webkit-user-select: none;
    }
  </style>
</head>
<body>
  <div id="wrapper">
    <canvas id="bgCanvas"></canvas>
    <canvas id="drawCanvas"></canvas>
    <div id="loading">Loading image...</div>
  </div>
  <canvas id="maskCanvas" style="display:none"></canvas>
  <script>
  var bgCanvas = document.getElementById('bgCanvas');
  var drawCanvas = document.getElementById('drawCanvas');
  var maskCanvas = document.getElementById('maskCanvas');
  var wrapper = document.getElementById('wrapper');
  var loadingEl = document.getElementById('loading');
  var isDrawing = false, lastPos = null;
  var bColor = '#ff0000', bSize = 12;
  function postMsg(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e) {} }

  var img = new Image();
  var canUseMask = true;

  function setupImageHandlers() {
    img.onload = function() {
      var maxW = window.innerWidth - 16;
      var maxH = window.innerHeight - 16;
      var sc = Math.min(1, maxW / img.width, maxH / img.height);
      var w = Math.floor(img.width * sc);
      var h = Math.floor(img.height * sc);
      if (w <= 0 || h <= 0) return;

      bgCanvas.width = w; bgCanvas.height = h;
      drawCanvas.width = w; drawCanvas.height = h;
      maskCanvas.width = w; maskCanvas.height = h;
      wrapper.style.width = w + 'px';
      wrapper.style.height = h + 'px';
      bgCanvas.getContext('2d').drawImage(img, 0, 0, w, h);

      try {
        var mCtx = maskCanvas.getContext('2d');
        mCtx.drawImage(img, 0, 0, w, h);
        var id = mCtx.getImageData(0, 0, w, h);
        for (var i = 0; i < id.data.length; i += 4) {
          if (id.data[i] > 230 && id.data[i+1] > 230 && id.data[i+2] > 230) {
            id.data[i] = 255; id.data[i+1] = 255; id.data[i+2] = 255; id.data[i+3] = 255;
          } else {
            id.data[i] = 0; id.data[i+1] = 0; id.data[i+2] = 0; id.data[i+3] = 0;
          }
        }
        mCtx.putImageData(id, 0, 0);
      } catch (e) {
        canUseMask = false;
      }

      loadingEl.style.display = 'none';
      postMsg({ type: 'sheetLoaded' });
    };
  }

  function tryLoadImage() {
    var baseUri = ${JSON.stringify(targetUrl)};
    if (!baseUri) {
      loadingEl.textContent = 'Error: No URL provided';
      return;
    }

    setupImageHandlers();
    var tUrl = baseUri.includes('?') ? (baseUri + '&v=' + Date.now()) : (baseUri + '?v=' + Date.now());
    img.crossOrigin = 'anonymous';
    img.onerror = function() {
      if (img.crossOrigin) {
        img.crossOrigin = null;
        img.src = tUrl;
      } else {
        loadingEl.textContent = 'Connection failed';
        postMsg({ type: 'error', message: 'Failed to load: ' + baseUri });
      }
    };
    img.src = tUrl;
    if (img.complete && img.naturalWidth > 0) {
      img.onload();
    }
  }

  setTimeout(tryLoadImage, 50);

  function inMask(x, y) {
    if (!canUseMask) return true;
    try {
      var p = maskCanvas.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      return p[3] > 0;
    } catch (e) { return true; }
  }
  function paintAt(x, y) {
    if (!inMask(x, y)) return;
    var ctx = drawCanvas.getContext('2d');
    ctx.fillStyle = bColor;
    ctx.beginPath();
    ctx.arc(x, y, bSize, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawLine(x1, y1, x2, y2) {
    var d = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
    var steps = Math.max(1, Math.floor(d / (bSize / 2)));
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      paintAt(x1 + (x2-x1)*t, y1 + (y2-y1)*t);
    }
  }
  function getPos(e) {
    var r = drawCanvas.getBoundingClientRect();
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) * (drawCanvas.width / r.width), y: (cy - r.top) * (drawCanvas.height / r.height) };
  }

  drawCanvas.addEventListener('pointerdown', function(e) { e.preventDefault(); isDrawing = true; var p = getPos(e); lastPos = p; paintAt(p.x, p.y); });
  drawCanvas.addEventListener('pointermove', function(e) { if (!isDrawing) return; e.preventDefault(); var p = getPos(e); if (lastPos) drawLine(lastPos.x, lastPos.y, p.x, p.y); lastPos = p; });
  window.addEventListener('pointerup', function() { isDrawing = false; lastPos = null; });

  function handleMsg(event) {
    try {
      var data = JSON.parse(event.data);
      if (data.type === 'setBrushColor') bColor = data.value;
      if (data.type === 'setBrushSize') bSize = data.value;
      if (data.type === 'clear') {
        drawCanvas.getContext('2d').clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      }
      if (data.type === 'export') {
        try {
          var out = document.createElement('canvas');
          out.width = drawCanvas.width; out.height = drawCanvas.height;
          var ctx = out.getContext('2d');
          ctx.drawImage(bgCanvas, 0, 0);
          ctx.drawImage(drawCanvas, 0, 0);
          postMsg({ type: 'textureReady', dataUrl: out.toDataURL('image/png') });
        } catch(e) {
          try {
            postMsg({ type: 'textureReady', dataUrl: drawCanvas.toDataURL('image/png') });
          } catch (e2) {
            postMsg({ type: 'error', message: 'Export failed: ' + e.name + ' - ' + e.message });
          }
        }
      }
    } catch(e) {}
  }
  window.addEventListener('message', handleMsg);
  document.addEventListener('message', handleMsg);
  </script>
</body>
</html>`;
}
