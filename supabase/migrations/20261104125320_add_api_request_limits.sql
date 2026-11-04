BEGIN;

-- Global quotas for the anonymous prototype. These counters deliberately do not
-- store IP addresses or identifiers. They protect the shared project while a
-- per-user identity model is not yet in scope.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.rate_limit_buckets (
  kind text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0),
  PRIMARY KEY (kind, window_start)
);

ALTER TABLE private.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.rate_limit_buckets FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_kind text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  bucket timestamptz;
BEGIN
  IF p_kind !~ '^[a-z_]{1,32}$' OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid rate-limit parameters';
  END IF;
  DELETE FROM private.rate_limit_buckets WHERE window_start < clock_timestamp() - interval '2 days';
  bucket := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  INSERT INTO private.rate_limit_buckets(kind, window_start, hits)
  VALUES (p_kind, bucket, 1)
  ON CONFLICT (kind, window_start) DO UPDATE
    SET hits = private.rate_limit_buckets.hits + 1
    WHERE private.rate_limit_buckets.hits < p_limit;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  TO service_role;

COMMIT;
