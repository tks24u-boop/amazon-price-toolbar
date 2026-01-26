// Amazon Price Toolbar - Popup Script
// お気に入り一覧の表示と管理

(function() {
  'use strict';

  // DOM要素
  const contentEl = document.getElementById('content');
  const countEl = document.getElementById('count');

  /**
   * 日付をYYYY/MM/DD形式にフォーマット
   * @param {string} isoString - ISO形式の日付文字列
   * @returns {string} フォーマット済み日付
   */
  function formatDate(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * お気に入り一覧を取得
   * @returns {Promise<Array>}
   */
  function getFavorites() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['favorites'], (result) => {
        resolve(result.favorites || []);
      });
    });
  }

  /**
   * お気に入りから商品を削除
   * @param {string} asin - 削除するASIN
   * @returns {Promise<void>}
   */
  function removeFavorite(asin) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['favorites'], (result) => {
        let favorites = result.favorites || [];
        favorites = favorites.filter(item => item.asin !== asin);
        chrome.storage.local.set({ favorites }, resolve);
      });
    });
  }

  /**
   * 商品カード要素を作成
   * @param {Object} product - 商品データ
   * @returns {HTMLElement}
   */
  function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';

    // 商品情報
    const info = document.createElement('div');
    info.className = 'product-info';

    // 商品タイトル（リンク）
    const title = document.createElement('a');
    title.className = 'product-title';
    title.href = product.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.textContent = product.title;
    title.title = product.title;

    // メタ情報（価格・日付）
    const meta = document.createElement('div');
    meta.className = 'product-meta';

    const price = document.createElement('span');
    price.className = 'product-price';
    price.textContent = product.price;

    const date = document.createElement('span');
    date.className = 'product-date';
    date.textContent = formatDate(product.addedAt);

    meta.appendChild(price);
    meta.appendChild(date);

    info.appendChild(title);
    info.appendChild(meta);

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.innerHTML = '🗑';
    deleteBtn.title = 'お気に入りから削除';
    deleteBtn.addEventListener('click', async () => {
      await removeFavorite(product.asin);
      render();
    });

    card.appendChild(info);
    card.appendChild(deleteBtn);

    return card;
  }

  /**
   * 空の状態を表示
   * @returns {HTMLElement}
   */
  function createEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">♡</div>
      <p>お気に入りに登録された商品はありません</p>
    `;
    return empty;
  }

  /**
   * 画面を描画
   */
  async function render() {
    const favorites = await getFavorites();

    // 件数を更新
    countEl.textContent = `${favorites.length}件`;

    // コンテンツをクリア
    contentEl.innerHTML = '';

    if (favorites.length === 0) {
      // 空の状態
      contentEl.appendChild(createEmptyState());
    } else {
      // 商品リスト
      const list = document.createElement('div');
      list.className = 'favorites-list';

      // 新しい順（追加日時の降順）でソート
      favorites.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

      favorites.forEach(product => {
        list.appendChild(createProductCard(product));
      });

      contentEl.appendChild(list);
    }
  }

  // 初期描画
  render();
})();
