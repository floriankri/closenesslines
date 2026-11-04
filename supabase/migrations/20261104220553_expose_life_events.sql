BEGIN;
DROP FUNCTION public.closeness_gallery(smallint, smallint, uuid, integer);
CREATE FUNCTION public.closeness_gallery(
  p_min_age smallint, p_max_age smallint, p_cursor uuid DEFAULT NULL, p_limit integer DEFAULT 13
) RETURNS TABLE(public_id uuid, age smallint, lines jsonb, events jsonb, tagline text, created_at timestamptz, duration double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH ranked AS (
    SELECT t.public_id, t.age, t.created_at, t.lines, COALESCE(t.timeline->'events', '[]'::jsonb) AS events,
      t.timeline->>'tagline' AS tagline, COALESCE((t.timeline->>'duration')::double precision, t.age) AS duration,
      jsonb_array_length(t.lines) AS line_count,
      COALESCE((SELECT SUM(jsonb_array_length(item.value->'points'))::integer FROM jsonb_array_elements(t.lines) AS item(value)), 0)::integer AS point_count
    FROM public.closeness_timelines AS t WHERE t.published AND t.age BETWEEN p_min_age AND p_max_age
  ), anchor AS (SELECT r.line_count, r.point_count FROM ranked AS r WHERE r.public_id = p_cursor)
  SELECT r.public_id, r.age, r.lines,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('age', e.value->'age', 'type', e.value->>'type') ORDER BY (e.value->>'age')::double precision)
      FROM jsonb_array_elements(r.events) AS e(value)), '[]'::jsonb),
    r.tagline, r.created_at, r.duration
  FROM ranked AS r WHERE r.line_count >= 2 AND (
    p_cursor IS NULL OR NOT EXISTS (SELECT 1 FROM anchor) OR EXISTS (SELECT 1 FROM anchor AS a WHERE
      r.line_count < a.line_count OR (r.line_count = a.line_count AND r.point_count < a.point_count) OR
      (r.line_count = a.line_count AND r.point_count = a.point_count AND r.public_id > p_cursor)))
  ORDER BY r.line_count DESC, r.point_count DESC, r.public_id ASC LIMIT LEAST(GREATEST(p_limit, 1), 13);
$$;
REVOKE ALL ON FUNCTION public.closeness_gallery(smallint, smallint, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.closeness_gallery(smallint, smallint, uuid, integer) TO service_role;
COMMIT;
