-- Esquema inicial. SQL estándar: funciona igual en PostgreSQL y en H2 (modo PostgreSQL).
-- Nunca se edita una migración ya aplicada: los cambios van en V2__..., V3__..., etc.

-- Un sorteo ("Papá Noel · Familia", "Camisetas raras · Equipo"…)
CREATE TABLE draw_event (
    id             VARCHAR(36)              PRIMARY KEY,
    name           VARCHAR(60)              NOT NULL,
    budget         VARCHAR(30)              NOT NULL DEFAULT '',
    exchange_date  DATE,
    drawn_at       TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Una persona dentro de un sorteo. Quien está en dos sorteos es dos participantes,
-- cada uno con su código (único en toda la base de datos).
CREATE TABLE participant (
    id           VARCHAR(36)              PRIMARY KEY,
    event_id     VARCHAR(36)              NOT NULL REFERENCES draw_event (id) ON DELETE CASCADE,
    name         VARCHAR(40)              NOT NULL,
    code         VARCHAR(20)              NOT NULL,
    -- a quién le regala (null hasta que se hace el sorteo)
    receiver_id  VARCHAR(36)              REFERENCES participant (id) ON DELETE SET NULL,
    seen_at      TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_participant_code UNIQUE (code),
    CONSTRAINT uq_participant_event_name UNIQUE (event_id, name)
);

CREATE INDEX idx_participant_event ON participant (event_id);

-- A quién no le puede tocar a cada participante (p. ej. su pareja)
CREATE TABLE participant_exclusion (
    participant_id  VARCHAR(36) NOT NULL REFERENCES participant (id) ON DELETE CASCADE,
    excluded_id     VARCHAR(36) NOT NULL REFERENCES participant (id) ON DELETE CASCADE,
    PRIMARY KEY (participant_id, excluded_id)
);

-- Lista de deseos
CREATE TABLE wish (
    id              VARCHAR(36)   PRIMARY KEY,
    participant_id  VARCHAR(36)   NOT NULL REFERENCES participant (id) ON DELETE CASCADE,
    sort_order      INTEGER       NOT NULL,
    wish_text       VARCHAR(200)  NOT NULL,
    url             VARCHAR(2000)
);

CREATE INDEX idx_wish_participant ON wish (participant_id);

-- Sesiones (tokens Bearer). participant_id es null en las sesiones de organización.
CREATE TABLE app_session (
    token           VARCHAR(64)              PRIMARY KEY,
    participant_id  VARCHAR(36)              REFERENCES participant (id) ON DELETE CASCADE,
    admin           BOOLEAN                  NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_session_participant ON app_session (participant_id);
