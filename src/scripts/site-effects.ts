declare global {
  interface Window {
    __noToneSiteEffectsInitialized?: boolean;
    noTone?: {
      closeCurrentWindow?: (button: HTMLButtonElement) => void;
      [key: string]: unknown;
    };
  }
}

const computeWindowRect = () => {
  const width = Math.min(window.innerWidth - 40, 920);
  const height = Math.min(window.innerHeight - 84, 640);
  return {
    left: Math.max(20, (window.innerWidth - width) / 2),
    top: Math.max(52, (window.innerHeight - height) / 2),
    width,
    height,
  };
};

const runStandaloneNavigation = async (
  button: HTMLButtonElement,
): Promise<void> => {
  if (document.body?.dataset.windowClosing === "true") {
    return;
  }

  const topbar = document.querySelector(".topbar");
  const windowRoot = document.querySelector("[data-window-root]");
  const bottombar = document.querySelector(".bottombar");
  const goBack =
    button.dataset.canGoBack === "true" && window.history.length > 1;

  if (
    !(topbar instanceof HTMLElement) ||
    !(windowRoot instanceof HTMLElement)
  ) {
    if (goBack) {
      window.history.back();
      return;
    }
    window.location.href = "/";
    return;
  }

  document.body.dataset.windowClosing = "true";
  const { gsap } = await import("gsap");

  await new Promise<void>((resolve) => {
    gsap
      .timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: resolve,
      })
      .to(topbar, { autoAlpha: 0, y: -10, duration: 0.18 }, 0)
      .to(
        bottombar instanceof HTMLElement ? bottombar : {},
        { autoAlpha: 0, y: 10, duration: 0.18 },
        0,
      )
      .to(
        windowRoot,
        {
          autoAlpha: 0,
          y: 12,
          scale: 0.965,
          duration: 0.22,
        },
        0,
      );
  });

  delete document.body.dataset.windowClosing;
  if (goBack) {
    window.history.back();
    return;
  }
  window.location.href = "/";
};

const initDesktopWindow = async (): Promise<void> => {
  const desktop = document.querySelector(".desktop");
  const shell = document.querySelector("[data-desktop-window]");
  const frame = document.querySelector("[data-desktop-window-frame]");
  const backdrop = document.querySelector("[data-desktop-window-backdrop]");
  const title = document.querySelector("[data-desktop-window-title]");
  const iframe = document.querySelector("[data-desktop-window-iframe]");
  const closeButton = document.querySelector("[data-desktop-window-close]");
  const themeButton = document.querySelector("[data-desktop-window-theme]");
  const themeIcon = document.querySelector("[data-desktop-window-theme-icon]");
  const fullscreenButton = document.querySelector(
    "[data-desktop-window-fullscreen]",
  );

  if (
    !(desktop instanceof HTMLElement) ||
    !(shell instanceof HTMLElement) ||
    !(frame instanceof HTMLElement) ||
    !(backdrop instanceof HTMLElement) ||
    !(title instanceof HTMLElement) ||
    !(iframe instanceof HTMLIFrameElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
    !(themeButton instanceof HTMLButtonElement) ||
    !(themeIcon instanceof HTMLElement) ||
    !(fullscreenButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const { gsap } = await import("gsap");

  let activeIcon: HTMLAnchorElement | null = null;
  let isFullscreen = false;

  const noTone = (window.noTone ??= {});
  const applyThemeToIframe = () => {
    const theme =
      typeof noTone.readTheme === "function" ? noTone.readTheme() : "dark";
    try {
      iframe.contentWindow?.postMessage(
        { type: "no-tone:set-theme", theme },
        window.location.origin,
      );
      iframe.contentWindow?.document?.documentElement?.setAttribute(
        "data-theme",
        theme,
      );
      iframe.contentWindow?.localStorage?.setItem("theme", theme);
      iframe.contentWindow?.dispatchEvent(
        new CustomEvent("no-tone:themechange", {
          detail: { theme },
        }),
      );
    } catch {
      // iframe may not be ready yet
    }
  };
  const syncThemeIcon = () => {
    const theme =
      typeof noTone.readTheme === "function" ? noTone.readTheme() : "dark";
    themeIcon.textContent = theme === "dark" ? "☾" : "☀︎";
    applyThemeToIframe();
  };

  syncThemeIcon();
  window.addEventListener("pageshow", syncThemeIcon);
  window.addEventListener("storage", (event) => {
    if (event.key === "theme") {
      syncThemeIcon();
    }
  });
  window.addEventListener("no-tone:themechange", syncThemeIcon);

  themeButton.addEventListener("click", () => {
    if (
      typeof noTone.readTheme !== "function" ||
      typeof noTone.applyTheme !== "function" ||
      typeof noTone.setStoredTheme !== "function"
    ) {
      return;
    }
    const current =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    noTone.applyTheme(next);
    noTone.setStoredTheme(next);
    syncThemeIcon();
  });

  const getNormalRect = () => computeWindowRect();
  const getFullscreenRect = () => ({
    left: 12,
    top: 12,
    width: window.innerWidth - 24,
    height: window.innerHeight - 24,
  });

  const animateToRect = (rect: ReturnType<typeof computeWindowRect>) => {
    gsap.to(frame, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      duration: 0.28,
      ease: "power3.inOut",
    });
  };

  const closeShell = () => {
    if (!(activeIcon instanceof HTMLAnchorElement)) {
      shell.hidden = true;
      iframe.src = "about:blank";
      document.body.classList.remove("has-desktop-window-open");
      isFullscreen = false;
      return;
    }

    const iconRect = activeIcon.getBoundingClientRect();
    const startWidth = 58;
    const startHeight = 44;
    const targetLeft = iconRect.left + iconRect.width / 2 - startWidth / 2;
    const targetTop = iconRect.top + iconRect.height / 2 - startHeight / 2;

    gsap.timeline({
      defaults: { ease: "expo.inOut" },
      onComplete: () => {
        shell.hidden = true;
        shell.classList.remove("desktopWindow--fullscreen");
        iframe.src = "about:blank";
        document.body.classList.remove("has-desktop-window-open");
        activeIcon = null;
        isFullscreen = false;
      },
    })
      .to(backdrop, { autoAlpha: 0, duration: 0.18 }, 0)
      .to(iframe, { autoAlpha: 0, duration: 0.14 }, 0)
      .to(
        frame,
        {
          left: targetLeft,
          top: targetTop,
          width: startWidth,
          height: startHeight,
          opacity: 0.18,
          scale: 0.74,
          duration: 0.42,
        },
        0,
      );
  };

  closeButton.addEventListener("click", closeShell);
  backdrop.addEventListener("click", closeShell);

  fullscreenButton.addEventListener("click", () => {
    if (shell.hidden) return;
    isFullscreen = !isFullscreen;
    shell.classList.toggle("desktopWindow--fullscreen", isFullscreen);
    animateToRect(isFullscreen ? getFullscreenRect() : getNormalRect());
  });

  window.addEventListener("resize", () => {
    if (shell.hidden) return;
    animateToRect(isFullscreen ? getFullscreenRect() : getNormalRect());
  });

  const links = desktop.querySelectorAll<HTMLAnchorElement>('.icon[href^="/"]');
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.dataset.skipWindowAnimation === "true") return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      activeIcon = link;
      isFullscreen = false;
      desktop
        .querySelectorAll(".icon.is-selected")
        .forEach((item) => item.classList.remove("is-selected"));
      document.body.classList.add("has-desktop-window-open");
      shell.classList.remove("desktopWindow--fullscreen");
      shell.hidden = false;
      title.textContent =
        `${link.querySelector(".icon__label")?.textContent?.trim() || "window"}/`;
      iframe.style.opacity = "0";

      iframe.onload = () => {
        applyThemeToIframe();
        gsap.to(iframe, { autoAlpha: 1, duration: 0.18, ease: "power2.out" });
      };
      url.searchParams.set("window", "1");
      iframe.src = url.toString();

      const iconRect = link.getBoundingClientRect();
      const startWidth = 112;
      const startHeight = 84;
      const startLeft = iconRect.left + iconRect.width / 2 - startWidth / 2;
      const startTop = iconRect.top + iconRect.height / 2 - startHeight / 2;
      const finalRect = getNormalRect();

      gsap.killTweensOf([backdrop, frame, iframe]);
      gsap.set(backdrop, { autoAlpha: 0 });
      gsap.set(frame, {
        left: startLeft,
        top: startTop,
        width: startWidth,
        height: startHeight,
        opacity: 0.2,
        scale: 1,
      });

      gsap
        .timeline({ defaults: { ease: "expo.inOut" } })
        .to(backdrop, { autoAlpha: 1, duration: 0.24 }, 0)
        .to(
          frame,
          {
            left: finalRect.left,
            top: finalRect.top,
            width: finalRect.width,
            height: finalRect.height,
            opacity: 1,
            duration: 0.38,
          },
          0,
        );
    });
  });
};

const resolveWindowModeHref = (anchor: HTMLAnchorElement): string | null => {
  if (anchor.dataset.skipWindowMode === "true") return null;
  if (anchor.hasAttribute("download")) return null;

  const target = (anchor.getAttribute("target") ?? "").trim();
  if (target && target !== "_self") return null;

  const rawHref = anchor.getAttribute("href")?.trim() ?? "";
  if (!rawHref || rawHref.startsWith("#")) return null;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.searchParams.set("window", "1");
  return `${url.pathname}${url.search}${url.hash}`;
};

const initWindowModeLinkRouting = (): void => {
  if (document.body?.dataset.windowMode !== "true") {
    return;
  }

  const anchors = document.querySelectorAll<HTMLAnchorElement>("a[href]");
  anchors.forEach((anchor) => {
    const resolvedHref = resolveWindowModeHref(anchor);
    if (resolvedHref) {
      anchor.setAttribute("href", resolvedHref);
    }
  });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (!(event.target instanceof Element)) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const resolvedHref = resolveWindowModeHref(anchor);
    if (!resolvedHref) return;

    event.preventDefault();
    window.location.assign(resolvedHref);
  });
};

const closeCurrentWindow = (button: HTMLButtonElement): void => {
  if (document.body?.dataset.standaloneWindow === "true") {
    void runStandaloneNavigation(button);
    return;
  }
  const goBack = button.dataset.canGoBack === "true" && window.history.length > 1;
  if (goBack) {
    window.history.back();
    return;
  }
  window.location.href = "/";
};

export const initSiteEffects = (): void => {
  if (typeof window === "undefined" || window.__noToneSiteEffectsInitialized) {
    return;
  }

  window.__noToneSiteEffectsInitialized = true;
  const noTone = (window.noTone ??= {});
  noTone.closeCurrentWindow = closeCurrentWindow;
  const isWindowMode = document.body?.dataset.windowMode === "true";

  const boot = () => {
    if (isWindowMode) {
      initWindowModeLinkRouting();
      return;
    }

    void initDesktopWindow();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
    return;
  }

  boot();
};
