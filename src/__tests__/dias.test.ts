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
  db.run("DELETE FROM LESSON_OCCURRENCE");
  db.run("DELETE FROM LESSON");
  db.run("DELETE FROM WEEKDAY");
  db.run("DELETE FROM sqlite_sequence WHERE name = 'WEEKDAY'");
  db.run("INSERT INTO WEEKDAY (name) VALUES ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'), ('Friday'), ('Saturday'), ('Sunday')");
});

describe("GET /dias", () => {
  it("deve retornar todos os dias", async () => {
    const res = await fetch(`${baseUrl}/dias`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(7);
  });
});

describe("POST /dias", () => {
  it("deve retornar 400 quando faltar name", async () => {
    const res = await fetch(`${baseUrl}/dias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("deve criar dia com sucesso", async () => {
    const res = await fetch(`${baseUrl}/dias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Feriado" }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Feriado");
  });
});

describe("DELETE /dias/:id", () => {
  it("deve retornar 404 para dia inexistente", async () => {
    const res = await fetch(`${baseUrl}/dias/999`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("deve retornar 400 quando dia tem aulas vinculadas", async () => {
    const subjectResult = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Matemática");
    const subjectId = subjectResult.lastInsertRowid;

    db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subjectId, 1, "08:00", "09:00");

    const res = await fetch(`${baseUrl}/dias/1`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("deve deletar dia com sucesso", async () => {
    const res = await fetch(`${baseUrl}/dias/7`, { method: "DELETE" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Dia deletado com sucesso");
  });
});
