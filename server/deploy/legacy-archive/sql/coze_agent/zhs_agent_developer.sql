CREATE TABLE zhs_agent_developer (
  id varchar(36) NOT NULL DEFAULT (uuid()) COMMENT 'id',
  uuid varchar(36) DEFAULT NULL COMMENT '智汇社统一ID',
  user_name varchar(128) DEFAULT NULL COMMENT '智汇社用户名称',
  creator_id varchar(128) DEFAULT NULL COMMENT '创建者用户ID，对应Coze的user_id',
  creator_name varchar(128) DEFAULT NULL COMMENT '创建者用户名，对应Coze的user_name',
  bug_time datetime DEFAULT NULL COMMENT '购买时间',
  type varchar(2) DEFAULT NULL COMMENT '购买类型0 月 1 年',
  count int(2) DEFAULT NULL COMMENT '整数 单位：个',
  expiration_date datetime DEFAULT NULL COMMENT '过期时间，计算后的续费过期时间',
  order_no varchar(64) DEFAULT NULL COMMENT '订单编号，格式：WXK+年月日+6位数自增，如：WXK20250811000001',
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no) COMMENT '订单编号唯一索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='开发者续费表';