import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

let scene, camera, renderer, model, dirLight, controls;
let pointerXOnPointerDown = 0;
let targetRotation = 0;
let targetRotationOnPointerDown = 0;
let pointerX = 0;
let windowHalfX = window.innerWidth / 2;
let isTransitioning = false;
let transitionStartTime = null;
let transitionDuration = 1000;
let targetPosition = new THREE.Vector3();
let textureName = "quilting_a.001";
let materialName = "Main_Color.002";
let currentMaterial = "Main_Color.002";
let currentPrimaryThread = "stitches";
let quiltedStitcheName = "quilting_a_stitches.001";
let lastTouchDistance = null;
const fadeMaterials = new Map();
const container = document.getElementById("container");
const agreeButton = document.querySelector(".agreementButton");
const materialsList = [];
const loader = new THREE.TextureLoader();

init();
loadModel();

function init() {
  container.addEventListener("pointerdown", onPointerDown);

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  // Camera setup
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 100);
  camera.position.set(-3, 2, 6);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  container.appendChild(renderer.domElement);

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 1.5;
  controls.minDistance = 2.5;
  controls.maxDistance = 6;
  controls.enablePan = false;
  controls.update();

  // Lighting setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 3);
  dirLight.position.set(0, 1, 1);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.6);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  agreeButton.addEventListener("click", () => {
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    const imageData = canvas.toDataURL("image/png");
    const imgElement = document.createElement("img");

    imgElement.src = imageData;
    imgElement.alt = "Captured Canvas Image";

    const pictureContainer = document.getElementById("picture");
    pictureContainer.innerHTML = "";
    pictureContainer.appendChild(imgElement);
  });

  $(document).ready(() => {
    onWindowResize(); // Set initial dimensions
    $(window).on("resize", debounce(onWindowResize, 0));
    window.addEventListener("orientationchange", () => {
      onWindowResize(); // Handle orientation change
    });
  });
}

function onWindowResize() {
  const isMobile = window.innerWidth <= 768;
  const isLandscape = window.innerWidth > window.innerHeight && window.innerHeight <= 430;

  let width = 0;
  let height = 0;

  if (isLandscape) {
    width = window.innerWidth * 0.5;
    height = window.innerHeight;
  } else if (isMobile) {
    width = window.innerWidth;
    height = window.innerHeight * 0.75;
  } else {
    width = window.innerWidth * 0.8;
    height = window.innerHeight;
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function onPointerDown(event) {
  if (event.isPrimary === false) return;

  pointerXOnPointerDown = event.clientX - windowHalfX;
  targetRotationOnPointerDown = targetRotation;

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
}

function loadModel() {
  let totalItems = 0;
  let loadedItems = 0;
  let smoothProgress = 0;

  function updateProgress(targetProgress) {
    if (smoothProgress < targetProgress) {
      smoothProgress++;
      $("#loading-progress").css("width", `${smoothProgress}%`);
      $("#loading-text").text(`${smoothProgress}%`);
      requestAnimationFrame(() => updateProgress(targetProgress));
    }
  }

  const loadingManager = new THREE.LoadingManager(
    () => {
      $("#loading-screen").fadeOut(800, () => {
        $("#loading-screen").remove();
      });
    },
    (itemUrl, itemsLoaded, itemsTotal) => {
      totalItems = itemsTotal;
      loadedItems = itemsLoaded;

      const targetProgress = Math.floor((loadedItems / totalItems) * 100);
      updateProgress(targetProgress);
    },
    (url) => {
      console.error(`Error loading: ${url}`);
    }
  );

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  new RGBELoader().setPath("./assets/hdr/").load("studio.hdr", function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    scene.environment = envMap;
    scene.background = new THREE.Color(0xffffff);

    texture.dispose();
    pmremGenerator.dispose();
  });

  const loader = new GLTFLoader(loadingManager);
  loader.load("./assets/model/model.glb", (gltf) => {
    model = gltf.scene;
    model.scale.set(2.5, 2.5, 2.5);
    model.position.y = -1;
    scene.add(model);

    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (!materialsList.includes(object.material)) {
          materialsList.push(object.material);
        }
      }
    });

    createGUI();
    animate();
  });
}

function fadeMaterialToRed(material) {
  if (fadeMaterials.has(material)) return;

  const originalColor = material.color.clone();
  material.color.set(0xff0000);

  fadeMaterials.set(material, {
    material: material,
    originalColor: originalColor,
    startTime: performance.now(),
    duration: 400,
  });
}

function onPointerMove(event) {
  if (event.isPrimary === false) return;

  pointerX = event.clientX - windowHalfX;

  targetRotation = targetRotationOnPointerDown + (pointerX - pointerXOnPointerDown) * 0.02;
}

function onPointerUp() {
  if (event.isPrimary === false) return;

  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerup", onPointerUp);
}

function createGUI() {
  function toggleMeshes(meshToShow, meshesToHide = []) {
    const showMesh = scene.getObjectByName(meshToShow);
    if (showMesh) {
      showMesh.visible = true;
    }

    meshesToHide.forEach((name) => {
      const mesh = scene.getObjectByName(name);
      if (mesh) mesh.visible = false;
    });
  }

  function toggleVisibilty(model, none, have, img, span) {
    const mesh = scene.getObjectByName(model);
    const stitchArmrest = scene.getObjectByName("Stitch_Single_Armrest001");

    if (mesh) {
      mesh.visible = !mesh.visible;

      // update image
      img.src = mesh.visible ? have : none;

      // update span text
      span.textContent = mesh.visible ? "Have" : "None";

      // special case for stitch
      if (mesh.visible && stitchArmrest) {
        currentPrimaryThread = "Accent_Color.002";
        if (model !== "accent_001") stitchArmrest.visible = false;
      }
    }
  }

  function changeQuiltingTextures({ meshName = "quilting_a", baseColorPath, metallicRoughnessPath, normalMapPath, repeatX = 4, repeatY = 4, alpha = 1 }) {
    const quiltingMesh = scene.getObjectByName(meshName);
    if (!quiltingMesh || !quiltingMesh.material) {
      console.warn(`Mesh "${meshName}" not found or missing material`);
      return;
    }

    const material = quiltingMesh.material;

    function applyTexture(path, type) {
      loader.load(path, (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);

        switch (type) {
          case "map":
            material.map = texture;
            material.color.set(0xffffff);
            break;
          case "metallicRoughness":
            material.metalnessMap = texture;
            material.roughnessMap = texture;
            break;
          case "normal":
            material.normalMap = texture;
            break;
          default:
            console.warn(`Unknown texture type: ${type}`);
        }

        material.needsUpdate = true;
      });
    }

    applyTexture(baseColorPath, "map");
    applyTexture(metallicRoughnessPath, "metallicRoughness");
    applyTexture(normalMapPath, "normal");

    material.transparent = true;
    material.alphaTest = alpha;
    material.needsUpdate = true;
  }

  const quiltingStyles = [
    {
      name: "quilting_a",
      label: "Quilting A",
      baseColorPath: "./assets/quilting/quilting_abasecolortexture.png",
      metallicRoughnessPath: "./assets/quilting/quilting_ametallicroughnesstex.jpg",
      normalMapPath: "./assets/quilting/quilting_anormalmap.jpg",
      repeatX: 3,
      repeatY: 3,
      alpha: 0.85,
    },
    {
      name: "quilting_b",
      label: "Quilting B",
      baseColorPath: "./assets/quilting/quilting_bbasecolortexture.png",
      metallicRoughnessPath: "./assets/quilting/quilting_bmetallicroughnesstex.jpg",
      normalMapPath: "./assets/quilting/quilting_bnormalmap.jpg",
      repeatX: 2,
      repeatY: 2,
      alpha: 0.93,
    },
    {
      name: "quilting_c",
      label: "Quilting C",

      baseColorPath: "./assets/quilting/quilting_cbasecolortexture.png",
      metallicRoughnessPath: "./assets/quilting/quilting_cmetallicroughnesstex.jpg",
      normalMapPath: "./assets/quilting/quilting_cnormalmap.jpg",
      repeatX: 3,
      repeatY: 3,
      alpha: 0.83,
    },
    {
      name: "quilting_d",
      label: "Quilting D",
      baseColorPath: "./assets/quilting/quilting_dbasecolortexture.png",
      metallicRoughnessPath: "./assets/quilting/quilting_dmetallicroughnesstex.jpg",
      normalMapPath: "./assets/quilting/quilting_dnormalmap.jpg",
      repeatX: 3,
      repeatY: 3,
      alpha: 0.79,
    },
    {
      name: "quilting_e",
      label: "Quilting E",
      baseColorPath: "./assets/quilting/quilting_ebasecolortexture.png",
      metallicRoughnessPath: "./assets/quilting/quilting_emetallicroughnesstex.jpg",
      normalMapPath: "./assets/quilting/quilting_enormalmap.jpg",
      repeatX: 3,
      repeatY: 3,
      alpha: 0.93,
    },
    {
      name: "quilting_f",
      label: "Quilting F",
      baseColorPath: "./assets/quilting/quilting_fbasecolortexture.png",
      metallicRoughnessPath: "./assets/quilting/quilting_fmetallicroughnesstex.jpg",
      normalMapPath: "./assets/quilting/quilting_fnormalmap.jpg",
      repeatX: 3,
      repeatY: 3,
      alpha: 0.83,
    },
    {
      name: "quilting a s 002",
      label: "None",
      textureName: "quilting_a_stitches.001",
      hide: ["quilting_a"],
    },
  ];

  document.querySelectorAll("#textureHave").forEach((element, index) => {
    element.addEventListener("click", () => {
      const style = quiltingStyles[index];
      const imgElement = element.querySelector("img");

      document.querySelector(".quiltingStyleMaterial").innerHTML = imgElement?.alt || style.label;

      if (style.baseColorPath) {
        changeQuiltingTextures({
          meshName: "quilting_a",
          baseColorPath: style.baseColorPath,
          metallicRoughnessPath: style.metallicRoughnessPath,
          normalMapPath: style.normalMapPath,
          repeatX: style.repeatX,
          repeatY: style.repeatY,
          alpha: style.alpha,
        });

        toggleMeshes("quilting_a");
      } else {
        toggleMeshes(style.name, style.hide || []);
      }

      const selectedMaterial = materialsList.find((mat) => mat.name === style.textureName);
      if (selectedMaterial) {
        currentMaterial = selectedMaterial;

        document.querySelectorAll(".selectedMaterials > div").forEach((c, i) => {
          c.classList.toggle("active", i === 1);
        });
      }
    });
  });

  toggleMeshes("Stitch_Single_Armrest001", ["Stitch_Single_Backrest_Back005", "Stitch_Double_Backrest_Front_010", "Stitch_Double_Backrest_Front_012"]);

  document.querySelectorAll("#stitchesHave").forEach((element, index) => {
    element.addEventListener("click", () => {
      currentPrimaryThread = "stitches";
      const imgElement = element.querySelector("img");
      document.querySelector(".stitchesStyleMaterial").innerHTML = imgElement.alt;
      switch (index) {
        case 0:
          toggleMeshes("Stitch_Single_Armrest001", ["Stitch_Single_Backrest_Back005", "main_002002"]);
          break;
        case 1:
          toggleMeshes("", ["Stitch_Double_Backrest_Front_012", "Stitch_Single_Armrest001"]);
          break;
        default:
          console.warn("Invalid index.");
          return;
      }
    });
  });

  // Perimeter Piping
  const perimeterBlock = document.getElementById("perimeterHave");
  const perimeterImg = perimeterBlock.querySelector("img");
  const perimeterSpan = document.getElementById("perimeter_piping");

  toggleVisibilty("main_002002", "assets/textures/perimeterhave.png", "assets/textures/perimeternone.png", perimeterImg, perimeterSpan);

  perimeterBlock.addEventListener("click", () => {
    toggleVisibilty("main_002002", "assets/textures/perimeterhave.png", "assets/textures/perimeternone.png", perimeterImg, perimeterSpan);
    document.getElementById("stitchesStyleMaterial").innerHTML = "None";
  });

  // Insert Piping
  const insertBlock = document.getElementById("insertHave");
  const insertImg = insertBlock.querySelector("img");
  const insertSpan = document.getElementById("insert_piping");

  insertBlock.addEventListener("click", () => {
    toggleVisibilty("accent_001", "assets/textures/innernone.png", "assets/textures/innerhave.png", insertImg, insertSpan);
  });

  function changeColor(color, colorName) {
    if (["quilting_a.001", "quilting_b.002", "quilting_c", "quilting_d", "quilting_e", "quilting_f", "quilting_a_stitches.001"].includes(materialName)) {
      materialName = "quilting_a.001";
    }

    console.log(materialName);
    document.getElementById(materialName).innerHTML = colorName;
    currentMaterial.color.set(color);
  }

  document.querySelectorAll(".color-option-wrapper").forEach((element) => {
    element.addEventListener("click", () => {
      const color = element.dataset.color;
      const colorName = element.querySelector(".color-title").textContent;
      if (color) {
        changeColor(color, colorName);
      }
    });
  });

  document.querySelectorAll(".stitch-block").forEach((option) => {
    option.addEventListener("click", () => {
      const colorName = option.querySelector(".color-title").textContent;

      const color = option.getAttribute("data-color");
      const selectedMaterial = materialsList.find((mat) => mat.name === currentPrimaryThread);

      if (selectedMaterial) {
        selectedMaterial.color.set(color);
        selectedMaterial.needsUpdate = true;
        if (selectedMaterial.name === "stitches") {
          document.querySelector(".stitches\\.002").innerHTML = colorName;
        } else if (selectedMaterial.name === "Accent_Color.002") {
          document.querySelector(".Accent_Color\\.002").innerHTML = colorName;
        }
      } else {
        console.error(`Material does not support color property.`);
      }
    });
  });

  document.querySelectorAll(".color-block").forEach((option) => {
    option.addEventListener("click", () => {
      const colorName = option.querySelector(".color-title").textContent;

      const color = option.getAttribute("data-color");
      const selectedMaterial = materialsList.find((mat) => mat.name === quiltedStitcheName);

      if (selectedMaterial) {
        document.querySelector(".quiltingColorMaterial").innerHTML = colorName;
        selectedMaterial.color.set(color);
        selectedMaterial.needsUpdate = true;
      } else {
        console.error(`Material does not support color property.`);
      }
    });
  });

  function setupColorPicker({ previewId, overlayId, type }) {
    const preview = document.getElementById(previewId);
    const overlay = document.getElementById(overlayId);

    const inputs = overlay.querySelectorAll("input");
    const nameInput = inputs[0]; // color name
    const codeInput = inputs[1]; // color code

    // Open overlay
    preview.addEventListener("click", () => {
      overlay.style.display = "flex";
    });

    // Close overlay on outside click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.style.display = "none";
    });

    // === Handle input changes ===
    function updateColor() {
      const colorName = nameInput.value.trim();
      const color = codeInput.value.trim();

      // Only accept valid hex
      if (!/^#([0-9A-F]{3}){1,2}$/i.test(color)) return;

      if (type === "main") {
        // MAIN MATERIAL
        document.getElementById(materialName).innerHTML = colorName;
        currentMaterial.color.set(color);
      } else if (type === "stitch") {
        // STITCH MATERIAL
        const selectedMaterial = materialsList.find((mat) => mat.name === currentPrimaryThread);

        if (selectedMaterial) {
          selectedMaterial.color.set(color);
          selectedMaterial.needsUpdate = true;

          if (selectedMaterial.name === "stitches") {
            document.querySelector(".stitches\\.002").innerHTML = colorName;
          } else if (selectedMaterial.name === "Accent_Color.002") {
            document.querySelector(".Accent_Color\\.002").innerHTML = colorName;
          }
        }
      } else if (type === "quilting") {
        // QUILTING MATERIAL
        const selectedMaterial = materialsList.find((mat) => mat.name === quiltedStitcheName);

        if (selectedMaterial) {
          document.querySelector(".quiltingColorMaterial").innerHTML = colorName;
          selectedMaterial.color.set(color);
          selectedMaterial.needsUpdate = true;
        }
      }

      // Preview background too

      preview.querySelector(".color-option-color-name").style.backgroundColor = color;
      preview.querySelector(".color-option-color-name").style.setProperty("--cross-color", color);
      preview.querySelector(".color-title").textContent = colorName;
    }

    // Attach live updates
    nameInput.addEventListener("input", updateColor);
    codeInput.addEventListener("input", updateColor);
  }

  // === Usage ===
  setupColorPicker({
    previewId: "colorPreview",
    overlayId: "colorOverlay",
    type: "main",
  });

  setupColorPicker({
    previewId: "stitchPreview",
    overlayId: "stitchOverlay",
    type: "stitch",
  });

  setupColorPicker({
    previewId: "quiltingPreview",
    overlayId: "quiltingOverlay",
    type: "quilting",
  });

  document.querySelectorAll(".material-block").forEach((option) => {
    option.addEventListener("click", () => {
      const colorName = option.querySelector(".color-title").textContent;
      const color = option.getAttribute("data-color");

      const selectedMaterial = materialsList[0];
      if (selectedMaterial) {
        document.querySelector(".hardwareColor").innerHTML = colorName;

        selectedMaterial.map = null;
        selectedMaterial.metalnessMap = null;
        selectedMaterial.roughnessMap = null;
        selectedMaterial.normalMap = null;

        selectedMaterial.color.set(color);
        selectedMaterial.metalness = 0.5;
        selectedMaterial.roughness = 0;

        selectedMaterial.needsUpdate = true;
      }
    });
  });

  document.querySelector(".stainless-steel").addEventListener("click", () => {
    // Stainless steel texture paths
    const stainlessTextures = {
      map: loader.load("./assets/quilting/Metal012_2K-JPG_Color.jpg"),
      metalRoughMap: loader.load("assets/quilting/Metal012_2K-JPG_Metalness-Metal012_2K-JPG_Roughness.png"),
      normalMap: loader.load("./assets/quilting/Metal012_2K-JPG_NormalGL.jpg"),
    };

    const selectedMaterial = materialsList[0];

    if (selectedMaterial) {
      document.querySelector(".hardwareColor").innerHTML = "Stainless Steel";

      selectedMaterial.map = stainlessTextures.map;

      // Apply the same combined texture to both
      selectedMaterial.metalnessMap = stainlessTextures.metalRoughMap;
      selectedMaterial.roughnessMap = stainlessTextures.metalRoughMap;

      selectedMaterial.normalMap = stainlessTextures.normalMap;

      // Optional neutral color
      selectedMaterial.color.set("#ffffff");

      // These values let the texture maps fully take effect
      selectedMaterial.metalness = 1;
      selectedMaterial.roughness = 1;

      selectedMaterial.needsUpdate = true;
    }
  });

  function createMaterialSelection(materialsList) {
    const circles = document.querySelectorAll(".selectedMaterials > div");

    circles.forEach((circle, circleIndex) => {
      circle.addEventListener("click", () => {
        switch (circleIndex) {
          case 0:
            materialName = "Main_Color.002";
            break;
          case 1:
            materialName = textureName;
            break;
          case 2:
            materialName = "Arm_Side.002";
            break;
          case 3:
            materialName = "Headrest.002";
            break;
          // case 5:
          //   materialName = "stitches";
          //   break;
          default:
            materialName = null;
        }

        if (materialName) {
          const selectedMaterial = materialsList.find((mat) => mat.name === materialName);

          if (selectedMaterial) {
            currentMaterial = selectedMaterial;
            fadeMaterialToRed(selectedMaterial);
            circles.forEach((c) => c.classList.remove("active"));
            circle.classList.add("active");
          }
        }
      });
    });

    const defaultMaterial = materialsList.find((mat) => mat.name === "Main_Color.002");
    if (defaultMaterial && circles[0]) {
      currentMaterial = defaultMaterial;
      circles[0].classList.add("active");
    }
  }

  createMaterialSelection(materialsList);
}

let targetDistance = controls.getDistance ? controls.getDistance() : camera.position.distanceTo(controls.target);
let zoomLerpSpeed = 0.05;

function getCameraDistance() {
  return camera.position.distanceTo(controls.target);
}

renderer.domElement.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 1 : -1;
    targetDistance = THREE.MathUtils.clamp(targetDistance + delta * 0.5, controls.minDistance, controls.maxDistance);
  },
  { passive: false }
);

renderer.domElement.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length === 2) {
      lastTouchDistance = getTouchDistance(event.touches);
    }
  },
  { passive: false }
);

// Add touchmove listener
renderer.domElement.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length === 2) {
      event.preventDefault(); // Prevent browser zoom
      const currentDistance = getTouchDistance(event.touches);

      if (lastTouchDistance) {
        const delta = lastTouchDistance - currentDistance;

        // Convert pinch delta to zoom
        targetDistance = THREE.MathUtils.clamp(
          targetDistance + delta * 0.01, // adjust sensitivity
          controls.minDistance,
          controls.maxDistance
        );
      }

      lastTouchDistance = currentDistance;
    }
  },
  { passive: false }
);

// Add touchend listener
renderer.domElement.addEventListener(
  "touchend",
  () => {
    lastTouchDistance = null;
  },
  { passive: false }
);

// Helper to calculate distance between two touches
function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

let targetQuaternion = new THREE.Quaternion();

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();

  const currentDistance = getCameraDistance();
  if (Math.abs(currentDistance - targetDistance) > 0.01) {
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    const newDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, zoomLerpSpeed);
    camera.position.copy(controls.target).add(direction.multiplyScalar(newDistance));
    camera.updateProjectionMatrix();
  }

  for (const [material, fade] of fadeMaterials) {
    const elapsed = currentTime - fade.startTime;
    if (elapsed < fade.duration) {
      const t = elapsed / fade.duration;
      material.color.lerpColors(new THREE.Color(0xff0000), fade.originalColor, t);
    } else {
      material.color.copy(fade.originalColor);
      fadeMaterials.delete(material);
    }
  }

  if (isTransitioning) {
    const elapsedTime = performance.now() - transitionStartTime;
    const t = Math.min(elapsedTime / transitionDuration, 1);

    camera.position.lerpVectors(camera.position, targetPosition, t);
    camera.quaternion.slerp(targetQuaternion, t);

    if (camera.position.distanceTo(targetPosition) < 0.01 && camera.quaternion.angleTo(targetQuaternion) < 0.001) {
      camera.position.copy(targetPosition);
      camera.quaternion.copy(targetQuaternion);
      isTransitioning = false;
      controls.enabled = true;
    }
  }

  controls.update();

  const lightOffset = new THREE.Vector3(0, 1, 1);
  lightOffset.applyQuaternion(camera.quaternion);
  dirLight.position.copy(camera.position.clone().add(lightOffset));
  dirLight.target.position.copy(camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3())));
  dirLight.target.updateMatrixWorld();

  model.rotation.y += (targetRotation - model.rotation.y) * 0.1;
  renderer.render(scene, camera);
}
