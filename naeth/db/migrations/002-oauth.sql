-- Migracion 002 · tablas OAuth (Fase 3b). LOCALES, no se sincronizan (como `job`):
-- son estado de autorizacion de ESTE nodo. Idempotente (IF NOT EXISTS).

-- Clientes registrados via DCR (RFC 7591). client_data = OAuthClientInformationFull serializado.
CREATE TABLE IF NOT EXISTS oauth_client (
    client_id   text PRIMARY KEY,
    client_data jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Peticiones de autorizacion pendientes de login (puente authorize -> /login).
CREATE TABLE IF NOT EXISTS oauth_pending (
    id         text PRIMARY KEY,
    client_id  text NOT NULL,
    params     jsonb NOT NULL,                 -- AuthorizationParams serializado
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Codigos de autorizacion (de un solo uso). code_data = AuthorizationCode serializado.
CREATE TABLE IF NOT EXISTS oauth_code (
    code       text PRIMARY KEY,
    client_id  text NOT NULL,
    code_data  jsonb NOT NULL,
    used       boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Tokens emitidos (access y refresh). token_data = AccessToken/RefreshToken serializado.
CREATE TABLE IF NOT EXISTS oauth_token (
    token        text PRIMARY KEY,
    kind         text NOT NULL CHECK (kind IN ('access', 'refresh')),
    client_id    text NOT NULL,
    token_data   jsonb NOT NULL,
    paired_token text,                          -- el access<->refresh asociado (rotacion/revoke)
    revoked      boolean NOT NULL DEFAULT false,
    expires_at   timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_token_kind_idx ON oauth_token (kind) WHERE NOT revoked;
