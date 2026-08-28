import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: Error, _: Request, res: Response, __: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
}

export function notFoundHandler(_: Request, res: Response) {
  res.status(404).json({ error: "Rota não encontrada" });
}
