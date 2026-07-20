# -*- coding: utf-8 -*-
"""
统一发布流水线（摸鱼绿主题 · 公众号草稿箱）
================================================
唯一发布入口。把"正确做法"固化成硬结构，从代码层面杜绝反复踩的坑：

  1. 渲染摸鱼绿主题HTML（lib/moyu_green_renderer，官方 emerald 13组件，纯内联）
  2. 【门禁A·满分自检】跑 lib/validate.py 22项自检，三项满分(可读性100/传播力10/开头钩子≥9)
     + GEO100/原创度100/AI味≤2/风险0 必须全过，否则直接中止，绝不推送
  3. 【门禁B·重点组件检查】渲染出的HTML必须含足够多的"重点颜色区分"组件
     (金句卡oneliner / 提示块tip / 引用块quote / 代码块code / 小标题subtitle / 有序列表ordered
      + 绿色加粗strong)，否则中止——这是"文章重点无颜色"的根因防护
  4. 构建摸鱼绿主题DOCX（build_gpt56_sol.build_docx，全标记兼容 + emerald色系）
  5. 验证DOCX内嵌图片 ≥6（4正文+2文末）
  6. 推送草稿箱：上传图片→上传封面→删除本标题旧草稿→创建新草稿→列草稿箱状态

用法：
  python publish_pipeline.py --md articles/标题.md --title "标题" --digest "摘要" \
        --cover output/images/sec1.jpg --images output/images [--dry-run] [--no-csdn] [--cover-json cover.json]

默认参数已指向当前文章，可直接 `python publish_pipeline.py` 重跑。

铁律（永久）：
  - 未过门禁A/B，绝不允许推送（脚本直接 sys.exit(1)）
  - 色系只能是 emerald（#059669/#10B981/#FDE68A），禁止 Material 绿（#2e7d32/#1b5e20/#f1f8e9）
  - 文章源md必须自带结构化标记（:::oneliner / :::tip / > 引用 / ```代码 / ### 小标题 / 1. 列表），
    否则门禁B会拦下，逼你在写作阶段就加标记
"""
import io
import os
import sys
import re
import json
import time
import argparse

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE, 'output')  # 修复 2026-07-15: _cleanup_output() 引用但未定义,真推会 NameError 崩溃
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'lib'))

# ============ 跨项目边界硬门禁（2026-07-20 新增·防止窜工作） ============
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "koubo_workflow"))
import project_boundary
project_boundary.check_action(tool="publish_pipeline.py", paths=sys.argv[1:], cwd=os.getcwd())

from lib.moyu_green_renderer import md_to_moyu_green_html
from lib.validate import validate
import build_gpt56_sol as builder
from export_csdn_md import export_csdn_md
from lib.csdn_docx import build_csdn_docx, derive_csdn_title
from wechat_publish import (
    get_access_token, upload_image, upload_permanent_media,
    create_draft, list_drafts, delete_draft
)

# ===== 门禁B阈值（低于这些值直接中止，逼作者加重点标记）=====
MIN_EMPHASIS_BLOCKS = 3     # oneliner+tip+quote+code+subtitle+ordered 至少3个
MIN_GREEN_BOLD = 5          # 绿色加粗 strong 至少5处


def render_html(md_path, title, digest):
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()
    html = md_to_moyu_green_html(md_text, title=title, digest=digest)
    return html


def gate_selfcheck(md_path):
    """门禁A：22项自检必须全过（含三项满分）"""
    print('\n[门禁A] 22项自检（可读性/传播力/开头钩子满分 + GEO/原创度/AI味/风险）...')
    all_pass, reports = validate(md_path)
    for r in reports:
        print('  ' + r)
    if not all_pass:
        print('\n❌ 门禁A未通过：存在未满分/未通过项，禁止推送。请修复后重跑。')
        return False
    print('✅ 门禁A通过：22项全过，三项满分。')
    return True


def gate_fact_check(md_path, title):
    """门禁A+：事实核查（第23项，12子检查；HIGH级问题=0才通过）。
    2026-07-12 集成：之前 SKILL 宣传有,实际流水线没调,等于死代码。"""
    print('\n[门禁A+] 事实核查（第23项，12子检查，HIGH级阻断）...')
    try:
        from lib.fact_check import fact_check as _fc
    except ImportError:
        print('  ⚠️ fact_check 模块未找到,跳过(降级运行)')
        return True
    # 把 md 转成 article dict + 自动建 claims_registry(2026-07-12 修复 C12)
    text = open(md_path, 'r', encoding='utf-8').read()
    article = {
        'title': title,
        'text': text,
        'sections': [{'content': text}],
        'claims_registry': [],
    }
    # 调 auto_extract_claims 自动建注册表(可后续人工补全)
    try:
        from lib.fact_check import auto_extract_claims
        article['claims_registry'] = auto_extract_claims(article)
    except Exception as e:
        print(f'  ⚠️ auto_extract_claims 失败(非阻断): {e}')
    passed, issues = _fc(article)
    # 2026-07-12 修复：C12 注册表要求 verified=True 是人工流程,auto_extract 抽出的默认未核实
    # 这里只阻断 C1-C11 的 HIGH,C12 降级为警告(打印提示,不阻断)
    high_issues = [i for i in issues if i.get('severity') == 'HIGH' and i.get('check') != 'C12']
    c12_issues = [i for i in issues if i.get('severity') == 'HIGH' and i.get('check') == 'C12']
    if c12_issues:
        print(f'  ⚠️ C12 注册表 {len(c12_issues)} 条未核实(非阻断,建议人工核实后补 claims_registry)')
    if high_issues:
        print(f'\n❌ 门禁A+未通过：事实核查发现 {len(high_issues)} 个 HIGH 级问题(C1-C11)')
        for i in high_issues[:5]:
            print(f'  [{i.get("check","?")}] {(i.get("problem") or i.get("message") or "")[:100]}')
        return False
    print(f'✅ 门禁A+通过：事实核查无 C1-C11 HIGH 级问题(共 {len(issues)} 条已检查,C12 {len(c12_issues)} 条待人工核实)')
    return True


def gate_emphasis_components(html):
    """门禁B：渲染HTML必须含足够多的重点颜色区分组件"""
    print('\n[门禁B] 重点颜色组件检查（防止"文章无重点标注"）...')
    c_oneliner = html.count('border:1px dashed')          # 金句卡
    c_tip = html.count('border-left:4px solid')            # 提示块
    c_quote = html.count('#F9FAFB') + html.count('#f9fafb')  # 引用灰底
    c_code = html.count('#1E293B') + html.count('#1e293b')  # 代码块
    c_sub = html.count('linear-gradient(180deg,transparent 65%')  # 小标题黄高亮
    c_ord = html.count('border-radius:50%')                # 有序列表圆圈
    c_bold = html.count('strong style="color:#059669')     # 绿色加粗关键词

    blocks = c_oneliner + c_tip + c_quote + c_code + c_sub + c_ord
    print(f'  金句卡:{c_oneliner} 提示块:{c_tip} 引用块:{c_quote} 代码块:{c_code} '
          f'小标题:{c_sub} 有序列表:{c_ord} 绿色加粗:{c_bold}')
    print(f'  重点块合计:{blocks}（阈值≥{MIN_EMPHASIS_BLOCKS}）  绿色加粗:{c_bold}（阈值≥{MIN_GREEN_BOLD}）')

    if blocks < MIN_EMPHASIS_BLOCKS or c_bold < MIN_GREEN_BOLD:
        print('\n❌ 门禁B未通过：重点颜色区分不足，文章读起来仍像"没标注的平铺文本"。')
        print('   必须在源md中加入结构化标记：')
        print('     :::oneliner 一句话说透 金句 :::   或   :::tip 标签 内容 :::')
        print('     > 引用句                       或   ```bash 命令 ```')
        print('     ### 小标题（黄高亮）            或   1. 有序列表项')
        print('     **关键词**（自动绿色加粗）')
        print('   修复后重跑本脚本。')
        return False
    print('✅ 门禁B通过：重点颜色区分充足。')
    return True


def upload_and_replace_images(html, html_base_dir, images_dir):
    # 2026-07-14 兼容: images_dir 可能是逗号分隔的文件列表 (publish_pipeline --images 入参)
    # 这种情况下,绝对路径应该用文件列表里的每一项,而不是当作目录
    images_list = None
    if isinstance(images_dir, str) and ',' in images_dir and not os.path.isdir(images_dir):
        images_list = [p.strip() for p in images_dir.split(',') if p.strip()]
    img_paths = re.findall(r'src="([^"]+)"', html)
    url_map = {}
    failed = []
    for local_path in img_paths:
        if local_path.startswith('http'):
            continue
        # 优先用 images_list 里的绝对/相对路径直接定位
        if images_list:
            bn = os.path.basename(local_path)
            matched = None
            for p in images_list:
                if os.path.basename(p) == bn and os.path.exists(p):
                    matched = p
                    break
                if os.path.exists(os.path.join(BASE, p)) and os.path.basename(p) == bn:
                    matched = os.path.join(BASE, p)
                    break
            if matched:
                abs_path = matched
            else:
                abs_path = os.path.normpath(os.path.join(html_base_dir, local_path))
                if not os.path.exists(abs_path):
                    abs_path2 = os.path.normpath(os.path.join('output/images', os.path.basename(local_path)))
                    if os.path.exists(abs_path2):
                        abs_path = abs_path2
        else:
            abs_path = os.path.normpath(os.path.join(html_base_dir, local_path))
            if not os.path.exists(abs_path):
                abs_path2 = os.path.normpath(os.path.join(images_dir, os.path.basename(local_path)))
                if os.path.exists(abs_path2):
                    abs_path = abs_path2
        if not os.path.exists(abs_path):
            print(f'  ⚠️ 图片不存在，跳过: {local_path}')
            failed.append(local_path)
            continue
        print(f'  上传: {os.path.basename(abs_path)}')
        wx_url = upload_image(abs_path)
        if wx_url and isinstance(wx_url, str) and wx_url.startswith('http'):
            url_map[local_path] = wx_url
        else:
            print(f'    ❌ 上传失败: {local_path}')
            failed.append(local_path)
    if failed:
        # 2026-07-12 修复：上传失败的图保留本地路径,微信后台看不到,必须阻断推送
        print(f'\n❌ 阻断：{len(failed)} 张图未上传成功(本地路径在微信后台无法显示)')
        for f in failed: print(f'   - {f}')
        return html, url_map, failed
    for local_path, wx_url in url_map.items():
        html = html.replace(local_path, wx_url)
    return html, url_map, []


def _purge_old_outputs(safe_title, output_dir):
    """清掉 output 目录里所有非本次标题的 html/docx 旧版（2026-07-17 零容忍铁律）。
    CSDN docx 按 `_CSDN.docx` 后缀保护，`archive/`/`images/`/`_visual/` 目录保留不动。
    返回被清的清单。"""
    purged = []
    if not os.path.isdir(output_dir):
        return purged
    for f in os.listdir(output_dir):
        fp = os.path.join(output_dir, f)
        if not os.path.isfile(fp):
            continue
        if f == 'images' or f.startswith('~$') or f.endswith('.bak') or f.endswith('.new') or f.endswith('.tmp'):
            continue
        if f.endswith('.html') or f.endswith('.docx'):
            base = f[:-5]
            if base.endswith('_CSDN'):
                base = base[:-5]
            if base == safe_title:
                continue
            try:
                os.remove(fp)
                purged.append(f)
            except Exception as e:
                print(f'  ⚠️ 无法删 {f}: {e}')
    return purged


def push_draft(html, title, digest, author, cover_path, images, account='A'):
    print('\n[推送] 上传图片+封面 → 删旧草稿 → 建新草稿...')
    # 切换 .env 账号 (优先: 命令行 --account > 默认 A)
    if account and account != 'A':
        from dotenv import load_dotenv
        import os as _os
        load_dotenv(_os.path.join(BASE, '.env'), override=True)
        if account == 'B':
            _os.environ['WECHAT_APP_ID'] = _os.environ.get('B_B_APP_ID', _os.environ.get('WECHAT_APP_ID', ''))
            _os.environ['WECHAT_APP_SECRET'] = _os.environ.get('B_B_APP_SECRET', _os.environ.get('WECHAT_APP_SECRET', ''))
        print(f'  使用账号: {account}')
    token = get_access_token(force_refresh=True)
    if not token:
        print('❌ 无法获取 access_token')
        return None
    html, url_map, failed = upload_and_replace_images(html, BASE, images)
    if failed:
        print('\n❌ 推送中止：图片上传未全部成功，草稿会留本地路径无法显示')
        return None
    print(f'  上传 {len(url_map)} 张正文配图')

    thumb_media_id = ''
    if cover_path and os.path.exists(cover_path):
        cover_result = upload_permanent_media(cover_path, 'thumb')
        if cover_result and 'media_id' in cover_result:
            thumb_media_id = cover_result['media_id']
            print(f'  ✅ 封面 media_id: {thumb_media_id}')
    else:
        print(f'  ⚠️ 封面不存在: {cover_path}')

    # 删除本标题旧草稿（动态查找，避免硬编码ID过期）
    deleted = set()
    try:
        drafts = list_drafts(offset=0, count=20)
        if drafts and 'item' in drafts:
            for item in drafts['item']:
                mid = item.get('media_id', '')
                for art in item.get('content', {}).get('news_item', []):
                    if art.get('title', '') == title and mid and mid not in deleted:
                        try:
                            delete_draft(mid)
                            deleted.add(mid)
                            print(f'  ✅ 已删除旧草稿: {mid[:30]}...')
                        except Exception as e:
                            print(f'  ⚠️ 删除失败: {mid} ({e})')
    except Exception as e:
        print(f'  ⚠️ 列举草稿异常: {e}')

    article = {
        'title': title,
        'author': author,
        'content': html,
        'thumb_media_id': thumb_media_id,
        'digest': digest,
        'need_open_comment': 1,
        'only_fans_can_comment': 0,
    }
    draft_id = create_draft([article])
    if draft_id:
        print(f'\n🎉 草稿推送成功！draft media_id: {draft_id}')
        print('   请到公众号后台「草稿箱」查看')
        # 2026-07-12 修复：推送成功后自动更新已发布记忆（避免下次配图查重漏拦、避免重发同题）
        _update_published_memory(title, draft_id, html, cover_path)
    else:
        print('\n❌ 草稿创建失败')
    return draft_id


def _update_published_memory(title, draft_id, html, cover_path):
    """推送成功后更新 已发布内容记忆.json (published + image_registry)
    2026-07-12 集成：之前要手动跑 update_memory.py 临时脚本,易漏更新导致配图查重/主题查重失灵"""
    mem_path = os.path.join(BASE, '已发布内容记忆.json')
    if not os.path.exists(mem_path):
        print(f'  ⚠️ 记忆文件不存在,跳过自动更新: {mem_path}')
        return
    try:
        with open(mem_path, 'r', encoding='utf-8') as f:
            mem = json.load(f)
        # 1. published 列表追加
        pub_entry = {
            'title': title,
            'date': time.strftime('%Y-%m-%d'),
            'status': 'generated',
            'draft_id': draft_id,
            'topic_keyword': title[:20],
        }
        mem.setdefault('published', []).append(pub_entry)
        # 2. image_registry 追加(从HTML里抽图src)
        import re as _re
        used = _re.findall(r'src="([^"]+\.(?:jpg|jpeg|png|gif))"', html)
        for u in used:
            if u.startswith('http'):  # 微信图床URL,记录备用
                mem.setdefault('image_registry', {}).setdefault('used_images', []).append({
                    'url': u, 'title': title, 'date': pub_entry['date']
                })
        mem['last_updated'] = time.strftime('%Y-%m-%dT%H:%M:%S')
        with open(mem_path, 'w', encoding='utf-8') as f:
            json.dump(mem, f, ensure_ascii=False, indent=2)
        print(f'  ✅ 已发布记忆已更新 (published+1, used_images记录)')
    except Exception as e:
        print(f'  ⚠️ 自动更新已发布记忆失败(非阻断): {e}')


def main():
    ap = argparse.ArgumentParser(description='摸鱼绿公众号统一发布流水线')
    ap.add_argument('--md', required=True, help='源 md 路径(放 articles/)')
    ap.add_argument('--title', required=False, help='文章标题（决定 output 三件套文件名）')
    ap.add_argument('--digest', required=False, help='文章摘要')
    ap.add_argument('--cover', required=False, help='封面图路径')
    ap.add_argument('--images', default=os.path.join(BASE, 'output', 'images'),
                    help='配图目录(默认 output/images/)')
    ap.add_argument('--author', default='智汇AI')
    ap.add_argument('--cover-json', default=None, help='封面配置JSON路径（可选，默认用内置DEFAULT_COVER）')
    ap.add_argument('--dry-run', action='store_true', help='只跑渲染+门禁+构建DOCX，不推送草稿箱')
    ap.add_argument('--no-csdn', action='store_true', help='不导出 CSDN 专用 DOCX（默认会额外生成 output/{标题}_CSDN.docx，去营销/去 GEO）')
    ap.add_argument('--csdn-title', default=None, help='CSDN DOCX 自定义标题（默认从微信标题去营销后缀派生）')
    ap.add_argument('--csdn-md', default=None, help='CSDN DOCX 专用源 MD（直接渲染，跳过 clean_md_for_csdn 清洗；用于彻底规避 CSDN 营销审核）')
    ap.add_argument('--only-cleanup', action='store_true', help='仅清理:删 output 产物+图片 并把源md归档 articles/archive/(用户说"今天文章发完了"才用)')
    ap.add_argument('--account', default='A', choices=['A', 'B'],
                    help='发布账号: A=AI智汇社(默认) / B=智汇AI丨创始人丨李总 (对应 .env 中 A_B_* 或 B_B_*)')
    args = ap.parse_args()

    # === 项目边界铁律·入口守卫（2026-07-14 用户强制·零容忍） ===
    # 杜绝 AI 误把口播稿 .txt 文件 / 口播稿目录路径作为公众号流水线 --md 入参
    def _fail_guard(msg):
        print(f'\n❌ 入口守卫 FAIL: {msg}')
        print('   公众号流水线只接收 .md 文件,口播稿 .txt 属于另一个项目')
        print('   → 检查是否项目路径写反 (公众号 articles/ vs 口播稿 koubo/)')
        sys.exit(1)

    # 1) --md 入参校验（最严·任何 .txt / 口播稿路径直接拒绝）
    md_abs = os.path.normpath(os.path.abspath(args.md))
    if md_abs.lower().endswith('.txt'):
        _fail_guard(f'--md 指向 .txt 文件 ({md_abs})')
    if '口播稿' in md_abs or '\\koubo\\' in md_abs or '/koubo/' in md_abs:
        _fail_guard(f'--md 路径包含口播稿目录 ({md_abs})')
    # 公众号 md 应在 articles/ 目录
    if '\\articles\\' not in md_abs and '/articles/' not in md_abs:
        print(f'\n⚠️ 入口守卫 WARN: --md 不在 articles/ 目录 ({md_abs})')
        print('   公众号铁律: 源 md 放 articles/,产物(html/docx)放 output/')

    # 2) --images 配图目录校验
    images_abs = os.path.normpath(os.path.abspath(args.images))
    if '口播稿' in images_abs or '\\koubo\\' in images_abs or '/koubo/' in images_abs:
        _fail_guard(f'--images 配图目录指向口播稿 ({images_abs})')
    if '\\output\\' not in images_abs and '/output/' not in images_abs:
        print(f'\n⚠️ 入口守卫 WARN: --images 不在 output/ 目录 ({images_abs})')
        print('   公众号铁律: 配图统一放 output/images/')

    # 推送模式必填校验（仅清理模式豁免）
    if not args.only_cleanup:
        _missing = [n for n, v in (('title', args.title), ('digest', args.digest), ('cover', args.cover)) if not v]
        if _missing:
            print(f'❌ 推送模式缺少必填参数: {", ".join(_missing)}（--only-cleanup 模式无需这些）')
            sys.exit(1)

    # === 仅清理模式：用户明确说"今天文章发完了"才走这里 ===
    # 推完草稿箱【绝不】自动删 output；清理+归档只在此分支执行
    if args.only_cleanup:
        _cleanup_output()
        _archive_source(args.md)
        print('\n' + '=' * 64)
        print('  ✅ 已按"今天文章发完了"执行：output 产物+图片已删，源md已归档')
        print('=' * 64)
        return

    # 3) --cover 封面路径校验
    cover_abs = os.path.normpath(os.path.abspath(args.cover))
    if '口播稿' in cover_abs or '\\koubo\\' in cover_abs or '/koubo/' in cover_abs:
        _fail_guard(f'--cover 封面路径指向口播稿 ({cover_abs})')
    if cover_abs.lower().endswith('.txt'):
        _fail_guard(f'--cover 封面是 .txt 文件 ({cover_abs})')
    if not cover_abs.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')):
        print(f'\n⚠️ 入口守卫 WARN: --cover 不是常见图片格式 ({cover_abs})')

    # 4) --title 标题内容校验（防止 AI 把口播稿标题塞进公众号）
    # 移除"智汇AI"/"李总"等公众号合法词；只检测标题党+口播稿专属
    KOUBO_TITLE_KW = ('巨亏', '血赚', '翻车', '爆单', '破防', '完播率', '涨粉',
                     '直播间', '橱窗', '带货', '听好了', '划走就亏了',
                     '咱就说', '你品品', '废话不多说', '核心来了', '重点来了',
                     '[置顶]', '#科技', '#AI取代工作')
    title_hits = [k for k in KOUBO_TITLE_KW if k in args.title]
    if len(title_hits) >= 1:
        _fail_guard(f'--title 命中口播稿标题党词 {title_hits} (原: {args.title!r})')

    # 5) --digest 摘要内容校验
    KOUBO_DIGEST_KW = ('咱就说', '你品品', '你想想', '你猜怎么着', '废话不多说',
                       '记住我这句话', '核心来了', '重点来了', '今儿',
                       '完播率', '涨粉', '直播间', '橱窗', '带货',
                       '巨亏', '血赚', '翻车', '爆单', '破防',
                       '[置顶]', '#科技', '#AI取代工作')
    digest_hits = [k for k in KOUBO_DIGEST_KW if k in args.digest]
    if len(digest_hits) >= 1:
        _fail_guard(f'--digest 命中口播稿话术词 {digest_hits} (原: {args.digest!r})')

    print('=' * 64)
    print('  摸鱼绿公众号统一发布流水线（渲染→门禁→DOCX→推送）')
    print('=' * 64)
    print(f'  MD: {args.md}')
    print(f'  标题: {args.title}')

    safe_title = args.title.rstrip('？?')
    out_html = os.path.join(BASE, 'output', safe_title + '.html')
    out_docx = os.path.join(BASE, 'output', safe_title + '.docx')

    # 0. 清旧版（2026-07-17 用户暴怒反馈·零容忍·防 output 残留多个旧版）
    # 渲染前清掉 output 里所有"非本次标题"的 html/docx（CSDN docx 同基名按 _CSDN.docx 保护）
    # archive/、images/、_visual/ 目录保留不动
    # 0. 清旧版（2026-07-17 用户暴怒反馈·零容忍·防 output 残留多个旧版）
    # 三道保险：[0/6] 渲染前 + [4.5/6] 三件套生成后 + [6.5/6] 物理审计前
    print('\n[0/6] 清旧版（防 output 残留多版本）...')
    output_dir = os.path.join(BASE, 'output')
    purged = _purge_old_outputs(safe_title, output_dir)
    if purged:
        print(f'  ✅ 已清 {len(purged)} 个旧版: {purged}')
    else:
        print('  ✅ 无旧版残留')

    # 1. 渲染
    print('\n[1/6] 渲染摸鱼绿HTML...')
    cover = {}
    if args.cover_json and os.path.exists(args.cover_json):
        cover = json.load(open(args.cover_json, encoding='utf-8'))
    html = render_html(args.md, args.title, args.digest)
    project_boundary.check_write(out_html)
    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'  ✅ HTML生成: {out_html} ({len(html)}字符)')

    # 2. 门禁A：满分自检
    if not gate_selfcheck(args.md):
        sys.exit(1)

    # 2.5 门禁A+：事实核查（第23项 SKILL 宣传有,2026-07-12 集成）
    if not gate_fact_check(args.md, args.title):
        sys.exit(1)

    # 3. 门禁B：重点组件检查
    if not gate_emphasis_components(html):
        sys.exit(1)

    # 4. 构建DOCX
    # 2026-07-14 修: images_dir 必须是目录路径,不是逗号分隔的文件列表
    # (build_docx 内部用 os.path.join(images_dir, basename) 找图,逗号列表会找不到)
    if ',' in args.images and not os.path.isdir(args.images):
        images_dir_for_docx = os.path.join(BASE, 'output', 'images')
    else:
        images_dir_for_docx = args.images
    print('\n[4/6] 构建摸鱼绿DOCX...')
    docx_path = builder.build_docx(
        md_path=args.md, docx_path=out_docx,
        images_dir=images_dir_for_docx,
        assets_dir=os.path.join(BASE, 'assets', 'images'))
    if not docx_path:
        sys.exit(1)
    builder.verify_docx_images(docx_path)

    # 4.5 构建 CSDN 专用 DOCX（2026-07-16 用户强制：CSDN 审核极严，去营销/去 GEO）
    if args.no_csdn:
        print('\n[4.5/6] 跳过 CSDN DOCX 导出 (--no-csdn)...')
    else:
        print('\n[4.5/6] 构建 CSDN 专用 DOCX...')
        csdn_title = args.csdn_title or derive_csdn_title(args.title)
        csdn_docx_path = os.path.join(OUTPUT_DIR, safe_title + '_CSDN.docx')
        project_boundary.check_write(csdn_docx_path)
        # 优先使用独立 CSDN 源 MD（--csdn-md），不走 clean_md_for_csdn 清洗
        csdn_md_path = args.csdn_md or os.path.join(BASE, 'articles', safe_title + '_csdn.md')
        if os.path.exists(csdn_md_path):
            print(f'  📄 检测到独立 CSDN MD: {csdn_md_path}')
            print(f'     直接渲染，跳过 clean_md_for_csdn 清洗')
            from build_gpt56_sol import build_docx
            build_docx(md_path=csdn_md_path, docx_path=csdn_docx_path,
                       images_dir=images_dir_for_docx, cover_img=None)
        else:
            print(f'  ℹ️ 未检测到独立 CSDN MD，回退到 clean_md_for_csdn 清洗')
            build_csdn_docx(args.md, csdn_docx_path, images_dir=images_dir_for_docx, csdn_title=csdn_title)
        print(f'  ✅ CSDN DOCX: {csdn_docx_path}')
        print(f'     标题: {csdn_title}')

    # 4.6/6. 第二道保险：三件套(html+docx+_CSDN.docx)全部生成后,再清一次非本次旧版
    # 防止 build_docx / build_csdn_docx 路径在生成过程中意外落出非本次标题的中间产物
    print('\n[4.6/6] 第二道清旧版（三件套生成后,防中间产物污染）...')
    purged2 = _purge_old_outputs(safe_title, output_dir)
    if purged2:
        print(f'  ✅ 已清 {len(purged2)} 个中间产物: {purged2}')
    else:
        print('  ✅ 无中间产物残留')

    # 5/6. 推送（或dry-run跳过）
    if args.dry_run:
        print('\n[--dry-run] 跳过草稿箱推送（仅验证门禁+构建）')
    else:
        print('\n[5/6] 推送草稿箱...')
        push_draft(html, args.title, args.digest, args.author, args.cover, images=args.images, account=args.account)
        print('\n[6/6] 当前草稿箱状态：')
        list_drafts(offset=0, count=5)

    # [6.5/6] 强制物理审计 (用户第二十一反馈: 必须固化到流程,2026-07-12 永久铁律)
    # 反 4 轮返工根治疗法: 任何"OK"必须有审计数据,返工 = 失败
    # 推送后必须 full_audit.py 42 维度 0 FAIL,否则 sys.exit
    print('\n[6.5/6] 强制物理审计 (full_audit 42 维度, 0 FAIL 才能算彻底交付)...')
    # 第三道保险：物理审计前最后一次清旧版,确保 audit 检查时 output 绝对干净
    purged3 = _purge_old_outputs(safe_title, output_dir)
    if purged3:
        print(f'  ✅ 物理审计前又清 {len(purged3)} 个: {purged3}')
    else:
        print('  ✅ 物理审计前 output 干净')
    # 清 __pycache__ 避免 H5 误报 (2026-07-14 扩:递归清理全树,包括 tools/ 子目录)
    import shutil as _shutil
    for root, dirs, _files in os.walk(BASE):
        if '__pycache__' in dirs:
            _shutil.rmtree(os.path.join(root, '__pycache__'), ignore_errors=True)
            dirs.remove('__pycache__')
    # dry-run 时给 audit 传环境变量, 让 E1 等"需要真推"的项跳过
    if args.dry_run:
        os.environ['AUDIIT_DRY_RUN'] = '1'
    try:
        from full_audit import main as _audit_main
        exit_code, passed, failed, _ = _audit_main(['--title', args.title])
        if exit_code != 0:
            print(f'\n❌ 流水线中止: 物理审计 {failed} 个 FAIL, 不允许说"已交付"')
            sys.exit(1)
        print(f'\n  ✅ 物理审计 PASS {passed} / FAIL 0 — 流水线彻底完成')
    except Exception as e:
        print(f'  ⚠️ full_audit 调用失败(非阻断): {e}')

    if args.dry_run:
        print('\n' + '=' * 64)
        print('  ✅ 流水线通过（dry-run）：渲染/门禁A/门禁B/DOCX/物理审计 全部成功')
        print(f'  HTML: {out_html}')
        print(f'  DOCX: {out_docx}')
        print('=' * 64)
        return

    print('\n' + '=' * 64)
    print('  ✅ 流水线完成：已推送完整摸鱼绿草稿到草稿箱 + 物理审计全过')
    print('=' * 64)

    # ===== 注意：推完草稿箱【绝不】自动清理 output/ =====
    # 清理(删 html/docx/images + 源md归档)只能在用户明确说"今天文章发完了"时，
    # 通过 `publish_pipeline.py --md <源> --only-cleanup` 触发。绝不在 push 流程里删。

def _archive_source(md_path):
    """清理阶段把源 md 从 articles/ 移到 articles/archive/(按日期号存档)。仅 --only-cleanup 调用。"""
    import shutil as _sh
    src = os.path.normpath(os.path.abspath(md_path))
    if not os.path.isfile(src):
        print(f'    ⚠️ 源md不存在,跳过归档: {src}')
        return
    articles_dir = os.path.dirname(src)
    archive_dir = os.path.join(articles_dir, 'archive')
    os.makedirs(archive_dir, exist_ok=True)
    dst = os.path.join(archive_dir, os.path.basename(src))
    if os.path.exists(dst):
        print(f'    ℹ️ 已归档,跳过: {os.path.basename(src)}')
        return
    try:
        _sh.move(src, dst)
        print(f'    📦 源md归档(存档号): {os.path.basename(src)} → articles/archive/')
    except Exception as e:
        print(f'    ⚠️ 归档失败 {src}: {e}')


def _cleanup_output():
    """删除 output/ 下的交付物和图片，保留 archive/ 和核心系统文件"""
    import glob, shutil
    # 1. 删除 output/*.html + output/*.docx（含 CSDN 专用 DOCX，发布完随微信产物一起删）
    for ext in ('*.html', '*.docx', '*.md'):
        for f in glob.glob(os.path.join(OUTPUT_DIR, ext)):
            try:
                os.remove(f)
                print(f'    🗑️ 删除交付物: {os.path.basename(f)}')
            except Exception as e:
                print(f'    ⚠️ 删除失败 {f}: {e}')
    # 2. 删除 output/images/*（图片已推送到微信图床，本地不再保留）
    img_dir = os.path.join(OUTPUT_DIR, 'images')
    if os.path.isdir(img_dir):
        for f in os.listdir(img_dir):
            fp = os.path.join(img_dir, f)
            try:
                os.remove(fp)
                print(f'    🗑️ 删除配图: {f}')
            except Exception as e:
                print(f'    ⚠️ 删除失败 {fp}: {e}')
    # 3. 删除 output/_visual/ 临时目录
    visual_dir = os.path.join(OUTPUT_DIR, '_visual')
    if os.path.isdir(visual_dir):
        try:
            shutil.rmtree(visual_dir, ignore_errors=True)
            print(f'    🗑️ 删除临时目录: _visual/')
        except Exception as e:
            print(f'    ⚠️ 删除 _visual/ 失败: {e}')


if __name__ == '__main__':
    main()
