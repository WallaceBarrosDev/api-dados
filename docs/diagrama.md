``` mermaid
erDiagram
    MATERIA ||--o{ AULA : possui
    DIA_SEMANA ||--o{ AULA : acontece_em
    AULA ||--o{ OCORRENCIA_AULA : gera

    MATERIA {
        int id PK
        varchar nome
    }

    DIA_SEMANA {
        int id PK
        varchar nome
    }

    AULA {
        int id PK
        int materia_id FK
        int dia_semana_id FK
        time hora_inicio
        time hora_fim
    }

    OCORRENCIA_AULA {
        int id PK
        int aula_id FK
        date data
        boolean realizada
    }
```
