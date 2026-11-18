
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");
const GAMES_DIR = path.join(__dirname, "games");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const CATALOG_FILE = path.join(DATA_DIR, "games.json");

// Escape text before placing it inside SVG artwork.
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

// Find a usable image inside a game's HTML.
function findGameImage(filename) {
  const fullPath = path.join(GAMES_DIR, filename);

  let html;

  try {
    html = fs.readFileSync(fullPath, "utf8");
  } catch {
    return null;
  }

  const candidates = [];

  // Open Graph and social preview images.
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

  // Link-based preview images.
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];

  for (const tag of linkTags) {
    const rel = getAttribute(tag, "rel").toLowerCase();

    if (rel.includes("image_src")) {
      const href = getAttribute(tag, "href");
      if (href) candidates.push(href);
    }
  }

  // Images used inside the game page.
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

    // Embedded image.
    if (src.startsWith("data:image/")) {
      return src;
    }

    // External image.
    if (/^https?:\/\//i.test(src)) {
      return src;
    }

    // Protocol-relative image.
    if (src.startsWith("//")) {
      return "https:" + src;
    }

    // Local image included with the game files.
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
        relativePath.split(path.sep).map(encodeURIComponent).join("/");
    }
  }

  return null;
}

// Read the title from the HTML when available.
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

// Generate a unique ID from a filename.
function getGameId(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
}

// Create the complete game catalog.
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

    const image = findGameImage(filename);

    games.push({
      id,
      name,
      description: "Ready to play.",
      category: "Other",
      file: "/games/" + encodeURIComponent(filename),

      // Use the game's own artwork when available.
      // Otherwise use an automatically generated Penguins cover.
      image: image || "/game-covers/" + encodeURIComponent(id) + ".svg"
    });
  }

  games.sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(
    CATALOG_FILE,
    JSON.stringify(games, null, 2)
  );

  console.log(`Loaded ${games.length} games.`);
  console.log(
    `${games.filter(game => !game.image.includes("/game-covers/")).length} games have detected artwork.`
  );

  return games;
}

// Game catalog endpoint.
app.get("/data/games.json", (req, res) => {
  res.json(scanGames());
});

// Automatically generated fallback covers.
app.get("/game-covers/:id.svg", (req, res) => {
  const games = scanGames();

  const game = games.find(
    item => item.id === req.params.id
  );

  if (!game) {
    return res.status(404).send("Game not found");
  }

  const title = escapeXml(game.name);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="640"
       height="360"
       viewBox="0 0 640 360">

    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#102d25"/>
        <stop offset="100%" stop-color="#07130f"/>
      </linearGradient>

      <radialGradient id="glow">
        <stop offset="0%" stop-color="#36d399" stop-opacity=".35"/>
        <stop offset="100%" stop-color="#36d399" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="640" height="360" fill="url(#bg)"/>

    <circle cx="500" cy="100" r="240" fill="url(#glow)"/>

    <path d="M0 290 L640 190 L640 360 L0 360Z"
          fill="#36d399" opacity=".08"/>

    <rect x="26" y="26" width="588" height="308"
          rx="20" fill="none"
          stroke="#36d399" stroke-opacity=".35"/>

    <text x="320" y="145"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="24"
          font-weight="bold"
          letter-spacing="7"
          fill="#36d399">
      PENGUINS
    </text>

    <text x="320" y="205"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="30"
          font-weight="bold"
          fill="#ffffff">
      ${title.length > 27 ? title.slice(0, 27) + "…" : title}
    </text>

    <text x="320" y="260"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="15"
          letter-spacing="4"
          fill="#a5b8af">
      CLICK TO PLAY
    </text>

  </svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(svg);
});

// Serve the website.
app.use(express.static(PUBLIC_DIR));

// Serve the games from the root-level games folder.
app.use("/games", express.static(GAMES_DIR));

// Health check.
app.get("/health", (req, res) => {
  const games = scanGames();

  res.json({
    status: "ok",
    games: games.length,
    message: "Penguins game server is running."
  });
});

// Start server.
scanGames();

app.listen(PORT, () => {
  console.log(`Penguins is running on port ${PORT}`);
});
