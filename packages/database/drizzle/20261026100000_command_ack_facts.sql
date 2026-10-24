-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- G-40 / G-734 A 格:ack 事实表(2026-10-26 立)—— 跨会话幂等事实的持久载体
--
-- 票面(逐条对应,不增不减):
--   · 主键 = 上游 `v4_command_fact` 的 `child:<parentSessionId>:<sourceCommandId>`。
--     本表用 (parent_session_id, source_command_id) 复合主键承载**同一个键**:元组形态是
--     单射的机械保证 —— 上游把两段拼成一个字符串,段内一旦含分隔符就会折槽;拆成两列后
--     不存在"从键还原元组"的环节,也就没有可折叠的段界(与 `slotKeyOf` 的 %p 父段同一条纪律)。
--     复合主键自带唯一索引,不另建一份等价的 UNIQUE INDEX(两份同一约束只会漂)。
--   · ② 事实存在但被引用的实体缺失/损坏 ⇒ 读侧抛错,绝不重建。载荷与引用分两列落:
--     `payload` 是回放值,`entity_refs` 是该事实引用的**全部**实体(规范化作用域串,与
--     `SlotLocalitySpec.refsOf` 同形);E 格"实体存活"就按这一列逐条查存在性。
--   · ③ 提交前引用局部性:child 集合不落库 —— 它由 (owner_key, parent_session_id) 现算,
--     抄一份进来就多出第二个真相。
--
-- 状态机只留两档:`processing`(已抢槽、载荷未定)/ `completed`(载荷已落)。
-- 不设 `corrupt` 档:损坏是**读**时的判定(载荷缺席/解析失败),写成列值等于把损坏洗成合法状态。
-- 载侧 CHECK 直接禁止"completed 而 payload 为空"—— 那是 ② 唯一要拦的形态(写侧不落这种事实)。
--
-- 保留期:票面未给具体天数 ⇒ 本迁移**不设 DEFAULT**。`expires_at` 由写侧填(与
-- run-idempotency 的 ttlMs 同源),NULL = 不自动过期;清理任务按本列索引扫描。
--
-- 幂等写法(本仓手写迁移口径,同 20261025120000_chat_message_sync_revs.sql)。

CREATE TABLE IF NOT EXISTS "command_ack_facts" (
    "parent_session_id" text NOT NULL,
    "source_command_id" text NOT NULL,
    "owner_key" text NOT NULL,
    "fingerprint" text NOT NULL,
    "status" text NOT NULL,
    "payload" jsonb,
    "entity_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "command_ack_facts_pkey" PRIMARY KEY ("parent_session_id", "source_command_id"),
    CONSTRAINT "command_ack_facts_status_chk" CHECK ("status" IN ('processing', 'completed')),
    CONSTRAINT "command_ack_facts_payload_state_chk" CHECK (
        ("status" = 'processing' AND "payload" IS NULL)
        OR ("status" = 'completed' AND "payload" IS NOT NULL)
    )
);

-- 保留期扫描的唯一入口(本表不设行级 TTL,过期回收靠外部任务按此列删除)。
CREATE INDEX IF NOT EXISTS "command_ack_facts_expires_at_idx"
    ON "command_ack_facts" ("expires_at");

-- 回滚(整份可逆:本表无外键、无下游依赖,删表不触碰任何既有表):
--   DROP TABLE IF EXISTS "command_ack_facts";
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
