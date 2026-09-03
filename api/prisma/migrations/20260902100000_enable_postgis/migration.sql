-- PostGIS-миграция (раздел 8.3 ТЗ).
-- Выполняется ТОЛЬКО в prod-стеке (образ postgis/postgis). В dev-режиме на портативном
-- Postgres расширения нет — эту миграцию Prisma безопасно пропустит, если создать
-- таблицу prisma._migrations и пометить её как applied. См. README > «Разработка».
--
-- Что делаем:
--  1) включаем расширение postgis
--  2) добавляем колонку geog GEOGRAPHY(Point, 4326) на problems и submissions
--  3) заполняем её из lat/lng существующих строк
--  4) вешаем GIST-индекс для быстрых радиус-запросов
--  5) триггер: при INSERT/UPDATE lat/lng автоматически пересчитываем geog

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE problems      ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);
ALTER TABLE submissions   ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);

UPDATE problems    SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography WHERE geog IS NULL;
UPDATE submissions SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography WHERE geog IS NULL;

CREATE INDEX IF NOT EXISTS problems_geog_idx    ON problems    USING GIST (geog);
CREATE INDEX IF NOT EXISTS submissions_geog_idx ON submissions USING GIST (geog);

-- Триггер: при любом изменении lat/lng — обновить geog. Не блокирует запись, если
-- координаты не переданы.
CREATE OR REPLACE FUNCTION set_geog_from_latlng() RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geog := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS problems_set_geog    ON problems;
DROP TRIGGER IF EXISTS submissions_set_geog ON submissions;

CREATE TRIGGER problems_set_geog    BEFORE INSERT OR UPDATE OF lat, lng ON problems
  FOR EACH ROW EXECUTE FUNCTION set_geog_from_latlng();
CREATE TRIGGER submissions_set_geog BEFORE INSERT OR UPDATE OF lat, lng ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_geog_from_latlng();
