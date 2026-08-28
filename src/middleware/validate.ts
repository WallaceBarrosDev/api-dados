import { Request, Response, NextFunction } from "express";
import { AppError } from "./error";

export function validateTime(value: string, field: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new AppError(400, `${field} deve estar no formato HH:MM`);
  }
}

export function validateDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, `${field} deve estar no formato YYYY-MM-DD`);
  }
}

export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new AppError(400, `${field} deve ser true ou false`);
}

export function validateId(value: string, paramName: string): number {
  const id = Number(value);
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
    throw new AppError(400, `${paramName} deve ser um número inteiro positivo`);
  }
  return id;
}

export function validatePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
