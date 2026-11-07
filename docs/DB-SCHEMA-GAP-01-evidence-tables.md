<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# DB-SCHEMA-GAP-01 证据表（2026-11-07）

生产只读采集（`ihui_dev`，8810）。本文件由脚本生成，数据可复核。

## A. 28 条 FK 逐条（七列）

> 说明：采集时 #1 尚未应用，故「本表是否已有同名约束」均为 NO；第 20 行 `resource_downloads` 类型不匹配，已从 #1 移除（DB-TYPE-DRIFT-01），其余 27 条进入 #1。第 7 行 `analytics_events` 的 6 条孤儿在窗口内先按 id 精确删除（D1）。

| 表 | 引用表 | 本列类型 | 引用列类型 | 本表是否已有同名约束 | 孤儿行数 | 类型是否匹配 |
|---|---|---|---|---|---|---|
| agent_event_triggers | users.id | uuid | uuid | NO | 0 | YES |
| agent_examines | users.id | uuid | uuid | NO | 0 | YES |
| agent_memory_decay_state | users.id | uuid | uuid | NO | 0 | YES |
| agent_upload | users.id | uuid | uuid | NO | 0 | YES |
| agent_user_profile | users.id | uuid | uuid | NO | 0 | YES |
| agents | users.id | uuid | uuid | NO | 0 | YES |
| analytics_events | users.id | uuid | uuid | NO | 6 | YES |
| clawdbot_permissions | users.id | uuid | uuid | NO | 0 | YES |
| clawdbot_sessions | users.id | uuid | uuid | NO | 0 | YES |
| exam_signups | users.id | uuid | uuid | NO | 0 | YES |
| exam_wrong_question | users.id | uuid | uuid | NO | 0 | YES |
| knowledge_cards | users.id | uuid | uuid | NO | 0 | YES |
| langgraph_thread_owners | users.id | uuid | uuid | NO | 0 | YES |
| learn_community_post | users.id | uuid | uuid | NO | 0 | YES |
| lesson_rate | users.id | uuid | uuid | NO | 0 | YES |
| remote_devices | users.id | uuid | uuid | NO | 0 | YES |
| repo_wiki_docs | users.id | uuid | uuid | NO | 0 | YES |
| resource_downloads | users.id | integer | uuid | NO | 0 | NO |
| resources | users.id | uuid | uuid | NO | 0 | YES |
| tbox_device | users.id | uuid | uuid | NO | 0 | YES |
| team_memories | users.id | uuid | uuid | NO | 0 | YES |
| tool_favorites | users.id | uuid | uuid | NO | 0 | YES |
| user_automations | users.id | uuid | uuid | NO | 0 | YES |
| user_billing_group_members | users.id | uuid | uuid | NO | 0 | YES |
| user_coupons | users.id | uuid | uuid | NO | 0 | YES |
| user_memories | users.id | uuid | uuid | NO | 0 | YES |
| webhook_subscriptions | users.id | uuid | uuid | NO | 0 | YES |
| zhs_agent_examine | users.id | uuid | uuid | NO | 0 | YES |

rows=28

## B. 20260916170000 vs 20261107000000 逐对象（64 项）

> 判定口径：类型、可空性、默认值、索引列顺序、唯一性、方法、谓词、FK 动作逐字比对；名字相同不算等同。

| 对象 | `20260916170000` 应建 | `20261107000000` 实际建 | 是否等同 |
|---|---|---|---|
| table api_subscriptions | exists | exists | YES |
| column api_subscriptions.id | type=uuid null=NO default=gen_random_uuid() | type=uuid null=NO default=gen_random_uuid() | YES |
| constraint api_subscriptions_pkey | PRIMARY KEY (id) | PRIMARY KEY (id) | YES |
| column api_subscriptions.user_id | type=uuid null=NO default=- FK→users.id ON DELETE CASCADE | type=uuid null=NO default=- FK→users.id ON DELETE CASCADE | YES |
| constraint api_subscriptions_user_id_fkey | FOREIGN KEY (user_id) REFERENCES users.id ON DELETE CASCADE | FOREIGN KEY (user_id) REFERENCES users.id ON DELETE CASCADE | YES |
| column api_subscriptions.plan_id | type=uuid null=YES default=- FK→plans.id ON DELETE SET NULL | type=uuid null=YES default=- FK→plans.id ON DELETE SET NULL | YES |
| constraint api_subscriptions_plan_id_fkey | FOREIGN KEY (plan_id) REFERENCES plans.id ON DELETE SET NULL | FOREIGN KEY (plan_id) REFERENCES plans.id ON DELETE SET NULL | YES |
| column api_subscriptions.order_id | type=uuid null=YES default=- FK→orders.id ON DELETE SET NULL | type=uuid null=YES default=- FK→orders.id ON DELETE SET NULL | YES |
| constraint api_subscriptions_order_id_fkey | FOREIGN KEY (order_id) REFERENCES orders.id ON DELETE SET NULL | FOREIGN KEY (order_id) REFERENCES orders.id ON DELETE SET NULL | YES |
| column api_subscriptions.order_no | type=varchar(64) null=YES default=- | type=varchar(64) null=YES default=- | YES |
| column api_subscriptions.plan_name | type=varchar(64) null=NO default=- | type=varchar(64) null=NO default=- | YES |
| column api_subscriptions.status | type=varchar(16) null=NO default='active' | type=varchar(16) null=NO default='active' | YES |
| column api_subscriptions.start_at | type=timestamp with time zone null=NO default=now() | type=timestamp with time zone null=NO default=now() | YES |
| column api_subscriptions.end_at | type=timestamp with time zone null=NO default=- | type=timestamp with time zone null=NO default=- | YES |
| column api_subscriptions.daily_token_limit | type=bigint null=NO default=0 | type=bigint null=NO default=0 | YES |
| column api_subscriptions.weekly_token_limit | type=bigint null=NO default=0 | type=bigint null=NO default=0 | YES |
| column api_subscriptions.monthly_token_limit | type=bigint null=NO default=0 | type=bigint null=NO default=0 | YES |
| column api_subscriptions.auto_renew | type=boolean null=NO default=false | type=boolean null=NO default=false | YES |
| column api_subscriptions.created_at | type=timestamp with time zone null=NO default=now() | type=timestamp with time zone null=NO default=now() | YES |
| column api_subscriptions.updated_at | type=timestamp with time zone null=NO default=now() | type=timestamp with time zone null=NO default=now() | YES |
| table api_subscription_window_usage | exists | exists | YES |
| column api_subscription_window_usage.id | type=uuid null=NO default=gen_random_uuid() | type=uuid null=NO default=gen_random_uuid() | YES |
| constraint api_subscription_window_usage_pkey | PRIMARY KEY (id) | PRIMARY KEY (id) | YES |
| column api_subscription_window_usage.subscription_id | type=uuid null=NO default=- FK→api_subscriptions.id ON DELETE CASCADE | type=uuid null=NO default=- FK→api_subscriptions.id ON DELETE CASCADE | YES |
| constraint api_subscription_window_usage_subscription_id_fkey | FOREIGN KEY (subscription_id) REFERENCES api_subscriptions.id ON DELETE CASCADE | FOREIGN KEY (subscription_id) REFERENCES api_subscriptions.id ON DELETE CASCADE | YES |
| column api_subscription_window_usage.user_id | type=uuid null=NO default=- FK→users.id ON DELETE CASCADE | type=uuid null=NO default=- FK→users.id ON DELETE CASCADE | YES |
| constraint api_subscription_window_usage_user_id_fkey | FOREIGN KEY (user_id) REFERENCES users.id ON DELETE CASCADE | FOREIGN KEY (user_id) REFERENCES users.id ON DELETE CASCADE | YES |
| column api_subscription_window_usage.window_type | type=varchar(8) null=NO default=- | type=varchar(8) null=NO default=- | YES |
| column api_subscription_window_usage.window_start | type=timestamp with time zone null=NO default=- | type=timestamp with time zone null=NO default=- | YES |
| column api_subscription_window_usage.window_end | type=timestamp with time zone null=NO default=- | type=timestamp with time zone null=NO default=- | YES |
| column api_subscription_window_usage.tokens_used | type=bigint null=NO default=0 | type=bigint null=NO default=0 | YES |
| column api_subscription_window_usage.cost_used_cents | type=numeric(18, 6) null=NO default=0 | type=numeric(18, 6) null=NO default=0 | YES |
| column api_subscription_window_usage.created_at | type=timestamp with time zone null=NO default=now() | type=timestamp with time zone null=NO default=now() | YES |
| column api_subscription_window_usage.updated_at | type=timestamp with time zone null=NO default=now() | type=timestamp with time zone null=NO default=now() | YES |
| table relay_peak_pricing_rules | exists | exists | YES |
| column relay_peak_pricing_rules.id | type=uuid null=NO default=gen_random_uuid() | type=uuid null=NO default=gen_random_uuid() | YES |
| constraint relay_peak_pricing_rules_pkey | PRIMARY KEY (id) | PRIMARY KEY (id) | YES |
| column relay_peak_pricing_rules.name | type=varchar(64) null=NO default=- | type=varchar(64) null=NO default=- | YES |
| column relay_peak_pricing_rules.model_id | type=varchar(128) null=YES default=- | type=varchar(128) null=YES default=- | YES |
| column relay_peak_pricing_rules.provider_code | type=varchar(64) null=YES default=- | type=varchar(64) null=YES default=- | YES |
| column relay_peak_pricing_rules.days_of_week | type=jsonb null=NO default='[]'::jsonb | type=jsonb null=NO default='[]'::jsonb | YES |
| column relay_peak_pricing_rules.start_minute | type=integer null=NO default=- | type=integer null=NO default=- | YES |
| column relay_peak_pricing_rules.end_minute | type=integer null=NO default=- | type=integer null=NO default=- | YES |
| column relay_peak_pricing_rules.multiplier | type=numeric(10, 4) null=NO default=- | type=numeric(10, 4) null=NO default=- | YES |
| column relay_peak_pricing_rules.priority | type=integer null=NO default=0 | type=integer null=NO default=0 | YES |
| column relay_peak_pricing_rules.enabled | type=boolean null=NO default=true | type=boolean null=NO default=true | YES |
| column relay_peak_pricing_rules.remark | type=varchar(255) null=YES default=- | type=varchar(255) null=YES default=- | YES |
| column relay_peak_pricing_rules.created_at | type=timestamp with time zone null=NO default=now() | type=timestamp with time zone null=NO default=now() | YES |
| column relay_peak_pricing_rules.updated_at | type=timestamp with time zone null=NO default=now() | type=timestamp with time zone null=NO default=now() | YES |
| column plans.daily_token_limit | type=bigint null=NO default=0 | type=bigint null=NO default=0 | YES |
| column plans.weekly_token_limit | type=bigint null=NO default=0 | type=bigint null=NO default=0 | YES |
| column plans.monthly_token_limit | type=bigint null=NO default=0 | type=bigint null=NO default=0 | YES |
| column plans.validity_days | type=integer null=NO default=30 | type=integer null=NO default=30 | YES |
| column plans.original_price | type=integer null=NO default=0 | type=integer null=NO default=0 | YES |
| column plans.model_whitelist | type=jsonb null=NO default='[]'::jsonb | type=jsonb null=NO default='[]'::jsonb | YES |
| column plans.is_for_sale | type=boolean null=NO default=true | type=boolean null=NO default=true | YES |
| column plans.billing_group_code | type=varchar(64) null=YES default=- | type=varchar(64) null=YES default=- | YES |
| index api_subscriptions_user_status_idx | non-unique btree(user_id, status) on api_subscriptions | non-unique btree(user_id, status) on api_subscriptions | YES |
| index api_subscriptions_end_at_idx | non-unique btree(end_at) on api_subscriptions | non-unique btree(end_at) on api_subscriptions | YES |
| index api_subscriptions_order_no_idx | non-unique btree(order_no) on api_subscriptions | non-unique btree(order_no) on api_subscriptions | YES |
| index api_subscription_window_usage_uniq_idx | unique btree(subscription_id, window_type, window_start) on api_subscription_window_usage | unique btree(subscription_id, window_type, window_start) on api_subscription_window_usage | YES |
| index api_subscription_window_usage_user_idx | non-unique btree(user_id, window_type) on api_subscription_window_usage | non-unique btree(user_id, window_type) on api_subscription_window_usage | YES |
| index relay_peak_pricing_rules_enabled_idx | non-unique btree(enabled, priority) on relay_peak_pricing_rules | non-unique btree(enabled, priority) on relay_peak_pricing_rules | YES |
| index relay_peak_pricing_rules_model_idx | non-unique btree(model_id) on relay_peak_pricing_rules | non-unique btree(model_id) on relay_peak_pricing_rules | YES |

objects=64 equal=64 not_equal=0 missing_in_#2=0
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
