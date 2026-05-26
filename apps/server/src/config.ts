import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type AppConfig = {
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
  webDistDir: string;
  cookieSecret: string;
  cookieSecure: boolean;
};

export function loadConfig(): AppConfig {
  const dataDir = resolve(process.env.LINK_STEWARD_DATA_DIR ?? "./data");
  const defaultWebDistDir = resolve(fileURLToPath(new URL("../../web/dist", import.meta.url)));
  mkdirSync(dataDir, { recursive: true });

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3088),
    dataDir,
    dbPath: process.env.LINK_STEWARD_DB_PATH ?? resolve(dataDir, "link-steward.sqlite"),
    webDistDir: process.env.LINK_STEWARD_WEB_DIST_DIR ?? defaultWebDistDir,
    cookieSecret: process.env.LINK_STEWARD_COOKIE_SECRET ?? "dev-cookie-secret-change-me",
    cookieSecure: process.env.LINK_STEWARD_COOKIE_SECURE === "true"
  };
}
