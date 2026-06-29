-- ==========================================
-- agent_heat_stats 表创建脚本
-- 用于存储智能体热度统计数据
-- ==========================================

CREATE TABLE agent_heat_stats (
  id varchar(36) NOT NULL DEFAULT (uuid()) COMMENT '主键ID',
  bot_id varchar(64) NOT NULL COMMENT '智能体bot_id',
  agent_name varchar(255) DEFAULT NULL COMMENT '智能体名称',
  
  -- 统计时间
  stat_hour datetime NOT NULL COMMENT '统计小时（精确到小时，如：2025-08-09 10:00:00）',
  stat_date date NOT NULL COMMENT '统计日期',
  
  -- 使用统计
  hourly_usage_count int(11) DEFAULT 0 COMMENT '该小时内的使用次数',
  total_usage_count int(11) DEFAULT 0 COMMENT '截止到该小时的总使用次数',
  
  -- 用户统计
  unique_users_count int(11) DEFAULT 0 COMMENT '该小时内的独立用户数',
  total_unique_users int(11) DEFAULT 0 COMMENT '截止到该小时的总独立用户数',
  
  -- 热度计算
  heat_score decimal(10,2) DEFAULT 0.00 COMMENT '热度分数（综合计算）',
  
  -- 排名信息
  usage_rank int(11) DEFAULT 0 COMMENT '使用次数排名',
  heat_rank int(11) DEFAULT 0 COMMENT '热度排名',
  
  -- 时间戳
  created_at datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (id),
  UNIQUE KEY uk_bot_stat_hour (bot_id, stat_hour),
  KEY idx_stat_hour (stat_hour),
  KEY idx_stat_date (stat_date),
  KEY idx_bot_id (bot_id),
  KEY idx_heat_score (heat_score DESC),
  KEY idx_usage_rank (usage_rank),
  KEY idx_heat_rank (heat_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='智能体热度统计表';

-- ==========================================
-- 说明：
-- 1. stat_hour 精确到小时，用于按小时统计
-- 2. hourly_usage_count 记录该小时内的新增使用次数
-- 3. total_usage_count 记录截止到该小时的累计使用次数
-- 4. unique_users_count 记录该小时内的独立用户数
-- 5. heat_score 综合热度分数，可以根据使用次数、用户数等计算
-- 6. 使用唯一索引确保每个智能体每小时只有一条记录
-- ==========================================
