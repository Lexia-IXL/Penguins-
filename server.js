
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");
const GAMES_DIR = path.join(__dirname, "games");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const CATALOG_FILE = path.join(DATA_DIR, "games.json");

// Game thumbnail matches
const GAME_IMAGES = {
  "10-minutes-till-dawn-seraph": "https://cdn.cloudflare.steamstatic.com/steam/apps/1888430/library_600x900.jpg",
  "2048": "https://upload.wikimedia.org/wikipedia/commons/1/18/2048_logo.svg",
  "a-dark-room": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Black_square.svg/512px-Black_square.svg.png",
  "bad-ice-cream-2": "https://www.coolmathgames.com/sites/default/files/styles/mobile_game_image/public/BadIceCream2_OG-logo.jpg",
  "bad-ice-cream-3": "https://www.coolmathgames.com/sites/default/files/styles/mobile_game_image/public/BadIceCream3_OG-logo.jpg",
  "basket-bros": "https://basketbros.io/images/logo.png"
};

function getGameImage(filename) {
  const id = path.basename(filename, path.extname(filename)).toLowerCase();
  return GAME_IMAGES[id] || "/assets/game-placeholder.svg";
}

function cleanTitle(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function scanGames() {
  if (!fs.existsSync(GAMES_DIR)) {
    console.log("Games folder not found:", GAMES_DIR);
    return [];
  }

  const files = fs.readdirSync(GAMES_DIR, { withFileTypes: true });
  const games = [];

  for (const item of files) {
    if (!item.isFile() || !/\.(html|htm)$/i.test(item.name)) {
      continue;
    }

    const filename = item.name;
    const id = path.basename(filename, path.extname(filename))
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-");

    games.push({
      id,
      name: cleanTitle(filename),
      description: "Ready to play.",
      category: "Other",
      file: "/games/" + encodeURIComponent(filename),
      image: getGameImage(filename)
    });
  }

  games.sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(games, null, 2));

  console.log(`Loaded ${games.length} games.`);
  return games;
}

// Serve website files
app.use(express.static(PUBLIC_DIR));

// Serve your games from the root-level /games folder
app.use("/games", express.static(GAMES_DIR));

// Game catalog
app.get("/data/games.json", (req, res) => {
  const games = scanGames();
  res.json(games);
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    games: scanGames().length
  });
});

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Start server
scanGames();

app.listen(PORT, () => {
  console.log(`Penguins is running on port ${PORT}`);
});
