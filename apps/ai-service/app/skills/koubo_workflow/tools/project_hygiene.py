#!/usr/bin/env python3
"""
project_hygiene.py - 双项目目录卫生验证
检查口播稿+公众号项目的目录结构白名单，防止垃圾文件积累。
对应规则：口播稿AGENTS.md 十三 / 公众号AGENTS.md 十一
用法：python project_hygiene.py
"""
import os
import sys
import io
import re

# Windows UTF-8 fix
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))   # 工具脚本/
KOUBO_ROOT = os.path.dirname(SCRIPT_DIR)                  # 口播稿/koubo
MEDIA_ROOT = os.path.dirname(os.path.dirname(KOUBO_ROOT))  # 自媒体/（父级目录，下含 口播稿/ 与 公众号/）

# ── 项目边界硬门禁（缺省 fail-closed：未声明会话 / 公众号会话均拦截） ──
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # koubo_workflow/
import project_boundary
project_boundary.check_action(tool="project_hygiene.py")

# ===== 白名单常量 =====

# 口播稿 koubo/ 根目录白名单
KOUBO_ACTIVE_FILES = {
    'AGENTS.md', 'README.md',
    'koubo_validate.py', 'koubo_quality_gate.py', 'koubo_live_check.py',
    'project_hygiene.py',
}
KOUBO_ACTIVE_CN = {
    '\u7d20\u6750\u5e93.md',       # 素材库.md
    '\u771f\u5b9e\u7d20\u6750\u5e93.md',  # 真实素材库.md（创始人亲历，用户确认）
    '\u516c\u5f00\u771f\u5b9e\u6848\u4f8b\u5e93.md',  # 公开真实案例库.md（AI联网检索+深度分析）
    '\u9009\u9898\u5b58\u6863.md',   # 选题存档.md
    '\u5df2\u53d1\u5e03\u5185\u5bb9\u8bb0\u5fc6.json',  # 已发布内容记忆.json
}
KOUBO_MMDD_PATTERN = re.compile(r'^\d{4}\.txt$')
KOUBO_ALLOWED_DIRS = {'Output', '历史稿', '工具脚本', '素材库', '调试备份', '.workbuddy'}

# 口播稿 _archive/ 白名单
KOUBO_ARCHIVE_FILES = {
    '\u8d26\u53f7\u5b9a\u4f4d\u8bb0\u5fc6.md',                   # 账号定位记忆.md
    '\u6539\u7248\u65b9\u6848.md',                                 # 改版方案.md
    '\u53d1\u5e03\u65e5\u5fd7.md',                                 # 发布日志.md
    'json_reference_data.json',
    '\u8fd0\u8425\u6587\u6863-\u53d1\u5e03\u540e\u8fd0\u8425\u6e05\u5355.md',  # 运营文档-发布后运营清单.md
    '\u8fd0\u8425\u6587\u6863-\u6570\u636e\u8ffd\u8e2a\u4e0e\u5468\u590d\u76d8.md',  # 运营文档-数据追踪与周复盘.md
    '\u8fd0\u8425\u6587\u6863-\u8d26\u53f7\u96c6\u4e2d\u7b56\u7565.md',  # 运营文档-账号集中策略.md
}
KOUBO_ARCHIVE_DIRS = {'skills', '\u4ea4\u4ed8'}  # skills, 交付

# 公众号 lib/ 白名单
LIB_MODULES = {
    'validate.py', 'fact_check.py', '__init__.py',
    'wechat_publish.py', 'csdn_publish.py',
    'moyu_green_renderer.py',   # 官方摸鱼绿排版引擎（公众号铁律确认）
    'imgchr_uploader.py',       # 图床上传器（公众号图床流程）
}

# 公众号 skills/ 白名单
SKILLS_DIRS = {'content-engine', 'short-post-skill', '_archive', 'gzh-design-study'}

# 公众号根目录白名单
WECHAT_ROOT_ITEMS = {
    'AGENTS.md', 'skills', 'wechat-article-system',
    '\u6587\u7ae0',  # 文章
}

# 公众号 wechat-article-system/ 根目录白名单
WAS_ROOT_ITEMS = {
    '.env', '.gitignore', 'assets', 'lib', 'output',
    '\u5df2\u53d1\u5e03\u5185\u5bb9\u8bb0\u5fc6.json',  # 已发布内容记忆.json
    'articles',                 # 源 Markdown（公众号铁律：源md放articles/）
    'publish_pipeline.py',      # 唯一发布入口
    'build_gpt56_sol.py',       # 官方 DOCX 构建器（被流水线导入，非废弃）
    'export_csdn_md.py',        # CSDN 通用 md 导出
    'gen_preview.py',           # 动画预览生成
    'full_audit.py',            # 全量审计（38→42维度）
    'README.md',                # 使用文档
    '_archive',                 # 归档目录
    'push_moyu_green_draft.py', # 摸鱼绿草稿推送
    'push_to_draft.py',         # 草稿推送（保留）
    '.wechat_token_cache.json', # 微信 token 缓存
    '__pycache__',              # Python 缓存（另行清理）
    'AGENTS.md',                # 公众号工作流权威文档（与公众号/AGENTS.md 为不同文件）
    'tools',                    # 工具目录（发布/调试辅助脚本）
    '_find_empty_p.py',         # 空段落检测小工具
    '.workbuddy',               # agent 受保护记忆目录
}

# 自媒体/ 根目录白名单
MEDIA_ROOT_ITEMS = {
    '\u516c\u4f17\u53f7',  # 公众号
    '\u53e3\u64ad\u7a3f',  # 口播稿
    '_散落归档_2026-07-16',  # 散落文件整合归档（2026-07-16 整理，内容均保留）
}

# 通用垃圾模式
JUNK_PATTERNS = [
    re.compile(r'^__tmp_'),
    re.compile(r'^_apply_'),
    re.compile(r'^\.playwright'),
    re.compile(r'^\.uploads$'),
    re.compile(r'^node_modules$'),
    re.compile(r'^__pycache__$'),
    re.compile(r'\.pyc$'),
        re.compile(r'^aihot_(sel|today)\.json$'),
        re.compile(r'^claude_code_\d+\.'),
    ]

# output/ 临时垃圾（当前文章四件套为正常交付物，不在此列）
OUTPUT_JUNK = re.compile(r'(_预览\.html$|_v\d+\.|备份|\.bak$|\.tmp$)')

# === 项目边界铁律（2026-07-14 用户强制·零容忍） ===
# 公众号 wechat-article-system/ 任何目录出现 .txt / MMDD.txt 模式 = 一票否决
# 口播稿 koubo/ 任何目录出现 .html/.docx 公众号产物 = 一票否决
KOUBO_FILE_PATTERN = re.compile(r'^\d{4}\.txt$', re.U)  # 0629/0701/.../0714.txt
GZH_HTML_PATTERN = re.compile(r'^.*_摸鱼绿\.html$|^.*\.html$', re.U)  # 摸鱼绿HTML
GZH_DOCX_PATTERN = re.compile(r'^.*\.docx$', re.U)  # DOCX
# 口播稿强特征词库 v2（2026-07-14 第二轮精修·高置信度·24 词）
# 注意: 已移除「李总 / 智汇AI / 智汇AI丨」三类品牌词
KOUBO_FILE_PATTERN_TUPLE = (
    # 平台话题词（口播稿独有·公众号不会用）
    '[置顶]', '#科技', '#互联网', '#商业', '#AI取代工作',
    # 抖音/带货专属术语
    '完播率', '涨粉', '直播间', '橱窗', '带货',
    # 口播稿话术词（公众号不会用）
    '咱就说', '你品品', '你想想', '你猜怎么着', '废话不多说', '记住我这句话',
    '核心来了', '重点来了', '听好了', '看到这儿了', '划走就亏了',
    '今儿',  # 口播稿专属用词
    # 标题党词（口播稿高频·公众号不会用）
    '巨亏', '血赚', '翻车', '爆单', '破防',
)


class HygieneChecker:
    def __init__(self):
        self.results = []

    def _add(self, check, passed, detail=''):
        self.results.append((check, passed, detail))

    def _has_junk_name(self, name):
        for pat in JUNK_PATTERNS:
            if pat.search(name):
                return True
        return False

    # ===== 口播稿项目 =====
    def check_koubo(self):
        koubo_dir = os.path.join(MEDIA_ROOT, '\u53e3\u64ad\u7a3f', 'koubo')
        if not os.path.isdir(koubo_dir):
            self._add('\u53e3\u64ad\u7a3f/koubo/\u76ee\u5f55', False, '\u76ee\u5f55\u4e0d\u5b58\u5728')
            return

        # 1) __pycache__
        pycache = os.path.join(koubo_dir, '__pycache__')
        self._add('\u53e3\u64ad\u7a3f __pycache__', not os.path.exists(pycache),
                  '' if not os.path.exists(pycache) else '\u5b58\u5728__pycache__/\u76ee\u5f55')

        # 2) 根目录白名单
        unexpected = []
        for item in os.listdir(koubo_dir):
            if item in KOUBO_ACTIVE_FILES or item in KOUBO_ACTIVE_CN:
                continue
            if KOUBO_MMDD_PATTERN.match(item):
                continue
            if item in KOUBO_ALLOWED_DIRS:
                continue
            # 跳过 Windows 设备名/伪条目(如 nul)：既非真实文件也非真实目录
            if not os.path.isfile(os.path.join(koubo_dir, item)) \
                    and not os.path.isdir(os.path.join(koubo_dir, item)):
                continue
            unexpected.append(item)

        self._add('\u53e3\u64ad\u7a3f\u6839\u76ee\u5f55\u767d\u540d\u5355',
                  len(unexpected) == 0,
                  '' if not unexpected else '\u610f\u5916\u6587\u4ef6: ' + ', '.join(unexpected))

        # 3) _archive/ 白名单
        archive_dir = os.path.join(koubo_dir, '_archive')
        if os.path.isdir(archive_dir):
            unexpected_archive = []
            for item in os.listdir(archive_dir):
                if item in KOUBO_ARCHIVE_FILES or item in KOUBO_ARCHIVE_DIRS:
                    continue
                unexpected_archive.append(item)
            self._add('\u53e3\u64ad\u7a3f _archive/\u767d\u540d\u5355',
                      len(unexpected_archive) == 0,
                      '' if not unexpected_archive else '\u610f\u5916: ' + ', '.join(unexpected_archive))

    # ===== 公众号项目 =====
    def check_wechat(self):
        wc_dir = os.path.join(MEDIA_ROOT, '\u516c\u4f17\u53f7')
        if not os.path.isdir(wc_dir):
            self._add('\u516c\u4f17\u53f7/\u76ee\u5f55', False, '\u76ee\u5f55\u4e0d\u5b58\u5728')
            return

        # 1) 公众号根目录白名单
        unexpected_root = []
        for item in os.listdir(wc_dir):
            if item in WECHAT_ROOT_ITEMS:
                continue
            unexpected_root.append(item)
        self._add('\u516c\u4f17\u53f7\u6839\u76ee\u5f55\u767d\u540d\u5355',
                  len(unexpected_root) == 0,
                  '' if not unexpected_root else '\u610f\u5916: ' + ', '.join(unexpected_root))

        was_dir = os.path.join(wc_dir, 'wechat-article-system')
        if not os.path.isdir(was_dir):
            return

        # 2) __pycache__
        for subdir in ['lib', 'config']:
            pycache = os.path.join(was_dir, subdir, '__pycache__')
            self._add(f'\u516c\u4f17\u53f7 {subdir}/__pycache__',
                      not os.path.exists(pycache),
                      '' if not os.path.exists(pycache) else '\u5b58\u5728__pycache__/')

        # 3) lib/ 白名单
        lib_dir = os.path.join(was_dir, 'lib')
        if os.path.isdir(lib_dir):
            unexpected_lib = []
            for f in os.listdir(lib_dir):
                if f in LIB_MODULES:
                    continue
                if f == '__pycache__':
                    continue  # already checked above
                unexpected_lib.append(f)
            self._add('\u516c\u4f17\u53f7 lib/\u767d\u540d\u5355',
                      len(unexpected_lib) == 0,
                      '' if not unexpected_lib else '\u610f\u5916\u6a21\u5757: ' + ', '.join(unexpected_lib))

        # 4) skills/ 白名单
        skills_dir = os.path.join(wc_dir, 'skills')
        if os.path.isdir(skills_dir):
            unexpected_skills = []
            for d in os.listdir(skills_dir):
                if d in SKILLS_DIRS:
                    continue
                unexpected_skills.append(d)
            self._add('\u516c\u4f17\u53f7 skills/\u767d\u540d\u5355',
                      len(unexpected_skills) == 0,
                      '' if not unexpected_skills else '\u610f\u5916: ' + ', '.join(unexpected_skills))

        # 5) output/ 残留（仅查临时/预览/备份类垃圾，当前文章四件套不报）
        output_dir = os.path.join(was_dir, 'output')
        if os.path.isdir(output_dir):
            leftover = []
            for f in os.listdir(output_dir):
                if OUTPUT_JUNK.search(f):
                    leftover.append(f)
            self._add('\u516c\u4f17\u53f7 output/\u6e05\u7406',
                      len(leftover) == 0,
                      '' if not leftover else '\u6b8b\u7559\u6587\u4ef6: ' + ', '.join(leftover))

        # 7) was根目录白名单
        unexpected_was = []
        for item in os.listdir(was_dir):
            if item in WAS_ROOT_ITEMS:
                continue
            unexpected_was.append(item)
        self._add('\u516c\u4f17\u53f7 wechat-article-system/\u767d\u540d\u5355',
                  len(unexpected_was) == 0,
                  '' if not unexpected_was else '\u610f\u5916: ' + ', '.join(unexpected_was))

    # ===== 项目边界硬检测（2026-07-14 用户强制·零容忍） =====
    def check_cross_project_boundary(self):
        """根治疗法: AI 误把口播稿文件写到公众号 output/、或把公众号 HTML 写到口播稿/ 时,
        立即 FAIL,不放过到下次会话。

        扩展到 6 项检查 (2026-07-14 主动补全):
        1. 公众号目录有 .txt → FAIL
        2. 公众号目录有 MMDD.txt 模式 → FAIL
        3. 公众号目录有 口播稿特征词（≥2 个） → FAIL
        4. 口播稿目录有 .html/.docx → FAIL
        5. 口播稿目录（含 images/ 子目录）有 口播稿产物的反面——.md/.json 公众号脚本 → FAIL
        6. 口播稿 images/ 目录有 .txt 草稿串文件 → FAIL

        白名单设计:
        - 公众号端: AGENTS.md / README.md / SKILL.md / MEMORY.md 都是规则文档,排除
        - 口播稿根: 案例库/素材库/选题存档等 pre-existing 业务 .md 文档,排除
        """
        was_dir = os.path.join(MEDIA_ROOT, '公众号', 'wechat-article-system')
        koubo_dir = os.path.join(MEDIA_ROOT, '口播稿', 'koubo')

        # 跳过 .py/.json/.log 源码（脚本里可能含 .txt 字符串字面量）
        SKIP_EXTS = ('.py', '.json', '.log', '.pyc')
        # 规则文档白名单（公众号端·自身规则说明）
        GZH_DOC_WHITELIST = {'AGENTS.md', 'README.md', 'SKILL.md', 'MEMORY.md'}
        # 口播稿根目录合法文档（规则+业务）
        KOUBO_DOC_WHITELIST = {
            'AGENTS.md', 'README.md', 'SKILL.md', 'MEMORY.md',
            '公开真实案例库.md', '真实素材库.md', '素材库.md', '选题存档.md',
        }

        # === 1+2+3. 公众号端·反向检查 ===
        gzh_pollution = []
        gzh_keyword_hits = []
        if os.path.isdir(was_dir):
            for cur, subdirs, files in os.walk(was_dir):
                for f in files:
                    if f.endswith(SKIP_EXTS):
                        continue
                    # 跳过规则文档（避免自我命中）
                    if f in GZH_DOC_WHITELIST:
                        continue
                    fp = os.path.join(cur, f)
                    try:
                        rel = os.path.relpath(fp, was_dir)
                    except ValueError:
                        # Windows 设备名/伪条目(如 nul)无法相对化，跳过不误判
                        continue
                    # 后缀 .txt / MMDD.txt 模式
                    if f.lower().endswith('.txt'):
                        gzh_pollution.append((rel, '后缀 .txt 出现在公众号目录'))
                    elif KOUBO_FILE_PATTERN.match(f):
                        gzh_pollution.append((rel, '文件名匹配口播稿 MMDD.txt 模式'))
                    # 文档类文件（.md/.html/.docx）命中口播稿特征词
                    elif f.lower().endswith(('.md', '.html', '.docx')):
                        try:
                            txt = open(fp, 'r', encoding='utf-8', errors='ignore').read()
                        except Exception:
                            continue
                        kw = [k for k in KOUBO_FILE_PATTERN_TUPLE if k in txt]
                        if len(kw) >= 2:
                            gzh_keyword_hits.append((rel, kw))
        self._add('项目边界·公众号目录无 .txt/MMDD.txt (零容忍)',
                  len(gzh_pollution) == 0,
                  '' if not gzh_pollution else
                  f'发现 {len(gzh_pollution)} 处越界: ' +
                  ', '.join(f'{h[0]}({h[1]})' for h in gzh_pollution[:5]))
        self._add('项目边界·公众号文档无口播稿特征词 (≥2个零容忍)',
                  len(gzh_keyword_hits) == 0,
                  '' if not gzh_keyword_hits else
                  f'发现 {len(gzh_keyword_hits)} 处越界: ' +
                  ', '.join(f'{h[0]}→{h[1][:4]}' for h in gzh_keyword_hits[:3]))

        # === 4+5+6. 口播稿端·反向检查 ===
        koubo_pollution = []
        koubo_md_json = []
        koubo_img_txt = []
        if os.path.isdir(koubo_dir):
            for cur, subdirs, files in os.walk(koubo_dir):
                for f in files:
                    if f.endswith(SKIP_EXTS):
                        continue
                    # 跳过口播稿根目录白名单
                    if cur == koubo_dir and f in KOUBO_DOC_WHITELIST:
                        continue
                    # 跳过 _archive/ 内的 .md 文档（历史运营/素材/技能）
                    if cur != koubo_dir and '_archive' in cur and f.lower().endswith('.md'):
                        continue
                    fp = os.path.join(cur, f)
                    try:
                        rel = os.path.relpath(fp, koubo_dir)
                    except ValueError:
                        # Windows 设备名/伪条目(如 nul)无法相对化，跳过不误判
                        continue
                    # 4) 任何 .html / .docx 出现在 koubo/（公众号产物）
                    if f.lower().endswith('.html'):
                        koubo_pollution.append((rel, '后缀 .html 出现在口播稿目录'))
                    elif f.lower().endswith('.docx'):
                        koubo_pollution.append((rel, '后缀 .docx 出现在口播稿目录'))
                    # 5) 任何 .md / .json 出现在 koubo/ 根（公众号脚本/草稿混淆风险）
                    elif f.lower().endswith(('.md', '.json')) and cur == koubo_dir:
                        if f not in KOUBO_DOC_WHITELIST:
                            koubo_md_json.append((rel, f'口播稿根目录出现 {f.split(".")[-1]} 公众号类文件'))
                    # 6) koubo/images/ 目录里出现 .txt 文件（口播稿草稿串混淆）
                    if 'images' in cur and f.lower().endswith('.txt'):
                        koubo_img_txt.append((rel, 'koubo/images/ 出现 .txt 草稿串文件'))
        self._add('项目边界·口播稿目录无 .html/.docx (零容忍)',
                  len(koubo_pollution) == 0,
                  '' if not koubo_pollution else
                  f'发现 {len(koubo_pollution)} 处越界: ' +
                  ', '.join(f'{h[0]}({h[1]})' for h in koubo_pollution[:5]))
        self._add('项目边界·口播稿根目录无 .md/.json 公众号脚本 (零容忍)',
                  len(koubo_md_json) == 0,
                  '' if not koubo_md_json else
                  f'发现 {len(koubo_md_json)} 处越界: ' +
                  ', '.join(f'{h[0]}({h[1]})' for h in koubo_md_json[:5]))
        self._add('项目边界·koubo/images/ 无 .txt 草稿串 (零容忍)',
                  len(koubo_img_txt) == 0,
                  '' if not koubo_img_txt else
                  f'发现 {len(koubo_img_txt)} 处越界: ' +
                  ', '.join(f'{h[0]}({h[1]})' for h in koubo_img_txt[:5]))

    # ===== 根目录 =====
    def check_root(self):
        if not os.path.isdir(MEDIA_ROOT):
            return

        # 散落文件
        stray_files = []
        stray_dirs = []
        for item in os.listdir(MEDIA_ROOT):
            fp = os.path.join(MEDIA_ROOT, item)
            if item in MEDIA_ROOT_ITEMS:
                continue
            if os.path.isdir(fp):
                if item == '.workbuddy':
                    continue  # agent 受保护记忆目录，不算垃圾
                stray_dirs.append(item)
            else:
                stray_files.append(item)

        self._add('\u6839\u76ee\u5f55\u6563\u843d\u6587\u4ef6',
                  len(stray_files) == 0,
                  '' if not stray_files else '\u6563\u843d: ' + ', '.join(stray_files))
        self._add('\u6839\u76ee\u5f55\u591a\u4f59\u76ee\u5f55',
                  len(stray_dirs) == 0,
                  '' if not stray_dirs else '\u591a\u4f59: ' + ', '.join(stray_dirs))

    # ===== 报告 =====
    def report(self):
        print('=' * 50)
        print('  \u9879\u76ee\u536b\u751f\u68c0\u67e5')
        print('=' * 50)
        print()

        self.check_root()
        self.check_cross_project_boundary()
        self.check_koubo()
        self.check_wechat()

        passes = 0
        fails = 0
        for name, passed, detail in self.results:
            tag = '[OK]' if passed else '[!!]'
            line = f'  {tag} {name}'
            if detail:
                line += f' -- {detail}'
            print(line)
            if passed:
                passes += 1
            else:
                fails += 1

        print()
        print('-' * 50)
        total = passes + fails
        print(f'  \u7ed3\u679c: {passes}/{total} \u901a\u8fc7')

        if fails == 0:
            print('  [OK] \u9879\u76ee\u536b\u751f\u72b6\u6001\u826f\u597d')
        else:
            print(f'  [!!] {fails} \u9879\u8fdd\u89c4\uff0c\u5fc5\u987b\u5f53\u573a\u4fee\u590d')

        print('-' * 50)
        return fails == 0


if __name__ == '__main__':
    checker = HygieneChecker()
    ok = checker.report()
    sys.exit(0 if ok else 1)
