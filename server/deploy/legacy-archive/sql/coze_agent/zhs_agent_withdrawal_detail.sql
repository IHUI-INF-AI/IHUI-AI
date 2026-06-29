-- 智能体提现明细表
-- 用于记录开发者的提现申请和处理详情

CREATE TABLE zhs_agent_withdrawal_detail (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '主键ID',
    user_id VARCHAR(36) COMMENT '用户ID',
    withdrawal_no VARCHAR(36) UNIQUE COMMENT '提现单号',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    -- 提现信息
    amount DECIMAL(10,2) COMMENT '提现金额',
    type VARCHAR(2) DEFAULT '1' COMMENT '提现类型：1=银行卡，2=支付宝，3=微信',
    open_id VARCHAR(128) COMMENT '开放ID',
    order_ids TEXT COMMENT '关联的订单ID',

    -- 状态信息
    status VARCHAR(2) DEFAULT '0' COMMENT '提现状态：0=待审核，1=审核通过，2=提现中，3=提现成功，4=提现失败，5=已拒绝',

    -- 审核信息
    review_user VARCHAR(128) COMMENT '审核人',
    review_time DATETIME COMMENT '审核时间',
    review_remark TEXT COMMENT '审核备注',

    -- 处理信息
    process_user VARCHAR(128) COMMENT '处理人',
    process_time DATETIME COMMENT '处理时间',
    process_remark TEXT COMMENT '处理备注',

    -- 完成信息
    complete_time DATETIME COMMENT '完成时间',
    transaction_id VARCHAR(64) COMMENT '交易流水号',

    -- 失败信息
    failure_reason TEXT COMMENT '失败原因',

    -- 扩展字段
    remark TEXT COMMENT '备注',
    extra_data JSON COMMENT '扩展数据'
) COMMENT = '智能体提现明细表';

-- 添加索引
CREATE INDEX idx_withdrawal_user_id ON zhs_agent_withdrawal_detail(user_id);
CREATE INDEX idx_withdrawal_no ON zhs_agent_withdrawal_detail(withdrawal_no);
CREATE INDEX idx_withdrawal_status ON zhs_agent_withdrawal_detail(status);
CREATE INDEX idx_withdrawal_type ON zhs_agent_withdrawal_detail(type);
CREATE INDEX idx_withdrawal_create_time ON zhs_agent_withdrawal_detail(create_time);
CREATE INDEX idx_withdrawal_review_time ON zhs_agent_withdrawal_detail(review_time);
CREATE INDEX idx_withdrawal_complete_time ON zhs_agent_withdrawal_detail(complete_time);

-- 组合索引
CREATE INDEX idx_withdrawal_status_time ON zhs_agent_withdrawal_detail(status, create_time);
CREATE INDEX idx_withdrawal_user_status ON zhs_agent_withdrawal_detail(user_id, status);
