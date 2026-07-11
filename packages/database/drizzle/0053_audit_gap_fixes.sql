-- Migration 0053: 审计缺口修复 (D盘历史项目迁移完整性补齐)
-- 创建时间: 2026-07-11
-- 描述: 迁移自旧架构的 7 张缺失表，覆盖 agent_rule/certificate/usercenter/system/agents 模块

-- ===== 智能体规则关联表 =====
CREATE TABLE IF NOT EXISTS agent_rule_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES agent_rule(id) ON DELETE CASCADE,
  target_type VARCHAR(32) NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_link_rule_id ON agent_rule_link(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_link_target ON agent_rule_link(target_type, target_id);

-- ===== 智能体规则参数表 =====
CREATE TABLE IF NOT EXISTS agent_rule_param (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES agent_rule(id) ON DELETE CASCADE,
  param_name VARCHAR(100) NOT NULL,
  param_value TEXT,
  param_type VARCHAR(32) DEFAULT 'string',
  sort INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_param_rule_id ON agent_rule_param(rule_id);

-- ===== 智能体上传记录表 =====
CREATE TABLE IF NOT EXISTS agent_upload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  file_type VARCHAR(50),
  mime_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_upload_agent_id ON agent_upload(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_upload_user_id ON agent_upload(user_id);

-- ===== 证书序列号表 =====
CREATE TABLE IF NOT EXISTS certificate_serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
  serial_number VARCHAR(64) NOT NULL,
  issued_to VARCHAR(100),
  issued_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS certificate_serial_numbers_certificate_id_idx ON certificate_serial_numbers(certificate_id);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_serial_numbers_serial_number_uniq ON certificate_serial_numbers(serial_number);

-- ===== 部门层级关系表 =====
CREATE TABLE IF NOT EXISTS department_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_dept_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  child_dept_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  relation_type VARCHAR(20) DEFAULT 'parent-child',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS department_relations_parent_idx ON department_relations(parent_dept_id);
CREATE INDEX IF NOT EXISTS department_relations_child_idx ON department_relations(child_dept_id);

-- ===== 支付配置表 =====
CREATE TABLE IF NOT EXISTS payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  environment VARCHAR(20) DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_configs_provider_idx ON payment_configs(provider);

-- ===== 智能体分类关联表 =====
CREATE TABLE IF NOT EXISTS agent_category_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(agent_id) ON DELETE CASCADE,
  category_id UUID REFERENCES agent_categories(category_id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  sort INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_category_links_agent_idx ON agent_category_links(agent_id);
CREATE INDEX IF NOT EXISTS agent_category_links_category_idx ON agent_category_links(category_id);
