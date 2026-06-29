CREATE TABLE zhs_agent_category (
  id varchar(36) NOT NULL DEFAULT (uuid()) COMMENT 'id',
  agent_id varchar(64) DEFAULT NULL COMMENT '智能体id,对应botId',
  agent_name varchar(128) DEFAULT NULL COMMENT '智能体名称',
  create_uuid varchar(36) DEFAULT NULL COMMENT '创建收费配置的用户，为coze平台开发者',
  create_name varchar(128) DEFAULT NULL COMMENT '创建人名称用户名',
  create_time datetime DEFAULT NULL COMMENT '创建时间',
  agent_main_category varchar(2) DEFAULT NULL COMMENT '智能体大类 1文字2图片3视频',
  agent_category varchar(2) DEFAULT NULL COMMENT '智能体细分 汽车，教育，医疗，法律 关联字典表 ID',
  type varchar(2) DEFAULT NULL COMMENT '1免费 2限免3 收费',
  type_child varchar(2) DEFAULT NULL COMMENT '售卖方式种类细分1月2年3永久',
  account int(10) DEFAULT NULL COMMENT '售卖价格 单位：分/月',
  `group` varchar(2) DEFAULT NULL COMMENT '1会员2 全部',
  limit_free varchar(2) DEFAULT NULL COMMENT '限免时长：1=1个月，2=3个月，3=6个月，4=1年',
  discount_month varchar(5) DEFAULT NULL COMMENT '折扣类型：1=6个月后八折，2=9个月后7折，3=1年后5折',
  prologue text DEFAULT NULL COMMENT '开场白',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='开发者智能体收费配置表';