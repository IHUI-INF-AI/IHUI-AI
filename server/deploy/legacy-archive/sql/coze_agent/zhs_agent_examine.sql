CREATE TABLE zhs_agent_examine (
  id varchar(36) NOT NULL DEFAULT (uuid()) COMMENT 'id',
  agent_id varchar(64) DEFAULT NULL COMMENT '智能体id,对应botId',
  agent_name varchar(128) DEFAULT NULL COMMENT '智能体名称',
  category_id varchar(36) DEFAULT NULL COMMENT '智能体收费配置ID',
  status tinyint(2) DEFAULT NULL COMMENT '智能体审核状态0:待提交1: 审核中；2: 通过（已发布）；3: 拒绝（给coze发送审核失败），4.退回（平台内重申）5.下架（智能体在coze删除或下架）',
  start_time datetime DEFAULT NULL COMMENT '发起审核时间',
  start_user varchar(64) DEFAULT NULL COMMENT '发起用户uuid',
  start_phone varchar(15) DEFAULT NULL COMMENT '发起用户手机号',
  start_name varchar(128) DEFAULT NULL COMMENT '发起用户名',
  examine_user varchar(128) DEFAULT NULL COMMENT '审核人名称',
  examine_user_id varchar(128) DEFAULT NULL COMMENT '审核人ID',
  examine_time datetime DEFAULT NULL COMMENT '审核时间',
  `desc` text DEFAULT NULL COMMENT '说明通过或者退回原因',
  follow text DEFAULT NULL COMMENT '保留审核流转记录',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='开发者智能体审核表';