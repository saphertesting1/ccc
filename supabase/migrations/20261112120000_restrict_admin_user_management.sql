-- Restrict changes to the trusted administrator allow-list to super admins.
-- This migration does not alter existing users or customer orders.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  ) OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super_admin';
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can insert admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can update admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can delete admin_users" ON public.admin_users;

DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view own admin record" ON public.admin_users;
CREATE POLICY "Admins can view own admin record"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()) OR public.is_super_admin());

CREATE POLICY "Super admins can insert admin_users"
    ON public.admin_users FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update admin_users"
    ON public.admin_users FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete admin_users"
    ON public.admin_users FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

NOTIFY pgrst, 'reload schema';
