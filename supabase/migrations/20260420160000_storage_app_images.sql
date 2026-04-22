-- Create a public storage bucket for app images (icons, logos, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-images',
  'app-images',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/png','image/jpeg','image/jpg','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read objects in this bucket (public)
DROP POLICY IF EXISTS "Public read app-images" ON storage.objects;
CREATE POLICY "Public read app-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'app-images');

-- Allow anyone to upload objects to this bucket (admin-gated in UI)
DROP POLICY IF EXISTS "Public upload app-images" ON storage.objects;
CREATE POLICY "Public upload app-images"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'app-images');

-- Allow anyone to update/delete objects in this bucket
DROP POLICY IF EXISTS "Public update app-images" ON storage.objects;
CREATE POLICY "Public update app-images"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'app-images');

DROP POLICY IF EXISTS "Public delete app-images" ON storage.objects;
CREATE POLICY "Public delete app-images"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'app-images');

-- Also add app_logo key to app_settings if not present
INSERT INTO public.app_settings (key, value)
VALUES ('app_logo_url', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
