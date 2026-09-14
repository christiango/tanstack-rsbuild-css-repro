import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import entry from "./dist/server/index.js";

const clientRoot = resolve("dist/client");
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const asset = resolve(clientRoot, "." + decodeURIComponent(url.pathname));
    if (
      url.pathname.startsWith("/assets/") &&
      asset.startsWith(clientRoot + sep)
    ) {
      response.setHeader(
        "Content-Type",
        types[extname(asset)] ?? "application/octet-stream",
      );
      response.end(await readFile(asset));
      return;
    }
    const result = await entry.fetch(
      new Request(url, { headers: request.headers }),
    );
    response.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) {
      for await (const chunk of result.body) response.write(chunk);
    }
    response.end();
  } catch (error) {
    console.error(error);
    response.writeHead(500).end("Server error");
  }
});
server.listen(Number(process.env.PORT ?? 4317), "127.0.0.1", () => {
  console.log(`Reproduction: http://127.0.0.1:${process.env.PORT ?? 4317}`);
});
