# 直播分类数据更新指南

## 概述
本指南用于更新 http://localhost:8100/live 页面的分类数据，包含完整的AI行业一级分类和二级分类。

## 分类数据统计
- **一级分类**: 15个
- **二级分类**: 82个
- **总计**: 97个分类

## 分类体系

### AI核心领域（5个一级分类）
| ID | 分类名称 | 二级分类数量 |
|---|---|---|
| 1 | 大语言模型(LLM) | 7个 |
| 2 | AI绘画与视觉 | 7个 |
| 3 | AI音视频 | 6个 |
| 4 | AI编程开发 | 6个 |
| 5 | AI基础技术 | 6个 |

### 行业AI+（10个一级分类）
| ID | 分类名称 | 二级分类数量 |
|---|---|---|
| 6 | AI+医疗健康 | 5个 |
| 7 | AI+金融科技 | 5个 |
| 8 | AI+智能制造 | 5个 |
| 9 | AI+零售电商 | 5个 |
| 10 | AI+教育培训 | 5个 |
| 11 | AI+法律政务 | 5个 |
| 12 | AI+农业科技 | 5个 |
| 13 | AI+交通出行 | 5个 |
| 14 | AI+能源环保 | 5个 |
| 15 | AI+文化创意 | 5个 |

## 执行步骤

### 方式一：使用数据库管理工具（推荐）

1. 打开 Navicat / DataGrip / MySQL Workbench 等数据库工具
2. 连接到数据库：
   - 主机：`47.94.40.108`
   - 端口：`3306`
   - 用户名：`Raindrop_L`
   - 密码：`Raindrop_L250604`
   - 数据库：`cloud_learning_content`
3. 打开 `update_live_categories.sql` 文件
4. 执行整个SQL脚本

### 方式二：使用命令行

```bash
# Windows (需要安装MySQL客户端)
mysql -h 47.94.40.108 -P 3306 -u Raindrop_L -pRaindrop_L250604 cloud_learning_content < update_live_categories.sql

# Linux/Mac
mysql -h 47.94.40.108 -P 3306 -u Raindrop_L -p'Raindrop_L250604' cloud_learning_content < update_live_categories.sql
```

### 方式三：重新初始化数据库

如果是全新部署，可以直接执行主数据库初始化脚本：
```bash
mysql -h 47.94.40.108 -P 3306 -u Raindrop_L -pRaindrop_L250604 < g:\edu\service\service\init_database.sql
```

## 执行后验证

执行以下SQL验证数据是否正确导入：

```sql
-- 检查一级分类数量（应该是15个）
SELECT COUNT(*) AS '一级分类数量' FROM t_category WHERE level = 1 AND type = 'live';

-- 检查二级分类数量（应该是82个）
SELECT COUNT(*) AS '二级分类数量' FROM t_category WHERE level = 2 AND type = 'live';

-- 查看一级分类列表
SELECT id, name, sort_order FROM t_category WHERE level = 1 AND type = 'live' ORDER BY sort_order;

-- 查看分类关系
SELECT COUNT(*) AS '分类关系数量' FROM t_category_relation;
```

## 重启服务

数据更新后需要重启live服务：

```bash
# 如果使用Docker
docker restart ihui-ai-edu-live-service

# 如果本地运行
# 在IDE中重启 LiveServiceApplication
```

## 更新的文件列表

1. `g:\edu\service\service\init_database.sql` - 主数据库初始化脚本
2. `g:\edu\service\service\ihui-ai-edu-live-service\src\main\java\com\yjs\cloud\learning\live\biz\category\entity\Category.java` - 添加type字段
3. `g:\edu\scripts\update_live_categories.sql` - 独立更新脚本

## 常见问题

### Q: 执行后分类没有显示？
A: 检查以下几点：
1. 确认SQL执行成功，没有报错
2. 重启live服务
3. 清除浏览器缓存后刷新页面

### Q: 如何删除现有分类重新导入？
A: 在执行脚本前，取消注释以下行：
```sql
TRUNCATE TABLE t_category;
TRUNCATE TABLE t_category_relation;
```

### Q: 如何添加新的分类？
A: 在admin后台 (http://localhost:8000) 的直播分类管理中添加，或手动INSERT数据库。
