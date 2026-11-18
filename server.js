
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// FOLDER LOCATIONS
// ==========================================

const PUBLIC_DIR = path.join(__dirname, "public");
const GAMES_DIR = path.join(__dirname, "games");
const DATA_DIR = path.join(PUBLIC_DIR, "data");
const GAMES_JSON = path.join(DATA_DIR, "games.json");

// ==========================================
// GET GAME TITLE
// ==========================================

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

// ==========================================
// GENERATE GAMES LIST
// ==========================================

function buildGamesCatalog() {
    fs.mkdirSync(GAMES_DIR, { recursive: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });

    const files = fs.readdirSync(GAMES_DIR, {
        withFileTypes: true
    });

    const games = [];

    for (const file of files) {
        if (
            !file.isFile() ||
            !/\.(html|htm)$/i.test(file.name)
        ) {
            continue;
        }

        const filePath = path.join(GAMES_DIR, file.name);

        try {
            const html = fs.readFileSync(filePath, "utf8");

            games.push({
                id: path.basename(file.name, path.extname(file.name)),
                name: getGameTitle(file.name, html),
                description: "Ready to play.",
                category: "Other",
                file: `/games/${encodeURIComponent(file.name)}`
            });

        } catch (error) {
            console.error(`Could not read ${file.name}:`, error.message);
        }
    }

    games.sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(
        GAMES_JSON,
        JSON.stringify(games, null, 2),
        "utf8"
    );

    console.log(`Successfully loaded ${games.length} games.`);
}

// ==========================================
// WEBSITE FILES
// ==========================================

app.use(express.static(PUBLIC_DIR));

// ==========================================
// GAME FILES
// IMPORTANT: GAMES ARE OUTSIDE PUBLIC
// ==========================================

app.use(
    "/games",
    express.static(GAMES_DIR, {
        extensions: ["html", "htm"],
        index: false
    })
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {
    res.json({
        status: "online",
        games: fs.existsSync(GAMES_JSON)
            ? JSON.parse(fs.readFileSync(GAMES_JSON, "utf8")).length
            : 0
    });
});

// ==========================================
// START SERVER
// ==========================================

try {
    buildGamesCatalog();

    app.listen(PORT, () => {
        console.log("--------------------------------");
        console.log("PENGUINS SERVER ONLINE");
        console.log("Website:", PORT);
        console.log("Games folder:", GAMES_DIR);
        console.log("--------------------------------");
    });

} catch (error) {
    console.error("PENGUINS FAILED TO START:", error);
    process.exit(1);
}
