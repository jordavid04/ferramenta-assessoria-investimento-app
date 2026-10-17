# Guia de contribuição

## Fluxo de trabalho (Git)
- `main`: sempre estável (entregas/checkpoints). `develop`: integração. Trabalho em `feature/<tema>`.
- Commits no padrão *Conventional Commits*: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Todo merge em `develop`/`main` via Pull Request com CI verde.

## Gestão ágil (Scrum + Kanban)
- Sprints de 2 semanas; backlog em **Issues**; quadro Kanban em **Projects** (A fazer → Em andamento → Revisão → Concluído).
- Cada Sprint tem uma *milestone* (ver `docs/ROADMAP.md`).

## Ambiente local
```bash
cp .env.example .env
docker compose up -d        # PostgreSQL
npm install
npm run db:init             # cria as tabelas
npm run dev                 # http://localhost:3000
npm test                    # testes do núcleo (pontuação e IA)
```

## Segurança
Nunca faça commit de `.env` ou da `GEMINI_API_KEY`. Se uma chave vazar, revogue-a no Google AI Studio.
