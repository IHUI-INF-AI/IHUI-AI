-- Wave 16: levels seed data
INSERT INTO levels (id, level, name, min_experience, max_experience, icon, benefits) VALUES
  (gen_random_uuid(), 1, '新手', 0, 99, null, '{}'::jsonb),
  (gen_random_uuid(), 2, '学徒', 100, 499, null, '{}'::jsonb),
  (gen_random_uuid(), 3, '行家', 500, 1499, null, '{}'::jsonb),
  (gen_random_uuid(), 4, '专家', 1500, 4999, null, '{}'::jsonb),
  (gen_random_uuid(), 5, '大师', 5000, 999999999, null, '{}'::jsonb)
ON CONFLICT DO NOTHING;
