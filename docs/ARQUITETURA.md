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

## Perfil multidimensional, inconsistências e reavaliação
Módulo **somente informativo** (`src/lib/dimensoes/`): explica *por que* o perfil saiu assim. Não altera o cálculo do perfil, as faixas, a alocação-base nem as perguntas.

```
Resultado / histórico ──► POST /api/dimensoes          (notas, alertas, evolução, lembrete: cálculo do sistema)
                     └──► POST /api/dimensoes/leitura  (texto: IA com verificação, ou texto local = modo offline)
```

| Peça | Arquivo | Papel |
|---|---|---|
| Mapeamento pergunta → dimensão | `mapeamento.ts` | Único lugar que decide a dimensão de cada pergunta; versionado pela data da análise. |
| Cálculo | `calculo.ts` | Nota 0–100% por dimensão: `(soma − n) / (3·n)`. |
| Regras de inconsistência | `regras.ts` | Cada regra tem nome, condição e texto; limites em constantes. |
| Evolução e lembrete | `evolucao.ts` | Variação por dimensão (≥ 10 p.p. = subiu/caiu) e aviso quando a última análise tem mais de 365 dias. |
| Verificação do texto da IA | `guarda.ts` | Reprova promessa, recomendação, ticker, número não fornecido, "perfil deveria ser outro" e afirmações sobre coerência que contradigam os alertas. |
| Leitura (IA + texto local) | `leitura.ts` | Cache em `economic_insights` (chave `dim\|v1\|hash`), backoff e deduplicação, como o simulador. |
| Orquestração | `servico.ts` | Resolve conta × resultado atual, evolução, lembrete; só lê o banco. |

| Decisão | Motivo |
|---|---|
| 5 dimensões: Tolerância a perdas (Q10, 11, 13, 14, 16, 17, 18), Horizonte (Q6), Conhecimento (Q7, 8, 9, 15), Situação financeira (Q1–4), Objetivo (Q5, 12) | Cada pergunta conta em uma única dimensão. Horizonte (1 pergunta) e Objetivo (2) têm nota em poucos degraus; a tela mostra a resposta escolhida junto da nota. |
| Alertas não mudam o perfil nem bloqueiam nada | O perfil continua sendo o das regras do questionário. Adotar o perfil mais conservador em inconsistência grave **não** foi implementado. |
| Dimensões calculadas a partir das respostas já guardadas | Nenhum dado novo é gravado; análises antigas ganham as dimensões. Só o cache da leitura (hash dos números) usa a tabela `economic_insights`. |
| O questionário não pergunta sobre reserva de emergência nem dívidas | "Situação financeira" usa idade, renda, poupança e patrimônio; alertas não afirmam nada sobre reserva. |
| Mudança futura nas perguntas | Criar nova versão em `MAPEAMENTOS`; análises antigas continuam sendo lidas com a versão da época e não são comparadas entre versões diferentes. |
| Isolamento | A seção usa um *error boundary* e as rotas devolvem estados (indisponível/erro) em vez de propagar falhas ao resultado, ao login ou ao histórico. |

| Rota | Descrição |
|---|---|
| `POST /api/dimensoes` | `{ id?, answers? }`. Com `id` da conta logada usa as respostas guardadas; com `answers`, o resultado atual (anônimo). Anônima/de outra conta sem `answers`: 404. |
| `POST /api/dimensoes/leitura` | Mesma entrada. Devolve `{ reading, source }` (`gemini` ou `fallback`). |

## Fora do escopo do MVP (próximas Sprints)
Dashboard/Carteira, Assistente (chat), Simulador, Metas e APIs de mercado (Brapi/HG) — telas já prototipadas nos wireframes.
