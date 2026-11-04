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

CREATE TABLE IF NOT EXISTS economic_insights (
  cache_key  TEXT        PRIMARY KEY,                           -- perfil|selic|cdi|ipca12m|juro real|tendências
  payload    JSONB       NOT NULL,                              -- leitura validada: {reading, classNotes}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
