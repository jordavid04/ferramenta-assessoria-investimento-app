-- Esquema inicial do MVP (PostgreSQL). Aplicado por `npm run db:init`.
-- Decisão de privacidade (LGPD): o MVP NÃO exige cadastro nem guarda dados pessoais
-- identificáveis; apenas as respostas do questionário e o resultado, de forma anônima.

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

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON suitability_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON suitability_sessions (profile);
