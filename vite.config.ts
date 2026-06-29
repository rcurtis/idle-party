import { defineConfig, type Plugin } from "vite";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Dev-only middleware: the running game POSTs a canvas PNG data-URL to
 * `/__shot?name=foo` and we write it to `.inspect/foo.png`. This lets the
 * assistant visually inspect the live game without the screenshot tool
 * (which can't capture a hidden preview tab).
 */
function screenshotSink(): Plugin {
  return {
    name: "screenshot-sink",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__shot", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        const url = new URL(req.url ?? "", "http://localhost");
        const name = (url.searchParams.get("name") ?? "shot").replace(
          /[^a-z0-9_-]/gi,
          "_",
        );
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const b64 = body.replace(/^data:image\/png;base64,/, "");
            const dir = resolve(process.cwd(), ".inspect");
            mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, `${name}.png`), Buffer.from(b64, "base64"));
            res.statusCode = 200;
            res.end("ok");
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [screenshotSink()],
  build: {
    target: "es2022",
    outDir: "dist",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
