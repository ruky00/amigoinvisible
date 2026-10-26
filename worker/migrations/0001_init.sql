-- Esquema inicial (D1 / SQLite). Traducción directa del que tenía el backend Java.
-- Nunca se edita una migración ya aplicada: los cambios van en 0002_..., 0003_..., etc.
-- Fechas: texto ISO-8601 en UTC con milisegundos (new Date().toISOString()), así se ordenan bien
-- como texto. exchange_date es solo fecha: YYYY-MM-DD.

-- Un sorteo ("Papá Noel · Familia", "Camisetas raras · Equipo"…)
CREATE TABLE draw_event (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    budget         TEXT NOT NULL DEFAULT '',
    exchange_date  TEXT,
    drawn_at       TEXT,
    created_at     TEXT NOT NULL
);

-- Una persona dentro de un sorteo. Quien está en dos sorteos es dos participantes,
-- cada uno con su código (único en toda la base de datos).
CREATE TABLE participant (
    id           TEXT PRIMARY KEY,
    event_id     TEXT NOT NULL REFERENCES draw_event (id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    code         TEXT NOT NULL UNIQUE,
    -- a quién le regala (null hasta que se hace el sorteo)
    receiver_id  TEXT REFERENCES participant (id) ON DELETE SET NULL,
    seen_at      TEXT,
    created_at   TEXT NOT NULL
);

CREATE INDEX idx_participant_event ON participant (event_id);
-- nombres únicos dentro del sorteo, sin distinguir mayúsculas ("luna" choca con "Luna")
CREATE UNIQUE INDEX uq_participant_event_name ON participant (event_id, name COLLATE NOCASE);

-- A quién no le puede tocar a cada participante (p. ej. su pareja)
CREATE TABLE participant_exclusion (
    participant_id  TEXT NOT NULL REFERENCES participant (id) ON DELETE CASCADE,
    excluded_id     TEXT NOT NULL REFERENCES participant (id) ON DELETE CASCADE,
    PRIMARY KEY (participant_id, excluded_id)
);

-- Lista de deseos
CREATE TABLE wish (
    id              TEXT    PRIMARY KEY,
    participant_id  TEXT    NOT NULL REFERENCES participant (id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL,
    wish_text       TEXT    NOT NULL,
    url             TEXT
);

CREATE INDEX idx_wish_participant ON wish (participant_id);

-- Sesiones (tokens Bearer). participant_id es null en las sesiones de organización.
CREATE TABLE app_session (
    token           TEXT    PRIMARY KEY,
    participant_id  TEXT    REFERENCES participant (id) ON DELETE CASCADE,
    admin           INTEGER NOT NULL,
    created_at      TEXT    NOT NULL,
    expires_at      TEXT    NOT NULL
);

CREATE INDEX idx_session_participant ON app_session (participant_id);

-- Intentos de login fallidos, para frenar a quien prueba códigos a lo loco.
-- (En el backend Java vivía en memoria; un Worker no tiene memoria compartida entre peticiones.)
CREATE TABLE login_failure (
    ip         TEXT NOT NULL,
    failed_at  TEXT NOT NULL
);

CREATE INDEX idx_login_failure_ip ON login_failure (ip, failed_at);
