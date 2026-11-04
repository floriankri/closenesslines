BEGIN;
ALTER TABLE public.closeness_timelines ADD COLUMN created_at timestamptz;
ALTER TABLE public.closeness_timelines ALTER COLUMN created_at SET DEFAULT now();
-- Named viewing capabilities must not appear in downstream REST query URLs.
CREATE OR REPLACE FUNCTION public.closeness_named_view(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT jsonb_build_object('timeline', timeline, 'age', age, 'created_at', created_at)
  FROM public.closeness_timelines WHERE view_id = p_id;
$$;
REVOKE ALL ON FUNCTION public.closeness_named_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.closeness_named_view(uuid) TO service_role;

-- Rank public gallery entries in the database before applying the page limit.
-- The caller only receives the already-public geometry; private names stay in
-- the base table and are never selected here.
CREATE FUNCTION public.closeness_gallery(
  p_min_age smallint,
  p_max_age smallint,
  p_cursor uuid DEFAULT NULL,
  p_limit integer DEFAULT 13
) RETURNS TABLE(public_id uuid, age smallint, lines jsonb, tagline text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH ranked AS (
    SELECT t.public_id, t.age, t.created_at, t.lines, t.timeline->>'tagline' AS tagline,
      jsonb_array_length(t.lines) AS line_count,
      COALESCE((
        SELECT SUM(jsonb_array_length(item.value->'points'))::integer
        FROM jsonb_array_elements(t.lines) AS item(value)
      ), 0)::integer AS point_count
    FROM public.closeness_timelines AS t
    WHERE t.published AND t.age BETWEEN p_min_age AND p_max_age
  ), anchor AS (
    SELECT r.line_count, r.point_count
    FROM ranked AS r WHERE r.public_id = p_cursor
  )
  SELECT r.public_id, r.age, r.lines, r.tagline, r.created_at
  FROM ranked AS r
  WHERE r.line_count >= 2
    AND (
      p_cursor IS NULL OR NOT EXISTS (SELECT 1 FROM anchor) OR
      EXISTS (
        SELECT 1 FROM anchor AS a
        WHERE r.line_count < a.line_count
           OR (r.line_count = a.line_count AND r.point_count < a.point_count)
           OR (r.line_count = a.line_count AND r.point_count = a.point_count AND r.public_id > p_cursor)
      )
    )
  ORDER BY r.line_count DESC, r.point_count DESC, r.public_id ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 13);
$$;
REVOKE ALL ON FUNCTION public.closeness_gallery(smallint, smallint, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.closeness_gallery(smallint, smallint, uuid, integer) TO service_role;
COMMIT;
