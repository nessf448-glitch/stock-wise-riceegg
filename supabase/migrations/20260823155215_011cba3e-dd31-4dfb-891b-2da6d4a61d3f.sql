ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_path text;

CREATE POLICY "product_images_read_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "product_images_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product_images_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product_images_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');