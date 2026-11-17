const pages = ["home", "games", "websites"];
const navButtons = [...document.querySelectorAll(".nav-link")];

function showPage(name) {
  if (!pages.includes(name)) name = "home";
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
  navButtons.forEach(button => button.classList.toggle("active", button.dataset.page === name));
  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
navButtons.forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.go)));

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

const gamesGrid = document.getElementById("games-grid");
const websitesGrid = document.getElementById("websites-grid");
const gameSearch = document.getElementById("game-search");
const websiteSearch = document.getElementById("website-search");
const categorySelect = document.getElementById("game-category");
let games = [];
let websites = [];

function safeImage(src, alt) {
  const img = document.createElement("img");
  img.src = src || "assets/game-placeholder.svg";
  img.alt = alt || "";
  img.loading = "lazy";
  img.onerror = () => { img.remove(); };
  return img;
}

function createGameCard(game) {
  const card = document.createElement("article");
  card.className = "game-card";
  const cover = document.createElement("div");
  cover.className = "game-cover";
  cover.append(safeImage(game.image, game.name));
  const info = document.createElement("div");
  info.className = "card-info";
  const title = document.createElement("h3"); title.textContent = game.name || "Untitled game";
  const description = document.createElement("p"); description.textContent = game.description || "Ready to play.";
  const bottom = document.createElement("div"); bottom.className = "card-bottom";
  const tag = document.createElement("span"); tag.className = "category-tag"; tag.textContent = game.category || "Game";
  const play = document.createElement("button"); play.className = "play-button"; play.textContent = "PLAY ↗";
  play.addEventListener("click", () => openGame(game));
  bottom.append(tag, play); info.append(title, description, bottom); card.append(cover, info);
  return card;
}

function createWebsiteCard(site) {
  const card = document.createElement("article");
  card.className = "website-card";
  const cover = document.createElement("div"); cover.className = "website-cover";
  cover.append(safeImage(site.image || "assets/site-placeholder.svg", site.name));
  const info = document.createElement("div"); info.className = "card-info";
  const title = document.createElement("h3"); title.textContent = site.name || "Untitled website";
  const description = document.createElement("p"); description.textContent = site.description || "Your website goes here.";
  const bottom = document.createElement("div"); bottom.className = "card-bottom";
  const tag = document.createElement("span"); tag.className = "category-tag"; tag.textContent = "WEBSITE";
  const open = document.createElement("button"); open.className = "open-button"; open.textContent = "OPEN ↗";
  open.addEventListener("click", () => {
    if (!site.url) return;
    const isExternal = /^https?:\/\//i.test(site.url);
    if (isExternal) window.open(site.url, "_blank", "noopener,noreferrer");
    else window.location.href = site.url;
  });
  bottom.append(tag, open); info.append(title, description, bottom); card.append(cover, info);
  return card;
}

function renderGames() {
  const term = gameSearch.value.trim().toLowerCase();
  const category = categorySelect.value;
  const filtered = games.filter(game =>
    `${game.name} ${game.description} ${game.category}`.toLowerCase().includes(term) &&
    (category === "all" || (game.category || "Other") === category)
  );
  gamesGrid.replaceChildren(...filtered.map(createGameCard));
  document.getElementById("game-count").textContent = `${filtered.length} GAME${filtered.length === 1 ? "" : "S"}`;
  document.getElementById("games-empty").hidden = filtered.length !== 0;
}

function renderWebsites() {
  const term = websiteSearch.value.trim().toLowerCase();
  const filtered = websites.filter(site => `${site.name} ${site.description}`.toLowerCase().includes(term));
  websitesGrid.replaceChildren(...filtered.map(createWebsiteCard));
  document.getElementById("website-count").textContent = `${filtered.length} SITE${filtered.length === 1 ? "" : "S"}`;
  document.getElementById("websites-empty").hidden = filtered.length !== 0;
}

function openGame(game) {
  if (!game.file) return;
  const overlay = document.getElementById("player-overlay");
  const frame = document.getElementById("game-frame");
  document.getElementById("player-title").textContent = game.name || "Game";
  frame.src = game.file;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeGame() {
  const overlay = document.getElementById("player-overlay");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.getElementById("game-frame").src = "about:blank";
  document.body.style.overflow = "";
}
document.getElementById("player-close").addEventListener("click", closeGame);
document.getElementById("player-reload").addEventListener("click", () => {
  const frame = document.getElementById("game-frame"); frame.src = frame.src;
});
document.getElementById("player-fullscreen").addEventListener("click", async () => {
  const frame = document.getElementById("game-frame");
  if (frame.requestFullscreen) await frame.requestFullscreen();
});
document.addEventListener("keydown", event => { if (event.key === "Escape") closeGame(); });
gameSearch.addEventListener("input", renderGames);
websiteSearch.addEventListener("input", renderWebsites);
categorySelect.addEventListener("change", renderGames);

async function init() {
  [games, websites] = await Promise.all([
    loadJson("data/games.json", []),
    loadJson("data/websites.json", [])
  ]);
  const categories = [...new Set(games.map(game => game.category || "Other"))].sort();
  categories.forEach(category => {
    const option = document.createElement("option"); option.value = category; option.textContent = category;
    categorySelect.append(option);
  });
  renderGames();
  renderWebsites();
  const initial = location.hash.replace("#", "");
  if (pages.includes(initial)) showPage(initial);
}
init();