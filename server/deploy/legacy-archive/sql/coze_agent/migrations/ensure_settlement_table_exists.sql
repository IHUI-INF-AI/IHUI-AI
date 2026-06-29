-- 确保 zhs_agent_settlement 表存在并具有正确的结构
-- 执行时间: 2025-01-11
-- 描述: 创建或更新开发者结算表，用于存储按月分割的结算记录

-- 创建表（如果不存在）
CREATE TABLE IF NOT EXISTS zhs_agent_settlement (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '主键ID',
    uuid VARCHAR(36) COMMENT '智汇社统一UUID',
    order_no VARCHAR(36) COMMENT '用户购买订单编号',
    create_time DATETIME COMMENT '创建时间',
    buy_uuid VARCHAR(36) COMMENT '购买人UUID',
    agent_id VARCHAR(64) COMMENT '智能体ID，对应botId',
    agent_name VARCHAR(128) COMMENT '智能体名称',
    prologue TEXT COMMENT '智能体开场白',
    agent_avatar VARCHAR(500) COMMENT '智能体头像URL',
    expiration_date DATETIME COMMENT '过期时间，计算后的续费过期时间',
    issue_no INT COMMENT '期号，按过期时间排序从1开始递增',
    settlement VARCHAR(2) DEFAULT '0' COMMENT '是否结算：0=未结算，1=已结算',
    withdrawal VARCHAR(2) DEFAULT '0' COMMENT '是否提现：0=未提现，1=已提现'
) COMMENT = '开发者结算表单';

-- 添加索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_settlement_uuid ON zhs_agent_settlement(uuid);
CREATE INDEX IF NOT EXISTS idx_settlement_order_no ON zhs_agent_settlement(order_no);
CREATE INDEX IF NOT EXISTS idx_settlement_buy_uuid ON zhs_agent_settlement(buy_uuid);
CREATE INDEX IF NOT EXISTS idx_settlement_agent_id ON zhs_agent_settlement(agent_id);
CREATE INDEX IF NOT EXISTS idx_settlement_create_time ON zhs_agent_settlement(create_time);
CREATE INDEX IF NOT EXISTS idx_settlement_expiration_date ON zhs_agent_settlement(expiration_date);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON zhs_agent_settlement(settlement);
CREATE INDEX IF NOT EXISTS idx_settlement_withdrawal ON zhs_agent_settlement(withdrawal);

-- 组合索引
CREATE INDEX IF NOT EXISTS idx_settlement_order_expiration ON zhs_agent_settlement(order_no, expiration_date);
CREATE INDEX IF NOT EXISTS idx_settlement_status_combo ON zhs_agent_settlement(settlement, withdrawal);

-- 检查表结构
DESCRIBE zhs_agent_settlement;
