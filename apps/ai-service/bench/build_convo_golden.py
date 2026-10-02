#!/usr/bin/env python
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D127 对话黄金任务集生成器:产出 30 个任务(tasks_convo_golden.json)+ 两态 fixtures(初始态 / 参考答案态)。

题集与 fixtures 均以数据文件入库,本文件是它们的**可重建源**;改题集请改这里再跑
`python bench/build_convo_golden.py`,不要手改 fixtures(两边会漂开)。
判分标准与执行器都在 run_bench 里,本文件不新增执行路径(D127 明令禁两套执行器)。
"""
# 零新执行器:判分全部走 bench.run_bench 既有 _CHECKERS(结构化断言)。
# checks 显式声明 (产物路径, 子串),不做输入文件自动定位。
import json
import shutil
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

BENCH = Path(__file__).resolve().parent
GF = BENCH / "fixtures_golden"
ROOT = BENCH.parents[2]

QA_TOOLS = ["read_file", "list_files", "write_file"]
ALL_TOOLS = ["read_file", "list_files", "write_file", "file_edit", "run_command"]

Check = dict[str, Any]
Task = dict[str, Any]

def C(path: str, sub: str) -> Check:
    return {"type": "file_contains", "params": {"path": path, "substring": sub}}

def NC(path: str, sub: str) -> Check:
    return {"type": "file_not_contains", "params": {"path": path, "substring": sub}}

tasks: list[Task] = []
answers: dict[str, dict[str, str]] = {}

def add(
    tid: str,
    title: str,
    cat: str,
    instr: str,
    checks: list[Check],
    files: dict[str, str],
    tools: list[str],
    max_iter: int = 8,
) -> None:
    tasks.append({
        "id": f"convo-{tid}", "title": title, "category": cat,
        "fixture": f"fixture_convo-{tid}", "instructions": instr,
        "max_iterations": max_iter, "allowed_tools": tools, "checks": checks,
    })
    answers[f"convo-{tid}"] = files

# ── 纯问答 ×6(convo-qa)────────────────────────────────────────────────────
add("qa-config-recall", "问答:配置键与端口跨文档回答", "convo-qa",
    "阅读仓库内 docs.md 与 settings.md,把以下三问的答案逐条写入 answer.md:1) 数据库连接池上限;2) Redis 端口;3) 两项配置各在哪个文件定义。格式:每问一行,以『答:』开头。",
    [C("answer.md", "答: 数据库连接池上限 47"), C("answer.md", "答: Redis 端口 8811"), C("answer.md", "docs.md")],
    {"docs.md": "部署配置说明(第 1 版)。\n\n- DB_POOL_MAX = 47(数据库连接池上限,超出即排队)\n- 会话超时 1800 秒\n",
     "settings.md": "运行时开关说明。\n\n- Redis 端口 8811,地址 127.0.0.1\n- 日志级别 info\n",
     "answer.md": "答: 数据库连接池上限 47(DB_POOL_MAX,定义在 docs.md)\n答: Redis 端口 8811(定义在 settings.md)\n答: docs.md 与 settings.md\n"}, QA_TOOLS)

add("qa-version-matrix", "问答:版本兼容矩阵要点", "convo-qa",
    "阅读 compatibility.md,把兼容矩阵的三个关键结论写入 answer.md:1) 支持的最高 Node 版本;2) 最低 Python 版本;3) 已废弃的传输通道。每条以『结论:』开头。",
    [C("answer.md", "结论: 最高 Node 版本 22"), C("answer.md", "结论: 最低 Python 版本 3.10"), C("answer.md", "结论: 已废弃的传输通道是 WebSocket")],
    {"compatibility.md": "兼容性矩阵:\n\n| 组件 | 最高 | 最低 |\n| Node | 22.x | 18.x |\n| Python | 3.12 | 3.10 |\n\n传输通道:HTTP/2 为当前默认;WebSocket 通道已于上一版本废弃。\n",
     "answer.md": "结论: 最高 Node 版本 22.x\n结论: 最低 Python 版本 3.10\n结论: 已废弃的传输通道是 WebSocket\n"}, QA_TOOLS)

add("qa-error-code", "问答:错误码语义查询", "convo-qa",
    "阅读 errors.csv,回答:1) 4021 的含义;2) 5003 的修复建议;3) 哪个错误码代表限流。写入 answer.md,每条以『错误码』开头。",
    [C("answer.md", "错误码 4021:会话已失效"), C("answer.md", "错误码 5003:修复建议是重启 ai-service"), C("answer.md", "错误码 4290")],
    {"errors.csv": "code,meaning,fix\n4021,会话已失效,重新登录\n4290,请求被限流,降低频率后重试\n5003,模型网关超时,重启 ai-service\n",
     "answer.md": "错误码 4021:会话已失效(需重新登录)\n错误码 5003:修复建议是重启 ai-service\n错误码 4290 代表限流\n"}, QA_TOOLS)

add("qa-arch-decision", "问答:架构决策原因复盘", "convo-qa",
    "阅读 adr-007.md,把该决策的三要素写入 answer.md:1) 选择的方案;2) 被否决的方案;3) 决策理由关键词。每条以『ADR』开头。",
    [C("answer.md", "ADR: 选择分库分表"), C("answer.md", "ADR: 否决了读写分离"), C("answer.md", "ADR: 理由是单表容量")],
    {"adr-007.md": "# ADR-007 订单存储\n\n## 决策\n选择分库分表(按用户哈希,16 库)。\n\n## 否决项\n读写分离:单表容量瓶颈未解决。\n单库冷热分层:维护成本高。\n\n## 理由\n单表容量预计 12 个月破 2TB,分库可线性扩容。\n",
     "answer.md": "ADR: 选择分库分表(按用户哈希 16 库)\nADR: 否决了读写分离与单库冷热分层\nADR: 理由是单表容量 12 个月内破 2TB,分库可线性扩容\n"}, QA_TOOLS)

add("qa-migration-order", "问答:迁移顺序与回滚点", "convo-qa",
    "阅读 migrate-plan.md,回答:1) 第一步迁移什么;2) 最后一步迁移什么;3) 回滚点保存在哪。写入 answer.md,每条以『迁移』开头。",
    [C("answer.md", "迁移: 第一步迁移 users 表"), C("answer.md", "迁移: 最后迁移 audit_log"), C("answer.md", "迁移: 回滚点保存在 tag")],
    {"migrate-plan.md": "迁移计划:\n1. 先迁移 users 表(依赖最少)\n2. 迁移 orders / items\n3. 最后迁移 audit_log(量最大,窗口最长)\n\n每步完成打 tag 作为回滚点,tag 命名 migrate-step-N。\n",
     "answer.md": "迁移: 第一步迁移 users 表\n迁移: 最后迁移 audit_log\n迁移: 回滚点保存在 tag(migrate-step-N)\n"}, QA_TOOLS)

add("qa-quota-policy", "问答:配额策略边界条件", "convo-qa",
    "阅读 quota-policy.md,回答三问写入 answer.md:1) 免费层每日配额;2) 超额后行为;3) 重置时刻。每条以『配额』开头。",
    [C("answer.md", "配额: 免费层每日 50 次"), C("answer.md", "配额: 超额后降级"), C("answer.md", "每日 00:00(UTC+8)")],
    {"quota-policy.md": "配额策略:\n\n- 免费层:每日 50 次调用\n- 超额后:降级到低速通道(非拒绝)\n- 重置:每日 00:00(UTC+8)\n",
     "answer.md": "配额: 免费层每日 50 次\n配额: 超额后降级到低速通道\n配额: 每日 00:00(UTC+8)重置\n"}, QA_TOOLS)

# ── 工具编排 ×6(convo-tools)──────────────────────────────────────────────
add("tools-report-gen", "编排:读数据生成汇总报告", "convo-tools",
    "读取 sources/ 下所有 .json 文件,统计条目数,生成 summary.json,字段:total_files、total_items、generated_by(值固定为 agent)。用工具逐个读文件,不得凭空编数。",
    [C("summary.json", '"total_files": 2'), C("summary.json", '"total_items": 3'), C("summary.json", '"generated_by": "agent"')],
    {"sources/a.json": '[{"id":1},{"id":2}]\n', "sources/b.json": '[{"id":3}]\n',
     "summary.json": '{"total_files": 2, "total_items": 3, "generated_by": "agent"}\n'}, ALL_TOOLS)

add("tools-refactor-split", "编排:批量重命名+清单", "convo-tools",
    "把 notes/ 下每个 .txt 文件复制为 .md 后缀的同名文件(内容原样),并生成 manifest.txt,每行一条『原文件名 -> 新文件名』。",
    [C("manifest.txt", "notes/a.txt -> notes/a.md"), C("manifest.txt", "notes/b.txt -> notes/b.md"), C("notes/b.md", "beta")],
    {"notes/a.txt": "alpha\n", "notes/b.txt": "beta\n", "notes/a.md": "alpha\n", "notes/b.md": "beta\n",
     "manifest.txt": "notes/a.txt -> notes/a.md\nnotes/b.txt -> notes/b.md\n"}, ALL_TOOLS)

add("tools-env-audit", "编排:环境变量审计表", "convo-tools",
    "读取 env.sample,把每个 KEY=VALUE 行解析出来,生成 audit.md:每行『KEY 设为 VALUE』,并统计总行数写在末行『共 N 项』(N 为实际条数)。",
    [C("audit.md", "PORT 设为 8811"), C("audit.md", "LOG_LEVEL 设为 info"), C("audit.md", "共 3 项")],
    {"env.sample": "PORT=8811\nLOG_LEVEL=info\nFEATURE_FLAG=true\n",
     "audit.md": "PORT 设为 8811\nLOG_LEVEL 设为 info\nFEATURE_FLAG 设为 true\n共 3 项\n"}, ALL_TOOLS)

add("tools-test-scaffold", "编排:为纯函数生成测试骨架", "convo-tools",
    "阅读 mathops.py 中 add/mul 两个函数的签名,生成 test_mathops_skeleton.py:为每个函数写一个测试函数(test_add、test_mul),函数体只需一行 assert 调用。",
    [C("test_mathops_skeleton.py", "def test_add():"), C("test_mathops_skeleton.py", "def test_mul():"), C("test_mathops_skeleton.py", "assert add(1, 2) == 3")],
    {"mathops.py": "def add(a, b):\n    return a + b\n\ndef mul(a, b):\n    return a * b\n",
     "test_mathops_skeleton.py": "def test_add():\n    assert add(1, 2) == 3\n\ndef test_mul():\n    assert mul(2, 3) == 6\n"}, ALL_TOOLS)

add("tools-changelog-merge", "编排:合并变更日志", "convo-tools",
    "读取 changelog_v1.md 与 changelog_v2.md,合并生成 CHANGELOG.md:先 v1 段落(以『## v1』为标题),再 v2 段落(以『## v2』为标题),原文照录。",
    [C("CHANGELOG.md", "## v1"), C("CHANGELOG.md", "## v2"), C("CHANGELOG.md", "- 初始发布"), C("CHANGELOG.md", "- 修复登录")],
    {"changelog_v1.md": "- 初始发布\n", "changelog_v2.md": "- 修复登录\n",
     "CHANGELOG.md": "## v1\n\n- 初始发布\n\n## v2\n\n- 修复登录\n"}, ALL_TOOLS)

add("tools-deps-extract", "编排:依赖清单提取", "convo-tools",
    "读取 requirements.txt,把每个非注释依赖行写成 deps.md 的一行『- 包名』,末行写『合计 N 个』(N 为实际数)。",
    [C("deps.md", "- fastapi"), C("deps.md", "- sqlalchemy"), C("deps.md", "合计 3 个")],
    {"requirements.txt": "# core\nfastapi==0.110\nsqlalchemy>=2.0\n# dev\npytest\n",
     "deps.md": "- fastapi\n- sqlalchemy\n- pytest\n合计 3 个\n"}, ALL_TOOLS)

# ── 长任务 ×6(convo-longtask)─────────────────────────────────────────────
add("long-plan-execute", "长任务:规划后执行", "convo-longtask",
    "本任务分两步:1) 写 plan.md,列出你要执行的两个子步骤(读取 spec.md、生成 result.md);2) 按 plan 执行,生成 result.md,内容为 spec.md 里目标值的原样抄录。plan 与 result 必须先后产出。",
    [C("plan.md", "步骤一:读取 spec.md"), C("result.md", "ORION-77")],
    {"spec.md": "目标值:ORION-77\n", "plan.md": "步骤一:读取 spec.md\n步骤二:生成 result.md\n", "result.md": "ORION-77\n"}, ALL_TOOLS, 12)

add("long-multi-round-calc", "长任务:三轮累计统计", "convo-longtask",
    "分三轮读取 r1.txt/r2.txt/r3.txt,每轮把读到的数字追加到 totals.md 一行(『第 N 轮: X』),最后写『总计: Y』(Y 为三轮之和)。",
    [C("totals.md", "第 1 轮: 11"), C("totals.md", "第 3 轮: 33"), C("totals.md", "总计: 66")],
    {"r1.txt": "11\n", "r2.txt": "22\n", "r3.txt": "33\n", "totals.md": "第 1 轮: 11\n第 2 轮: 22\n第 3 轮: 33\n总计: 66\n"}, ALL_TOOLS, 12)

add("long-state-machine", "长任务:状态机多步推演", "convo-longtask",
    "读取 fsm.md 了解状态机,从初始状态 idle 出发按事件序列 a,b,c,d 手动推演 4 步,把每步后的状态写进 trace.md(每行『step N: 状态名』)。",
    [C("trace.md", "step 1: running"), C("trace.md", "step 2: paused"), C("trace.md", "step 4: done")],
    {"fsm.md": "状态机:idle --a--> running --b--> paused --c--> running --d--> done\n",
     "trace.md": "step 1: running\nstep 2: paused\nstep 3: running\nstep 4: done\n"}, ALL_TOOLS, 12)

add("long-doc-chain", "长任务:文档链条改写", "convo-longtask",
    "依次读 base.md 与 patch.md,产出 final.md:先抄 base.md 全文,再把 patch.md 的新增段(以『新增:』开头的行)追加在末尾。",
    [C("final.md", "# 基础文档"), C("final.md", "新增: 附录 A")],
    {"base.md": "# 基础文档\n第一段。\n", "patch.md": "新增: 附录 A\n", "final.md": "# 基础文档\n第一段。\n新增: 附录 A\n"}, ALL_TOOLS, 12)

add("long-iterative-refine", "长任务:两轮迭代精化", "convo-longtask",
    "读取 brief.md 拿到要写的主题,第一轮把两行草稿写进 draft.md;第二轮读回 draft.md 并生成 final_report.md,首行写『基于草稿精化』,并包含你草稿第一行的前四个字符。",
    [C("final_report.md", "基于草稿精化"), C("final_report.md", "季度")],
    {"brief.md": "主题:季度复盘。第一行草稿请以『季度』开头。\n", "draft.md": "季度复盘草稿一\n季度复盘草稿二\n", "final_report.md": "基于草稿精化\n包含: 季度\n"}, ALL_TOOLS, 12)

add("long-checkpoint-restore", "长任务:四步可回滚流程", "convo-longtask",
    "读取 steps.json(四步流程),按顺序执行:为每步生成 out_N.md(内容为该步的 action 文本),四步全部完成后再生成 done.md,内容为『四步全部完成』。",
    [C("out_2.md", "verify"), C("out_4.md", "publish"), C("done.md", "四步全部完成")],
    {"steps.json": '[{"step":1,"action":"collect"},{"step":2,"action":"verify"},{"step":3,"action":"transform"},{"step":4,"action":"publish"}]\n',
     "out_1.md": "collect\n", "out_2.md": "verify\n", "out_3.md": "transform\n", "out_4.md": "publish\n", "done.md": "四步全部完成\n"}, ALL_TOOLS, 12)

# ── 多模态 ×6(convo-multimodal)───────────────────────────────────────────
add("mm-alt-catalog", "多模态:图片清单与 alt 文本", "convo-multimodal",
    "阅读 assets.md(记录了 4 张图片的文件名与描述),生成 catalog.json:数组,每项含 src(文件名)与 alt(用描述原文)。四张图全部收录,顺序照原文。",
    [C("catalog.json", "cover.png"), C("catalog.json", "banner.webp"), C("catalog.json", "首页封面,深蓝渐变"), C("catalog.json", "活动横幅,红底")],
    {"assets.md": "- cover.png: 首页封面,深蓝渐变\n- logo.svg: 品牌标识,单色\n- banner.webp: 活动横幅,红底\n- icon.png: 装饰图标,圆角\n",
     "catalog.json": '[{"src":"cover.png","alt":"首页封面,深蓝渐变"},{"src":"logo.svg","alt":"品牌标识,单色"},{"src":"banner.webp","alt":"活动横幅,红底"},{"src":"icon.png","alt":"装饰图标,圆角"}]\n'}, QA_TOOLS)

add("mm-dim-check", "多模态:尺寸规格核对", "convo-multimodal",
    "阅读 images.json(各图尺寸),生成 oversized.md:只列出宽度超过 800 的图片,每行『文件名 宽x高』,末行『超标 N 张』;未超标的图不得出现。",
    [C("oversized.md", "hero.png 1200x400"), C("oversized.md", "wide.jpg 900x300"), C("oversized.md", "超标 2 张"), NC("oversized.md", "thumb.png")],
    {"images.json": '[{"f":"hero.png","w":1200,"h":400},{"f":"thumb.png","w":200,"h":200},{"f":"wide.jpg","w":900,"h":300},{"f":"s.png","w":64,"h":64}]\n',
     "oversized.md": "hero.png 1200x400\nwide.jpg 900x300\n超标 2 张\n"}, QA_TOOLS)

add("mm-format-convert", "多模态:素材清单格式转换", "convo-multimodal",
    "把 media.tsv(TAB 分隔:文件名<TAB>类型<TAB>时长)转成 media.md 的列表,每行『- [类型] 文件名 (时长)』,全部行都要转。",
    [C("media.md", "- [video] intro.mp4 (12s)"), C("media.md", "- [video] trailer.webm (30s)"), C("media.md", "- [image] cover.png (-)")],
    {"media.tsv": "intro.mp4\tvideo\t12s\ntrailer.webm\tvideo\t30s\ncover.png\timage\t-\n",
     "media.md": "- [video] intro.mp4 (12s)\n- [video] trailer.webm (30s)\n- [image] cover.png (-)\n"}, QA_TOOLS)

add("mm-caption-fix", "多模态:补全缺失 alt", "convo-multimodal",
    "读取 gallery.md,其中有若干 『![](x.png)』 缺 alt。生成 gallery_fixed.md:把每个图片引用改为 『![描述](x.png)』,描述取 captions.md 对应项;其他内容逐字保留。",
    [C("gallery_fixed.md", "![第一张演示图](one.png)"), C("gallery_fixed.md", "![第二张结果图](two.png)"), C("gallery_fixed.md", "正文段。")],
    {"gallery.md": "# 图集\n\n![](one.png)\n\n正文段。\n\n![](two.png)\n", "captions.md": "one.png: 第一张演示图\ntwo.png: 第二张结果图\n",
     "gallery_fixed.md": "# 图集\n\n![第一张演示图](one.png)\n\n正文段。\n\n![第二张结果图](two.png)\n"}, QA_TOOLS)

add("mm-palette-extract", "多模态:配色方案提取", "convo-multimodal",
    "读取 theme.txt(六行 HSL 值),生成 palette.json:数组,每项为原行字符串,顺序不变;再生成 palette.md,首行写亮度大于 60 的行数『亮色 N 个』(亮度即 HSL 的 L% 数值)。",
    [C("palette.json", "hsl(0 60% 80%)"), C("palette.json", "hsl(180 50% 90%)"), C("palette.md", "亮色 3 个")],
    {"theme.txt": "hsl(210 40% 20%)\nhsl(0 60% 80%)\nhsl(120 30% 50%)\nhsl(40 90% 70%)\nhsl(270 20% 10%)\nhsl(180 50% 90%)\n",
     "palette.json": '["hsl(210 40% 20%)","hsl(0 60% 80%)","hsl(120 30% 50%)","hsl(40 90% 70%)","hsl(270 20% 10%)","hsl(180 50% 90%)"]\n',
     "palette.md": "亮色 3 个\n"}, QA_TOOLS)

add("mm-audio-index", "多模态:音频清单索引", "convo-multimodal",
    "读取 audio.csv(track,artist,duration),生成 index.md:每行『#N 艺术家 - 曲目』(N 从 1 起),末行『共 N 首』。",
    [C("index.md", "#1 synthcat - nightdrive"), C("index.md", "#2 windfield - aurora"), C("index.md", "共 2 首")],
    {"audio.csv": "track,artist,duration\nnightdrive,synthcat,3:40\naurora,windfield,4:12\n",
     "index.md": "#1 synthcat - nightdrive\n#2 windfield - aurora\n共 2 首\n"}, QA_TOOLS)

# ── 审查 ×6(convo-review)─────────────────────────────────────────────────
add("review-code-smells", "审查:代码异味清单", "convo-review",
    "审查 sample.py,找出其中至少三个问题(魔法数字、裸 except、无 docstring 的公开函数),写进 review.md:每个问题一行『问题: <类型>』。",
    [C("review.md", "魔法数字"), C("review.md", "裸 except"), C("review.md", "docstring")],
    {"sample.py": "def run(x):\n    y = x * 86400\n    try:\n        return y\n    except:\n        return None\n",
     "review.md": "问题: 魔法数字 86400\n问题: 裸 except\n问题: 公开函数缺 docstring\n"}, QA_TOOLS)

add("review-config-drift", "审查:配置漂移检测", "convo-review",
    "对比 config_old.json 与 config_new.json,把发生变化的键与新值写进 drift.md,每行『键: 旧值 -> 新值』,新增键写『键: (新增) -> 新值』;不变的键不得出现。",
    [C("drift.md", "b: 2 -> 5"), C("drift.md", "d: (新增) -> 9"), NC("drift.md", '"a"')],
    {"config_old.json": '{"a": 1, "b": 2, "c": 3}\n', "config_new.json": '{"a": 1, "b": 5, "c": 3, "d": 9}\n',
     "drift.md": "b: 2 -> 5\nd: (新增) -> 9\n"}, QA_TOOLS)

add("review-log-triage", "审查:日志分级归类", "convo-review",
    "读取 applog.txt,把 ERROR 行归到 errors.md(每行原文照录),WARNING 行归到 warnings.md,INFO 行忽略;两个文件都要生成。",
    [C("errors.md", "ERROR db timeout"), C("errors.md", "ERROR cache miss"), C("warnings.md", "WARN slow query")],
    {"applog.txt": "INFO started\nERROR db timeout\nWARN slow query\nERROR cache miss\nINFO done\n",
     "errors.md": "ERROR db timeout\nERROR cache miss\n", "warnings.md": "WARN slow query\n"}, QA_TOOLS)

add("review-security-scan", "审查:安全项检查表", "convo-review",
    "审查 keys.txt 与 checklist.py 中出现的明文密钥,生成 security.md:每个密钥一行『泄露: <密钥前八位>』,末行『评估: 高危』。",
    [C("security.md", "sk-live-"), C("security.md", "ghp_1111"), C("security.md", "评估: 高危")],
    {"keys.txt": "sk-live-abcdef1234567890\n", "checklist.py": "TOKEN = 'ghp_1111222233334444'\n",
     "security.md": "泄露: sk-live-abcdef1234567890\n泄露: ghp_1111222233334444\n评估: 高危\n"}, QA_TOOLS)

add("review-api-contract", "审查:接口契约比对", "convo-review",
    "对比 api_v1.md 与 api_v2.md,生成 contract_diff.md:列出 v2 新增的端点(每行『新增端点: <方法 路径>』)与 v2 已不存在的端点(每行『删除端点: <方法 路径>』)。",
    [C("contract_diff.md", "新增端点: POST /c"), C("contract_diff.md", "删除端点: GET /b")],
    {"api_v1.md": "GET /a\nGET /b\n", "api_v2.md": "GET /a\nPOST /c\n",
     "contract_diff.md": "新增端点: POST /c\n删除端点: GET /b\n"}, QA_TOOLS)

add("review-dead-code", "审查:死代码清理建议", "convo-review",
    "阅读 dead.py,生成 cleanup.md:每个未被调用的函数一行『未引用: <函数名>』,被调用的不得列出;末行写『清理建议: 共 N 处』(N=未引用函数数)。",
    [C("cleanup.md", "未引用: orphan_a"), C("cleanup.md", "未引用: orphan_b"), C("cleanup.md", "共 2 处"), NC("cleanup.md", "used_one")],
    {"dead.py": "def used_one():\n    return 1\n\ndef orphan_a():\n    return 2\n\ndef orphan_b():\n    return 3\n\ndef main():\n    return used_one()\n",
     "cleanup.md": "未引用: orphan_a\n未引用: orphan_b\n清理建议: 共 2 处\n"}, QA_TOOLS)

# ── 校验与写出 ────────────────────────────────────────────────────────────
cats = Counter(t["category"] for t in tasks)
assert len(tasks) == 30, len(tasks)
assert all(v == 6 for v in cats.values()), cats
assert len({t["id"] for t in tasks}) == 30

(BENCH / "tasks_convo_golden.json").write_text(
    json.dumps({"tasks": tasks}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 两套 fixture 同源写出:
#   fixtures_golden/<fixture>/ = 参考答案态(输入 + 产物),golden 执行器直评用;
#   fixtures/<fixture>/        = 初始态(只有输入、没有任何产物),loop_v2/stub 执行器用。
# 产物清单**显式声明**,不从 checks 反推 —— checks 只检关键子串,一个任务的产物文件
# 可能多于检查点(如批量复制任务产出 4 个文件而只检 1 个);按检查点剔除会让初始态
# 留着"半成品",于是"未做即不过"这条前提被悄悄削弱。
PRODUCTS = {
    **{f"convo-qa-{k}": ["answer.md"] for k in
       ("config-recall", "version-matrix", "error-code", "arch-decision", "migration-order", "quota-policy")},
    "convo-tools-report-gen": ["summary.json"],
    "convo-tools-refactor-split": ["manifest.txt", "notes/a.md", "notes/b.md"],
    "convo-tools-env-audit": ["audit.md"],
    "convo-tools-test-scaffold": ["test_mathops_skeleton.py"],
    "convo-tools-changelog-merge": ["CHANGELOG.md"],
    "convo-tools-deps-extract": ["deps.md"],
    "convo-long-plan-execute": ["plan.md", "result.md"],
    "convo-long-multi-round-calc": ["totals.md"],
    "convo-long-state-machine": ["trace.md"],
    "convo-long-doc-chain": ["final.md"],
    "convo-long-iterative-refine": ["draft.md", "final_report.md"],
    "convo-long-checkpoint-restore": ["out_1.md", "out_2.md", "out_3.md", "out_4.md", "done.md"],
    "convo-mm-alt-catalog": ["catalog.json"],
    "convo-mm-dim-check": ["oversized.md"],
    "convo-mm-format-convert": ["media.md"],
    "convo-mm-caption-fix": ["gallery_fixed.md"],
    "convo-mm-palette-extract": ["palette.json", "palette.md"],
    "convo-mm-audio-index": ["index.md"],
    "convo-review-code-smells": ["review.md"],
    "convo-review-config-drift": ["drift.md"],
    "convo-review-log-triage": ["errors.md", "warnings.md"],
    "convo-review-security-scan": ["security.md"],
    "convo-review-api-contract": ["contract_diff.md"],
    "convo-review-dead-code": ["cleanup.md"],
}
assert len(PRODUCTS) == 30, len(PRODUCTS)

made_golden = made_init = 0
for t in tasks:
    tid = t["id"]
    files = answers[tid]
    products = set(PRODUCTS[tid])
    checked = {c["params"]["path"] for c in t["checks"]}
    assert checked <= products, f"{tid}: 检查点 {checked - products} 不在产物清单里"
    assert products <= set(files), f"{tid}: 产物 {products - set(files)} 不在 golden 文件里"

    gd = GF / t["fixture"]
    it = BENCH / "fixtures" / t["fixture"]
    for d in (gd, it):
        if d.exists():
            shutil.rmtree(d)
    it.mkdir(parents=True)
    init_count = 0
    for rel, content in files.items():
        p = gd / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        made_golden += 1
        if rel not in products:
            q = it / rel
            q.parent.mkdir(parents=True, exist_ok=True)
            q.write_text(content, encoding="utf-8")
            made_init += 1
            init_count += 1
    # 空初始态目录 git 不跟踪 —— 干净检出上它根本不存在,loop_v2/stub 执行器会
    # 在 copytree 处炸,而本机(目录还在)一切正常。每题必须至少有一个输入文件。
    assert init_count >= 1, f"{tid}: 初始态没有任何输入文件(git 不跟踪空目录 ⇒ 换机必炸)"

# 题集文件被 .gitignore 吞掉 = 干净检出上缺件,而本机目录还在、测试照绿。
# 这里对**每一条落盘路径**问一次 git(比抄一份"什么会被忽略"的规则可靠得多)。
emitted = []
for base in (GF, BENCH / "fixtures"):
    for t in tasks:
        d = base / t["fixture"]
        emitted += [str(f.relative_to(ROOT)) for f in d.rglob("*") if f.is_file()]

NL = chr(10)
payload = NL.join(emitted).encode("utf-8")
# 必须走**字节**管道:Windows 上 text=True 会把 \n 写成 \r\n,git 按 \n 切行后每条路径
# 尾巴挂着 \r,于是 "*.log" 这类模式永不命中 —— 守卫会静默把"被忽略"读成"没被忽略"。
r = subprocess.run(
    ["git", "check-ignore", "--stdin"],
    cwd=ROOT, input=payload, capture_output=True,
)
ignored = [x for x in r.stdout.decode("utf-8", "replace").splitlines() if x.strip()]
assert not ignored, f"题集文件被 .gitignore 命中,换机必缺件: {ignored}"
print(f"gitignore 自检通过: 落盘 {len(emitted)} 个文件无一被忽略")

print(f"tasks={len(tasks)} cats={dict(cats)}")
print(f"golden 文件={made_golden} 初始态文件={made_init}")
print("OUT:", BENCH / "tasks_convo_golden.json")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
