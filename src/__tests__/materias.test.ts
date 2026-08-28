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

describe("GET /materias", () => {
  it("deve retornar lista vazia quando não há matérias", async () => {
    const res = await fetch(`${baseUrl}/materias`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("deve retornar matérias com paginação", async () => {
    db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Matemática");
    db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Português");

    const res = await fetch(`${baseUrl}/materias`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
  });

  it("deve buscar matérias por nome", async () => {
    db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Matemática");
    db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Português");

    const res = await fetch(`${baseUrl}/materias?search=Mate`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Matemática");
  });
});

describe("GET /materias/:id", () => {
  it("deve retornar 404 para matéria inexistente", async () => {
    const res = await fetch(`${baseUrl}/materias/999`);
    expect(res.status).toBe(404);
  });

  it("deve retornar matéria pelo id", async () => {
    const result = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("História");

    const res = await fetch(`${baseUrl}/materias/${result.lastInsertRowid}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("História");
  });
});

describe("POST /materias", () => {
  it("deve retornar 400 quando faltar name", async () => {
    const res = await fetch(`${baseUrl}/materias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("deve criar matéria com sucesso", async () => {
    const res = await fetch(`${baseUrl}/materias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ciências" }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Ciências");
  });
});

describe("PUT /materias/:id", () => {
  it("deve retornar 400 quando faltar name", async () => {
    const res = await fetch(`${baseUrl}/materias/1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("deve retornar 404 para matéria inexistente", async () => {
    const res = await fetch(`${baseUrl}/materias/999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste" }),
    });
    expect(res.status).toBe(404);
  });

  it("deve atualizar matéria com sucesso", async () => {
    const result = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Geografia");

    const res = await fetch(`${baseUrl}/materias/${result.lastInsertRowid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Geografia Atualizada" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Geografia Atualizada");
  });
});

describe("DELETE /materias/:id", () => {
  it("deve retornar 404 para matéria inexistente", async () => {
    const res = await fetch(`${baseUrl}/materias/999`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("deve retornar 400 quando matéria tem aulas vinculadas", async () => {
    const subjectResult = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Arte");
    const subjectId = subjectResult.lastInsertRowid;

    db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subjectId, 1, "08:00", "09:00");

    const res = await fetch(`${baseUrl}/materias/${subjectId}`, { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("deve deletar matéria com sucesso", async () => {
    const result = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run("Educação Física");

    const res = await fetch(`${baseUrl}/materias/${result.lastInsertRowid}`, { method: "DELETE" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Matéria deletada com sucesso");
  });
});
