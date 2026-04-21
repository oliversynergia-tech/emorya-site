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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyDesignTokens, { once: true });
} else {
  applyDesignTokens();
}

const toggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-nav");
const copyButtons = document.querySelectorAll("[data-copy]");
const heroVisual = document.querySelector(".hero-visual");
const tiltTargets = document.querySelectorAll(
  ".button, .store-link, .step-card, .stat-link, .benefit-panel, .wellness-card, .token-card, .community-card, .resource-card, .support-panel, .insight-panel, .person-card"
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
