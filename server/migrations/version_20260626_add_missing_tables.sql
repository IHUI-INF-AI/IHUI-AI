-- ============================================
-- 封存前补齐: 3 个新表的 DDL 迁移脚本
-- 生成时间: 2026-06-26
-- 来源: Java ai-smart-society-java 项目
-- 数据库: PostgreSQL
-- ============================================

-- 1. 算力购买规则表 (迁移自 ai-smart-society-java: power_purchase_rule)
CREATE TABLE IF NOT EXISTS power_purchase_rule (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255),
    status INTEGER DEFAULT 0,
    is_del INTEGER DEFAULT 0,
    begin_at TIMESTAMP,
    end_at TIMESTAMP,
    pic_explain VARCHAR(512),
    field1 VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_power_purchase_status ON power_purchase_rule(status);
COMMENT ON TABLE power_purchase_rule IS '算力购买规则表 (迁移自 ai-smart-society-java)';

-- 2. 开发者订单日志表 (迁移自 ai-smart-society-java: zhs_developer_fund_logs)
CREATE TABLE IF NOT EXISTS zhs_developer_fund_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(64),
    operate INTEGER DEFAULT 0,
    amount INTEGER DEFAULT 0,
    real_amount INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 100,
    product_id VARCHAR(64),
    type INTEGER DEFAULT 0,
    operate_id VARCHAR(64),
    operated_at TIMESTAMP,
    beneficiary VARCHAR(64),
    benefit_amount VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_developer_fund_order ON zhs_developer_fund_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_developer_fund_operate ON zhs_developer_fund_logs(operate);
COMMENT ON TABLE zhs_developer_fund_logs IS '开发者订单日志表 (迁移自 ai-smart-society-java)';

-- 3. 用户系统链接表 (迁移自 ai-smart-society-java: zhs_user_sys_link)
CREATE TABLE IF NOT EXISTS zhs_user_sys_link (
    id BIGSERIAL PRIMARY KEY,
    user_uuid VARCHAR(64),
    sys_user_id VARCHAR(64),
    field1 VARCHAR(255),
    status INTEGER DEFAULT 0,
    is_del INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_sys_link_uuid ON zhs_user_sys_link(user_uuid);
CREATE INDEX IF NOT EXISTS idx_user_sys_link_sys ON zhs_user_sys_link(sys_user_id);
COMMENT ON TABLE zhs_user_sys_link IS '普通用户与系统用户对应表 (迁移自 ai-smart-society-java)';

-- 4. 用户资金信息表 (迁移自 ai-smart-society-java: UserFundInfoController)
CREATE TABLE IF NOT EXISTS zhs_user_fund_info (
    id BIGSERIAL PRIMARY KEY,
    user_uuid VARCHAR(64) NOT NULL,
    balance BIGINT DEFAULT 0,
    frozen BIGINT DEFAULT 0,
    total_recharge BIGINT DEFAULT 0,
    total_consume BIGINT DEFAULT 0,
    status INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ufi_user_uuid ON zhs_user_fund_info(user_uuid);
CREATE INDEX IF NOT EXISTS idx_ufi_status ON zhs_user_fund_info(status);
COMMENT ON TABLE zhs_user_fund_info IS '用户资金信息表 (迁移自 ai-smart-society-java)';

-- 5. 字典类型表 (迁移自 ai-smart-society-java: ZhsDictionaryController)
CREATE TABLE IF NOT EXISTS zhs_dictionary (
    id BIGSERIAL PRIMARY KEY,
    dict_type VARCHAR(64) NOT NULL,
    dict_name VARCHAR(255) NOT NULL,
    status INTEGER DEFAULT 0,
    remark TEXT,
    field1 VARCHAR(255),
    is_del INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dict_type ON zhs_dictionary(dict_type);
CREATE INDEX IF NOT EXISTS idx_dict_status ON zhs_dictionary(status);
COMMENT ON TABLE zhs_dictionary IS '字典类型表 (迁移自 ai-smart-society-java)';

-- 6. 字典数据表
CREATE TABLE IF NOT EXISTS zhs_dict_data (
    id BIGSERIAL PRIMARY KEY,
    dict_type VARCHAR(64) NOT NULL,
    dict_label VARCHAR(255) NOT NULL,
    dict_value VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    remark TEXT,
    is_del INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dd_dict_type ON zhs_dict_data(dict_type);
CREATE INDEX IF NOT EXISTS idx_dd_status ON zhs_dict_data(status);
COMMENT ON TABLE zhs_dict_data IS '字典数据表 (迁移自 ai-smart-society-java)';

-- 7. Agent 分类关联表 (迁移自 ai-smart-society-java: AgentCategoryLinkController)
CREATE TABLE IF NOT EXISTS zhs_agent_category_link (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    category_id VARCHAR(64) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 0,
    is_del INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_acl_agent ON zhs_agent_category_link(agent_id);
CREATE INDEX IF NOT EXISTS idx_acl_category ON zhs_agent_category_link(category_id);
COMMENT ON TABLE zhs_agent_category_link IS 'Agent 分类关联表 (迁移自 ai-smart-society-java)';
