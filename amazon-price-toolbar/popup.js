// お気に入り一覧を読み込み、カード形式で表示する
const listEl = document.getElementById("apt-list");
const emptyEl = document.getElementById("apt-empty");
const countEl = document.getElementById("apt-count");

const formatDate = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const renderFavorites = (favorites) => {
  listEl.innerHTML = "";
  countEl.textContent = `${favorites.length}件`;

  if (favorites.length === 0) {
    emptyEl.style.display = "block";
    return;
  }

  emptyEl.style.display = "none";

  favorites.forEach((item) => {
    const card = document.createElement("div");
    card.className = "apt-card";

    const titleLink = document.createElement("a");
    titleLink.className = "apt-card-title";
    titleLink.href = item.url;
    titleLink.target = "_blank";
    titleLink.rel = "noreferrer";
    titleLink.textContent = item.title || "商品名不明";

    const meta = document.createElement("div");
    meta.className = "apt-card-meta";

    const price = document.createElement("span");
    price.textContent = item.price || "価格取得不可";

    const date = document.createElement("span");
    date.textContent = formatDate(item.addedAt);

    meta.append(price, date);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "apt-delete-button";
    deleteButton.title = "削除";
    deleteButton.textContent = "🗑";
    deleteButton.addEventListener("click", () => {
      removeFavorite(item.asin);
    });

    card.append(titleLink, meta, deleteButton);
    listEl.appendChild(card);
  });
};

const loadFavorites = () => {
  chrome.storage.local.get(["favorites"], (result) => {
    const favorites = Array.isArray(result.favorites) ? result.favorites : [];
    renderFavorites(favorites);
  });
};

const removeFavorite = (asin) => {
  chrome.storage.local.get(["favorites"], (result) => {
    const favorites = Array.isArray(result.favorites) ? result.favorites : [];
    const updated = favorites.filter((item) => item.asin !== asin);
    chrome.storage.local.set({ favorites: updated }, () => {
      renderFavorites(updated);
    });
  });
};

loadFavorites();
