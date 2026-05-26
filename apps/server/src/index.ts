import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { registerRoutes } from "./routes.js";

const config = loadConfig();
const db = openDatabase(config);

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(cookie, {
  secret: config.cookieSecret
});

await registerRoutes(app, db, config);

if (existsSync(join(config.webDistDir, "index.html"))) {
  await app.register(fastifyStatic, {
    root: config.webDistDir,
    prefix: "/"
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api/")) {
      return reply.code(404).send({ error: "NOT_FOUND" });
    }

    return reply.sendFile("index.html");
  });
}

await app.listen({
  host: config.host,
  port: config.port
});
