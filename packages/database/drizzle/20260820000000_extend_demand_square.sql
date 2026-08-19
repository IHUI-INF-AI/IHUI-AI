ALTER TABLE "zhs_demand_square"
  ADD COLUMN IF NOT EXISTS "lowest_price" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "peak_price" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "contact" varchar(200),
  ADD COLUMN IF NOT EXISTS "cycle" varchar(50),
  ADD COLUMN IF NOT EXISTS "cycle_unit" varchar(20),
  ADD COLUMN IF NOT EXISTS "closing_time" timestamptz,
  ADD COLUMN IF NOT EXISTS "types" jsonb,
  ADD COLUMN IF NOT EXISTS "categories" jsonb;
