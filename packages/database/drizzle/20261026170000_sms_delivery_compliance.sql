-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 短信发送审计 / 退订黑名单 / 上行回复台账
-- 2026-10-26:腾讯云短信通知/营销通道接入 + 回执对账 + 营销退订合规
-- 幂等写法(IF NOT EXISTS),重复执行安全。

CREATE TABLE IF NOT EXISTS sms_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(16) NOT NULL,
  category varchar(16) NOT NULL,
  template_key varchar(48),
  template_id varchar(64),
  phone varchar(32) NOT NULL,
  status varchar(16) NOT NULL,
  reason varchar(160),
  request_id varchar(96),
  serial_no varchar(96),
  biz_type varchar(48),
  biz_id varchar(96),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_delivery_logs_phone_created_idx
  ON sms_delivery_logs (phone, created_at);
CREATE INDEX IF NOT EXISTS sms_delivery_logs_request_idx
  ON sms_delivery_logs (request_id);
CREATE INDEX IF NOT EXISTS sms_delivery_logs_serial_idx
  ON sms_delivery_logs (serial_no);
CREATE INDEX IF NOT EXISTS sms_delivery_logs_status_created_idx
  ON sms_delivery_logs (status, created_at);
CREATE INDEX IF NOT EXISTS sms_delivery_logs_category_created_idx
  ON sms_delivery_logs (category, created_at);

CREATE TABLE IF NOT EXISTS sms_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(32) NOT NULL,
  reason varchar(160),
  raw_content text,
  source varchar(16) NOT NULL DEFAULT 'reply',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sms_unsubscribes_phone_unique
  ON sms_unsubscribes (phone);

CREATE TABLE IF NOT EXISTS sms_inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(32) NOT NULL,
  content text NOT NULL,
  provider varchar(16) NOT NULL DEFAULT 'tencent',
  received_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

CREATE INDEX IF NOT EXISTS sms_inbound_messages_phone_received_idx
  ON sms_inbound_messages (phone, received_at);
CREATE INDEX IF NOT EXISTS sms_inbound_messages_received_idx
  ON sms_inbound_messages (received_at);

COMMENT ON TABLE sms_delivery_logs IS '短信发送流水与回执对账(provider/category/status/reason/request_id/serial_no)';
COMMENT ON TABLE sms_unsubscribes IS '短信退订黑名单(营销类发送前必须命中检查)';
COMMENT ON TABLE sms_inbound_messages IS '短信上行回复原文台账(退订证据链)';
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
