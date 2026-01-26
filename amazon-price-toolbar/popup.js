document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('apt-list');
  const emptyEl = document.getElementById('apt-empty');
  const countEl = document.getElementById('apt-count');

  const pad = (value) => String(value).padStart(2, '0');

  const formatDate = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  };

  const render = (favorites) => {
    listEl.innerHTML = '';
    countEl.textContent = `${favorites.length}件`;

    if (favorites.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';

    favorites.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'apt-card';

      const titleLink = document.createElement('a');
      titleLink.className = 'apt-title';
      titleLink.href = item.url || '#';
      titleLink.textContent = item.title || '商品名不明';
      titleLink.addEventListener('click', (event) => {
        event.preventDefault();
        if (item.url) {
          chrome.tabs.create({ url: item.url });
        }
      });

      const meta = document.createElement('div');
      meta.className = 'apt-meta';

      const price = document.createElement('span');
      price.className = 'apt-price';
      price.textContent = item.price || '価格取得不可';

      const date = document.createElement('span');
      date.className = 'apt-date';
      date.textContent = formatDate(item.addedAt);

      meta.appendChild(price);
      meta.appendChild(date);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'apt-delete';
      deleteButton.type = 'button';
      deleteButton.textContent = '🗑';
      deleteButton.setAttribute('aria-label', 'お気に入りから削除');
      deleteButton.addEventListener('click', () => {
        removeFavorite(item.asin);
      });

      card.appendChild(titleLink);
      card.appendChild(meta);
      card.appendChild(deleteButton);
      listEl.appendChild(card);
    });
  };

  const loadFavorites = () => {
    chrome.storage.local.get({ favorites: [] }, (result) => {
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      render(favorites);
    });
  };

  const removeFavorite = (asin) => {
    chrome.storage.local.get({ favorites: [] }, (result) => {
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      const updated = favorites.filter((item) => item.asin !== asin);
      chrome.storage.local.set({ favorites: updated }, () => {
        render(updated);
      });
    });
  };

  loadFavorites();
});
