(() => {
  const isProductPage = /\/(dp|gp\/product)\//.test(window.location.href);
  if (!isProductPage) {
    return;
  }

  const asinMatch = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  const asin = asinMatch ? asinMatch[1] : null;
  if (!asin) {
    return;
  }

  const priceSelectors = [
    ".a-price .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    "#priceblock_saleprice",
    "#corePrice_feature_div .a-offscreen",
    ".a-price-whole"
  ];

  const keepaDirectUrl = `https://keepa.com/#!product/5-${asin}`;
  const graphBaseUrl = "https://graph.keepa.com/pricehistory.png";

  const init = () => {
    if (document.querySelector(".apt-toolbar")) {
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "apt-toolbar";
    toolbar.setAttribute("role", "region");
    toolbar.setAttribute("aria-label", "Amazon Price Toolbar");

    const asinBadge = document.createElement("span");
    asinBadge.className = "apt-badge apt-hide-when-collapsed";
    asinBadge.textContent = `ASIN: ${asin}`;

    const priceBadge = document.createElement("span");
    priceBadge.className = "apt-badge apt-hide-when-collapsed";
    priceBadge.textContent = getPrice();

    const chartButton = document.createElement("button");
    chartButton.type = "button";
    chartButton.className = "apt-button apt-hide-when-collapsed";
    chartButton.textContent = "📊";
    chartButton.title = "Keepaチャートを表示";

    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "apt-button apt-favorite-button apt-hide-when-collapsed";
    favoriteButton.textContent = "♡";
    favoriteButton.title = "お気に入りに追加";

    const collapseButton = document.createElement("button");
    collapseButton.type = "button";
    collapseButton.className = "apt-button apt-collapse-button";
    collapseButton.textContent = "▼";
    collapseButton.title = "折りたたみ";

    toolbar.append(asinBadge, priceBadge, chartButton, favoriteButton, collapseButton);
    document.body.prepend(toolbar);

    let isCollapsed = false;

    const applyCollapsedState = (collapsed) => {
      isCollapsed = collapsed;
      toolbar.classList.toggle("collapsed", collapsed);
      collapseButton.textContent = collapsed ? "▲" : "▼";
      collapseButton.title = collapsed ? "展開" : "折りたたみ";
    };

    const setCollapsed = (collapsed) => {
      applyCollapsedState(collapsed);
      chrome.storage.local.set({ toolbarCollapsed: collapsed });
    };

    chrome.storage.local.get(["toolbarCollapsed"], (result) => {
      applyCollapsedState(Boolean(result.toolbarCollapsed));
    });

    collapseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setCollapsed(!isCollapsed);
    });

    toolbar.addEventListener("click", () => {
      if (isCollapsed) {
        setCollapsed(false);
      }
    });

    favoriteButton.addEventListener("animationend", () => {
      favoriteButton.classList.remove("apt-favorite-animate");
    });

    const updateFavoriteButton = (isFavorited) => {
      favoriteButton.textContent = isFavorited ? "♥" : "♡";
      favoriteButton.classList.toggle("active", isFavorited);
      favoriteButton.title = isFavorited ? "お気に入りから削除" : "お気に入りに追加";
    };

    getFavorites((favorites) => {
      const isFavorited = favorites.some((item) => item.asin === asin);
      updateFavoriteButton(isFavorited);
    });

    favoriteButton.addEventListener("click", () => {
      getFavorites((favorites) => {
        const index = favorites.findIndex((item) => item.asin === asin);
        if (index >= 0) {
          favorites.splice(index, 1);
          saveFavorites(favorites, () => updateFavoriteButton(false));
          return;
        }

        const newFavorite = {
          asin,
          title: getTitle(),
          url: `https://www.amazon.co.jp/dp/${asin}`,
          price: getPrice(),
          addedAt: new Date().toISOString()
        };

        favorites.unshift(newFavorite);
        saveFavorites(favorites, () => {
          updateFavoriteButton(true);
          favoriteButton.classList.remove("apt-favorite-animate");
          void favoriteButton.offsetWidth;
          favoriteButton.classList.add("apt-favorite-animate");
        });
      });
    });

    chartButton.addEventListener("click", () => {
      openModal();
    });
  };

  const getPrice = () => {
    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return "価格取得不可";
  };

  const getTitle = () => {
    const titleEl = document.getElementById("productTitle");
    let title = titleEl ? titleEl.textContent.trim() : "商品名不明";
    if (title.length > 80) {
      title = `${title.substring(0, 77)}...`;
    }
    return title;
  };

  const getFavorites = (callback) => {
    chrome.storage.local.get(["favorites"], (result) => {
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      callback(favorites);
    });
  };

  const saveFavorites = (favorites, callback) => {
    chrome.storage.local.set({ favorites }, () => {
      if (callback) {
        callback();
      }
    });
  };

  let modalOverlay = null;
  let modalVisible = false;
  let currentRange = 365;
  let retryTimer = null;
  let retryCount = 0;

  const buildGraphUrl = (range) => {
    const params = `?asin=${asin}&domain=5&range=${range}&t=${Date.now()}`;
    return `${graphBaseUrl}${params}`;
  };

  const createModal = () => {
    const overlay = document.createElement("div");
    overlay.className = "apt-modal-overlay";

    const content = document.createElement("div");
    content.className = "apt-modal-content";
    content.setAttribute("role", "dialog");
    content.setAttribute("aria-modal", "true");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "apt-modal-close";
    closeButton.textContent = "✕";
    closeButton.title = "閉じる";

    const rangeContainer = document.createElement("div");
    rangeContainer.className = "apt-range-buttons";

    const ranges = [
      { label: "3ヶ月", value: 90 },
      { label: "1年", value: 365 },
      { label: "全期間", value: 730 }
    ];

    const rangeButtons = new Map();

    ranges.forEach((range) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "apt-range-button";
      button.textContent = range.label;
      button.dataset.range = String(range.value);
      button.addEventListener("click", () => {
        setRange(range.value);
      });
      rangeButtons.set(range.value, button);
      rangeContainer.appendChild(button);
    });

    const body = document.createElement("div");
    body.className = "apt-modal-body";

    const loading = document.createElement("div");
    loading.className = "apt-loading";

    const spinner = document.createElement("div");
    spinner.className = "apt-spinner";

    const loadingText = document.createElement("div");
    loadingText.className = "apt-loading-text";
    loadingText.textContent = "読み込み中...";

    loading.append(spinner, loadingText);

    const error = document.createElement("div");
    error.className = "apt-error apt-hidden";

    const errorTitle = document.createElement("div");
    errorTitle.className = "apt-error-title";
    errorTitle.textContent = "グラフを読み込めませんでした";

    const errorLink = document.createElement("a");
    errorLink.href = keepaDirectUrl;
    errorLink.target = "_blank";
    errorLink.rel = "noreferrer";
    errorLink.textContent = "Keepaで直接確認する →";

    error.append(errorTitle, errorLink);

    const graphImage = document.createElement("img");
    graphImage.className = "apt-graph-image apt-hidden";
    graphImage.alt = "Keepa価格推移グラフ";

    body.append(loading, error, graphImage);
    content.append(closeButton, rangeContainer, body);
    overlay.appendChild(content);

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    const setRange = (range) => {
      currentRange = range;
      rangeButtons.forEach((button, value) => {
        button.classList.toggle("active", value === range);
      });
      startLoad(false);
    };

    const showLoading = (message) => {
      loadingText.textContent = message;
      loading.classList.remove("apt-hidden");
      error.classList.add("apt-hidden");
      graphImage.classList.add("apt-hidden");
    };

    const showImage = () => {
      loading.classList.add("apt-hidden");
      error.classList.add("apt-hidden");
      graphImage.classList.remove("apt-hidden");
    };

    const showError = () => {
      loading.classList.add("apt-hidden");
      graphImage.classList.add("apt-hidden");
      error.classList.remove("apt-hidden");
    };

    const startLoad = (isRetry) => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }

      if (!isRetry) {
        retryCount = 0;
      }

      showLoading(isRetry ? "再読み込み中..." : "読み込み中...");
      graphImage.src = buildGraphUrl(currentRange);
    };

    graphImage.addEventListener("load", () => {
      showImage();
    });

    graphImage.addEventListener("error", () => {
      if (retryCount < 1) {
        retryCount += 1;
        showLoading("再読み込み中...");
        retryTimer = window.setTimeout(() => {
          startLoad(true);
        }, 3000);
        return;
      }
      showError();
    });

    closeButton.addEventListener("click", () => {
      closeModal();
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });

    overlay.addEventListener("transitionend", () => {
      if (!modalVisible) {
        overlay.remove();
        document.removeEventListener("keydown", handleEscape);
        modalOverlay = null;
      }
    });

    const open = () => {
      modalVisible = true;
      document.body.appendChild(overlay);
      document.addEventListener("keydown", handleEscape);
      requestAnimationFrame(() => {
        overlay.classList.add("visible");
      });
      setRange(365);
    };

    const close = () => {
      modalVisible = false;
      overlay.classList.remove("visible");
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    return { open, close };
  };

  const openModal = () => {
    if (!modalOverlay) {
      modalOverlay = createModal();
    }
    modalOverlay.open();
  };

  const closeModal = () => {
    if (modalOverlay) {
      modalOverlay.close();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
