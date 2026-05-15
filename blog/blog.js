const initializeBlogNavigation = () => {
  const toggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector(".mobile-nav");

  if (toggle && mobileMenu) {
    toggle.addEventListener("click", () => {
      const open = mobileMenu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
};

const initializeArticleToc = () => {
  const tocLinks = Array.from(document.querySelectorAll(".blog-toc a[href^=\"#\"]"));
  if (!tocLinks.length || !("IntersectionObserver" in window)) return;

  const headings = tocLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const linkMap = new Map(
    tocLinks.map((link) => [link.getAttribute("href"), link])
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        linkMap.forEach((link) => link.classList.remove("is-active"));
        const activeLink = linkMap.get(`#${entry.target.id}`);
        if (activeLink) activeLink.classList.add("is-active");
      });
    },
    {
      rootMargin: "0px 0px -70% 0px",
      threshold: 0.2,
    }
  );

  headings.forEach((heading) => observer.observe(heading));
};

document.addEventListener("DOMContentLoaded", () => {
  initializeBlogNavigation();
  initializeArticleToc();
});
