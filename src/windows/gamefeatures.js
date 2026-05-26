const { initGameFeatures } = (() => {
  let gameWindowRef = null;
  let isInjected = false;

  const buildScript = () => {
    return `
      (function() {
        if (window.__fullFeaturesInstalled) return;
        window.__fullFeaturesInstalled = true;
        
        let customIdMapping = {};
        let subnamesData = null;
        let subnameIsProcessing = false;
        let subnameInterval = null;
        
        // Background API variables
        const BANNER_API_URL = "https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/Banner.json";
        let bannerData = [];
        let appliedElements = new Map();
        let bgInterval = null;
        
        async function fetchCustomIdMappings() {
          try {
            const r = await fetch("https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/customids.json");
            if (!r.ok) throw new Error();
            const data = await r.json();
            data.forEach(item => {
              if (item.custom && Array.isArray(item.custom)) {
                item.custom.forEach(customId => {
                  customIdMapping[customId.toUpperCase()] = item.shortId;
                });
              }
            });
            console.log('[CustomID] Loaded', Object.keys(customIdMapping).length, 'mappings');
            return true;
          } catch (err) { 
            console.error('[CustomID] Failed to load mappings');
            return false; 
          }
        }
        
        async function fetchSubnamesData() {
          try {
            const r = await fetch("https://raw.githubusercontent.com/OBS-Akuma/KirkaBadges/refs/heads/main/Json/subnames.json");
            if (!r.ok) throw new Error();
            subnamesData = await r.json();
            console.log('[Subnames] Loaded data');
            return true;
          } catch { 
            console.error('[Subnames] Failed to load data');
            return false; 
          }
        }
        
        // Background API functions
        async function fetchBannerData() {
          try {
            const response = await fetch(BANNER_API_URL);
            bannerData = await response.json();
            console.log('[Background] Loaded banner data:', bannerData.length, 'items');
            return true;
          } catch (error) {
            console.error('[Background] Failed to load banner data:', error);
            return false;
          }
        }
        
        function getIdFromURL() {
          const match = window.location.pathname.match(/\\/profile\\/([^\\/?#]+)/);
          if (match) {
            return match[1];
          }
          return null;
        }
        
        function findBannerById(id) {
          if (!id) return null;
          return bannerData.find(b => b.shortid === id || b.longid === id);
        }
        
        function getShortIdFromElement(element) {
          // Try to get ID from friend-id element
          const idElement = element.querySelector('.friend-id');
          if (idElement) {
            const id = idElement.textContent.trim();
            console.log('[Background] Found friend-id:', id);
            return id;
          }
          
          // Try from profile URL
          const urlId = getIdFromURL();
          if (urlId) {
            console.log('[Background] Found URL ID:', urlId);
            return urlId;
          }
          
          return null;
        }
        
        function preserveProgressBar(element) {
          const progressLines = element.querySelectorAll('.progress-line');
          progressLines.forEach(progressLine => {
            progressLine.style.cssText = progressLine.style.cssText;
            progressLine.style.removeProperty('backdrop-filter');
            progressLine.style.removeProperty('background');
            progressLine.style.removeProperty('background-color');
            
            const innerProgress = progressLine.querySelector('.progress');
            if (innerProgress) {
              innerProgress.style.removeProperty('backdrop-filter');
              innerProgress.style.removeProperty('background');
              innerProgress.style.removeProperty('background-color');
            }
          });
        }
        
        function applyBackground(element, shortId, imageUrl) {
          if (appliedElements.has(element)) {
            console.log('[Background] Already applied to element:', shortId);
            return;
          }
          
          console.log('[Background] Applying background for:', shortId, imageUrl);
          
          appliedElements.set(element, { shortId, imageUrl });
          element.setAttribute('data-bg-applied', shortId);
          
          // Apply background to main element
          element.style.backgroundImage = \`url('\${imageUrl}')\`;
          element.style.backgroundSize = 'cover';
          element.style.backgroundPosition = 'center center';
          element.style.backgroundRepeat = 'no-repeat';
          element.style.backgroundColor = 'transparent';
          
          // Make all child divs transparent with blur
          const allDivs = element.querySelectorAll('div');
          allDivs.forEach(div => {
            // Skip progress line and avatar
            if (div.classList.contains('progress-line') || div.classList.contains('avatar')) {
              return;
            }
            if (div.closest('.progress-line')) return;
            if (div.closest('.avatar')) return;
            
            div.style.backgroundColor = 'transparent !important';
            div.style.background = 'transparent !important';
            div.style.backdropFilter = 'blur(2px)';
          });
          
          // Specific container handling
          const containers = [
            '.friend-left', '.friend-right', '.level-cont', '.friend-desc',
            '.player-cont', '.you', '.you-head', '.content', '.top-medium',
            '.top', '.card', '.medium', '.statistics', '.bottom',
            '.profile-cont', '.profile-holder', '.statistic', '.stat-name',
            '.stat-value', '.progress-text-cont', '.progress-level', '.progress-exp'
          ];
          
          containers.forEach(selector => {
            const elements = element.querySelectorAll(selector);
            elements.forEach(el => {
              if (el.closest('.progress-line')) return;
              if (el.closest('.avatar')) return;
              el.style.backgroundColor = 'transparent';
              el.style.background = 'transparent';
              el.style.backdropFilter = 'blur(2px)';
            });
          });
          
          preserveProgressBar(element);
        }
        
        function scanAndApplyBackgrounds() {
          if (!bannerData || bannerData.length === 0) {
            console.log('[Background] No banner data available yet');
            return;
          }
          
          console.log('[Background] Scanning for elements...');
          
          // Apply to friends list
          const friends = document.querySelectorAll('.friend');
          console.log('[Background] Found friends:', friends.length);
          
          friends.forEach(friend => {
            const shortId = getShortIdFromElement(friend);
            if (shortId) {
              const banner = bannerData.find(b => b.shortid === shortId);
              if (banner && !appliedElements.has(friend)) {
                applyBackground(friend, shortId, banner.image);
              } else if (banner) {
                console.log('[Background] Already applied to friend:', shortId);
              }
            }
          });
          
          // Apply to profile page
          const profileContainer = document.querySelector('.profile-cont, .profile-holder');
          if (profileContainer && !appliedElements.has(profileContainer)) {
            const urlId = getIdFromURL();
            if (urlId) {
              const banner = findBannerById(urlId);
              if (banner) {
                applyBackground(profileContainer, banner.shortid, banner.image);
              } else {
                console.log('[Background] No banner found for profile ID:', urlId);
              }
            }
          }
        }
        
        function maintainBackgroundEffects() {
          // Re-apply transparency to elements that have backgrounds
          appliedElements.forEach((data, element) => {
            if (element && document.body.contains(element)) {
              const allDivs = element.querySelectorAll('div');
              allDivs.forEach(div => {
                if (div.classList.contains('progress-line') || div.classList.contains('avatar')) {
                  return;
                }
                if (div.closest('.progress-line')) return;
                if (div.closest('.avatar')) return;
                
                div.style.backgroundColor = 'transparent';
                div.style.background = 'transparent';
                div.style.backdropFilter = 'blur(2px)';
              });
              preserveProgressBar(element);
            } else {
              appliedElements.delete(element);
            }
          });
        }
        
        function navigateToProfile(shortId) {
          const newUrl = '/profile/' + shortId;
          if (window.location.pathname !== newUrl) {
            console.log('[CustomID] Redirecting to:', newUrl);
            window.location.href = newUrl;
          }
        }
        
        function blockUserNotFound() {
          const alertElement = document.querySelector(".alert-default.wnNmMWwW, [class*='alert-default']");
          if (alertElement) {
            const textSpan = alertElement.querySelector(".text");
            if (textSpan && textSpan.textContent === "User not found") {
              alertElement.style.display = "none";
              alertElement.remove();
              return true;
            }
          }
          return false;
        }
        
        async function checkAndRedirectCustomId() {
          if (Object.keys(customIdMapping).length === 0) await fetchCustomIdMappings();
        
          const currentPath = window.location.pathname;
          let profileId = null;
        
          if (currentPath.startsWith("/profile/")) profileId = currentPath.split("/").pop().toUpperCase();
          else if (currentPath.startsWith("/custom/")) profileId = currentPath.split("/").pop().toUpperCase();
        
          if (profileId && customIdMapping[profileId]) {
            const realId = customIdMapping[profileId];
            blockUserNotFound();
            const closeBtn = document.querySelector("[data-v-da7c34da].close");
            if (closeBtn) closeBtn.click();
            setTimeout(() => navigateToProfile(realId), 100);
            return true;
          }
          return false;
        }
        
        function watchUserNotFoundAlerts() {
          new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                const alert = node.matches?.(".alert-default.wnNmMWwW") ? node : node.querySelector?.(".alert-default.wnNmMWwW");
                if (alert) {
                  const textSpan = alert.querySelector(".text");
                  if (textSpan && textSpan.textContent === "User not found") {
                    blockUserNotFound();
                    checkAndRedirectCustomId();
                  }
                }
              });
            });
          }).observe(document.body, { childList: true, subtree: true });
        }
        
        function patchFetchForCustomIds() {
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const url = args[0];
            return originalFetch.apply(this, args).then(response => {
              const cloned = response.clone();
              if (typeof url === "string" && (url.includes("/profile") || url.includes("/api/"))) {
                cloned.json().then(data => {
                  if (data && (data.error === "User not found" || data.message === "User not found" || !data.wMWWm)) {
                    setTimeout(() => { blockUserNotFound(); checkAndRedirectCustomId(); }, 50);
                  }
                }).catch(() => {});
              }
              return response;
            });
          };
        }
        
        async function injectProfileSubname() {
          const valueElement = document.querySelector(".card-profile .copy-cont .value");
          if (!valueElement) return;
          
          const text = valueElement.textContent.trim();
          const currentId = text.startsWith("#") ? text.substring(1) : text;
          if (!currentId) return;
          
          const subname = subnamesData?.find(item => item.id === currentId)?.subname;
          if (!subname) return;
          
          const existing = valueElement.parentNode.querySelector(".kirka-subname-profile");
          if (existing && existing.textContent === \` (\${subname})\`) return;
          if (existing) existing.remove();
          
          const span = document.createElement("span");
          span.className = "kirka-subname-profile";
          span.textContent = \` (\${subname})\`;
          span.style.cssText = "color: #888888 !important; font-size: 0.9rem !important; font-weight: normal !important; display: inline-block !important; margin-left: 4px !important;";
          valueElement.insertAdjacentElement("afterend", span);
        }
        
        async function injectFriendSubnames() {
          for (const friend of document.querySelectorAll(".friend")) {
            const friendIdEl = friend.querySelector(".friend-desc .friend-id");
            if (!friendIdEl) continue;
            
            const shortId = friendIdEl.textContent.trim();
            if (!shortId) continue;
            
            const subname = subnamesData?.find(item => item.id === shortId)?.subname;
            if (!subname) continue;
            
            const parent = friendIdEl.parentNode;
            const existing = parent.querySelector(".kirka-subname-friend");
            if (existing && existing.textContent === \` (\${subname})\`) continue;
            if (existing) existing.remove();
            
            const span = document.createElement("span");
            span.className = "kirka-subname-friend";
            span.textContent = \` (\${subname})\`;
            span.style.cssText = "color: #888888 !important; font-size: 0.8rem !important; font-weight: normal !important; display: inline-block !important; margin-left: 4px !important;";
            friendIdEl.insertAdjacentElement("afterend", span);
          }
        }
        
        async function injectAllSubnames() {
          if (!subnamesData) { 
            await fetchSubnamesData(); 
            if (!subnamesData) return; 
          }
          if (subnameIsProcessing) return;
          
          subnameIsProcessing = true;
          try {
            if (location.href.includes("/profile/")) await injectProfileSubname();
            if (location.href.includes("/friends")) await injectFriendSubnames();
          } catch (e) {}
          subnameIsProcessing = false;
        }
        
        function startSubnamePersistence() {
          if (subnameInterval) clearInterval(subnameInterval);
          subnameInterval = setInterval(() => {
            if (location.href.includes("/profile/") || location.href.includes("/friends")) {
              injectAllSubnames();
            }
          }, 500);
        }
        
        async function initBackgrounds() {
          console.log('[Background] Initializing...');
          const success = await fetchBannerData();
          if (success) {
            console.log('[Background] Banner data loaded, starting scans');
            // Initial scan
            setTimeout(() => {
              scanAndApplyBackgrounds();
            }, 500);
            
            // Periodic scan for new elements
            if (bgInterval) clearInterval(bgInterval);
            bgInterval = setInterval(() => {
              scanAndApplyBackgrounds();
              maintainBackgroundEffects();
            }, 2000);
          }
        }
        
        // Navigation handling
        let lastUrl = window.location.href;
        setInterval(() => {
          const currentUrl = window.location.href;
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            console.log('[Navigation] URL changed to:', currentUrl);
            setTimeout(() => {
              checkAndRedirectCustomId();
              injectAllSubnames();
              scanAndApplyBackgrounds();
            }, 100);
          }
          blockUserNotFound();
        }, 500);
        
        const originalPushState = history.pushState;
        history.pushState = function() {
          originalPushState.apply(this, arguments);
          setTimeout(() => {
            checkAndRedirectCustomId();
            injectAllSubnames();
            scanAndApplyBackgrounds();
          }, 100);
        };
        
        window.addEventListener('popstate', () => {
          setTimeout(() => {
            checkAndRedirectCustomId();
            injectAllSubnames();
            scanAndApplyBackgrounds();
          }, 100);
        });
        
        // Watch for dynamically added friend elements
        const domObserver = new MutationObserver(() => {
          scanAndApplyBackgrounds();
        });
        domObserver.observe(document.body, { childList: true, subtree: true });
        
        // Initialize everything
        watchUserNotFoundAlerts();
        patchFetchForCustomIds();
        fetchCustomIdMappings();
        fetchSubnamesData();
        initBackgrounds();
        
        setTimeout(() => {
          checkAndRedirectCustomId();
          injectAllSubnames();
        }, 500);
        
        startSubnamePersistence();
        
        console.log('[GameFeatures] All systems initialized (Custom ID, Subname, Backgrounds)');
      })();
    `;
  };

  const injectScript = () => {
    if (!gameWindowRef || gameWindowRef.isDestroyed()) return;
    
    gameWindowRef.webContents.executeJavaScript(buildScript())
      .then(() => {
        console.log('[GameFeatures] Features injected successfully');
        isInjected = true;
      })
      .catch((err) => {
        console.error('[GameFeatures] Injection failed:', err);
      });
  };

  const initGameFeatures = (gameWindow) => {
    if (!gameWindow) {
      console.error('[GameFeatures] No game window provided');
      return;
    }
    
    gameWindowRef = gameWindow;
    
    const inject = () => {
      setTimeout(injectScript, 1000);
    };
    
    if (gameWindow.webContents.isLoading()) {
      gameWindow.webContents.once('did-finish-load', inject);
    } else {
      inject();
    }
    
    gameWindow.webContents.on('did-navigate', inject);
    gameWindow.webContents.on('did-navigate-in-page', inject);
  };

  return { initGameFeatures };
})();

module.exports = { initGameFeatures };