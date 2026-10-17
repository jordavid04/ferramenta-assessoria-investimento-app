# Arquitetura do MVP

Segue os diagramas UML do Checkpoint 1 (Casos de Uso, Componentes, Implantação).

```
Navegador (Next.js / React)
   │  HTTPS  POST /api/suitability  {answers, acceptedTerms}
   ▼
Next.js Route Handler  ──►  scoring.ts   (perfil = regra ANBIMA, determinístico)
   │                    ──►  gemini.ts    (prompt estruturado → JSON validado)
   │                    ──►  fallback.ts  (motor local se a IA falhar)
   │  SQL (pg)
   ▼
PostgreSQL  (tabela suitability_sessions)
```

## Decisões de projeto
| Decisão | Motivo |
|---|---|
| Perfil calculado no **servidor** por regra fixa | Auditável e igual ao Apêndice do Checkpoint 1; a IA não pode "mudar" o perfil. |
| IA só explica/sugere, com **validação** (soma 100%, desvio ≤ 10 p.p. da base) | Reduz alucinação e risco regulatório. |
| **Fallback** local | Cota gratuita do Gemini pode falhar; o usuário nunca fica sem resposta. |
| Sem cadastro/dados pessoais no MVP | LGPD: minimização de dados; reduz atrito para o público-alvo. |
| `pg` com SQL direto | Simples, alinhado a "Conexão SQL" do Diagrama de Componentes. |
| Chave Gemini só no servidor (`process.env`) | Nunca exposta ao navegador. |

## Rotas
| Rota | Descrição |
|---|---|
| `GET /` | Página inicial |
| `GET /suitability` | Formulário em 4 etapas (18 questões) |
| `GET /resultado` | Perfil, alocação, sugestões e dicas |
| `POST /api/suitability` | Calcula perfil, chama IA, persiste |
| `GET /api/health` | Estado do banco e da IA |

## Fora do escopo do MVP (próximas Sprints)
Dashboard/Carteira, Assistente (chat), Simulador, Metas e APIs de mercado (Brapi/HG) — telas já prototipadas nos wireframes.
