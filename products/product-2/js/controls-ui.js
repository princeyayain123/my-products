const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const UIController = {
  selectors: {
    toggleButton: "#toggle-icon",
    iconList: "#icon-list",
    iconX: "#icon-x",
    uiButtons: ".ui button",
    materialsBar: ".selectedMaterials",
    agreeButton: ".agreementButton",
    agreementContainer: ".agreementContainer",
    blackOut: ".blackOut",
    blackOutX: ".blackOutX",
    configurationMaterial: ".configurationMaterial",
    downloadBtn: "#saveAsIcon",
    sections: {
      colors: "#coloring",
      texture: "#quiltings",
      Materials: "#materials",
    },
    colorWrappers: ".color-option-wrapper",
    clearSignature: "#clear-signature",
    steps: ".step",
    progress: "#progress",
    pages: ".page",
    nextButtons: ".next",
    prevButtons: ".prev",
  },

  init() {
    this.cacheElements();
    this.bindEvents();
    this.autoIdColors();
  },

  cacheElements() {
    const s = this.selectors;
    this.elements = {
      button: $(s.toggleButton),
      iconList: $(s.iconList),
      iconX: $(s.iconX),
      buttons: $$(s.uiButtons),
      materialsBar: $(s.materialsBar),
      agreeButton: $(s.agreeButton),
      agreementContainer: $(s.agreementContainer),
      blackOut: $(s.blackOut),
      blackOutX: $(s.blackOutX),
      configurationMaterial: $(s.configurationMaterial),
      downloadBtn: $(s.downloadBtn),
      sections: {
        colors: $(s.sections.colors),
        texture: $(s.sections.texture),
        Materials: $(s.sections.Materials),
      },
      colorWrappers: $$(s.colorWrappers),
      clearSignature: $(s.clearSignature),
      steps: $$(s.steps),
      progress: $(s.progress),
      pages: $$(s.pages),
      nextButtons: $$(s.nextButtons),
      prevButtons: $$(s.prevButtons),
    };
  },

  bindEvents() {
    this.elements.buttons.forEach((btn) => btn.addEventListener("click", () => this.toggleSection(btn)));

    this.elements.agreeButton.addEventListener("click", () => this.showAgreement());
    this.elements.blackOutX.addEventListener("click", () => this.hideAgreement());
    this.elements.button.addEventListener("click", () => this.toggleSidebar());
    this.elements.nextButtons.forEach((button) => button.addEventListener("click", () => this.nextStep()));
    this.elements.prevButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.backStep();
      });
    });

    document.querySelector(".accordion-header").addEventListener("click", function (e) {
      const body = document.getElementById("accordionBody");
      body.classList.toggle("open");

      const caret = this.querySelector("i");
      caret.classList.toggle("rotated");

      if (e && e.stopPropagation) e.stopPropagation();
    });
  },

  toggleSection(btn) {
    this.elements.buttons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    Object.values(this.elements.sections).forEach((section) => section.classList.remove("active"));
    const target = this.elements.sections[btn.id];
    target.classList.add("active");

    this.updateMaterialsBar(btn, true);

    window.addEventListener("resize", () => this.updateMaterialsBar(btn, false));
    window.addEventListener("orientationchange", () => this.updateMaterialsBar(btn, false));
  },

  updateMaterialsBar(btn, withTransition = true) {
    const bar = this.elements.materialsBar;
    const target = this.elements.sections[btn.id];
    const isPortraitMobile = window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches;

    if (!withTransition) {
      const prev = bar.style.transition;
      bar.style.transition = "none";

      if (isPortraitMobile) {
        bar.style.right = "0";
        bar.style.bottom = btn.id === "colors" ? "260px" : "160px";
      } else {
        bar.style.right = target.classList.contains("coloring") ? "390px" : "300px";
        bar.style.bottom = "";
      }
      
      bar.offsetHeight;
      bar.style.transition = prev || "all 0.5s ease";
    } else {
      if (isPortraitMobile) {
        bar.style.right = "0";
        bar.style.bottom = btn.id === "colors" ? "260px" : "160px";
      } else {
        bar.style.right = target.classList.contains("coloring") ? "390px" : "300px";
        bar.style.bottom = "";
      }
    }
  },
  autoIdColors() {
    this.elements.colorWrappers.forEach((wrapper, index) => {
      if (!wrapper.id) wrapper.id = `color${index + 1}`;
    });
  },

  showAgreement() {
    this.elements.agreementContainer.style.display = "block";
    this.elements.blackOut.style.display = "block";
    this.elements.blackOutX.style.display = "flex";
    setTimeout(() => {
      this.elements.agreementContainer.style.top = "50%";
      this.elements.agreementContainer.style.opacity = "1";
      this.elements.blackOut.style.opacity = "1";
    }, 0);

    const mappings = [
      [".Main_Color\\.002", ".main-color"],
      [".quilting_a\\.001", ".secondary-color"],
      [".Arm_Side\\.002", ".arm-color"],
      [".Accent_Color\\.002", ".piping-color"],
      [".Headrest\\.002", ".head-color"],
      [".stitches\\.002", ".stitch-color"],
      [".quiltingColorMaterial", ".quilt-color"],
      [".hardwareColor", ".hardware-color"],

      [".perimeter_piping", ".perimeter-piping"],
      [".insert_piping", ".insert-piping"],
      [".stitchesStyleMaterial", ".stitch-style"],
      [".quiltingStyleMaterial", ".quilt-style"],
    ];

    mappings.forEach(([from, to]) => {
      $(to).innerHTML = $(from).textContent;
    });
  },

  hideAgreement() {
    this.currentStep = 1;
    this.updateSteps();
    this.updatePages();
    this.scrollToTop();
    this.elements.agreementContainer.style.top = "45%";
    this.elements.agreementContainer.style.opacity = "0";
    this.elements.blackOut.style.opacity = "0";
    this.elements.blackOutX.style.display = "none";
    setTimeout(() => {
      this.elements.agreementContainer.style.display = "none";
      this.elements.blackOut.style.display = "none";
    }, 300);
  },

  toggleSidebar() {
    this.elements.iconList.classList.toggle("hidden");
    this.elements.iconX.classList.toggle("hidden");
    this.elements.configurationMaterial.classList.toggle("d-none");
  },

  currentStep: 1,

  nextStep() {
    if (this.currentStep < this.elements.steps.length) {
      this.currentStep++;
      this.updateSteps();
      this.updatePages();
      this.scrollToTop();
    }
  },

  backStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateSteps();
      this.updatePages();
      this.scrollToTop();
    }
  },

  scrollToTop() {
    const container = document.querySelector(".agreementContainer");
    container.scrollTo({ top: 0, behavior: "smooth" });
  },

  updateSteps() {
    this.elements.steps.forEach((step, index) => {
      step.classList.toggle("active", index < this.currentStep);
    });
    this.elements.progress.style.width = `${((this.currentStep - 1) / (this.elements.steps.length - 1)) * 100}%`;
  },

  updatePages() {
    this.elements.pages.forEach((page, index) => {
      page.classList.remove("active");
      if (index === this.currentStep - 1) {
        page.classList.add("active");
      }
    });
  },
};

// Initialize the object
UIController.init();
