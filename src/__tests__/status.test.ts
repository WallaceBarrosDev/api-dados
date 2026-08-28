import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { createApp } from "../app";
import { createTestDb } from "./helpers";
import type { Database } from "bun:sqlite";
import type { Express } from "express";

let db: Database;
let app: Express;
let server: any;
let baseUrl: string;

beforeAll(() => {
  db = createTestDb();
  app = createApp(db);
  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as any).port}`;
});

afterAll(() => {
  server?.close();
  db?.close();
});

beforeEach(() => {
  db.run("DELETE FROM LESSON");
  db.run("DELETE FROM SUBJECT");
  db.run("DELETE FROM LESSON_OCCURRENCE");
});

describe("GET /status", () => {
  it("deve retornar status ok", async () => {
    const res = await fetch(`${baseUrl}/status`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ statusServer: "ok" });
  });
});
