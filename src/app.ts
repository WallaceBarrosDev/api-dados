import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { Database } from "bun:sqlite";
import { errorHandler, notFoundHandler, AppError } from "./middleware/error";
import { logger } from "./middleware/logger";
import { validateTime, validateDate, validateId, validatePagination } from "./middleware/validate";
import { swaggerSpec } from "./swagger";

export function createApp(db: Database) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(logger);

  const limiter = rateLimit({
    windowMs: 30 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições, tente novamente mais tarde" }
  });
  app.use(limiter);

  /**
   * @swagger
   * /status:
   *   get:
   *     tags: [Status]
   *     summary: Verifica status do servidor
   *     responses:
   *       200:
   *         description: Servidor funcionando
   */
  app.get("/status", (_: Request, res: Response) => {
    res.json({ statusServer: "ok" });
  });

  /**
   * @swagger
   * /materias:
   *   get:
   *     tags: [Matérias]
   *     summary: Lista todas as matérias
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Buscar por nome
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *         description: Página atual
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Itens por página
   *     responses:
   *       200:
   *         description: Lista paginada de matérias
   */
  app.get("/materias", (req: Request, res: Response) => {
    const { search } = req.query;
    const { page, limit, offset } = validatePagination(req.query as Record<string, unknown>);

    let query = "SELECT * FROM SUBJECT";
    let countQuery = "SELECT COUNT(*) as total FROM SUBJECT";
    const params: unknown[] = [];

    if (search) {
      const where = " WHERE name LIKE ?";
      query += where;
      countQuery += where;
      params.push(`%${search}%`);
    }

    const { total } = db.query(countQuery).get(...params) as { total: number };
    const data = db.query(`${query} LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({ data, total, page, limit });
  });

  /**
   * @swagger
   * /materias/{id}:
   *   get:
   *     tags: [Matérias]
   *     summary: Busca matéria por ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Matéria encontrada
   *       404:
   *         description: Matéria não encontrada
   */
  app.get("/materias/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");
    const subject = db.query("SELECT * FROM SUBJECT WHERE id = ?").get(id);

    if (!subject) {
      throw new AppError(404, "Matéria não encontrada");
    }
    res.json(subject);
  });

  /**
   * @swagger
   * /materias:
   *   post:
   *     tags: [Matérias]
   *     summary: Cria uma nova matéria
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Matéria criada
   *       400:
   *         description: Campo obrigatório faltando
   */
  app.post("/materias", (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new AppError(400, "Campo obrigatório: name");
    }

    const result = db.query("INSERT INTO SUBJECT (name) VALUES (?)").run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  });

  /**
   * @swagger
   * /materias/{id}:
   *   put:
   *     tags: [Matérias]
   *     summary: Atualiza uma matéria
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *     responses:
   *       200:
   *         description: Matéria atualizada
   *       404:
   *         description: Matéria não encontrada
   */
  app.put("/materias/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new AppError(400, "Campo obrigatório: name");
    }

    const existing = db.query("SELECT id FROM SUBJECT WHERE id = ?").get(id);
    if (!existing) {
      throw new AppError(404, "Matéria não encontrada");
    }

    db.query("UPDATE SUBJECT SET name = ? WHERE id = ?").run(name.trim(), id);
    res.json({ id, name: name.trim() });
  });

  /**
   * @swagger
   * /materias/{id}:
   *   delete:
   *     tags: [Matérias]
   *     summary: Deleta uma matéria
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Matéria deletada
   *       400:
   *         description: Matéria tem aulas vinculadas
   *       404:
   *         description: Matéria não encontrada
   */
  app.delete("/materias/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");

    const existing = db.query("SELECT id FROM SUBJECT WHERE id = ?").get(id);
    if (!existing) {
      throw new AppError(404, "Matéria não encontrada");
    }

    const hasLessons = db.query("SELECT id FROM LESSON WHERE subject_id = ?").get(id);
    if (hasLessons) {
      throw new AppError(400, "Não é possível deletar matéria com aulas vinculadas");
    }

    db.query("DELETE FROM SUBJECT WHERE id = ?").run(id);
    res.json({ message: "Matéria deletada com sucesso" });
  });

  /**
   * @swagger
   * /dias:
   *   get:
   *     tags: [Dias da Semana]
   *     summary: Lista todos os dias da semana
   *     responses:
   *       200:
   *         description: Lista de dias
   */
  app.get("/dias", (_: Request, res: Response) => {
    const weekdays = db.query("SELECT * FROM WEEKDAY").all();
    res.json(weekdays);
  });

  /**
   * @swagger
   * /dias:
   *   post:
   *     tags: [Dias da Semana]
   *     summary: Cria um novo dia
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Dia criado
   *       400:
   *         description: Campo obrigatório faltando
   */
  app.post("/dias", (req: Request, res: Response) => {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new AppError(400, "Campo obrigatório: name");
    }

    const result = db.query("INSERT INTO WEEKDAY (name) VALUES (?)").run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  });

  /**
   * @swagger
   * /dias/{id}:
   *   delete:
   *     tags: [Dias da Semana]
   *     summary: Deleta um dia
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Dia deletado
   *       400:
   *         description: Dia tem aulas vinculadas
   *       404:
   *         description: Dia não encontrado
   */
  app.delete("/dias/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");

    const existing = db.query("SELECT id FROM WEEKDAY WHERE id = ?").get(id);
    if (!existing) {
      throw new AppError(404, "Dia não encontrado");
    }

    const hasLessons = db.query("SELECT id FROM LESSON WHERE weekday_id = ?").get(id);
    if (hasLessons) {
      throw new AppError(400, "Não é possível deletar dia com aulas vinculadas");
    }

    db.query("DELETE FROM WEEKDAY WHERE id = ?").run(id);
    res.json({ message: "Dia deletado com sucesso" });
  });

  /**
   * @swagger
   * /cronograma:
   *   get:
   *     tags: [Cronograma]
   *     summary: Lista todas as aulas
   *     parameters:
   *       - in: query
   *         name: weekday_id
   *         schema:
   *           type: integer
   *         description: Filtrar por dia da semana
   *       - in: query
   *         name: subject_id
   *         schema:
   *           type: integer
   *         description: Filtrar por matéria
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Lista paginada de aulas
   */
  app.get("/cronograma", (req: Request, res: Response) => {
    const { weekday_id, subject_id } = req.query;
    const { page, limit, offset } = validatePagination(req.query as Record<string, unknown>);

    let query = `
      SELECT l.id, l.subject_id, l.weekday_id, l.start_time, l.end_time,
             s.name AS subject_name, w.name AS weekday_name
      FROM LESSON l
      JOIN SUBJECT s ON l.subject_id = s.id
      JOIN WEEKDAY w ON l.weekday_id = w.id
    `;
    let countQuery = "SELECT COUNT(*) as total FROM LESSON";
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (weekday_id) {
      conditions.push("weekday_id = ?");
      params.push(validateId(weekday_id as string, "weekday_id"));
    }
    if (subject_id) {
      conditions.push("subject_id = ?");
      params.push(validateId(subject_id as string, "subject_id"));
    }

    if (conditions.length > 0) {
      const where = ` WHERE ${conditions.join(" AND ")}`;
      query += where;
      countQuery += where;
    }

    const { total } = db.query(countQuery).get(...params) as { total: number };
    const data = db.query(`${query} LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({ data, total, page, limit });
  });

  /**
   * @swagger
   * /cronograma/{id}:
   *   get:
   *     tags: [Cronograma]
   *     summary: Busca aula por ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Aula encontrada
   *       404:
   *         description: Aula não encontrada
   */
  app.get("/cronograma/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");

    const lesson = db.query(`
      SELECT l.id, l.subject_id, l.weekday_id, l.start_time, l.end_time,
             s.name AS subject_name, w.name AS weekday_name
      FROM LESSON l
      JOIN SUBJECT s ON l.subject_id = s.id
      JOIN WEEKDAY w ON l.weekday_id = w.id
      WHERE l.id = ?
    `).get(id);

    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }
    res.json(lesson);
  });

  /**
   * @swagger
   * /cronograma:
   *   post:
   *     tags: [Cronograma]
   *     summary: Cria uma nova aula
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [subject_id, weekday_id, start_time, end_time]
   *             properties:
   *               subject_id:
   *                 type: integer
   *               weekday_id:
   *                 type: integer
   *               start_time:
   *                 type: string
   *                 example: "08:00"
   *               end_time:
   *                 type: string
   *                 example: "09:00"
   *     responses:
   *       201:
   *         description: Aula criada
   *       400:
   *         description: Campos obrigatórios faltando ou inválidos
   */
  app.post("/cronograma", (req: Request, res: Response) => {
    const { subject_id, weekday_id, start_time, end_time } = req.body;

    if (!subject_id || !weekday_id || !start_time || !end_time) {
      throw new AppError(400, "Campos obrigatórios: subject_id, weekday_id, start_time, end_time");
    }

    validateTime(start_time, "start_time");
    validateTime(end_time, "end_time");

    const subject = db.query("SELECT id FROM SUBJECT WHERE id = ?").get(validateId(String(subject_id), "subject_id"));
    if (!subject) {
      throw new AppError(400, "Subject não encontrado");
    }

    const weekday = db.query("SELECT id FROM WEEKDAY WHERE id = ?").get(validateId(String(weekday_id), "weekday_id"));
    if (!weekday) {
      throw new AppError(400, "Weekday não encontrado");
    }

    const result = db.query(
      "INSERT INTO LESSON (subject_id, weekday_id, start_time, end_time) VALUES (?, ?, ?, ?)"
    ).run(subject_id, weekday_id, start_time, end_time);

    res.status(201).json({ id: result.lastInsertRowid, subject_id, weekday_id, start_time, end_time });
  });

  /**
   * @swagger
   * /cronograma/{id}:
   *   put:
   *     tags: [Cronograma]
   *     summary: Atualiza uma aula
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [subject_id, weekday_id, start_time, end_time]
   *             properties:
   *               subject_id:
   *                 type: integer
   *               weekday_id:
   *                 type: integer
   *               start_time:
   *                 type: string
   *               end_time:
   *                 type: string
   *     responses:
   *       200:
   *         description: Aula atualizada
   *       404:
   *         description: Aula não encontrada
   */
  app.put("/cronograma/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");
    const { subject_id, weekday_id, start_time, end_time } = req.body;

    if (!subject_id || !weekday_id || !start_time || !end_time) {
      throw new AppError(400, "Campos obrigatórios: subject_id, weekday_id, start_time, end_time");
    }

    validateTime(start_time, "start_time");
    validateTime(end_time, "end_time");

    const existing = db.query("SELECT id FROM LESSON WHERE id = ?").get(id);
    if (!existing) {
      throw new AppError(404, "Aula não encontrada");
    }

    const subject = db.query("SELECT id FROM SUBJECT WHERE id = ?").get(validateId(String(subject_id), "subject_id"));
    if (!subject) {
      throw new AppError(400, "Subject não encontrado");
    }

    const weekday = db.query("SELECT id FROM WEEKDAY WHERE id = ?").get(validateId(String(weekday_id), "weekday_id"));
    if (!weekday) {
      throw new AppError(400, "Weekday não encontrado");
    }

    db.query(
      "UPDATE LESSON SET subject_id = ?, weekday_id = ?, start_time = ?, end_time = ? WHERE id = ?"
    ).run(subject_id, weekday_id, start_time, end_time, id);

    res.json({ id, subject_id, weekday_id, start_time, end_time });
  });

  /**
   * @swagger
   * /cronograma/{id}:
   *   delete:
   *     tags: [Cronograma]
   *     summary: Deleta uma aula
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Aula deletada
   *       404:
   *         description: Aula não encontrada
   */
  app.delete("/cronograma/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");

    const existing = db.query("SELECT id FROM LESSON WHERE id = ?").get(id);
    if (!existing) {
      throw new AppError(404, "Aula não encontrada");
    }

    db.query("DELETE FROM LESSON_OCCURRENCE WHERE lesson_id = ?").run(id);
    db.query("DELETE FROM LESSON WHERE id = ?").run(id);

    res.json({ message: "Aula deletada com sucesso" });
  });

  /**
   * @swagger
   * /cronograma/{id}/gerar-ocorrencias:
   *   post:
   *     tags: [Cronograma]
   *     summary: Gera ocorrências automáticas para um período
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [start_date, end_date]
   *             properties:
   *               start_date:
   *                 type: string
   *                 example: "2025-01-06"
   *               end_date:
   *                 type: string
   *                 example: "2025-06-30"
   *     responses:
   *       201:
   *         description: Ocorrências criadas
   *       404:
   *         description: Aula não encontrada
   */
  app.post("/cronograma/:id/gerar-ocorrencias", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
      throw new AppError(400, "Campos obrigatórios: start_date, end_date");
    }

    validateDate(start_date, "start_date");
    validateDate(end_date, "end_date");

    const lesson = db.query(`
      SELECT l.*, w.name AS weekday_name
      FROM LESSON l
      JOIN WEEKDAY w ON l.weekday_id = w.id
      WHERE l.id = ?
    `).get(id) as { weekday_id: number } | undefined;

    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    const weekdayMap: Record<number, number> = {
      1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0
    };
    const targetDay = weekdayMap[lesson.weekday_id] ?? lesson.weekday_id;

    const start = new Date(start_date);
    const end = new Date(end_date);
    let created = 0;

    const insert = db.query(
      "INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, 0)"
    );

    const current = new Date(start);
    while (current <= end) {
      if (current.getDay() === targetDay) {
        const dateStr = current.toISOString().split("T")[0];
        const exists = db.query(
          "SELECT id FROM LESSON_OCCURRENCE WHERE lesson_id = ? AND date = ?"
        ).get(id, dateStr);

        if (!exists) {
          insert.run(id, dateStr);
          created++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    res.status(201).json({ message: `${created} ocorrência(s) criada(s)`, created });
  });

  /**
   * @swagger
   * /cronograma/{lessonId}/ocorrencias:
   *   get:
   *     tags: [Ocorrências]
   *     summary: Lista ocorrências de uma aula
   *     parameters:
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: completed
   *         schema:
   *           type: boolean
   *       - in: query
   *         name: from
   *         schema:
   *           type: string
   *       - in: query
   *         name: to
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Lista paginada de ocorrências
   *       404:
   *         description: Aula não encontrada
   */
  app.get("/cronograma/:lessonId/ocorrencias", (req: Request, res: Response) => {
    const lessonId = validateId(req.params.lessonId, "lessonId");
    const { completed, from, to } = req.query;
    const { page, limit, offset } = validatePagination(req.query as Record<string, unknown>);

    const lesson = db.query("SELECT id FROM LESSON WHERE id = ?").get(lessonId);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    let query = "SELECT * FROM LESSON_OCCURRENCE WHERE lesson_id = ?";
    let countQuery = "SELECT COUNT(*) as total FROM LESSON_OCCURRENCE WHERE lesson_id = ?";
    const params: unknown[] = [lessonId];

    if (completed !== undefined) {
      const completedBool = completed === "true" || completed === "1";
      query += " AND completed = ?";
      countQuery += " AND completed = ?";
      params.push(completedBool ? 1 : 0);
    }
    if (from) {
      validateDate(from as string, "from");
      query += " AND date >= ?";
      countQuery += " AND date >= ?";
      params.push(from);
    }
    if (to) {
      validateDate(to as string, "to");
      query += " AND date <= ?";
      countQuery += " AND date <= ?";
      params.push(to);
    }

    const { total } = db.query(countQuery).get(...params) as { total: number };
    const data = db.query(`${query} LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({ data, total, page, limit });
  });

  /**
   * @swagger
   * /cronograma/{lessonId}/ocorrencias/{id}:
   *   get:
   *     tags: [Ocorrências]
   *     summary: Busca ocorrência por ID
   *     parameters:
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Ocorrência encontrada
   *       404:
   *         description: Ocorrência não encontrada
   */
  app.get("/cronograma/:lessonId/ocorrencias/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");
    const lessonId = validateId(req.params.lessonId, "lessonId");

    const occurrence = db.query(
      "SELECT * FROM LESSON_OCCURRENCE WHERE id = ? AND lesson_id = ?"
    ).get(id, lessonId);

    if (!occurrence) {
      throw new AppError(404, "Ocorrência não encontrada");
    }

    res.json(occurrence);
  });

  /**
   * @swagger
   * /cronograma/{lessonId}/ocorrencias:
   *   post:
   *     tags: [Ocorrências]
   *     summary: Cria uma ocorrência
   *     parameters:
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [date]
   *             properties:
   *               date:
   *                 type: string
   *                 example: "2025-01-15"
   *               completed:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Ocorrência criada
   *       400:
   *         description: Campo obrigatório faltando
   *       404:
   *         description: Aula não encontrada
   */
  app.post("/cronograma/:lessonId/ocorrencias", (req: Request, res: Response) => {
    const lessonId = validateId(req.params.lessonId, "lessonId");
    const { date, completed } = req.body;

    if (!date) {
      throw new AppError(400, "Campo obrigatório: date");
    }

    validateDate(date, "date");

    const lesson = db.query("SELECT id FROM LESSON WHERE id = ?").get(lessonId);
    if (!lesson) {
      throw new AppError(404, "Aula não encontrada");
    }

    const result = db.query(
      "INSERT INTO LESSON_OCCURRENCE (lesson_id, date, completed) VALUES (?, ?, ?)"
    ).run(lessonId, date, completed ? 1 : 0);

    res.status(201).json({ id: result.lastInsertRowid, lesson_id: lessonId, date, completed: completed ? true : false });
  });

  /**
   * @swagger
   * /cronograma/{lessonId}/ocorrencias/{id}:
   *   put:
   *     tags: [Ocorrências]
   *     summary: Atualiza uma ocorrência
   *     parameters:
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               date:
   *                 type: string
   *               completed:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Ocorrência atualizada
   *       404:
   *         description: Ocorrência não encontrada
   */
  app.put("/cronograma/:lessonId/ocorrencias/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");
    const lessonId = validateId(req.params.lessonId, "lessonId");
    const { date, completed } = req.body;

    if (date === undefined && completed === undefined) {
      throw new AppError(400, "Envie ao menos um campo: date, completed");
    }

    if (date !== undefined) {
      validateDate(date, "date");
    }

    const existing = db.query(
      "SELECT id FROM LESSON_OCCURRENCE WHERE id = ? AND lesson_id = ?"
    ).get(id, lessonId);

    if (!existing) {
      throw new AppError(404, "Ocorrência não encontrada");
    }

    const current = db.query(
      "SELECT date, completed FROM LESSON_OCCURRENCE WHERE id = ? AND lesson_id = ?"
    ).get(id, lessonId) as { date: string; completed: number };

    const newDate = date ?? current.date;
    const newCompleted = completed !== undefined ? (completed ? 1 : 0) : current.completed;

    db.query(
      "UPDATE LESSON_OCCURRENCE SET date = ?, completed = ? WHERE id = ? AND lesson_id = ?"
    ).run(newDate, newCompleted, id, lessonId);

    res.json({ id, lesson_id: lessonId, date: newDate, completed: newCompleted ? true : false });
  });

  /**
   * @swagger
   * /cronograma/{lessonId}/ocorrencias/{id}:
   *   delete:
   *     tags: [Ocorrências]
   *     summary: Deleta uma ocorrência
   *     parameters:
   *       - in: path
   *         name: lessonId
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Ocorrência deletada
   *       404:
   *         description: Ocorrência não encontrada
   */
  app.delete("/cronograma/:lessonId/ocorrencias/:id", (req: Request, res: Response) => {
    const id = validateId(req.params.id, "id");
    const lessonId = validateId(req.params.lessonId, "lessonId");

    const existing = db.query(
      "SELECT id FROM LESSON_OCCURRENCE WHERE id = ? AND lesson_id = ?"
    ).get(id, lessonId);

    if (!existing) {
      throw new AppError(404, "Ocorrência não encontrada");
    }

    db.query("DELETE FROM LESSON_OCCURRENCE WHERE id = ? AND lesson_id = ?").run(id, lessonId);

    res.json({ message: "Ocorrência deletada com sucesso" });
  });

  /**
   * @swagger
   * /dashboard:
   *   get:
   *     tags: [Dashboard]
   *     summary: Resumo geral do sistema
   *     responses:
   *       200:
   *         description: Estatísticas gerais
   */
  app.get("/dashboard", (_: Request, res: Response) => {
    const subjects = db.query("SELECT COUNT(*) as total FROM SUBJECT").get() as { total: number };
    const lessons = db.query("SELECT COUNT(*) as total FROM LESSON").get() as { total: number };
    const occurrences = db.query("SELECT COUNT(*) as total FROM LESSON_OCCURRENCE").get() as { total: number };
    const completed = db.query("SELECT COUNT(*) as total FROM LESSON_OCCURRENCE WHERE completed = 1").get() as { total: number };

    res.json({
      subjects: subjects.total,
      lessons: lessons.total,
      occurrences: occurrences.total,
      completed: completed.total,
      completionRate: occurrences.total > 0 ? Math.round((completed.total / occurrences.total) * 100) : 0
    });
  });

  /**
   * @swagger
   * /dashboard/semanal:
   *   get:
   *     tags: [Dashboard]
   *     summary: Aulas da semana atual
   *     responses:
   *       200:
   *         description: Aulas da semana
   */
  app.get("/dashboard/semanal", (req: Request, res: Response) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = monday.toISOString().split("T")[0];
    const endDate = sunday.toISOString().split("T")[0];

    const data = db.query(`
      SELECT lo.id, lo.date, lo.completed,
             l.start_time, l.end_time,
             s.name AS subject_name, w.name AS weekday_name
      FROM LESSON_OCCURRENCE lo
      JOIN LESSON l ON lo.lesson_id = l.id
      JOIN SUBJECT s ON l.subject_id = s.id
      JOIN WEEKDAY w ON l.weekday_id = w.id
      WHERE lo.date BETWEEN ? AND ?
      ORDER BY lo.date, l.start_time
    `).all(startDate, endDate);

    res.json({ startDate, endDate, data });
  });

  /**
   * @swagger
   * /dashboard/estatisticas:
   *   get:
   *     tags: [Dashboard]
   *     summary: Estatísticas por matéria
   *     responses:
   *       200:
   *         description: Estatísticas detalhadas
   */
  app.get("/dashboard/estatisticas", (_: Request, res: Response) => {
    const bySubject = db.query(`
      SELECT s.name, COUNT(l.id) as total_lessons,
             (SELECT COUNT(*) FROM LESSON_OCCURRENCE lo WHERE lo.lesson_id = l.id) as total_occurrences,
             (SELECT COUNT(*) FROM LESSON_OCCURRENCE lo WHERE lo.lesson_id = l.id AND lo.completed = 1) as completed
      FROM SUBJECT s
      LEFT JOIN LESSON l ON s.id = l.subject_id
      GROUP BY s.id
    `).all();

    res.json({ bySubject });
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get("/swagger.json", (_, res) => {
    res.json(swaggerSpec);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
