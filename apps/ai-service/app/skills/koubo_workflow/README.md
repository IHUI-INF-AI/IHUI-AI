# 口播稿目录结构说明

> **权威参考文件**：`AGENTS.md`（所有规则/铁律/约束的最高权威来源）
> 整理时间：2026-07-14（目录重构）

## 目录总览

```
koubo/
├── AGENTS.md              ← 最高权威参考（所有规则汇总）
├── README.md              ← 本文件
├── Output/                ← 当日输出的口播稿 MMDD.txt（如 0714.txt），唯一权威定稿
├── 历史稿/                ← 历史口播稿汇编（历史口播稿汇编.txt 单文件，按 # MMDD 分段，archive_daily.py 每日追加）
├── 工具脚本/              ← 全部门禁/工具脚本
│   ├── koubo_validate.py          ← 全量验证脚本（18项逐篇+跨篇去重+栏目+安全）
│   ├── koubo_quality_gate.py      ← 朗读质量门禁（断句/语病/自然度）
│   ├── koubo_live_check.py        ← 写作中实时自查
│   ├── koubo_terms.py             ← 术语/歧义压缩统一词表（权威源）
│   ├── pre_publish_check.py       ← 发布前集成门禁（4合1）
│   ├── project_hygiene.py         ← 项目卫生检查（双项目目录白名单）
│   ├── project_preflight.py       ← 写文件前 pre-flight 自检
│   ├── scan_ambig.py / scan_canonical.py ← 歧义压缩/跨稿词表扫描
│   ├── archive_daily.py           ← 每日自动存档脚本
│   └── pre-commit.template        ← git hook 模板
├── 素材库/                ← 素材与记忆
│   ├── 素材库.md                   ← 金句库/类比库/数据弹药/开头钩子库/转折表达库
│   ├── 真实素材库.md               ← 创始人真实经历锚定
│   ├── 公开真实案例库.md           ← 公开可溯源案例
│   ├── 选题存档.md                 ← 历史选题记录，用于查重
│   └── 已发布内容记忆.json          ← 已发布记录（含 image_registry）
└── 调试备份/              ← 一次性调试产物（歧义排查等），可删
```

## 核心文件说明

| 文件 | 状态 | 用途 |
|------|------|------|
| **AGENTS.md** | ✅ 活跃 | 最高权威参考：铁律/禁令/技术约束/风格/偏好/教训 |
| **Output/MMDD.txt** | ✅ 活跃 | 当天交付的口播稿正文（唯一权威定稿） |
| 素材库/素材库.md | ✅ 活跃 | 金句库/类比库/数据弹药/案例库/开头钩子库/转折表达库 |
| 素材库/选题存档.md | ✅ 活跃 | 每次完稿后追加记录，用于选题查重 |
| 素材库/已发布内容记忆.json | ✅ 活跃 | 已发布元数据+image_registry |
| 工具脚本/koubo_validate.py | ✅ 活跃 | 全量验证：`python 工具脚本/koubo_validate.py Output/MMDD.txt` |
| 工具脚本/koubo_quality_gate.py | ✅ 活跃 | 朗读质量门禁：`python 工具脚本/koubo_quality_gate.py Output/MMDD.txt` |
| 工具脚本/koubo_live_check.py | ✅ 活跃 | 实时自查：`python 工具脚本/koubo_live_check.py --all Output/MMDD.txt` |
| 工具脚本/pre_publish_check.py | ✅ 活跃 | 发布前集成门禁：`python 工具脚本/pre_publish_check.py --all` |
| 工具脚本/project_hygiene.py | ✅ 活跃 | 项目卫生检查：`python 工具脚本/project_hygiene.py` |
| 工具脚本/archive_daily.py | ✅ 活跃 | 每日自动存档：`python 工具脚本/archive_daily.py` |

## 旧项目归档（已整合迁出）

> 2026-07-14 已整合迁移至公众号项目 `wechat-article-system`：账号定位记忆.md / 发布日志.md / 运营文档×3 / 改版方案.md / json_reference_data.json → `_archive/`；交付/*.txt → `output/archive/`；skills/aihot-skill → 用户级 skills；skills/koubo-workflow → 口播稿项目 `.workbuddy/skills/`。口播稿目录不再保留任何跨项目杂物。

## 工作流Skill

详细Phase执行手册见 `~/.qoderworkcn/skills/koubo-daily/SKILL.md`（koubo-daily skill），与AGENTS.md配合使用。
