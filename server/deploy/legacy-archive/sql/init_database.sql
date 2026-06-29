/*
 Navicat Premium Dump SQL

 Source Server         : ai智汇社服务器
 Source Server Type    : MySQL
 Source Server Version : 80044 (8.0.44-0ubuntu0.24.04.1)
 Source Host           : 47.94.40.108:3306
 Source Schema         : cloud_learning_content

 Target Server Type    : MySQL
 Target Server Version : 80044 (8.0.44-0ubuntu0.24.04.1)
 File Encoding         : 65001

 Date: 28/01/2026 18:07:53
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for DATABASECHANGELOGLOCK
-- ----------------------------
DROP TABLE IF EXISTS `DATABASECHANGELOGLOCK`;
CREATE TABLE `DATABASECHANGELOGLOCK`  (
                                          `ID` int NOT NULL,
                                          `LOCKED` bit(1) NOT NULL,
                                          `LOCKGRANTED` datetime NULL DEFAULT NULL,
                                          `LOCKEDBY` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                          PRIMARY KEY (`ID`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of DATABASECHANGELOGLOCK
-- ----------------------------
INSERT INTO `DATABASECHANGELOGLOCK` VALUES (1, b'0', NULL, NULL);

-- ----------------------------
-- Table structure for circle_category
-- ----------------------------
DROP TABLE IF EXISTS `circle_category`;
CREATE TABLE `circle_category`  (
                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                    `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '分类名称',
                                    `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                    `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                    `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                    `level` int NOT NULL COMMENT '目录等级',
                                    `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '圈子分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of circle_category
-- ----------------------------
INSERT INTO `circle_category` VALUES (1, '技术交流', 1, 1, 1, 1, 'https://example.com/images/tech.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (2, '职场发展', 2, 1, 1, 1, 'https://example.com/images/career.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (3, '编程语言', 3, 1, 0, 2, 'https://example.com/images/programming.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (4, '产品设计', 4, 1, 1, 1, 'https://example.com/images/design.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (5, '运营推广', 5, 1, 0, 1, 'https://example.com/images/marketing.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (6, 'Java开发', 1, 1, 0, 2, 'https://example.com/images/java.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (7, 'Python开发', 2, 1, 0, 2, 'https://example.com/images/python.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (8, '前端开发', 3, 1, 0, 2, 'https://example.com/images/frontend.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (9, '移动开发', 4, 1, 0, 2, 'https://example.com/images/mobile.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category` VALUES (10, '数据科学', 5, 1, 0, 2, 'https://example.com/images/data.jpg', '2026-01-24 09:32:29', '2026-01-24 09:32:29');

-- ----------------------------
-- Table structure for circle_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `circle_category_relation`;
CREATE TABLE `circle_category_relation`  (
                                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                             `child_category_id` bigint NOT NULL COMMENT '子分类id',
                                             `father_category_id` bigint NOT NULL COMMENT '父分类id',
                                             `direct_father_category_id` bigint NOT NULL COMMENT '直属父分类id',
                                             `is_sub` tinyint NOT NULL COMMENT '是否属于子分类',
                                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '圈子分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of circle_category_relation
-- ----------------------------
INSERT INTO `circle_category_relation` VALUES (1, 3, 1, 1, 1, '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category_relation` VALUES (2, 6, 3, 3, 1, '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category_relation` VALUES (3, 7, 3, 3, 1, '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category_relation` VALUES (4, 8, 3, 3, 1, '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category_relation` VALUES (5, 9, 3, 3, 1, '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `circle_category_relation` VALUES (6, 10, 1, 1, 1, '2026-01-24 09:32:29', '2026-01-24 09:32:29');

-- ----------------------------
-- Table structure for circle_circle
-- ----------------------------
DROP TABLE IF EXISTS `circle_circle`;
CREATE TABLE `circle_circle`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                                  `member_id` bigint NOT NULL COMMENT '会员id',
                                  `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '图片',
                                  `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                  `introduction` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '描述',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '圈子' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of circle_circle
-- ----------------------------
INSERT INTO `circle_circle` VALUES (1, 'AI技术爱好者交流圈', 1, 'https://ai-edu-res.com/circles/ai_tech.jpg', 'normal', '分享AI技术文章、实战案例，解答机器学习、大模型开发问题，每周组织1次线上技术沙龙', '2026-01-24 10:40:30', '2026-01-24 10:40:30');
INSERT INTO `circle_circle` VALUES (2, '机器学习实战交流圈', 2, 'https://ai-edu-res.com/circles/ml_practice.jpg', 'normal', '专注Python机器学习实战，讨论Scikit-learn/TensorFlow使用技巧，分享数据集和开源项目', '2026-01-24 10:40:30', '2026-01-24 10:40:30');
INSERT INTO `circle_circle` VALUES (3, 'AI大模型应用开发圈', 1, 'https://ai-edu-res.com/circles/llm_dev.jpg', 'normal', '交流LangChain、RAG技术，分享AI问答系统、文档分析工具开发经验，提供API调用教程', '2026-01-24 10:40:30', '2026-01-24 10:40:30');
INSERT INTO `circle_circle` VALUES (4, 'AI绘画创意分享圈', 2, 'https://ai-edu-res.com/circles/ai_art.jpg', 'normal', '分享Stable Diffusion/MidJourney绘画作品，交流提示词编写技巧，组织AI绘画比赛', '2026-01-24 10:40:30', '2026-01-24 10:40:30');
INSERT INTO `circle_circle` VALUES (5, 'AI教育创新应用圈', 1, 'https://ai-edu-res.com/circles/ai_edu.jpg', 'normal', '探讨AI在教学、备课、学情分析中的应用，分享智能教育工具，连接教育工作者与AI开发者', '2026-01-24 10:40:30', '2026-01-24 10:40:30');

-- ----------------------------
-- Table structure for circle_circle_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `circle_circle_category_relation`;
CREATE TABLE `circle_circle_category_relation`  (
                                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                    `category_id` bigint NOT NULL COMMENT '目录id',
                                                    `circle_id` bigint NOT NULL COMMENT '圈子id',
                                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '圈子类目关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of circle_circle_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for circle_circle_member
-- ----------------------------
DROP TABLE IF EXISTS `circle_circle_member`;
CREATE TABLE `circle_circle_member`  (
                                         `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                         `member_id` bigint NOT NULL COMMENT '会员id',
                                         `circle_id` bigint NOT NULL COMMENT '圈子id',
                                         `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                         `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                         PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '圈子会员' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of circle_circle_member
-- ----------------------------

-- ----------------------------
-- Table structure for circle_dynamic
-- ----------------------------
DROP TABLE IF EXISTS `circle_dynamic`;
CREATE TABLE `circle_dynamic`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容',
                                   `member_id` bigint NOT NULL COMMENT '会员id',
                                   `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '图片，多个逗号隔开',
                                   `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                   `circle_id` bigint NOT NULL COMMENT '圈子id',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '圈子动态' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of circle_dynamic
-- ----------------------------
INSERT INTO `circle_dynamic` VALUES (1, '刚用LangChain+Pinecone搭建了一个企业知识库AI问答系统，支持PDF上传解析，代码已开源：https://github.com/ai-edu/rag-demo', 1, 'https://ai-edu-res.com/dynamic/rag_demo.jpg', 'published', 3, '2026-01-24 10:40:34', '2026-01-24 10:40:34');
INSERT INTO `circle_dynamic` VALUES (2, '分享一个免费AI数据集：10万条教育领域文本标注数据，适合训练NLP模型，下载地址：https://ai-dataset.com/edu_text.zip', 2, '', 'published', 5, '2026-01-24 10:40:34', '2026-01-24 10:40:34');
INSERT INTO `circle_dynamic` VALUES (3, '用Stable Diffusion生成的电商主图，提示词：“高清女装主图，浅色系背景，质感面料，细节清晰”，大家觉得效果怎么样？', 1, 'https://ai-edu-res.com/dynamic/ai_cloth.jpg', 'published', 4, '2026-01-24 10:40:34', '2026-01-24 10:40:34');
INSERT INTO `circle_dynamic` VALUES (4, '请教各位：TensorFlow训练CNN模型时，过拟合问题怎么解决？试过 dropout 但效果一般，有其他技巧吗？', 2, '', 'published', 2, '2026-01-24 10:40:34', '2026-01-24 10:40:34');
INSERT INTO `circle_dynamic` VALUES (5, '谷歌新发布的Gemini 2支持视频理解了！测试了用它分析教学视频并生成课件，准确率比之前提升30%，推荐大家试试', 1, 'https://ai-edu-res.com/dynamic/gemini2.jpg', 'published', 1, '2026-01-24 10:40:34', '2026-01-24 10:40:34');

-- ----------------------------
-- Table structure for content_category
-- ----------------------------
DROP TABLE IF EXISTS `content_category`;
CREATE TABLE `content_category`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '类目名称',
                                     `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                     `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                     `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                     `level` int NOT NULL COMMENT '目录等级',
                                     `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '内容分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of content_category
-- ----------------------------

-- ----------------------------
-- Table structure for content_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `content_category_relation`;
CREATE TABLE `content_category_relation`  (
                                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                              `child_category_id` bigint NOT NULL COMMENT '子类目id',
                                              `father_category_id` bigint NOT NULL COMMENT '父类目id',
                                              `direct_father_category_id` bigint NOT NULL COMMENT '直属父类目id',
                                              `is_sub` tinyint NOT NULL COMMENT '是否属于子类目',
                                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '内容分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of content_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for exam_category
-- ----------------------------
DROP TABLE IF EXISTS `exam_category`;
CREATE TABLE `exam_category`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '分类名称',
                                  `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                  `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                  `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                  `level` int NOT NULL COMMENT '目录等级',
                                  `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_category
-- ----------------------------

-- ----------------------------
-- Table structure for exam_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `exam_category_relation`;
CREATE TABLE `exam_category_relation`  (
                                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                           `child_category_id` bigint NOT NULL COMMENT '子分类id',
                                           `father_category_id` bigint NOT NULL COMMENT '父分类id',
                                           `direct_father_category_id` bigint NOT NULL COMMENT '直属父分类id',
                                           `is_sub` tinyint NOT NULL COMMENT '是否属于子分类',
                                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for exam_exam
-- ----------------------------
DROP TABLE IF EXISTS `exam_exam`;
CREATE TABLE `exam_exam`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                              `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '编号',
                              `start_time` timestamp NOT NULL COMMENT '开始时间',
                              `end_time` timestamp NOT NULL COMMENT '结束时间',
                              `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '封面图片（海报）',
                              `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                              `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '短语介绍',
                              `introduction` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                              `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_exam
-- ----------------------------
INSERT INTO `exam_exam` VALUES (1, 'AI基础知识入门测评', 'AI_EXAM_001', '2026-02-10 09:00:00', '2026-02-20 23:59:59', 'https://ai-edu-res.com/exams/ai_basic_test.jpg', 'published', '检验AI基础掌握程度', '包含20道选择题+5道判断题，覆盖AI定义、机器学习分类、常见算法概念', '2026-01-24 10:40:20', '2026-01-24 10:40:20');
INSERT INTO `exam_exam` VALUES (2, '机器学习模型应用考试', 'AI_EXAM_002', '2026-02-15 09:00:00', '2026-02-25 23:59:59', 'https://ai-edu-res.com/exams/ml_test.jpg', 'published', '考核模型实战能力', '包含15道选择题+3道实操题（Python模型训练），涉及决策树、CNN基础', '2026-01-24 10:40:20', '2026-01-24 10:40:20');
INSERT INTO `exam_exam` VALUES (3, 'AI大模型开发能力测评', 'AI_EXAM_003', '2026-02-20 09:00:00', '2026-03-01 23:59:59', 'https://ai-edu-res.com/exams/llm_test.jpg', 'published', '评估大模型应用能力', '包含12道选择题+2道案例题（LangChain开发、Prompt优化）', '2026-01-24 10:40:20', '2026-01-24 10:40:20');
INSERT INTO `exam_exam` VALUES (4, 'AI伦理与合规知识考试', 'AI_EXAM_004', '2026-02-25 09:00:00', '2026-03-06 23:59:59', 'https://ai-edu-res.com/exams/ai_ethics_test.jpg', 'published', '掌握AI合规要点', '包含18道选择题+4道简答题，覆盖数据隐私、AI法案条款', '2026-01-24 10:40:20', '2026-01-24 10:40:20');
INSERT INTO `exam_exam` VALUES (5, 'NLP技术应用测评', 'AI_EXAM_005', '2026-03-01 09:00:00', '2026-03-11 23:59:59', 'https://ai-edu-res.com/exams/nlp_test.jpg', 'published', '考核文本分析能力', '包含16道选择题+3道实操题（文本分类、实体识别）', '2026-01-24 10:40:20', '2026-01-24 10:40:20');

-- ----------------------------
-- Table structure for exam_exam_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `exam_exam_category_relation`;
CREATE TABLE `exam_exam_category_relation`  (
                                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                `category_id` bigint NOT NULL COMMENT '目录id',
                                                `exam_id` bigint NOT NULL COMMENT '考试id',
                                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试与分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_exam_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for exam_exam_chapter
-- ----------------------------
DROP TABLE IF EXISTS `exam_exam_chapter`;
CREATE TABLE `exam_exam_chapter`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `exam_id` bigint NULL DEFAULT NULL COMMENT '考试id',
                                      `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章标题',
                                      `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                      `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试章' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_exam_chapter
-- ----------------------------

-- ----------------------------
-- Table structure for exam_exam_chapter_section
-- ----------------------------
DROP TABLE IF EXISTS `exam_exam_chapter_section`;
CREATE TABLE `exam_exam_chapter_section`  (
                                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                              `exam_chapter_id` bigint NULL DEFAULT NULL COMMENT '考试章id',
                                              `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章节标题',
                                              `paper_id` bigint NOT NULL COMMENT '试卷id',
                                              `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                              `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                              `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试章节' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_exam_chapter_section
-- ----------------------------

-- ----------------------------
-- Table structure for exam_paper
-- ----------------------------
DROP TABLE IF EXISTS `exam_paper`;
CREATE TABLE `exam_paper`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                               `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '编号',
                               `description` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                               `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型',
                               `score` double NOT NULL COMMENT '试卷总分',
                               `limit_time` bigint NOT NULL COMMENT '考试时长',
                               `pass_score` double NOT NULL COMMENT '合格分数',
                               `question_disordered` tinyint NOT NULL DEFAULT 0 COMMENT '题序打乱',
                               `option_disordered` tinyint NOT NULL DEFAULT 0 COMMENT '选项打乱',
                               `difficulty` int NOT NULL DEFAULT 0 COMMENT '难度',
                               `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试卷' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_paper
-- ----------------------------

-- ----------------------------
-- Table structure for exam_paper_category
-- ----------------------------
DROP TABLE IF EXISTS `exam_paper_category`;
CREATE TABLE `exam_paper_category`  (
                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                        `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '分类名称',
                                        `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                        `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                        `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                        `level` int NOT NULL COMMENT '目录等级',
                                        `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试卷分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_paper_category
-- ----------------------------

-- ----------------------------
-- Table structure for exam_paper_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `exam_paper_category_relation`;
CREATE TABLE `exam_paper_category_relation`  (
                                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                 `child_category_id` bigint NOT NULL COMMENT '子分类id',
                                                 `father_category_id` bigint NOT NULL COMMENT '父分类id',
                                                 `direct_father_category_id` bigint NOT NULL COMMENT '直属父分类id',
                                                 `is_sub` tinyint NOT NULL COMMENT '是否属于子分类',
                                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试卷分类与试卷分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_paper_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for exam_paper_paper_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `exam_paper_paper_category_relation`;
CREATE TABLE `exam_paper_paper_category_relation`  (
                                                       `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                       `category_id` bigint NOT NULL COMMENT '目录id',
                                                       `paper_id` bigint NOT NULL COMMENT '试卷id',
                                                       `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                       `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                       PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试卷与试卷分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_paper_paper_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for exam_paper_question
-- ----------------------------
DROP TABLE IF EXISTS `exam_paper_question`;
CREATE TABLE `exam_paper_question`  (
                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                        `question_id` bigint NOT NULL COMMENT '题目id',
                                        `paper_id` bigint NOT NULL COMMENT '试卷id',
                                        `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试卷题目' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_paper_question
-- ----------------------------

-- ----------------------------
-- Table structure for exam_paper_question_rule
-- ----------------------------
DROP TABLE IF EXISTS `exam_paper_question_rule`;
CREATE TABLE `exam_paper_question_rule`  (
                                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                             `paper_id` bigint NOT NULL COMMENT '试卷id',
                                             `rule_json` json NOT NULL COMMENT '抽题规则',
                                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '试卷题目抽题规则' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_paper_question_rule
-- ----------------------------

-- ----------------------------
-- Table structure for exam_question
-- ----------------------------
DROP TABLE IF EXISTS `exam_question`;
CREATE TABLE `exam_question`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '题目',
                                  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题目描述',
                                  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型',
                                  `difficulty` int NOT NULL DEFAULT 1 COMMENT '难度',
                                  `score` decimal(14, 2) NOT NULL DEFAULT 1.00 COMMENT '分数',
                                  `reference_answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '参考答案',
                                  `reference_answer_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '答案解析',
                                  `options` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '选项',
                                  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '题目' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_question
-- ----------------------------
INSERT INTO `exam_question` VALUES (1, '以下哪种算法不属于监督学习？', '基础算法分类题', 'single_choice', 2, 2.00, 'D', '监督学习需人工标注标签，K-Means为无监督聚类算法', '[{\"option\":\"A\",\"content\":\"线性回归\"},{\"option\":\"B\",\"content\":\"随机森林\"},{\"option\":\"C\",\"content\":\"支持向量机\"},{\"option\":\"D\",\"content\":\"K-Means\"}]', 'published', '2026-01-24 10:40:23', '2026-01-24 10:40:23');
INSERT INTO `exam_question` VALUES (2, 'LangChain框架的核心作用是？', '大模型应用开发题', 'single_choice', 2, 2.00, 'C', 'LangChain专注于连接大模型与外部工具（数据库、API），降低开发门槛', '[{\"option\":\"A\",\"content\":\"训练大模型\"},{\"option\":\"B\",\"content\":\"优化模型参数\"},{\"option\":\"C\",\"content\":\"构建大模型应用工作流\"},{\"option\":\"D\",\"content\":\"存储模型数据\"}]', 'published', '2026-01-24 10:40:23', '2026-01-24 10:40:23');
INSERT INTO `exam_question` VALUES (3, '生成式AI生成的内容无需标注来源即可商用？', '合规判断题', 'judgment', 1, 1.00, '错误', '根据《生成式AI服务管理暂行办法》，生成内容需标注来源，避免侵权', '[{\"option\":\"正确\"},{\"option\":\"错误\"}]', 'published', '2026-01-24 10:40:23', '2026-01-24 10:40:23');
INSERT INTO `exam_question` VALUES (4, '以下属于深度学习框架的有？', '工具链多选题', 'multi_choice', 3, 3.00, 'ABC', 'TensorFlow、PyTorch、Keras为主流深度学习框架，Scikit-learn为传统机器学习工具', '[{\"option\":\"A\",\"content\":\"TensorFlow\"},{\"option\":\"B\",\"content\":\"PyTorch\"},{\"option\":\"C\",\"content\":\"Keras\"},{\"option\":\"D\",\"content\":\"Scikit-learn\"}]', 'published', '2026-01-24 10:40:23', '2026-01-24 10:40:23');
INSERT INTO `exam_question` VALUES (5, '简述AI模型“量化”技术的作用', '技术原理题', 'subjective', 3, 5.00, '减少模型参数精度（如FP32→FP16），降低内存占用和计算成本，适配端侧设备（手机/嵌入式）', '量化通过牺牲少量精度换取模型轻量化，是边缘AI部署的核心技术之一，常见方式有INT8量化、FP16量化', '[]', 'published', '2026-01-24 10:40:23', '2026-01-24 10:40:23');

-- ----------------------------
-- Table structure for exam_question_and_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `exam_question_and_category_relation`;
CREATE TABLE `exam_question_and_category_relation`  (
                                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                        `category_id` bigint NOT NULL COMMENT '目录id',
                                                        `question_id` bigint NOT NULL COMMENT '题目id',
                                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '题目与题目分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_question_and_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for exam_question_category
-- ----------------------------
DROP TABLE IF EXISTS `exam_question_category`;
CREATE TABLE `exam_question_category`  (
                                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                           `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '分类名称',
                                           `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                           `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                           `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                           `level` int NOT NULL COMMENT '目录等级',
                                           `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '题目分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_question_category
-- ----------------------------

-- ----------------------------
-- Table structure for exam_question_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `exam_question_category_relation`;
CREATE TABLE `exam_question_category_relation`  (
                                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                    `child_category_id` bigint NOT NULL COMMENT '子分类id',
                                                    `father_category_id` bigint NOT NULL COMMENT '父分类id',
                                                    `direct_father_category_id` bigint NOT NULL COMMENT '直属父分类id',
                                                    `is_sub` tinyint NOT NULL COMMENT '是否属于子分类',
                                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '题目分类与题目分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_question_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for exam_record
-- ----------------------------
DROP TABLE IF EXISTS `exam_record`;
CREATE TABLE `exam_record`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `member_id` bigint NOT NULL COMMENT '会员id',
                                `exam_id` bigint NOT NULL COMMENT '考试id',
                                `exam_chapter_section_id` bigint NOT NULL COMMENT '章节id',
                                `sign_up_id` bigint NOT NULL COMMENT '报名id',
                                `paper` json NOT NULL COMMENT '试卷',
                                `answer` json NOT NULL COMMENT '答案',
                                `reference_answer` json NULL COMMENT '参考答案',
                                `start_time` timestamp NULL DEFAULT NULL COMMENT '开始考试时间',
                                `end_time` timestamp NULL DEFAULT NULL COMMENT '结束考试时间',
                                `score` decimal(14, 2) NOT NULL DEFAULT 0.00 COMMENT '分数',
                                `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_record
-- ----------------------------

-- ----------------------------
-- Table structure for exam_sign_up
-- ----------------------------
DROP TABLE IF EXISTS `exam_sign_up`;
CREATE TABLE `exam_sign_up`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `member_id` bigint NOT NULL COMMENT '会员id',
                                 `exam_id` bigint NOT NULL COMMENT '考试id',
                                 `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                 `completed_time` timestamp NULL DEFAULT NULL COMMENT '完成时间',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '考试报名' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_sign_up
-- ----------------------------

-- ----------------------------
-- Table structure for exam_wrong_question
-- ----------------------------
DROP TABLE IF EXISTS `exam_wrong_question`;
CREATE TABLE `exam_wrong_question`  (
                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                        `question_id` bigint NOT NULL COMMENT '题目id',
                                        `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '题目',
                                        `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题目描述',
                                        `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型',
                                        `difficulty` int NOT NULL COMMENT '难度',
                                        `score` decimal(14, 2) NOT NULL COMMENT '分数',
                                        `reference_answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '参考答案',
                                        `reference_answer_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '答案解析',
                                        `options` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '选项',
                                        `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                        `member_id` bigint NOT NULL COMMENT '会员id',
                                        `scored` decimal(14, 2) NOT NULL COMMENT '会员答题得分',
                                        `result` tinyint NOT NULL COMMENT '会员答题结果',
                                        `answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会员答案',
                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '错题' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of exam_wrong_question
-- ----------------------------

-- ----------------------------
-- Table structure for learn_category
-- ----------------------------
DROP TABLE IF EXISTS `learn_category`;
CREATE TABLE `learn_category`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '类目名称',
                                   `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                   `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                   `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                   `level` int NOT NULL COMMENT '目录等级',
                                   `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                   `company_id` bigint NOT NULL COMMENT '公司id',
                                   `department_id` bigint NOT NULL COMMENT '部门id',
                                   `create_user_id` bigint NOT NULL COMMENT '创建用户id',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '课程分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_category
-- ----------------------------

-- ----------------------------
-- Table structure for learn_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `learn_category_relation`;
CREATE TABLE `learn_category_relation`  (
                                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                            `child_category_id` bigint NOT NULL COMMENT '子类目id',
                                            `father_category_id` bigint NOT NULL COMMENT '父类目id',
                                            `direct_father_category_id` bigint NOT NULL COMMENT '直属父类目id',
                                            `is_sub` tinyint NOT NULL COMMENT '是否属于子类目',
                                            `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                            `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '课程分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for learn_homework
-- ----------------------------
DROP TABLE IF EXISTS `learn_homework`;
CREATE TABLE `learn_homework`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `lesson_id` bigint NOT NULL COMMENT '课程id',
                                   `url` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '附件地址',
                                   `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '作业内容',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '作业' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_homework
-- ----------------------------

-- ----------------------------
-- Table structure for learn_homework_record
-- ----------------------------
DROP TABLE IF EXISTS `learn_homework_record`;
CREATE TABLE `learn_homework_record`  (
                                          `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                          `member_id` bigint NOT NULL COMMENT '会员id',
                                          `lesson_id` bigint NOT NULL COMMENT '课程id',
                                          `url` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '作业提交内容的地址',
                                          `status` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                          `sign_up_id` bigint NOT NULL COMMENT '报名id',
                                          `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                          `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                          PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '作业提交内容记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_homework_record
-- ----------------------------

-- ----------------------------
-- Table structure for learn_learn_map
-- ----------------------------
DROP TABLE IF EXISTS `learn_learn_map`;
CREATE TABLE `learn_learn_map`  (
                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                    `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                    `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '封面图片（海报）',
                                    `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                    `description` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                                    `company_id` bigint NULL DEFAULT NULL COMMENT '公司id',
                                    `department_id` bigint NULL DEFAULT NULL COMMENT '部门id',
                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '学习地图' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_learn_map
-- ----------------------------

-- ----------------------------
-- Table structure for learn_learn_map_topic
-- ----------------------------
DROP TABLE IF EXISTS `learn_learn_map_topic`;
CREATE TABLE `learn_learn_map_topic`  (
                                          `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                          `learn_map_id` bigint NOT NULL COMMENT '学习地图id',
                                          `topic_id` bigint NOT NULL COMMENT '专题id',
                                          `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                          `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                          PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '学习地图与专题的关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_learn_map_topic
-- ----------------------------

-- ----------------------------
-- Table structure for learn_lesson
-- ----------------------------
DROP TABLE IF EXISTS `learn_lesson`;
CREATE TABLE `learn_lesson`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '课程名称',
                                 `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '编号',
                                 `start_time` timestamp NOT NULL COMMENT '开始时间',
                                 `end_time` timestamp NOT NULL COMMENT '结束时间',
                                 `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '封面图片（海报）',
                                 `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                 `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '短语介绍',
                                 `introduction` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                                 `company_id` bigint NULL DEFAULT NULL COMMENT '公司id',
                                 `department_id` bigint NULL DEFAULT NULL COMMENT '部门id',
                                 `create_user_id` bigint NULL DEFAULT NULL COMMENT '创建用户id',
                                 `price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '价格',
                                 `original_price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '原价',
                                 `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '课程表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_lesson
-- ----------------------------

-- ----------------------------
-- Table structure for learn_lesson_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `learn_lesson_category_relation`;
CREATE TABLE `learn_lesson_category_relation`  (
                                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                   `category_id` bigint NOT NULL COMMENT '目录id',
                                                   `lesson_id` bigint NOT NULL COMMENT '课程id',
                                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '课程分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_lesson_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for learn_lesson_chapter
-- ----------------------------
DROP TABLE IF EXISTS `learn_lesson_chapter`;
CREATE TABLE `learn_lesson_chapter`  (
                                         `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                         `lesson_id` bigint NULL DEFAULT NULL COMMENT '课程id',
                                         `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章标题',
                                         `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                         `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序',
                                         `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                         `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                         PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '课程章表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_lesson_chapter
-- ----------------------------
INSERT INTO `learn_lesson_chapter` VALUES (1, 1, '第1章：AI核心概念与发展', '理解AI的定义、分类及技术演进', 1, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (2, 1, '第2章：机器学习基础原理', '监督/无监督学习、特征工程入门', 2, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (3, 1, '第3章：AI工具链实战', 'Python/TensorFlow环境搭建', 3, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (4, 2, '第1章：Scikit-learn基础', '数据预处理与模型调用', 1, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (5, 2, '第2章：分类算法实战', '决策树、随机森林案例', 2, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (6, 2, '第3章：回归模型优化', '线性回归正则化与评估', 3, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (7, 3, '第1章：LangChain核心组件', 'Chain、Agent、Memory详解', 1, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (8, 3, '第2章：向量数据库集成', 'Pinecone/FAISS使用教程', 2, '2026-01-24 10:40:16', '2026-01-24 10:40:16');
INSERT INTO `learn_lesson_chapter` VALUES (9, 3, '第3章：AI问答系统开发', '从0到1搭建企业知识库', 3, '2026-01-24 10:40:16', '2026-01-24 10:40:16');

-- ----------------------------
-- Table structure for learn_lesson_chapter_section
-- ----------------------------
DROP TABLE IF EXISTS `learn_lesson_chapter_section`;
CREATE TABLE `learn_lesson_chapter_section`  (
                                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                 `lesson_chapter_id` bigint NULL DEFAULT NULL COMMENT '课程章id',
                                                 `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章节标题',
                                                 `url` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容地址',
                                                 `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                                 `total_time` bigint NOT NULL COMMENT '内容总时长',
                                                 `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序',
                                                 `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容类型（上传、链接）',
                                                 `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                 `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '课程章节表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_lesson_chapter_section
-- ----------------------------

-- ----------------------------
-- Table structure for learn_record
-- ----------------------------
DROP TABLE IF EXISTS `learn_record`;
CREATE TABLE `learn_record`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `member_id` bigint NOT NULL COMMENT '会员id',
                                 `lesson_id` bigint NOT NULL COMMENT '课程id',
                                 `lesson_chapter_section_id` bigint NOT NULL COMMENT '章节id',
                                 `sign_up_id` bigint NOT NULL COMMENT '报名id',
                                 `learn_time` bigint NOT NULL COMMENT '学习时长',
                                 `max_progress_time` bigint NOT NULL COMMENT '最大的学习进度时间',
                                 `status` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'progressing' COMMENT '状态',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '学习记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_record
-- ----------------------------

-- ----------------------------
-- Table structure for learn_record_log
-- ----------------------------
DROP TABLE IF EXISTS `learn_record_log`;
CREATE TABLE `learn_record_log`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `member_id` bigint NOT NULL COMMENT '会员id',
                                     `lesson_id` bigint NOT NULL COMMENT '课程id',
                                     `lesson_chapter_section_id` bigint NOT NULL COMMENT '章节id',
                                     `sign_up_id` bigint NOT NULL COMMENT '报名id',
                                     `learn_time` bigint NOT NULL COMMENT '学习时长',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '学习记录日志' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_record_log
-- ----------------------------

-- ----------------------------
-- Table structure for learn_sign_up
-- ----------------------------
DROP TABLE IF EXISTS `learn_sign_up`;
CREATE TABLE `learn_sign_up`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `member_id` bigint NOT NULL COMMENT '会员id',
                                  `lesson_id` bigint NOT NULL COMMENT '课程id',
                                  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                  `completed_time` timestamp NULL DEFAULT NULL COMMENT '完成时间',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '课程报名' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_sign_up
-- ----------------------------

-- ----------------------------
-- Table structure for learn_topic
-- ----------------------------
DROP TABLE IF EXISTS `learn_topic`;
CREATE TABLE `learn_topic`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '封面图片（海报）',
                                `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                `description` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                                `company_id` bigint NULL DEFAULT NULL COMMENT '公司id',
                                `department_id` bigint NULL DEFAULT NULL COMMENT '部门id',
                                `create_user_id` bigint NULL DEFAULT NULL COMMENT '创建用户id',
                                `price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '价格',
                                `original_price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '原价',
                                `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '专题' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_topic
-- ----------------------------

-- ----------------------------
-- Table structure for learn_topic_category
-- ----------------------------
DROP TABLE IF EXISTS `learn_topic_category`;
CREATE TABLE `learn_topic_category`  (
                                         `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                         `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '类目名称',
                                         `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                         `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                         `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                         `level` int NOT NULL COMMENT '目录等级',
                                         `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                         `company_id` bigint NOT NULL DEFAULT 0 COMMENT '公司id',
                                         `department_id` bigint NOT NULL DEFAULT 0 COMMENT '部门id',
                                         `create_user_id` bigint NOT NULL DEFAULT 0 COMMENT '创建用户id',
                                         `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                         `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                         PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '专题分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_topic_category
-- ----------------------------

-- ----------------------------
-- Table structure for learn_topic_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `learn_topic_category_relation`;
CREATE TABLE `learn_topic_category_relation`  (
                                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                  `child_category_id` bigint NOT NULL COMMENT '子类目id',
                                                  `father_category_id` bigint NOT NULL COMMENT '父类目id',
                                                  `direct_father_category_id` bigint NOT NULL COMMENT '直属父类目id',
                                                  `is_sub` tinyint NOT NULL COMMENT '是否属于子类目',
                                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '专题分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_topic_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for learn_topic_lesson
-- ----------------------------
DROP TABLE IF EXISTS `learn_topic_lesson`;
CREATE TABLE `learn_topic_lesson`  (
                                       `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                       `lesson_id` bigint NOT NULL COMMENT '课程id',
                                       `topic_id` bigint NOT NULL COMMENT '专题id',
                                       `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                       `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                       PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '专题与课程关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_topic_lesson
-- ----------------------------

-- ----------------------------
-- Table structure for learn_topic_topic_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `learn_topic_topic_category_relation`;
CREATE TABLE `learn_topic_topic_category_relation`  (
                                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                        `category_id` bigint NOT NULL COMMENT '目录id',
                                                        `topic_id` bigint NOT NULL COMMENT '专题id',
                                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '专题与分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of learn_topic_topic_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for live_category
-- ----------------------------
DROP TABLE IF EXISTS `live_category`;
CREATE TABLE `live_category`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '分类名称',
                                  `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                  `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                  `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                  `level` int NOT NULL COMMENT '目录等级',
                                  `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '直播分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of live_category
-- ----------------------------

-- ----------------------------
-- Table structure for live_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `live_category_relation`;
CREATE TABLE `live_category_relation`  (
                                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                           `child_category_id` bigint NOT NULL COMMENT '子分类id',
                                           `father_category_id` bigint NOT NULL COMMENT '父分类id',
                                           `direct_father_category_id` bigint NOT NULL COMMENT '直属父分类id',
                                           `is_sub` tinyint NOT NULL COMMENT '是否属于子分类',
                                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '直播分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of live_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for live_channel
-- ----------------------------
DROP TABLE IF EXISTS `live_channel`;
CREATE TABLE `live_channel`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                                 `introduction` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '描述',
                                 `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '海报',
                                 `user_id` bigint NOT NULL COMMENT '用户id',
                                 `status` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                 `start_time` timestamp NOT NULL COMMENT '直播时间',
                                 `show_number` tinyint NOT NULL DEFAULT 1 COMMENT '人数显示',
                                 `enable_chat` tinyint NOT NULL DEFAULT 1 COMMENT '是否开启聊天',
                                 `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '直播频道' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of live_channel
-- ----------------------------
INSERT INTO `live_channel` VALUES (1, 'Java技术分享直播', '每周分享Java最新技术动态和实战经验，包括Spring Boot、微服务、性能优化等内容', 'https://example.com/images/live1.jpg', 1, 'published', '2026-01-26 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (2, '前端开发实战直播', '实时演示前端开发技巧，包括Vue、React等框架的使用，解决实际开发问题', 'https://example.com/images/live2.jpg', 1, 'published', '2026-01-27 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (3, '产品设计思维分享', '分享产品设计理念、用户体验优化、产品迭代策略等实战经验', 'https://example.com/images/live3.jpg', 1, 'published', '2026-01-29 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (4, 'Python数据分析实战', '通过实际案例讲解Python数据分析方法，包括数据清洗、可视化、机器学习等', 'https://example.com/images/live4.jpg', 1, 'published', '2026-01-31 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (5, '移动开发技术分享', '分享iOS、Android开发技巧，包括性能优化、用户体验提升等', 'https://example.com/images/live5.jpg', 1, 'published', '2026-01-28 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (6, 'UI设计实战直播', '实时演示UI设计过程，包括界面设计、交互设计、设计规范等', 'https://example.com/images/live6.jpg', 1, 'published', '2026-01-30 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (7, '系统架构设计分享', '分享大型系统架构设计经验，包括高并发、高可用、分布式系统设计', 'https://example.com/images/live7.jpg', 1, 'published', '2026-02-01 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (8, 'DevOps实践分享', '分享CI/CD、容器化、自动化运维等DevOps实践经验和最佳实践', 'https://example.com/images/live8.jpg', 1, 'published', '2026-02-02 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (9, '数据库优化实战', '讲解数据库性能优化技巧，包括索引优化、查询优化、分库分表等', 'https://example.com/images/live9.jpg', 1, 'published', '2026-02-03 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (10, '网络安全技术分享', '分享网络安全防护技术，包括Web安全、渗透测试、安全加固等', 'https://example.com/images/live10.jpg', 1, 'published', '2026-02-04 10:24:27', 1, 1, '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `live_channel` VALUES (11, 'AI大模型最新进展解读（2026）', '邀请谷歌DeepMind工程师解读Gemini 2、GPT-5技术突破，分析大模型多模态能力演进方向，解答“AI是否会替代程序员”等热点问题', 'https://ai-edu-res.com/live/llm_update.jpg', 1, 'active', '2026-02-12 19:30:00', 1, 1, '2026-01-24 10:40:27', '2026-01-24 10:40:27');
INSERT INTO `live_channel` VALUES (12, 'Stable Diffusion商业级绘画实战', '手把手教你用SD生成电商主图、游戏原画，讲解提示词优化（如LoRA插件）、批量生成技巧，直播后赠送100+优质模型', 'https://ai-edu-res.com/live/sd_painting.jpg', 2, 'active', '2026-02-18 15:00:00', 1, 1, '2026-01-24 10:40:27', '2026-01-24 10:40:27');
INSERT INTO `live_channel` VALUES (13, 'AI教育工具开发：1小时搭建智能备课系统', '基于LangChain+Excel，开发“输入知识点自动生成课件”工具，适配教师日常备课场景，直播全程开源代码', 'https://ai-edu-res.com/live/ai_edu_dev.jpg', 1, 'active', '2026-02-25 20:00:00', 1, 1, '2026-01-24 10:40:27', '2026-01-24 10:40:27');
INSERT INTO `live_channel` VALUES (14, '边缘AI部署：树莓派实现AI人脸识别', '讲解如何在树莓派上部署轻量AI模型（如MobileNet），开发实时人脸识别门禁系统，涵盖摄像头调试、模型优化', 'https://ai-edu-res.com/live/edge_ai.jpg', 2, 'active', '2026-03-03 14:30:00', 1, 1, '2026-01-24 10:40:27', '2026-01-24 10:40:27');
INSERT INTO `live_channel` VALUES (15, 'AI伦理辩论赛：“AI生成内容是否该受版权保护”', '邀请法学专家、AI开发者、内容创作者展开辩论，解析国内外AI版权案例，帮助观众规避法律风险', 'https://ai-edu-res.com/live/ai_copyright.jpg', 1, 'active', '2026-03-10 19:00:00', 1, 1, '2026-01-24 10:40:27', '2026-01-24 10:40:27');

-- ----------------------------
-- Table structure for live_channel_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `live_channel_category_relation`;
CREATE TABLE `live_channel_category_relation`  (
                                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                   `category_id` bigint NOT NULL COMMENT '目录id',
                                                   `channel_id` bigint NOT NULL COMMENT '频道id',
                                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '频道分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of live_channel_category_relation
-- ----------------------------
-- 关联现有直播频道到分类
INSERT INTO `live_channel_category_relation` VALUES (1, 401, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (2, 401, 2, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (3, 401, 3, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (4, 501, 4, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (5, 401, 5, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (6, 206, 6, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (7, 405, 7, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (8, 405, 8, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (9, 404, 9, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (10, 5, 10, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
-- AI相关直播频道关联
INSERT INTO `live_channel_category_relation` VALUES (11, 1, 11, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (12, 201, 12, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (13, 1001, 13, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (14, 405, 14, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `live_channel_category_relation` VALUES (15, 5, 15, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- ----------------------------
-- Table structure for live_channel_lecturer
-- ----------------------------
DROP TABLE IF EXISTS `live_channel_lecturer`;
CREATE TABLE `live_channel_lecturer`  (
                                          `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                          `lecturer_id` bigint NOT NULL COMMENT '讲师id',
                                          `channel_id` bigint NOT NULL COMMENT '频道id',
                                          `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                          `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                          PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '频道讲师' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of live_channel_lecturer
-- ----------------------------

-- ----------------------------
-- Table structure for live_subscribe
-- ----------------------------
DROP TABLE IF EXISTS `live_subscribe`;
CREATE TABLE `live_subscribe`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `member_id` bigint NOT NULL COMMENT '会员id',
                                   `channel_id` bigint NOT NULL COMMENT '频道id',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '频道订阅' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of live_subscribe
-- ----------------------------

-- ----------------------------
-- Table structure for live_tencent_cloud_live_stream
-- ----------------------------
DROP TABLE IF EXISTS `live_tencent_cloud_live_stream`;
CREATE TABLE `live_tencent_cloud_live_stream`  (
                                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                   `channel_id` bigint NOT NULL COMMENT '频道id',
                                                   `stream_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '流名称',
                                                   `app_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'live' COMMENT '应用名称',
                                                   `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                   `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '腾讯云直播流信息' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of live_tencent_cloud_live_stream
-- ----------------------------

-- ----------------------------
-- Table structure for message_announcement
-- ----------------------------
DROP TABLE IF EXISTS `message_announcement`;
CREATE TABLE `message_announcement`  (
                                         `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                         `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                         `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容',
                                         `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '状态',
                                         `publish_time` timestamp NOT NULL COMMENT '发布时间',
                                         `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                         `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                         PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '公告' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of message_announcement
-- ----------------------------

-- ----------------------------
-- Table structure for message_announcement_read_record
-- ----------------------------
DROP TABLE IF EXISTS `message_announcement_read_record`;
CREATE TABLE `message_announcement_read_record`  (
                                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                     `announcement_id` bigint NOT NULL COMMENT '公告id',
                                                     `member_id` bigint NOT NULL COMMENT '会员id',
                                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '公告阅读记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of message_announcement_read_record
-- ----------------------------

-- ----------------------------
-- Table structure for message_notice
-- ----------------------------
DROP TABLE IF EXISTS `message_notice`;
CREATE TABLE `message_notice`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `topic_id` bigint NOT NULL COMMENT '主题id',
                                   `topic_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主题类型',
                                   `to_member_id` bigint NOT NULL COMMENT '主题会员',
                                   `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '状态',
                                   `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型',
                                   `browsed` tinyint NOT NULL DEFAULT 0 COMMENT '是否已读',
                                   `member_id` bigint NOT NULL COMMENT '会员',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '通知' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of message_notice
-- ----------------------------

-- ----------------------------
-- Table structure for message_private_letter
-- ----------------------------
DROP TABLE IF EXISTS `message_private_letter`;
CREATE TABLE `message_private_letter`  (
                                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                           `sender_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '发送者id',
                                           `receiver_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '接受者id',
                                           `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容',
                                           `read_time` timestamp NULL DEFAULT NULL COMMENT '读信息时间',
                                           `is_read` tinyint NOT NULL DEFAULT 0 COMMENT '是否已读',
                                           `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '私信' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of message_private_letter
-- ----------------------------

-- ----------------------------
-- Table structure for message_system_notice
-- ----------------------------
DROP TABLE IF EXISTS `message_system_notice`;
CREATE TABLE `message_system_notice`  (
                                          `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                          `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '通知内容',
                                          `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                          `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                          PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '系统通知' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of message_system_notice
-- ----------------------------

-- ----------------------------
-- Table structure for message_template
-- ----------------------------
DROP TABLE IF EXISTS `message_template`;
CREATE TABLE `message_template`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型',
                                     `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '通知内容',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '通知模板' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of message_template
-- ----------------------------
INSERT INTO `message_template` VALUES (1, 'sign_up', '亲爱的会员，您成功报名课程「标题」。我们一起愉快学习吧~', '2025-12-08 11:20:30', '2025-12-08 11:20:30');
INSERT INTO `message_template` VALUES (2, 'register_user', '注册账号成功，欢迎加入大家庭~', '2025-12-08 11:20:30', '2025-12-08 11:20:30');

-- ----------------------------
-- Table structure for order_order
-- ----------------------------
DROP TABLE IF EXISTS `order_order`;
CREATE TABLE `order_order`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单号',
                                `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                `remark` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '用户备注',
                                `freight_amount` decimal(14, 2) NOT NULL DEFAULT 0.00 COMMENT '邮费金额',
                                `item_amount` decimal(14, 2) NOT NULL COMMENT '商品金额',
                                `payment_amount` decimal(14, 2) NOT NULL COMMENT '付款金额',
                                `user_id` bigint NOT NULL COMMENT '用户id',
                                `department_id` bigint NOT NULL COMMENT '部门id',
                                `company_id` bigint NOT NULL COMMENT '公司id',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '订单' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of order_order
-- ----------------------------

-- ----------------------------
-- Table structure for order_order_item
-- ----------------------------
DROP TABLE IF EXISTS `order_order_item`;
CREATE TABLE `order_order_item`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `order_id` bigint NOT NULL COMMENT '订单id',
                                     `item_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品id',
                                     `title` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                     `image` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '图片',
                                     `original_price` decimal(14, 2) NOT NULL COMMENT '原价',
                                     `price` decimal(14, 2) NOT NULL COMMENT '价格',
                                     `quantity` int NOT NULL COMMENT '数量',
                                     `payment_amount` decimal(14, 2) NOT NULL COMMENT '付款金额',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '订单商品' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of order_order_item
-- ----------------------------

-- ----------------------------
-- Table structure for order_order_payment
-- ----------------------------
DROP TABLE IF EXISTS `order_order_payment`;
CREATE TABLE `order_order_payment`  (
                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                        `order_id` bigint NOT NULL COMMENT '订单id',
                                        `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                        `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '渠道',
                                        `amount` decimal(14, 2) NOT NULL COMMENT '金额',
                                        `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '订单支付' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of order_order_payment
-- ----------------------------

-- ----------------------------
-- Table structure for point_channel
-- ----------------------------
DROP TABLE IF EXISTS `point_channel`;
CREATE TABLE `point_channel`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                                  `member_receive_num` bigint NOT NULL COMMENT '会员每次领取数量',
                                  `issued_num` bigint NOT NULL DEFAULT 0 COMMENT '总发放阈值',
                                  `day_issued_num` bigint NOT NULL DEFAULT 0 COMMENT '日发放阈值',
                                  `day_member_receive_num` bigint NOT NULL DEFAULT 0 COMMENT '每日会员领取阈值',
                                  `change_remind` tinyint NOT NULL DEFAULT 0 COMMENT '是否变动提醒',
                                  `increase_remind_tips` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '增加积分变动提示语, {{coin}}表示变动金额',
                                  `decrease_remind_tips` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '消耗积分变动提示语, {{coin}}表示变动金额',
                                  `user_id` bigint NOT NULL COMMENT '创建用户id',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '积分渠道' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of point_channel
-- ----------------------------

-- ----------------------------
-- Table structure for point_point
-- ----------------------------
DROP TABLE IF EXISTS `point_point`;
CREATE TABLE `point_point`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                                `start_date` timestamp NOT NULL COMMENT '有效期开始时间',
                                `end_date` timestamp NOT NULL COMMENT '有效期结束时间',
                                `redemption_ratio` bigint NOT NULL COMMENT '兑换比例，1元=100积分，填写100',
                                `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                `user_id` bigint NOT NULL COMMENT '用户id',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '积分' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of point_point
-- ----------------------------

-- ----------------------------
-- Table structure for point_point_channel_relation
-- ----------------------------
DROP TABLE IF EXISTS `point_point_channel_relation`;
CREATE TABLE `point_point_channel_relation`  (
                                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                 `point_id` bigint NOT NULL COMMENT '积分id',
                                                 `channel_id` bigint NOT NULL COMMENT '积分渠道id',
                                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '积分与积分渠道的关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of point_point_channel_relation
-- ----------------------------

-- ----------------------------
-- Table structure for point_record
-- ----------------------------
DROP TABLE IF EXISTS `point_record`;
CREATE TABLE `point_record`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `point_id` bigint NOT NULL COMMENT '积分id',
                                 `channel_id` bigint NOT NULL COMMENT '积分渠道id',
                                 `point_num` bigint NOT NULL COMMENT '积分数量',
                                 `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '积分记录类型',
                                 `member_id` bigint NOT NULL COMMENT '会员id',
                                 `mobile` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '会员手机号',
                                 `remark` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '备注原因',
                                 `topic_id` bigint NOT NULL COMMENT '积分记录主题id',
                                 `topic_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '积分记录主题类型',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '积分记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of point_record
-- ----------------------------

-- ----------------------------
-- Table structure for resource_category
-- ----------------------------
DROP TABLE IF EXISTS `resource_category`;
CREATE TABLE `resource_category`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '类目名称',
                                      `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                      `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                      `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                      `level` int NOT NULL COMMENT '目录等级',
                                      `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                      `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '资源分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of resource_category
-- ----------------------------

-- ----------------------------
-- Table structure for resource_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `resource_category_relation`;
CREATE TABLE `resource_category_relation`  (
                                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                               `child_category_id` bigint NOT NULL COMMENT '子类目id',
                                               `father_category_id` bigint NOT NULL COMMENT '父类目id',
                                               `direct_father_category_id` bigint NOT NULL COMMENT '直属父类目id',
                                               `is_sub` tinyint NOT NULL COMMENT '是否属于子类目',
                                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '资源分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of resource_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for resource_resource
-- ----------------------------
DROP TABLE IF EXISTS `resource_resource`;
CREATE TABLE `resource_resource`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                      `member_id` bigint NOT NULL COMMENT '用户id',
                                      `introduction` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容',
                                      `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '海报图片',
                                      `url` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '标签',
                                      `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                                      `type` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型',
                                      `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '资源' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of resource_resource
-- ----------------------------
INSERT INTO `resource_resource` VALUES (1, 'Java开发工具包', 101, '包含常用的Java开发工具和库，提高开发效率', 'https://example.com/images/resource1.jpg', 'https://example.com/downloads/java-tools.zip', 'published', 'tool', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (2, '前端UI组件库', 102, '丰富的React和Vue组件库，快速构建现代化界面', 'https://example.com/images/resource2.jpg', 'https://example.com/downloads/ui-components.zip', 'published', 'component', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (3, '产品设计模板', 103, '专业的产品设计模板和原型素材，提升设计效率', 'https://example.com/images/resource3.jpg', 'https://example.com/downloads/design-templates.zip', 'published', 'template', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (4, 'Python数据分析案例', 104, '真实的数据分析案例和代码示例，学习数据分析方法', 'https://example.com/images/resource4.jpg', 'https://example.com/downloads/python-cases.zip', 'published', 'case', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (5, '移动应用图标素材', 105, '精美的移动应用图标素材，支持多种尺寸和风格', 'https://example.com/images/resource5.jpg', 'https://example.com/downloads/app-icons.zip', 'published', 'material', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (6, '系统架构设计文档', 106, '大型系统架构设计文档和最佳实践指南', 'https://example.com/images/resource6.jpg', 'https://example.com/downloads/architecture-docs.zip', 'published', 'document', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (7, '数据库设计规范', 107, '企业级数据库设计规范和最佳实践', 'https://example.com/images/resource7.jpg', 'https://example.com/downloads/db-design.zip', 'published', 'document', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (8, 'API接口文档模板', 108, '标准的RESTful API接口文档模板和示例', 'https://example.com/images/resource8.jpg', 'https://example.com/downloads/api-docs.zip', 'published', 'template', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (9, '代码规范检查工具', 109, '自动化代码规范检查工具，提升代码质量', 'https://example.com/images/resource9.jpg', 'https://example.com/downloads/code-checker.zip', 'published', 'tool', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (10, '测试用例模板库', 110, '完整的测试用例模板和测试计划文档', 'https://example.com/images/resource10.jpg', 'https://example.com/downloads/test-cases.zip', 'published', 'template', '2026-01-24 10:24:27', '2026-01-24 10:24:27');
INSERT INTO `resource_resource` VALUES (11, '机器学习算法手册（PDF）', 1, '涵盖15种常用机器学习算法（线性回归、决策树、SVM等），包含数学原理、Python实现代码、案例分析', 'https://ai-edu-res.com/resources/ml_book.jpg', 'https://ai-res-download.com/ml_handbook.pdf', 'published', 'document', '2026-01-24 10:40:37', '2026-01-24 10:40:37');
INSERT INTO `resource_resource` VALUES (12, 'AI模型训练数据集：教育领域文本', 2, '10万条标注文本（包含K12知识点、习题解析），支持NLP模型训练（文本分类、摘要生成）', 'https://ai-edu-res.com/resources/edu_dataset.jpg', 'https://ai-dataset.com/edu_text.zip', 'published', 'dataset', '2026-01-24 10:40:37', '2026-01-24 10:40:37');
INSERT INTO `resource_resource` VALUES (13, 'LangChain实战教程（视频）', 1, '12节视频课，从基础组件到完整项目（AI问答系统），配套代码和PPT', 'https://ai-edu-res.com/resources/langchain_video.jpg', 'https://ai-video.com/langchain_course', 'published', 'video', '2026-01-24 10:40:37', '2026-01-24 10:40:37');
INSERT INTO `resource_resource` VALUES (14, 'Stable Diffusion优质模型合集', 2, '50+商业级SD模型（写实、动漫、插画风格），包含使用教程和提示词模板', 'https://ai-edu-res.com/resources/sd_models.jpg', 'https://ai-model.com/sd_collection.zip', 'published', 'model', '2026-01-24 10:40:37', '2026-01-24 10:40:37');
INSERT INTO `resource_resource` VALUES (15, 'AI伦理合规白皮书（2026版）', 1, '解读全球10+国家AI法规（欧盟AI法案、中国生成式AI办法），附合规自查清单', 'https://ai-edu-res.com/resources/ai_ethics_book.jpg', 'https://ai-res-download.com/ai_compliance.pdf', 'published', 'document', '2026-01-24 10:40:37', '2026-01-24 10:40:37');

-- ----------------------------
-- Table structure for resource_resource_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `resource_resource_category_relation`;
CREATE TABLE `resource_resource_category_relation`  (
                                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                        `category_id` bigint NOT NULL COMMENT '目录id',
                                                        `resource_id` bigint NOT NULL COMMENT '资源id',
                                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '资源类目关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of resource_resource_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for resource_resource_download
-- ----------------------------
DROP TABLE IF EXISTS `resource_resource_download`;
CREATE TABLE `resource_resource_download`  (
                                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                               `member_id` bigint NOT NULL COMMENT '会员id',
                                               `resource_id` bigint NOT NULL COMMENT '资源id',
                                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员下载记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of resource_resource_download
-- ----------------------------

-- ----------------------------
-- Table structure for resource_resource_search_record
-- ----------------------------
DROP TABLE IF EXISTS `resource_resource_search_record`;
CREATE TABLE `resource_resource_search_record`  (
                                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                    `member_id` bigint NOT NULL COMMENT '会员id',
                                                    `search_condition` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '搜索条件',
                                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员搜索记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of resource_resource_search_record
-- ----------------------------

-- ----------------------------
-- Table structure for search_content
-- ----------------------------
DROP TABLE IF EXISTS `search_content`;
CREATE TABLE `search_content`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `topic_id` bigint NOT NULL COMMENT '主题ID，如课程评论、知识评论的ID等',
                                   `topic_title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题标题，如课程评论、知识评论的ID等',
                                   `topic_type` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题类型，如课程评论、知识评论等',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '可搜索内容' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of search_content
-- ----------------------------

-- ----------------------------
-- Table structure for search_hot_word
-- ----------------------------
DROP TABLE IF EXISTS `search_hot_word`;
CREATE TABLE `search_hot_word`  (
                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                    `name` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '热词',
                                    `sort_order` bigint NOT NULL COMMENT '权重',
                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '热词' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of search_hot_word
-- ----------------------------

-- ----------------------------
-- Table structure for search_record
-- ----------------------------
DROP TABLE IF EXISTS `search_record`;
CREATE TABLE `search_record`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `word` varchar(4000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '搜索内容',
                                  `member_id` bigint NOT NULL DEFAULT 0 COMMENT '用户id',
                                  `ip_addr` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ip地址',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '搜索记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of search_record
-- ----------------------------

-- ----------------------------
-- Table structure for setting_agreement
-- ----------------------------
DROP TABLE IF EXISTS `setting_agreement`;
CREATE TABLE `setting_agreement`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '协议名称',
                                      `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '协议类型',
                                      `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '协议内容',
                                      `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '协议' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of setting_agreement
-- ----------------------------

-- ----------------------------
-- Table structure for setting_carousel
-- ----------------------------
DROP TABLE IF EXISTS `setting_carousel`;
CREATE TABLE `setting_carousel`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `carousel_json` json NULL COMMENT '轮播图设置json字符串',
                                     `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'index' COMMENT '类型',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '首页轮播图' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of setting_carousel
-- ----------------------------

-- ----------------------------
-- Table structure for t_agreement
-- ----------------------------
DROP TABLE IF EXISTS `t_agreement`;
CREATE TABLE `t_agreement`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '协议名称',
                                `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '协议类型',
                                `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '协议内容',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '协议' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_agreement
-- ----------------------------

-- ----------------------------
-- Table structure for t_announcement
-- ----------------------------
DROP TABLE IF EXISTS `t_announcement`;
CREATE TABLE `t_announcement`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                   `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '内容',
                                   `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '状态',
                                   `publish_time` timestamp NOT NULL COMMENT '发布时间',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '公告' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_announcement
-- ----------------------------

-- ----------------------------
-- Table structure for t_announcement_read_record
-- ----------------------------
DROP TABLE IF EXISTS `t_announcement_read_record`;
CREATE TABLE `t_announcement_read_record`  (
                                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                               `announcement_id` bigint NOT NULL COMMENT '公告id',
                                               `member_id` bigint NOT NULL COMMENT '会员id',
                                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '公告阅读记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_announcement_read_record
-- ----------------------------

-- ----------------------------
-- Table structure for t_answer
-- ----------------------------
DROP TABLE IF EXISTS `t_answer`;
CREATE TABLE `t_answer`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                             `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容',
                             `question_id` bigint NOT NULL COMMENT '问题id',
                             `member_id` bigint NOT NULL COMMENT '会员id',
                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '回答' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_answer
-- ----------------------------

-- ----------------------------
-- Table structure for t_article
-- ----------------------------
DROP TABLE IF EXISTS `t_article`;
CREATE TABLE `t_article`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                              `member_id` bigint NOT NULL COMMENT '用户id',
                              `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容',
                              `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '海报图片',
                              `tags` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '标签',
                              `keywords` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '关键字',
                              `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                              `introduction` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '描述',
                              `recommend` tinyint NOT NULL DEFAULT 0 COMMENT '推荐',
                              `top` tinyint NOT NULL DEFAULT 0 COMMENT '置顶',
                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_article
-- ----------------------------
INSERT INTO `t_article` VALUES (1, '2026年AI大模型发展趋势：多模态与轻量化', 1, '一、多模态能力成为核心竞争力...（详细分析Gemini 2、GPT-5的视频/音频理解能力）二、模型轻量化加速端侧部署...（讲解量化、蒸馏技术的最新进展）三、行业落地聚焦垂直场景...（教育、医疗、制造领域案例）', 'https://ai-edu-res.com/articles/llm_trend.jpg', 'AI大模型,多模态,2026趋势', 'AI趋势,大模型,多模态', 'published', '分析2026年AI大模型的三大核心方向，帮助开发者把握技术重点', 1, 1, '2026-01-24 10:40:40', '2026-01-24 10:40:40');
INSERT INTO `t_article` VALUES (2, '用Python实现简单AI问答系统：LangChain+OpenAI', 2, '步骤1：环境搭建（安装LangChain、OpenAI SDK）...步骤2：向量数据库集成（Pinecone）...步骤3：构建Chain流程（RetrievalQA）...步骤4：部署为API服务（FastAPI）...', 'https://ai-edu-res.com/articles/ai_qa_demo.jpg', 'Python,LangChain,AI问答', 'LangChain,AI开发,Python', 'published', '零基础教程，1小时搭建可商用的AI问答系统', 1, 0, '2026-01-24 10:40:40', '2026-01-24 10:40:40');
INSERT INTO `t_article` VALUES (3, 'AI绘画提示词编写技巧：从入门到精通', 1, '一、提示词结构：主体+风格+细节+参数...二、风格关键词汇总（写实、动漫、插画）...三、负面提示词使用技巧（避免生成低质量内容）...四、案例：生成“古风美女插画”的完整提示词', 'https://ai-edu-res.com/articles/ai_prompt.jpg', 'AI绘画,提示词,Stable Diffusion', 'AI绘画,提示词技巧,SD', 'published', '掌握提示词编写，让AI生成更符合预期的作品', 1, 0, '2026-01-24 10:40:40', '2026-01-24 10:40:40');
INSERT INTO `t_article` VALUES (4, 'AI教育应用的5个典型场景与落地难点', 2, '场景1：智能备课（自动生成课件）...场景2：学情分析（识别学生薄弱环节）...场景3：AI助教（实时解答问题）...落地难点：数据隐私保护、个性化适配...', 'https://ai-edu-res.com/articles/ai_edu_scene.jpg', 'AI教育,落地场景,教育科技', 'AI教育,场景分析,教育AI', 'published', '解析AI在教育领域的实际应用，帮助学校/机构制定落地策略', 0, 0, '2026-01-24 10:40:40', '2026-01-24 10:40:40');
INSERT INTO `t_article` VALUES (5, '机器学习过拟合的8种解决方案', 1, '1. 增加数据集规模...2. 特征选择（减少冗余特征）...3. 正则化（L1/L2）...4. 模型集成（随机森林、XGBoost）...5. 早停训练（Early Stopping）...', 'https://ai-edu-res.com/articles/overfitting_solve.jpg', '机器学习,过拟合,模型优化', '过拟合,模型优化,机器学习', 'published', '全面总结过拟合解决技巧，适配分类/回归等多种模型', 0, 0, '2026-01-24 10:40:40', '2026-01-24 10:40:40');

-- ----------------------------
-- Table structure for t_article_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_article_category_relation`;
CREATE TABLE `t_article_category_relation`  (
                                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                `category_id` bigint NOT NULL COMMENT '目录id',
                                                `article_id` bigint NOT NULL COMMENT '文章id',
                                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_article_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_authority
-- ----------------------------
DROP TABLE IF EXISTS `t_authority`;
CREATE TABLE `t_authority`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '权限名',
                                `alias` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '权限别名',
                                `pid` bigint NOT NULL DEFAULT 0 COMMENT '上级权限id',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 33 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '权限表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_authority
-- ----------------------------
INSERT INTO `t_authority` VALUES (1, 'organizational', '组织架构', 0, '2025-12-08 11:20:30', '2025-12-08 11:20:30');
INSERT INTO `t_authority` VALUES (2, 'organizational_user', '用户管理', 1, '2025-12-08 11:20:30', '2025-12-08 11:20:30');
INSERT INTO `t_authority` VALUES (3, 'authority_authority', '权限列表', 21, '2025-12-08 11:20:30', '2025-12-08 11:20:30');
INSERT INTO `t_authority` VALUES (4, 'authority_role', '角色管理', 21, '2025-12-08 11:20:30', '2025-12-08 11:20:30');
INSERT INTO `t_authority` VALUES (5, 'member_unaudited_list', 'a', 0, '2026-01-20 18:40:30', '2026-01-20 18:40:30');
INSERT INTO `t_authority` VALUES (7, 'member_list', 'a', 0, '2026-01-20 19:05:23', '2026-01-20 19:05:23');
INSERT INTO `t_authority` VALUES (8, 'setting_agreement', 'a', 0, '2026-01-20 19:20:33', '2026-01-20 19:26:33');
INSERT INTO `t_authority` VALUES (9, 'setting_carousel', 'a', 0, '2026-01-20 19:20:37', '2026-01-20 19:26:36');
INSERT INTO `t_authority` VALUES (21, 'authority', '权限认证', 0, '2025-12-08 11:20:30', '2025-12-08 11:20:30');
INSERT INTO `t_authority` VALUES (22, 'exam_question_lib', 'a', 0, '2026-01-20 20:12:13', '2026-01-20 20:12:13');
INSERT INTO `t_authority` VALUES (23, 'exam_page_list', '', 0, '2026-01-20 20:12:21', '2026-01-20 20:12:21');
INSERT INTO `t_authority` VALUES (24, 'exam_mark', '', 0, '2026-01-20 20:12:25', '2026-01-20 20:12:25');
INSERT INTO `t_authority` VALUES (25, 'exam_mock', '', 0, '2026-01-20 20:12:30', '2026-01-20 20:12:30');
INSERT INTO `t_authority` VALUES (26, 'exam_category', '', 0, '2026-01-20 20:12:34', '2026-01-20 20:12:34');
INSERT INTO `t_authority` VALUES (27, 'exam_list', '', 0, '2026-01-20 20:12:36', '2026-01-20 20:12:36');
INSERT INTO `t_authority` VALUES (28, 'live_channel', '', 0, '2026-01-20 20:32:48', '2026-01-20 20:32:48');
INSERT INTO `t_authority` VALUES (29, 'live_category', '', 0, '2026-01-20 20:32:54', '2026-01-20 20:32:54');
INSERT INTO `t_authority` VALUES (30, 'comment', '', 0, '2026-01-20 20:56:56', '2026-01-20 20:56:56');
INSERT INTO `t_authority` VALUES (31, 'comment_list', '', 0, '2026-01-20 20:57:01', '2026-01-20 20:57:01');
INSERT INTO `t_authority` VALUES (32, 'comment_sensitive_setting', '', 0, '2026-01-20 20:57:03', '2026-01-20 20:57:03');

-- ----------------------------
-- Table structure for t_carousel
-- ----------------------------
DROP TABLE IF EXISTS `t_carousel`;
CREATE TABLE `t_carousel`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `carousel_json` json NULL COMMENT '轮播图设置json字符串',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'index' COMMENT '类型',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '首页轮播图' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_carousel
-- ----------------------------
INSERT INTO `t_carousel` VALUES (1, '{\"images\": [{\"url\": \"https://example.com/images/banner1.jpg\", \"link\": \"/lesson/1\", \"title\": \"Java从入门到精通\"}, {\"url\": \"https://example.com/images/banner2.jpg\", \"link\": \"/lesson/2\", \"title\": \"Vue.js前端开发实战\"}]}', '2026-01-24 10:25:22', '2026-01-24 10:25:22', 'index');
INSERT INTO `t_carousel` VALUES (3, '{\"images\": [{\"url\": \"https://example.com/images/banner5.jpg\", \"link\": \"/exam/1\", \"title\": \"Java基础能力测评\"}]}', '2026-01-24 10:25:22', '2026-01-24 10:25:22', 'exam');

-- ----------------------------
-- Table structure for t_category
-- ----------------------------
DROP TABLE IF EXISTS `t_category`;
CREATE TABLE `t_category`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '类目名称',
                               `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                               `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                               `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                               `level` int NOT NULL COMMENT '目录等级',
                               `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                               `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'live' COMMENT '分类类型(live)',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               `company_id` bigint NOT NULL COMMENT '公司id',
                               `department_id` bigint NOT NULL COMMENT '部门id',
                               `create_user_id` bigint NOT NULL COMMENT '创建用户id',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '直播分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_category
-- ----------------------------
-- 一级分类：AI核心领域 (id, name, sort_order, is_show, is_show_index, level, image, type, create_time, update_time, company_id, department_id, create_user_id)
INSERT INTO `t_category` VALUES (1, '大语言模型(LLM)', 1, 1, 1, 1, 'https://ai-edu-res.com/category/llm.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (2, 'AI绘画与视觉', 2, 1, 1, 1, 'https://ai-edu-res.com/category/ai-art.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (3, 'AI音视频', 3, 1, 1, 1, 'https://ai-edu-res.com/category/ai-video.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (4, 'AI编程开发', 4, 1, 1, 1, 'https://ai-edu-res.com/category/ai-coding.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (5, 'AI基础技术', 5, 1, 1, 1, 'https://ai-edu-res.com/category/ai-foundation.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 一级分类：行业AI+
INSERT INTO `t_category` VALUES (6, 'AI+医疗健康', 6, 1, 1, 1, 'https://ai-edu-res.com/category/ai-medical.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (7, 'AI+金融科技', 7, 1, 1, 1, 'https://ai-edu-res.com/category/ai-finance.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (8, 'AI+智能制造', 8, 1, 1, 1, 'https://ai-edu-res.com/category/ai-manufacture.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (9, 'AI+零售电商', 9, 1, 1, 1, 'https://ai-edu-res.com/category/ai-retail.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (10, 'AI+教育培训', 10, 1, 1, 1, 'https://ai-edu-res.com/category/ai-education.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (11, 'AI+法律政务', 11, 1, 1, 1, 'https://ai-edu-res.com/category/ai-legal.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (12, 'AI+农业科技', 12, 1, 1, 1, 'https://ai-edu-res.com/category/ai-agriculture.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (13, 'AI+交通出行', 13, 1, 1, 1, 'https://ai-edu-res.com/category/ai-transport.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (14, 'AI+能源环保', 14, 1, 1, 1, 'https://ai-edu-res.com/category/ai-energy.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (15, 'AI+文化创意', 15, 1, 1, 1, 'https://ai-edu-res.com/category/ai-creative.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：大语言模型(LLM)子分类
INSERT INTO `t_category` VALUES (101, 'ChatGPT应用实战', 1, 1, 0, 2, 'https://ai-edu-res.com/category/chatgpt.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (102, 'Claude技术解析', 2, 1, 0, 2, 'https://ai-edu-res.com/category/claude.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (103, '国产大模型', 3, 1, 0, 2, 'https://ai-edu-res.com/category/china-llm.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (104, '提示词工程', 4, 1, 0, 2, 'https://ai-edu-res.com/category/prompt.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (105, 'Agent智能体', 5, 1, 0, 2, 'https://ai-edu-res.com/category/agent.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (106, 'RAG检索增强', 6, 1, 0, 2, 'https://ai-edu-res.com/category/rag.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (107, '微调与训练', 7, 1, 0, 2, 'https://ai-edu-res.com/category/finetune.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI绘画与视觉子分类
INSERT INTO `t_category` VALUES (201, 'Stable Diffusion', 1, 1, 0, 2, 'https://ai-edu-res.com/category/sd.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (202, 'Midjourney', 2, 1, 0, 2, 'https://ai-edu-res.com/category/mj.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (203, 'DALL-E图像生成', 3, 1, 0, 2, 'https://ai-edu-res.com/category/dalle.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (204, 'ControlNet控制', 4, 1, 0, 2, 'https://ai-edu-res.com/category/controlnet.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (205, 'ComfyUI工作流', 5, 1, 0, 2, 'https://ai-edu-res.com/category/comfyui.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (206, 'AI商业设计', 6, 1, 0, 2, 'https://ai-edu-res.com/category/ai-design.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (207, 'LoRA模型训练', 7, 1, 0, 2, 'https://ai-edu-res.com/category/lora.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI音视频子分类
INSERT INTO `t_category` VALUES (301, 'AI语音合成(TTS)', 1, 1, 0, 2, 'https://ai-edu-res.com/category/tts.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (302, 'AI语音识别(ASR)', 2, 1, 0, 2, 'https://ai-edu-res.com/category/asr.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (303, 'AI视频生成', 3, 1, 0, 2, 'https://ai-edu-res.com/category/sora.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (304, 'AI音乐创作', 4, 1, 0, 2, 'https://ai-edu-res.com/category/ai-music.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (305, '数字人与虚拟主播', 5, 1, 0, 2, 'https://ai-edu-res.com/category/digital-human.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (306, 'AI视频剪辑', 6, 1, 0, 2, 'https://ai-edu-res.com/category/ai-edit.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI编程开发子分类
INSERT INTO `t_category` VALUES (401, 'AI辅助编程', 1, 1, 0, 2, 'https://ai-edu-res.com/category/copilot.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (402, 'AI代码审查', 2, 1, 0, 2, 'https://ai-edu-res.com/category/code-review.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (403, 'LLM应用开发', 3, 1, 0, 2, 'https://ai-edu-res.com/category/llm-dev.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (404, '向量数据库', 4, 1, 0, 2, 'https://ai-edu-res.com/category/vector-db.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (405, 'AI模型部署', 5, 1, 0, 2, 'https://ai-edu-res.com/category/deploy.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (406, 'AI测试自动化', 6, 1, 0, 2, 'https://ai-edu-res.com/category/ai-test.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI基础技术子分类
INSERT INTO `t_category` VALUES (501, '深度学习基础', 1, 1, 0, 2, 'https://ai-edu-res.com/category/deep-learning.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (502, '机器学习算法', 2, 1, 0, 2, 'https://ai-edu-res.com/category/ml.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (503, '计算机视觉(CV)', 3, 1, 0, 2, 'https://ai-edu-res.com/category/cv.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (504, '自然语言处理(NLP)', 4, 1, 0, 2, 'https://ai-edu-res.com/category/nlp.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (505, '推荐系统', 5, 1, 0, 2, 'https://ai-edu-res.com/category/recommend.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (506, '强化学习', 6, 1, 0, 2, 'https://ai-edu-res.com/category/rl.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+医疗健康子分类
INSERT INTO `t_category` VALUES (601, 'AI辅助诊断', 1, 1, 0, 2, 'https://ai-edu-res.com/category/ai-diagnosis.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (602, '医学影像分析', 2, 1, 0, 2, 'https://ai-edu-res.com/category/medical-imaging.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (603, '药物研发AI', 3, 1, 0, 2, 'https://ai-edu-res.com/category/drug-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (604, '健康管理AI', 4, 1, 0, 2, 'https://ai-edu-res.com/category/health-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (605, '医疗机器人', 5, 1, 0, 2, 'https://ai-edu-res.com/category/medical-robot.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+金融科技子分类
INSERT INTO `t_category` VALUES (701, '智能风控', 1, 1, 0, 2, 'https://ai-edu-res.com/category/risk-control.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (702, '量化交易', 2, 1, 0, 2, 'https://ai-edu-res.com/category/quant.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (703, 'AI智能投顾', 3, 1, 0, 2, 'https://ai-edu-res.com/category/robo-advisor.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (704, '金融智能客服', 4, 1, 0, 2, 'https://ai-edu-res.com/category/finance-bot.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (705, '保险科技AI', 5, 1, 0, 2, 'https://ai-edu-res.com/category/insurtech.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+智能制造子分类
INSERT INTO `t_category` VALUES (801, '工业质检AI', 1, 1, 0, 2, 'https://ai-edu-res.com/category/quality-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (802, '智能仓储物流', 2, 1, 0, 2, 'https://ai-edu-res.com/category/warehouse-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (803, '预测性维护', 3, 1, 0, 2, 'https://ai-edu-res.com/category/predictive.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (804, '工业机器人', 4, 1, 0, 2, 'https://ai-edu-res.com/category/industrial-robot.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (805, '数字孪生', 5, 1, 0, 2, 'https://ai-edu-res.com/category/digital-twin.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+零售电商子分类
INSERT INTO `t_category` VALUES (901, '智能推荐系统', 1, 1, 0, 2, 'https://ai-edu-res.com/category/recommend-sys.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (902, '虚拟试衣试妆', 2, 1, 0, 2, 'https://ai-edu-res.com/category/virtual-try.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (903, '智能客服机器人', 3, 1, 0, 2, 'https://ai-edu-res.com/category/chatbot.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (904, '供应链AI优化', 4, 1, 0, 2, 'https://ai-edu-res.com/category/supply-chain.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (905, '智能定价策略', 5, 1, 0, 2, 'https://ai-edu-res.com/category/pricing-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+教育培训子分类
INSERT INTO `t_category` VALUES (1001, '智能备课系统', 1, 1, 0, 2, 'https://ai-edu-res.com/category/lesson-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1002, 'AI批改作业', 2, 1, 0, 2, 'https://ai-edu-res.com/category/grading-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1003, '个性化学习', 3, 1, 0, 2, 'https://ai-edu-res.com/category/adaptive-learning.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1004, '虚拟教师助手', 4, 1, 0, 2, 'https://ai-edu-res.com/category/virtual-teacher.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1005, '教育数据分析', 5, 1, 0, 2, 'https://ai-edu-res.com/category/edu-analytics.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+法律政务子分类
INSERT INTO `t_category` VALUES (1101, '智能法律咨询', 1, 1, 0, 2, 'https://ai-edu-res.com/category/legal-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1102, '合同审核AI', 2, 1, 0, 2, 'https://ai-edu-res.com/category/contract-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1103, '智慧政务', 3, 1, 0, 2, 'https://ai-edu-res.com/category/gov-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1104, '司法辅助AI', 4, 1, 0, 2, 'https://ai-edu-res.com/category/judicial-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1105, '合规风险检测', 5, 1, 0, 2, 'https://ai-edu-res.com/category/compliance-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+农业科技子分类
INSERT INTO `t_category` VALUES (1201, '智能灌溉', 1, 1, 0, 2, 'https://ai-edu-res.com/category/irrigation-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1202, '病虫害识别', 2, 1, 0, 2, 'https://ai-edu-res.com/category/pest-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1203, '产量预测', 3, 1, 0, 2, 'https://ai-edu-res.com/category/yield-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1204, '农业机器人', 4, 1, 0, 2, 'https://ai-edu-res.com/category/agri-robot.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1205, '精准农业', 5, 1, 0, 2, 'https://ai-edu-res.com/category/precision-agri.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+交通出行子分类
INSERT INTO `t_category` VALUES (1301, '自动驾驶', 1, 1, 0, 2, 'https://ai-edu-res.com/category/autonomous.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1302, '智能交通管理', 2, 1, 0, 2, 'https://ai-edu-res.com/category/traffic-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1303, '物流配送AI', 3, 1, 0, 2, 'https://ai-edu-res.com/category/logistics-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1304, '出行规划AI', 4, 1, 0, 2, 'https://ai-edu-res.com/category/trip-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1305, '车联网AI', 5, 1, 0, 2, 'https://ai-edu-res.com/category/v2x-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+能源环保子分类
INSERT INTO `t_category` VALUES (1401, '智能电网', 1, 1, 0, 2, 'https://ai-edu-res.com/category/smart-grid.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1402, '能耗优化', 2, 1, 0, 2, 'https://ai-edu-res.com/category/energy-opt.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1403, '环境监测AI', 3, 1, 0, 2, 'https://ai-edu-res.com/category/env-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1404, '碳排放管理', 4, 1, 0, 2, 'https://ai-edu-res.com/category/carbon-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1405, '新能源预测', 5, 1, 0, 2, 'https://ai-edu-res.com/category/renewable-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- 二级分类：AI+文化创意子分类
INSERT INTO `t_category` VALUES (1501, 'AI写作创作', 1, 1, 0, 2, 'https://ai-edu-res.com/category/ai-writing.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1502, 'AI游戏开发', 2, 1, 0, 2, 'https://ai-edu-res.com/category/game-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1503, '虚拟偶像', 3, 1, 0, 2, 'https://ai-edu-res.com/category/virtual-idol.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1504, 'AI影视特效', 4, 1, 0, 2, 'https://ai-edu-res.com/category/vfx-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);
INSERT INTO `t_category` VALUES (1505, '文化遗产数字化', 5, 1, 0, 2, 'https://ai-edu-res.com/category/heritage-ai.jpg', 'live', '2026-01-31 10:00:00', '2026-01-31 10:00:00', 1, 1, 1);

-- ----------------------------
-- Table structure for t_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_category_relation`;
CREATE TABLE `t_category_relation`  (
                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                        `child_category_id` bigint NOT NULL COMMENT '子类目id',
                                        `father_category_id` bigint NOT NULL COMMENT '父类目id',
                                        `direct_father_category_id` bigint NOT NULL COMMENT '直属父类目id',
                                        `is_sub` tinyint NOT NULL COMMENT '是否属于子类目',
                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '问题分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_category_relation
-- ----------------------------
-- 一级分类的关系(父节点为0)
INSERT INTO `t_category_relation` VALUES (1, 1, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (2, 2, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (3, 3, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (4, 4, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (5, 5, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (6, 6, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (7, 7, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (8, 8, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (9, 9, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (10, 10, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (11, 11, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (12, 12, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (13, 13, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (14, 14, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (15, 15, 0, 0, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- 大语言模型(LLM)的子分类关系
INSERT INTO `t_category_relation` VALUES (101, 101, 1, 1, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (102, 102, 1, 1, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (103, 103, 1, 1, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (104, 104, 1, 1, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (105, 105, 1, 1, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (106, 106, 1, 1, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (107, 107, 1, 1, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI绘画与视觉的子分类关系
INSERT INTO `t_category_relation` VALUES (201, 201, 2, 2, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (202, 202, 2, 2, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (203, 203, 2, 2, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (204, 204, 2, 2, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (205, 205, 2, 2, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (206, 206, 2, 2, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (207, 207, 2, 2, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI音视频的子分类关系
INSERT INTO `t_category_relation` VALUES (301, 301, 3, 3, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (302, 302, 3, 3, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (303, 303, 3, 3, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (304, 304, 3, 3, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (305, 305, 3, 3, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (306, 306, 3, 3, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI编程开发的子分类关系
INSERT INTO `t_category_relation` VALUES (401, 401, 4, 4, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (402, 402, 4, 4, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (403, 403, 4, 4, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (404, 404, 4, 4, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (405, 405, 4, 4, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (406, 406, 4, 4, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI基础技术的子分类关系
INSERT INTO `t_category_relation` VALUES (501, 501, 5, 5, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (502, 502, 5, 5, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (503, 503, 5, 5, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (504, 504, 5, 5, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (505, 505, 5, 5, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (506, 506, 5, 5, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+医疗健康的子分类关系
INSERT INTO `t_category_relation` VALUES (601, 601, 6, 6, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (602, 602, 6, 6, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (603, 603, 6, 6, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (604, 604, 6, 6, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (605, 605, 6, 6, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+金融科技的子分类关系
INSERT INTO `t_category_relation` VALUES (701, 701, 7, 7, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (702, 702, 7, 7, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (703, 703, 7, 7, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (704, 704, 7, 7, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (705, 705, 7, 7, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+智能制造的子分类关系
INSERT INTO `t_category_relation` VALUES (801, 801, 8, 8, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (802, 802, 8, 8, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (803, 803, 8, 8, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (804, 804, 8, 8, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (805, 805, 8, 8, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+零售电商的子分类关系
INSERT INTO `t_category_relation` VALUES (901, 901, 9, 9, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (902, 902, 9, 9, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (903, 903, 9, 9, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (904, 904, 9, 9, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (905, 905, 9, 9, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+教育培训的子分类关系
INSERT INTO `t_category_relation` VALUES (1001, 1001, 10, 10, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1002, 1002, 10, 10, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1003, 1003, 10, 10, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1004, 1004, 10, 10, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1005, 1005, 10, 10, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+法律政务的子分类关系
INSERT INTO `t_category_relation` VALUES (1101, 1101, 11, 11, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1102, 1102, 11, 11, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1103, 1103, 11, 11, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1104, 1104, 11, 11, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1105, 1105, 11, 11, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+农业科技的子分类关系
INSERT INTO `t_category_relation` VALUES (1201, 1201, 12, 12, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1202, 1202, 12, 12, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1203, 1203, 12, 12, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1204, 1204, 12, 12, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1205, 1205, 12, 12, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+交通出行的子分类关系
INSERT INTO `t_category_relation` VALUES (1301, 1301, 13, 13, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1302, 1302, 13, 13, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1303, 1303, 13, 13, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1304, 1304, 13, 13, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1305, 1305, 13, 13, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+能源环保的子分类关系
INSERT INTO `t_category_relation` VALUES (1401, 1401, 14, 14, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1402, 1402, 14, 14, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1403, 1403, 14, 14, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1404, 1404, 14, 14, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1405, 1405, 14, 14, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- AI+文化创意的子分类关系
INSERT INTO `t_category_relation` VALUES (1501, 1501, 15, 15, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1502, 1502, 15, 15, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1503, 1503, 15, 15, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1504, 1504, 15, 15, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');
INSERT INTO `t_category_relation` VALUES (1505, 1505, 15, 15, 1, '2026-01-31 10:00:00', '2026-01-31 10:00:00');

-- ----------------------------
-- Table structure for t_certificate
-- ----------------------------
DROP TABLE IF EXISTS `t_certificate`;
CREATE TABLE `t_certificate`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
                                  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                                  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '逻辑删除（0-未删除，1-已删除）',
                                  `version` int NOT NULL DEFAULT 1 COMMENT '乐观锁版本号',
                                  `certificate_id` bigint NULL DEFAULT NULL COMMENT '证书Id',
                                  `code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '证书编号',
                                  `name` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '证书的名称',
                                  `description` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '证书的描述',
                                  `awarding_organization` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '颁发证书的机构',
                                  `awarder_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '颁发证书的人员或代表的名称',
                                  `awarder_position` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '颁发证书的人员或代表的职位或职称',
                                  `design` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '证书模板的设计图片或样式文件（存储URL/路径）',
                                  `award_conditions` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '证书的颁发条件或要求',
                                  `validity_policy` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '证书的有效期限或到期策略',
                                  `award_date` datetime NULL DEFAULT NULL COMMENT '证书的颁发日期',
                                  `validity` datetime NULL DEFAULT NULL COMMENT '证书的有效期限',
                                  `status` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '证书的状态（例如：有效、已过期、作废等）',
                                  `member_id` bigint NULL DEFAULT NULL COMMENT '获证人员的唯一标识符',
                                  `lesson_id` bigint NULL DEFAULT NULL COMMENT '相关课程的唯一标识符',
                                  `lesson_sign_id` bigint NULL DEFAULT NULL COMMENT '课程报名Id',
                                  `lesson_sign_time` datetime NULL DEFAULT NULL COMMENT '课程报名时间',
                                  `lesson_complete_time` datetime NULL DEFAULT NULL COMMENT '课程报名学习完成时间',
                                  `score` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '获证人员的成绩（支持分数/等级，如95/优秀）',
                                  `company_id` bigint NULL DEFAULT NULL COMMENT '公司Id',
                                  `create_user_id` bigint NULL DEFAULT NULL COMMENT '创建人Id',
                                  `create_user_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '创建人名称',
                                  `update_user_id` bigint NULL DEFAULT NULL COMMENT '修改人Id',
                                  `update_user_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '修改人名称',
                                  PRIMARY KEY (`id`) USING BTREE,
                                  INDEX `idx_certificate_id`(`certificate_id` ASC) USING BTREE,
                                  INDEX `idx_member_id`(`member_id` ASC) USING BTREE,
                                  INDEX `idx_lesson_id`(`lesson_id` ASC) USING BTREE,
                                  INDEX `idx_status`(`status` ASC) USING BTREE,
                                  INDEX `idx_company_id`(`company_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '证书表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_certificate
-- ----------------------------
INSERT INTO `t_certificate` VALUES (1, '2026-01-24 10:26:09', '2026-01-24 10:26:09', 0, 1, 1, 'CERT20260121001', 'Java从入门到精通结业证书', '完成Java从入门到精通课程学习，成绩优秀', '在线教育平台', '张老师', '高级讲师', 'https://example.com/images/cert1.jpg', '完成所有课程学习并通过最终考核', '永久有效', '2025-12-25 10:26:09', NULL, 'valid', 101, 1, 1, '2025-10-26 10:26:09', '2025-12-25 10:26:09', '95', 1, 1, '系统管理员', 1, '系统管理员');
INSERT INTO `t_certificate` VALUES (2, '2026-01-24 10:26:09', '2026-01-24 10:26:09', 0, 1, 2, 'CERT20260121002', 'Vue.js前端开发实战结业证书', '完成Vue.js前端开发实战课程学习', '在线教育平台', '李老师', '资深前端工程师', 'https://example.com/images/cert2.jpg', '完成所有课程学习并通过最终考核', '永久有效', '2026-01-04 10:26:09', NULL, 'valid', 102, 2, 2, '2025-11-25 10:26:09', '2026-01-04 10:26:09', '88', 1, 1, '系统管理员', 1, '系统管理员');
INSERT INTO `t_certificate` VALUES (3, '2026-01-24 10:26:09', '2026-01-24 10:26:09', 0, 1, 3, 'CERT20260121003', 'Python数据分析与可视化结业证书', '完成Python数据分析与可视化课程学习', '在线教育平台', '王老师', '数据科学家', 'https://example.com/images/cert3.jpg', '完成所有课程学习并通过最终考核', '永久有效', '2026-01-09 10:26:09', NULL, 'valid', 104, 3, 3, '2025-11-10 10:26:09', '2026-01-09 10:26:09', '92', 1, 1, '系统管理员', 1, '系统管理员');

-- ----------------------------
-- Table structure for t_certificate_template
-- ----------------------------
DROP TABLE IF EXISTS `t_certificate_template`;
CREATE TABLE `t_certificate_template`  (
                                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                           `name` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '证书模板的名称',
                                           `description` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT '' COMMENT '证书模板的描述',
                                           `awarding_organization` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '颁发证书的机构',
                                           `awarder_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '颁发证书的人员或代表的名称',
                                           `awarder_position` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '颁发证书的人员或代表的职位或职称',
                                           `design` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '证书模板的设计图片或样式文件（图片URL）',
                                           `award_conditions` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '证书的颁发条件或要求',
                                           `validity_policy` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '证书的有效期限或到期策略',
                                           `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'inactive' COMMENT '状态：active-启用, inactive-禁用, deleted-已删除',
                                           `company_id` bigint NULL DEFAULT NULL COMMENT '公司Id',
                                           `create_user_id` bigint NULL DEFAULT NULL COMMENT '创建人Id',
                                           `create_user_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '创建人名称',
                                           `update_user_id` bigint NULL DEFAULT NULL COMMENT '修改人Id',
                                           `update_user_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '修改人名称',
                                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                           PRIMARY KEY (`id`) USING BTREE,
                                           INDEX `idx_status`(`status` ASC) USING BTREE,
                                           INDEX `idx_company_id`(`company_id` ASC) USING BTREE,
                                           INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '证书模板表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_certificate_template
-- ----------------------------

-- ----------------------------
-- Table structure for t_channel
-- ----------------------------
DROP TABLE IF EXISTS `t_channel`;
CREATE TABLE `t_channel`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '频道名称',
                              `introduction` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '活动描述',
                              `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '海报（图片URL）',
                              `user_id` bigint NOT NULL COMMENT '用户id',
                              `status` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态：active-活跃, inactive-非活跃, forbid-禁播, deleted-删除',
                              `start_time` timestamp NOT NULL COMMENT '直播时间',
                              `show_number` tinyint NOT NULL DEFAULT 1 COMMENT '人数显示：1-显示, 0-不显示（观看页面显示预约人数、在线人数）',
                              `enable_chat` tinyint NOT NULL DEFAULT 1 COMMENT '是否开启聊天：1-开启, 0-关闭',
                              `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              `member_receive_num` bigint NOT NULL COMMENT '会员每次领取数量',
                              `day_issued_num` bigint NOT NULL DEFAULT 0 COMMENT '日发放阈值',
                              `day_member_receive_num` bigint NOT NULL DEFAULT 0 COMMENT '每日会员领取阈值',
                              `issued_num` bigint NOT NULL DEFAULT 0 COMMENT '总发放阈值',
                              `change_remind` tinyint NOT NULL DEFAULT 0 COMMENT '是否变动提醒：1-是, 0-否',
                              `increase_remind_tips` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '增加积分变动提示语，{{coin}}表示变动金额',
                              `decrease_remind_tips` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '消耗积分变动提示语，{{coin}}表示变动金额',
                              PRIMARY KEY (`id`) USING BTREE,
                              INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
                              INDEX `idx_status`(`status` ASC) USING BTREE,
                              INDEX `idx_start_time`(`start_time` ASC) USING BTREE,
                              INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '直播频道表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_channel
-- ----------------------------

-- ----------------------------
-- Table structure for t_channel_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_channel_category_relation`;
CREATE TABLE `t_channel_category_relation`  (
                                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                `category_id` bigint NOT NULL COMMENT '目录id',
                                                `channel_id` bigint NOT NULL COMMENT '频道id',
                                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '频道分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_channel_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_channel_lecturer
-- ----------------------------
DROP TABLE IF EXISTS `t_channel_lecturer`;
CREATE TABLE `t_channel_lecturer`  (
                                       `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                       `lecturer_id` bigint NOT NULL COMMENT '讲师id',
                                       `channel_id` bigint NOT NULL COMMENT '频道id',
                                       `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                       `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                       PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '频道讲师' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_channel_lecturer
-- ----------------------------

-- ----------------------------
-- Table structure for t_check_in
-- ----------------------------
DROP TABLE IF EXISTS `t_check_in`;
CREATE TABLE `t_check_in`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `member_id` bigint NOT NULL COMMENT '会员id',
                               `continuous_num` bigint NOT NULL COMMENT '连续签到天数',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员连续签到' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_check_in
-- ----------------------------

-- ----------------------------
-- Table structure for t_check_in_record
-- ----------------------------
DROP TABLE IF EXISTS `t_check_in_record`;
CREATE TABLE `t_check_in_record`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `member_id` bigint NOT NULL COMMENT '会员id',
                                      `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '签到类型',
                                      `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员签到记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_check_in_record
-- ----------------------------

-- ----------------------------
-- Table structure for t_circle
-- ----------------------------
DROP TABLE IF EXISTS `t_circle`;
CREATE TABLE `t_circle`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                             `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                             `member_id` bigint NOT NULL COMMENT '会员id',
                             `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '图片',
                             `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                             `introduction` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '描述',
                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '圈子' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_circle
-- ----------------------------
INSERT INTO `t_circle` VALUES (1, 'Java技术交流圈', 101, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', '专注于Java技术分享与交流，欢迎Java开发者加入', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (2, '前端开发学习圈', 102, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', '前端技术学习交流，分享最新前端框架和工具', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (3, '产品经理成长圈', 103, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', '产品设计、用户体验、产品运营经验分享', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (4, 'Python数据分析', 104, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', 'Python数据分析、机器学习、人工智能技术交流', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (5, '移动开发技术圈', 105, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', 'iOS、Android开发技术分享与交流', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (6, 'UI设计交流圈', 106, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', 'UI/UX设计经验分享，设计工具使用技巧', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (7, '运营增长实战圈', 107, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', '用户运营、内容运营、活动运营实战经验', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (8, '区块链技术圈', 108, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', '区块链技术、加密货币、DeFi应用讨论', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (9, '云计算架构圈', 109, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', '云原生、微服务、容器化技术交流', '2026-01-24 09:32:29', '2026-01-24 09:32:29');
INSERT INTO `t_circle` VALUES (10, '网络安全技术圈', 110, 'https://file.aizhs.top/sys-backs/2025/12/06/wx_1765002739609_0_20251206063221.jpg', 'published', '网络安全、渗透测试、安全防护技术分享', '2026-01-24 09:32:29', '2026-01-24 09:32:29');

-- ----------------------------
-- Table structure for t_circle_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_circle_category_relation`;
CREATE TABLE `t_circle_category_relation`  (
                                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                               `category_id` bigint NOT NULL COMMENT '目录id',
                                               `circle_id` bigint NOT NULL COMMENT '圈子id',
                                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '圈子类目关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_circle_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_circle_member
-- ----------------------------
DROP TABLE IF EXISTS `t_circle_member`;
CREATE TABLE `t_circle_member`  (
                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                    `member_id` bigint NOT NULL COMMENT '会员id',
                                    `circle_id` bigint NOT NULL COMMENT '圈子id',
                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '圈子会员' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_circle_member
-- ----------------------------

-- ----------------------------
-- Table structure for t_comment
-- ----------------------------
DROP TABLE IF EXISTS `t_comment`;
CREATE TABLE `t_comment`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `topic_id` bigint NOT NULL COMMENT '主题ID，如课程评论、知识评论的ID等',
                              `topic_type` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题类型，如课程评论、知识评论等',
                              `content` varchar(4000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '评论内容',
                              `member_id` bigint NOT NULL COMMENT '评论用户id',
                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '评论表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_comment
-- ----------------------------

-- ----------------------------
-- Table structure for t_company
-- ----------------------------
DROP TABLE IF EXISTS `t_company`;
CREATE TABLE `t_company`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `code` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '编号',
                              `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                              `short_name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '简称',
                              `enabled` tinyint NOT NULL DEFAULT 1 COMMENT '0：弃用，1：启用',
                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '公司' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_company
-- ----------------------------

-- ----------------------------
-- Table structure for t_company_department_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_company_department_relation`;
CREATE TABLE `t_company_department_relation`  (
                                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                  `company_id` bigint NOT NULL COMMENT '公司id',
                                                  `department_id` bigint NOT NULL COMMENT '部门id',
                                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '公司与部门关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_company_department_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_content
-- ----------------------------
DROP TABLE IF EXISTS `t_content`;
CREATE TABLE `t_content`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `topic_id` bigint NOT NULL COMMENT '主题ID，如课程评论、知识评论的ID等',
                              `topic_title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题标题，如课程评论、知识评论的ID等',
                              `topic_type` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题类型，如课程评论、知识评论等',
                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '可搜索内容' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_content
-- ----------------------------

-- ----------------------------
-- Table structure for t_department
-- ----------------------------
DROP TABLE IF EXISTS `t_department`;
CREATE TABLE `t_department`  (
                                 `id` bigint NOT NULL DEFAULT 0 COMMENT '主键id',
                                 `code` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '编号',
                                 `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                                 `short_name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '简称',
                                 `enabled` tinyint NOT NULL DEFAULT 1 COMMENT '0：弃用，1：启用',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '部门表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_department
-- ----------------------------
INSERT INTO `t_department` VALUES (1, '1', '管理员', '', 1, '2025-12-30 20:24:17', '2026-01-02 14:34:41');
INSERT INTO `t_department` VALUES (2, '2', '普通员工', '', 1, '2026-01-26 18:00:52', '2026-01-26 18:00:52');

-- ----------------------------
-- Table structure for t_department_department
-- ----------------------------
DROP TABLE IF EXISTS `t_department_department`;
CREATE TABLE `t_department_department`  (
                                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                            `child_department_id` bigint NOT NULL COMMENT '子部门id',
                                            `father_department_id` bigint NOT NULL COMMENT '部门id',
                                            `direct_father_department_id` bigint NOT NULL COMMENT '直属父部门id',
                                            `is_sub` tinyint NOT NULL DEFAULT 0 COMMENT '是否属于子类',
                                            `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                            `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '部门之间的关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_department_department
-- ----------------------------

-- ----------------------------
-- Table structure for t_dynamic
-- ----------------------------
DROP TABLE IF EXISTS `t_dynamic`;
CREATE TABLE `t_dynamic`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '内容',
                              `member_id` bigint NOT NULL COMMENT '会员id',
                              `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '图片，多个逗号隔开',
                              `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                              `circle_id` bigint NOT NULL COMMENT '圈子id',
                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '圈子动态' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_dynamic
-- ----------------------------

-- ----------------------------
-- Table structure for t_exam
-- ----------------------------
DROP TABLE IF EXISTS `t_exam`;
CREATE TABLE `t_exam`  (
                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                           `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '测评名称（最大长度64个字符，只支持中文、字母、数字和下划线）',
                           `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '编号',
                           `start_time` timestamp NOT NULL COMMENT '开始时间',
                           `end_time` timestamp NOT NULL COMMENT '结束时间',
                           `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '封面图片（海报、banner）',
                           `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态：unpublished-未发布, published-已发布, deleted-已删除',
                           `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '简介',
                           `introduction` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '描述',
                           `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sign' COMMENT '类型：sign-报名（默认）, activity-公开（自动报名）, questionnaire-问卷',
                           `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                           `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                           PRIMARY KEY (`id`) USING BTREE,
                           INDEX `idx_code`(`code` ASC) USING BTREE,
                           INDEX `idx_status`(`status` ASC) USING BTREE,
                           INDEX `idx_type`(`type` ASC) USING BTREE,
                           INDEX `idx_start_time`(`start_time` ASC) USING BTREE,
                           INDEX `idx_end_time`(`end_time` ASC) USING BTREE,
                           INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '测评表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_exam
-- ----------------------------

-- ----------------------------
-- Table structure for t_exam_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_exam_category_relation`;
CREATE TABLE `t_exam_category_relation`  (
                                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                             `category_id` bigint NOT NULL COMMENT '目录id',
                                             `exam_id` bigint NOT NULL COMMENT '考试id',
                                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '考试与分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_exam_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_exam_chapter
-- ----------------------------
DROP TABLE IF EXISTS `t_exam_chapter`;
CREATE TABLE `t_exam_chapter`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `exam_id` bigint NULL DEFAULT NULL COMMENT '考试id',
                                   `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章标题',
                                   `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                   `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '考试章' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_exam_chapter
-- ----------------------------

-- ----------------------------
-- Table structure for t_exam_chapter_section
-- ----------------------------
DROP TABLE IF EXISTS `t_exam_chapter_section`;
CREATE TABLE `t_exam_chapter_section`  (
                                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                           `exam_chapter_id` bigint NULL DEFAULT NULL COMMENT '考试章id',
                                           `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章节标题',
                                           `paper_id` bigint NOT NULL COMMENT '试卷id',
                                           `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                           `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                           `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '考试章节' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_exam_chapter_section
-- ----------------------------

-- ----------------------------
-- Table structure for t_favorite
-- ----------------------------
DROP TABLE IF EXISTS `t_favorite`;
CREATE TABLE `t_favorite`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `topic_id` bigint NOT NULL COMMENT '主题ID，如课程评论、知识评论的ID等',
                               `topic_type` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题类型，如课程评论、知识评论等',
                               `member_id` bigint NOT NULL COMMENT '用户id',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '收藏' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_favorite
-- ----------------------------

-- ----------------------------
-- Table structure for t_follow
-- ----------------------------
DROP TABLE IF EXISTS `t_follow`;
CREATE TABLE `t_follow`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                             `member_id` bigint NOT NULL COMMENT '会员id',
                             `follow_member_id` bigint NOT NULL COMMENT '关注的会员id',
                             `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'follow' COMMENT '状态',
                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员关注' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_follow
-- ----------------------------

-- ----------------------------
-- Table structure for t_homework
-- ----------------------------
DROP TABLE IF EXISTS `t_homework`;
CREATE TABLE `t_homework`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `lesson_id` bigint NOT NULL COMMENT '课程id',
                               `url` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT '附件地址',
                               `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '作业内容',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '作业' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_homework
-- ----------------------------
INSERT INTO `t_homework` VALUES (1, 1, 'https://example.com/files/homework1.pdf', '完成一个简单的Java控制台程序，实现学生信息管理系统，包括添加、删除、查询、修改功能。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (2, 2, 'https://example.com/files/homework2.pdf', '使用Vue 3开发一个待办事项应用，要求使用Composition API，实现增删改查功能。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (3, 3, 'https://example.com/files/homework3.pdf', '使用Python和Pandas分析一个真实的数据集，完成数据清洗、分析和可视化。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (4, 4, 'https://example.com/files/homework4.pdf', '设计一个移动应用的UI界面，包括登录页、首页、详情页，使用Figma完成设计。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (5, 5, 'https://example.com/files/homework5.pdf', '完成一个产品需求文档，包括用户画像、功能需求、交互设计等内容。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (6, 6, 'https://example.com/files/homework6.pdf', '使用React Native开发一个简单的新闻阅读应用，实现列表展示和详情查看功能。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (7, 7, 'https://example.com/files/homework7.pdf', '使用Spring Boot开发一个RESTful API，实现用户管理功能，包括CRUD操作。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (8, 8, 'https://example.com/files/homework8.pdf', '开发一个微信小程序，实现商品展示和购买功能，包括购物车和订单管理。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (9, 9, 'https://example.com/files/homework9.pdf', '优化一个现有数据库的查询性能，包括索引设计、查询优化、执行计划分析。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');
INSERT INTO `t_homework` VALUES (10, 10, 'https://example.com/files/homework10.pdf', '使用Docker部署一个Web应用，包括编写Dockerfile、docker-compose配置、容器编排。', '2026-01-24 10:25:55', '2026-01-24 10:25:55');

-- ----------------------------
-- Table structure for t_homework_record
-- ----------------------------
DROP TABLE IF EXISTS `t_homework_record`;
CREATE TABLE `t_homework_record`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `member_id` bigint NOT NULL COMMENT '会员id',
                                      `lesson_id` bigint NOT NULL COMMENT '课程id',
                                      `url` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '作业提交内容的地址',
                                      `status` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                                      `sign_up_id` bigint NOT NULL COMMENT '报名id',
                                      `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '作业提交内容记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_homework_record
-- ----------------------------

-- ----------------------------
-- Table structure for t_hot_word
-- ----------------------------
DROP TABLE IF EXISTS `t_hot_word`;
CREATE TABLE `t_hot_word`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `name` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '热词',
                               `sort_order` bigint NOT NULL COMMENT '权重',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '热词' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_hot_word
-- ----------------------------
INSERT INTO `t_hot_word` VALUES (1, 'Java', 1, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (2, 'Python', 2, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (3, '前端开发', 3, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (4, '产品经理', 4, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (5, 'UI设计', 5, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (6, '数据分析', 6, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (7, '移动开发', 7, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (8, '微服务', 8, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (9, 'Docker', 9, '2026-01-24 10:25:37', '2026-01-24 10:25:37');
INSERT INTO `t_hot_word` VALUES (10, 'Spring Boot', 10, '2026-01-24 10:25:37', '2026-01-24 10:25:37');

-- ----------------------------
-- Table structure for t_job
-- ----------------------------
DROP TABLE IF EXISTS `t_job`;
CREATE TABLE `t_job`  (
                          `id` bigint NOT NULL COMMENT '主键id',
                          `short_name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '简称',
                          `full_name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '全称',
                          `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                          `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                          PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '职务表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_job
-- ----------------------------

-- ----------------------------
-- Table structure for t_learn_map
-- ----------------------------
DROP TABLE IF EXISTS `t_learn_map`;
CREATE TABLE `t_learn_map`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '封面图片（海报）',
                                `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                                `description` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                `company_id` bigint NULL DEFAULT NULL COMMENT '公司id',
                                `department_id` bigint NULL DEFAULT NULL COMMENT '部门id',
                                `create_user_id` bigint NULL DEFAULT NULL COMMENT '创建用户id',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '学习地图' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_learn_map
-- ----------------------------

-- ----------------------------
-- Table structure for t_learn_map_topic
-- ----------------------------
DROP TABLE IF EXISTS `t_learn_map_topic`;
CREATE TABLE `t_learn_map_topic`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `learn_map_id` bigint NOT NULL COMMENT '学习地图id',
                                      `topic_id` bigint NOT NULL COMMENT '专题id',
                                      `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '学习地图与专题的关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_learn_map_topic
-- ----------------------------

-- ----------------------------
-- Table structure for t_lecturer
-- ----------------------------
DROP TABLE IF EXISTS `t_lecturer`;
CREATE TABLE `t_lecturer`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `user_id` bigint NOT NULL COMMENT '用户id',
                               `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '头衔',
                               `introduction` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '讲师' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_lecturer
-- ----------------------------

-- ----------------------------
-- Table structure for t_lesson
-- ----------------------------
DROP TABLE IF EXISTS `t_lesson`;
CREATE TABLE `t_lesson`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                             `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '频道名称（最大长度64个字符，只支持中文、字母、数字和下划线）',
                             `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '编号',
                             `start_time` timestamp NOT NULL COMMENT '开始时间',
                             `end_time` timestamp NOT NULL COMMENT '结束时间',
                             `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '封面图片（海报）',
                             `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                             `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '短语介绍',
                             `introduction` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                             `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                             `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                             `company_id` bigint NULL DEFAULT NULL COMMENT '公司id',
                             `department_id` bigint NULL DEFAULT NULL COMMENT '部门id',
                             `create_user_id` bigint NULL DEFAULT NULL COMMENT '创建用户id',
                             `price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '价格',
                             `original_price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '原价',
                             `certificate_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'certificate_id',
                             `sort_weight` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'sort_weight',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '课程表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_lesson
-- ----------------------------

-- ----------------------------
-- Table structure for t_lesson_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_lesson_category_relation`;
CREATE TABLE `t_lesson_category_relation`  (
                                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                               `category_id` bigint NOT NULL COMMENT '目录id',
                                               `lesson_id` bigint NOT NULL COMMENT '频道id',
                                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '频道类目关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_lesson_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_lesson_chapter
-- ----------------------------
DROP TABLE IF EXISTS `t_lesson_chapter`;
CREATE TABLE `t_lesson_chapter`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `lesson_id` bigint NULL DEFAULT NULL COMMENT '课程id',
                                     `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章标题',
                                     `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                     `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '课程章表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_lesson_chapter
-- ----------------------------

-- ----------------------------
-- Table structure for t_lesson_chapter_section
-- ----------------------------
DROP TABLE IF EXISTS `t_lesson_chapter_section`;
CREATE TABLE `t_lesson_chapter_section`  (
                                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                             `lesson_chapter_id` bigint NULL DEFAULT NULL COMMENT '课程章id',
                                             `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '章节标题',
                                             `url` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '内容地址',
                                             `phrase` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '介绍',
                                             `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                             `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                             `total_time` bigint NOT NULL COMMENT '内容总时长',
                                             `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序',
                                             `type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '内容类型（上传、链接）',
                                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '课程章节表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_lesson_chapter_section
-- ----------------------------

-- ----------------------------
-- Table structure for t_like
-- ----------------------------
DROP TABLE IF EXISTS `t_like`;
CREATE TABLE `t_like`  (
                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                           `topic_id` bigint NOT NULL COMMENT '主题ID，如课程评论、知识评论的ID等',
                           `topic_type` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题类型，如课程评论、知识评论等',
                           `member_id` bigint NOT NULL COMMENT '用户id',
                           `status` tinyint NOT NULL DEFAULT 1 COMMENT '点赞状态,0=取消赞,1=有效赞',
                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '点赞' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_like
-- ----------------------------

-- ----------------------------
-- Table structure for t_manager
-- ----------------------------
DROP TABLE IF EXISTS `t_manager`;
CREATE TABLE `t_manager`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `user_id` bigint NOT NULL COMMENT '用户id',
                              `manager_id` bigint NOT NULL COMMENT '上级领导id',
                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '上级领导' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_manager
-- ----------------------------

-- ----------------------------
-- Table structure for t_member
-- ----------------------------
DROP TABLE IF EXISTS `t_member`;
CREATE TABLE `t_member`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                             `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '登陆账号',
                             `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '密码',
                             `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '员工编号',
                             `name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '姓名',
                             `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '状态',
                             `gender` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '性别',
                             `telephone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '办公电话',
                             `mobile` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '移动电话',
                             `email` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '电子邮件',
                             `birthday` date NULL DEFAULT NULL COMMENT '生日',
                             `avatar` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '头像',
                             `expire_time` timestamp NULL DEFAULT NULL COMMENT '过期时间',
                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                             `wechat_open_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'wechat_open_id',
                             `wechat_union_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'wechat_union_id',
                             `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '备注',
                             `company_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'company_id',
                             `realname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'realname',
                             `id_photo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'id_photo',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member
-- ----------------------------
INSERT INTO `t_member` VALUES (1, 'admin', '$2a$10$M7u5W4ZKuvN7DEY6gbxh.uiJTPQDL.Pxr.a2jbjx3ziiYGbnAi5tG', 'C0000001', '系统管理员', 'normal', '', '', 'admin', '', NULL, '', NULL, '2025-12-30 17:57:27', '2026-01-02 14:50:31', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `t_member` VALUES (2, '17601615961', '$2a$10$M7u5W4ZKuvN7DEY6gbxh.uiJTPQDL.Pxr.a2jbjx3ziiYGbnAi5tG', 'C0000002', '明鹰杰赁', 'normal', '', '', '17601615961', '', NULL, '', '2026-12-09 15:17:32', '2025-12-09 15:17:32', '2025-12-30 21:57:12', '1', '1', '1', '1', '1', '1');
INSERT INTO `t_member` VALUES (10, 'C0000010', 'qwe123..', 'C0000010', '鹅村擦', 'normal', '', '', '13144300079', '', NULL, '', '2027-01-28 11:22:49', '2026-01-28 11:22:48', '2026-01-28 11:22:48', NULL, NULL, NULL, NULL, NULL, NULL);

-- ----------------------------
-- Table structure for t_member_company
-- ----------------------------
DROP TABLE IF EXISTS `t_member_company`;
CREATE TABLE `t_member_company`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '公司名称',
                                     `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '' COMMENT '公司logo（图片URL）',
                                     `mobile` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '联系电话',
                                     `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '邮箱地址',
                                     `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT '状态：normal-正常, invalid-无效, deleted-已删除',
                                     `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序，数值越大越靠前',
                                     `company_type_id` bigint NULL DEFAULT NULL COMMENT '公司类型id（关联 t_member_company_type 表）',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE,
                                     INDEX `idx_company_type_id`(`company_type_id` ASC) USING BTREE,
                                     INDEX `idx_status`(`status` ASC) USING BTREE,
                                     INDEX `idx_sort_order`(`sort_order` ASC) USING BTREE,
                                     INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员公司表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_company
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_company_member_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_member_company_member_relation`;
CREATE TABLE `t_member_company_member_relation`  (
                                                     `id` int NOT NULL AUTO_INCREMENT,
                                                     `member_id` int NULL DEFAULT NULL,
                                                     `member_company_id` int NULL DEFAULT NULL,
                                                     `create_time` datetime NULL DEFAULT NULL,
                                                     `update_time` datetime NULL DEFAULT NULL,
                                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_company_member_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_company_type
-- ----------------------------
DROP TABLE IF EXISTS `t_member_company_type`;
CREATE TABLE `t_member_company_type`  (
                                          `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                          `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '公司类型名称',
                                          `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'enable' COMMENT '状态：enable-启用, disable-禁用',
                                          `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序，数值越大越靠前',
                                          `member_maximum` int NOT NULL DEFAULT 0 COMMENT '会员最大数量',
                                          `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                          `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                          PRIMARY KEY (`id`) USING BTREE,
                                          INDEX `idx_status`(`status` ASC) USING BTREE,
                                          INDEX `idx_sort_order`(`sort_order` ASC) USING BTREE,
                                          INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员公司类型表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_company_type
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_group
-- ----------------------------
DROP TABLE IF EXISTS `t_member_group`;
CREATE TABLE `t_member_group`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '分组名称',
                                   `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序，数值越大越靠前',
                                   `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'enable' COMMENT '状态：enable-启用, disable-禁用',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE,
                                   INDEX `idx_status`(`status` ASC) USING BTREE,
                                   INDEX `idx_sort_order`(`sort_order` ASC) USING BTREE,
                                   INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员分组表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_group
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_group_member_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_member_group_member_relation`;
CREATE TABLE `t_member_group_member_relation`  (
                                                   `id` int NOT NULL AUTO_INCREMENT,
                                                   `member_id` int NULL DEFAULT NULL,
                                                   `member_group_id` int NULL DEFAULT NULL,
                                                   `create_time` datetime NULL DEFAULT NULL,
                                                   `update_time` datetime NULL DEFAULT NULL,
                                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_group_member_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_level
-- ----------------------------
DROP TABLE IF EXISTS `t_member_level`;
CREATE TABLE `t_member_level`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                                   `description` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '描述',
                                   `conditions` bigint NOT NULL COMMENT '状态',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员等级' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_level
-- ----------------------------
INSERT INTO `t_member_level` VALUES (1, '1', '1', 1, '2025-12-30 21:22:31', '2025-12-30 21:22:31');
INSERT INTO `t_member_level` VALUES (2, '2', '2', 2, '2026-01-02 14:25:03', '2026-01-02 14:25:03');

-- ----------------------------
-- Table structure for t_member_level_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_member_level_relation`;
CREATE TABLE `t_member_level_relation`  (
                                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                            `member_id` bigint NOT NULL COMMENT '会员id',
                                            `level_id` bigint NOT NULL COMMENT '等级id',
                                            `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                            `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员等级' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_level_relation
-- ----------------------------
INSERT INTO `t_member_level_relation` VALUES (1, 2, 1, '2025-12-30 21:22:17', '2025-12-30 21:22:17');
INSERT INTO `t_member_level_relation` VALUES (2, 1, 2, '2026-01-02 14:25:15', '2026-01-02 14:25:15');

-- ----------------------------
-- Table structure for t_member_post
-- ----------------------------
DROP TABLE IF EXISTS `t_member_post`;
CREATE TABLE `t_member_post`  (
                                  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                  `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '岗位名称',
                                  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序，数值越大越靠前',
                                  `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'enable' COMMENT '状态：enable-启用, disable-禁用',
                                  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                  `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                  PRIMARY KEY (`id`) USING BTREE,
                                  INDEX `idx_status`(`status` ASC) USING BTREE,
                                  INDEX `idx_sort_order`(`sort_order` ASC) USING BTREE,
                                  INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员岗位表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_post
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_post_member_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_member_post_member_relation`;
CREATE TABLE `t_member_post_member_relation`  (
                                                  `id` int NOT NULL AUTO_INCREMENT,
                                                  `member_id` int NULL DEFAULT NULL,
                                                  `member_post_id` int NULL DEFAULT NULL,
                                                  `create_time` datetime NULL DEFAULT NULL,
                                                  `update_time` datetime NULL DEFAULT NULL,
                                                  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_post_member_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_tag
-- ----------------------------
DROP TABLE IF EXISTS `t_member_tag`;
CREATE TABLE `t_member_tag`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '标签名称',
                                 `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序，数值越大越靠前',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE,
                                 INDEX `idx_sort_order`(`sort_order` ASC) USING BTREE,
                                 INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '会员标签表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_tag
-- ----------------------------

-- ----------------------------
-- Table structure for t_member_tag_member_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_member_tag_member_relation`;
CREATE TABLE `t_member_tag_member_relation`  (
                                                 `id` int NOT NULL AUTO_INCREMENT,
                                                 `member_id` int NULL DEFAULT NULL,
                                                 `member_tag_id` int NULL DEFAULT NULL,
                                                 `create_time` datetime NULL DEFAULT NULL,
                                                 `update_time` datetime NULL DEFAULT NULL,
                                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_member_tag_member_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_news
-- ----------------------------
DROP TABLE IF EXISTS `t_news`;
CREATE TABLE `t_news`  (
                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                           `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                           `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型',
                           `user_id` bigint NOT NULL COMMENT '用户id',
                           `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容',
                           `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '海报图片',
                           `tags` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '标签',
                           `keywords` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '关键字',
                           `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态',
                           `recommend` tinyint NOT NULL DEFAULT 0 COMMENT '推荐',
                           `top` tinyint NOT NULL DEFAULT 0 COMMENT '置顶',
                           `description` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '简介',
                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '新闻' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_news
-- ----------------------------

-- ----------------------------
-- Table structure for t_notice
-- ----------------------------
DROP TABLE IF EXISTS `t_notice`;
CREATE TABLE `t_notice`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                             `topic_id` bigint NOT NULL COMMENT '主题id',
                             `topic_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主题类型',
                             `to_member_id` bigint NOT NULL COMMENT '主题会员',
                             `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '状态',
                             `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型',
                             `browsed` tinyint NOT NULL DEFAULT 0 COMMENT '是否已读',
                             `member_id` bigint NOT NULL COMMENT '会员',
                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '通知' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_notice
-- ----------------------------

-- ----------------------------
-- Table structure for t_order
-- ----------------------------
DROP TABLE IF EXISTS `t_order`;
CREATE TABLE `t_order`  (
                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                            `no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '订单号',
                            `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                            `remark` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '用户备注',
                            `freight_amount` decimal(14, 2) NOT NULL DEFAULT 0.00 COMMENT '邮费金额',
                            `item_amount` decimal(14, 2) NOT NULL COMMENT '商品金额',
                            `payment_amount` decimal(14, 2) NOT NULL COMMENT '付款金额',
                            `user_id` bigint NOT NULL COMMENT '用户id',
                            `department_id` bigint NOT NULL COMMENT '部门id',
                            `company_id` bigint NOT NULL COMMENT '公司id',
                            `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '订单' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_order
-- ----------------------------

-- ----------------------------
-- Table structure for t_order_item
-- ----------------------------
DROP TABLE IF EXISTS `t_order_item`;
CREATE TABLE `t_order_item`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `order_id` bigint NOT NULL COMMENT '订单id',
                                 `item_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '商品id',
                                 `title` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                                 `image` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '图片',
                                 `original_price` decimal(14, 2) NOT NULL COMMENT '原价',
                                 `price` decimal(14, 2) NOT NULL COMMENT '价格',
                                 `quantity` int NOT NULL COMMENT '数量',
                                 `payment_amount` decimal(14, 2) NOT NULL COMMENT '付款金额',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '订单商品' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_order_item
-- ----------------------------

-- ----------------------------
-- Table structure for t_order_payment
-- ----------------------------
DROP TABLE IF EXISTS `t_order_payment`;
CREATE TABLE `t_order_payment`  (
                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                    `order_id` bigint NOT NULL COMMENT '订单id',
                                    `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                                    `channel` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '渠道',
                                    `amount` decimal(14, 2) NOT NULL COMMENT '金额',
                                    `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '订单支付' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_order_payment
-- ----------------------------

-- ----------------------------
-- Table structure for t_paper
-- ----------------------------
DROP TABLE IF EXISTS `t_paper`;
CREATE TABLE `t_paper`  (
                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                            `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                            `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT '编号',
                            `description` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                            `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型',
                            `score` double NOT NULL COMMENT '试卷总分',
                            `limit_time` bigint NOT NULL COMMENT '考试时长',
                            `pass_score` double NOT NULL COMMENT '合格分数',
                            `question_disordered` tinyint NOT NULL DEFAULT 0 COMMENT '题序打乱',
                            `option_disordered` tinyint NOT NULL DEFAULT 0 COMMENT '选项打乱',
                            `difficulty` int NOT NULL DEFAULT 0 COMMENT '难度',
                            `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                            `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '试卷' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_paper
-- ----------------------------

-- ----------------------------
-- Table structure for t_paper_category
-- ----------------------------
DROP TABLE IF EXISTS `t_paper_category`;
CREATE TABLE `t_paper_category`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '分类名称',
                                     `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                     `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                     `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                     `level` int NOT NULL COMMENT '目录等级',
                                     `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分类图片',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '试卷分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_paper_category
-- ----------------------------

-- ----------------------------
-- Table structure for t_paper_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_paper_category_relation`;
CREATE TABLE `t_paper_category_relation`  (
                                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                              `child_category_id` bigint NOT NULL COMMENT '子分类id',
                                              `father_category_id` bigint NOT NULL COMMENT '父分类id',
                                              `direct_father_category_id` bigint NOT NULL COMMENT '直属父分类id',
                                              `is_sub` tinyint NOT NULL COMMENT '是否属于子分类',
                                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '试卷分类与试卷分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_paper_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_paper_paper_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_paper_paper_category_relation`;
CREATE TABLE `t_paper_paper_category_relation`  (
                                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                    `category_id` bigint NOT NULL COMMENT '目录id',
                                                    `paper_id` bigint NOT NULL COMMENT '试卷id',
                                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '试卷与试卷分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_paper_paper_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_paper_question
-- ----------------------------
DROP TABLE IF EXISTS `t_paper_question`;
CREATE TABLE `t_paper_question`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `question_id` bigint NOT NULL COMMENT '题目id',
                                     `paper_id` bigint NOT NULL COMMENT '试卷id',
                                     `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '试卷题目' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_paper_question
-- ----------------------------

-- ----------------------------
-- Table structure for t_paper_question_rule
-- ----------------------------
DROP TABLE IF EXISTS `t_paper_question_rule`;
CREATE TABLE `t_paper_question_rule`  (
                                          `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                          `paper_id` bigint NOT NULL COMMENT '试卷id',
                                          `rule_json` json NOT NULL COMMENT '抽题规则',
                                          `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                          `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                          PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '试卷题目抽题规则' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_paper_question_rule
-- ----------------------------

-- ----------------------------
-- Table structure for t_point
-- ----------------------------
DROP TABLE IF EXISTS `t_point`;
CREATE TABLE `t_point`  (
                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                            `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '名称',
                            `start_date` timestamp NOT NULL COMMENT '有效期开始时间',
                            `end_date` timestamp NOT NULL COMMENT '有效期结束时间',
                            `redemption_ratio` bigint NOT NULL COMMENT '兑换比例，1元=100积分，填写100',
                            `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                            `user_id` bigint NOT NULL COMMENT '用户id',
                            `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '积分' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_point
-- ----------------------------

-- ----------------------------
-- Table structure for t_point_channel_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_point_channel_relation`;
CREATE TABLE `t_point_channel_relation`  (
                                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                             `point_id` bigint NOT NULL COMMENT '积分id',
                                             `channel_id` bigint NOT NULL COMMENT '积分渠道id',
                                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '积分与积分渠道的关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_point_channel_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_post
-- ----------------------------
DROP TABLE IF EXISTS `t_post`;
CREATE TABLE `t_post`  (
                           `id` bigint NOT NULL COMMENT '主键id',
                           `short_name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '简称',
                           `full_name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '全称',
                           `remark` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT '' COMMENT '备注',
                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '岗位表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_post
-- ----------------------------

-- ----------------------------
-- Table structure for t_private_letter
-- ----------------------------
DROP TABLE IF EXISTS `t_private_letter`;
CREATE TABLE `t_private_letter`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `sender_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '发送者id',
                                     `receiver_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '接受者id',
                                     `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '内容',
                                     `read_time` timestamp NULL DEFAULT NULL COMMENT '读信息时间',
                                     `is_read` tinyint NOT NULL DEFAULT 0 COMMENT '是否已读',
                                     `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '私信' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_private_letter
-- ----------------------------

-- ----------------------------
-- Table structure for t_question
-- ----------------------------
DROP TABLE IF EXISTS `t_question`;
CREATE TABLE `t_question`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '题干',
                               `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题干描述',
                               `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型：single_choice-单选题, multi_choice-多选题, judgment-判断题, fill_blank-填空题, subjective-简答题',
                               `difficulty` int NOT NULL DEFAULT 1 COMMENT '难度：1-简单, 2-中等, 3-困难',
                               `score` decimal(14, 2) NOT NULL DEFAULT 1.00 COMMENT '分数',
                               `reference_answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '参考答案',
                               `reference_answer_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '答案解析',
                               `options` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '选项（JSON格式）',
                               `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态：draft-草稿, published-已发布, deleted-已删除',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               `member_id` bigint NOT NULL COMMENT '会员id',
                               `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '问题内容',
                               `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题图（图片URL）',
                               PRIMARY KEY (`id`) USING BTREE,
                               INDEX `idx_type`(`type` ASC) USING BTREE,
                               INDEX `idx_difficulty`(`difficulty` ASC) USING BTREE,
                               INDEX `idx_status`(`status` ASC) USING BTREE,
                               INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '题目表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_question
-- ----------------------------
INSERT INTO `t_question` VALUES (1, 'Java中HashMap和Hashtable的区别是什么？', '请详细说明HashMap和Hashtable的主要区别', 'subjective', 2, 5.00, 'HashMap是非线程安全的，Hashtable是线程安全的；HashMap允许null键和值，Hashtable不允许；HashMap的迭代器是fail-fast的', 'HashMap和Hashtable都是Map接口的实现类，但HashMap是线程不安全的，性能更好；Hashtable是线程安全的，但性能较差。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 101, '我在学习Java集合框架时遇到了HashMap和Hashtable，想了解它们之间的区别，特别是在线程安全性和性能方面的差异。', 'https://example.com/images/question1.jpg');
INSERT INTO `t_question` VALUES (2, 'Vue 3中Composition API的优势是什么？', '对比Options API，说明Composition API的优势', 'subjective', 2, 5.00, '更好的逻辑复用、更好的类型推断、更灵活的组织方式', 'Composition API提供了更好的代码组织和复用能力，特别适合大型项目。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 102, '最近在学习Vue 3，想了解Composition API相比Options API有哪些优势，在实际项目中应该如何选择？', 'https://example.com/images/question2.jpg');
INSERT INTO `t_question` VALUES (3, '如何设计一个高并发的秒杀系统？', '请分享秒杀系统的设计思路和关键技术点', 'subjective', 3, 10.00, '限流、缓存、异步处理、数据库优化、分布式锁', '秒杀系统需要考虑高并发、数据一致性、系统稳定性等多个方面。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 103, '公司要做一个秒杀活动，想了解如何设计一个能够承受高并发的秒杀系统，有哪些关键技术点需要注意？', 'https://example.com/images/question3.jpg');
INSERT INTO `t_question` VALUES (4, 'Python中如何实现单例模式？', '请提供Python实现单例模式的几种方法', 'subjective', 2, 5.00, '使用__new__方法、使用装饰器、使用元类', 'Python有多种方式实现单例模式，各有优缺点。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 104, '在Python项目中需要实现单例模式，想了解有哪些实现方式，哪种方式最推荐？', 'https://example.com/images/question4.jpg');
INSERT INTO `t_question` VALUES (5, 'React Hooks的使用场景和注意事项？', '请说明React Hooks的适用场景和使用时需要注意的问题', 'subjective', 2, 5.00, '状态管理、副作用处理、性能优化', 'Hooks让函数组件也能使用状态和生命周期，但需要注意依赖项和性能问题。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 105, '刚开始使用React Hooks，想了解在什么场景下使用Hooks，使用时有哪些需要注意的地方？', 'https://example.com/images/question5.jpg');
INSERT INTO `t_question` VALUES (6, 'MySQL索引优化有哪些技巧？', '请分享MySQL索引优化的实用技巧', 'subjective', 2, 5.00, '选择合适的索引类型、避免过多索引、使用覆盖索引、定期分析索引使用情况', '索引优化是数据库性能优化的关键，需要根据实际查询场景来设计。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 106, '数据库查询性能较慢，想了解如何通过索引优化来提升查询速度，有哪些实用的技巧？', 'https://example.com/images/question6.jpg');
INSERT INTO `t_question` VALUES (7, '微服务架构中如何保证数据一致性？', '请说明微服务架构下保证数据一致性的方案', 'subjective', 3, 10.00, '分布式事务、最终一致性、事件驱动、Saga模式', '微服务架构下数据一致性是一个挑战，需要根据业务场景选择合适的方案。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 107, '在微服务架构中，不同服务之间的数据一致性如何保证？有哪些成熟的解决方案？', 'https://example.com/images/question7.jpg');
INSERT INTO `t_question` VALUES (8, 'Docker容器网络如何配置？', '请说明Docker容器网络的配置方式', 'subjective', 2, 5.00, 'bridge网络、host网络、overlay网络、自定义网络', 'Docker提供了多种网络模式，需要根据实际需求选择合适的网络配置。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 108, '在使用Docker部署应用时，想了解如何配置容器网络，不同网络模式有什么区别？', 'https://example.com/images/question8.jpg');
INSERT INTO `t_question` VALUES (9, '前端性能优化的最佳实践？', '请分享前端性能优化的方法和技巧', 'subjective', 2, 5.00, '代码分割、懒加载、缓存策略、资源压缩、CDN加速', '前端性能优化需要从多个维度入手，包括代码、资源、网络等方面。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 109, '网站加载速度较慢，想了解前端性能优化的最佳实践，有哪些立竿见影的优化方法？', 'https://example.com/images/question9.jpg');
INSERT INTO `t_question` VALUES (10, '如何设计RESTful API？', '请说明RESTful API的设计原则和最佳实践', 'subjective', 2, 5.00, '资源导向、HTTP方法语义化、状态码规范、版本控制', 'RESTful API设计需要遵循REST原则，保证API的易用性和可维护性。', '[]', 'published', '2026-01-24 10:25:55', '2026-01-24 10:25:55', 110, '需要设计一套RESTful API，想了解设计原则和最佳实践，如何保证API的规范性？', 'https://example.com/images/question10.jpg');

-- ----------------------------
-- Table structure for t_question_and_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_question_and_category_relation`;
CREATE TABLE `t_question_and_category_relation`  (
                                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                     `category_id` bigint NOT NULL COMMENT '目录id',
                                                     `question_id` bigint NOT NULL COMMENT '题目id',
                                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '题目与题目分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_question_and_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_question_category
-- ----------------------------
DROP TABLE IF EXISTS `t_question_category`;
CREATE TABLE `t_question_category`  (
                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                        `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '分类名称',
                                        `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级分类的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                        `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示：1-显示, 0-不显示',
                                        `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示：1-显示, 0-不显示',
                                        `level` int NOT NULL COMMENT '目录等级',
                                        `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类图片',
                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                        PRIMARY KEY (`id`) USING BTREE,
                                        INDEX `idx_sort_order`(`sort_order` ASC) USING BTREE,
                                        INDEX `idx_level`(`level` ASC) USING BTREE,
                                        INDEX `idx_is_show`(`is_show` ASC) USING BTREE,
                                        INDEX `idx_is_show_index`(`is_show_index` ASC) USING BTREE,
                                        INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '题目分类表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_question_category
-- ----------------------------

-- ----------------------------
-- Table structure for t_question_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_question_category_relation`;
CREATE TABLE `t_question_category_relation`  (
                                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                 `child_category_id` bigint NOT NULL COMMENT '子分类id',
                                                 `father_category_id` bigint NOT NULL COMMENT '父分类id',
                                                 `direct_father_category_id` bigint NOT NULL COMMENT '直属父分类id',
                                                 `is_sub` tinyint NOT NULL COMMENT '是否属于子分类：1-是, 0-否',
                                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                 `question_id` bigint NOT NULL COMMENT '问题id',
                                                 PRIMARY KEY (`id`) USING BTREE,
                                                 INDEX `idx_child_category_id`(`child_category_id` ASC) USING BTREE,
                                                 INDEX `idx_father_category_id`(`father_category_id` ASC) USING BTREE,
                                                 INDEX `idx_direct_father_category_id`(`direct_father_category_id` ASC) USING BTREE,
                                                 INDEX `idx_is_sub`(`is_sub` ASC) USING BTREE,
                                                 INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '题目分类关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_question_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_record
-- ----------------------------
DROP TABLE IF EXISTS `t_record`;
CREATE TABLE `t_record`  (
                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                             `word` varchar(4000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '搜索内容',
                             `member_id` bigint NOT NULL DEFAULT 0 COMMENT '用户id',
                             `ip_addr` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'ip地址',
                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                             `max_progress_time` bigint NULL DEFAULT NULL COMMENT '最大的学习进度时间',
                             `status` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'progressing' COMMENT '状态',
                             `point_num` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '积分数量/点数',
                             `exam_chapter_section_id` int NULL DEFAULT NULL COMMENT '考试章节小节ID',
                             `learn_time` datetime NULL DEFAULT NULL COMMENT '学习时间',
                             `point_id` int NULL DEFAULT NULL COMMENT '积分ID/点位ID',
                             `channel_id` int NULL DEFAULT NULL COMMENT '渠道ID',
                             `type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '记录类型',
                             `mobile` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '手机号',
                             `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
                             `topic_id` int NULL DEFAULT NULL COMMENT '题目ID/话题ID',
                             `topic_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '题目类型/话题类型',
                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '搜索记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_record
-- ----------------------------

-- ----------------------------
-- Table structure for t_record_bak
-- ----------------------------
DROP TABLE IF EXISTS `t_record_bak`;
CREATE TABLE `t_record_bak`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `word` varchar(4000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '搜索内容',
                                 `member_id` bigint NOT NULL DEFAULT 0 COMMENT '用户id',
                                 `ip_addr` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'ip地址',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 `max_progress_time` bigint NULL DEFAULT NULL COMMENT '最大的学习进度时间',
                                 `status` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'progressing' COMMENT '状态',
                                 `point_num` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'point_num',
                                 `exam_chapter_section_id` int NULL DEFAULT NULL,
                                 `learn_time` datetime NULL DEFAULT NULL,
                                 `point_id` int NULL DEFAULT NULL,
                                 `channel_id` int NULL DEFAULT NULL,
                                 `type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                 `mobile` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                 `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                 `topic_id` int NULL DEFAULT NULL,
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '搜索记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_record_bak
-- ----------------------------
INSERT INTO `t_record_bak` VALUES (1, 'a', 2, '218.27.70.48', '2026-01-02 15:20:35', '2026-01-02 15:20:35', NULL, 'progressing', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `t_record_bak` VALUES (2, 'a', 2, '218.27.70.48', '2026-01-02 15:20:43', '2026-01-02 15:20:43', NULL, 'progressing', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- ----------------------------
-- Table structure for t_record_log
-- ----------------------------
DROP TABLE IF EXISTS `t_record_log`;
CREATE TABLE `t_record_log`  (
                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                 `member_id` bigint NOT NULL COMMENT '会员id',
                                 `lesson_id` bigint NOT NULL COMMENT '课程id',
                                 `lesson_chapter_section_id` bigint NOT NULL COMMENT '章节id',
                                 `sign_up_id` bigint NOT NULL COMMENT '报名id',
                                 `learn_time` bigint NOT NULL COMMENT '学习时长',
                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '学习记录日志' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_record_log
-- ----------------------------

-- ----------------------------
-- Table structure for t_reply_comment
-- ----------------------------
DROP TABLE IF EXISTS `t_reply_comment`;
CREATE TABLE `t_reply_comment`  (
                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                    `comment_id` bigint NOT NULL COMMENT '评论id',
                                    `reply_comment_id` bigint NOT NULL COMMENT '回复评论id，也就是父ID，回复评论表的评论是，值跟评论id相等',
                                    `content` varchar(4000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '回复内容',
                                    `member_id` bigint NOT NULL COMMENT '当前评论的用户ID',
                                    `to_member_id` bigint NOT NULL COMMENT '回复的评论的用户id',
                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '回复表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_reply_comment
-- ----------------------------

-- ----------------------------
-- Table structure for t_resource
-- ----------------------------
DROP TABLE IF EXISTS `t_resource`;
CREATE TABLE `t_resource`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                               `member_id` bigint NOT NULL COMMENT '用户id',
                               `introduction` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '内容',
                               `image` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '海报图片',
                               `url` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '标签',
                               `status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                               `type` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '资源' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_resource
-- ----------------------------

-- ----------------------------
-- Table structure for t_resource_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_resource_category_relation`;
CREATE TABLE `t_resource_category_relation`  (
                                                 `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                 `category_id` bigint NOT NULL COMMENT '目录id',
                                                 `resource_id` bigint NOT NULL COMMENT '资源id',
                                                 `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                 `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                 PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '资源类目关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_resource_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_resource_download
-- ----------------------------
DROP TABLE IF EXISTS `t_resource_download`;
CREATE TABLE `t_resource_download`  (
                                        `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                        `member_id` bigint NOT NULL COMMENT '会员id',
                                        `resource_id` bigint NOT NULL COMMENT '资源id',
                                        `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                        PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '会员下载记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_resource_download
-- ----------------------------

-- ----------------------------
-- Table structure for t_resource_product
-- ----------------------------
DROP TABLE IF EXISTS `t_resource_product`;
CREATE TABLE `t_resource_product`  (
                                       `id` int NOT NULL AUTO_INCREMENT,
                                       `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                       `status` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                       `image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                       `create_time` datetime NULL DEFAULT NULL,
                                       `update_time` datetime NULL DEFAULT NULL,
                                       PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_resource_product
-- ----------------------------

-- ----------------------------
-- Table structure for t_resource_search_record
-- ----------------------------
DROP TABLE IF EXISTS `t_resource_search_record`;
CREATE TABLE `t_resource_search_record`  (
                                             `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                             `member_id` bigint NOT NULL COMMENT '会员id',
                                             `search_condition` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '搜索条件',
                                             `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                             `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                             PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '会员搜索记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_resource_search_record
-- ----------------------------
INSERT INTO `t_resource_search_record` VALUES (1, 2, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":2,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 15:35:42', '2026-01-02 15:35:42');
INSERT INTO `t_resource_search_record` VALUES (2, 2, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":2,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 15:36:03', '2026-01-02 15:36:03');
INSERT INTO `t_resource_search_record` VALUES (3, 2, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":2,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 15:37:24', '2026-01-02 15:37:24');
INSERT INTO `t_resource_search_record` VALUES (4, 2, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":2,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 15:38:40', '2026-01-02 15:38:40');
INSERT INTO `t_resource_search_record` VALUES (5, 2, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":2,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 15:38:56', '2026-01-02 15:38:56');
INSERT INTO `t_resource_search_record` VALUES (6, 1, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":1,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 18:06:45', '2026-01-02 18:06:45');
INSERT INTO `t_resource_search_record` VALUES (7, 1, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":1,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 18:13:10', '2026-01-02 18:13:10');
INSERT INTO `t_resource_search_record` VALUES (8, 1, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":1,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-02 18:16:24', '2026-01-02 18:16:24');
INSERT INTO `t_resource_search_record` VALUES (9, 1, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":1,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-20 21:17:56', '2026-01-20 21:17:56');
INSERT INTO `t_resource_search_record` VALUES (10, 1, '{\"cid\":0,\"current\":1,\"keyword\":\"\",\"mId\":1,\"orders\":[\"create_time desc\"],\"saveSearchConditionFlag\":true,\"size\":20,\"status\":\"published\"}', '2026-01-22 10:02:45', '2026-01-22 10:02:45');

-- ----------------------------
-- Table structure for t_resource_tag
-- ----------------------------
DROP TABLE IF EXISTS `t_resource_tag`;
CREATE TABLE `t_resource_tag`  (
                                   `id` int NOT NULL AUTO_INCREMENT,
                                   `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                   `status` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
                                   `create_time` datetime NULL DEFAULT NULL,
                                   `update_time` datetime NULL DEFAULT NULL,
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_resource_tag
-- ----------------------------

-- ----------------------------
-- Table structure for t_role
-- ----------------------------
DROP TABLE IF EXISTS `t_role`;
CREATE TABLE `t_role`  (
                           `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                           `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '编号',
                           `name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '角色名',
                           `remark` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT '' COMMENT '备注',
                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '角色表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_role
-- ----------------------------
INSERT INTO `t_role` VALUES (1, 'super_admin', '超级管理员', '超级管理员', '2025-12-08 11:20:30', '2025-12-08 11:20:30');
INSERT INTO `t_role` VALUES (2, '0', '智汇AI教育', '智汇AI教育官方', '2026-01-02 18:18:36', '2026-01-02 18:18:36');

-- ----------------------------
-- Table structure for t_role_authority
-- ----------------------------
DROP TABLE IF EXISTS `t_role_authority`;
CREATE TABLE `t_role_authority`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `role_id` bigint NOT NULL COMMENT '角色id',
                                     `authority_id` bigint NOT NULL COMMENT '权限id',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 24 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '角色权限表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_role_authority
-- ----------------------------
INSERT INTO `t_role_authority` VALUES (1, 1, 5, '2026-01-20 18:40:41', '2026-01-20 18:40:41');
INSERT INTO `t_role_authority` VALUES (2, 2, 6, '2026-01-20 18:59:07', '2026-01-20 19:27:17');
INSERT INTO `t_role_authority` VALUES (3, 1, 7, '2026-01-20 19:05:16', '2026-01-20 19:05:16');
INSERT INTO `t_role_authority` VALUES (6, 1, 1, '2026-01-02 18:12:42', '2026-01-02 18:12:42');
INSERT INTO `t_role_authority` VALUES (7, 1, 2, '2026-01-02 18:12:42', '2026-01-02 18:12:42');
INSERT INTO `t_role_authority` VALUES (8, 1, 21, '2026-01-02 18:12:42', '2026-01-02 18:12:42');
INSERT INTO `t_role_authority` VALUES (9, 1, 3, '2026-01-02 18:12:42', '2026-01-02 18:12:42');
INSERT INTO `t_role_authority` VALUES (10, 1, 4, '2026-01-02 18:12:42', '2026-01-02 18:12:42');
INSERT INTO `t_role_authority` VALUES (11, 1, 8, '2026-01-20 19:20:45', '2026-01-20 19:20:45');
INSERT INTO `t_role_authority` VALUES (12, 1, 9, '2026-01-20 19:20:49', '2026-01-20 19:20:49');
INSERT INTO `t_role_authority` VALUES (13, 1, 22, '2026-01-20 20:12:54', '2026-01-20 20:12:54');
INSERT INTO `t_role_authority` VALUES (14, 1, 23, '2026-01-20 20:12:57', '2026-01-20 20:12:57');
INSERT INTO `t_role_authority` VALUES (15, 1, 24, '2026-01-20 20:13:04', '2026-01-20 20:13:04');
INSERT INTO `t_role_authority` VALUES (16, 1, 25, '2026-01-20 20:13:08', '2026-01-20 20:13:08');
INSERT INTO `t_role_authority` VALUES (17, 1, 26, '2026-01-20 20:13:11', '2026-01-20 20:13:11');
INSERT INTO `t_role_authority` VALUES (18, 1, 27, '2026-01-20 20:13:14', '2026-01-20 20:13:14');
INSERT INTO `t_role_authority` VALUES (19, 1, 28, '2026-01-20 20:33:01', '2026-01-20 20:33:01');
INSERT INTO `t_role_authority` VALUES (20, 1, 29, '2026-01-20 20:33:04', '2026-01-20 20:33:04');
INSERT INTO `t_role_authority` VALUES (21, 1, 30, '2026-01-20 20:57:10', '2026-01-20 20:57:10');
INSERT INTO `t_role_authority` VALUES (22, 1, 31, '2026-01-20 20:57:13', '2026-01-20 20:57:13');
INSERT INTO `t_role_authority` VALUES (23, 1, 32, '2026-01-20 20:57:16', '2026-01-20 20:57:16');

-- ----------------------------
-- Table structure for t_sensitive_word
-- ----------------------------
DROP TABLE IF EXISTS `t_sensitive_word`;
CREATE TABLE `t_sensitive_word`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `name` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '敏感词',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '敏感词库' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_sensitive_word
-- ----------------------------

-- ----------------------------
-- Table structure for t_sign_up
-- ----------------------------
DROP TABLE IF EXISTS `t_sign_up`;
CREATE TABLE `t_sign_up`  (
                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                              `member_id` bigint NOT NULL COMMENT '会员id',
                              `lesson_id` bigint NOT NULL COMMENT '课程id',
                              `company_id` bigint NULL DEFAULT NULL COMMENT '公司id',
                              `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态：signed_up-已报名, completed-已完成, cancel_sign_up-已取消报名',
                              `progress` decimal(10, 2) NULL DEFAULT 0.00 COMMENT '报名的学习进度（0-100）',
                              `completed_time` timestamp NULL DEFAULT NULL COMMENT '完成时间',
                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                              PRIMARY KEY (`id`) USING BTREE,
                              INDEX `idx_member_id`(`member_id` ASC) USING BTREE,
                              INDEX `idx_lesson_id`(`lesson_id` ASC) USING BTREE,
                              INDEX `idx_company_id`(`company_id` ASC) USING BTREE,
                              INDEX `idx_status`(`status` ASC) USING BTREE,
                              INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '报名表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_sign_up
-- ----------------------------

-- ----------------------------
-- Table structure for t_subscribe
-- ----------------------------
DROP TABLE IF EXISTS `t_subscribe`;
CREATE TABLE `t_subscribe`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `member_id` bigint NOT NULL COMMENT '会员id',
                                `channel_id` bigint NOT NULL COMMENT '频道id',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '频道订阅' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_subscribe
-- ----------------------------

-- ----------------------------
-- Table structure for t_system_notice
-- ----------------------------
DROP TABLE IF EXISTS `t_system_notice`;
CREATE TABLE `t_system_notice`  (
                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                    `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知内容',
                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统通知' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_system_notice
-- ----------------------------

-- ----------------------------
-- Table structure for t_template
-- ----------------------------
DROP TABLE IF EXISTS `t_template`;
CREATE TABLE `t_template`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型',
                               `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知内容',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '通知模板' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_template
-- ----------------------------
INSERT INTO `t_template` VALUES (1, 'sign_up', '亲爱的会员，您成功报名课程「标题」。我们一起愉快学习吧~', '2025-12-10 19:33:54', '2025-12-10 19:33:54');
INSERT INTO `t_template` VALUES (2, 'register_user', '注册账号成功，欢迎加入大家庭~', '2025-12-10 19:33:54', '2025-12-10 19:33:54');

-- ----------------------------
-- Table structure for t_tencent_cloud_live_stream
-- ----------------------------
DROP TABLE IF EXISTS `t_tencent_cloud_live_stream`;
CREATE TABLE `t_tencent_cloud_live_stream`  (
                                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                `channel_id` bigint NOT NULL COMMENT '频道id',
                                                `stream_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '流名称',
                                                `app_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'live' COMMENT '应用名称',
                                                `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '腾讯云直播流信息' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_tencent_cloud_live_stream
-- ----------------------------

-- ----------------------------
-- Table structure for t_topic
-- ----------------------------
DROP TABLE IF EXISTS `t_topic`;
CREATE TABLE `t_topic`  (
                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                            `title` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
                            `image` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '封面图片（海报）',
                            `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                            `description` varchar(3000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '详情',
                            `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                            `company_id` bigint NULL DEFAULT NULL COMMENT '公司id',
                            `department_id` bigint NULL DEFAULT NULL COMMENT '部门id',
                            `create_user_id` bigint NULL DEFAULT NULL COMMENT '创建用户id',
                            `price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '价格',
                            `original_price` decimal(14, 2) NULL DEFAULT 0.00 COMMENT '原价',
                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '专题' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_topic
-- ----------------------------

-- ----------------------------
-- Table structure for t_topic_category
-- ----------------------------
DROP TABLE IF EXISTS `t_topic_category`;
CREATE TABLE `t_topic_category`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `name` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '类目名称',
                                     `sort_order` int NOT NULL DEFAULT 1 COMMENT '排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数',
                                     `is_show` tinyint NOT NULL DEFAULT 1 COMMENT '是否显示',
                                     `is_show_index` tinyint NOT NULL DEFAULT 1 COMMENT '是否在首页显示',
                                     `level` int NOT NULL COMMENT '目录等级',
                                     `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分类图片',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     `company_id` bigint NOT NULL DEFAULT 0 COMMENT '公司id',
                                     `department_id` bigint NOT NULL DEFAULT 0 COMMENT '部门id',
                                     `create_user_id` bigint NOT NULL DEFAULT 0 COMMENT '创建用户id',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '专题分类' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_topic_category
-- ----------------------------

-- ----------------------------
-- Table structure for t_topic_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_topic_category_relation`;
CREATE TABLE `t_topic_category_relation`  (
                                              `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                              `child_category_id` bigint NOT NULL COMMENT '子类目id',
                                              `father_category_id` bigint NOT NULL COMMENT '父类目id',
                                              `direct_father_category_id` bigint NOT NULL COMMENT '直属父类目id',
                                              `is_sub` tinyint NOT NULL COMMENT '是否属于子类目',
                                              `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                              `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                              PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '专题分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_topic_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_topic_lesson
-- ----------------------------
DROP TABLE IF EXISTS `t_topic_lesson`;
CREATE TABLE `t_topic_lesson`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `lesson_id` bigint NOT NULL COMMENT '课程id',
                                   `topic_id` bigint NOT NULL COMMENT '专题id',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '专题与课程关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_topic_lesson
-- ----------------------------

-- ----------------------------
-- Table structure for t_topic_topic_category_relation
-- ----------------------------
DROP TABLE IF EXISTS `t_topic_topic_category_relation`;
CREATE TABLE `t_topic_topic_category_relation`  (
                                                    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                                    `category_id` bigint NOT NULL COMMENT '目录id',
                                                    `topic_id` bigint NOT NULL COMMENT '专题id',
                                                    `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                                    `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                                    PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '专题与分类关系' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_topic_topic_category_relation
-- ----------------------------

-- ----------------------------
-- Table structure for t_user
-- ----------------------------
DROP TABLE IF EXISTS `t_user`;
CREATE TABLE `t_user`  (
                           `id` bigint NOT NULL DEFAULT 0 AUTO_INCREMENT COMMENT '主键id',
                           `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '登陆账号',
                           `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '密码',
                           `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '员工编号',
                           `name` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '姓名',
                           `status` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '状态',
                           `gender` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '性别',
                           `telephone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '办公电话',
                           `mobile` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '移动电话',
                           `email` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '电子邮件',
                           `birthday` date NULL DEFAULT NULL COMMENT '生日',
                           `id_card` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '身份证',
                           `nation` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '民族',
                           `native_place` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '籍贯',
                           `id_card_address` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '户口地址',
                           `current_address` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '居住地',
                           `marital_status` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '婚姻状况',
                           `contract_start_date` date NULL DEFAULT NULL COMMENT '合同开始日期',
                           `contract_end_date` date NULL DEFAULT NULL COMMENT '合同结束日期',
                           `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                           `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                           PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_user
-- ----------------------------
INSERT INTO `t_user` VALUES (1, 'admin', '$2a$10$iivrCkHsTs.ABHlocVAdqeS6YJMfrUzHoMdEC5735faZ4lS0S3Zyq', '', '系统管理员', 'official', '', '', '18643389808', '502319984@qq.com', NULL, '', '', '', '', '', '', NULL, NULL, '2025-12-30 17:57:27', '2026-01-27 09:10:47');
INSERT INTO `t_user` VALUES (10, '', '$2a$10$gGxONUnIAOQ6M6mfCyoZ8.QCzsd77c1w3UkqeXJCRZ3o19Lc28rvC', 'C0064084', '', 'official', '', '', '13144300079', '', NULL, '', '', '', '', '', '', NULL, NULL, '2026-01-28 11:22:48', '2026-01-28 11:22:48');

-- ----------------------------
-- Table structure for t_user_department
-- ----------------------------
DROP TABLE IF EXISTS `t_user_department`;
CREATE TABLE `t_user_department`  (
                                      `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                      `user_id` bigint NOT NULL COMMENT '用户id',
                                      `department_id` bigint NOT NULL COMMENT '部门id',
                                      `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                      PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户与部门关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_user_department
-- ----------------------------
INSERT INTO `t_user_department` VALUES (2, 1, 1, '2026-01-02 14:34:26', '2026-01-02 14:34:26');
INSERT INTO `t_user_department` VALUES (3, 4, 2, '2026-01-26 18:04:52', '2026-01-26 18:04:52');
INSERT INTO `t_user_department` VALUES (4, 5, 2, '2026-01-28 10:49:20', '2026-01-28 10:49:20');
INSERT INTO `t_user_department` VALUES (5, 6, 2, '2026-01-28 10:52:32', '2026-01-28 10:52:32');
INSERT INTO `t_user_department` VALUES (6, 7, 2, '2026-01-28 10:56:50', '2026-01-28 10:56:50');
INSERT INTO `t_user_department` VALUES (7, 8, 2, '2026-01-28 11:11:42', '2026-01-28 11:11:42');
INSERT INTO `t_user_department` VALUES (8, 9, 2, '2026-01-28 11:21:39', '2026-01-28 11:21:39');
INSERT INTO `t_user_department` VALUES (9, 10, 2, '2026-01-28 11:22:48', '2026-01-28 11:22:48');

-- ----------------------------
-- Table structure for t_user_job
-- ----------------------------
DROP TABLE IF EXISTS `t_user_job`;
CREATE TABLE `t_user_job`  (
                               `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                               `user_id` bigint NOT NULL COMMENT '用户id',
                               `job_id` bigint NOT NULL COMMENT '职务id',
                               `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                               `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                               PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户与职务关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_user_job
-- ----------------------------

-- ----------------------------
-- Table structure for t_user_manager
-- ----------------------------
DROP TABLE IF EXISTS `t_user_manager`;
CREATE TABLE `t_user_manager`  (
                                   `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                   `user_id` bigint NOT NULL COMMENT '用户id',
                                   `manager_id` bigint NOT NULL COMMENT '上级领导id',
                                   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                   PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户与上级领导关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_user_manager
-- ----------------------------

-- ----------------------------
-- Table structure for t_user_post
-- ----------------------------
DROP TABLE IF EXISTS `t_user_post`;
CREATE TABLE `t_user_post`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `user_id` bigint NOT NULL COMMENT '用户id',
                                `post_id` bigint NOT NULL COMMENT '岗位id',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户与岗位关系表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_user_post
-- ----------------------------

-- ----------------------------
-- Table structure for t_user_role
-- ----------------------------
DROP TABLE IF EXISTS `t_user_role`;
CREATE TABLE `t_user_role`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `user_id` bigint NOT NULL COMMENT '用户id',
                                `role_id` bigint NOT NULL COMMENT '角色id',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 13 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户角色表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_user_role
-- ----------------------------
INSERT INTO `t_user_role` VALUES (11, 1, 1, '2025-12-30 17:57:27', '2025-12-30 17:57:27');
INSERT INTO `t_user_role` VALUES (12, 0, 1, '2026-01-17 11:09:29', '2026-01-17 11:09:29');

-- ----------------------------
-- Table structure for t_visit_log
-- ----------------------------
DROP TABLE IF EXISTS `t_visit_log`;
CREATE TABLE `t_visit_log`  (
                                `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                `ip_address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'ip地址',
                                `uuid` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'UV标志',
                                `member_id` bigint NOT NULL DEFAULT 0 COMMENT '会员id',
                                `channel` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '渠道',
                                `visit_date` date NOT NULL COMMENT '日期',
                                `visit_time` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '时间',
                                `session_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '会话id',
                                `url` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT '地址',
                                `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                `ip_city_name` varchar(500) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '' COMMENT 'ip所在城市',
                                PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 255 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '访问记录' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_visit_log
-- ----------------------------
INSERT INTO `t_visit_log` VALUES (1, '127.0.0.1', '70a60990d4c911f08972f7952088b1f8', 0, 'web', '2025-12-09', '14:00', '70a60991d4c911f08972f7952088b1f8', 'http://localhost:8100/testweb/login', '2025-12-09 14:50:16', '2025-12-09 14:50:16', '未知');
INSERT INTO `t_visit_log` VALUES (2, '127.0.0.1', '70a60990d4c911f08972f7952088b1f8', 0, 'web', '2025-12-09', '14:00', '70a60991d4c911f08972f7952088b1f8', 'http://localhost:8100/testweb/login', '2025-12-09 14:56:22', '2025-12-09 14:56:22', '未知');
INSERT INTO `t_visit_log` VALUES (3, '127.0.0.1', '70a60990d4c911f08972f7952088b1f8', 0, 'web', '2025-12-09', '14:00', '70a60991d4c911f08972f7952088b1f8', 'http://localhost:8100/testweb/register', '2025-12-09 14:56:33', '2025-12-09 14:56:33', '未知');
INSERT INTO `t_visit_log` VALUES (4, '127.0.0.1', '70a60990d4c911f08972f7952088b1f8', 0, 'web', '2025-12-09', '14:00', '70a60991d4c911f08972f7952088b1f8', 'http://localhost:8100/testweb/register', '2025-12-09 14:56:38', '2025-12-09 14:56:38', '未知');
INSERT INTO `t_visit_log` VALUES (5, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/index', '2025-12-10 17:46:55', '2025-12-10 17:46:55', '未知');
INSERT INTO `t_visit_log` VALUES (6, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/index', '2025-12-10 17:47:01', '2025-12-10 17:47:01', '未知');
INSERT INTO `t_visit_log` VALUES (7, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:47:06', '2025-12-10 17:47:06', '未知');
INSERT INTO `t_visit_log` VALUES (8, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:47:13', '2025-12-10 17:47:13', '未知');
INSERT INTO `t_visit_log` VALUES (9, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:47:18', '2025-12-10 17:47:18', '未知');
INSERT INTO `t_visit_log` VALUES (10, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:47:54', '2025-12-10 17:47:54', '未知');
INSERT INTO `t_visit_log` VALUES (11, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:47:58', '2025-12-10 17:47:58', '未知');
INSERT INTO `t_visit_log` VALUES (12, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:48:22', '2025-12-10 17:48:22', '未知');
INSERT INTO `t_visit_log` VALUES (13, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:48:22', '2025-12-10 17:48:22', '未知');
INSERT INTO `t_visit_log` VALUES (14, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/index', '2025-12-10 17:48:22', '2025-12-10 17:48:22', '未知');
INSERT INTO `t_visit_log` VALUES (15, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/index', '2025-12-10 17:48:22', '2025-12-10 17:48:22', '未知');
INSERT INTO `t_visit_log` VALUES (16, '127.0.0.1', '58971da0d59411f0ba28a9b32640684d', 2, 'web', '2025-12-10', '17:00', '251d3e10d5ac11f09f9c95c29d0af85b', 'http://localhost:8100/testweb/', '2025-12-10 17:48:45', '2025-12-10 17:48:45', '未知');
INSERT INTO `t_visit_log` VALUES (17, '127.0.0.1', '9ae235a0d5ad11f0a14a43c66e824f50', 0, 'web', '2025-12-10', '17:00', '9ae235a1d5ad11f0a14a43c66e824f50', 'http://localhost:8100/testweb/login', '2025-12-10 17:51:10', '2025-12-10 17:51:10', '未知');
INSERT INTO `t_visit_log` VALUES (18, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:07:26', '2025-12-10 19:07:26', '未知');
INSERT INTO `t_visit_log` VALUES (19, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:07:31', '2025-12-10 19:07:31', '未知');
INSERT INTO `t_visit_log` VALUES (20, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:08:21', '2025-12-10 19:08:21', '未知');
INSERT INTO `t_visit_log` VALUES (21, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:09:03', '2025-12-10 19:09:03', '未知');
INSERT INTO `t_visit_log` VALUES (22, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:11:07', '2025-12-10 19:11:07', '未知');
INSERT INTO `t_visit_log` VALUES (23, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:11:16', '2025-12-10 19:11:16', '未知');
INSERT INTO `t_visit_log` VALUES (24, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:12:34', '2025-12-10 19:12:34', '未知');
INSERT INTO `t_visit_log` VALUES (25, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:12:42', '2025-12-10 19:12:42', '未知');
INSERT INTO `t_visit_log` VALUES (26, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '2720dfd1d5b811f09beb254f5879942e', 'http://localhost:8100/testweb/index', '2025-12-10 19:14:07', '2025-12-10 19:14:07', '未知');
INSERT INTO `t_visit_log` VALUES (27, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '6b2db8f0d5b911f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:22:50', '2025-12-10 19:22:50', '未知');
INSERT INTO `t_visit_log` VALUES (28, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '6b2db8f0d5b911f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:23:11', '2025-12-10 19:23:11', '未知');
INSERT INTO `t_visit_log` VALUES (29, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '6b2db8f0d5b911f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:23:58', '2025-12-10 19:23:58', '未知');
INSERT INTO `t_visit_log` VALUES (30, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '6b2db8f0d5b911f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:24:06', '2025-12-10 19:24:06', '未知');
INSERT INTO `t_visit_log` VALUES (31, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', 'd165fa00d5ba11f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:28:48', '2025-12-10 19:28:48', '未知');
INSERT INTO `t_visit_log` VALUES (32, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', 'd165fa00d5ba11f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:29:35', '2025-12-10 19:29:35', '未知');
INSERT INTO `t_visit_log` VALUES (33, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', 'd165fa00d5ba11f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:29:39', '2025-12-10 19:29:39', '未知');
INSERT INTO `t_visit_log` VALUES (34, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', 'd165fa00d5ba11f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:33:37', '2025-12-10 19:33:37', '未知');
INSERT INTO `t_visit_log` VALUES (35, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', 'd165fa00d5ba11f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:34:01', '2025-12-10 19:34:01', '未知');
INSERT INTO `t_visit_log` VALUES (36, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '379efe60d5bc11f0979a3df07b292ba8', 'http://localhost:8100/testweb/index', '2025-12-10 19:38:11', '2025-12-10 19:38:11', '未知');
INSERT INTO `t_visit_log` VALUES (37, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '379efe60d5bc11f0979a3df07b292ba8', 'http://localhost:8100/testweb/learn', '2025-12-10 19:39:11', '2025-12-10 19:39:11', '未知');
INSERT INTO `t_visit_log` VALUES (38, '127.0.0.1', '2720dfd0d5b811f09beb254f5879942e', 2, 'web', '2025-12-10', '19:00', '379efe60d5bc11f0979a3df07b292ba8', 'http://localhost:8100/testweb/learn', '2025-12-10 19:39:13', '2025-12-10 19:39:13', '未知');
INSERT INTO `t_visit_log` VALUES (39, '127.0.0.1', '0aa28ac0e5f811f0907d63038cb66c05', 2, 'web', '2025-12-31', '11:00', 'cd95afa0e5f611f0908e95d02ed93769', 'http://localhost:8100/testweb/index', '2025-12-31 11:23:56', '2025-12-31 11:23:56', '未知');
INSERT INTO `t_visit_log` VALUES (40, '127.0.0.1', '0aa28ac0e5f811f0907d63038cb66c05', 2, 'web', '2025-12-31', '11:00', 'cd95afa0e5f611f0908e95d02ed93769', 'http://localhost:8100/testweb/learn', '2025-12-31 11:24:11', '2025-12-31 11:24:11', '未知');
INSERT INTO `t_visit_log` VALUES (41, '127.0.0.1', '0aa28ac0e5f811f0907d63038cb66c05', 2, 'web', '2025-12-31', '11:00', 'cd95afa0e5f611f0908e95d02ed93769', 'http://localhost:8100/testweb/exam', '2025-12-31 11:24:13', '2025-12-31 11:24:13', '未知');
INSERT INTO `t_visit_log` VALUES (42, '127.0.0.1', '0aa28ac0e5f811f0907d63038cb66c05', 2, 'web', '2025-12-31', '11:00', 'cd95afa0e5f611f0908e95d02ed93769', 'http://localhost:8100/testweb/exam', '2025-12-31 11:24:18', '2025-12-31 11:24:18', '未知');
INSERT INTO `t_visit_log` VALUES (43, '127.0.0.1', '0aa28ac0e5f811f0907d63038cb66c05', 2, 'web', '2025-12-31', '11:00', 'cd95afa0e5f611f0908e95d02ed93769', 'http://localhost:8100/testweb/news', '2025-12-31 11:24:20', '2025-12-31 11:24:20', '未知');
INSERT INTO `t_visit_log` VALUES (44, '127.0.0.1', '0aa28ac0e5f811f0907d63038cb66c05', 2, 'web', '2025-12-31', '11:00', 'cd95afa0e5f611f0908e95d02ed93769', 'http://localhost:8100/testweb/exam', '2025-12-31 11:24:22', '2025-12-31 11:24:22', '未知');
INSERT INTO `t_visit_log` VALUES (45, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/learn-record', '2026-01-02 15:04:39', '2026-01-02 15:04:39', '未知');
INSERT INTO `t_visit_log` VALUES (46, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/exam/sign-up', '2026-01-02 15:04:44', '2026-01-02 15:04:44', '未知');
INSERT INTO `t_visit_log` VALUES (47, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/learn-record', '2026-01-02 15:04:46', '2026-01-02 15:04:46', '未知');
INSERT INTO `t_visit_log` VALUES (48, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/circle', '2026-01-02 15:04:51', '2026-01-02 15:04:51', '未知');
INSERT INTO `t_visit_log` VALUES (49, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/article', '2026-01-02 15:04:53', '2026-01-02 15:04:53', '未知');
INSERT INTO `t_visit_log` VALUES (50, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/resource', '2026-01-02 15:04:55', '2026-01-02 15:04:55', '未知');
INSERT INTO `t_visit_log` VALUES (51, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/favorites', '2026-01-02 15:04:57', '2026-01-02 15:04:57', '未知');
INSERT INTO `t_visit_log` VALUES (52, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/favorites', '2026-01-02 15:07:31', '2026-01-02 15:07:31', '未知');
INSERT INTO `t_visit_log` VALUES (53, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/favorites', '2026-01-02 15:15:27', '2026-01-02 15:15:27', '未知');
INSERT INTO `t_visit_log` VALUES (54, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/comment', '2026-01-02 15:15:33', '2026-01-02 15:15:33', '未知');
INSERT INTO `t_visit_log` VALUES (55, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/fans', '2026-01-02 15:15:35', '2026-01-02 15:15:35', '未知');
INSERT INTO `t_visit_log` VALUES (56, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/follow', '2026-01-02 15:15:36', '2026-01-02 15:15:36', '未知');
INSERT INTO `t_visit_log` VALUES (57, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:15:38', '2026-01-02 15:15:38', '未知');
INSERT INTO `t_visit_log` VALUES (58, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/certificate', '2026-01-02 15:15:41', '2026-01-02 15:15:41', '未知');
INSERT INTO `t_visit_log` VALUES (59, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/setting', '2026-01-02 15:15:44', '2026-01-02 15:15:44', '未知');
INSERT INTO `t_visit_log` VALUES (60, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/certificate', '2026-01-02 15:15:46', '2026-01-02 15:15:46', '未知');
INSERT INTO `t_visit_log` VALUES (61, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/certificate', '2026-01-02 15:18:37', '2026-01-02 15:18:37', '未知');
INSERT INTO `t_visit_log` VALUES (62, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/setting', '2026-01-02 15:18:42', '2026-01-02 15:18:42', '未知');
INSERT INTO `t_visit_log` VALUES (63, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/search', '2026-01-02 15:18:45', '2026-01-02 15:18:45', '未知');
INSERT INTO `t_visit_log` VALUES (64, '127.0.0.1', '58a68fa0e7ab11f08b0601a84487766e', 0, 'web', '2026-01-02', '15:00', '58a6b6b0e7ab11f08b0601a84487766e', 'https://user-edu.aizhs.top/login', '2026-01-02 15:19:31', '2026-01-02 15:19:31', '未知');
INSERT INTO `t_visit_log` VALUES (65, '127.0.0.1', '67d28880e7ab11f08e658bb2c4f68b95', 0, 'web', '2026-01-02', '15:00', '67d2af90e7ab11f08e658bb2c4f68b95', 'https://user-edu.aizhs.top/forget/pwd', '2026-01-02 15:19:41', '2026-01-02 15:19:41', '未知');
INSERT INTO `t_visit_log` VALUES (66, '127.0.0.1', '67d28880e7ab11f08e658bb2c4f68b95', 0, 'web', '2026-01-02', '15:00', '67d2af90e7ab11f08e658bb2c4f68b95', 'https://user-edu.aizhs.top/forget/pwd', '2026-01-02 15:19:43', '2026-01-02 15:19:43', '未知');
INSERT INTO `t_visit_log` VALUES (67, '127.0.0.1', '69f25b40e7ab11f095b16115b60091d1', 0, 'web', '2026-01-02', '15:00', '69f25b41e7ab11f095b16115b60091d1', 'https://user-edu.aizhs.top/agreement/privacy', '2026-01-02 15:19:45', '2026-01-02 15:19:45', '未知');
INSERT INTO `t_visit_log` VALUES (68, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/message/notice', '2026-01-02 15:20:50', '2026-01-02 15:20:50', '未知');
INSERT INTO `t_visit_log` VALUES (69, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/message/like', '2026-01-02 15:20:52', '2026-01-02 15:20:52', '未知');
INSERT INTO `t_visit_log` VALUES (70, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/message/favorite', '2026-01-02 15:20:55', '2026-01-02 15:20:55', '未知');
INSERT INTO `t_visit_log` VALUES (71, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/message/comment', '2026-01-02 15:20:57', '2026-01-02 15:20:57', '未知');
INSERT INTO `t_visit_log` VALUES (72, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/message/fans', '2026-01-02 15:20:59', '2026-01-02 15:20:59', '未知');
INSERT INTO `t_visit_log` VALUES (73, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/message/private-letter', '2026-01-02 15:21:01', '2026-01-02 15:21:01', '未知');
INSERT INTO `t_visit_log` VALUES (74, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:21:03', '2026-01-02 15:21:03', '未知');
INSERT INTO `t_visit_log` VALUES (75, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:21:18', '2026-01-02 15:21:18', '未知');
INSERT INTO `t_visit_log` VALUES (76, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:21:22', '2026-01-02 15:21:22', '未知');
INSERT INTO `t_visit_log` VALUES (77, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:22:49', '2026-01-02 15:22:49', '未知');
INSERT INTO `t_visit_log` VALUES (78, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:23:00', '2026-01-02 15:23:00', '未知');
INSERT INTO `t_visit_log` VALUES (79, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:24:12', '2026-01-02 15:24:12', '未知');
INSERT INTO `t_visit_log` VALUES (80, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:25:55', '2026-01-02 15:25:55', '未知');
INSERT INTO `t_visit_log` VALUES (81, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:27:42', '2026-01-02 15:27:42', '未知');
INSERT INTO `t_visit_log` VALUES (82, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/detail?id=2', '2026-01-02 15:28:43', '2026-01-02 15:28:43', '未知');
INSERT INTO `t_visit_log` VALUES (83, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/personal', '2026-01-02 15:28:47', '2026-01-02 15:28:47', '未知');
INSERT INTO `t_visit_log` VALUES (84, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/learn-record', '2026-01-02 15:28:51', '2026-01-02 15:28:51', '未知');
INSERT INTO `t_visit_log` VALUES (85, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/exam/sign-up', '2026-01-02 15:28:52', '2026-01-02 15:28:52', '未知');
INSERT INTO `t_visit_log` VALUES (86, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/exam/record', '2026-01-02 15:28:54', '2026-01-02 15:28:54', '未知');
INSERT INTO `t_visit_log` VALUES (87, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/exam/wrong-question', '2026-01-02 15:28:55', '2026-01-02 15:28:55', '未知');
INSERT INTO `t_visit_log` VALUES (88, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/setting', '2026-01-02 15:28:58', '2026-01-02 15:28:58', '未知');
INSERT INTO `t_visit_log` VALUES (89, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/certificate', '2026-01-02 15:29:01', '2026-01-02 15:29:01', '未知');
INSERT INTO `t_visit_log` VALUES (90, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:29:05', '2026-01-02 15:29:05', '未知');
INSERT INTO `t_visit_log` VALUES (91, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:29:25', '2026-01-02 15:29:25', '未知');
INSERT INTO `t_visit_log` VALUES (92, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:30:19', '2026-01-02 15:30:19', '未知');
INSERT INTO `t_visit_log` VALUES (93, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:30:48', '2026-01-02 15:30:48', '未知');
INSERT INTO `t_visit_log` VALUES (94, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:32:01', '2026-01-02 15:32:01', '未知');
INSERT INTO `t_visit_log` VALUES (95, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:32:30', '2026-01-02 15:32:30', '未知');
INSERT INTO `t_visit_log` VALUES (96, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:32:46', '2026-01-02 15:32:46', '未知');
INSERT INTO `t_visit_log` VALUES (97, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/point', '2026-01-02 15:34:40', '2026-01-02 15:34:40', '未知');
INSERT INTO `t_visit_log` VALUES (98, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/follow', '2026-01-02 15:34:43', '2026-01-02 15:34:43', '未知');
INSERT INTO `t_visit_log` VALUES (99, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/fans', '2026-01-02 15:34:44', '2026-01-02 15:34:44', '未知');
INSERT INTO `t_visit_log` VALUES (100, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/comment', '2026-01-02 15:34:46', '2026-01-02 15:34:46', '未知');
INSERT INTO `t_visit_log` VALUES (101, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/favorites', '2026-01-02 15:34:47', '2026-01-02 15:34:47', '未知');
INSERT INTO `t_visit_log` VALUES (102, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/resource', '2026-01-02 15:34:50', '2026-01-02 15:34:50', '未知');
INSERT INTO `t_visit_log` VALUES (103, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/article', '2026-01-02 15:34:53', '2026-01-02 15:34:53', '未知');
INSERT INTO `t_visit_log` VALUES (104, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/ask', '2026-01-02 15:34:55', '2026-01-02 15:34:55', '未知');
INSERT INTO `t_visit_log` VALUES (105, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/circle', '2026-01-02 15:34:56', '2026-01-02 15:34:56', '未知');
INSERT INTO `t_visit_log` VALUES (106, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/exam/wrong-question', '2026-01-02 15:34:58', '2026-01-02 15:34:58', '未知');
INSERT INTO `t_visit_log` VALUES (107, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/exam/record', '2026-01-02 15:35:02', '2026-01-02 15:35:02', '未知');
INSERT INTO `t_visit_log` VALUES (108, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/exam/sign-up', '2026-01-02 15:35:04', '2026-01-02 15:35:04', '未知');
INSERT INTO `t_visit_log` VALUES (109, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/learn-record', '2026-01-02 15:35:07', '2026-01-02 15:35:07', '未知');
INSERT INTO `t_visit_log` VALUES (110, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/exam', '2026-01-02 15:35:12', '2026-01-02 15:35:12', '未知');
INSERT INTO `t_visit_log` VALUES (111, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/news', '2026-01-02 15:35:14', '2026-01-02 15:35:14', '未知');
INSERT INTO `t_visit_log` VALUES (112, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/article', '2026-01-02 15:35:16', '2026-01-02 15:35:16', '未知');
INSERT INTO `t_visit_log` VALUES (113, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/member/article', '2026-01-02 15:35:28', '2026-01-02 15:35:28', '未知');
INSERT INTO `t_visit_log` VALUES (114, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/ask', '2026-01-02 15:35:37', '2026-01-02 15:35:37', '未知');
INSERT INTO `t_visit_log` VALUES (115, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/circle', '2026-01-02 15:35:39', '2026-01-02 15:35:39', '未知');
INSERT INTO `t_visit_log` VALUES (116, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/resource', '2026-01-02 15:35:42', '2026-01-02 15:35:42', '未知');
INSERT INTO `t_visit_log` VALUES (117, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/resource', '2026-01-02 15:36:03', '2026-01-02 15:36:03', '未知');
INSERT INTO `t_visit_log` VALUES (118, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/resource', '2026-01-02 15:37:24', '2026-01-02 15:37:24', '未知');
INSERT INTO `t_visit_log` VALUES (119, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/resource', '2026-01-02 15:38:40', '2026-01-02 15:38:40', '未知');
INSERT INTO `t_visit_log` VALUES (120, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/resource', '2026-01-02 15:38:56', '2026-01-02 15:38:56', '未知');
INSERT INTO `t_visit_log` VALUES (121, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/resource', '2026-01-02 15:39:01', '2026-01-02 15:39:01', '未知');
INSERT INTO `t_visit_log` VALUES (122, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/announcement', '2026-01-02 15:39:04', '2026-01-02 15:39:04', '未知');
INSERT INTO `t_visit_log` VALUES (123, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/announcement', '2026-01-02 15:39:06', '2026-01-02 15:39:06', '未知');
INSERT INTO `t_visit_log` VALUES (124, '127.0.0.1', '077908e0e7a811f0bf048dba6992beb5', 2, 'web', '2026-01-02', '15:00', '077908e1e7a811f0bf048dba6992beb5', 'https://user-edu.aizhs.top/index', '2026-01-02 15:39:12', '2026-01-02 15:39:12', '未知');
INSERT INTO `t_visit_log` VALUES (125, '127.0.0.1', '069d01f0e7c211f0a66157210932f3ef', 0, 'web', '2026-01-02', '18:00', '069d2900e7c211f0a66157210932f3ef', 'https://user-edu.aizhs.top/login', '2026-01-02 18:01:36', '2026-01-02 18:01:36', '未知');
INSERT INTO `t_visit_log` VALUES (126, '127.0.0.1', '86a11d20ef3b11f0b4cf2db0ac40cd3f', 0, 'web', '2026-01-12', '06:00', '86a14430ef3b11f0b4cf2db0ac40cd3f', 'https://user-edu.aizhs.top/register', '2026-01-12 06:18:59', '2026-01-12 06:18:59', '未知');
INSERT INTO `t_visit_log` VALUES (127, '127.0.0.1', 'e775fe70f34811f093e68997b9e2d063', 2, 'web', '2026-01-17', '10:00', 'dc741361f29c11f0adf6abe0ffef502f', 'https://user-edu.aizhs.top/index', '2026-01-17 10:05:41', '2026-01-17 10:05:41', '未知');
INSERT INTO `t_visit_log` VALUES (128, '127.0.0.1', '3b3b0ce0f5a511f0891203cd8ac803a9', 0, 'web', '2026-01-20', '10:00', '3b3b0ce1f5a511f0891203cd8ac803a9', 'https://user-edu.aizhs.top/login', '2026-01-20 10:34:41', '2026-01-20 10:34:41', '未知');
INSERT INTO `t_visit_log` VALUES (129, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/index', '2026-01-20 21:17:29', '2026-01-20 21:17:29', '未知');
INSERT INTO `t_visit_log` VALUES (130, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/learn', '2026-01-20 21:17:45', '2026-01-20 21:17:45', '未知');
INSERT INTO `t_visit_log` VALUES (131, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/live', '2026-01-20 21:17:50', '2026-01-20 21:17:50', '未知');
INSERT INTO `t_visit_log` VALUES (132, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/exam', '2026-01-20 21:17:53', '2026-01-20 21:17:53', '未知');
INSERT INTO `t_visit_log` VALUES (133, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/news', '2026-01-20 21:17:55', '2026-01-20 21:17:55', '未知');
INSERT INTO `t_visit_log` VALUES (134, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/article', '2026-01-20 21:17:55', '2026-01-20 21:17:55', '未知');
INSERT INTO `t_visit_log` VALUES (135, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/ask', '2026-01-20 21:17:55', '2026-01-20 21:17:55', '未知');
INSERT INTO `t_visit_log` VALUES (136, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/resource', '2026-01-20 21:17:56', '2026-01-20 21:17:56', '未知');
INSERT INTO `t_visit_log` VALUES (137, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/circle', '2026-01-20 21:17:57', '2026-01-20 21:17:57', '未知');
INSERT INTO `t_visit_log` VALUES (138, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', 'c0bcad00f4d411f0b0a905dff09e503e', 'https://user-edu.aizhs.top/announcement', '2026-01-20 21:17:57', '2026-01-20 21:17:57', '未知');
INSERT INTO `t_visit_log` VALUES (139, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/learn/list', '2026-01-20 21:50:09', '2026-01-20 21:50:09', '未知');
INSERT INTO `t_visit_log` VALUES (140, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/learn/topic', '2026-01-20 21:50:10', '2026-01-20 21:50:10', '未知');
INSERT INTO `t_visit_log` VALUES (141, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/learn', '2026-01-20 21:50:10', '2026-01-20 21:50:10', '未知');
INSERT INTO `t_visit_log` VALUES (142, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/live', '2026-01-20 21:50:12', '2026-01-20 21:50:12', '未知');
INSERT INTO `t_visit_log` VALUES (143, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/exam', '2026-01-20 21:50:12', '2026-01-20 21:50:12', '未知');
INSERT INTO `t_visit_log` VALUES (144, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/article', '2026-01-20 21:50:13', '2026-01-20 21:50:13', '未知');
INSERT INTO `t_visit_log` VALUES (145, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/news', '2026-01-20 21:50:13', '2026-01-20 21:50:13', '未知');
INSERT INTO `t_visit_log` VALUES (146, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/article', '2026-01-20 21:50:14', '2026-01-20 21:50:14', '未知');
INSERT INTO `t_visit_log` VALUES (147, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/ask', '2026-01-20 21:50:14', '2026-01-20 21:50:14', '未知');
INSERT INTO `t_visit_log` VALUES (148, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/ask', '2026-01-20 21:53:26', '2026-01-20 21:53:26', '未知');
INSERT INTO `t_visit_log` VALUES (149, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/ask', '2026-01-20 21:53:26', '2026-01-20 21:53:26', '未知');
INSERT INTO `t_visit_log` VALUES (150, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/member/ask', '2026-01-20 21:53:26', '2026-01-20 21:53:26', '未知');
INSERT INTO `t_visit_log` VALUES (151, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/ask', '2026-01-20 21:53:34', '2026-01-20 21:53:34', '未知');
INSERT INTO `t_visit_log` VALUES (152, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '21:00', '910c1450f60611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/member/ask', '2026-01-20 21:53:35', '2026-01-20 21:53:35', '未知');
INSERT INTO `t_visit_log` VALUES (153, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '22:00', '8b652460f60b11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-20 22:26:56', '2026-01-20 22:26:56', '未知');
INSERT INTO `t_visit_log` VALUES (154, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '23:00', '34169450f61011f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-20 23:00:17', '2026-01-20 23:00:17', '未知');
INSERT INTO `t_visit_log` VALUES (155, '127.0.0.1', '4d8e8a40f60211f09e44d1864cdf53eb', 1, 'web', '2026-01-20', '23:00', 'dcc85260f61411f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-20 23:33:38', '2026-01-20 23:33:38', '未知');
INSERT INTO `t_visit_log` VALUES (156, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '00:00', '857814a0f61911f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 00:06:59', '2026-01-21 00:06:59', '未知');
INSERT INTO `t_visit_log` VALUES (157, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '00:00', '3d0fc1e0f61e11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 00:40:20', '2026-01-21 00:40:20', '未知');
INSERT INTO `t_visit_log` VALUES (158, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '01:00', 'd94ae310f62211f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 01:13:41', '2026-01-21 01:13:41', '未知');
INSERT INTO `t_visit_log` VALUES (159, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '01:00', 'e0b19fe0f62711f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 01:47:27', '2026-01-21 01:47:27', '未知');
INSERT INTO `t_visit_log` VALUES (160, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '02:00', 'a09f8c50f62c11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 02:21:27', '2026-01-21 02:21:27', '未知');
INSERT INTO `t_visit_log` VALUES (161, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '02:00', '3cdb97e0f63111f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 02:55:27', '2026-01-21 02:55:27', '未知');
INSERT INTO `t_visit_log` VALUES (162, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '03:00', '207dfd40f63611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 03:29:27', '2026-01-21 03:29:27', '未知');
INSERT INTO `t_visit_log` VALUES (163, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '04:00', 'e06d9760f63a11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 04:03:27', '2026-01-21 04:03:27', '未知');
INSERT INTO `t_visit_log` VALUES (164, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '04:00', 'a05cbc50f63f11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 04:37:27', '2026-01-21 04:37:27', '未知');
INSERT INTO `t_visit_log` VALUES (165, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '05:00', '604be140f64411f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 05:11:28', '2026-01-21 05:11:28', '未知');
INSERT INTO `t_visit_log` VALUES (166, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '05:00', '203c17a0f64911f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 05:45:28', '2026-01-21 05:45:28', '未知');
INSERT INTO `t_visit_log` VALUES (167, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '06:00', 'e02bb1c0f64d11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 06:19:28', '2026-01-21 06:19:28', '未知');
INSERT INTO `t_visit_log` VALUES (168, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '06:00', 'a019ec50f65211f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 06:53:28', '2026-01-21 06:53:28', '未知');
INSERT INTO `t_visit_log` VALUES (169, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '07:00', '3c45cb40f65711f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 07:27:28', '2026-01-21 07:27:28', '未知');
INSERT INTO `t_visit_log` VALUES (170, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '08:00', 'fc356560f65b11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 08:01:28', '2026-01-21 08:01:28', '未知');
INSERT INTO `t_visit_log` VALUES (171, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '08:00', 'dfe78230f66011f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 08:35:28', '2026-01-21 08:35:28', '未知');
INSERT INTO `t_visit_log` VALUES (172, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '09:00', '9fd82dc0f66511f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 09:09:28', '2026-01-21 09:09:28', '未知');
INSERT INTO `t_visit_log` VALUES (173, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '09:00', '5fc6dd80f66a11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 09:43:28', '2026-01-21 09:43:28', '未知');
INSERT INTO `t_visit_log` VALUES (174, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '10:00', '1fb6c5c0f66f11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 10:17:28', '2026-01-21 10:17:28', '未知');
INSERT INTO `t_visit_log` VALUES (175, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '10:00', 'bbe0a8e0f67311f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 10:51:28', '2026-01-21 10:51:28', '未知');
INSERT INTO `t_visit_log` VALUES (176, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '11:00', '9f950fa0f67811f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 11:25:28', '2026-01-21 11:25:28', '未知');
INSERT INTO `t_visit_log` VALUES (177, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '11:00', '3bc1d8f0f67d11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 11:59:29', '2026-01-21 11:59:29', '未知');
INSERT INTO `t_visit_log` VALUES (178, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '12:00', '1f746af0f68211f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 12:33:28', '2026-01-21 12:33:28', '未知');
INSERT INTO `t_visit_log` VALUES (179, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '13:00', 'df638fe0f68611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 13:07:28', '2026-01-21 13:07:28', '未知');
INSERT INTO `t_visit_log` VALUES (180, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '13:00', '9f521890f68b11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 13:41:28', '2026-01-21 13:41:28', '未知');
INSERT INTO `t_visit_log` VALUES (181, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '14:00', '5f411670f69011f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 14:15:28', '2026-01-21 14:15:28', '未知');
INSERT INTO `t_visit_log` VALUES (182, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '14:00', '1f308980f69511f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 14:49:28', '2026-01-21 14:49:28', '未知');
INSERT INTO `t_visit_log` VALUES (183, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '15:00', 'df1f8760f69911f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 15:23:29', '2026-01-21 15:23:29', '未知');
INSERT INTO `t_visit_log` VALUES (184, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '15:00', '7b4af120f69e11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 15:57:28', '2026-01-21 15:57:28', '未知');
INSERT INTO `t_visit_log` VALUES (185, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '16:00', '5efff420f6a311f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 16:31:29', '2026-01-21 16:31:29', '未知');
INSERT INTO `t_visit_log` VALUES (186, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '16:00', '5efff420f6a311f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 16:34:10', '2026-01-21 16:34:10', '未知');
INSERT INTO `t_visit_log` VALUES (187, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '17:00', '1eec32e0f6a811f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 17:05:29', '2026-01-21 17:05:29', '未知');
INSERT INTO `t_visit_log` VALUES (188, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '17:00', 'dedf7680f6ac11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 17:39:29', '2026-01-21 17:39:29', '未知');
INSERT INTO `t_visit_log` VALUES (189, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '18:00', '7b1b33f0f6b111f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 18:13:29', '2026-01-21 18:13:29', '未知');
INSERT INTO `t_visit_log` VALUES (190, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '18:00', '5ebbc490f6b611f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 18:47:29', '2026-01-21 18:47:29', '未知');
INSERT INTO `t_visit_log` VALUES (191, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '19:00', '1eaa7450f6bb11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 19:21:29', '2026-01-21 19:21:29', '未知');
INSERT INTO `t_visit_log` VALUES (192, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '19:00', 'bad60520f6bf11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 19:55:29', '2026-01-21 19:55:29', '未知');
INSERT INTO `t_visit_log` VALUES (193, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '20:00', '9e8a1dc0f6c411f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 20:29:29', '2026-01-21 20:29:29', '未知');
INSERT INTO `t_visit_log` VALUES (194, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '21:00', '5e7a5420f6c911f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 21:03:29', '2026-01-21 21:03:29', '未知');
INSERT INTO `t_visit_log` VALUES (195, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '21:00', '1e66b9f0f6ce11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 21:37:29', '2026-01-21 21:37:29', '未知');
INSERT INTO `t_visit_log` VALUES (196, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '22:00', 'de589e00f6d211f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 22:11:29', '2026-01-21 22:11:29', '未知');
INSERT INTO `t_visit_log` VALUES (197, '127.0.0.1', '940da560f6d311f09213fbd81556db78', 0, 'web', '2026-01-21', '22:00', '940dcc70f6d311f09213fbd81556db78', 'https://user-edu.aizhs.top/agreement/privacy', '2026-01-21 22:15:03', '2026-01-21 22:15:03', '未知');
INSERT INTO `t_visit_log` VALUES (198, '127.0.0.1', '940da560f6d311f09213fbd81556db78', 0, 'web', '2026-01-21', '22:00', '940dcc70f6d311f09213fbd81556db78', 'https://user-edu.aizhs.top/agreement/privacy', '2026-01-21 22:15:03', '2026-01-21 22:15:03', '未知');
INSERT INTO `t_visit_log` VALUES (199, '127.0.0.1', '61e5cdd0f6d611f0a05bf3d90dff84f0', 0, 'web', '2026-01-21', '22:00', '61e5f4e0f6d611f0a05bf3d90dff84f0', 'https://user-edu.aizhs.top/forget/pwd', '2026-01-21 22:35:07', '2026-01-21 22:35:07', '未知');
INSERT INTO `t_visit_log` VALUES (200, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '22:00', '9e46ffa0f6d711f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 22:45:29', '2026-01-21 22:45:29', '未知');
INSERT INTO `t_visit_log` VALUES (201, '127.0.0.1', '121ed7c0f6da11f09c22d9b64796c11f', 0, 'web', '2026-01-21', '23:00', '121efed0f6da11f09c22d9b64796c11f', 'https://user-edu.aizhs.top/agreement/service', '2026-01-21 23:01:31', '2026-01-21 23:01:31', '未知');
INSERT INTO `t_visit_log` VALUES (202, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '23:00', '5e356140f6dc11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 23:19:29', '2026-01-21 23:19:29', '未知');
INSERT INTO `t_visit_log` VALUES (203, '127.0.0.1', 'fb7c2d80f61911f09e44d1864cdf53eb', 1, 'web', '2026-01-21', '23:00', '1e2597a0f6e111f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-21 23:53:29', '2026-01-21 23:53:29', '未知');
INSERT INTO `t_visit_log` VALUES (204, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '00:00', 'de15a6f0f6e511f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 00:27:29', '2026-01-22 00:27:29', '未知');
INSERT INTO `t_visit_log` VALUES (205, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '01:00', '9e058f30f6ea11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 01:01:29', '2026-01-22 01:01:29', '未知');
INSERT INTO `t_visit_log` VALUES (206, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '01:00', '167c58f0f6ef11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 01:35:29', '2026-01-22 01:35:29', '未知');
INSERT INTO `t_visit_log` VALUES (207, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '02:00', 'fa310dd0f6f311f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 02:09:29', '2026-01-22 02:09:29', '未知');
INSERT INTO `t_visit_log` VALUES (208, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '02:00', 'ba0d4700f6f811f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 02:43:29', '2026-01-22 02:43:29', '未知');
INSERT INTO `t_visit_log` VALUES (209, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '03:00', '9dc15fa0f6fd11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 03:17:29', '2026-01-22 03:17:29', '未知');
INSERT INTO `t_visit_log` VALUES (210, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '03:00', '5daf4c10f70211f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 03:51:29', '2026-01-22 03:51:29', '未知');
INSERT INTO `t_visit_log` VALUES (211, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '04:00', '1d9f3450f70711f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 04:25:30', '2026-01-22 04:25:30', '未知');
INSERT INTO `t_visit_log` VALUES (212, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '04:00', 'dd8f6ab0f70b11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 04:59:30', '2026-01-22 04:59:30', '未知');
INSERT INTO `t_visit_log` VALUES (213, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '05:00', '9d801640f71011f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 05:33:30', '2026-01-22 05:33:30', '未知');
INSERT INTO `t_visit_log` VALUES (214, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '06:00', '5d6db490f71511f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 06:07:30', '2026-01-22 06:07:30', '未知');
INSERT INTO `t_visit_log` VALUES (215, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '06:00', 'f9aa3550f71911f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 06:41:30', '2026-01-22 06:41:30', '未知');
INSERT INTO `t_visit_log` VALUES (216, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '07:00', 'dd4d5e00f71e11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 07:15:30', '2026-01-22 07:15:30', '未知');
INSERT INTO `t_visit_log` VALUES (217, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '07:00', '9d3afc50f72311f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 07:49:30', '2026-01-22 07:49:30', '未知');
INSERT INTO `t_visit_log` VALUES (218, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '08:00', '5d2ae490f72811f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 08:23:30', '2026-01-22 08:23:30', '未知');
INSERT INTO `t_visit_log` VALUES (219, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '08:00', '1d1accd0f72d11f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 08:57:30', '2026-01-22 08:57:30', '未知');
INSERT INTO `t_visit_log` VALUES (220, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '09:00', 'dd095580f73111f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 09:31:30', '2026-01-22 09:31:30', '未知');
INSERT INTO `t_visit_log` VALUES (221, '127.0.0.1', '01d76650f6e611f09e44d1864cdf53eb', 1, 'web', '2026-01-22', '10:00', '139514b0f73511f09e44d1864cdf53eb', 'https://user-edu.aizhs.top/index', '2026-01-22 10:02:17', '2026-01-22 10:02:17', '未知');
INSERT INTO `t_visit_log` VALUES (222, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/index', '2026-01-24 17:27:53', '2026-01-24 17:27:53', '未知');
INSERT INTO `t_visit_log` VALUES (223, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/index', '2026-01-24 17:28:21', '2026-01-24 17:28:21', '未知');
INSERT INTO `t_visit_log` VALUES (224, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/index', '2026-01-24 17:28:33', '2026-01-24 17:28:33', '未知');
INSERT INTO `t_visit_log` VALUES (225, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/', '2026-01-24 17:29:26', '2026-01-24 17:29:26', '未知');
INSERT INTO `t_visit_log` VALUES (226, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/index', '2026-01-24 17:30:53', '2026-01-24 17:30:53', '未知');
INSERT INTO `t_visit_log` VALUES (227, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/index', '2026-01-24 17:31:42', '2026-01-24 17:31:42', '未知');
INSERT INTO `t_visit_log` VALUES (228, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/index', '2026-01-24 17:31:46', '2026-01-24 17:31:46', '未知');
INSERT INTO `t_visit_log` VALUES (229, '127.0.0.1', '972539b0f90411f08c8e5d89199bcd9f', 0, 'web', '2026-01-24', '17:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/index', '2026-01-24 17:31:52', '2026-01-24 17:31:52', '未知');
INSERT INTO `t_visit_log` VALUES (230, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/index', '2026-01-24 17:33:22', '2026-01-24 17:33:22', '未知');
INSERT INTO `t_visit_log` VALUES (231, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/index', '2026-01-24 17:34:58', '2026-01-24 17:34:58', '未知');
INSERT INTO `t_visit_log` VALUES (232, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/index', '2026-01-24 17:35:14', '2026-01-24 17:35:14', '未知');
INSERT INTO `t_visit_log` VALUES (233, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/index', '2026-01-24 17:36:11', '2026-01-24 17:36:11', '未知');
INSERT INTO `t_visit_log` VALUES (234, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/index', '2026-01-24 17:36:21', '2026-01-24 17:36:21', '未知');
INSERT INTO `t_visit_log` VALUES (235, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/member/personal', '2026-01-24 17:36:58', '2026-01-24 17:36:58', '未知');
INSERT INTO `t_visit_log` VALUES (236, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/member/personal', '2026-01-24 17:37:56', '2026-01-24 17:37:56', '未知');
INSERT INTO `t_visit_log` VALUES (237, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/member/personal', '2026-01-24 17:39:25', '2026-01-24 17:39:25', '未知');
INSERT INTO `t_visit_log` VALUES (238, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/index', '2026-01-24 17:39:31', '2026-01-24 17:39:31', '未知');
INSERT INTO `t_visit_log` VALUES (239, '127.0.0.1', 'df66fb00f8e611f0a0b29dff8398237f', 1, 'web', '2026-01-24', '17:00', 'bbe28b60f8e911f0a0b29dff8398237f', 'https://user-edu.aizhs.top/index', '2026-01-24 17:42:32', '2026-01-24 17:42:32', '未知');
INSERT INTO `t_visit_log` VALUES (240, '127.0.0.1', 'df66fb00f8e611f0a0b29dff8398237f', 1, 'web', '2026-01-24', '17:00', 'bbe28b60f8e911f0a0b29dff8398237f', 'https://user-edu.aizhs.top/index', '2026-01-24 17:42:38', '2026-01-24 17:42:38', '未知');
INSERT INTO `t_visit_log` VALUES (241, '127.0.0.1', 'df66fb00f8e611f0a0b29dff8398237f', 1, 'web', '2026-01-24', '17:00', 'bbe28b60f8e911f0a0b29dff8398237f', 'https://user-edu.aizhs.top/index', '2026-01-24 17:42:42', '2026-01-24 17:42:42', '未知');
INSERT INTO `t_visit_log` VALUES (242, '127.0.0.1', 'df66fb00f8e611f0a0b29dff8398237f', 1, 'web', '2026-01-24', '17:00', 'bbe28b60f8e911f0a0b29dff8398237f', 'https://user-edu.aizhs.top/member/personal', '2026-01-24 17:43:11', '2026-01-24 17:43:11', '未知');
INSERT INTO `t_visit_log` VALUES (243, '127.0.0.1', 'ba45f6c0f90711f0812e9fa05fe657f1', 0, 'web', '2026-01-24', '17:00', 'ba461dd0f90711f0812e9fa05fe657f1', 'http://localhost:8100/testweb/index', '2026-01-24 17:44:22', '2026-01-24 17:44:22', '未知');
INSERT INTO `t_visit_log` VALUES (244, '127.0.0.1', 'cff8db20f90911f0a69fe38430a149fe', 0, 'web', '2026-01-24', '17:00', 'cff90230f90911f0a69fe38430a149fe', 'http://localhost:8100/testweb/index', '2026-01-24 17:48:17', '2026-01-24 17:48:17', '未知');
INSERT INTO `t_visit_log` VALUES (245, '127.0.0.1', 'cff8db20f90911f0a69fe38430a149fe', 0, 'web', '2026-01-24', '17:00', 'cff90230f90911f0a69fe38430a149fe', 'http://localhost:8100/testweb/index', '2026-01-24 17:49:59', '2026-01-24 17:49:59', '未知');
INSERT INTO `t_visit_log` VALUES (246, '127.0.0.1', '095cd430fa5811f091db07bcab5088ec', 0, 'web', '2026-01-26', '09:00', '972539b1f90411f08c8e5d89199bcd9f', 'http://localhost:8100/testweb/', '2026-01-26 09:40:43', '2026-01-26 09:40:43', '未知');
INSERT INTO `t_visit_log` VALUES (247, '127.0.0.1', '7cedf140fa5811f0afb9f30107b7a1d2', 0, 'web', '2026-01-26', '09:00', 'cff90230f90911f0a69fe38430a149fe', 'http://localhost:8100/testweb/index', '2026-01-26 09:43:58', '2026-01-26 09:43:58', '未知');
INSERT INTO `t_visit_log` VALUES (248, '127.0.0.1', '1ddcbf40fbf911f09aeba781875dd170', 10, 'web', '2026-01-28', '11:00', '1ddd0d60fbf911f09aeba781875dd170', 'http://localhost:8100/testweb/index', '2026-01-28 11:26:21', '2026-01-28 11:26:21', '未知');
INSERT INTO `t_visit_log` VALUES (249, '127.0.0.1', '1ddcbf40fbf911f09aeba781875dd170', 10, 'web', '2026-01-28', '11:00', '1ddd0d60fbf911f09aeba781875dd170', 'http://localhost:8100/testweb/', '2026-01-28 11:28:41', '2026-01-28 11:28:41', '未知');
INSERT INTO `t_visit_log` VALUES (250, '127.0.0.1', '1ddcbf40fbf911f09aeba781875dd170', 10, 'web', '2026-01-28', '11:00', '1ddd0d60fbf911f09aeba781875dd170', 'http://localhost:8100/testweb/index', '2026-01-28 11:28:41', '2026-01-28 11:28:41', '未知');
INSERT INTO `t_visit_log` VALUES (251, '127.0.0.1', '1ddcbf40fbf911f09aeba781875dd170', 10, 'web', '2026-01-28', '11:00', '1ddd0d60fbf911f09aeba781875dd170', 'http://localhost:8100/testweb/index', '2026-01-28 11:30:15', '2026-01-28 11:30:15', '未知');
INSERT INTO `t_visit_log` VALUES (252, '127.0.0.1', '1ddcbf40fbf911f09aeba781875dd170', 10, 'web', '2026-01-28', '11:00', '1ddd0d60fbf911f09aeba781875dd170', 'http://localhost:8100/testweb/learn', '2026-01-28 11:30:31', '2026-01-28 11:30:31', '未知');
INSERT INTO `t_visit_log` VALUES (253, '127.0.0.1', '1ddcbf40fbf911f09aeba781875dd170', 10, 'web', '2026-01-28', '11:00', '1ddd0d60fbf911f09aeba781875dd170', 'http://localhost:8100/testweb/exam', '2026-01-28 11:30:33', '2026-01-28 11:30:33', '未知');
INSERT INTO `t_visit_log` VALUES (254, '127.0.0.1', '1ddcbf40fbf911f09aeba781875dd170', 10, 'web', '2026-01-28', '11:00', '1ddd0d60fbf911f09aeba781875dd170', 'http://localhost:8100/testweb/article', '2026-01-28 11:30:34', '2026-01-28 11:30:34', '未知');

-- ----------------------------
-- Table structure for t_watch
-- ----------------------------
DROP TABLE IF EXISTS `t_watch`;
CREATE TABLE `t_watch`  (
                            `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                            `topic_id` bigint NOT NULL COMMENT '主题ID，如课程评论、知识评论的ID等',
                            `topic_type` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '主题类型，如课程评论、知识评论等',
                            `member_id` bigint NOT NULL COMMENT '用户id',
                            `ip_addr` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'ip地址',
                            `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                            PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '浏览' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_watch
-- ----------------------------

-- ----------------------------
-- Table structure for t_wrong_question
-- ----------------------------
DROP TABLE IF EXISTS `t_wrong_question`;
CREATE TABLE `t_wrong_question`  (
                                     `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键id',
                                     `question_id` bigint NOT NULL COMMENT '题目id',
                                     `title` varchar(2000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '题目',
                                     `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '题目描述',
                                     `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '类型',
                                     `difficulty` int NOT NULL COMMENT '难度',
                                     `score` decimal(14, 2) NOT NULL COMMENT '分数',
                                     `reference_answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '参考答案',
                                     `reference_answer_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '答案解析',
                                     `options` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '选项',
                                     `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
                                     `member_id` bigint NOT NULL COMMENT '会员id',
                                     `scored` decimal(14, 2) NOT NULL COMMENT '会员答题得分',
                                     `result` tinyint NOT NULL COMMENT '会员答题结果',
                                     `answer` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '会员答案',
                                     `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
                                     PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '会员错误题目' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of t_wrong_question
-- ----------------------------

SET FOREIGN_KEY_CHECKS = 1;
