/**
 * Amazon Price Toolbar - Content Script
 * Amazonの商品ページにツールバーを表示し、Keepaグラフとお気に入り機能を提供
 */

(function () {
  'use strict';

  // =============================================
  // 定数定義
  // =============================================
  const PRICE_SELECTORS = [
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#priceblock_saleprice',
    '#corePrice_feature_div .a-offscreen',
    '.a-price-whole'
  ];

  const KEEPA_BASE_URL = 'https://graph.keepa.com/pricehistory.png';
  const KEEPA_DOMAIN = 5; // 日本（Amazon.co.jp）

  const RANGE_OPTIONS = [
    { label: '3ヶ月', value: 90 },
    { label: '1年', value: 365 },
    { label: '全期間', value: 730 }
  ];

  // =============================================
  // ユーティリティ関数
  // =============================================

  /**
   * URLからASINを抽出（10桁の英数字）
   * @returns {string|null} ASIN文字列またはnull
   */
  function getAsinFromUrl() {
    const asinMatch = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    return asinMatch ? asinMatch[1] : null;
  }

  /**
   * 商品ページかどうかを判定
   * @returns {boolean}
   */
  function isProductPage() {
    const url = window.location.href;
    return url.includes('/dp/') || url.includes('/gp/product/');
  }

  /**
   * ページから現在価格を取得
   * @returns {string} 価格文字列
   */
  function getPrice() {
    for (const selector of PRICE_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return '価格取得不可';
  }

  /**
   * 商品タイトルを取得（最大80文字、超過は...で省略）
   * @returns {string}
   */
  function getProductTitle() {
    const titleEl = document.getElementById('productTitle');
    let title = titleEl ? titleEl.textContent.trim() : '商品名不明';
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }
    return title;
  }

  /**
   * KeepaグラフのURL生成
   * @param {string} asin
   * @param {number} range
   * @returns {string}
   */
  function getKeepaGraphUrl(asin, range) {
    return `${KEEPA_BASE_URL}?asin=${asin}&domain=${KEEPA_DOMAIN}&range=${range}&t=${Date.now()}`;
  }

  /**
   * Keepa直接リンクのURL生成
   * @param {string} asin
   * @returns {string}
   */
  function getKeepaDirectUrl(asin) {
    return `https://keepa.com/#!product/${KEEPA_DOMAIN}-${asin}`;
  }

  // =============================================
  // ストレージ操作
  // =============================================

  /**
   * お気に入り一覧を取得
   * @returns {Promise<Array>}
   */
  async function getFavorites() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['favorites'], (result) => {
        resolve(result.favorites || []);
      });
    });
  }

  /**
   * お気に入り一覧を保存
   * @param {Array} favorites
   * @returns {Promise}
   */
  async function saveFavorites(favorites) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ favorites }, resolve);
    });
  }

  /**
   * 現在の商品がお気に入りに登録されているか確認
   * @param {string} asin
   * @returns {Promise<boolean>}
   */
  async function isFavorite(asin) {
    const favorites = await getFavorites();
    return favorites.some((item) => item.asin === asin);
  }

  /**
   * お気に入りにトグル（追加/削除）
   * @param {string} asin
   * @returns {Promise<boolean>} 追加された場合true
   */
  async function toggleFavorite(asin) {
    const favorites = await getFavorites();
    const index = favorites.findIndex((item) => item.asin === asin);

    if (index >= 0) {
      // 削除
      favorites.splice(index, 1);
      await saveFavorites(favorites);
      return false;
    } else {
      // 追加
      const newFavorite = {
        asin: asin,
        title: getProductTitle(),
        url: `https://www.amazon.co.jp/dp/${asin}`,
        price: getPrice(),
        addedAt: new Date().toISOString()
      };
      favorites.push(newFavorite);
      await saveFavorites(favorites);
      return true;
    }
  }

  /**
   * ツールバーの折りたたみ状態を取得
   * @returns {Promise<boolean>}
   */
  async function getToolbarCollapsed() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['toolbarCollapsed'], (result) => {
        resolve(result.toolbarCollapsed || false);
      });
    });
  }

  /**
   * ツールバーの折りたたみ状態を保存
   * @param {boolean} collapsed
   */
  async function saveToolbarCollapsed(collapsed) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ toolbarCollapsed: collapsed }, resolve);
    });
  }

  // =============================================
  // UI作成
  // =============================================

  /**
   * ツールバーを作成
   * @param {string} asin
   * @returns {HTMLElement}
   */
  function createToolbar(asin) {
    const toolbar = document.createElement('div');
    toolbar.id = 'apt-toolbar';
    toolbar.className = 'apt-toolbar';

    // コンテンツコンテナ
    const content = document.createElement('div');
    content.className = 'apt-toolbar-content';

    // ASINバッジ
    const asinBadge = document.createElement('span');
    asinBadge.className = 'apt-badge';
    asinBadge.textContent = `ASIN: ${asin}`;

    // 価格バッジ
    const priceBadge = document.createElement('span');
    priceBadge.className = 'apt-badge apt-price-badge';
    priceBadge.textContent = getPrice();

    // チャートボタン
    const chartButton = document.createElement('button');
    chartButton.className = 'apt-button';
    chartButton.title = '価格推移グラフを表示';
    chartButton.textContent = '📊';
    chartButton.addEventListener('click', () => showModal(asin));

    // お気に入りボタン
    const favoriteButton = document.createElement('button');
    favoriteButton.className = 'apt-button apt-favorite-button';
    favoriteButton.title = 'お気に入りに追加/削除';
    favoriteButton.textContent = '♡';

    // お気に入り状態の初期化
    isFavorite(asin).then((isFav) => {
      updateFavoriteButton(favoriteButton, isFav);
    });

    favoriteButton.addEventListener('click', async () => {
      const added = await toggleFavorite(asin);
      updateFavoriteButton(favoriteButton, added);
      // アニメーション
      favoriteButton.classList.add('apt-favorite-animate');
      setTimeout(() => {
        favoriteButton.classList.remove('apt-favorite-animate');
      }, 300);
    });

    // スペーサー
    const spacer = document.createElement('div');
    spacer.className = 'apt-spacer';

    // 折りたたみボタン
    const collapseButton = document.createElement('button');
    collapseButton.className = 'apt-button apt-collapse-button';
    collapseButton.title = '折りたたみ/展開';
    collapseButton.textContent = '▼';

    collapseButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleToolbarCollapse(toolbar, collapseButton, content);
    });

    // コンテンツに要素を追加
    content.appendChild(asinBadge);
    content.appendChild(priceBadge);
    content.appendChild(chartButton);
    content.appendChild(favoriteButton);
    content.appendChild(spacer);
    content.appendChild(collapseButton);

    toolbar.appendChild(content);

    // 折りたたみ状態の復元と、折りたたみ時のクリックイベント
    getToolbarCollapsed().then((collapsed) => {
      if (collapsed) {
        toolbar.classList.add('collapsed');
        content.style.display = 'none';
        collapseButton.textContent = '▲';
      }
    });

    toolbar.addEventListener('click', (e) => {
      if (toolbar.classList.contains('collapsed')) {
        toggleToolbarCollapse(toolbar, collapseButton, content);
      }
    });

    return toolbar;
  }

  /**
   * お気に入りボタンの表示を更新
   * @param {HTMLElement} button
   * @param {boolean} isFav
   */
  function updateFavoriteButton(button, isFav) {
    if (isFav) {
      button.textContent = '♥';
      button.classList.add('apt-favorite-active');
    } else {
      button.textContent = '♡';
      button.classList.remove('apt-favorite-active');
    }
  }

  /**
   * ツールバーの折りたたみをトグル
   * @param {HTMLElement} toolbar
   * @param {HTMLElement} button
   * @param {HTMLElement} content
   */
  async function toggleToolbarCollapse(toolbar, button, content) {
    const isCollapsed = toolbar.classList.contains('collapsed');

    if (isCollapsed) {
      // 展開
      toolbar.classList.remove('collapsed');
      content.style.display = 'flex';
      button.textContent = '▼';
      await saveToolbarCollapsed(false);
    } else {
      // 折りたたみ
      toolbar.classList.add('collapsed');
      content.style.display = 'none';
      button.textContent = '▲';
      await saveToolbarCollapsed(true);
    }
  }

  // =============================================
  // モーダル関連
  // =============================================

  let currentRange = 365; // デフォルトは1年

  /**
   * モーダルを表示
   * @param {string} asin
   */
  function showModal(asin) {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('apt-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    // オーバーレイ作成
    const overlay = document.createElement('div');
    overlay.id = 'apt-modal-overlay';
    overlay.className = 'apt-modal-overlay';

    // モーダルコンテンツ
    const modalContent = document.createElement('div');
    modalContent.className = 'apt-modal-content';

    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.className = 'apt-modal-close';
    closeButton.textContent = '✕';
    closeButton.addEventListener('click', () => closeModal(overlay));

    // 期間切り替えボタン
    const rangeButtons = document.createElement('div');
    rangeButtons.className = 'apt-range-buttons';

    RANGE_OPTIONS.forEach((option) => {
      const btn = document.createElement('button');
      btn.className = 'apt-range-button';
      if (option.value === currentRange) {
        btn.classList.add('active');
      }
      btn.textContent = option.label;
      btn.addEventListener('click', () => {
        currentRange = option.value;
        // ボタンのアクティブ状態を更新
        rangeButtons.querySelectorAll('.apt-range-button').forEach((b) => {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        // 画像を更新
        loadKeepaGraph(asin, imageContainer);
      });
      rangeButtons.appendChild(btn);
    });

    // 画像コンテナ
    const imageContainer = document.createElement('div');
    imageContainer.className = 'apt-image-container';

    modalContent.appendChild(closeButton);
    modalContent.appendChild(rangeButtons);
    modalContent.appendChild(imageContainer);
    overlay.appendChild(modalContent);

    // オーバーレイクリックで閉じる
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });

    // Escキーで閉じる
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal(overlay);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);

    // アニメーション用に少し遅延させてvisibleクラスを追加
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });

    // グラフを読み込み
    loadKeepaGraph(asin, imageContainer);
  }

  /**
   * モーダルを閉じる
   * @param {HTMLElement} overlay
   */
  function closeModal(overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }

  /**
   * Keepaグラフを読み込み
   * @param {string} asin
   * @param {HTMLElement} container
   * @param {boolean} isRetry
   */
  function loadKeepaGraph(asin, container, isRetry = false) {
    // 読み込み中表示
    container.innerHTML = `
      <div class="apt-loading">
        <div class="apt-spinner"></div>
        <p>読み込み中...</p>
      </div>
    `;

    const img = new Image();
    const graphUrl = getKeepaGraphUrl(asin, currentRange);

    img.onload = () => {
      container.innerHTML = '';
      img.className = 'apt-keepa-graph';
      container.appendChild(img);
    };

    img.onerror = () => {
      if (!isRetry) {
        // 3秒後に1回だけリトライ
        setTimeout(() => {
          loadKeepaGraph(asin, container, true);
        }, 3000);
      } else {
        // リトライも失敗
        const keepaDirectUrl = getKeepaDirectUrl(asin);
        container.innerHTML = `
          <div class="apt-error">
            <p>グラフを読み込めませんでした</p>
            <a href="${keepaDirectUrl}" target="_blank" rel="noopener noreferrer" class="apt-keepa-link">
              Keepaで直接確認する →
            </a>
          </div>
        `;
      }
    };

    img.src = graphUrl;
  }

  // =============================================
  // ページコンテンツのオフセット調整
  // =============================================

  /**
   * ページのbodyにマージンを追加してツールバーの下に表示されるようにする
   */
  function adjustPageContent() {
    const style = document.createElement('style');
    style.id = 'apt-page-offset';
    style.textContent = `
      body {
        margin-top: 48px !important;
      }
      body.apt-toolbar-collapsed {
        margin-top: 8px !important;
      }
    `;
    document.head.appendChild(style);

    // ツールバーの状態監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const toolbar = document.getElementById('apt-toolbar');
          if (toolbar) {
            if (toolbar.classList.contains('collapsed')) {
              document.body.classList.add('apt-toolbar-collapsed');
            } else {
              document.body.classList.remove('apt-toolbar-collapsed');
            }
          }
        }
      });
    });

    // ツールバーが追加されたらobserverを開始
    const checkToolbar = setInterval(() => {
      const toolbar = document.getElementById('apt-toolbar');
      if (toolbar) {
        observer.observe(toolbar, { attributes: true });
        // 初期状態を設定
        if (toolbar.classList.contains('collapsed')) {
          document.body.classList.add('apt-toolbar-collapsed');
        }
        clearInterval(checkToolbar);
      }
    }, 100);
  }

  // =============================================
  // 初期化
  // =============================================

  function init() {
    // 商品ページでなければ何もしない
    if (!isProductPage()) {
      return;
    }

    const asin = getAsinFromUrl();
    if (!asin) {
      return;
    }

    // 既存のツールバーがあれば削除
    const existingToolbar = document.getElementById('apt-toolbar');
    if (existingToolbar) {
      existingToolbar.remove();
    }

    // ページコンテンツのオフセット調整
    if (!document.getElementById('apt-page-offset')) {
      adjustPageContent();
    }

    // ツールバーを作成して挿入
    const toolbar = createToolbar(asin);
    document.body.appendChild(toolbar);
  }

  // DOMContentLoadedまたは既に読み込み済みの場合はすぐに実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // SPAナビゲーション対応（URLの変更を監視）
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // URLが変わったら再初期化
      setTimeout(init, 500);
    }
  }).observe(document, { subtree: true, childList: true });
})();
