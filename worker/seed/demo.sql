-- Sorteos de ejemplo, los mismos que el simulador del front (seed() en src/api/mock.ts) y con los
-- mismos códigos: así NIEVE-42 (el de la portada) funciona nada más cargarlos.
--   npm run db:seed:local
-- Se puede repetir: primero borra los suyos (el resto de la base no se toca).
-- Solo para probar: en producción nunca hace falta.

DELETE FROM draw_event WHERE id IN ('demo-familia', 'demo-equipo');

-- La familia se crea un poco antes, para que "Mis sorteos" salga siempre en el mismo orden.
-- Ya sorteada, para poder ver el sobre nada más entrar.
INSERT INTO draw_event (id, name, budget, exchange_date, drawn_at, created_at) VALUES
  ('demo-familia', 'Papá Noel · Familia', '25 €', '2026-12-24', '2026-11-01T10:00:00.000Z', '2026-11-01T09:59:00.000Z'),
  ('demo-equipo', 'Camisetas raras · Equipo', '15 €', '2026-12-19', NULL, '2026-11-01T10:00:00.000Z');

-- created_at creciente: es el orden de la lista
INSERT INTO participant (id, event_id, name, code, created_at) VALUES
  ('demo-f-luna',   'demo-familia', 'Luna',          'NIEVE-42',    '2026-11-01T09:59:00.001Z'),
  ('demo-f-carlos', 'demo-familia', 'Carlos',        'RENO-11',     '2026-11-01T09:59:00.002Z'),
  ('demo-f-carmen', 'demo-familia', 'Abuela Carmen', 'TURRON-23',   '2026-11-01T09:59:00.003Z'),
  ('demo-f-paco',   'demo-familia', 'Tío Paco',      'ACEBO-35',    '2026-11-01T09:59:00.004Z'),
  ('demo-f-marta',  'demo-familia', 'Marta',         'ESTRELLA-47', '2026-11-01T09:59:00.005Z'),
  ('demo-e-luna',   'demo-equipo',  'Luna',          'TRINEO-58',   '2026-11-01T10:00:00.001Z'),
  ('demo-e-dani',   'demo-equipo',  'Dani',          'COMETA-62',   '2026-11-01T10:00:00.002Z'),
  ('demo-e-irene',  'demo-equipo',  'Irene',         'VELA-74',     '2026-11-01T10:00:00.003Z'),
  ('demo-e-rober',  'demo-equipo',  'Rober',         'BELEN-86',    '2026-11-01T10:00:00.004Z');

-- Parejas de la familia (un ciclo fijo: nadie se regala a sí mismo). Van después de crear a
-- todos porque receiver_id apunta a otro participante.
UPDATE participant SET receiver_id = CASE id
    WHEN 'demo-f-luna'   THEN 'demo-f-carmen'
    WHEN 'demo-f-carmen' THEN 'demo-f-marta'
    WHEN 'demo-f-marta'  THEN 'demo-f-carlos'
    WHEN 'demo-f-carlos' THEN 'demo-f-paco'
    WHEN 'demo-f-paco'   THEN 'demo-f-luna'
  END
  WHERE event_id = 'demo-familia';

INSERT INTO wish (id, participant_id, sort_order, wish_text, url) VALUES
  ('demo-w-paco-1', 'demo-f-paco', 0, 'Un buen jamón (o medio, no soy exigente)', NULL),
  ('demo-w-paco-2', 'demo-f-paco', 1, 'Bufanda de lana gris', 'https://example.com/bufanda');
