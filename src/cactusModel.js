import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// =========================================================================
// 🌵 CACTUS CONFIGURATION
// Change the initial rotation below! (Values in DEGREES: 0, 90, 180, 270)
// =========================================================================
export const CACTUS_CONFIG = {
  // Change initial Y rotation here! (e.g. 0 = front, 90 = front for glTF, 180 = back)
  initialRotationDegrees: 90,

  // Model scale factor for GLB files
  modelScale: 4.2,
};

export class CactusCharacter {
  constructor(scene) {
    this.scene = scene;

    // Hierarchy Nodes
    this.rootGroup = new THREE.Group();
    this.cactusBodyGroup = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.potGroup = new THREE.Group();
    this.leftArmGroup = new THREE.Group();
    this.rightArmGroup = new THREE.Group();
    this.flowerGroup = new THREE.Group();
    this.eyesGroup = new THREE.Group();
    this.mouthGroup = new THREE.Group();
    this.accentsGroup = new THREE.Group();

    // Convert initial rotation degrees to radians
    this.initialRotationY = (CACTUS_CONFIG.initialRotationDegrees * Math.PI) / 180;

    // GLTF Model State
    this.isGltfLoaded = false;
    this.gltfModel = null;
    this.mixer = null;
    this.gltfAnimations = [];
    this.gltfRotationY = this.initialRotationY;

    // Eye Pupils & Eyelids reference
    this.leftPupil = null;
    this.rightPupil = null;
    this.leftEyelidTop = null;
    this.rightEyelidTop = null;

    // Mouth animation reference
    this.teethMesh = null;

    // Target animation transforms (for smooth lerping)
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetRotation = new THREE.Euler(0, 0, 0);
    this.targetScale = new THREE.Vector3(1, 1, 1);

    // Interactive user rotation offset
    this.userRotationY = 0;

    // Dynamic state variables
    this.blinkFactor = 0;
    this.mouthOpenFactor = 0;
    this.eyeScale = 1;
    this.pupilTargetOffset = { x: 0, y: 0 };
    this.pupilCurrentOffset = { x: 0, y: 0 };

    this.initMaterials();

    // 1. Build Procedural Character as Default / Fallback matching reference image
    this.buildCharacter();
    this.scene.add(this.rootGroup);

    // 2. Attempt to Load Custom GLB Model from /cactus.glb
    this.loadGLTFModel('/cactus.glb');
  }

  initMaterials() {
    // Soft Cartoon Green Cactus
    this.cactusMaterial = new THREE.MeshStandardMaterial({
      color: 0x8cc63f, // Bright cartoon green matching reference image
      roughness: 0.4,
      metalness: 0.05,
    });

    // Black & White Striped Pot Material
    const stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 128;
    stripeCanvas.height = 128;
    const sCtx = stripeCanvas.getContext('2d');
    sCtx.fillStyle = '#fffdf5';
    sCtx.fillRect(0, 0, 128, 128);
    sCtx.fillStyle = '#181818';
    sCtx.fillRect(0, 0, 128, 32);
    sCtx.fillRect(0, 64, 128, 32);

    const stripeTex = new THREE.CanvasTexture(stripeCanvas);
    stripeTex.wrapS = THREE.RepeatWrapping;
    stripeTex.wrapT = THREE.RepeatWrapping;
    stripeTex.repeat.set(1, 4);

    this.potMaterial = new THREE.MeshStandardMaterial({
      map: stripeTex,
      roughness: 0.5,
    });

    // Soil
    this.soilMaterial = new THREE.MeshStandardMaterial({
      color: 0x241a15,
      roughness: 0.9,
    });

    // Eyes & Pupils
    this.eyeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
    });

    this.pupilMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.15,
    });

    // Hot Red Lips
    this.lipMaterial = new THREE.MeshStandardMaterial({
      color: 0xf03657,
      roughness: 0.25,
    });

    // Teeth & Silver Braces
    this.teethMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8f8f8,
      roughness: 0.2,
    });

    this.bracesMaterial = new THREE.MeshStandardMaterial({
      color: 0xd0d0d0,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Pink Flower
    this.petalMaterial = new THREE.MeshStandardMaterial({
      color: 0xff66a7,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });

    this.flowerCenterMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd347,
      roughness: 0.3,
    });

    // Spines / Yellow Stars
    this.spineMaterial = new THREE.MeshStandardMaterial({
      color: 0xffea63,
      roughness: 0.4,
    });

    // Motion Accents
    this.accentMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
  }

  buildCharacter() {
    this.rootGroup.add(this.potGroup);
    this.rootGroup.add(this.cactusBodyGroup);

    this.buildPot();
    this.buildCactusBody();
    this.buildEyes();
    this.buildMouth();
    this.buildFlower();
    this.buildDualArms();
    this.buildSpines();
    this.buildMotionAccents();
  }

  loadGLTFModel(url) {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        console.log('Successfully loaded custom GLB model:', url);
        this.isGltfLoaded = true;
        this.gltfModel = gltf.scene;

        // Hide procedural model meshes
        this.potGroup.visible = false;
        this.cactusBodyGroup.visible = false;

        // Adjust shadow casting & materials on GLTF model
        this.gltfModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Rotate GLTF model 180 degrees so it faces forward directly!
        this.gltfModel.rotation.y = this.gltfRotationY;

        // Compute Bounding Box to auto-center & scale GLB onto table
        const box = new THREE.Box3().setFromObject(this.gltfModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 4.2 / maxDim;

        this.gltfModel.scale.setScalar(scaleFactor);
        this.gltfModel.position.set(
          -center.x * scaleFactor,
          -box.min.y * scaleFactor + 0.05,
          -center.z * scaleFactor
        );

        // GLTF Animations
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.gltfModel);
          this.gltfAnimations = gltf.animations;
          const action = this.mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        this.rootGroup.add(this.gltfModel);
      },
      (xhr) => { },
      (error) => {
        console.info('Using built-in cartoon 3D cactus model.');
      }
    );
  }

  rotateModel90() {
    if (this.isGltfLoaded && this.gltfModel) {
      this.gltfRotationY += Math.PI * 0.5;
      this.gltfModel.rotation.y = this.gltfRotationY;
    } else {
      this.userRotationY += Math.PI * 0.5;
    }
  }

  buildPot() {
    const potGeo = new THREE.CylinderGeometry(1.2, 0.92, 1.4, 32);
    const potMesh = new THREE.Mesh(potGeo, this.potMaterial);
    potMesh.position.y = 0.7;
    potMesh.castShadow = true;
    potMesh.receiveShadow = true;
    this.potGroup.add(potMesh);

    const rimGeo = new THREE.CylinderGeometry(1.28, 1.25, 0.25, 32);
    const rimMesh = new THREE.Mesh(rimGeo, this.potMaterial);
    rimMesh.position.y = 1.35;
    rimMesh.castShadow = true;
    this.potGroup.add(rimMesh);

    const soilGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.1, 32);
    const soilMesh = new THREE.Mesh(soilGeo, this.soilMaterial);
    soilMesh.position.y = 1.35;
    this.potGroup.add(soilMesh);
  }

  buildCactusBody() {
    const radialSegments = 12;
    const heightSegments = 32;
    const bodyRadius = 0.95;
    const bodyHeight = 2.85;

    const bodyGeo = new THREE.CylinderGeometry(
      bodyRadius,
      bodyRadius * 0.95,
      bodyHeight,
      radialSegments,
      heightSegments
    );

    const pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const angle = Math.atan2(z, x);
      const ribFactor = 1 + Math.cos(angle * radialSegments) * 0.06;

      const normY = (y + bodyHeight / 2) / bodyHeight;
      let capFactor = 1;
      if (normY > 0.75) {
        const topRatio = (normY - 0.75) / 0.25;
        capFactor = Math.sqrt(Math.max(0, 1 - topRatio * topRatio));
      }

      pos.setX(i, x * ribFactor * capFactor);
      pos.setZ(i, z * ribFactor * capFactor);
    }
    bodyGeo.computeVertexNormals();

    const bodyMesh = new THREE.Mesh(bodyGeo, this.cactusMaterial);
    bodyMesh.position.y = 1.4 + bodyHeight / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.cactusBodyGroup.add(bodyMesh);

    this.headGroup.position.set(0, 2.2, 0);
    this.cactusBodyGroup.add(this.headGroup);
  }

  buildEyes() {
    this.headGroup.add(this.eyesGroup);
    this.eyesGroup.position.set(0, 0.45, 0.88);

    const eyeRadius = 0.22;
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 32, 16);

    // Left Eye
    const leftEyeContainer = new THREE.Group();
    leftEyeContainer.position.set(-0.28, 0, 0);

    const leftEyeMesh = new THREE.Mesh(eyeGeo, this.eyeWhiteMaterial);
    leftEyeMesh.castShadow = true;
    leftEyeContainer.add(leftEyeMesh);

    const pupilGeo = new THREE.SphereGeometry(0.105, 24, 12);
    this.leftPupil = new THREE.Mesh(pupilGeo, this.pupilMaterial);
    this.leftPupil.position.set(0, 0, 0.16);

    const shineGeo = new THREE.SphereGeometry(0.038, 12, 12);
    const shineMesh = new THREE.Mesh(shineGeo, this.eyeWhiteMaterial);
    shineMesh.position.set(0.04, 0.04, 0.09);
    this.leftPupil.add(shineMesh);

    leftEyeContainer.add(this.leftPupil);

    const eyelidGeo = new THREE.SphereGeometry(eyeRadius + 0.01, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.leftEyelidTop = new THREE.Mesh(eyelidGeo, this.cactusMaterial);
    this.leftEyelidTop.rotation.x = -Math.PI / 2;
    leftEyeContainer.add(this.leftEyelidTop);

    this.eyesGroup.add(leftEyeContainer);

    // Right Eye
    const rightEyeContainer = new THREE.Group();
    rightEyeContainer.position.set(0.28, 0, 0);

    const rightEyeMesh = new THREE.Mesh(eyeGeo, this.eyeWhiteMaterial);
    rightEyeMesh.castShadow = true;
    rightEyeContainer.add(rightEyeMesh);

    this.rightPupil = new THREE.Mesh(pupilGeo, this.pupilMaterial);
    this.rightPupil.position.set(0, 0, 0.16);

    const rightShine = new THREE.Mesh(shineGeo, this.eyeWhiteMaterial);
    rightShine.position.set(0.04, 0.04, 0.09);
    this.rightPupil.add(rightShine);

    rightEyeContainer.add(this.rightPupil);

    this.rightEyelidTop = new THREE.Mesh(eyelidGeo, this.cactusMaterial);
    this.rightEyelidTop.rotation.x = -Math.PI / 2;
    rightEyeContainer.add(this.rightEyelidTop);

    this.eyesGroup.add(rightEyeContainer);
  }

  buildMouth() {
    this.headGroup.add(this.mouthGroup);
    this.mouthGroup.position.set(0, 0.02, 0.9);

    const lipGeo = new THREE.TorusGeometry(0.35, 0.09, 16, 32);
    const lipMesh = new THREE.Mesh(lipGeo, this.lipMaterial);
    lipMesh.scale.set(1.1, 0.65, 1);
    lipMesh.castShadow = true;
    this.mouthGroup.add(lipMesh);

    const cavityGeo = new THREE.PlaneGeometry(0.65, 0.35);
    const cavityMat = new THREE.MeshBasicMaterial({ color: 0x4a0a14 });
    const cavityMesh = new THREE.Mesh(cavityGeo, cavityMat);
    cavityMesh.position.z = -0.04;
    this.mouthGroup.add(cavityMesh);

    const teethGeo = new THREE.BoxGeometry(0.58, 0.18, 0.05);
    this.teethMesh = new THREE.Mesh(teethGeo, this.teethMaterial);
    this.teethMesh.position.set(0, 0, -0.01);
    this.mouthGroup.add(this.teethMesh);

    const wireGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.58, 12);
    const wireMesh = new THREE.Mesh(wireGeo, this.bracesMaterial);
    wireMesh.rotation.z = Math.PI / 2;
    wireMesh.position.set(0, 0, 0.03);
    this.mouthGroup.add(wireMesh);

    for (let i = -2; i <= 2; i++) {
      const bracketGeo = new THREE.BoxGeometry(0.04, 0.04, 0.03);
      const bracketMesh = new THREE.Mesh(bracketGeo, this.bracesMaterial);
      bracketMesh.position.set(i * 0.11, 0, 0.035);
      this.mouthGroup.add(bracketMesh);
    }
  }

  buildFlower() {
    this.headGroup.add(this.flowerGroup);
    this.flowerGroup.position.set(-0.65, 0.95, 0.3); // Top left flower matching user's uploaded image!
    this.flowerGroup.rotation.z = 0.3;

    const petalCount = 8;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const petalGeo = new THREE.SphereGeometry(0.22, 16, 16);
      petalGeo.scale(1, 0.4, 0.3);
      const petal = new THREE.Mesh(petalGeo, this.petalMaterial);
      petal.position.set(Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, 0);
      petal.rotation.z = angle;
      petal.castShadow = true;
      this.flowerGroup.add(petal);
    }

    const centerGeo = new THREE.SphereGeometry(0.18, 24, 16);
    centerGeo.scale(1, 1, 0.4);
    const centerMesh = new THREE.Mesh(centerGeo, this.flowerCenterMaterial);
    centerMesh.position.z = 0.08;
    this.flowerGroup.add(centerMesh);
  }

  buildDualArms() {
    // Left Arm (Outward curve to the left matching image!)
    this.cactusBodyGroup.add(this.leftArmGroup);
    this.leftArmGroup.position.set(-0.85, 2.2, 0.1);

    const leftArmGeo = new THREE.CylinderGeometry(0.28, 0.22, 1.3, 16);
    const leftArmMesh = new THREE.Mesh(leftArmGeo, this.cactusMaterial);
    leftArmMesh.rotation.z = 0.85;
    leftArmMesh.position.set(-0.35, 0.1, 0);
    leftArmMesh.castShadow = true;
    this.leftArmGroup.add(leftArmMesh);

    // Right Arm (Outward & Upward curve to the right matching image!)
    this.cactusBodyGroup.add(this.rightArmGroup);
    this.rightArmGroup.position.set(0.85, 2.2, 0.1);

    const rightArmGeo = new THREE.CylinderGeometry(0.28, 0.22, 1.4, 16);
    const rightArmMesh = new THREE.Mesh(rightArmGeo, this.cactusMaterial);
    rightArmMesh.rotation.z = -0.75;
    rightArmMesh.position.set(0.4, 0.2, 0);
    rightArmMesh.castShadow = true;
    this.rightArmGroup.add(rightArmMesh);
  }

  buildSpines() {
    const spineCount = 35;
    const bodyHeight = 2.6;
    const bodyRadius = 0.95;

    for (let i = 0; i < spineCount; i++) {
      const angle = (Math.floor(Math.random() * 12) / 12) * Math.PI * 2;
      const y = (Math.random() - 0.5) * bodyHeight * 0.85 + 2.5;

      const spineCluster = new THREE.Group();
      spineCluster.position.set(
        Math.cos(angle) * bodyRadius * 0.98,
        y,
        Math.sin(angle) * bodyRadius * 0.98
      );
      spineCluster.rotation.y = -angle + Math.PI / 2;

      // Small yellow star spines matching user's image!
      const starGeo = new THREE.SphereGeometry(0.04, 6, 6);
      starGeo.scale(1.2, 1.2, 0.4);
      const starMesh = new THREE.Mesh(starGeo, this.spineMaterial);
      spineCluster.add(starMesh);

      this.cactusBodyGroup.add(spineCluster);
    }
  }

  buildMotionAccents() {
    this.headGroup.add(this.accentsGroup);
    this.accentsGroup.position.set(0.9, 1.2, 0.4);

    for (let i = 0; i < 3; i++) {
      const lineGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8);
      const lineMesh = new THREE.Mesh(lineGeo, this.accentMaterial);
      lineMesh.rotation.z = Math.PI / 4 + (i - 1) * 0.3;
      lineMesh.position.set((i - 1) * 0.15, (1 - Math.abs(i - 1)) * 0.08, 0);
      this.accentsGroup.add(lineMesh);
    }
  }

  setBlink(factor) {
    this.blinkFactor = THREE.MathUtils.clamp(factor, 0, 1);
    const rotX = THREE.MathUtils.lerp(-Math.PI / 2, 0, this.blinkFactor);
    if (this.leftEyelidTop) this.leftEyelidTop.rotation.x = rotX;
    if (this.rightEyelidTop) this.rightEyelidTop.rotation.x = rotX;
  }

  setMouthOpen(factor) {
    this.mouthOpenFactor = THREE.MathUtils.clamp(factor, 0, 1);
    const scaleY = THREE.MathUtils.lerp(0.65, 1.8, this.mouthOpenFactor);
    this.mouthGroup.scale.set(1.1, scaleY, 1);
    if (this.teethMesh) {
      this.teethMesh.position.y = THREE.MathUtils.lerp(0, -0.06, this.mouthOpenFactor);
    }
  }

  setPupilOffset(targetX, targetY) {
    this.pupilTargetOffset.x = targetX;
    this.pupilTargetOffset.y = targetY;
  }

  setEyeScale(scale) {
    this.eyeScale = scale;
    this.eyesGroup.scale.setScalar(scale);
  }

  update(delta, elapsed) {
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Lerp pupils
    this.pupilCurrentOffset.x += (this.pupilTargetOffset.x - this.pupilCurrentOffset.x) * 0.15;
    this.pupilCurrentOffset.y += (this.pupilTargetOffset.y - this.pupilCurrentOffset.y) * 0.15;

    if (this.leftPupil && this.rightPupil) {
      this.leftPupil.position.x = this.pupilCurrentOffset.x;
      this.leftPupil.position.y = this.pupilCurrentOffset.y;
      this.rightPupil.position.x = this.pupilCurrentOffset.x;
      this.rightPupil.position.y = this.pupilCurrentOffset.y;
    }

    if (this.flowerGroup) {
      const wiggle = Math.sin(elapsed * 4) * 0.06;
      this.flowerGroup.rotation.z = 0.3 + wiggle;
    }

    if (this.accentsGroup) {
      this.accentsGroup.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.08);
    }

    // Apply animation state machine target transforms + user rotation offset
    if (!this.isGltfLoaded) {
      this.cactusBodyGroup.position.lerp(this.targetPosition, 0.12);
      this.cactusBodyGroup.rotation.x += (this.targetRotation.x - this.cactusBodyGroup.rotation.x) * 0.12;
      this.cactusBodyGroup.rotation.y += (this.targetRotation.y + this.userRotationY - this.cactusBodyGroup.rotation.y) * 0.12;
      this.cactusBodyGroup.rotation.z += (this.targetRotation.z - this.cactusBodyGroup.rotation.z) * 0.12;
      this.cactusBodyGroup.scale.lerp(this.targetScale, 0.12);
    } else {
      this.rootGroup.position.lerp(this.targetPosition, 0.12);
      this.rootGroup.rotation.x += (this.targetRotation.x - this.rootGroup.rotation.x) * 0.12;
      this.rootGroup.rotation.y += (this.targetRotation.y + this.userRotationY - this.rootGroup.rotation.y) * 0.12;
      this.rootGroup.rotation.z += (this.targetRotation.z - this.rootGroup.rotation.z) * 0.12;
      this.rootGroup.scale.lerp(this.targetScale, 0.12);
    }
  }
}
