# 归档: 2026-06-26 新增端点待用户评审

封版阶段统一暂存的 4 个新端点文件，等待用户确认是否纳入版本。

## 背景

- 封版阶段严禁未确认新增功能合入主干
- 以下 4 个端点文件在之前的开发中产生，但未经用户明确批准
- 为避免 `import` 报错/路由冲突，已在 `server/app/api/v1/router.py` 中注释对应注册
- 原始文件物理移至本目录待评审

## 文件清单

| 文件 | 原位置 | 用途 | 状态 |
|------|--------|------|------|
| `category_link.py` | `server/app/api/v1/agents/category_link.py` | 代理/智能体分类关联 | 待评审 |
| `dictionary.py` | `server/app/api/v1/system/dictionary.py` | 系统字典查询 | 待评审 |
| `fund_info.py` | `server/app/api/v1/finance/fund_info.py` | 用户资金信息查询 | 待评审 |
| `legacy_supplement.py` | `server/app/api/v1/legacy_supplement.py` | 遗留补充接口 | 待评审 |
| `dictionary_full.txt` | (配套) 字典原始数据 | 字典内容 | 待评审 |

## 评审方式

请用户逐一确认每个文件：

- [ ] **纳入** — 用户同意后，从本目录移回 `server/app/api/v1/...` 原位置，并恢复 `router.py` 中对应注册
- [ ] **丢弃** — 用户拒绝后，直接 `rm` 删除本目录下对应文件，无需恢复 router

## 触发器

- 封版原则：未经用户明确同意，不向主干合入任何新功能
- 修复/优化可以合入，新增端点（即便后端代码已完成）必须用户明确批准
