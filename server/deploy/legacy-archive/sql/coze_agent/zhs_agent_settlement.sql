CREATE TABLE zhs_agent_settlement (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    uuid VARCHAR(36) COMMENT '智汇社统一UUID',
    order_no VARCHAR(36) COMMENT '用户购买订单编号',
    create_time DATETIME COMMENT '创建时间',
    buy_uuid VARCHAR(36) COMMENT '购买人uuid',
    agent_id VARCHAR(64) COMMENT '智能体id,对应botId',
    agent_name VARCHAR(128) COMMENT '智能体名称',
    prologue TEXT COMMENT '智能体开场白',
    agent_avatar VARCHAR(500) COMMENT '智能体头像url',
    expiration_date DATETIME COMMENT '过期时间，计算后的续费过期时间',
    settlement VARCHAR(2) COMMENT '是否结算',
    Withdrawal VARCHAR(2) COMMENT '是否提现'
) COMMENT = '开发者结算表单';
-- 添加索引
CREATE INDEX idx_settlement_order_no ON zhs_agent_settlement(order_no);
CREATE INDEX idx_settlement_status ON zhs_agent_settlement(settlement);
CREATE INDEX idx_settlement_withdrawal ON zhs_agent_settlement(withdrawal);