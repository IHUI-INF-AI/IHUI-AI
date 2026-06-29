-- 开发者关联表
-- 用于存储Coze开发者与智汇社用户的关联关系

CREATE TABLE zhs_developer_link (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '主键ID',
    user_uuid VARCHAR(36) NOT NULL COMMENT '用户UUID，对应connector_user_id',
    coze_id VARCHAR(128) COMMENT 'Coze用户ID，对应user_id',
    coze_name VARCHAR(128) COMMENT 'Coze用户名，对应user_name',
    type VARCHAR(2) DEFAULT '0' COMMENT '用户类型：0=外部用户，1=企业用户',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT = '开发者关联表';

-- 添加索引
CREATE UNIQUE INDEX uk_user_uuid ON zhs_developer_link(user_uuid) COMMENT '用户UUID唯一索引';
CREATE INDEX idx_coze_id ON zhs_developer_link(coze_id) COMMENT 'Coze用户ID索引';
CREATE INDEX idx_type ON zhs_developer_link(type) COMMENT '用户类型索引';
CREATE INDEX idx_created_at ON zhs_developer_link(created_at) COMMENT '创建时间索引';
