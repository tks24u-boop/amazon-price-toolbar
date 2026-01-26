// Amazon Price Toolbar - Content Script
// Amazon.co.jpの商品ページにツールバーを表示し、Keepaグラフとお気に入り機能を提供

(function() {
  'use strict';

  // URLからASINを抽出（10桁の英数字）
  const asinMatch = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  const asin = asinMatch ? asinMatch[1] : null;

  // ASINが取得できない場合（商品ページ以外）は処理を終了
  if (!asin) {
    return;
  }

  // 価格取得用セレクタ（優先順位順）
  const priceSelectors = [
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#priceblock_saleprice',
    '#corePrice_feature_div .a-offscreen',
    '.a-price-whole'
  ];

  /**
   * ページから現在価格を取得する
   * @returns {string} 価格文字列または「価格取得不可」
   */
  function getPrice() {
    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return '価格取得不可';
  }

  /**
   * 商品タイトルを取得する（最大80文字）
   * @returns {string} 商品タイトル
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
   * 現在のASINがお気に入りに登録されているかチェック
   * @returns {Promise<boolean>}
   */
  async function isFavorite() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['favorites'], (result) => {
        const favorites = result.favorites || [];
        resolve(favorites.some(item => item.asin === asin));
      });
    });
  }

  /**
   * お気に入りのトグル（追加/削除）
   * @returns {Promise<boolean>} 新しい状態（true: 登録済み, false: 未登録）
   */
  async function toggleFavorite() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['favorites'], (result) => {
        let favorites = result.favorites || [];
        const existingIndex = favorites.findIndex(item => item.asin === asin);

        if (existingIndex !== -1) {
          // 既に登録済みの場合は削除
          favorites.splice(existingIndex, 1);
          chrome.storage.local.set({ favorites }, () => {
            resolve(false);
          });
        } else {
          // 未登録の場合は追加
          const newFavorite = {
            asin: asin,
            title: getProductTitle(),
            url: `https://www.amazon.co.jp/dp/${asin}`,
            price: getPrice(),
            addedAt: new Date().toISOString()
          };
          favorites.push(newFavorite);
          chrome.storage.local.set({ favorites }, () => {
            resolve(true);
          });
        }
      });
    });
  }

  /**
   * Keepaグラフの画像URLを生成
   * @param {number} range - 表示期間（日数）
   * @returns {string} 画像URL
   */
  function getKeepaGraphUrl(range) {
    const baseUrl = 'https://graph.keepa.com/pricehistory.png';
    const params = `?asin=${asin}&domain=5&range=${range}&t=${Date.now()}`;
    return baseUrl + params;
  }

  /**
   * Keepaの商品ページURLを生成
   * @returns {string} KeepaのURL
   */
  function getKeepaDirectUrl() {
    return `https://keepa.com/#!product/5-${asin}`;
  }

  /**
   * ツールバー要素を作成
   * @returns {HTMLElement}
   */
  function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'apt-toolbar';
    toolbar.className = 'apt-toolbar';

    // ツールバーの内部コンテンツ
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
    chartButton.className = 'apt-button apt-chart-button';
    chartButton.innerHTML = '📊';
    chartButton.title = '価格推移グラフを表示';
    chartButton.addEventListener('click', showModal);

    // お気に入りボタン
    const favoriteButton = document.createElement('button');
    favoriteButton.className = 'apt-button apt-favorite-button';
    favoriteButton.title = 'お気に入りに追加/削除';
    
    // 初期状態の設定
    isFavorite().then(isFav => {
      updateFavoriteButton(favoriteButton, isFav);
    });

    favoriteButton.addEventListener('click', async () => {
      const newState = await toggleFavorite();
      updateFavoriteButton(favoriteButton, newState);
      
      // 登録時のアニメーション
      if (newState) {
        favoriteButton.classList.add('apt-favorite-animation');
        setTimeout(() => {
          favoriteButton.classList.remove('apt-favorite-animation');
        }, 300);
      }
    });

    // 折りたたみボタン
    const collapseButton = document.createElement('button');
    collapseButton.className = 'apt-button apt-collapse-button';
    collapseButton.innerHTML = '▼';
    collapseButton.title = 'ツールバーを折りたたむ';
    collapseButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleToolbarCollapse(toolbar, collapseButton);
    });

    // 要素を追加
    content.appendChild(asinBadge);
    content.appendChild(priceBadge);
    content.appendChild(chartButton);
    content.appendChild(favoriteButton);
    content.appendChild(collapseButton);

    toolbar.appendChild(content);

    // 折りたたみ時のクリックで展開
    toolbar.addEventListener('click', (e) => {
      if (toolbar.classList.contains('collapsed') && e.target === toolbar) {
        toggleToolbarCollapse(toolbar, collapseButton);
      }
    });

    return toolbar;
  }

  /**
   * お気に入りボタンの表示を更新
   * @param {HTMLElement} button
   * @param {boolean} isFavorite
   */
  function updateFavoriteButton(button, isFavorite) {
    if (isFavorite) {
      button.innerHTML = '♥';
      button.classList.add('apt-favorited');
    } else {
      button.innerHTML = '♡';
      button.classList.remove('apt-favorited');
    }
  }

  /**
   * ツールバーの折りたたみ状態をトグル
   * @param {HTMLElement} toolbar
   * @param {HTMLElement} collapseButton
   */
  function toggleToolbarCollapse(toolbar, collapseButton) {
    const isCollapsed = toolbar.classList.toggle('collapsed');
    collapseButton.innerHTML = isCollapsed ? '▲' : '▼';
    collapseButton.title = isCollapsed ? 'ツールバーを展開' : 'ツールバーを折りたたむ';
    
    // 状態を保存
    chrome.storage.local.set({ toolbarCollapsed: isCollapsed });
  }

  /**
   * モーダルを表示（Keepaグラフ）
   */
  function showModal() {
    // 既存のモーダルがあれば削除
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
    closeButton.innerHTML = '✕';
    closeButton.addEventListener('click', closeModal);

    // 期間切り替えボタン
    const rangeButtons = document.createElement('div');
    rangeButtons.className = 'apt-range-buttons';

    const ranges = [
      { label: '3ヶ月', value: 90 },
      { label: '1年', value: 365 },
      { label: '全期間', value: 730 }
    ];

    let currentRange = 365; // デフォルトは1年

    ranges.forEach(range => {
      const btn = document.createElement('button');
      btn.className = 'apt-range-button';
      btn.textContent = range.label;
      btn.dataset.range = range.value;
      
      if (range.value === currentRange) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        // 全てのボタンからactiveを削除
        rangeButtons.querySelectorAll('.apt-range-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRange = range.value;
        loadGraph(range.value);
      });

      rangeButtons.appendChild(btn);
    });

    // 画像コンテナ
    const imageContainer = document.createElement('div');
    imageContainer.className = 'apt-image-container';

    // 読み込み中表示
    const loadingEl = document.createElement('div');
    loadingEl.className = 'apt-loading';
    loadingEl.innerHTML = '<div class="apt-spinner"></div><span>読み込み中...</span>';
    imageContainer.appendChild(loadingEl);

    // グラフ画像
    const graphImage = document.createElement('img');
    graphImage.className = 'apt-graph-image';
    graphImage.style.display = 'none';

    // エラー表示
    const errorEl = document.createElement('div');
    errorEl.className = 'apt-error';
    errorEl.style.display = 'none';
    errorEl.innerHTML = `
      <p>グラフを読み込めませんでした</p>
      <a href="${getKeepaDirectUrl()}" target="_blank" rel="noopener noreferrer">
        Keepaで直接確認する →
      </a>
    `;

    imageContainer.appendChild(graphImage);
    imageContainer.appendChild(errorEl);

    /**
     * グラフを読み込む
     * @param {number} range - 表示期間
     * @param {boolean} isRetry - リトライかどうか
     */
    function loadGraph(range, isRetry = false) {
      loadingEl.style.display = 'flex';
      graphImage.style.display = 'none';
      errorEl.style.display = 'none';

      graphImage.onload = () => {
        loadingEl.style.display = 'none';
        graphImage.style.display = 'block';
        errorEl.style.display = 'none';
      };

      graphImage.onerror = () => {
        if (!isRetry) {
          // 3秒後にリトライ（1回のみ）
          setTimeout(() => {
            loadGraph(range, true);
          }, 3000);
        } else {
          // リトライも失敗
          loadingEl.style.display = 'none';
          graphImage.style.display = 'none';
          errorEl.style.display = 'block';
        }
      };

      graphImage.src = getKeepaGraphUrl(range);
    }

    // 要素を組み立て
    modalContent.appendChild(closeButton);
    modalContent.appendChild(rangeButtons);
    modalContent.appendChild(imageContainer);
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);

    // アニメーション開始
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });

    // 初期グラフ読み込み
    loadGraph(currentRange);

    // オーバーレイクリックで閉じる
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Escキーで閉じる
    document.addEventListener('keydown', handleEscKey);
  }

  /**
   * Escキーのハンドラー
   * @param {KeyboardEvent} e
   */
  function handleEscKey(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  /**
   * モーダルを閉じる
   */
  function closeModal() {
    const overlay = document.getElementById('apt-modal-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }
    document.removeEventListener('keydown', handleEscKey);
  }

  /**
   * 初期化処理
   */
  function init() {
    // ツールバーを作成して挿入
    const toolbar = createToolbar();
    document.body.insertBefore(toolbar, document.body.firstChild);

    // ツールバーの高さ分だけbodyにパディングを追加
    document.body.style.paddingTop = '48px';

    // 折りたたみ状態を復元
    chrome.storage.local.get(['toolbarCollapsed'], (result) => {
      if (result.toolbarCollapsed) {
        const collapseButton = toolbar.querySelector('.apt-collapse-button');
        toolbar.classList.add('collapsed');
        if (collapseButton) {
          collapseButton.innerHTML = '▲';
          collapseButton.title = 'ツールバーを展開';
        }
        document.body.style.paddingTop = '8px';
      }
    });

    // 折りたたみ状態の変更を監視してパディングを調整
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isCollapsed = toolbar.classList.contains('collapsed');
          document.body.style.paddingTop = isCollapsed ? '8px' : '48px';
        }
      });
    });

    observer.observe(toolbar, { attributes: true });
  }

  // DOMの準備ができたら初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
