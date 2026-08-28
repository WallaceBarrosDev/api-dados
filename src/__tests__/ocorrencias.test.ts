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

function createSubject(name: string): number {
  const result = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run(name);
  return Number(result.lastInsertRowid);
}

function createLesson(subjectId: number, weekdayId: number): number {
  const result = db.query(
    "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
  ).run(subjectId, weekdayId, "08:00", "09:00");
  return Number(result.lastInsertRowid);
}

describe("GET /cronograma/:lessonId/ocorrencias", () => {
  it("deve retornar 404 quando aula não existir", async () => {
    const res = await fetch(`${baseUrl}/cronograma/999/ocorrencias`);
    expect(res.status).toBe(404);
  });

  it("deve retornar lista vazia quando não há ocorrências", async () => {
    const subjectId = createSubject("Matemática");
    const lessonId = createLesson(subjectId, 1);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("deve retornar ocorrências com paginação", async () => {
    const subjectId = createSubject("Matemática");
    const lessonId = createLesson(subjectId, 1);

    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-01-15", 0);
    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-01-22", 1);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("deve filtrar por completed", async () => {
    const subjectId = createSubject("Matemática");
    const lessonId = createLesson(subjectId, 1);

    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-01-15", 0);
    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-01-22", 1);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias?completed=true`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].completed).toBe(1);
  });

  it("deve filtrar por período", async () => {
    const subjectId = createSubject("Matemática");
    const lessonId = createLesson(subjectId, 1);

    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-01-15", 0);
    db.query("INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)").run(lessonId, "2025-02-15", 0);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias?from=2025-02-01&to=2025-12-31`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].date).toBe("2025-02-15");
  });
});

describe("GET /cronograma/:lessonId/ocorrencias/:id", () => {
  it("deve retornar 404 quando ocorrência não existir", async () => {
    const res = await fetch(`${baseUrl}/cronograma/1/ocorrencias/999`);
    expect(res.status).toBe(404);
  });

  it("deve retornar ocorrência pelo id", async () => {
    const subjectId = createSubject("Português");
    const lessonId = createLesson(subjectId, 2);

    const result = db.query(
      "INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)"
    ).run(lessonId, "2025-02-10", 1);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias/${result.lastInsertRowid}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.date).toBe("2025-02-10");
    expect(body.completed).toBe(1);
  });
});

describe("POST /cronograma/:lessonId/ocorrencias", () => {
  it("deve retornar 400 quando faltar date", async () => {
    const res = await fetch(`${baseUrl}/cronograma/1/ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 400 com formato de data inválido", async () => {
    const subjectId = createSubject("Ciências");
    const lessonId = createLesson(subjectId, 3);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "15/01/2025" }),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 404 quando aula não existir", async () => {
    const res = await fetch(`${baseUrl}/cronograma/999/ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2025-03-01" }),
    });
    expect(res.status).toBe(404);
  });

  it("deve criar ocorrência com sucesso", async () => {
    const subjectId = createSubject("Ciências");
    const lessonId = createLesson(subjectId, 3);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2025-04-01", completed: true }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.lesson_id).toBe(lessonId);
    expect(body.date).toBe("2025-04-01");
    expect(body.completed).toBe(true);
  });
});

describe("PUT /cronograma/:lessonId/ocorrencias/:id", () => {
  it("deve retornar 400 quando não enviar nenhum campo", async () => {
    const res = await fetch(`${baseUrl}/cronograma/1/ocorrencias/1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 404 quando ocorrência não existir", async () => {
    const res = await fetch(`${baseUrl}/cronograma/1/ocorrencias/999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(res.status).toBe(404);
  });

  it("deve atualizar ocorrência com sucesso", async () => {
    const subjectId = createSubject("História");
    const lessonId = createLesson(subjectId, 4);

    const result = db.query(
      "INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)"
    ).run(lessonId, "2025-05-10", 0);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias/${result.lastInsertRowid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.completed).toBe(true);
  });
});

describe("DELETE /cronograma/:lessonId/ocorrencias/:id", () => {
  it("deve retornar 404 quando ocorrência não existir", async () => {
    const res = await fetch(`${baseUrl}/cronograma/1/ocorrencias/999`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("deve deletar ocorrência com sucesso", async () => {
    const subjectId = createSubject("Geografia");
    const lessonId = createLesson(subjectId, 5);

    const result = db.query(
      "INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)"
    ).run(lessonId, "2025-06-01", 0);

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/ocorrencias/${result.lastInsertRowid}`, {
      method: "DELETE",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Ocorrência deletada com sucesso");
  });
});

describe("POST /cronograma/:id/gerar-ocorrencias", () => {
  it("deve retornar 400 quando faltar campo", async () => {
    const res = await fetch(`${baseUrl}/cronograma/1/gerar-ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 404 quando aula não existir", async () => {
    const res = await fetch(`${baseUrl}/cronograma/999/gerar-ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: "2025-01-06", end_date: "2025-01-31" }),
    });
    expect(res.status).toBe(404);
  });

  it("deve gerar ocorrências para aula na segunda-feira", async () => {
    const subjectId = createSubject("Matemática");
    const lessonId = createLesson(subjectId, 1); // Monday

    const res = await fetch(`${baseUrl}/cronograma/${lessonId}/gerar-ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: "2025-01-06", end_date: "2025-01-27" }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.created).toBe(4); // 4 Mondays in Jan 2025
  });
});
