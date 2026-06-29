-- =========================================
-- 直播分类数据更新脚本
-- 用于更新 http://localhost:8100/live 页面的分类
-- 包含AI行业所有一级分类和二级分类
-- 数据库: cloud_learning_content
-- 来源: H:\历史项目存档\edu client\scripts\update_live_categories.sql
-- 归档时间: 2026-06-28（第 16 轮深度核查补齐）
-- =========================================

-- 选择数据库
USE `cloud_learning_content`;

-- 先删除现有的分类数据（如果需要全新初始化，取消下面注释）
-- TRUNCATE TABLE t_category;
-- TRUNCATE TABLE t_category_relation;
-- TRUNCATE TABLE live_channel_category_relation;

-- 添加 type 字段（如果表中还没有）
-- MySQL 5.7 不支持 IF NOT EXISTS，使用存储过程处理
DROP PROCEDURE IF EXISTS add_type_column;
DELIMITER //
CREATE PROCEDURE add_type_column()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'cloud_learning_content' 
        AND TABLE_NAME = 't_category' 
        AND COLUMN_NAME = 'type'
    ) THEN
        ALTER TABLE `t_category` ADD COLUMN `type` varchar(20) NOT NULL DEFAULT 'live' COMMENT '分类类型(live)';
    END IF;
END //
DELIMITER ;
CALL add_type_column();
DROP PROCEDURE IF EXISTS add_type_column;

-- =========================================
-- 一级分类：AI核心领域
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(1, '大语言模型(LLM)', 1, 1, 1, 1, 'https://ai-edu-res.com/category/llm.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(2, 'AI绘画与视觉', 2, 1, 1, 1, 'https://ai-edu-res.com/category/ai-art.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(3, 'AI音视频', 3, 1, 1, 1, 'https://ai-edu-res.com/category/ai-video.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(4, 'AI编程开发', 4, 1, 1, 1, 'https://ai-edu-res.com/category/ai-coding.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(5, 'AI基础技术', 5, 1, 1, 1, 'https://ai-edu-res.com/category/ai-foundation.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 一级分类：行业AI+
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(6, 'AI+医疗健康', 6, 1, 1, 1, 'https://ai-edu-res.com/category/ai-medical.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(7, 'AI+金融科技', 7, 1, 1, 1, 'https://ai-edu-res.com/category/ai-finance.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(8, 'AI+智能制造', 8, 1, 1, 1, 'https://ai-edu-res.com/category/ai-manufacture.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(9, 'AI+零售电商', 9, 1, 1, 1, 'https://ai-edu-res.com/category/ai-retail.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(10, 'AI+教育培训', 10, 1, 1, 1, 'https://ai-edu-res.com/category/ai-education.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(11, 'AI+法律政务', 11, 1, 1, 1, 'https://ai-edu-res.com/category/ai-legal.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(12, 'AI+农业科技', 12, 1, 1, 1, 'https://ai-edu-res.com/category/ai-agriculture.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(13, 'AI+交通出行', 13, 1, 1, 1, 'https://ai-edu-res.com/category/ai-transport.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(14, 'AI+能源环保', 14, 1, 1, 1, 'https://ai-edu-res.com/category/ai-energy.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(15, 'AI+文化创意', 15, 1, 1, 1, 'https://ai-edu-res.com/category/ai-creative.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：大语言模型(LLM)
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(101, 'ChatGPT应用实战', 1, 1, 0, 2, 'https://ai-edu-res.com/category/chatgpt.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(102, 'Claude技术解析', 2, 1, 0, 2, 'https://ai-edu-res.com/category/claude.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(103, '国产大模型', 3, 1, 0, 2, 'https://ai-edu-res.com/category/china-llm.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(104, '提示词工程', 4, 1, 0, 2, 'https://ai-edu-res.com/category/prompt.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(105, 'Agent智能体', 5, 1, 0, 2, 'https://ai-edu-res.com/category/agent.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(106, 'RAG检索增强', 6, 1, 0, 2, 'https://ai-edu-res.com/category/rag.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(107, '微调与训练', 7, 1, 0, 2, 'https://ai-edu-res.com/category/finetune.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI绘画与视觉
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(201, 'Stable Diffusion', 1, 1, 0, 2, 'https://ai-edu-res.com/category/sd.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(202, 'Midjourney', 2, 1, 0, 2, 'https://ai-edu-res.com/category/mj.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(203, 'DALL-E图像生成', 3, 1, 0, 2, 'https://ai-edu-res.com/category/dalle.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(204, 'ControlNet控制', 4, 1, 0, 2, 'https://ai-edu-res.com/category/controlnet.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(205, 'ComfyUI工作流', 5, 1, 0, 2, 'https://ai-edu-res.com/category/comfyui.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(206, 'AI商业设计', 6, 1, 0, 2, 'https://ai-edu-res.com/category/ai-design.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(207, 'LoRA模型训练', 7, 1, 0, 2, 'https://ai-edu-res.com/category/lora.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI音视频
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(301, 'AI语音合成(TTS)', 1, 1, 0, 2, 'https://ai-edu-res.com/category/tts.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(302, 'AI语音识别(ASR)', 2, 1, 0, 2, 'https://ai-edu-res.com/category/asr.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(303, 'AI视频生成', 3, 1, 0, 2, 'https://ai-edu-res.com/category/sora.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(304, 'AI音乐创作', 4, 1, 0, 2, 'https://ai-edu-res.com/category/ai-music.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(305, '数字人与虚拟主播', 5, 1, 0, 2, 'https://ai-edu-res.com/category/digital-human.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(306, 'AI视频剪辑', 6, 1, 0, 2, 'https://ai-edu-res.com/category/ai-edit.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI编程开发
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(401, 'AI辅助编程', 1, 1, 0, 2, 'https://ai-edu-res.com/category/copilot.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(402, 'AI代码审查', 2, 1, 0, 2, 'https://ai-edu-res.com/category/code-review.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(403, 'LLM应用开发', 3, 1, 0, 2, 'https://ai-edu-res.com/category/llm-dev.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(404, '向量数据库', 4, 1, 0, 2, 'https://ai-edu-res.com/category/vector-db.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(405, 'AI模型部署', 5, 1, 0, 2, 'https://ai-edu-res.com/category/deploy.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(406, 'AI测试自动化', 6, 1, 0, 2, 'https://ai-edu-res.com/category/ai-test.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI基础技术
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(501, '深度学习基础', 1, 1, 0, 2, 'https://ai-edu-res.com/category/deep-learning.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(502, '机器学习算法', 2, 1, 0, 2, 'https://ai-edu-res.com/category/ml.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(503, '计算机视觉(CV)', 3, 1, 0, 2, 'https://ai-edu-res.com/category/cv.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(504, '自然语言处理(NLP)', 4, 1, 0, 2, 'https://ai-edu-res.com/category/nlp.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(505, '推荐系统', 5, 1, 0, 2, 'https://ai-edu-res.com/category/recommend.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(506, '强化学习', 6, 1, 0, 2, 'https://ai-edu-res.com/category/rl.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+医疗健康
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(601, 'AI辅助诊断', 1, 1, 0, 2, 'https://ai-edu-res.com/category/ai-diagnosis.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(602, '医学影像分析', 2, 1, 0, 2, 'https://ai-edu-res.com/category/medical-imaging.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(603, '药物研发AI', 3, 1, 0, 2, 'https://ai-edu-res.com/category/drug-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(604, '健康管理AI', 4, 1, 0, 2, 'https://ai-edu-res.com/category/health-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(605, '医疗机器人', 5, 1, 0, 2, 'https://ai-edu-res.com/category/medical-robot.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+金融科技
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(701, '智能风控', 1, 1, 0, 2, 'https://ai-edu-res.com/category/risk-control.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(702, '量化交易', 2, 1, 0, 2, 'https://ai-edu-res.com/category/quant.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(703, 'AI智能投顾', 3, 1, 0, 2, 'https://ai-edu-res.com/category/robo-advisor.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(704, '金融智能客服', 4, 1, 0, 2, 'https://ai-edu-res.com/category/finance-bot.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(705, '保险科技AI', 5, 1, 0, 2, 'https://ai-edu-res.com/category/insurtech.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+智能制造
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(801, '工业质检AI', 1, 1, 0, 2, 'https://ai-edu-res.com/category/quality-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(802, '智能仓储物流', 2, 1, 0, 2, 'https://ai-edu-res.com/category/warehouse-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(803, '预测性维护', 3, 1, 0, 2, 'https://ai-edu-res.com/category/predictive.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(804, '工业机器人', 4, 1, 0, 2, 'https://ai-edu-res.com/category/industrial-robot.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(805, '数字孪生', 5, 1, 0, 2, 'https://ai-edu-res.com/category/digital-twin.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+零售电商
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(901, '智能推荐系统', 1, 1, 0, 2, 'https://ai-edu-res.com/category/recommend-sys.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(902, '虚拟试衣试妆', 2, 1, 0, 2, 'https://ai-edu-res.com/category/virtual-try.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(903, '智能客服机器人', 3, 1, 0, 2, 'https://ai-edu-res.com/category/chatbot.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(904, '供应链AI优化', 4, 1, 0, 2, 'https://ai-edu-res.com/category/supply-chain.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(905, '智能定价策略', 5, 1, 0, 2, 'https://ai-edu-res.com/category/pricing-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+教育培训
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(1001, '智能备课系统', 1, 1, 0, 2, 'https://ai-edu-res.com/category/lesson-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1002, 'AI批改作业', 2, 1, 0, 2, 'https://ai-edu-res.com/category/grading-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1003, '个性化学习', 3, 1, 0, 2, 'https://ai-edu-res.com/category/adaptive-learning.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1004, '虚拟教师助手', 4, 1, 0, 2, 'https://ai-edu-res.com/category/virtual-teacher.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1005, '教育数据分析', 5, 1, 0, 2, 'https://ai-edu-res.com/category/edu-analytics.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+法律政务
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(1101, '智能法律咨询', 1, 1, 0, 2, 'https://ai-edu-res.com/category/legal-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1102, '合同审核AI', 2, 1, 0, 2, 'https://ai-edu-res.com/category/contract-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1103, '智慧政务', 3, 1, 0, 2, 'https://ai-edu-res.com/category/gov-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1104, '司法辅助AI', 4, 1, 0, 2, 'https://ai-edu-res.com/category/judicial-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1105, '合规风险检测', 5, 1, 0, 2, 'https://ai-edu-res.com/category/compliance-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+农业科技
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(1201, '智能灌溉', 1, 1, 0, 2, 'https://ai-edu-res.com/category/irrigation-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1202, '病虫害识别', 2, 1, 0, 2, 'https://ai-edu-res.com/category/pest-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1203, '产量预测', 3, 1, 0, 2, 'https://ai-edu-res.com/category/yield-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1204, '农业机器人', 4, 1, 0, 2, 'https://ai-edu-res.com/category/agri-robot.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1205, '精准农业', 5, 1, 0, 2, 'https://ai-edu-res.com/category/precision-agri.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+交通出行
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(1301, '自动驾驶', 1, 1, 0, 2, 'https://ai-edu-res.com/category/autonomous.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1302, '智能交通管理', 2, 1, 0, 2, 'https://ai-edu-res.com/category/traffic-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1303, '物流配送AI', 3, 1, 0, 2, 'https://ai-edu-res.com/category/logistics-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1304, '出行规划AI', 4, 1, 0, 2, 'https://ai-edu-res.com/category/trip-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1305, '车联网AI', 5, 1, 0, 2, 'https://ai-edu-res.com/category/v2x-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+能源环保
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(1401, '智能电网', 1, 1, 0, 2, 'https://ai-edu-res.com/category/smart-grid.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1402, '能耗优化', 2, 1, 0, 2, 'https://ai-edu-res.com/category/energy-opt.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1403, '环境监测AI', 3, 1, 0, 2, 'https://ai-edu-res.com/category/env-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1404, '碳排放管理', 4, 1, 0, 2, 'https://ai-edu-res.com/category/carbon-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1405, '新能源预测', 5, 1, 0, 2, 'https://ai-edu-res.com/category/renewable-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 二级分类：AI+文化创意
-- =========================================
INSERT INTO `t_category` (`id`, `name`, `sort_order`, `is_show`, `is_show_index`, `level`, `image`, `type`, `create_time`, `update_time`, `company_id`, `department_id`, `create_user_id`) VALUES
(1501, 'AI写作创作', 1, 1, 0, 2, 'https://ai-edu-res.com/category/ai-writing.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1502, 'AI游戏开发', 2, 1, 0, 2, 'https://ai-edu-res.com/category/game-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1503, '虚拟偶像', 3, 1, 0, 2, 'https://ai-edu-res.com/category/virtual-idol.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1504, 'AI影视特效', 4, 1, 0, 2, 'https://ai-edu-res.com/category/vfx-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1),
(1505, '文化遗产数字化', 5, 1, 0, 2, 'https://ai-edu-res.com/category/heritage-ai.jpg', 'live', NOW(), NOW(), 1, 1, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `sort_order`=VALUES(`sort_order`), `update_time`=NOW();

-- =========================================
-- 分类关系数据
-- =========================================
-- 一级分类的关系(父节点为0)
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(1, 1, 0, 0, 1, NOW(), NOW()),
(2, 2, 0, 0, 1, NOW(), NOW()),
(3, 3, 0, 0, 1, NOW(), NOW()),
(4, 4, 0, 0, 1, NOW(), NOW()),
(5, 5, 0, 0, 1, NOW(), NOW()),
(6, 6, 0, 0, 1, NOW(), NOW()),
(7, 7, 0, 0, 1, NOW(), NOW()),
(8, 8, 0, 0, 1, NOW(), NOW()),
(9, 9, 0, 0, 1, NOW(), NOW()),
(10, 10, 0, 0, 1, NOW(), NOW()),
(11, 11, 0, 0, 1, NOW(), NOW()),
(12, 12, 0, 0, 1, NOW(), NOW()),
(13, 13, 0, 0, 1, NOW(), NOW()),
(14, 14, 0, 0, 1, NOW(), NOW()),
(15, 15, 0, 0, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- 大语言模型(LLM)的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(101, 101, 1, 1, 1, NOW(), NOW()),
(102, 102, 1, 1, 1, NOW(), NOW()),
(103, 103, 1, 1, 1, NOW(), NOW()),
(104, 104, 1, 1, 1, NOW(), NOW()),
(105, 105, 1, 1, 1, NOW(), NOW()),
(106, 106, 1, 1, 1, NOW(), NOW()),
(107, 107, 1, 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI绘画与视觉的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(201, 201, 2, 2, 1, NOW(), NOW()),
(202, 202, 2, 2, 1, NOW(), NOW()),
(203, 203, 2, 2, 1, NOW(), NOW()),
(204, 204, 2, 2, 1, NOW(), NOW()),
(205, 205, 2, 2, 1, NOW(), NOW()),
(206, 206, 2, 2, 1, NOW(), NOW()),
(207, 207, 2, 2, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI音视频的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(301, 301, 3, 3, 1, NOW(), NOW()),
(302, 302, 3, 3, 1, NOW(), NOW()),
(303, 303, 3, 3, 1, NOW(), NOW()),
(304, 304, 3, 3, 1, NOW(), NOW()),
(305, 305, 3, 3, 1, NOW(), NOW()),
(306, 306, 3, 3, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI编程开发的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(401, 401, 4, 4, 1, NOW(), NOW()),
(402, 402, 4, 4, 1, NOW(), NOW()),
(403, 403, 4, 4, 1, NOW(), NOW()),
(404, 404, 4, 4, 1, NOW(), NOW()),
(405, 405, 4, 4, 1, NOW(), NOW()),
(406, 406, 4, 4, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI基础技术的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(501, 501, 5, 5, 1, NOW(), NOW()),
(502, 502, 5, 5, 1, NOW(), NOW()),
(503, 503, 5, 5, 1, NOW(), NOW()),
(504, 504, 5, 5, 1, NOW(), NOW()),
(505, 505, 5, 5, 1, NOW(), NOW()),
(506, 506, 5, 5, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+医疗健康的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(601, 601, 6, 6, 1, NOW(), NOW()),
(602, 602, 6, 6, 1, NOW(), NOW()),
(603, 603, 6, 6, 1, NOW(), NOW()),
(604, 604, 6, 6, 1, NOW(), NOW()),
(605, 605, 6, 6, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+金融科技的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(701, 701, 7, 7, 1, NOW(), NOW()),
(702, 702, 7, 7, 1, NOW(), NOW()),
(703, 703, 7, 7, 1, NOW(), NOW()),
(704, 704, 7, 7, 1, NOW(), NOW()),
(705, 705, 7, 7, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+智能制造的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(801, 801, 8, 8, 1, NOW(), NOW()),
(802, 802, 8, 8, 1, NOW(), NOW()),
(803, 803, 8, 8, 1, NOW(), NOW()),
(804, 804, 8, 8, 1, NOW(), NOW()),
(805, 805, 8, 8, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+零售电商的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(901, 901, 9, 9, 1, NOW(), NOW()),
(902, 902, 9, 9, 1, NOW(), NOW()),
(903, 903, 9, 9, 1, NOW(), NOW()),
(904, 904, 9, 9, 1, NOW(), NOW()),
(905, 905, 9, 9, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+教育培训的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(1001, 1001, 10, 10, 1, NOW(), NOW()),
(1002, 1002, 10, 10, 1, NOW(), NOW()),
(1003, 1003, 10, 10, 1, NOW(), NOW()),
(1004, 1004, 10, 10, 1, NOW(), NOW()),
(1005, 1005, 10, 10, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+法律政务的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(1101, 1101, 11, 11, 1, NOW(), NOW()),
(1102, 1102, 11, 11, 1, NOW(), NOW()),
(1103, 1103, 11, 11, 1, NOW(), NOW()),
(1104, 1104, 11, 11, 1, NOW(), NOW()),
(1105, 1105, 11, 11, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+农业科技的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(1201, 1201, 12, 12, 1, NOW(), NOW()),
(1202, 1202, 12, 12, 1, NOW(), NOW()),
(1203, 1203, 12, 12, 1, NOW(), NOW()),
(1204, 1204, 12, 12, 1, NOW(), NOW()),
(1205, 1205, 12, 12, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+交通出行的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(1301, 1301, 13, 13, 1, NOW(), NOW()),
(1302, 1302, 13, 13, 1, NOW(), NOW()),
(1303, 1303, 13, 13, 1, NOW(), NOW()),
(1304, 1304, 13, 13, 1, NOW(), NOW()),
(1305, 1305, 13, 13, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+能源环保的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(1401, 1401, 14, 14, 1, NOW(), NOW()),
(1402, 1402, 14, 14, 1, NOW(), NOW()),
(1403, 1403, 14, 14, 1, NOW(), NOW()),
(1404, 1404, 14, 14, 1, NOW(), NOW()),
(1405, 1405, 14, 14, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- AI+文化创意的子分类关系
INSERT INTO `t_category_relation` (`id`, `child_category_id`, `father_category_id`, `direct_father_category_id`, `is_sub`, `create_time`, `update_time`) VALUES
(1501, 1501, 15, 15, 1, NOW(), NOW()),
(1502, 1502, 15, 15, 1, NOW(), NOW()),
(1503, 1503, 15, 15, 1, NOW(), NOW()),
(1504, 1504, 15, 15, 1, NOW(), NOW()),
(1505, 1505, 15, 15, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE `update_time`=NOW();

-- =========================================
-- 完成
-- =========================================
SELECT '直播分类数据更新完成！' AS message;
SELECT COUNT(*) AS '一级分类数量' FROM t_category WHERE level = 1;
SELECT COUNT(*) AS '二级分类数量' FROM t_category WHERE level = 2;
