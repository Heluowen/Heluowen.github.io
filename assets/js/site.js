/*
 * Heluowen 主页交互
 * - 导航滚动状态
 * - 滚动入场动画
 * - 项目卡片的鼠标倾斜与光斑
 * - 项目 star / 更新时间静默刷新
 * - 背景设置面板（本地预览 + 导出配置）
 */
(function () {
  "use strict";

  var SITE = window.SITE || {};
  var root = document.documentElement;
  var body = document.body;
  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motion = SITE.motion !== false && !reduceMotion;

  /* ------------------------- 导航 ------------------------- */

  var nav = document.getElementById("nav");
  function syncNav() {
    if (!nav) return;
    nav.classList.toggle("is-stuck", window.scrollY > 24);
  }
  syncNav();
  window.addEventListener("scroll", syncNav, { passive: true });

  /* --------------------- 滚动入场动画 --------------------- */

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  Array.prototype.forEach.call(document.querySelectorAll(".grid"), function (grid) {
    Array.prototype.forEach.call(grid.children, function (el, i) {
      el.dataset.stagger = String(i % 6);
    });
  });

  if (!motion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var idx = Number(el.dataset.stagger || 0);
          el.style.transitionDelay = Math.min(idx * 70, 380) + "ms";
          el.classList.add("is-in");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ------------------- 项目卡片：倾斜 + 光斑 ------------------- */

  if (motion && window.matchMedia("(hover: hover)").matches) {
    Array.prototype.forEach.call(document.querySelectorAll(".proj"), function (card) {
      card.addEventListener("pointermove", function (ev) {
        var r = card.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width;
        var py = (ev.clientY - r.top) / r.height;
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        card.style.setProperty("--ry", ((px - 0.5) * 5).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - py) * 5).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ------------------- GitHub 静默刷新 ------------------- */

  function prettyDate(iso) {
    if (!iso) return "";
    return String(iso).slice(0, 10);
  }

  function refreshRepos() {
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-repo]"));
    if (!cards.length || !SITE.github) return;

    var fallbacks = cards.map(function (card) {
      var node = card.querySelector('[data-field="stars"]');
      var n = node ? parseInt(String(node.textContent).replace(/[^\d]/g, ""), 10) : 0;
      return isNaN(n) ? 0 : n;
    });

    var jobs = cards.map(function (card, i) {
      var url = "https://api.github.com/repos/" + SITE.github + "/" + card.dataset.repo;
      return fetch(url, { headers: { Accept: "application/vnd.github+json" } })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (data) {
          if (!data || typeof data.stargazers_count !== "number") return fallbacks[i];

          var starsNode = card.querySelector('[data-field="stars"]');
          if (starsNode) starsNode.textContent = "★ " + data.stargazers_count;

          var dateNode = card.querySelector('[data-field="updated"]');
          if (dateNode) {
            var d = prettyDate(data.pushed_at || data.updated_at);
            if (d) dateNode.textContent = d;
          }

          if (data.language) {
            var langNode = card.querySelector(".lang");
            if (langNode) {
              var textNode = langNode.lastChild;
              if (textNode && textNode.nodeType === 3) textNode.textContent = data.language;
            }
          }

          return data.stargazers_count;
        })
        .catch(function () {
          return fallbacks[i];
        });
    });

    Promise.all(jobs).then(function (counts) {
      var total = counts.reduce(function (a, b) {
        return a + (typeof b === "number" ? b : 0);
      }, 0);
      var node = document.getElementById("statStars");
      if (node) node.textContent = String(total);
    });
  }

  if (SITE.refresh !== false) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(refreshRepos, { timeout: 1800 });
    } else {
      window.setTimeout(refreshRepos, 400);
    }
  }

  /* --------------------- 背景设置面板 --------------------- */

  var KEY = {
    image: "heluowen.bg.image",
    overlay: "heluowen.bg.overlay",
    blur: "heluowen.bg.blur",
    name: "heluowen.bg.name"
  };

  var photo = document.getElementById("bgPhoto");
  var gear = document.getElementById("gear");
  var panel = document.getElementById("bgPanel");
  var closeBtn = document.getElementById("bgClose");
  var fileInput = document.getElementById("bgFile");
  var dropZone = panel ? panel.querySelector(".panel__drop") : null;
  var overlayInput = document.getElementById("bgOverlay");
  var overlayOut = document.getElementById("bgOverlayOut");
  var blurInput = document.getElementById("bgBlur");
  var blurOut = document.getElementById("bgBlurOut");
  var codeBox = document.getElementById("bgCode");
  var copyBtn = document.getElementById("bgCopy");
  var clearBtn = document.getElementById("bgClear");
  var resetBtn = document.getElementById("bgReset");

  if (!photo || !gear || !panel) return;

  function readVar(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name);
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  var configuredImage = body.classList.contains("has-bg-image");
  var DEFAULT = {
    overlay: readVar("--bg-overlay", 62),
    blur: readVar("--bg-blur", 0)
  };

  function readStore(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (err) {
      return fallback;
    }
  }

  var state = {
    image: readStore(KEY.image, "") || "",
    overlay: Number(readStore(KEY.overlay, DEFAULT.overlay)),
    blur: Number(readStore(KEY.blur, DEFAULT.blur)),
    fileName: readStore(KEY.name, "") || ""
  };
  if (isNaN(state.overlay)) state.overlay = DEFAULT.overlay;
  if (isNaN(state.blur)) state.blur = DEFAULT.blur;

  function currentImagePath() {
    var raw = getComputedStyle(root).getPropertyValue("--bg-image") || "";
    var m = raw.match(/url\(["']?([^"')]+)["']?\)/);
    return m ? m[1] : "";
  }

  /* 面板里给出的永远只是能直接替换的那三行，避免整段贴错位置 */
  function codeLines() {
    var path = state.fileName
      ? "/images/backgrounds/" + state.fileName
      : currentImagePath() || "/images/backgrounds/your-photo.jpg";
    return [
      "image: " + path,
      "overlay: " + Math.round(state.overlay),
      "blur: " + Math.round(state.blur)
    ];
  }

  function syncCode() {
    if (!codeBox) return;
    codeBox.textContent = codeLines().join("\n");
  }

  function apply() {
    if (state.image) {
      photo.style.backgroundImage = 'url("' + state.image + '")';
      body.classList.add("has-bg-image");
    } else {
      photo.style.backgroundImage = "";
      if (!configuredImage) body.classList.remove("has-bg-image");
    }

    root.style.setProperty("--bg-overlay", Math.round(state.overlay));
    root.style.setProperty("--bg-blur", Math.round(state.blur) + "px");

    if (overlayInput) overlayInput.value = String(Math.round(state.overlay));
    if (overlayOut) overlayOut.textContent = Math.round(state.overlay) + "%";
    if (blurInput) blurInput.value = String(Math.round(state.blur));
    if (blurOut) blurOut.textContent = Math.round(state.blur) + "px";

    syncCode();
  }

  function persist() {
    try {
      if (state.image) localStorage.setItem(KEY.image, state.image);
      else localStorage.removeItem(KEY.image);
      if (state.fileName) localStorage.setItem(KEY.name, state.fileName);
      else localStorage.removeItem(KEY.name);
      localStorage.setItem(KEY.overlay, String(Math.round(state.overlay)));
      localStorage.setItem(KEY.blur, String(Math.round(state.blur)));
    } catch (err) {
      /* 超出 localStorage 配额时忽略，仅本次预览有效 */
    }
  }

  function shrink(dataUrl, done) {
    var img = new Image();
    img.onload = function () {
      var max = 1920;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      done(canvas.toDataURL("image/jpeg", 0.84));
    };
    img.onerror = function () {
      done(dataUrl);
    };
    img.src = dataUrl;
  }

  function useFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    state.fileName = file.name || "";
    var reader = new FileReader();
    reader.onload = function (ev) {
      shrink(String(ev.target.result), function (out) {
        state.image = out;
        apply();
        persist();
      });
    };
    reader.readAsDataURL(file);
  }

  gear.addEventListener("click", function () {
    var open = panel.hasAttribute("hidden");
    if (open) {
      panel.removeAttribute("hidden");
      apply();
    } else {
      panel.setAttribute("hidden", "");
    }
    gear.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function closePanel() {
    panel.setAttribute("hidden", "");
    gear.setAttribute("aria-expanded", "false");
  }

  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closePanel();
  });

  document.addEventListener("pointerdown", function (ev) {
    if (panel.hasAttribute("hidden")) return;
    if (panel.contains(ev.target) || gear.contains(ev.target)) return;
    closePanel();
  });

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      useFile(fileInput.files && fileInput.files[0]);
    });
  }

  if (dropZone) {
    ["dragenter", "dragover"].forEach(function (type) {
      dropZone.addEventListener(type, function (ev) {
        ev.preventDefault();
        dropZone.style.borderColor = "rgba(34,211,238,.8)";
      });
    });
    ["dragleave", "drop"].forEach(function (type) {
      dropZone.addEventListener(type, function (ev) {
        ev.preventDefault();
        dropZone.style.borderColor = "";
      });
    });
    dropZone.addEventListener("drop", function (ev) {
      var dt = ev.dataTransfer;
      if (dt && dt.files && dt.files[0]) useFile(dt.files[0]);
    });
  }

  if (overlayInput) {
    overlayInput.addEventListener("input", function () {
      state.overlay = Number(overlayInput.value);
      apply();
      persist();
    });
  }

  if (blurInput) {
    blurInput.addEventListener("input", function () {
      state.blur = Number(blurInput.value);
      apply();
      persist();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      state.image = "";
      state.fileName = "";
      apply();
      persist();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      state.image = "";
      state.fileName = "";
      state.overlay = DEFAULT.overlay;
      state.blur = DEFAULT.blur;
      apply();
      persist();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = codeLines().join("\n");
      var done = function () {
        var old = copyBtn.textContent;
        copyBtn.textContent = "已复制";
        window.setTimeout(function () {
          copyBtn.textContent = old;
        }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand("copy");
        } catch (err) {
          /* ignore */
        }
        document.body.removeChild(area);
        done();
      }
    });
  }

  apply();
})();
