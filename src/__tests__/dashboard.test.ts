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
  db.run("DELETE FROM SUBJECT");
});

describe("GET /dashboard", () => {
  it("deve retornar resumo geral", async () => {
    const res = await fetch(`${baseUrl}/dashboard`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("subjects");
    expect(body).toHaveProperty("lessons");
    expect(body).toHaveProperty("occurrences");
    expect(body).toHaveProperty("completed");
    expect(body).toHaveProperty("completionRate");
  });

  it("deve contar corretamente", async () => {
    const subjectResult = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Matemática");
    const subjectId = subjectResult.lastInsertRowid;

    const lessonResult = db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subjectId, 1, "08:00", "09:00");
    const lessonId = lessonResult.lastInsertRowid;

    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-01-15", 1);
    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-01-22", 0);

    const res = await fetch(`${baseUrl}/dashboard`);
    const body = await res.json();

    expect(body.subjects).toBe(1);
    expect(body.lessons).toBe(1);
    expect(body.occurrences).toBe(2);
    expect(body.completed).toBe(1);
    expect(body.completionRate).toBe(50);
  });
});

describe("GET /dashboard/semanal", () => {
  it("deve retornar aulas da semana", async () => {
    const res = await fetch(`${baseUrl}/dashboard/semanal`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("startDate");
    expect(body).toHaveProperty("endDate");
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("GET /dashboard/estatisticas", () => {
  it("deve retornar estatísticas por matéria", async () => {
    const res = await fetch(`${baseUrl}/dashboard/estatisticas`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("bySubject");
    expect(Array.isArray(body.bySubject)).toBe(true);
  });
});
