import { createServer } from "node:http";
import { attachGameServer } from "./websocket/game-server.js";
const dev = process.argv.includes("--dev");
const server = createServer();
attachGameServer(server);
if (dev) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });
  server.on("request", vite.middlewares);
} else {
  const entry = new URL("../../build/handler.js", import.meta.url).href;
  const { handler } = await import(entry);
  server.on("request", handler);
}
const port = Number(process.env.PORT || 5173);
server.listen(port, process.env.HOST || "0.0.0.0", () =>
  console.log(`Cidade Dorme em http://localhost:${port}`),
);
