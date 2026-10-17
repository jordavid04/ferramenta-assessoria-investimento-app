# InvestPro — Ferramenta de Assessoria de Investimento

Projeto de Extensão Universitária II · Bacharelado em Sistemas de Informação (BSI) · 2026.1
Professores: André Fabiano de Moraes / Joaquim M. M. Valverde
Alunos: Andersom Gabriel e Jorge David Bolognesi

Plataforma web com **formulário de Suitability (18 questões, ANBIMA)** integrado à **IA Generativa (Google Gemini)** para educação financeira e sugestão de alocação, voltada a investidores iniciantes e servidores públicos.

## Status
MVP em desenvolvimento (Sprint 1 concluída): questionário, cálculo de perfil, recomendação por IA com modo offline e persistência em PostgreSQL. Veja [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack
Next.js 15 (React 19, TypeScript) · Tailwind CSS 4 · PostgreSQL (`pg`) · Google Gemini API · GitHub Actions

## Como rodar
```bash
cp .env.example .env          # opcional: GEMINI_API_KEY (sem ela, usa o motor local)
docker compose up -d          # PostgreSQL (opcional)
npm install
npm run db:init               # cria tabelas (se usar o banco)
npm run dev                   # http://localhost:3000
npm test                      # testes do núcleo
```

## Documentação
- [Arquitetura e decisões](docs/ARQUITETURA.md)
- [Roadmap / Sprints](docs/ROADMAP.md)
- [Como contribuir](CONTRIBUTING.md)

## Aviso
Conteúdo educacional. Não constitui recomendação individualizada de investimento.
