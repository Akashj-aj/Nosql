/* ==========================================================================
   TOAST NOTIFICATIONS AND USER FEEDBACK SYSTEM
   ========================================================================== */

class NotificationManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.ensureContainer());
    } else {
      this.ensureContainer();
    }
  }

  ensureContainer() {
    this.container = document.getElementById("toast-container");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toast-container";
      document.body.appendChild(this.container);
    }
  }

  /**
   * Display a toast notification
   * @param {string} message - Message text
   * @param {string} type - 'success' | 'error' | 'warning' | 'info'
   * @param {number} duration - Milliseconds before auto-dismiss (default 4000)
   * @param {string|null} actionUrl - Optional link to navigate to when clicked
   */
  show(message, type = "info", duration = 4500, actionUrl = null) {
    this.ensureContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const iconMap = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
      warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DEEC51" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const titles = {
      success: "Success",
      error: "Error",
      warning: "Attention",
      info: "Notice"
    };

    const icon = document.createElement("div");
    icon.className = "toast-icon";
    icon.innerHTML = iconMap[type] || iconMap.info;

    const content = document.createElement("div");
    content.className = "toast-content";

    const title = document.createElement("div");
    title.className = "toast-title";
    title.textContent = titles[type] || "Notice";

    const description = document.createElement("div");
    description.className = "toast-desc";
    description.textContent = String(message);

    content.append(title, description);

    const safeActionUrl = typeof actionUrl === "string" &&
      /^(https?:\/\/|\/|\.\/|\.\.\/|#)/i.test(actionUrl)
      ? actionUrl
      : null;

    if (safeActionUrl) {
      const link = document.createElement("a");
      link.href = safeActionUrl;
      link.textContent = "View Details \u2192";
      link.style.cssText = "display:inline-block; margin-top:4px; color:var(--color-primary); font-weight:600; font-size:12px; text-decoration:underline;";
      content.appendChild(link);
    }

    const close = document.createElement("div");
    close.className = "toast-close";
    close.textContent = "\u00d7";

    toast.append(icon, content, close);

    // Click to dismiss
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dismiss(toast);
    });

    // If whole toast has actionUrl and clicked outside close
    if (safeActionUrl) {
      toast.style.cursor = "pointer";
      toast.addEventListener("click", (e) => {
        if (e.target !== close) {
          window.location.href = safeActionUrl;
        }
      });
    }

    this.container.appendChild(toast);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }

    return toast;
  }

  dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px) scale(0.95)";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }

  success(msg, duration = 4000, actionUrl = null) {
    return this.show(msg, "success", duration, actionUrl);
  }

  error(msg, duration = 5000, actionUrl = null) {
    return this.show(msg, "error", duration, actionUrl);
  }

  warning(msg, duration = 4500, actionUrl = null) {
    return this.show(msg, "warning", duration, actionUrl);
  }

  info(msg, duration = 4000, actionUrl = null) {
    return this.show(msg, "info", duration, actionUrl);
  }
}

export const notify = new NotificationManager();
