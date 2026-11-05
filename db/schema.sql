-- Esquema do MVP (PostgreSQL). Aplicado por `npm run db:init`.
-- A conta é opcional. Sem cadastro, a análise fica anônima (user_id nulo).
-- Com cadastro, guardamos nome de usuário e hash da senha — sem e-mail nem nome civil.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9._-]{3,32}$')
);

CREATE TABLE IF NOT EXISTS suitability_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  answers       JSONB       NOT NULL,                       -- {"1":"C","2":"B",...}
  score         SMALLINT    NOT NULL CHECK (score BETWEEN 18 AND 72),
  profile       TEXT        NOT NULL CHECK (profile IN ('Conservador','Moderado','Arrojado','Agressivo')),
  ai_source     TEXT        NOT NULL CHECK (ai_source IN ('gemini','fallback')),
  recommendation JSONB      NOT NULL,
  accepted_terms BOOLEAN    NOT NULL DEFAULT FALSE
);

-- Bancos já criados não ganham coluna nova no CREATE TABLE IF NOT EXISTS.
ALTER TABLE suitability_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON suitability_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON suitability_sessions (profile);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON suitability_sessions (user_id);

-- Painel econômico: cache de dados públicos do Banco Central e das leituras geradas pela IA.
-- Não guarda nenhum dado pessoal (a chave da leitura usa só o perfil e os números do cenário).
CREATE TABLE IF NOT EXISTS economic_indicators (
  indicator  TEXT        PRIMARY KEY CHECK (indicator IN ('selic','cdi','ipca','dolar')),
  points     JSONB       NOT NULL,                              -- [{"date":"2026-11-04","value":13.75},...]
  fetched_at TIMESTAMPTZ NOT NULL
);

-- Simulador de projeção de patrimônio: só existe quando um usuário logado salva a simulação.
-- Guarda os valores digitados e o resultado; nenhum dado pessoal novo. Conta apagada => simulação anônima (user_id nulo).
CREATE TABLE IF NOT EXISTS simulation_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  profile        TEXT        NOT NULL CHECK (profile IN ('Conservador','Moderado','Arrojado','Agressivo')),
  profile_origin TEXT        NOT NULL CHECK (profile_origin IN ('analise','exemplo')),
  input          JSONB       NOT NULL,                              -- {initial, monthly, years, goal}
  allocation     JSONB       NOT NULL,                              -- [{assetClass, percent}] usada na projeção
  rates          JSONB       NOT NULL,                              -- CDI, inflação e origem dos dados na hora da simulação
  result         JSONB       NOT NULL,                              -- projeção calculada pelo sistema
  ai_source      TEXT        NOT NULL CHECK (ai_source IN ('gemini','fallback')),
  reading        TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_user_created ON simulation_runs (user_id, created_at DESC);

-- Leituras do simulador reaproveitam esta tabela com chave 'sim|...' (hash dos números; sem dado pessoal).
-- As do perfil multidimensional também, com chave 'dim|...' (hash das notas e alertas; sem dado pessoal).
CREATE TABLE IF NOT EXISTS economic_insights (
  cache_key  TEXT        PRIMARY KEY,                           -- perfil|selic|cdi|ipca12m|juro real|tendências
  payload    JSONB       NOT NULL,                              -- leitura validada: {reading, classNotes}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
