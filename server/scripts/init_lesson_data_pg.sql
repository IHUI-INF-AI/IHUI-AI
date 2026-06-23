-- =============================================
-- 课程测试数据初始化脚本 (PostgreSQL 兼容版)
-- 数据库: cloud_learning_content
-- 创建时间: 2026-02-02
-- 转换时间: 2026-06-22
-- 转换说明: 从 MySQL 语法转换为 PostgreSQL 兼容格式
--   - 删除 USE database 语句 (PostgreSQL 用 schema)
--   - 删除 SET NAMES utf8mb4 (PostgreSQL 不需要)
--   - NOW() 函数 PostgreSQL 原生兼容
--   - INSERT/DELETE/SELECT 语法为标准 SQL, 直接兼容
-- =============================================

-- PostgreSQL 使用 search_path 替代 MySQL 的 USE 语句
-- 如需指定 schema, 请取消注释并修改下方 schema 名称:
-- SET search_path TO cloud_learning_content, public;
SET search_path TO public;

-- =============================================
-- 1. 插入课程数据到 t_lesson 表
-- =============================================

-- 职业技能认证 (cid: 3032) 相关课程
INSERT INTO t_lesson (id, name, code, start_time, end_time, image, status, phrase, introduction, price, original_price, sort_weight, create_time, update_time) VALUES
(10001, 'Python全栈开发工程师认证', 'CERT-PY-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/python/400/300', 'published', 'Python从入门到精通，全面掌握后端开发技能', '本课程涵盖Python基础语法、Web开发框架Django/Flask、数据库操作、API开发等核心技能，助您成为全栈开发工程师。', 299.00, 599.00, 100, NOW(), NOW()),
(10002, 'Java高级开发工程师认证', 'CERT-JAVA-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/java/400/300', 'published', 'Java企业级开发核心技能认证', '深入学习Spring Boot、Spring Cloud微服务架构、分布式系统设计等企业级开发技能。', 399.00, 799.00, 99, NOW(), NOW()),
(10003, '前端工程师职业认证', 'CERT-FE-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/frontend/400/300', 'published', 'Vue3/React双框架精通', '掌握现代前端开发技术栈，包括Vue3、React18、TypeScript、Webpack/Vite等。', 349.00, 699.00, 98, NOW(), NOW()),

-- 区块链方向课程
(10004, '区块链开发工程师认证', 'CERT-BC-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/blockchain/400/300', 'published', '智能合约与DApp开发', '学习Solidity智能合约开发、以太坊生态系统、Web3.js等区块链核心技术。', 499.00, 999.00, 97, NOW(), NOW()),
(10005, '数字货币与加密技术', 'CERT-BC-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/crypto/400/300', 'published', '深入理解加密货币原理', '比特币、以太坊底层原理，密码学基础，共识机制详解。', 299.00, 599.00, 96, NOW(), NOW()),

-- 物联网方向课程
(10006, '物联网开发工程师认证', 'CERT-IOT-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/iot/400/300', 'published', 'IoT设备开发与云平台对接', '学习嵌入式开发、传感器技术、MQTT协议、物联网云平台等核心技能。', 399.00, 799.00, 95, NOW(), NOW()),
(10007, '智能家居系统开发', 'CERT-IOT-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/smarthome/400/300', 'published', '打造智能家居生态系统', '从零开始构建智能家居系统，包括硬件选型、软件开发、云端集成。', 349.00, 699.00, 94, NOW(), NOW()),

-- 大数据方向课程
(10008, '大数据工程师认证', 'CERT-BD-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/bigdata/400/300', 'published', 'Hadoop+Spark大数据处理', '掌握大数据处理技术栈，包括Hadoop、Spark、Flink、Kafka等。', 499.00, 999.00, 93, NOW(), NOW()),
(10009, '数据仓库与数据分析', 'CERT-BD-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/datawarehouse/400/300', 'published', '企业级数据仓库建设', '学习数据仓库设计、ETL开发、BI报表开发等数据分析技能。', 399.00, 799.00, 92, NOW(), NOW()),

-- 网络安全方向课程
(10010, '网络安全工程师认证', 'CERT-SEC-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/security/400/300', 'published', '渗透测试与安全防护', '学习Web安全、渗透测试、安全加固、应急响应等网络安全技能。', 499.00, 999.00, 91, NOW(), NOW()),
(10011, '信息安全管理师', 'CERT-SEC-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/infosec/400/300', 'published', 'ISO27001信息安全管理体系', '学习信息安全管理标准、风险评估、安全策略制定等。', 399.00, 799.00, 90, NOW(), NOW()),

-- 云计算方向课程
(10012, '云计算架构师认证', 'CERT-CLOUD-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/cloud/400/300', 'published', 'AWS/阿里云/腾讯云架构设计', '学习主流云平台架构设计、DevOps实践、容器化部署等。', 599.00, 1199.00, 89, NOW(), NOW()),
(10013, 'Kubernetes容器编排实战', 'CERT-CLOUD-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/k8s/400/300', 'published', 'K8s从入门到生产实践', 'Docker容器化、Kubernetes集群管理、微服务部署等。', 449.00, 899.00, 88, NOW(), NOW()),

-- 软件水平考试 (cid: 3031) 相关课程
(10014, '软考初级-程序员', 'RUANKAO-CJ-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ruankao1/400/300', 'published', '软考初级程序员备考指南', '全面覆盖软考初级程序员考试大纲，包含理论知识和实践技能。', 199.00, 399.00, 87, NOW(), NOW()),
(10015, '软考初级-网络管理员', 'RUANKAO-CJ-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ruankao2/400/300', 'published', '软考初级网络管理员通关', '网络基础、网络设备配置、网络安全管理等考点精讲。', 199.00, 399.00, 86, NOW(), NOW()),
(10016, '软考中级-软件设计师', 'RUANKAO-ZJ-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ruankao3/400/300', 'published', '软考中级软件设计师精讲', '数据结构、算法设计、软件工程、UML建模等核心考点。', 299.00, 599.00, 85, NOW(), NOW()),
(10017, '软考中级-网络工程师', 'RUANKAO-ZJ-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ruankao4/400/300', 'published', '软考中级网络工程师通关', '计算机网络原理、路由交换技术、网络安全等。', 299.00, 599.00, 84, NOW(), NOW()),
(10018, '软考高级-系统架构设计师', 'RUANKAO-GJ-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ruankao5/400/300', 'published', '软考高级架构师备考宝典', '系统架构设计、企业应用集成、中间件技术等高级考点。', 499.00, 999.00, 83, NOW(), NOW()),
(10019, '软考高级-信息系统项目管理师', 'RUANKAO-GJ-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ruankao6/400/300', 'published', '软考高级项目管理师通关', '项目管理知识体系、信息系统管理、案例分析等。', 499.00, 999.00, 82, NOW(), NOW()),

-- 计算机等级考试 (cid: 3030) 相关课程
(10020, 'NCRE一级MS Office', 'NCRE-1-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ncre1/400/300', 'published', '计算机一级MS Office全攻略', 'Word、Excel、PowerPoint操作技能及计算机基础知识。', 99.00, 199.00, 81, NOW(), NOW()),
(10021, 'NCRE二级Python', 'NCRE-2-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ncre2/400/300', 'published', '计算机二级Python程序设计', 'Python语法基础、数据处理、程序设计等考点精讲。', 149.00, 299.00, 80, NOW(), NOW()),
(10022, 'NCRE二级C语言', 'NCRE-2-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ncre3/400/300', 'published', '计算机二级C语言程序设计', 'C语言语法、指针、文件操作、算法设计等。', 149.00, 299.00, 79, NOW(), NOW()),
(10023, 'NCRE三级网络技术', 'NCRE-3-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ncre4/400/300', 'published', '计算机三级网络技术精讲', '网络原理、网络设备、网络安全、网络管理等。', 199.00, 399.00, 78, NOW(), NOW()),
(10024, 'NCRE三级数据库技术', 'NCRE-3-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ncre5/400/300', 'published', '计算机三级数据库技术精讲', '关系数据库、SQL语言、数据库设计、数据库管理等。', 199.00, 399.00, 77, NOW(), NOW()),
(10025, 'NCRE四级网络工程师', 'NCRE-4-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ncre6/400/300', 'published', '计算机四级网络工程师精讲', '高级网络技术、网络规划设计、网络安全等。', 249.00, 499.00, 76, NOW(), NOW()),
(10026, 'NCRE四级数据库工程师', 'NCRE-4-002', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ncre7/400/300', 'published', '计算机四级数据库工程师精讲', '数据库系统原理、数据库设计与管理、数据仓库等。', 249.00, 499.00, 75, NOW(), NOW()),

-- AI认证考试 (cid: 3029) 相关课程
(10027, 'Microsoft AI-900认证', 'AI-MS-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/msai/400/300', 'published', 'Azure AI基础认证备考', 'Azure认知服务、机器学习基础、AI解决方案等。', 299.00, 599.00, 74, NOW(), NOW()),
(10028, 'Google Cloud AI认证', 'AI-GCP-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/gcpai/400/300', 'published', 'Google Cloud机器学习工程师', 'TensorFlow、Vertex AI、MLOps等Google AI技术栈。', 399.00, 799.00, 73, NOW(), NOW()),
(10029, 'AWS机器学习专家认证', 'AI-AWS-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/awsai/400/300', 'published', 'AWS Machine Learning Specialty', 'SageMaker、深度学习、MLOps最佳实践等。', 449.00, 899.00, 72, NOW(), NOW()),
(10030, '腾讯云AI从业者认证', 'AI-TC-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/tcai/400/300', 'published', '腾讯云人工智能从业者', '腾讯云AI产品、智能语音、图像识别等。', 299.00, 599.00, 71, NOW(), NOW()),
(10031, '华为HCIA-AI认证', 'AI-HW-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/hwai/400/300', 'published', '华为AI初级工程师认证', 'MindSpore框架、华为AI开发平台等。', 349.00, 699.00, 70, NOW(), NOW()),
(10032, '阿里云ACA-AI认证', 'AI-ALI-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/aliai/400/300', 'published', '阿里云人工智能助理工程师', '阿里云AI产品、PAI平台、智能语音等。', 299.00, 599.00, 69, NOW(), NOW()),
(10033, '百度深度学习工程师认证', 'AI-BD-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/bdai/400/300', 'published', '百度AI认证深度学习方向', 'PaddlePaddle框架、飞桨平台、深度学习实战。', 349.00, 699.00, 68, NOW(), NOW()),
(10034, '工信部AI应用工程师', 'AI-MIIT-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/miitai/400/300', 'published', '工信部人工智能应用工程师', '国家级AI认证，涵盖机器学习、深度学习、AI应用等。', 499.00, 999.00, 67, NOW(), NOW()),

-- 更多通用课程
(10035, 'ChatGPT高效办公：职场AI应用全攻略', 'AI-GPT-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/chatgpt/400/300', 'published', '掌握AI办公神器，效率提升10倍', '学习ChatGPT在文档写作、数据分析、代码编程等场景的实战应用。', 99.00, 199.00, 66, NOW(), NOW()),
(10036, 'AI Agent智能体开发：AutoGPT原理与实战', 'AI-AGENT-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/agent/400/300', 'published', '从零构建自主AI Agent', '学习LangChain、AutoGPT、BabyAGI等AI Agent开发技术。', 399.00, 799.00, 65, NOW(), NOW()),
(10037, '大模型微调实战：LoRA/QLoRA技术详解', 'AI-LLM-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/lora/400/300', 'published', '低成本微调大语言模型', '掌握LoRA、QLoRA等高效微调技术，定制专属AI模型。', 449.00, 899.00, 64, NOW(), NOW()),
(10038, 'Stable Diffusion完全指南：从安装到商业应用', 'AI-SD-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/sd/400/300', 'published', 'AI绘画从入门到精通', '学习Stable Diffusion安装配置、提示词工程、ControlNet等技术。', 199.00, 399.00, 63, NOW(), NOW()),
(10039, 'AI绘画提示词大师班：从构图到风格', 'AI-PROMPT-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/prompt/400/300', 'published', '掌握AI绘画的核心技能', '系统学习Midjourney、DALL-E、SD等平台的提示词技巧。', 129.00, 259.00, 62, NOW(), NOW()),
(10040, 'Vue3从入门到精通实战教程', 'FE-VUE-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/vue3/400/300', 'published', 'Vue3 Composition API深度实战', '全面学习Vue3核心特性、Pinia状态管理、Vue Router等。', 299.00, 599.00, 61, NOW(), NOW()),
(10041, 'TypeScript高级编程指南', 'FE-TS-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/ts/400/300', 'published', '类型安全的JavaScript开发', '深入学习TypeScript类型系统、泛型、装饰器等高级特性。', 249.00, 499.00, 60, NOW(), NOW()),
(10042, 'Node.js后端开发实战', 'BE-NODE-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/nodejs/400/300', 'published', '全栈开发必备后端技能', '学习Express/Koa框架、数据库操作、API设计等后端开发技能。', 349.00, 699.00, 59, NOW(), NOW()),
(10043, 'React18新特性与最佳实践', 'FE-REACT-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/react/400/300', 'published', 'React Hooks深度解析', '学习React18并发特性、Suspense、Server Components等。', 299.00, 599.00, 58, NOW(), NOW()),
(10044, 'Docker与容器化部署实战', 'DEVOPS-DOCKER-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/docker/400/300', 'published', '容器化DevOps实践', '学习Docker容器化、镜像管理、Docker Compose编排等。', 249.00, 499.00, 57, NOW(), NOW()),
(10045, 'Git版本控制与团队协作', 'DEVOPS-GIT-001', '2026-01-01 00:00:00', '2027-12-31 23:59:59', 'https://picsum.photos/seed/git/400/300', 'published', '高效团队开发必备技能', '学习Git工作流、分支策略、代码审查、CI/CD集成等。', 149.00, 299.00, 56, NOW(), NOW());

-- =============================================
-- 2. 首先查询子分类ID（需要手动替换）
-- =============================================
-- 注意：以下SQL假设子分类已存在，需要先查询实际的子分类ID
-- 可以通过以下SQL查询子分类：
-- SELECT id, name, pid FROM t_category WHERE pid IN (3032, 3031, 3030, 3029);

-- =============================================
-- 3. 插入课程-分类关联数据
-- =============================================

-- 清理可能存在的旧关联数据
DELETE FROM t_lesson_category_relation WHERE lesson_id BETWEEN 10001 AND 10045;

-- 职业技能认证 (3032) - 软件开发方向
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time) VALUES
(10001, 3032, NOW(), NOW()),
(10002, 3032, NOW(), NOW()),
(10003, 3032, NOW(), NOW()),
(10040, 3032, NOW(), NOW()),
(10041, 3032, NOW(), NOW()),
(10042, 3032, NOW(), NOW()),
(10043, 3032, NOW(), NOW());

-- 查找软件开发方向的子分类ID并关联
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10001, id, NOW(), NOW() FROM t_category WHERE name = '软件开发方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10002, id, NOW(), NOW() FROM t_category WHERE name = '软件开发方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10003, id, NOW(), NOW() FROM t_category WHERE name = '软件开发方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10040, id, NOW(), NOW() FROM t_category WHERE name = '软件开发方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10041, id, NOW(), NOW() FROM t_category WHERE name = '软件开发方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10042, id, NOW(), NOW() FROM t_category WHERE name = '软件开发方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10043, id, NOW(), NOW() FROM t_category WHERE name = '软件开发方向' AND pid = 3032;

-- 区块链方向
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10004, id, NOW(), NOW() FROM t_category WHERE name = '区块链方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10005, id, NOW(), NOW() FROM t_category WHERE name = '区块链方向' AND pid = 3032;

-- 物联网方向
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10006, id, NOW(), NOW() FROM t_category WHERE name = '物联网方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10007, id, NOW(), NOW() FROM t_category WHERE name = '物联网方向' AND pid = 3032;

-- 大数据方向
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10008, id, NOW(), NOW() FROM t_category WHERE name = '大数据方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10009, id, NOW(), NOW() FROM t_category WHERE name = '大数据方向' AND pid = 3032;

-- 网络安全方向
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10010, id, NOW(), NOW() FROM t_category WHERE name = '网络安全方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10011, id, NOW(), NOW() FROM t_category WHERE name = '网络安全方向' AND pid = 3032;

-- 云计算方向
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10012, id, NOW(), NOW() FROM t_category WHERE name = '云计算方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10013, id, NOW(), NOW() FROM t_category WHERE name = '云计算方向' AND pid = 3032;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10044, id, NOW(), NOW() FROM t_category WHERE name = '云计算方向' AND pid = 3032;

-- 软件水平考试 (3031)
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time) VALUES
(10014, 3031, NOW(), NOW()),
(10015, 3031, NOW(), NOW()),
(10016, 3031, NOW(), NOW()),
(10017, 3031, NOW(), NOW()),
(10018, 3031, NOW(), NOW()),
(10019, 3031, NOW(), NOW());

-- 软考初级
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10014, id, NOW(), NOW() FROM t_category WHERE name = '软考初级' AND pid = 3031;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10015, id, NOW(), NOW() FROM t_category WHERE name = '软考初级' AND pid = 3031;

-- 软考中级
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10016, id, NOW(), NOW() FROM t_category WHERE name = '软考中级' AND pid = 3031;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10017, id, NOW(), NOW() FROM t_category WHERE name = '软考中级' AND pid = 3031;

-- 软考高级
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10018, id, NOW(), NOW() FROM t_category WHERE name = '软考高级' AND pid = 3031;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10019, id, NOW(), NOW() FROM t_category WHERE name = '软考高级' AND pid = 3031;

-- 计算机等级考试 (3030)
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time) VALUES
(10020, 3030, NOW(), NOW()),
(10021, 3030, NOW(), NOW()),
(10022, 3030, NOW(), NOW()),
(10023, 3030, NOW(), NOW()),
(10024, 3030, NOW(), NOW()),
(10025, 3030, NOW(), NOW()),
(10026, 3030, NOW(), NOW());

-- NCRE一级
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10020, id, NOW(), NOW() FROM t_category WHERE name = 'NCRE一级' AND pid = 3030;

-- NCRE二级
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10021, id, NOW(), NOW() FROM t_category WHERE name = 'NCRE二级' AND pid = 3030;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10022, id, NOW(), NOW() FROM t_category WHERE name = 'NCRE二级' AND pid = 3030;

-- NCRE三级
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10023, id, NOW(), NOW() FROM t_category WHERE name = 'NCRE三级' AND pid = 3030;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10024, id, NOW(), NOW() FROM t_category WHERE name = 'NCRE三级' AND pid = 3030;

-- NCRE四级
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10025, id, NOW(), NOW() FROM t_category WHERE name = 'NCRE四级' AND pid = 3030;
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10026, id, NOW(), NOW() FROM t_category WHERE name = 'NCRE四级' AND pid = 3030;

-- AI认证考试 (3029)
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time) VALUES
(10027, 3029, NOW(), NOW()),
(10028, 3029, NOW(), NOW()),
(10029, 3029, NOW(), NOW()),
(10030, 3029, NOW(), NOW()),
(10031, 3029, NOW(), NOW()),
(10032, 3029, NOW(), NOW()),
(10033, 3029, NOW(), NOW()),
(10034, 3029, NOW(), NOW()),
(10035, 3029, NOW(), NOW()),
(10036, 3029, NOW(), NOW()),
(10037, 3029, NOW(), NOW()),
(10038, 3029, NOW(), NOW()),
(10039, 3029, NOW(), NOW());

-- Microsoft AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10027, id, NOW(), NOW() FROM t_category WHERE name = 'Microsoft AI认证' AND pid = 3029;

-- Google AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10028, id, NOW(), NOW() FROM t_category WHERE name = 'Google AI认证' AND pid = 3029;

-- AWS AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10029, id, NOW(), NOW() FROM t_category WHERE name = 'AWS AI认证' AND pid = 3029;

-- 腾讯云AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10030, id, NOW(), NOW() FROM t_category WHERE name = '腾讯云AI认证' AND pid = 3029;

-- 华为AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10031, id, NOW(), NOW() FROM t_category WHERE name = '华为AI认证' AND pid = 3029;

-- 阿里云AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10032, id, NOW(), NOW() FROM t_category WHERE name = '阿里云AI认证' AND pid = 3029;

-- 百度AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10033, id, NOW(), NOW() FROM t_category WHERE name = '百度AI认证' AND pid = 3029;

-- 工信部AI认证
INSERT INTO t_lesson_category_relation (lesson_id, category_id, create_time, update_time)
SELECT 10034, id, NOW(), NOW() FROM t_category WHERE name = '工信部AI认证' AND pid = 3029;

-- =============================================
-- 4. 验证数据
-- =============================================
SELECT '课程数据统计' AS info, COUNT(*) AS count FROM t_lesson WHERE id BETWEEN 10001 AND 10045;
SELECT '课程分类关联统计' AS info, COUNT(*) AS count FROM t_lesson_category_relation WHERE lesson_id BETWEEN 10001 AND 10045;

-- 查看各分类下的课程数量
SELECT c.name AS category_name, COUNT(lcr.lesson_id) AS lesson_count
FROM t_category c
LEFT JOIN t_lesson_category_relation lcr ON c.id = lcr.category_id
WHERE c.id IN (3032, 3031, 3030, 3029) OR c.pid IN (3032, 3031, 3030, 3029)
GROUP BY c.id, c.name
ORDER BY c.pid, c.id;
