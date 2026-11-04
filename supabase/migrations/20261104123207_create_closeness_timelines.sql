BEGIN;

CREATE TABLE public.closeness_timelines (
  public_id uuid PRIMARY KEY,
  view_id uuid NOT NULL UNIQUE,
  edit_hash text NOT NULL UNIQUE CHECK (edit_hash ~ '^[0-9a-f]{64}$'),
  timeline jsonb NOT NULL CHECK (jsonb_typeof(timeline) = 'object'),
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  age smallint NOT NULL CHECK (age BETWEEN 0 AND 200),
  published boolean NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  CHECK (public_id <> view_id)
);

CREATE INDEX closeness_timelines_gallery_idx
  ON public.closeness_timelines (public_id, age)
  WHERE published;

ALTER TABLE public.closeness_timelines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.closeness_timelines FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.closeness_timelines TO service_role;
GRANT UPDATE (timeline, lines, age, published, revision) ON TABLE public.closeness_timelines TO service_role;

COMMIT;
