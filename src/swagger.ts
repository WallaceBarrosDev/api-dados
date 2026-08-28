import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Dados",
      version: "1.0.0",
      description: "API para gerenciamento de cronograma de aulas",
    },
    servers: [
      {
        url: "http://localhost:3010",
        description: "Desenvolvimento",
      },
    ],
    components: {
      schemas: {
        Subject: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
          },
        },
        Weekday: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
          },
        },
        Lesson: {
          type: "object",
          properties: {
            id: { type: "integer" },
            subject_id: { type: "integer" },
            weekday_id: { type: "integer" },
            start_time: { type: "string", example: "08:00" },
            end_time: { type: "string", example: "09:00" },
            subject_name: { type: "string" },
            weekday_name: { type: "string" },
          },
        },
        LessonOccurrence: {
          type: "object",
          properties: {
            id: { type: "integer" },
            lesson_id: { type: "integer" },
            date: { type: "string", example: "2025-01-15" },
            completed: { type: "boolean" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array" },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./src/app.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
