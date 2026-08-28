import "dotenv/config";
import { Database } from "bun:sqlite";
import { createApp } from "./app";

const PORT = process.env.PORT || 3010;
const HOST = process.env.HOST || "0.0.0.0";
const DB_PATH = process.env.DATABASE_PATH || "./data/database.db";

const database = new Database(DB_PATH);
database.exec("PRAGMA journal_mode=WAL");
database.exec("PRAGMA foreign_keys=ON");

const app = createApp(database);

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`API Docs: http://${HOST}:${PORT}/docs`);
});

function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    database.close();
    console.log("Server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
