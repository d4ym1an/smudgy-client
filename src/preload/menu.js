const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const { version } = require("../../package.json");

class Menu {
  constructor() {
    this.settings = ipcRenderer.sendSync("get-settings");
    this.menuCSS = fs.readFileSync(
      path.join(__dirname, "../assets/css/menu.css"),
      "utf8"
    );
    this.menuHTML = fs.readFileSync(
      path.join(__dirname, "../assets/html/menu.html"),
      "utf8"
    );
    this.menu = this.createMenu();
    this.localStorage = window.localStorage;
    this.menuToggle = this.menu.querySelector(".menu");
    this.tabToContentMap = {
      ui: this.menu.querySelector("#ui-options"),
      game: this.menu.querySelector("#game-options"),
      performance: this.menu.querySelector("#performance-options"),
      client: this.menu.querySelector("#client-options"),
      scripts: this.menu.querySelector("#scripts-options"),
      about: this.menu.querySelector("#about-client"),
      assets: this.menu.querySelector("#assets-options"),
    };
  }

  createMenu() {
    const menu = document.createElement("div");
    menu.innerHTML = this.menuHTML;
    menu.id = "juice-menu";
    menu.style.cssText =
      "z-index: 99999999; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);";
    const menuCSS = document.createElement("style");
    menuCSS.innerHTML = this.menuCSS;
    menu.prepend(menuCSS);
    document.body.appendChild(menu);
    return menu;
  }

  init() {
    this.setVersion();
    this.setUser();
    this.setKeybind();
    this.setTheme();
    this.handleKeyEvents();
    this.initMenu();
    this.handleMenuKeybindChange();
    this.handleMenuInputChanges();
    this.handleMenuSelectChanges();
    this.handleTabChanges();
    this.handleDropdowns();
    this.handleSearch();
    this.handleButtons();
    this.initAssets();
    this.localStorage.getItem("juice-menu-tab")
      ? this.handleTabChange(
          this.menu.querySelector(
            `[data-tab="${this.localStorage.getItem("juice-menu-tab")}"]`
          )
        )
      : this.handleTabChange(this.menu.querySelector(".juice.tab"));
  }

  setVersion() {
    this.menu.querySelectorAll(".ver").forEach((element) => {
      element.innerText = `v${version}`;
    });
  }

  setUser() {
    const user = JSON.parse(this.localStorage.getItem("current-user"));
    if (user) {
      this.menu.querySelector(".user").innerText = `${user.name}#${user.shortId}`;
    }
  }

  setKeybind() {
    this.menu.querySelector(
      ".keybind"
    ).innerText = `Press ${this.settings.menu_keybind} to toggle menu`;
    if (!this.localStorage.getItem("juice-menu")) {
      this.localStorage.setItem(
        "juice-menu",
        this.menuToggle.getAttribute("data-active")
      );
    } else {
      this.menuToggle.setAttribute(
        "data-active",
        this.localStorage.getItem("juice-menu")
      );
    }
  }

  setTheme() {
    this.menu
      .querySelector(".menu")
      .setAttribute("data-theme", this.settings.menu_theme);
  }

  handleKeyEvents() {
    document.addEventListener("keydown", (e) => {
      if (e.code === this.settings.menu_keybind) {
        const isActive = this.menuToggle.getAttribute("data-active") === "true";
        if (!isActive) {
          document.exitPointerLock();
        }
        this.menuToggle.setAttribute("data-active", !isActive);
        this.localStorage.setItem("juice-menu", !isActive);
      }
    });
  }

  initMenu() {
    const inputs = this.menu.querySelectorAll("input[data-setting]");
    const textareas = this.menu.querySelectorAll("textarea[data-setting]");
    const selects = this.menu.querySelectorAll("select[data-setting]");

    inputs.forEach((input) => {
      const setting = input.dataset.setting;
      const type = input.type;
      const value = this.settings[setting];
      if (type === "checkbox") {
        input.checked = value;
      } else {
        input.value = value;
      }
    });

    selects.forEach((select) => {
      const setting = select.dataset.setting;
      const value = this.settings[setting];
      select.value = value;
    });

    textareas.forEach((textarea) => {
      const setting = textarea.dataset.setting;
      const value = this.settings[setting];
      textarea.value = value;
    });

    // Apply server zoom on init using saved setting, defaulting to 1
    const serverZoom = this.settings["server_zoom"] ?? 1;
    this.applyServerZoom(serverZoom);
  }

  applyServerZoom(value) {
    let styleEl = document.getElementById("juice-server-zoom");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "juice-server-zoom";
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `.content .servers { zoom: ${value}; }`;
  }

  handleMenuKeybindChange() {
    const changeKeybindButton = this.menu.querySelector(".change-keybind");
    changeKeybindButton.innerText = this.settings.menu_keybind;
    changeKeybindButton.addEventListener("click", () => {
      changeKeybindButton.innerText = "Press any key";
      const listener = (e) => {
        this.settings.menu_keybind = e.code;
        changeKeybindButton.innerText = e.code;
        ipcRenderer.send("update-setting", "menu_keybind", e.code);

        const event = new CustomEvent("juice-settings-changed", {
          detail: { setting: "menu_keybind", value: e.code },
        });
        document.dispatchEvent(event);

        this.menu.querySelector(
          ".keybind"
        ).innerText = `Press ${this.settings.menu_keybind} to toggle menu`;
        document.removeEventListener("keydown", listener);
      };
      document.addEventListener("keydown", listener);
    });
  }

  handleMenuInputChange(input) {
    const setting = input.dataset.setting;
    const type = input.type;
    const value = type === "checkbox" ? input.checked : input.value;
    this.settings[setting] = value;
    ipcRenderer.send("update-setting", setting, value);

    const event = new CustomEvent("juice-settings-changed", {
      detail: { setting: setting, value: value },
    });
    document.dispatchEvent(event);

    // Live-update server zoom as the slider moves
    if (setting === "server_zoom") {
      this.applyServerZoom(value);
    }
  }

  handleMenuInputChanges() {
    const inputs = this.menu.querySelectorAll("input[data-setting]");
    const textareas = this.menu.querySelectorAll("textarea[data-setting]");

    inputs.forEach((input) => {
      // Use "input" event for range sliders so it updates live while dragging
      const eventType = input.type === "range" ? "input" : "change";
      input.addEventListener(eventType, () => this.handleMenuInputChange(input));
    });

    textareas.forEach((textarea) => {
      textarea.addEventListener("change", () =>
        this.handleMenuInputChange(textarea)
      );
    });
  }

  handleMenuSelectChange(select) {
    const setting = select.dataset.setting;
    const value = select.value;
    this.settings[setting] = value;
    ipcRenderer.send("update-setting", setting, value);

    const event = new CustomEvent("juice-settings-changed", {
      detail: { setting: setting, value: value },
    });

    if (setting === "menu_theme") {
      this.setTheme();
    }

    document.dispatchEvent(event);
  }

  handleMenuSelectChanges() {
    const selects = this.menu.querySelectorAll("select[data-setting]");
    selects.forEach((select) => {
      select.addEventListener("change", () =>
        this.handleMenuSelectChange(select)
      );
    });
  }

  handleTabChanges() {
    const tabs = this.menu.querySelectorAll(".juice.tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => this.handleTabChange(tab));
    });
  }

  handleTabChange(tab) {
    const tabs = this.menu.querySelectorAll(".juice.tab");
    const tabName = tab.dataset.tab;

    this.localStorage.setItem("juice-menu-tab", tabName);

    const contents = this.menu.querySelectorAll(".juice.options");
    tabs.forEach((tab) => {
      tab.classList.remove("active");
    });
    contents.forEach((content) => {
      content.classList.remove("active");
    });
    tab.classList.add("active");
    this.tabToContentMap[tab.dataset.tab].classList.add("active");
  }

  handleDropdowns() {
    const dropdowns = this.menu.querySelectorAll(".dropdown");
    dropdowns.forEach((dropdown) => {
      const dropdownTop = dropdown.querySelector(".dropdown .top");
      dropdownTop.addEventListener("click", () => {
        dropdown.classList.toggle("active");
      });
    });
  }

  handleSearch() {
    const searchInput = this.menu.querySelector(".juice.search");
    const settings = this.menu.querySelectorAll(".option:not(.custom)");
    searchInput.addEventListener("input", () => {
      const searchValue = searchInput.value.toLowerCase();
      settings.forEach((setting) => {
        setting.style.display = setting.textContent
          .toLowerCase()
          .includes(searchValue)
          ? "flex"
          : "none";

        const parent = setting.parentElement;
        if (parent.classList.contains("option-group")) {
          const children = parent.children;
          const visibleChildren = Array.from(children).filter(
            (child) => child.style.display === "flex"
          );
          parent.style.display = visibleChildren.length ? "flex" : "none";
        }
      });
    });
  }

  handleButtons() {
    const openSwapperFolder = this.menu.querySelector("#open-swapper-folder");
    openSwapperFolder.addEventListener("click", () => {
      ipcRenderer.send("open-swapper-folder");
    });

    const openScriptsFolder = this.menu.querySelector("#open-scripts-folder");
    openScriptsFolder.addEventListener("click", () => {
      ipcRenderer.send("open-scripts-folder");
    });

    const importSettings = this.menu.querySelector("#import-settings");
    importSettings.addEventListener("click", () => {
      const modal = this.createModal(
        "Import settings",
        "Paste your settings here to import them"
      );

      const bottom = modal.querySelector(".bottom");

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Paste settings here";
      bottom.appendChild(input);

      const confirm = document.createElement("button");
      confirm.innerText = "Confirm";
      confirm.classList.add("juice-button");
      confirm.addEventListener("click", () => {
        try {
          if (!input.value) return;

          const settings = JSON.parse(input.value);
          for (const key in settings) {
            this.settings[key] = settings[key];
            ipcRenderer.send("update-setting", key, settings[key]);

            const event = new CustomEvent("juice-settings-changed", {
              detail: { setting: key, value: settings[key] },
            });
            document.dispatchEvent(event);

            this.initMenu();
          }
          modal.remove();
        } catch (error) {
          console.error("Error importing settings:", error);
        }
      });

      bottom.appendChild(confirm);

      this.menu.querySelector(".menu").appendChild(modal);
    });

    const exportSettings = this.menu.querySelector("#export-settings");
    exportSettings.addEventListener("click", () => {
      const modal = this.createModal(
        "Export settings",
        "Copy your settings here to export them"
      );

      const bottom = modal.querySelector(".bottom");

      const textarea = document.createElement("textarea");
      textarea.value = JSON.stringify(this.settings, null, 2);
      bottom.appendChild(textarea);

      const copy = document.createElement("button");
      copy.innerText = "Copy";
      copy.classList.add("juice-button");
      copy.addEventListener("click", () => {
        navigator.clipboard.writeText(textarea.value);
      });

      bottom.appendChild(copy);

      this.menu.querySelector(".menu").appendChild(modal);
    });

    let clickCounter = 0;
    const resetJuiceSettings = this.menu.querySelector("#reset-juice-settings");
    resetJuiceSettings.addEventListener("click", () => {
      clickCounter++;
      if (clickCounter === 1) {
        resetJuiceSettings.style.background = "rgba(var(--red), 0.25)";
        const text = resetJuiceSettings.querySelector(".text");
        text.innerText = "Are you sure?";

        const description = resetJuiceSettings.querySelector(".description");
        description.innerText =
          "This will restart the client and reset all settings. Click again to confirm";
      } else if (clickCounter === 2) {
        ipcRenderer.send("reset-juice-settings");
      }
    });

    const remoteToStaticLinks = this.menu.querySelector(
      "#remote-to-static-links"
    );
    remoteToStaticLinks.addEventListener("click", async () => {
      const localStorageKeys = [
        "SETTINGS___SETTING/CROSSHAIR___SETTING/STATIC_URL___SETTING",
        "SETTINGS___SETTING/SNIPER___SETTING/SCOPE_URL___SETTING",
        "SETTINGS___SETTING/BLOCKS___SETTING/TEXTURE_URL___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG1___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG2___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG3___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG4___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG5___SETTING",
        "SETTINGS___SETTING/SKYBOX___SETTING/TEXTURE_IMG6___SETTING",
      ];

      const juiceKeys = ["css_link", "hitmarker_link", "killicon_link"];

      const encodeImage = async (url) => {
        if (!url || url === "") return "";

        try {
          const response = await fetch(url);
          if (!response.ok)
            throw new Error(`Invalid response: ${response.status}`);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error(`Error fetching or converting ${url}:`, error);
        }
      };

      for (const key of localStorageKeys) {
        const url = localStorage.getItem(key).replace(/"/g, "");
        const data = await encodeImage(url);
        localStorage.setItem(key, data);
      }

      for (const key of juiceKeys) {
        const url = this.settings[key];
        const data = await encodeImage(url);
        this.settings[key] = data;
        ipcRenderer.send("update-setting", key, data);

        const event = new CustomEvent("juice-settings-changed", {
          detail: { setting: key, value: this.settings[key] },
        });
        document.dispatchEvent(event);

        this.initMenu();
      }
    });
  }

  initAssets() {
    const TEXTURE_API = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/texture.json";
    const CROSSHAIR_API = "https://raw.githubusercontent.com/imnotkoolkid/KCH/refs/heads/main/data/crosshair.json";
    const TEXTURE_KEY = "SETTINGS___SETTING/BLOCKS___SETTING/TEXTURE_URL___SETTING";
    const CROSSHAIR_KEY = "SETTINGS___SETTING/SNIPER___SETTING/SCOPE_URL___SETTING";

    let textureData = [];
    let crosshairData = [];
    let currentType = "textures";
    let loaded = false;

    const getEls = () => ({
      grid: this.menu.querySelector("#assets-grid"),
      loading: this.menu.querySelector("#assets-loading"),
      tabs: this.menu.querySelectorAll(".assets-tab"),
    });

    const renderGrid = (type) => {
      const { grid } = getEls();
      if (!grid) return;
      grid.innerHTML = "";
      const data = type === "textures" ? textureData : crosshairData;
      const storageKey = type === "textures" ? TEXTURE_KEY : CROSSHAIR_KEY;

      if (!data.length) {
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-box-open"></i><span>No items found</span></div>`;
        return;
      }

      data.forEach((item) => {
        const imgSrc = type === "textures" ? item.textureImage : item.Crosshair;
        if (!imgSrc) return;

        const card = document.createElement("div");
        card.className = "asset-card";
        if (item.label === "featured") card.classList.add("featured");

        card.innerHTML = `
          <div class="asset-img-wrap">
            <img src="${imgSrc}" alt="${item.id}" />
            ${item.label === "featured" ? `<div class="asset-badge"><i class="fas fa-star"></i></div>` : ""}
          </div>
          <div class="asset-info">
            <span class="asset-id">${item.id}</span>
            <span class="asset-owner">${item.owner || "Unknown"}</span>
            ${item.tags && item.tags.length ? `<div class="asset-tags">${item.tags.map(t => `<span class="asset-tag">${t}</span>`).join("")}</div>` : ""}
          </div>
          <button class="asset-apply juice-button">
            <span class="text">Apply</span>
            <div class="custom-border"></div>
          </button>
        `;

        card.querySelector(".asset-apply").addEventListener("click", () => {
          localStorage.setItem(storageKey, JSON.stringify(imgSrc));
          const btn = card.querySelector(".asset-apply .text");
          btn.innerText = "Applied!";
          card.classList.add("applied");

          // Show reload toast
          const existing = this.menu.querySelector("#assets-reload-toast");
          if (!existing) {
            const toast = document.createElement("div");
            toast.id = "assets-reload-toast";
            toast.innerHTML = `
              <i class="fas fa-rotate-right"></i>
              <span>Reload the page for changes to apply</span>
              <button class="toast-reload-btn">Reload</button>
            `;
            this.menu.querySelector("#assets-options").prepend(toast);
            toast.querySelector(".toast-reload-btn").addEventListener("click", () => {
              location.reload();
            });
          }

          setTimeout(() => {
            btn.innerText = "Apply";
            card.classList.remove("applied");
          }, 1500);
        });

        grid.appendChild(card);
      });
    };

    const loadData = async () => {
      const { grid, loading } = getEls();
      if (!grid || !loading) return;

      loading.style.display = "flex";
      grid.style.display = "none";

      try {
        const [texRes, crossRes] = await Promise.all([
          fetch(TEXTURE_API),
          fetch(CROSSHAIR_API),
        ]);
        textureData = await texRes.json();
        crosshairData = await crossRes.json();
        console.log("[Assets] Loaded", textureData.length, "textures,", crosshairData.length, "crosshairs");
      } catch (err) {
        console.error("[Assets] Fetch error:", err);
        loading.style.display = "none";
        grid.style.display = "grid";
        grid.innerHTML = `<div class="assets-empty"><i class="fas fa-triangle-exclamation"></i><span>Failed to load assets</span></div>`;
        return;
      }

      loading.style.display = "none";
      grid.style.display = "grid";
      renderGrid(currentType);

      // Sync the active sub-tab indicator to currentType
      const { tabs } = getEls();
      tabs.forEach(t => {
        t.classList.toggle("active", t.dataset.assetsTab === currentType);
      });
    };

    // Sub-tab switching (Textures / Crosshairs)
    const assetsPanel = this.menu.querySelector("#assets-options");
    if (assetsPanel) {
      assetsPanel.addEventListener("click", (e) => {
        const tab = e.target.closest(".assets-tab");
        if (!tab) return;
        assetsPanel.querySelectorAll(".assets-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentType = tab.dataset.assetsTab;
        renderGrid(currentType);
      });
    }

    // Main tab click — load on first open
    const mainTab = this.menu.querySelector(`[data-tab="assets"]`);
    if (mainTab) {
      mainTab.addEventListener("click", () => {
        if (!loaded) {
          loaded = true;
          loadData();
        }
      });
    }
  }

  createModal(title, description) {
    const modal = document.createElement("div");
    modal.id = "modal";

    modal.innerHTML = `
    <div class="content">
      <div class="close">
        <i class="fas fa-times"></i>
      </div>
      <div class="top">
        <span class="title">${title}</span>
        <span class="description">${description}</span>
      </div>
      <div class="bottom">
      </div>
    </div>
    `;

    const close = modal.querySelector(".close");
    close.addEventListener("click", () => modal.remove());

    modal.addEventListener("click", (e) => {
      if (e.target.id === "modal") modal.remove();
    });

    return modal;
  }
}

module.exports = Menu;
