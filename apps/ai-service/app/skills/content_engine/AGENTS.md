# AGENTS.md — 公众号发布工作流最高权威
> 本文件与 `.workbuddy/memory/MEMORY.md` 互为镜像，规则冲突以本文件为准。
> 任何规则修订必须同步：脚本本体 → 本文件 → SKILL.md → MEMORY.md → 当日日志。

## 0. 项目边界（最高优先级·零容忍）
- 公众号目录 `wechat-article-system/` 只产出 `.md/.html/.docx`，绝不产生口播稿 `.txt`，绝不混入口播稿特征词（完播率/涨粉/咱就说 等）。
- 违反 = 直接 abort 整个流水线（full_audit C0 + publish_pipeline 入口守卫双拦截）。

### 0·A 机器级边界硬门禁（2026-07-20 硬化·最高优先级·不可绕过·已实测）
核心脚本 `.workbuddy/project_boundary.py` + 共享锁 `.workbuddy/SESSION_DOMAIN`（格式 `domain|ISO时间`，锁超 24h 自动过期强制重 init）。四层 fail-closed，不依赖 agent 记性：

1. **会话锁 init（强制仪式）**：处理任何请求前先
   `python .workbuddy/project_boundary.py init <wechat|koubo>` 写锁；未声明会话时跑任一口播稿/公众号流水线 → `sys.exit(3)` 拦截。
2. **工具自检**：9 个脚本启动即 `check_action(tool=本脚本)`，域不匹配直接 `sys.exit(3)`。覆盖 publish_pipeline/full_audit/export_csdn_md/build_gpt56_sol（公众号侧）+ koubo_validate/koubo_quality_gate/hot_topic_coverage_gate/archive_daily/project_hygiene（口播稿侧）。
3. **写前守卫 check_write**：所有交付物（.txt/.md/.html/.docx）真正落盘前 `check_write(path)`，拒绝跨域产物类型 + 跨项目目录写入；即使未声明会话也防御性拒绝把禁产物流进对方树。
4. **侦探兜底 scan_boundary.py**：会话结束跑 `python .workbuddy/scan_boundary.py`，发现 `.txt`/MMDD.txt/口播稿脚本落在公众号树、或 `.html`/`.docx`/公众号脚本落在口播稿树 → exit(1)，必须先清再交付。

**实测（2026-07-20 硬化后）**：边界逻辑 10/10 通过；koubo 锁下真实运行 `publish_pipeline.py` → exit 3 红条拦截；wechat 锁下真实运行 `koubo_validate.py` → exit 3 拦截；当前两树 `scan_boundary.py` → 0 残留 PASS。

**公众号会话 NEVER 清单**：①绝不跑 koubo_validate/koubo_quality_gate/hot_topic_coverage_gate/archive_daily/project_hygiene、绝不生成 `.txt`；②绝不 `cd` 进口播稿目录执行命令；③绝不因上游摘要/上下文误标而覆盖 SESSION_DOMAIN 锁；④任何交付动作前必 `init`，写前必 `check --path`，会话结束必 `scan_boundary.py`。

## 1. 配图铁律（2026-07-15 升级·最高优先级·必须物理遵守）
配图三条**同时满足，缺一不可**：

1. **真实图片**：Wikimedia Commons 真实摄影/历史照片，禁 AI 生成、禁 PIL 文本卡。
   - 真图检测：Shannon 熵 > 4.0 且 最常见颜色占比 < 70%。
2. **强相关**：每张配图必须与文章对应段落【强相关】，禁止跑题 filler。
   - 反例：讲"AI 删文件"配"历史信封"、讲"警告"配"交通指示牌"——均违规。
   - 执行：下载脚本 `download_real_imgs_v2.py` 按文件名 `SLOT_CONFIG` 指定"该图要表达什么"，只取相关性打分 ≥ 1 的候选，**绝不取第一个通过的**。
3. **无水印**：配图【绝对禁止水印】（商业图库水印、角落 logo、半透明文字水印）。
   - 执行：下载脚本 `has_watermark()` 检测角落实心色块 + 密集小字并剔除；full_audit C3+ 加无水印维度，疑似水印直接 FAIL。

4. **体积受限**（2026-07-16 用户强制·平台上传上限）：
   - 单图最长边 ≤ 1280px、文件 ≤ 500KB（quality 递减保真，真实内容/无水印不受损），确保最终 DOCX ≤ 15MB。
   - 根因：0715 文 `aipower_2`(5712×3813) / `aipower_4`(6040×3396) 原图未压缩，DOCX 撑到 32.5MB，微信等平台拒收。
   - 执行：下载脚本已硬编码 `MAX_EDGE=1280` + 单图≤500KB 体积递减；**手动下载也必须走 `download_real_imgs_v2.py`，禁止存 Wikimedia 原图巨幅文件**。

## 2. 发布工作流（唯一入口 publish_pipeline.py）
渲染 → 门禁A(validate 22项) → 门禁B(重点组件) → DOCX → 草稿箱推送 → CSDN DOCX(并行产出)。
- 门禁不过 `sys.exit(1)` 绝不推送。
- 真推成功后【绝不】自动删本地文件；只有用户明确说"今天文章发完了"才跑 `--only-cleanup`（删微信产物 html/docx【含 CSDN 专用 DOCX `_CSDN.docx`】+ 图片 + 源md归档）。CSDN docx 发布完随微信产物一起删，不单独保留。
- **output 只保留最终版·零容忍（2026-07-17 用户暴怒反馈·最高优先级·三道保险+C0.5 硬检查）**：
  - 渲染前自动清掉 output 里所有非本次标题的 html/docx 旧版（`publish_pipeline.py [0/6]` 步骤）
  - **三件套(html+docx+_CSDN.docx)全部生成后**再清一次（`[4.6/6]` 步骤，防 build_docx / build_csdn_docx 路径中间产物污染）
  - **物理审计前**再清一次（`[6.5/6]` 步骤，确保 audit 检查时 output 绝对干净）
  - `archive/`/`images/`/`_visual/` 目录保留不动
  - 公共函数：`_purge_old_outputs(safe_title, output_dir)` 在 `publish_pipeline.py` 顶部定义
  - **full_audit C0.5 硬检查（独立于 C1）**：所有 html/docx 必须以 `clean_title` 开头，**任何非本标题 html/docx 残留直接 FAIL**
  - **禁止** output 同时存在多版本（如最终版+第1版+第2版残留）—— 任何 output 目录出现"非当前标题"html/docx 都是规则违规
  - 完整 3 件 = `{safe_title}.html` + `{safe_title}.docx` + `{safe_title}_CSDN.docx`，多一件都算违规
- **CSDN 专用 DOCX 双交付（2026-07-16 用户强制·2026-07-17 加固·最高优先级）**：每篇文章除微信版外，**额外产出 `output/{标题}_CSDN.docx`**。CSDN 对营销内容审核极严，该版必须**删光所有营销内容 + SEO/GEO 优化内容 + 公众号调性**。有两套实现，优先级从高到低：
  1. **【优先】独立 CSDN 源 MD 直接渲染**：在 `articles/` 下放置 `{safe_title}_csdn.md`，用 `--csdn-md articles/{safe_title}_csdn.md` 显式指定，或让 pipeline 自动检测同名 `_csdn.md`。该文件**从零用纯技术报道口吻重写**，不基于公众号 MD 清洗。规则：全文无"我"、无"真相/揭秘/干货/爆款"、无"建议/关注/点赞/收藏/免费/省钱"诱导词、无"！"感叹号结尾句、无任何 CTA、结构改为技术盘点（`## 算力底座` / `## 开源模型` / `## 多模态` ...）。实现：`publish_pipeline.py [4.5/6]` 检测到 `_csdn.md` 存在时，直接调用 `build_gpt56_sol.build_docx` 渲染，**完全跳过 `clean_md_for_csdn` 清洗**。
  2. **【回退】clean_md_for_csdn 清洗**：当没有独立 CSDN MD 时，回退到 `lib/csdn_docx.py` 的 `clean_md_for_csdn` 正则清洗（BRAND_PHRASES / PERSONAL_NARRATIVE / CTA_PATTERNS / PARAGRAPH_REWRITE / 6.7 副作用修补）。**注意**：该回退方案在 2026-07-17 经过 6+ 轮迭代仍被 CSDN 平台判定为营销推广，证明正则修补对黑盒审核无效。今后新文章**必须写独立 CSDN MD**，不要依赖清洗。
  ③ 删**所有品牌植入**：智汇AI / 智汇AI教育 / 智汇AI社区 / 吉林省爱智汇 等
  ④ 删**个人经历/教学叙事**：我做了X年AI培训 / 我学员 / 我办AI教育 / 我沉默了/我看到 等
  ⑤ 删**公众号式互动引导**：点赞 / 收藏 / 关注我 / 后续我会 / 转发给朋友 / 评论区告诉我
  ⑥ 删 GEO 信源/信任话术：`公开信息显示` / `多方消息显示` / `以官方公告为准` / `独立评估` / `仅供参考`
  ⑦ **"## ▎给普通人的X个实操建议" 整段重写**为"## ▎技术落地建议"+ 三行短句（"用免费 AI 程序做 POC / AI 终端尝鲜 / 集成 AI 数字员工"）
  ⑧ **"如果你也是关注...创业者" 整段删**
  ⑨ 标题去营销后缀（省钱不踩坑 / 不踩坑 / 红利 / 最强 / 必看 / 早看早 / 赚到 / 暴涨 / 躺赚 等）
  ⑩ **清洗后自检**（lib/csdn_docx.py `build_csdn_docx` 内）：跑一次 `_check_platform_risk`，>0 立即打印警告（不阻断，但告知用户 CSDN 平台可能驳回）
  ⑪ 清洗副作用修补（6.7 段）：段头孤字冒号 / K3 数字间补空格（`K3**，**2.8` → `K3 2.8`，用 lambda 避免 backreference bug）/ 残留"我看到/我建议"等半截补回主语
  - 实现见 `lib/csdn_docx.py`，由管线 step 4.5 自动生成（默认开，`--no-csdn` 可关，`--csdn-title` 可自定义标题，`--csdn-md` 可指定独立源 MD）。**保留**：真实数据(2.5万亿等)、`::: tip/warning` 卡片、自然问答、技术性表述。CSDN DOCX 不受微信 22 项门禁约束（GEO/营销是微信刻意要的），是独立交付物。**CSDN 平台判定标准比本地 validate 脚本严格得多**——本地风险自检 0% PASS 不代表 CSDN 平台必过，仍可能因"整体调性偏公众号"被驳回，遇到驳回需进一步加强清洗。
- **full_audit C7 vs CSDN 双交付冲突（2026-07-17 修复）**：C7 硬检查"智汇AI悄悄话"必须 html+docx 都含，但 CSDN docx 设计本就剥离该段，会导致 C7 必 FAIL。**修复后逻辑**：当存在 `{title}_CSDN.docx` 时，豁免"智汇AI悄悄话"key；改为微信 docx 必含（若源 MD 含）、CSDN docx 必剥离；源 MD 主动未写该段时全豁免（作者按需省略）。
- **full_audit C1 vs CSDN 双交付冲突（2026-07-17 修复）**：C1 硬要求 output 交付物=2 件（html+docx），但 7/16 加 CSDN 双交付后变 3 件（html+docx+_CSDN.docx），导致 C1 必 FAIL。**修复后逻辑**：2 件（仅微信）或 3 件（含 CSDN 双交付）均合法。

## 2.5 显示纪律（用户 2026-07-20 强制·最高优先级·不可再犯）
- **每次修改/生成终稿后，必须在对话框内完整显示最终优化到极致的成品文案全文**，一字不漏。这是用户反复强调的硬要求（原话："agent.md 里没要求你必须在每次修改或者生成时必须在对话框内显示出来最新修优化到极致后的完整文案内容吗"）。
- **格式铁律（2026-07-20 用户怒斥后固化）**：对话框内展示必须用**正常渲染格式**——标题 `#`、加粗 `**`、引用 `>` 由聊天界面自然呈现，**严禁用 ```` ```markdown ```` 代码块包裹全文**。代码块会让用户读到 `#`/`>`/`![]()` 等源码标记、复制时带噪音，等同于没展示成稿。
- **图片处理**：源 MD 的 `![描述](images/osmodel_N.jpg)` 在对话框展示时改为文字标注【配图N：描述】，图片本身由 HTML 预览面板 / 文件卡片交付，不在聊天框内嵌破图。
- **违反即重做**：任何一次交付若把全文裹进代码块、或漏展示，必须立即按本格式重展示，不得辩称"已 present_files"或"已读文件"。

## 3. 其他铁律（详见 MEMORY.md）
满分铁律 / DOCX 美化(v6 emerald) / 物理审计 42 维 0 FAIL / 参考来源禁令 / 免责声明禁令 / 清理铁律 / 主动同步铁律。

## 4. 主动同步铁律
发现规则/脚本漏洞，必须一次性同步到：脚本本体 → 本文件(AGENTS.md) → SKILL.md → MEMORY.md → 当日日志，并验证通过。

## 5. 信源获取铁律（含 X 平台·硬要求）
- 取信源 = 对话内 `WebSearch`(国内+国外) + `aihot`(ai-models) + **X 平台官方账号（WebFetch 强制核查）**。X 是发布潮/版本号/官方定档的第一手信源，**漏查 = 事实风险**。
- X 信源注册表：`lib/x_sources.py`（共 43 个 handle，分类：国内/国际官方实验室、媒体、研究者、聚合泄露；`official=True` 为发布源、最高优先级）。写稿前 X 核查 = **全量覆盖**（用户 2026-07-16 确认）：
  - 标准动作 1（全量基准）：`python lib/x_sources.py --full` → 输出全量 43 个信源清单（官方必拉，媒体/研究者/聚合按优先级全扫）。
  - 标准动作 2（主题聚焦）：`python lib/x_sources.py "<主题>"` → 输出与主题强相关的账号（官方+高优先级优先，已取消 20 条截断）。
  - 对清单里 `official` 账号逐一 `WebFetch https://x.com/<handle>` 取最新推文 → 补 `WebSearch "site:x.com <主题>"`。
- **X 可达性铁律（已实测 2026-07-16，5 条路径全失败）**：X 真实推文**只能经 WebFetch 工具**获取；Python `urllib` 直连 x.com 仅返回 Cloudflare「Just a moment」挑战页、Jina Reader 代理 403、api.vxtwitter.com 仅回 profile 无推文、xcancel 403、nitter 空——管线内脚本无法自动抓 X。故 X 核查是写稿前由 agent 执行的**强制研究步骤**，**不建后台定时自动任务**（用户 2026-07-16 确认：暂不建，写稿前手动拉），注册表保证全量覆盖、不漏官方账号。
- 覆盖审计：`lib/x_sources.log_coverage(topic, checked_handles)` 写入 `.workbuddy/x_coverage/<date>.json`，供复盘「是否漏官方信源」。
- handle 须 `verified=True` 才可信；`verified=False` 首次用前须 WebFetch 确认存在。**已踩坑**：MiniMax 原 `@MiniMax__AI`（双下划线）404，正确为 `@MiniMax_AI`（单下划线）。
发现规则/脚本漏洞，必须一次性同步到：脚本本体 → 本文件(AGENTS.md) → SKILL.md → MEMORY.md → 当日日志，并验证通过。
