/**
 * Amazon Price Toolbar - Popup Script
 * お気に入り一覧の表示と管理
 */

(function () {
  'use strict';

  // DOM要素
  const contentEl = document.getElementById('content');
  const countEl = document.getElementById('count');

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
   * 日付をYYYY/MM/DD形式にフォーマット
   * @param {string} isoDate
   * @returns {string}
   */
  function formatDate(isoDate) {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * お気に入りを削除
   * @param {string} asin
   */
  async function deleteFavorite(asin) {
    const favorites = await getFavorites();
    const newFavorites = favorites.filter((item) => item.asin !== asin);
    await saveFavorites(newFavorites);
    render();
  }

  /**
   * 商品カードを作成
   * @param {Object} item
   * @returns {HTMLElement}
   */
  function createProductCard(item) {
    const card = document.createElement('div');
    card.className = 'product-card';

    // タイトル（リンク）
    const title = document.createElement('a');
    title.className = 'product-title';
    title.textContent = item.title;
    title.href = item.url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.title = 'お気に入りから削除';
    deleteBtn.textContent = '🗑';
    deleteBtn.addEventListener('click', () => {
      deleteFavorite(item.asin);
    });

    // メタ情報
    const meta = document.createElement('div');
    meta.className = 'product-meta';

    const price = document.createElement('span');
    price.className = 'product-price';
    price.textContent = item.price;

    const date = document.createElement('span');
    date.className = 'product-date';
    date.textContent = formatDate(item.addedAt);

    meta.appendChild(price);
    meta.appendChild(date);

    card.appendChild(title);
    card.appendChild(deleteBtn);
    card.appendChild(meta);

    return card;
  }

  /**
   * 空の状態を表示
   * @returns {HTMLElement}
   */
  function createEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '♡';

    const text = document.createElement('p');
    text.textContent = 'お気に入りに登録された商品はありません';

    empty.appendChild(icon);
    empty.appendChild(text);

    return empty;
  }

  /**
   * 一覧を描画
   */
  async function render() {
    const favorites = await getFavorites();

    // 件数を更新
    countEl.textContent = `${favorites.length}件`;

    // コンテンツをクリア
    contentEl.innerHTML = '';

    if (favorites.length === 0) {
      // 空の状態を表示
      contentEl.appendChild(createEmptyState());
    } else {
      // 商品カードを追加（新しい順）
      const sortedFavorites = [...favorites].sort(
        (a, b) => new Date(b.addedAt) - new Date(a.addedAt)
      );

      sortedFavorites.forEach((item) => {
        contentEl.appendChild(createProductCard(item));
      });
    }
  }

  // 初期描画
  render();
})();
