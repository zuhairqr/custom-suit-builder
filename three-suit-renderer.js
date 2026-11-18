'use strict';

// Three.js Simple Suit Configurator - Clean & Connected
// Using unified approach with properly positioned geometries

class ThreeSuitRenderer {
  constructor(containerId, onZoomChange) {
    this.container = document.getElementById(containerId);
    if (!this.container || !window.THREE) {
      console.warn('Three.js not available or container missing');
      return;
    }

    this.scene = new window.THREE.Scene();
    this.scene.background = new window.THREE.Color(0xf5f3f0);

    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 800;
    this.camera = new window.THREE.PerspectiveCamera(28, width / height, 0.1, 1000);
    this.camera.position.set(0, 1.2, 5);
    this.camera.lookAt(0, 1, 0);
    this.onZoomChange = onZoomChange;

    this.renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = window.THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = window.THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupEnvironment();
    this.createModel();
    this.setupControls();

    this.animate();
    this.handleResize = () => this.onWindowResize();
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  setupLighting() {
    // Key light - main illumination
    const keyLight = new window.THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(4, 6, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -2;
    this.scene.add(keyLight);

    // Fill light - soften shadows
    const fillLight = new window.THREE.DirectionalLight(0xd4e4ff, 0.4);
    fillLight.position.set(-4, 3, 3);
    this.scene.add(fillLight);

    // Rim light - edge definition
    const rimLight = new window.THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, 4, -5);
    this.scene.add(rimLight);

    // Ambient base
    const ambient = new window.THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);
  }

  setupEnvironment() {
    // Simple floor
    const floorGeometry = new window.THREE.PlaneGeometry(20, 20);
    const floorMaterial = new window.THREE.MeshStandardMaterial({
      color: 0xf0ece5,
      roughness: 0.9,
      metalness: 0
    });
    const floor = new window.THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  createModel() {
    // Single group for entire model
    this.modelGroup = new window.THREE.Group();

    // Materials
    const skinMat = new window.THREE.MeshStandardMaterial({
      color: 0xf0d8c8,
      roughness: 0.5,
      metalness: 0
    });

    const fabricMat = new window.THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.75,
      metalness: 0.02
    });
    this.fabricMaterial = fabricMat;
    this.currentFabricIndex = null;

    const shirtMat = new window.THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0
    });

    // === HEAD ===
    const headGeom = new window.THREE.SphereGeometry(0.2, 24, 16);
    headGeom.scale(1, 1.15, 0.95);
    const head = new window.THREE.Mesh(headGeom, skinMat);
    head.position.set(0, 1.75, 0);
    head.castShadow = true;
    this.modelGroup.add(head);

    // === NECK ===
    const neckGeom = new window.THREE.CylinderGeometry(0.09, 0.11, 0.2, 16);
    const neck = new window.THREE.Mesh(neckGeom, skinMat);
    neck.position.set(0, 1.54, 0);
    neck.castShadow = true;
    this.modelGroup.add(neck);

    // === SHIRT COLLAR (visible above jacket) ===
    const collarGeom = new window.THREE.CylinderGeometry(0.12, 0.13, 0.05, 16, 1, true);
    const collar = new window.THREE.Mesh(collarGeom, shirtMat);
    collar.position.set(0, 1.42, 0);
    this.modelGroup.add(collar);

    // Collar points
    for (const side of [-1, 1]) {
      const pointGeom = new window.THREE.BoxGeometry(0.05, 0.07, 0.01);
      const point = new window.THREE.Mesh(pointGeom, shirtMat);
      point.position.set(side * 0.07, 1.39, 0.11);
      point.rotation.y = side * -0.25;
      point.rotation.x = -0.2;
      this.modelGroup.add(point);
    }

    // === JACKET TORSO (main body) ===
    const torsoGeom = new window.THREE.BoxGeometry(0.7, 0.95, 0.35);
    // Shape the torso for tailored fit
    const pos = torsoGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Waist suppression (narrower in middle)
      const normalizedY = (y + 0.475) / 0.95; // 0 to 1
      const waistFactor = 1 - Math.sin(normalizedY * Math.PI) * 0.12;
      pos.setX(i, x * waistFactor);

      // Chest expansion (wider at top)
      if (y > 0.1) {
        const expansion = 1 + (y - 0.1) * 0.25;
        pos.setX(i, pos.getX(i) * expansion);
      }
    }
    torsoGeom.computeVertexNormals();

    const torso = new window.THREE.Mesh(torsoGeom, fabricMat);
    torso.position.set(0, 0.88, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.modelGroup.add(torso);

    // === SHOULDERS ===
    for (const side of [-1, 1]) {
      const shoulderGeom = new window.THREE.BoxGeometry(0.25, 0.15, 0.35);
      const shoulder = new window.THREE.Mesh(shoulderGeom, fabricMat);
      shoulder.position.set(side * 0.425, 1.32, 0);
      shoulder.rotation.z = side * 0.15;
      shoulder.castShadow = true;
      this.modelGroup.add(shoulder);
    }

    // === SLEEVES (connected to shoulders) ===
    for (const side of [-1, 1]) {
      // Upper sleeve
      const upperSleeveGeom = new window.THREE.CylinderGeometry(0.13, 0.12, 0.5, 16);
      const upperSleeve = new window.THREE.Mesh(upperSleeveGeom, fabricMat);
      upperSleeve.position.set(side * 0.5, 1.0, 0);
      upperSleeve.rotation.z = side * 0.08;
      upperSleeve.castShadow = true;
      this.modelGroup.add(upperSleeve);

      // Lower sleeve (forearm)
      const lowerSleeveGeom = new window.THREE.CylinderGeometry(0.12, 0.095, 0.5, 16);
      const lowerSleeve = new window.THREE.Mesh(lowerSleeveGeom, fabricMat);
      lowerSleeve.position.set(side * 0.52, 0.52, 0);
      lowerSleeve.rotation.z = side * 0.06;
      lowerSleeve.castShadow = true;
      this.modelGroup.add(lowerSleeve);

      // Cuff
      const cuffGeom = new window.THREE.CylinderGeometry(0.1, 0.095, 0.06, 16);
      const cuff = new window.THREE.Mesh(cuffGeom, fabricMat);
      cuff.position.set(side * 0.53, 0.24, 0);
      cuff.castShadow = true;
      this.modelGroup.add(cuff);

      // HAND (visible below cuff)
      const handGeom = new window.THREE.SphereGeometry(0.065, 12, 8);
      handGeom.scale(0.9, 1.2, 0.7);
      const hand = new window.THREE.Mesh(handGeom, skinMat);
      hand.position.set(side * 0.54, 0.12, 0);
      hand.castShadow = true;
      this.modelGroup.add(hand);
    }

    // === FRONT OPENING (V-shaped panels) ===
    for (const side of [-1, 1]) {
      const panelGeom = new window.THREE.BoxGeometry(0.15, 0.85, 0.04);
      const panel = new window.THREE.Mesh(panelGeom, fabricMat);
      panel.position.set(side * 0.27, 0.9, 0.16);
      panel.rotation.y = side * -0.08;
      panel.castShadow = true;
      this.modelGroup.add(panel);
    }

    // === LAPELS ===
    this.createLapels(fabricMat);

    // === BACK COLLAR ===
    const backCollarGeom = new window.THREE.BoxGeometry(0.3, 0.08, 0.1);
    const backCollar = new window.THREE.Mesh(backCollarGeom, fabricMat);
    backCollar.position.set(0, 1.38, -0.14);
    backCollar.rotation.x = 0.35;
    backCollar.castShadow = true;
    this.modelGroup.add(backCollar);

    // === BUTTONS ===
    const buttonMat = new window.THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.4,
      metalness: 0.1
    });

    for (let i = 0; i < 2; i++) {
      const btnGeom = new window.THREE.CylinderGeometry(0.025, 0.025, 0.01, 16);
      const btn = new window.THREE.Mesh(btnGeom, buttonMat);
      btn.position.set(0.15, 1.0 - i * 0.2, 0.19);
      btn.rotation.x = Math.PI / 2;
      btn.castShadow = true;
      this.modelGroup.add(btn);
    }

    // === POCKETS ===
    const pocketMat = new window.THREE.MeshStandardMaterial({
      color: 0x243442,
      roughness: 0.8
    });

    // Breast pocket
    const breastPocketGeom = new window.THREE.BoxGeometry(0.09, 0.006, 0.012);
    const breastPocket = new window.THREE.Mesh(breastPocketGeom, pocketMat);
    breastPocket.position.set(-0.2, 1.08, 0.185);
    breastPocket.rotation.z = 0.08;
    this.modelGroup.add(breastPocket);

    // Hip pockets
    for (const side of [-1, 1]) {
      const hipPocketGeom = new window.THREE.BoxGeometry(0.12, 0.006, 0.012);
      const hipPocket = new window.THREE.Mesh(hipPocketGeom, pocketMat);
      hipPocket.position.set(side * 0.2, 0.6, 0.185);
      this.modelGroup.add(hipPocket);
    }

    this.scene.add(this.modelGroup);
    this.modelGroup.position.y = 0;
  }

  createLapels(material) {
    // Simple lapels using flat geometry
    const lapelShape = new window.THREE.Shape();
    lapelShape.moveTo(0, 0);
    lapelShape.lineTo(0.15, 0);
    lapelShape.lineTo(0.18, 0.06); // Peak
    lapelShape.lineTo(0.12, 0.3);
    lapelShape.lineTo(0.06, 0.45);
    lapelShape.lineTo(0, 0.42);
    lapelShape.lineTo(0, 0);

    const extrudeSettings = {
      depth: 0.025,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2
    };

    // Left lapel
    const leftLapelGeom = new window.THREE.ExtrudeGeometry(lapelShape, extrudeSettings);
    const leftLapel = new window.THREE.Mesh(leftLapelGeom, material);
    leftLapel.position.set(0.1, 1.02, 0.18);
    leftLapel.rotation.x = -0.12;
    leftLapel.rotation.z = -0.18;
    leftLapel.castShadow = true;
    this.modelGroup.add(leftLapel);
    this.leftLapel = leftLapel;

    // Right lapel (mirrored)
    const rightLapelGeom = new window.THREE.ExtrudeGeometry(lapelShape, extrudeSettings);
    const rightLapel = new window.THREE.Mesh(rightLapelGeom, material);
    rightLapel.position.set(-0.1, 1.02, 0.18);
    rightLapel.rotation.x = -0.12;
    rightLapel.rotation.z = 0.18;
    rightLapel.scale.x = -1;
    rightLapel.castShadow = true;
    this.modelGroup.add(rightLapel);
    this.rightLapel = rightLapel;
  }

  setupControls() {
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.rotationY = 0;
    this.rotationX = 0;

    // Define camera presets for different viewing angles
    this.cameraPresets = {
      front: { rotation: { x: 0, y: 0 }, distance: 5 },
      back: { rotation: { x: 0, y: Math.PI }, distance: 5.5 }
    };
    this.presetDistance = this.cameraPresets.front.distance;

    const onStart = (x, y) => {
      this.cancelCameraTransition();
      this.isDragging = true;
      this.previousMousePosition = { x, y };
    };

    const onMove = (x, y) => {
      if (!this.isDragging) return;

      const deltaX = x - this.previousMousePosition.x;
      const deltaY = y - this.previousMousePosition.y;

      this.rotationY += deltaX * 0.008;
      this.rotationX = Math.max(-0.4, Math.min(0.4, this.rotationX + deltaY * 0.005));

      this.modelGroup.rotation.y = this.rotationY;
      this.modelGroup.rotation.x = this.rotationX;

      this.previousMousePosition = { x, y };
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    // Mouse events
    this.renderer.domElement.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    this.renderer.domElement.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    this.renderer.domElement.addEventListener('mouseup', onEnd);
    this.renderer.domElement.addEventListener('mouseleave', onEnd);

    // Touch events
    this.renderer.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    this.renderer.domElement.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    this.renderer.domElement.addEventListener('touchend', onEnd);

    // Mouse wheel zoom
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.15 : -0.15;
      this.setCameraDistance(this.camera.position.z + delta);
    }, { passive: false });
  }

  updateLapelStyle(lapelIndex) {
    if (!this.leftLapel || !this.rightLapel) return;

    const lapelConfigs = {
      0: { scaleY: 0.9, scaleX: 0.9 },   // Classic notch
      1: { scaleY: 0.95, scaleX: 1.0 },  // Wide notch
      2: { scaleY: 1.0, scaleX: 0.95 },  // Peak
      3: { scaleY: 1.05, scaleX: 1.1 },  // Wide peak
      4: { scaleY: 1.1, scaleX: 0.85 },  // Shawl
    };

    const config = lapelConfigs[lapelIndex] || lapelConfigs[0];
    this.leftLapel.scale.set(config.scaleX, config.scaleY, 1);
    this.rightLapel.scale.set(-config.scaleX, config.scaleY, 1);
  }

  updateFabricColor(hexColor) {
    if (this.fabricMaterial) {
      const color = parseInt(hexColor.replace('#', ''), 16);
      this.fabricMaterial.color.setHex(color);
    }
  }

  updateFabricTexture(fabricIndex) {
    // Only update if fabric changed and clothTile function is available
    if (!window.clothTile || this.currentFabricIndex === fabricIndex) return;

    try {
      // Get procedurally generated fabric tile from existing system
      const {tile} = window.clothTile(fabricIndex);

      // Create THREE.js texture from canvas
      const texture = new window.THREE.CanvasTexture(tile);
      texture.wrapS = window.THREE.RepeatWrapping;
      texture.wrapT = window.THREE.RepeatWrapping;
      texture.repeat.set(4, 4); // Repeat texture across garment
      texture.needsUpdate = true;

      // Apply texture to fabric material
      if (this.fabricMaterial) {
        // Dispose old texture to free memory
        if (this.fabricMaterial.map) {
          this.fabricMaterial.map.dispose();
        }

        this.fabricMaterial.map = texture;
        this.fabricMaterial.needsUpdate = true;
        this.currentFabricIndex = fabricIndex;

        // Get fabric color for proper tinting
        if (window.fabrics && window.fabrics[fabricIndex]) {
          const fabric = window.fabrics[fabricIndex];
          if (fabric.color) {
            const color = parseInt(fabric.color.replace('#', ''), 16);
            this.fabricMaterial.color.setHex(color);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to update fabric texture:', e);
    }
  }

  setCameraDistance(distance) {
    this.camera.position.z = Math.max(3, Math.min(7, distance));
    this.camera.lookAt(0, 1, 0);
    this.onZoomChange?.(this.camera.position.z < this.presetDistance);
  }

  toggleZoom() {
    const zoomed = this.camera.position.z < this.presetDistance;
    this.setCameraDistance(this.presetDistance * (zoomed ? 1 : 0.7));
  }

  cancelCameraTransition() {
    if (this.cameraFrame !== undefined) {
      cancelAnimationFrame(this.cameraFrame);
      this.cameraFrame = undefined;
    }
  }

  setCameraPreset(presetName) {
    const preset = this.cameraPresets[presetName];
    if (!preset) return;

    this.cancelCameraTransition();
    this.isDragging = false;
    this.presetDistance = preset.distance;
    this.setCameraDistance(preset.distance);

    const duration = 350;
    const startRotY = this.rotationY;
    const startRotX = this.rotationX;
    const yaw = preset.rotation.y - startRotY;
    const turn = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    if (startRotY === preset.rotation.y && startRotX === 0) return;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-in-out)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Interpolate rotation
      this.rotationY = progress === 1 ? preset.rotation.y : startRotY + turn * eased;
      this.rotationX = startRotX + (preset.rotation.x - startRotX) * eased;
      this.modelGroup.rotation.y = this.rotationY;
      this.modelGroup.rotation.x = this.rotationX;

      this.cameraFrame = progress < 1 ? requestAnimationFrame(animate) : undefined;
    };

    animate();
  }

  animate() {
    this.animationFrame = requestAnimationFrame(() => this.animate());
    if (this.container.clientWidth) this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const {clientWidth: width, clientHeight: height} = this.container;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.cancelCameraTransition();
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// Export for integration
if (typeof window !== 'undefined') {
  window.ThreeSuitRenderer = ThreeSuitRenderer;
}
