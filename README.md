# api-dados

API para gerenciamento de cronograma de aulas.

## Início Rápido

```bash
# Instalar dependências
bun install

# Rodar migrations
bun run migrate

# Iniciar servidor
bun run dev
```

## API

- **Swagger UI:** http://localhost:3010/docs
- **OpenAPI JSON:** http://localhost:3010/swagger.json
- **Documentação completa:** [docs/API.md](docs/API.md)

## Scripts

| Comando | Descrição |
|---------|-----------|
| `bun run dev` | Inicia servidor com hot reload |
| `bun run build` | Build para produção |
| `bun run start` | Inicia build de produção |
| `bun run migrate` | Roda migrations pendentes |
| `bun run migrate:reset` | Reseta banco e roda migrations |
| `bun run test` | Roda todos os testes |
| `bun run test:watch` | Roda testes em watch mode |

## Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PORT` | 3010 | Porta do servidor |
| `HOST` | 0.0.0.0 | Host do servidor |
| `DATABASE_PATH` | ./data/database.db | Caminho do SQLite |
| `CORS_ORIGIN` | * | Origem permitida |

## Tech Stack

- **Runtime:** Bun
- **Framework:** Express
- **Banco:** SQLite (bun:sqlite)
- **Testes:** bun:test
- **Linguagem:** TypeScript
- **Docs:** Swagger/OpenAPI 3.0
