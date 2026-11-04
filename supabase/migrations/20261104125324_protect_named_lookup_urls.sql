BEGIN;
-- Named viewing capabilities must not appear in downstream REST query URLs.
CREATE FUNCTION public.closeness_named_view(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT jsonb_build_object('timeline', timeline, 'age', age)
  FROM public.closeness_timelines WHERE view_id = p_id;
$$;
REVOKE ALL ON FUNCTION public.closeness_named_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.closeness_named_view(uuid) TO service_role;
COMMIT;
