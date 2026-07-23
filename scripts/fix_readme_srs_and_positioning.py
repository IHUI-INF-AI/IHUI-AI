"""README.md SRS 误判 + 定位话术修正脚本(2026-07-23)。

修正 13 处 "SRS 间隔重复" 误判(SRS 实为 Simple Realtime Server 流媒体直播推流,
非 Spaced Repetition System 间隔重复),8 处 "替代 Stripe+Auth0+Mixpanel" 虚高话术
(实测覆盖度:计费 ~15% / 身份 ~40% / 产品分析 ~5% / 可观测 ~30%)。

用法: python scripts/fix_readme_srs_and_positioning.py
"""
import io
import sys
from pathlib import Path

README = Path("g:/IHUI-AI/README.md")

# ── SRS 误判修正(13 处)──
SRS_REPLACEMENTS = [
    # L229: "课程 / 题库 / 考试 / SRS 间隔重复 / 直播 / 学习报告"
    ("考试 / SRS 间隔重复 / 直播 / 学习报告",
     "考试 / 直播流媒体(SRS) / 学习报告"),
    # L257/L414/L1592: "(课程/题库/考试/SRS/直播/证书)" 三处
    ("(课程/题库/考试/SRS/直播/证书)",
     "(课程/题库/考试/直播流媒体(SRS)/证书)"),
    # L315: 表格行 "SRS 间隔重复 | 艾宾浩斯遗忘曲线 / 智能复习调度"
    ("|                   | SRS 间隔重复    | 艾宾浩斯遗忘曲线 / 智能复习调度",
     "|                   | 直播流媒体(SRS) | RTMP/HLS/WebRTC 直播推流                "),
    # L396: "课程/题库/考试/SRS/直播/45 表"
    ("课程/题库/考试/SRS/直播/45 表",
     "课程/题库/考试/直播流媒体(SRS)/45 表"),
    # L794: "课程/题库/SRS/直播/45 表"(无"考试/")
    ("课程/题库/SRS/直播/45 表",
     "课程/题库/直播流媒体(SRS)/45 表"),
    # L431: "AI 教育全栈(课程 / 题库 / 考试 / SRS)"
    ("AI 教育全栈(课程 / 题库 / 考试 / SRS)",
     "AI 教育全栈(课程 / 题库 / 考试 / 直播(SRS))"),
    # L473: "- 学生用 SRS 间隔重复自动复习"(虚构功能)
    ("- 学生用 SRS 间隔重复自动复习",
     "- 学生用直播(SRS)回放复习"),
    # L722: "SRS 间隔重复(艾宾浩斯遗忘曲线)· 直播教学"
    ("SRS 间隔重复(艾宾浩斯遗忘曲线)· 直播教学",
     "直播流媒体(SRS) · 直播教学"),
    # L993: 表格行 "SRS 间隔重复 | 基于艾宾浩斯遗忘曲线的智能复习调度 / srs.ts + srs.py"
    ("| **SRS 间隔重复**    | 基于艾宾浩斯遗忘曲线的智能复习调度 / srs.ts + srs.py",
     "| **直播流媒体(SRS)**    | RTMP/HLS/WebRTC 直播推流 / srs.ts                      "),
    # L1441: "→ SRS 间隔重复 → 证书发放"
    ("→ SRS 间隔重复 → 证书发放",
     "→ 直播回放复习 → 证书发放"),
    # L1850: "AI 教育全栈(课程 / 题库 / 考试 / SRS / 直播 / 报告"
    ("AI 教育全栈(课程 / 题库 / 考试 / SRS / 直播 / 报告",
     "AI 教育全栈(课程 / 题库 / 考试 / 直播流媒体(SRS) / 报告"),
]

# ── 定位话术调整(8 处)──
POSITIONING_REPLACEMENTS = [
    # L139: "**一个仓库替代 6-10 个独立 SaaS**(Stripe + Auth0 + ...)"(含 markdown 粗体)
    ("**一个仓库替代 6-10 个独立 SaaS**(Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code + Khan Academy + 蚁客 + Notion AI)",
     "**一个仓库集成 6-10 类 SaaS 能力**(中国本土支付 + RBAC 鉴权 + 邮件 + 基础可观测 + AI 编排 + CLI + 教育 + 多平台发布)"),
    # L149: "一个仓库替代 6-10 个 SaaS,月省 $300+"
    ("一个仓库替代 6-10 个 SaaS,月省 $300+",
     "一个仓库集成 6-10 类 SaaS 能力,月省 $300+"),
    # L161: "④ 商业 SaaS 基座(对标 Stripe+Auth0+Mixpanel)"
    ("④ 商业 SaaS 基座(对标 Stripe+Auth0+Mixpanel)",
     "④ 商业 SaaS 基座(集成中国本土支付 + RBAC + 基础可观测)"),
    # L189: "替代 Stripe($84/月)+ Auth0..."
    ("替代 Stripe($84/月)+ Auth0($35/月)+ Mailgun($35/月)+ Mixpanel($20/月)+ Dify($59/月)+ Claude Code($20/月)+ 蚁客($50/月)≈ $303/月,IHUI-AI 自托管 $0/月",
     "对齐 Stripe($84/月)+ Auth0($35/月)+ Mailgun($35/月)+ Mixpanel($20/月)+ Dify($59/月)+ Claude Code($20/月)+ 蚁客($50/月)≈ $303/月,IHUI-AI 自托管 $0/月(实际覆盖度:支付 ~15% / 身份 ~40% / 产品分析 ~5% / 可观测 ~30%)"),
    # L239: "替代 Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code,月省 $300+"
    ("替代 Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code,月省 $300+",
     "对齐 Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code 能力(部分覆盖),月省 $300+"),
    # L415: "一站式替代 4-6 个 SaaS"
    ("IHUI-AI 把支付/认证/邮件/分析全部预置,一站式替代 4-6 个 SaaS,月省 $300+",
     "IHUI-AI 把支付/认证/邮件/分析全部预置,一站式集成 4-6 类 SaaS 能力,月省 $300+"),
    # L419/L1613: "开源一体化替代方案"(两处)
    ("Stripe(支付)+ 蚁客(发布)的**开源一体化替代方案**",
     "Stripe(支付)+ 蚁客(发布)的**开源一体化集成方案**"),
]


def run():
    if not README.exists():
        print(f"[FAIL] README not found: {README}", file=sys.stderr)
        sys.exit(1)

    with io.open(README, "r", encoding="utf-8") as f:
        content = f.read()

    original_len = len(content)
    total_replaced = 0
    failures = []

    print("=" * 70)
    print("SRS 误判修正(13 处预期):")
    print("=" * 70)
    for i, (old, new) in enumerate(SRS_REPLACEMENTS, 1):
        count = content.count(old)
        if count == 0:
            failures.append(f"SRS-{i}: 未找到 '{old[:50]}...'")
            print(f"  [FAIL] SRS-{i}: 0 处(预期 ≥1)")
            continue
        content = content.replace(old, new)
        total_replaced += count
        print(f"  [OK]   SRS-{i}: {count} 处")

    print()
    print("=" * 70)
    print("定位话术调整(8 处预期):")
    print("=" * 70)
    for i, (old, new) in enumerate(POSITIONING_REPLACEMENTS, 1):
        count = content.count(old)
        if count == 0:
            failures.append(f"POS-{i}: 未找到 '{old[:50]}...'")
            print(f"  [FAIL] POS-{i}: 0 处(预期 ≥1)")
            continue
        content = content.replace(old, new)
        total_replaced += count
        print(f"  [OK]   POS-{i}: {count} 处")

    if failures:
        print()
        print("=" * 70)
        print(f"[FAIL] {len(failures)} 条替换未命中:")
        for msg in failures:
            print(f"  - {msg}")
        print("=" * 70)
        sys.exit(1)

    with io.open(README, "w", encoding="utf-8") as f:
        f.write(content)

    print()
    print("=" * 70)
    print(f"[DONE] 共替换 {total_replaced} 处,文件大小 {original_len} → {len(content)} bytes")
    print("=" * 70)


if __name__ == "__main__":
    run()
