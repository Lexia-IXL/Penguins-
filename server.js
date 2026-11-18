
const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC = path.join(__dirname, "public");
const GAMES = path.join(PUBLIC, "games");
const ZIP_URL = process.env.GAMES_ZIP_URL;

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    https.get(url, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destination);
        return downloadFile(response.headers.location, destination)
          .then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error("ZIP download failed: " + response.statusCode));
      }

      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

async function extractGames() {
  if (!ZIP_URL) {
    throw new Error("Set the GAMES_ZIP_URL environment variable.");
  }

  fs.mkdirSync(GAMES, { recursive: true });

  const zipPath = path.join("/tmp", "penguins-games.zip");

  console.log("Downloading games archive...");
  await downloadFile(ZIP_URL, zipPath);

  console.log("Extracting games...");

  const directory = await unzipper.Open.file(zipPath);

  for (const entry of directory.files) {
    if (entry.type === "Directory") continue;

    const relative = entry.path.replace(/\\/g, "/");
    const destination = path.resolve(GAMES, relative);

    if (!destination.startsWith(GAMES + path.sep)) continue;

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await entry.stream().pipe(fs.createWriteStream(destination));
  }

  fs.unlinkSync(zipPath);

  const games = [];

  function scan(folder) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      const fullPath = path.join(folder, item.name);

      if (item.isDirectory()) {
        scan(fullPath);
      } else if (/\.(html|htm)$/i.test(item.name)) {
        const relative = path.relative(GAMES, fullPath).split(path.sep).join("/");
        const source = fs.readFileSync(fullPath, "utf8");
        const titleMatch = source.match(/<title[^>]*>(.*?)<\/title>/is);

        games.push({
          id: relative.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "-"),
          title: titleMatch
            ? titleMatch[1].replace(/<[^>]*>/g, "").trim()
            : path.basename(item.name, path.extname(item.name)),
          category: "Other",
          src: "/games/" + relative
        });
      }
    }
  }

  scan(GAMES);

  fs.mkdirSync(path.join(PUBLIC, "data"), { recursive: true });
  fs.writeFileSync(
    path.join(PUBLIC, "data", "games.json"),
    JSON.stringify(games, null, 2)
  );

  console.log(`Loaded ${games.length} HTML games.`);
}

app.use(express.static(PUBLIC));

extractGames()
  .then(() => {
    app.listen(PORT, () => console.log("Penguins is running on port " + PORT));
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
