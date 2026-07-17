-- Tighten skill_requests RLS: replace overly permissive WITH CHECK (true)
-- with validation constraints. No SELECT policy exists, so reads remain denied
-- (submitted emails are not readable by anon/authenticated).

DROP POLICY IF EXISTS "anyone_can_submit_request" ON public.skill_requests;

CREATE POLICY "anyone_can_submit_request"
  ON public.skill_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(skill_name) BETWEEN 1 AND 200
    AND length(description) BETWEEN 1 AND 2000
    AND (use_case IS NULL OR length(use_case) <= 2000)
    AND (
      email IS NULL
      OR (length(email) <= 255 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    )
  );

-- Ensure anon cannot read submitted emails (revoke any implicit SELECT)
REVOKE SELECT ON public.skill_requests FROM anon;
REVOKE SELECT ON public.skill_requests FROM authenticated;