ALTER TABLE "ai_model_config_models" ADD COLUMN IF NOT EXISTS "cost_input_price_per_1k" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "ai_model_config_models" ADD COLUMN IF NOT EXISTS "cost_output_price_per_1k" numeric(18, 6);
