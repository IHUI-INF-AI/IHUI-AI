# api-contract-deltas · 逐服务 API 差异表(初版骨架)

> **状态**:阶段 A 初版(目录骨架)
> **生成方式**:阶段 B 实施时,逐服务填充差异
> **填充规则**:每个端点至少 1 行,格式见下方模板

## 列定义

| 列 | 含义 |
|---|---|
| 服务 | edu Java 服务名 |
| edu Path | edu Gateway 转发路径(如 `/learn/list`) |
| edu Method | GET/POST/PUT/DELETE |
| edu Resp | edu 响应结构(简述,1 行)|
| IHUI-AI Path | IHUI-AI FastAPI 路径(如 `/api/v1/learn/courses`)|
| IHUI-AI Method | 同上 |
| IHUI-AI Resp | IHUI-AI 响应结构(简述)|
| 差异 | 行为差异点(字段/类型/默认值)|
| 状态 | ⬜ 未迁 / 🔄 迁移中 / ✅ 完成 |

## 端点差异表(模板,实际填充在阶段 B)

```yaml
ask-service:
  endpoints: []
  # edu 端点示例:
  # - edu_path: /ask/list
  #   edu_method: GET
  #   edu_resp: {code, msg, data: {questions: [{id, title, content, userId, createTime}]}}
  #   ihui_path: /api/v1/edu/ask/questions
  #   ihui_method: GET
  #   ihui_resp: {items: [...], total: int}
  #   diff: 分页字段名 code/page/size 与 edu 不一致;userId→user_id snake_case
  #   status: ⬜
```

## 23 服务端点清单(待填充)

> 此处只列服务,具体端点由阶段 B 各服务 PR 填充。

| # | 服务 | 预计端点数 | 状态 |
|---:|---|---:|:-:|
| 1 | gateway | - | 📦 冻结(网关模型取消) |
| 2 | auth | ~15 | ⬜ |
| 3 | member | ~10 | ⬜ |
| 4 | usercenter | ~12 | ⬜ |
| 5 | setting | ~8 | ⬜ |
| 6 | resource | ~20 | ⬜ |
| 7 | content | ~15 | ⬜ |
| 8 | learn | ~30 | ⬜ |
| 9 | live | ~10 | ⬜ |
| 10 | exam | ~25 | ⬜ |
| 11 | ask | ~8 | ⬜ |
| 12 | circle | ~15 | ⬜ |
| 13 | behavior | ~12 | ⬜ |
| 14 | pay | ~18 | ⬜ |
| 15 | point | ~8 | ⬜ |
| 16 | message | ~12 | ⬜ |
| 17 | notification | ~10 | ⬜ |
| 18 | oss | ~5 | ⬜ |
| 19 | search | ~6 | ⬜ |
| 20 | schedule | ~8 | ⬜ |
| 21 | visit-tracking | ~6 | ⬜ |
| 22 | order | ~15 | ⬜ |
| **合计** | | **~270** | |

## 阶段 B 端点抽取脚本(待开发)

`scripts/migration/extract_edu_endpoints.py` — 解析 Java Controller + OpenAPI 文档,自动生成此表初版。

## 命名差异速查

| edu 命名 | IHUI-AI 命名 | 说明 |
|---|---|---|
| `userId` | `user_id` | snake_case |
| `createTime` (毫秒) | `created_at` (datetime) | 时间格式与字段名 |
| `isDeleted` (0/1) | `is_deleted` (bool) | 类型转换 |
| `pageNum` + `pageSize` | `page` + `size` | 分页字段名 |
| 返回 `{code, msg, data}` | 返回 `{items, total}` 或 `BaseModel` | 包装格式 |
| `Long` id | `int`/`bigint` | 类型映射(Java 显式大数,Python int 自动) |