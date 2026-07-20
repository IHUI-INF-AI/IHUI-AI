# 智汇AI 公众号流水线（摸鱼绿主题）

> 一条命令把 Markdown 源稿 → 微信草稿箱 + DOCX + CSDN md 三件套
> 一次跑完 38 维度物理审计，**不让用户返工**。

---

## 0. TL;DR — 一行命令写一篇

```bash
cd wechat-article-system
python publish_pipeline.py --md articles/你的标题.md --title "你的标题" --digest "你的摘要" --cover output/images/sec1.jpg
```

跑完看输出：草稿自动进微信草稿箱，output/ 下产出 `.html`/`.docx`/`.md` 三件套。

---

## 1. 准备工作（首次）

### 1.1 装环境
- Python 3.13+ （项目用 `.workbuddy/binaries/python/versions/3.13.12/python.exe`）
- 依赖：`pip install python-docx Pillow`

### 1.2 配 .env
复制 `.env` 模板，填入两个公众号的 `APP_ID` / `APP_SECRET`：
```
A_B_APP_ID=wx...           # A 账号: AI智汇社
A_B_APP_SECRET=...
B_B_APP_ID=wx...           # B 账号: 智汇AI丨创始人丨李总
B_B_APP_SECRET=...
WECHAT_APP_ID=...          # 默认走 A 账号
WECHAT_APP_SECRET=...
```

### 1.3 跑审计（确认环境就绪）
```bash
python full_audit.py --title "你的标题"
```
全 ✅ 才能发。

---

## 2. 写一篇文章的 3 步

### Step 1：写源 md（放 `articles/`）
按 `skills/content-engine/SKILL.md` 的"Markdown 组件语法"写：
- `# 标题` / `## 01 章节名` / `### 小标题`（黄高亮）/ `## 智汇AI悄悄话`（编辑按语）
- `**加粗**` → 绿 / `==高亮==` → 黄 / `` `代码` `` → 标签
- `> 引用` / `:::oneliner 一句话 金句 :::` / `:::tip 标签 内容 :::` / `:::warning 警告 内容 :::`
- 数字间不空格（写"1000倍"别"1000 倍"）
- 配图用 `images/sec1.jpg` 相对路径

### Step 2：跑流水线
```bash
python publish_pipeline.py \
  --md articles/你的标题.md \
  --title "你的标题" \
  --digest "你的摘要" \
  --cover output/images/sec1.jpg
```

流水线自动做 6 步（**任何一步失败就 abort，不会出半成品**）：
1. 渲染摸鱼绿 HTML
2. 门禁A：22项自检（可读性/传播力/开头钩子/GEO/原创度/AI味/风险）
3. 门禁A+：事实核查 12 子检查（SKILL宣传，2026-07-12集成）
4. 门禁B：重点组件检查（绿加粗≥5 / 重点块≥3）
5. 构建 DOCX（v5 极致美化版）
6. 推送草稿箱：先按标题删旧 → 上传图到微信图床 → 创建新草稿 → 自动更新已发布记忆

### Step 3：目验草稿
去公众号后台「草稿箱」点开那篇文章看封面/章节/绿加粗/黄高亮/tip/警告/金句/编辑按语/点赞关注图是否显示正常。

---

## 3. 配套工具

| 工具 | 用途 | 用法 |
|------|------|------|
| `publish_pipeline.py` | 主入口（必跑这个） | 见 Step 2 |
| `full_audit.py` | 38 维度物理审计（**写完必跑**） | `python full_audit.py --title "..."` |
| `build_gpt56_sol.py` | DOCX 构建器（被流水线自动调） | 不单独跑 |
| `export_csdn_md.py` | CSDN md 导出（被流水线自动调） | 不单独跑 |
| `lib/moyu_green_renderer.py` | 摸鱼绿 HTML 渲染器 | 不单独跑 |
| `lib/validate.py` | 22项自检 | 不单独跑 |
| `lib/fact_check.py` | 事实核查 12 子检查 | 不单独跑 |
| `lib/wechat_publish.py` | 微信 API（access_token / 草稿 / 上传） | 不单独跑 |

**禁止跑的脚本**（已挪 `_archive/` 或删除）：
- `push_to_draft.py` — 早期版本，已废
- `gen_preview.py` — 浏览器预览生成器（流水线已自动）
- `push_moyu_green_draft.py` — 早期版本，已被 `publish_pipeline.py` 取代

---

## 4. 流水线做了的 vs 你要做的

| 维度 | 流水线做 | 你做 |
|------|---------|------|
| 渲染 HTML / DOCX / CSDN md | ✅ | |
| 22项门禁 + 12子事实核查 | ✅ | |
| 配图查重 / 主题查重 | ✅ | |
| 草稿幂等（同标题先删后建） | ✅ | |
| 推送到草稿箱 | ✅ | |
| 上传图到微信图床 | ✅ | |
| 更新已发布记忆 | ✅ | |
| **草稿后台真渲染效果** | ❌ 我做不到 | **✅ 你点开草稿箱目验** |
| **事实声明 C12 人工核实** | ⚠️ 1 条未 verified | **✅ 你确认信源** |

---

## 5. 常见问题

**Q1：流水线跑一半卡死？**
看最后一行 `❌ 阻断：xxx` 的提示，按提示修源 md 或参数。

**Q2：草稿里图片显示"加载失败"？**
配图没传到微信图床。流水线推 `❌ 上传失败: xxx` 时已阻断。检查 `output/images/` 是否有图、图大小是否合规（≤2MB）。

**Q3：想换 B 账号发？**
加 `--account B`。前提是 .env 配了 B_B_APP_ID/B_B_APP_SECRET。

**Q4：想跳过推送只出三件套？**
加 `--dry-run`。验证通过再正式推。

**Q5：full_audit 报告 FAIL 怎么修？**
看具体 FAIL 行，按"修复建议"提示改对应文件。常见修法：
- "B1 根目录脚本 ≠ 3" → 把废弃脚本挪 `_archive/`
- "D3 last_updated 超 24h" → 跑一次完整流水线会自动更新
- "E3 微信图床URL数 ≠ 4" → 检查配图是否齐全，缺图用 Wikimedia Commons 下载

---

## 6. 完整文件树

```
wechat-article-system/
├── publish_pipeline.py     # 主入口（必跑）
├── full_audit.py           # 38维度审计（写完必跑）
├── build_gpt56_sol.py      # DOCX v5 极致美化构建器
├── export_csdn_md.py       # CSDN md 导出
├── lib/
│   ├── moyu_green_renderer.py  # 摸鱼绿 HTML 渲染（13组件）
│   ├── validate.py             # 22项自检
│   ├── fact_check.py           # 事实核查 12子检查
│   ├── wechat_publish.py       # 微信 API（token/草稿/上传）
│   └── csdn_publish.py         # CSDN 备用（未集成）
├── articles/               # 源 md（写作源，不进 output）
├── output/                 # 三件套交付物 + images
├── assets/images/          # 文末点赞/关注图（流水线自动追加）
├── 已发布内容记忆.json     # 流水线自动更新（防配图/主题重复）
├── .env                    # 双账号凭证（git 忽略）
└── _archive/               # 废弃脚本归档（不要恢复）
```

---

## 7. 设计哲学

1. **一次写完多次复用**：源 md 进 `articles/`，流水线一气呵成出三件套
2. **门禁全过 ≠ 产物正确**：必须 `full_audit.py` 物理审计
3. **API 真验证不靠返回 True**：自动调 list_drafts / draft/get 验证草稿在不在
4. **故障快速阻断**：任何一步失败立即 sys.exit，不出半成品
5. **推送后自动更新记忆**：不靠人手动跑更新脚本

最后修订：2026-07-12（v6.18 修复 3 轮返工所有问题后）
