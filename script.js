const flattenDesignTokens = (tokens, path = []) =>
  Object.entries(tokens).reduce((accumulator, [key, value]) => {
    const nextPath = [...path, key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { ...accumulator, ...flattenDesignTokens(value, nextPath) };
    }

    accumulator[`--${nextPath.join("-")}`] = String(value);
    return accumulator;
  }, {});

const applyDesignTokens = async () => {
  try {
    const response = await fetch("./tokens.json", { cache: "no-cache" });
    if (!response.ok) return;

    const tokens = await response.json();
    const properties = flattenDesignTokens(tokens);
    const root = document.documentElement;

    Object.entries(properties).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  } catch {
    // CSS fallbacks in :root keep the site styled if tokens fail to load.
  }
};

const parseHexColor = (value, fallback = "#17092D") => {
  const color = value.trim() || fallback;
  const normalized = color.startsWith("#") ? color.slice(1) : color;
  const hex = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return parseHexColor(fallback, "#17092D");
  }

  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
};

const initSilkBackground = () => {
  const canvas = document.getElementById("silk-canvas");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
  if (!gl) return;

  const vertexShaderSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    varying vec2 vUv;

    uniform float uTime;
    uniform vec3  uColor;
    uniform float uSpeed;
    uniform float uScale;
    uniform float uRotation;
    uniform float uNoiseIntensity;

    const float e = 2.71828182845904523536;

    float noise(vec2 texCoord) {
      float G = e;
      vec2  r = (G * sin(G * texCoord));
      return fract(r.x * r.y * (1.0 + texCoord.x));
    }

    vec2 rotateUvs(vec2 uv, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      mat2  rot = mat2(c, -s, s, c);
      return rot * uv;
    }

    void main() {
      float rnd        = noise(gl_FragCoord.xy);
      vec2  uv         = rotateUvs(vUv * uScale, uRotation);
      vec2  tex        = uv * uScale;
      float tOffset    = uSpeed * uTime;

      tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

      float pattern = 0.5 +
                      0.3 * sin(5.0 * (tex.x + tex.y +
                                       cos(3.0 * tex.x + 5.0 * tex.y) +
                                       0.02 * tOffset) +
                               sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

      vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
      col.a = 1.0;
      gl_FragColor = col;
    }
  `;

  const createShader = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  if (!program) return;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return;
  }

  const positionBuffer = gl.createBuffer();
  const positionLocation = gl.getAttribLocation(program, "aPosition");
  const uniforms = {
    time: gl.getUniformLocation(program, "uTime"),
    color: gl.getUniformLocation(program, "uColor"),
    speed: gl.getUniformLocation(program, "uSpeed"),
    scale: gl.getUniformLocation(program, "uScale"),
    rotation: gl.getUniformLocation(program, "uRotation"),
    noiseIntensity: gl.getUniformLocation(program, "uNoiseIntensity"),
  };

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]),
    gl.STATIC_DRAW
  );

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const silkColor = getComputedStyle(document.documentElement).getPropertyValue("--color-effect-silk");
  const [red, green, blue] = parseHexColor(silkColor);

  gl.uniform3f(uniforms.color, red, green, blue);
  gl.uniform1f(uniforms.speed, 2.5);
  gl.uniform1f(uniforms.scale, 1);
  gl.uniform1f(uniforms.rotation, 0);
  gl.uniform1f(uniforms.noiseIntensity, 1.5);

  const resizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  resizeCanvas();

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(document.documentElement);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  const render = (timestamp) => {
    gl.useProgram(program);
    gl.uniform1f(uniforms.time, timestamp * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
};

const initWellnessStackReveal = () => {
  const wellnessTitle = document.getElementById("wellness-title");
  const wellnessSection = wellnessTitle ? wellnessTitle.closest(".section-split") : null;
  const wellnessStack = wellnessSection ? wellnessSection.querySelector(".wellness-stack") : null;
  const wellnessCards = wellnessStack ? Array.from(wellnessStack.querySelectorAll(".wellness-card")) : [];

  if (!wellnessSection || !wellnessStack || wellnessCards.length < 3) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 1081px)");
  let metrics = null;
  let ticking = false;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const resetCards = () => {
    wellnessStack.classList.remove("is-scroll-stacked");
    wellnessCards.forEach((card) => {
      card.style.setProperty("--wellness-reveal-y", "0px");
    });
  };

  const measure = () => {
    const stackStyles = window.getComputedStyle(wellnessStack);
    const gap = parseFloat(stackStyles.rowGap || stackStyles.gap || "0") || 0;
    const firstHeight = wellnessCards[0].getBoundingClientRect().height;
    const secondHeight = wellnessCards[1].getBoundingClientRect().height;

    metrics = {
      secondStart: -(firstHeight + gap),
      thirdStart: -(firstHeight + gap + secondHeight + gap),
    };
  };

  const update = () => {
    ticking = false;

    if (reducedMotionQuery.matches || !desktopQuery.matches) {
      resetCards();
      return;
    }

    wellnessStack.classList.add("is-scroll-stacked");

    if (!metrics) measure();

    const rect = wellnessStack.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const start = viewportHeight * 0.8;
    const scrollDelta = Math.max(start - rect.top, 0);
    const secondOffset = clamp(metrics.secondStart + scrollDelta, metrics.secondStart, 0);
    const thirdOffset = clamp(metrics.thirdStart + scrollDelta, metrics.thirdStart, 0);

    wellnessCards[0].style.setProperty("--wellness-reveal-y", "0px");
    wellnessCards[1].style.setProperty("--wellness-reveal-y", `${secondOffset}px`);
    wellnessCards[2].style.setProperty("--wellness-reveal-y", `${thirdOffset}px`);
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  const remeasureAndUpdate = () => {
    metrics = null;
    requestUpdate();
  };

  const bindMediaListener = (query, listener) => {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", listener);
      return;
    }

    if (typeof query.addListener === "function") {
      query.addListener(listener);
    }
  };

  bindMediaListener(reducedMotionQuery, remeasureAndUpdate);
  bindMediaListener(desktopQuery, remeasureAndUpdate);

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", remeasureAndUpdate);

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(remeasureAndUpdate);
    resizeObserver.observe(wellnessStack);
  }

  update();
};

const initFaqAccordion = () => {
  const accordion = document.querySelector(".faq-accordion");
  if (!accordion) return;

  const items = Array.from(accordion.querySelectorAll(".faq-item"));
  if (!items.length) return;

  accordion.classList.add("is-enhanced");

  const animateItem = (item, expand) => {
    const answer = item.querySelector(".faq-answer");
    if (!answer) return;

    const endHeight = answer.scrollHeight;

    if (expand) {
      item.open = true;
      answer.style.height = "0px";

      requestAnimationFrame(() => {
        answer.style.height = `${endHeight}px`;
      });

      const onExpandEnd = (event) => {
        if (event.propertyName !== "height") return;
        answer.style.height = "auto";
        answer.removeEventListener("transitionend", onExpandEnd);
      };

      answer.addEventListener("transitionend", onExpandEnd);
      return;
    }

    answer.style.height = `${answer.scrollHeight}px`;

    requestAnimationFrame(() => {
      answer.style.height = "0px";
    });

    const onCollapseEnd = (event) => {
      if (event.propertyName !== "height") return;
      item.open = false;
      answer.style.height = "";
      answer.removeEventListener("transitionend", onCollapseEnd);
    };

    answer.addEventListener("transitionend", onCollapseEnd);
  };

  items.forEach((item) => {
    const summary = item.querySelector("summary");
    const answer = item.querySelector(".faq-answer");
    if (!summary || !answer) return;

    item.open = false;
    answer.style.height = "0px";

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      animateItem(item, !item.open);
    });
  });
};

const initializeSiteInteractions = () => {
  const toggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector(".mobile-nav");
  const copyButtons = document.querySelectorAll("[data-copy]");
  const heroVisual = document.querySelector(".hero-visual");
  const tiltTargets = document.querySelectorAll(
    ".button, .store-link, .step-card, .stat-link, .benefit-panel, .token-card, .community-card, .resource-card, .support-panel, .insight-panel, .person-card"
  );
  const stackSections = document.querySelectorAll("main > .section:not(.hero)");
  const revealTargets = document.querySelectorAll(
    ".section-heading, .how-it-works-media, .steps-grid, .stat-links-band, .team-grid, .partner-grid, .split-copy, .wellness-stack, .insight-panel, .tokenomics-grid, .tokenomics-note, .referral-story, .community-support, .resources-grid, .download-copy, .store-links, .support-panel, .footer-grid"
  );
  const referralStory = document.querySelector(".referral-story");
  const referralSteps = document.querySelectorAll(".referral-step");

  if (toggle && mobileMenu) {
    toggle.addEventListener("click", () => {
      const open = mobileMenu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.getAttribute("data-copy");
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const previous = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = previous;
        }, 1200);
      } catch {
        button.textContent = text;
      }
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.02,
        rootMargin: "0px 0px 12% 0px",
      }
    );

    revealTargets.forEach((target) => observer.observe(target));
  } else {
    revealTargets.forEach((target) => target.classList.add("is-visible"));
  }

  stackSections.forEach((section) => section.classList.add("is-stack-visible"));

  if (referralStory && referralSteps.length) {
    const setReferralStep = (step) => {
      referralStory.setAttribute("data-referral-step", step);
      referralSteps.forEach((item) => {
        const active = item.getAttribute("data-step") === step;
        item.classList.toggle("is-active", active);
      });
    };

    referralSteps.forEach((step) => {
      step.addEventListener("mouseenter", () => {
        setReferralStep(step.getAttribute("data-step") || "1");
      });

      step.addEventListener("focus", () => {
        setReferralStep(step.getAttribute("data-step") || "1");
      });
    });

    if ("IntersectionObserver" in window) {
      const referralObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            setReferralStep(entry.target.getAttribute("data-step") || "1");
          });
        },
        {
          threshold: 0.28,
          rootMargin: "-8% 0px -22% 0px",
        }
      );

      referralSteps.forEach((step) => referralObserver.observe(step));
    }
  }

  if (heroVisual && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    heroVisual.addEventListener("pointermove", (event) => {
      const rect = heroVisual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      heroVisual.style.setProperty("--hero-shift-x", `${x * 22}px`);
      heroVisual.style.setProperty("--hero-shift-y", `${y * 18}px`);
    });

    heroVisual.addEventListener("pointerleave", () => {
      heroVisual.style.setProperty("--hero-shift-x", "0px");
      heroVisual.style.setProperty("--hero-shift-y", "0px");
    });
  }

  if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    tiltTargets.forEach((target) => {
      target.classList.add("tilt-hover");

      target.addEventListener("pointermove", (event) => {
        const rect = target.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;

        target.style.setProperty("--tilt-x", `${px * 5}px`);
        target.style.setProperty("--tilt-y", `${py * 5}px`);
        target.style.setProperty("--tilt-rx", `${py * -2.2}deg`);
        target.style.setProperty("--tilt-ry", `${px * 2.8}deg`);
      });

      target.addEventListener("pointerleave", () => {
        target.style.setProperty("--tilt-x", "0px");
        target.style.setProperty("--tilt-y", "0px");
        target.style.setProperty("--tilt-rx", "0deg");
        target.style.setProperty("--tilt-ry", "0deg");
      });
    });
  }
};

const initializeApp = async () => {
  await applyDesignTokens();
  initSilkBackground();
  initWellnessStackReveal();
  initFaqAccordion();
  initializeSiteInteractions();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}
