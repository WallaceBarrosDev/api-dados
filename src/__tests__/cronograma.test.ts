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

describe("GET /cronograma", () => {
  it("deve retornar lista vazia quando não há aulas", async () => {
    const res = await fetch(`${baseUrl}/cronograma`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("deve retornar aulas com paginação", async () => {
    const subjectId = createSubject("Matemática");
    db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subjectId, 1, "08:00", "09:00");

    const res = await fetch(`${baseUrl}/cronograma`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].subject_name).toBe("Matemática");
    expect(body.data[0].weekday_name).toBe("Monday");
  });

  it("deve filtrar por weekday_id", async () => {
    const subjectId = createSubject("Matemática");
    db.query("INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)").run(subjectId, 1, "08:00", "09:00");
    db.query("INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)").run(subjectId, 2, "10:00", "11:00");

    const res = await fetch(`${baseUrl}/cronograma?weekday_id=1`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].weekday_id).toBe(1);
  });

  it("deve filtrar por subject_id", async () => {
    const mathId = createSubject("Matemática");
    const portId = createSubject("Português");
    db.query("INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)").run(mathId, 1, "08:00", "09:00");
    db.query("INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)").run(portId, 2, "10:00", "11:00");

    const res = await fetch(`${baseUrl}/cronograma?subject_id=${mathId}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].subject_id).toBe(mathId);
  });
});

describe("GET /cronograma/:id", () => {
  it("deve retornar 404 para aula inexistente", async () => {
    const res = await fetch(`${baseUrl}/cronograma/999`);
    expect(res.status).toBe(404);
  });

  it("deve retornar aula pelo id", async () => {
    const subjectId = createSubject("Português");
    const result = db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subjectId, 2, "10:00", "11:00");

    const res = await fetch(`${baseUrl}/cronograma/${result.lastInsertRowid}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subject_name).toBe("Português");
    expect(body.weekday_name).toBe("Tuesday");
  });
});

describe("POST /cronograma", () => {
  it("deve retornar 400 quando faltar campo", async () => {
    const res = await fetch(`${baseUrl}/cronograma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 400 quando subject não existir", async () => {
    const res = await fetch(`${baseUrl}/cronograma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: 999, weekday_id: 1, start_time: "08:00", end_time: "09:00" }),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 400 quando weekday não existir", async () => {
    const subjectId = createSubject("História");
    const res = await fetch(`${baseUrl}/cronograma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: subjectId, weekday_id: 999, start_time: "08:00", end_time: "09:00" }),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 400 com formato de hora inválido", async () => {
    const subjectId = createSubject("Ciências");
    const res = await fetch(`${baseUrl}/cronograma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: subjectId, weekday_id: 3, start_time: "8am", end_time: "9am" }),
    });
    expect(res.status).toBe(400);
  });

  it("deve criar aula com sucesso", async () => {
    const subjectId = createSubject("Ciências");
    const res = await fetch(`${baseUrl}/cronograma`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: subjectId, weekday_id: 3, start_time: "14:00", end_time: "15:00" }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.subject_id).toBe(subjectId);
    expect(body.weekday_id).toBe(3);
  });
});

describe("PUT /cronograma/:id", () => {
  it("deve retornar 404 para aula inexistente", async () => {
    const res = await fetch(`${baseUrl}/cronograma/999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: 1, weekday_id: 1, start_time: "08:00", end_time: "09:00" }),
    });
    expect(res.status).toBe(404);
  });

  it("deve atualizar aula com sucesso", async () => {
    const subjectId = createSubject("Geografia");
    const result = db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subjectId, 1, "08:00", "09:00");

    const newSubjectId = createSubject("Arte");
    const res = await fetch(`${baseUrl}/cronograma/${result.lastInsertRowid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: newSubjectId, weekday_id: 4, start_time: "10:00", end_time: "11:00" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subject_id).toBe(newSubjectId);
    expect(body.weekday_id).toBe(4);
  });
});

describe("DELETE /cronograma/:id", () => {
  it("deve retornar 404 para aula inexistente", async () => {
    const res = await fetch(`${baseUrl}/cronograma/999`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("deve deletar aula com sucesso", async () => {
    const subjectId = createSubject("Educação Física");
    const result = db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subjectId, 5, "16:00", "17:00");

    const res = await fetch(`${baseUrl}/cronograma/${result.lastInsertRowid}`, { method: "DELETE" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Aula deletada com sucesso");
  });
});
