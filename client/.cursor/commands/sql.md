# 生成 SQL 语句

根据需求生成 SQL 查询语句。

## 指令

请根据以下需求生成 SQL：

{{selection}}

### SQL 规范

1. **关键字大写**
   - SELECT, FROM, WHERE, JOIN 等

2. **格式化**
```sql
SELECT 
    u.id,
    u.name,
    u.email,
    COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
    AND u.created_at > '2024-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 0
ORDER BY order_count DESC
LIMIT 10 OFFSET 0;
```

3. **安全性**
   - 使用参数化查询
   - 避免 SQL 注入

### 查询类型

- **CRUD**: SELECT, INSERT, UPDATE, DELETE
- **聚合**: COUNT, SUM, AVG, MAX, MIN
- **连接**: INNER JOIN, LEFT JOIN, RIGHT JOIN
- **子查询**: EXISTS, IN, ANY
- **窗口函数**: ROW_NUMBER, RANK, OVER

### 输出

1. 完整的 SQL 语句
2. 参数化版本（如需要）
3. 执行说明
4. 性能优化建议（如适用）
