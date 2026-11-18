
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Website folders
const PUBLIC_DIR = path.join(__dirname, "public");
const GAMES_DIR = path.join(__dirname, "games");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const GAMES_JSON = path.join(DATA_DIR, "games.json");

// Get a game's title from its HTML file
function getGameTitle(filename, html) {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    if (match && match[1].trim()) {
        return match[1]
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .trim();
    }

    return path.basename(filename, path.extname(filename))
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b[a-z]/g, c => c.toUpperCase());
}

// Automatically generate the games catalog
function buildGamesCatalog() {
    fs.mkdirSync(GAMES_DIR, { recursive: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });

    const games = fs.readdirSync(GAMES_DIR, {
        withFileTypes: true
    })
    .filter(file =>
        file.isFile() && /\.(html|htm)$/i.test(file.name)
    )
    .map(file => {
        const filePath = path.join(GAMES_DIR, file.name);
        const html = fs.readFileSync(filePath, "utf8");

        return {
            id: path.basename(file.name, path.extname(file.name)),
            name: getGameTitle(file.name, html),
            description: "Ready to play.",
            category: "Other",
            file: `/games/${encodeURIComponent(file.name)}`
        };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(
        GAMES_JSON,
        JSON.stringify(games, null, 2),
        "utf8"
    );

    console.log(`Loaded ${games.length} games.`);
}

// Serve website files and games directly
app.use(express.static(PUBLIC_DIR));

// Start server
try {
    buildGamesCatalog();

    app.listen(PORT, () => {
        console.log(`Penguins running on port ${PORT}`);
    });
} catch (error) {
    console.error("Failed to start Penguins:", error);
    process.exit(1);
}
