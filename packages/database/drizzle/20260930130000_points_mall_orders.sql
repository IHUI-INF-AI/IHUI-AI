-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍‌‌‌‌​‌​‍‍‌‌​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌​‍‍‌​‌‌​‌​‍‍​‌‌​‌‌‌‌‍‍‌‌​‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍‌​‌​​​​‍‍‌​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍‌​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- G-978078(2026-09-30 立):积分商城兑换订单表。
-- 商品表 points_mall_products(admin-console 域)与 admin CRUD 原已存在,但用户端
-- GET/POST /points/redeem 此前不存在(RN PointsMallScreen 悬空调用,"积分有赚无处花")。
-- 本表补齐兑换动作的持久化:限购判定与对账全靠它;积分扣减流水仍在
-- point_transactions(spendPoints 写入,source='mall-redeem')。
-- 全部为加表/加索引,无 DROP、无既有列变更。

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_mall_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"points_cost" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "points_mall_orders" ADD CONSTRAINT "points_mall_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "points_mall_orders" ADD CONSTRAINT "points_mall_orders_product_id_points_mall_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."points_mall_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "points_mall_orders_user_product_idx" ON "points_mall_orders" USING btree ("user_id", "product_id");
