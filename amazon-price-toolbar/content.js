(() => {
  // URLからASINを抽出（10桁の英数字）
  const asinMatch = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  const asin = asinMatch ? asinMatch[1] : null;
  if (!asin || document.getElementById('apt-toolbar')) {
    return;
  }

  // 優先順位で試行し、最初に見つかった価格を使用
  const priceSelectors = [
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#priceblock_saleprice',
    '#corePrice_feature_div .a-offscreen',
    '.a-price-whole'
  ];

  function getPrice() {
    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return '価格取得不可';
  }

  function getTitle() {
    const titleEl = document.getElementById('productTitle');
    let title = titleEl ? titleEl.textContent.trim() : '商品名不明';
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }
    return title;
  }

  function getFavorites(callback) {
    chrome.storage.local.get({ favorites: [] }, (result) => {
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      callback(favorites);
    });
  }

  function setFavorites(favorites, callback) {
    chrome.storage.local.set({ favorites }, () => {
      if (callback) {
        callback();
      }
    });
  }

  // ツールバーを作成
  const toolbar = document.createElement('div');
  toolbar.id = 'apt-toolbar';
  toolbar.className = 'apt-toolbar';

  const asinBadge = document.createElement('div');
  asinBadge.className = 'apt-badge';
  asinBadge.textContent = `ASIN: ${asin}`;

  const priceBadge = document.createElement('div');
  priceBadge.className = 'apt-badge';
  priceBadge.textContent = getPrice();

  const chartButton = document.createElement('button');
  chartButton.className = 'apt-button apt-chart-button';
  chartButton.type = 'button';
  chartButton.textContent = '📊';
  chartButton.title = 'Keepaグラフを表示';

  const favoriteButton = document.createElement('button');
  favoriteButton.className = 'apt-button apt-favorite-button';
  favoriteButton.type = 'button';
  favoriteButton.title = 'お気に入りに追加/解除';

  const collapseButton = document.createElement('button');
  collapseButton.className = 'apt-button apt-collapse-button';
  collapseButton.type = 'button';
  collapseButton.textContent = '▼';
  collapseButton.title = 'ツールバーを折りたたむ';

  toolbar.appendChild(asinBadge);
  toolbar.appendChild(priceBadge);
  toolbar.appendChild(chartButton);
  toolbar.appendChild(favoriteButton);
  toolbar.appendChild(collapseButton);
  document.body.appendChild(toolbar);

  // 価格は遅延読み込みされる場合があるため再取得する
  const updatePrice = () => {
    priceBadge.textContent = getPrice();
  };
  setTimeout(updatePrice, 1500);
  setTimeout(updatePrice, 4000);

  // 折りたたみ状態の管理
  let isCollapsed = false;
  const applyCollapsedState = (collapsed) => {
    isCollapsed = collapsed;
    toolbar.classList.toggle('collapsed', collapsed);
    collapseButton.textContent = collapsed ? '▲' : '▼';
    collapseButton.title = collapsed ? 'ツールバーを展開' : 'ツールバーを折りたたむ';
  };
  const setCollapsed = (collapsed, persist = true) => {
    applyCollapsedState(collapsed);
    if (persist) {
      chrome.storage.local.set({ toolbarCollapsed: collapsed });
    }
  };

  collapseButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setCollapsed(!isCollapsed);
  });

  toolbar.addEventListener('click', () => {
    if (isCollapsed) {
      setCollapsed(false);
    }
  });

  chrome.storage.local.get(['toolbarCollapsed'], (result) => {
    if (result.toolbarCollapsed) {
      setCollapsed(true, false);
    }
  });

  // お気に入り状態の反映
  const updateFavoriteButton = (isFavorite) => {
    favoriteButton.textContent = isFavorite ? '♥' : '♡';
    favoriteButton.classList.toggle('apt-favorite-active', isFavorite);
  };

  getFavorites((favorites) => {
    updateFavoriteButton(favorites.some((item) => item.asin === asin));
  });

  favoriteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    getFavorites((favorites) => {
      const exists = favorites.some((item) => item.asin === asin);
      if (exists) {
        const updated = favorites.filter((item) => item.asin !== asin);
        setFavorites(updated, () => updateFavoriteButton(false));
        return;
      }
      const newItem = {
        asin,
        title: getTitle(),
        url: `https://www.amazon.co.jp/dp/${asin}`,
        price: getPrice(),
        addedAt: new Date().toISOString()
      };
      const updated = [newItem, ...favorites];
      setFavorites(updated, () => {
        updateFavoriteButton(true);
        favoriteButton.classList.add('apt-favorite-animate');
      });
    });
  });

  favoriteButton.addEventListener('animationend', () => {
    favoriteButton.classList.remove('apt-favorite-animate');
  });

  // Keepaモーダル
  let modal = null;
  let loadToken = 0;
  let retryTimeoutId = null;

  const rangeOptions = [
    { label: '3ヶ月', value: 90 },
    { label: '1年', value: 365 },
    { label: '全期間', value: 730 }
  ];

  const buildGraphUrl = (range) => {
    const baseUrl = 'https://graph.keepa.com/pricehistory.png';
    const params = `?asin=${asin}&domain=5&range=${range}&t=${Date.now()}`;
    return baseUrl + params;
  };

  const keepaDirectUrl = `https://keepa.com/#!product/5-${asin}`;

  const createModal = () => {
    const overlay = document.createElement('div');
    overlay.className = 'apt-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const content = document.createElement('div');
    content.className = 'apt-modal-content';

    const closeButton = document.createElement('button');
    closeButton.className = 'apt-modal-close';
    closeButton.type = 'button';
    closeButton.textContent = '✕';
    closeButton.title = '閉じる';

    const rangeContainer = document.createElement('div');
    rangeContainer.className = 'apt-range-buttons';

    const loadingEl = document.createElement('div');
    loadingEl.className = 'apt-loading';
    loadingEl.innerHTML = '<span class="apt-spinner"></span><span>読み込み中...</span>';

    const errorEl = document.createElement('div');
    errorEl.className = 'apt-error';
    const errorText = document.createElement('div');
    errorText.textContent = 'グラフを読み込めませんでした';
    const keepaLink = document.createElement('a');
    keepaLink.href = keepaDirectUrl;
    keepaLink.textContent = 'Keepaで直接確認する →';
    keepaLink.target = '_blank';
    keepaLink.rel = 'noopener noreferrer';
    errorEl.appendChild(errorText);
    errorEl.appendChild(keepaLink);

    const image = document.createElement('img');
    image.className = 'apt-graph-image';
    image.alt = 'Keepa価格推移グラフ';

    content.appendChild(closeButton);
    content.appendChild(rangeContainer);
    content.appendChild(loadingEl);
    content.appendChild(errorEl);
    content.appendChild(image);
    overlay.appendChild(content);

    const rangeButtons = rangeOptions.map((option) => {
      const button = document.createElement('button');
      button.className = 'apt-range-button';
      button.type = 'button';
      button.textContent = option.label;
      button.addEventListener('click', () => {
        setActiveRange(option.value);
        loadGraph(option.value, false);
      });
      rangeContainer.appendChild(button);
      return { value: option.value, button };
    });

    const setActiveRange = (range) => {
      rangeButtons.forEach(({ value, button }) => {
        button.classList.toggle('active', value === range);
      });
    };

    const showLoading = () => {
      loadingEl.style.display = 'flex';
      errorEl.style.display = 'none';
      image.style.display = 'none';
    };

    const showImage = () => {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'none';
      image.style.display = 'block';
    };

    const showError = () => {
      loadingEl.style.display = 'none';
      image.style.display = 'none';
      errorEl.style.display = 'flex';
    };

    const loadGraph = (range, retried) => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      loadToken += 1;
      const currentToken = loadToken;
      showLoading();
      const url = buildGraphUrl(range);
      image.onload = () => {
        if (currentToken !== loadToken) {
          return;
        }
        showImage();
      };
      image.onerror = () => {
        if (currentToken !== loadToken) {
          return;
        }
        if (!retried) {
          retryTimeoutId = setTimeout(() => {
            loadGraph(range, true);
          }, 3000);
          return;
        }
        showError();
      };
      image.src = url;
    };

    const closeModal = () => {
      overlay.classList.remove('visible');
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
      document.removeEventListener('keydown', handleKeydown);
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    closeButton.addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });

    return {
      overlay,
      setActiveRange,
      loadGraph,
      attach() {
        if (!document.body.contains(overlay)) {
          document.body.appendChild(overlay);
          requestAnimationFrame(() => overlay.classList.add('visible'));
          document.addEventListener('keydown', handleKeydown);
        }
      }
    };
  };

  const ensureModal = () => {
    if (!modal) {
      modal = createModal();
    }
    return modal;
  };

  chartButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const modalInstance = ensureModal();
    modalInstance.attach();
    modalInstance.setActiveRange(365);
    modalInstance.loadGraph(365, false);
  });
})();
