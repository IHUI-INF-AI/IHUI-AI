-- =============================================
-- 证书模板背景图更新脚本
-- 数据库: cloud_learning_content
-- 创建时间: 2026-02-03
-- 使用真实的高质量证书背景图片
-- 来源: H:\历史项目存档\edu client\scripts\update_certificate_template_images.sql
-- 归档时间: 2026-06-28（第 16 轮深度核查补齐）
-- =============================================

USE cloud_learning_content;

-- 设置字符集
SET NAMES utf8mb4;

-- AI绘画师认证证书 - 使用金色艺术纹理背景（适合艺术/创意类认证）
-- 来源: Unsplash - 金色艺术纹理
UPDATE t_certificate_template 
SET design = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1123&h=794&fit=crop&q=80'
WHERE name LIKE '%AI绘画%' AND (design IS NULL OR design = '');

-- 大模型应用认证证书 - 使用蓝色科技渐变背景（适合AI/技术类认证）
-- 来源: Unsplash - 蓝色科技抽象背景
UPDATE t_certificate_template 
SET design = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1123&h=794&fit=crop&q=80'
WHERE name LIKE '%大模型%' AND (design IS NULL OR design = '');

-- AI基础认证证书 - 使用蓝白简约渐变背景（适合基础/入门类认证）
-- 来源: Unsplash - 简约蓝色渐变
UPDATE t_certificate_template 
SET design = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1123&h=794&fit=crop&q=80'
WHERE name LIKE '%AI基础%' AND (design IS NULL OR design = '');

-- 如果还有其他证书模板没有背景图，使用通用的专业证书背景
-- 来源: Unsplash - 优雅蓝金渐变背景
UPDATE t_certificate_template 
SET design = 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1123&h=794&fit=crop&q=80'
WHERE design IS NULL OR design = '';

-- 验证更新结果
SELECT id, name, design, status FROM t_certificate_template;
