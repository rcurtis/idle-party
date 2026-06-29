import "./styles.css";
import { App } from "./app";
import { SpriteSheet } from "./render/spritesheet";

async function boot() {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root");

  const sheet = new SpriteSheet();
  await sheet.load();

  const app = new App(root, sheet);
  app.start();
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Failed to start Idle Party: " + err;
});
