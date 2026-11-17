# Penguins

A Frogie's Arcade-inspired starter website with three sections:

- **Home** – landing page and featured links
- **Games** – searchable game cards with an in-page player
- **Websites** – website cards ready for your own HTML projects

## Run locally

1. Install Node.js.
2. Open this folder in a terminal.
3. Run `npm install`.
4. Run `npm start`.
5. Visit `http://localhost:3000`.

## Deploy to Render

1. Upload this project to a GitHub repository.
2. In Render, choose **New → Web Service** and connect the repository.
3. Render can use the included `render.yaml`, or set:
   - Build command: `npm install`
   - Start command: `npm start`
4. Deploy.

## Add games

Open `public/data/games.json` and add an entry:

```json
{
  "name": "My Game",
  "description": "A short description",
  "image": "assets/game-placeholder.svg",
  "file": "games/my-game/index.html",
  "category": "Arcade"
}
```

Put the game's files in `public/games/my-game/`. The `file` value is relative to the `public` folder.

## Add websites

Open `public/data/websites.json` and add a card:

```json
{
  "name": "My Website",
  "description": "My custom website",
  "image": "assets/site-placeholder.svg",
  "url": "websites/my-site/index.html"
}
```

Put the website files in `public/websites/my-site/`. External website URLs can also be used in `url`.

## Important

Only add games and website code that you own or are allowed to use. Some external websites block being displayed inside an iframe; those should open in a new tab instead.
