
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");
const GAMES_DIR = path.join(__dirname, "games");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const CATALOG_FILE = path.join(DATA_DIR, "games.json");

// Verified game screenshots and artwork.
// These are real image files, not generated placeholders.
const GAME_ART = {
  "2048":
    "https://rycellgames.github.io/static/images/games/2048.webp",

  "adarkroom":
    "https://rycellgames.github.io/static/images/games/adarkroom.webp",

  "badicecream2":
    "https://rycellgames.github.io/static/images/games/badicecream2.webp",

  "basketbros":
    "https://rycellgames.github.io/static/images/games/basketbros.webp",

  "blockblast":
    "https://rycellgames.github.io/static/images/games/blockblast.webp",

  "blockblastpuzzle":
    "https://rycellgames.github.io/static/images/games/blockblast.webp",

  "crazycattle3d":
    "https://rycellgames.github.io/static/images/games/crazycattle3d.webp",

  "cookieclicker":
    "https://rycellgames.github.io/static/images/games/cookieclicker.webp"
};

// Normalize names so filenames and titles can match.
function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Find verified artwork by filename or game title.
function findCuratedArtwork(filename, title) {
  const filenameKey = normalizeName(
    path.basename(filename, path.extname(filename))
  );

  const titleKey = normalizeName(title);

  // Exact matches first.
  if (GAME_ART[filenameKey]) return GAME_ART[filenameKey];
  if (GAME_ART[titleKey]) return GAME_ART[titleKey];

  // Handle filenames such as cookieclickergood.html.
  const aliases = [
    "cookieclicker",
    "blockblast",
    "badicecream2",
    "basketbros",
    "crazycattle3d",
    "adarkroom"
  ];

  for (const alias of aliases) {
    if (
      filenameKey.includes(alias) ||
      titleKey.includes(alias)
    ) {
      return GAME_ART[alias];
    }
  }

  return null;
}

// Read an HTML attribute.
function getAttribute(tag, attribute) {
  const match = tag.match(
    new RegExp(
      attribute + "\\s*=\\s*([\"'])(.*?)\\1",
      "i"
    )
  );

  return match ? match[2].trim() : "";
}

// Look for existing images included with a game.
function findGameImage(filename) {
  const fullPath = path.join(GAMES_DIR, filename);

  let html;

  try {
    html = fs.readFileSync(fullPath, "utf8");
  } catch {
    return null;
  }

  const candidates = [];

  // Social preview images.
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const property =
      getAttribute(tag, "property").toLowerCase() ||
      getAttribute(tag, "name").toLowerCase();

    if (
      property === "og:image" ||
      property === "og:image:url" ||
      property === "twitter:image" ||
      property === "twitter:image:src"
    ) {
      const content = getAttribute(tag, "content");
      if (content) candidates.push(content);
    }
  }

  // Link-based images.
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];

  for (const tag of linkTags) {
    const rel = getAttribute(tag, "rel").toLowerCase();

    if (rel.includes("image_src")) {
      const href = getAttribute(tag, "href");
      if (href) candidates.push(href);
    }
  }

  // Images already included in the HTML.
  const imageTags = html.match(/<img\b[^>]*>/gi) || [];

  for (const tag of imageTags) {
    const src =
      getAttribute(tag, "src") ||
      getAttribute(tag, "data-src") ||
      getAttribute(tag, "data-original");

    if (src) candidates.push(src);
  }

  for (let src of candidates) {
    src = src.trim();

    if (
      !src ||
      src.startsWith("#") ||
      src.startsWith("javascript:")
    ) {
      continue;
    }

    if (src.startsWith("data:image/")) {
      return src;
    }

    if (/^https?:\/\//i.test(src)) {
      return src;
    }

    if (src.startsWith("//")) {
      return "https:" + src;
    }

    try {
      const cleanSrc = decodeURIComponent(
        src.split("?")[0].split("#")[0]
      );

      const relativePath = path.normalize(
        path.join(path.dirname(filename), cleanSrc)
      );

      const absolutePath = path.resolve(
        GAMES_DIR,
        relativePath
      );

      if (
        absolutePath.startsWith(GAMES_DIR + path.sep) &&
        fs.existsSync(absolutePath) &&
        fs.statSync(absolutePath).isFile()
      ) {
        return "/games/" +
          relativePath
            .split(path.sep)
            .map(encodeURIComponent)
            .join("/");
      }
    } catch {
      continue;
    }
  }

  return null;
}

// Read the game title.
function getGameTitle(filename) {
  const fullPath = path.join(GAMES_DIR, filename);

  try {
    const html = fs.readFileSync(fullPath, "utf8");
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    if (match) {
      return match[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }
  } catch {}

  return path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

// Generate a unique ID.
function getGameId(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
}

// Build the game catalog.
function scanGames() {
  if (!fs.existsSync(GAMES_DIR)) {
    console.log("Games folder not found:", GAMES_DIR);
    return [];
  }

  const files = fs.readdirSync(GAMES_DIR, {
    withFileTypes: true
  });

  const games = [];

  for (const item of files) {
    if (
      !item.isFile() ||
      !/\.(html|htm)$/i.test(item.name)
    ) {
      continue;
    }

    const filename = item.name;
    const id = getGameId(filename);
    const name = getGameTitle(filename);

    // Use verified artwork first.
    // Then check the game's own files.
    // No fake generated artwork.
    const image =
      findCuratedArtwork(filename, name) ||
      findGameImage(filename) ||
      null;

    games.push({
      id,
      name,
      description: "Ready to play.",
      category: "Other",
      file: "/games/" + encodeURIComponent(filename),
      image
    });
  }

  games.sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(
    CATALOG_FILE,
    JSON.stringify(games, null, 2)
  );

  const artworkCount = games.filter(game => game.image).length;

  console.log(`Loaded ${games.length} games.`);
  console.log(`${artworkCount} games have artwork.`);

  return games;
}

// Game catalog.
app.get("/data/games.json", (req, res) => {
  res.json(scanGames());
});

// Serve the website.
app.use(express.static(PUBLIC_DIR));

// Serve games from the root-level games folder.
app.use("/games", express.static(GAMES_DIR));

// Health check.
app.get("/health", (req, res) => {
  const games = scanGames();

  res.json({
    status: "ok",
    games: games.length,
    gamesWithArtwork: games.filter(game => game.image).length,
    message: "Penguins game server is running."
  });
});

// Start server.
scanGames();

app.listen(PORT, () => {
  console.log(`Penguins is running on port ${PORT}`);
});
