CREATE TABLE public.skill_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name text NOT NULL,
  description text NOT NULL,
  use_case text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.skill_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_requests TO authenticated;
GRANT ALL ON public.skill_requests TO service_role;

ALTER TABLE public.skill_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_submit_request" ON public.skill_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);