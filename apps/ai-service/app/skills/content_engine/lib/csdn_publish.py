# -*- coding: utf-8 -*-
"""
CSDN自动发布工具（零外部依赖）
功能：Cookie认证 + 签名生成 + 图片上传 + 文章发布/草稿
用法：python lib/csdn_publish.py

对应AGENTS.md工作流：Markdown写完 → CSDN适配改写 → 本工具自动发布
注意：CSDN没有官方发布API，本工具使用逆向的内部HTTP接口，接口可能随时变化。
"""
import hashlib
import hmac
import json
import mimetypes
import os
import random
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from base64 import b64encode

# ===== 常量 =====
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# CSDN内部API（逆向自editor.csdn.net，非官方公开接口）
CSDN_APP_KEY = '203803574'
CSDN_APP_SECRET = '9znpamsyl2c7cdrr9sas0le9vbc3r6ba'
CSDN_SAVE_URL = 'https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle'
CSDN_IMG_PARAMS_URL = 'https://imgservice.csdn.net/direct/v1.0/image/upload'
CSDN_ARTICLE_LIST_URL = 'https://bizapi.csdn.net/blog-console-api/v3/editor/articles'

# 浏览器UA（模拟Chrome）
USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/126.0.0.0 Safari/537.36'
)


# ===== 配置加载 =====

def _load_env():
    """从.env文件加载配置"""
    env_path = os.path.join(PROJECT_ROOT, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    key, val = line.split('=', 1)
                    os.environ.setdefault(key.strip(), val.strip())
    return os.environ.get('CSDN_COOKIE', '')


def _get_cookie():
    """获取CSDN Cookie"""
    cookie = _load_env()
    if not cookie:
        print('❌ 未配置CSDN_COOKIE，请在.env文件中设置')
        print('   获取方法：浏览器登录CSDN → F12 → Network → 任意请求 → 复制Cookie头')
        print('   在.env中添加：CSDN_COOKIE=你的完整Cookie字符串')
        return ''
    return cookie


# ===== 签名算法 =====

def _create_uuid():
    """生成CSDN要求的UUID（字符池限定a-f和1-9）"""
    chars = [chr(c) for c in range(97, 103)] + [chr(c) for c in range(49, 58)]
    text = ''
    for ch in 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx':
        if ch == '4':
            text += '4'
        elif ch == '-':
            text += '-'
        else:
            text += random.choice(chars)
    return text


def _sign_post(nonce, url_path):
    """
    生成POST请求的x-ca-signature。
    签名串格式（每行\\n分隔）：
      POST
      */*
      （空，Content-MD5不参与）
      application/json
      （空，Date不参与）
      x-ca-key:203803574
      x-ca-nonce:{uuid}
      {url_path}
    """
    to_sign = (
        f'POST\n'
        f'*/*\n'
        f'\n'
        f'application/json\n'
        f'\n'
        f'x-ca-key:{CSDN_APP_KEY}\n'
        f'x-ca-nonce:{nonce}\n'
        f'{url_path}'
    ).encode('utf-8')
    secret = CSDN_APP_SECRET.encode('utf-8')
    sig = b64encode(
        hmac.new(secret, to_sign, digestmod=hashlib.sha256).digest()
    ).decode('utf-8')
    return sig


def _sign_get(nonce, url_path, query_string):
    """
    生成GET请求的x-ca-signature。
    签名串格式：
      GET
      */*
      （空）
      （空，GET无Content-Type）
      （空）
      x-ca-key:203803574
      x-ca-nonce:{uuid}
      {path}?{query去掉最后一个字符}
    """
    qs = query_string[:-1] if query_string else ''
    to_sign = (
        f'GET\n'
        f'*/*\n'
        f'\n'
        f'\n'
        f'\n'
        f'x-ca-key:{CSDN_APP_KEY}\n'
        f'x-ca-nonce:{nonce}\n'
        f'{url_path}?{qs}'
    ).encode('utf-8')
    secret = CSDN_APP_SECRET.encode('utf-8')
    sig = b64encode(
        hmac.new(secret, to_sign, digestmod=hashlib.sha256).digest()
    ).decode('utf-8')
    return sig


def _build_headers(url, method='POST'):
    """构建带签名的完整请求头"""
    nonce = _create_uuid()
    parsed = urllib.parse.urlparse(url)
    url_path = parsed.path

    if method == 'POST':
        signature = _sign_post(nonce, url_path)
    else:
        signature = _sign_get(nonce, url_path, parsed.query)

    cookie = _get_cookie()
    if not cookie:
        return None

    headers = {
        'Accept': '*/*',
        'User-Agent': USER_AGENT,
        'Origin': 'https://editor.csdn.net',
        'Referer': 'https://editor.csdn.net/',
        'cookie': cookie,
        'x-ca-key': CSDN_APP_KEY,
        'x-ca-nonce': nonce,
        'x-ca-signature': signature,
        'x-ca-signature-headers': 'x-ca-key,x-ca-nonce',
    }
    if method == 'POST':
        headers['Content-Type'] = 'application/json'

    return headers


# ===== HTTP工具函数 =====

def _api_post_json(url, data):
    """POST JSON请求，返回响应JSON"""
    headers = _build_headers(url, 'POST')
    if not headers:
        return {'code': -1, 'msg': 'Cookie未配置'}

    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='replace')
        print(f'  HTTP {e.code}: {error_body[:200]}')
        return {'code': e.code, 'msg': error_body[:200]}
    except urllib.error.URLError as e:
        return {'code': -1, 'msg': str(e)}


def _api_get_json(url):
    """GET请求，返回响应JSON"""
    headers = _build_headers(url, 'GET')
    if not headers:
        return {'code': -1, 'msg': 'Cookie未配置'}

    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='replace')
        print(f'  HTTP {e.code}: {error_body[:200]}')
        return {'code': e.code, 'msg': error_body[:200]}
    except urllib.error.URLError as e:
        return {'code': -1, 'msg': str(e)}


# ===== 图片上传（两步：获取参数→上传OSS） =====

def _get_image_upload_params(suffix='png'):
    """
    Step 1: 向CSDN图片服务获取OSS上传参数。
    返回 {accessId, policy, signature, filePath, host, callbackUrl} 或 None。
    """
    url = f'{CSDN_IMG_PARAMS_URL}?watermark=&type=blog&rtype=markdown'
    cookie = _get_cookie()
    if not cookie:
        return None

    headers = {
        'X-Image-App': 'direct_blog',
        'X-Image-Suffix': suffix,
        'cookie': cookie,
        'User-Agent': USER_AGENT,
    }
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
        if result.get('code') == 200:
            return result.get('data')
        else:
            print(f'  获取上传参数失败: {result.get("msg", "未知错误")}')
            return None
    except Exception as e:
        print(f'  获取上传参数异常: {e}')
        return None


def _upload_to_oss(params, image_path):
    """
    Step 2: 用Step 1拿到的参数，把图片POST到阿里云OSS。
    返回图片URL或None。
    """
    filename = os.path.basename(image_path)
    content_type = mimetypes.guess_type(image_path)[0] or 'image/png'

    with open(image_path, 'rb') as f:
        file_data = f.read()

    boundary = '----WebKitFormBoundary' + ''.join(
        random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', k=16)
    )

    fields = [
        ('OSSAccessKeyId', params['accessId']),
        ('policy', params['policy']),
        ('key', params['filePath']),
        ('success_action_status', '200'),
        ('signature', params['signature']),
        ('callback', params.get('callbackUrl', '')),
    ]

    body = b''
    for name, value in fields:
        body += (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f'{value}\r\n'
        ).encode('utf-8')

    body += (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: {content_type}\r\n\r\n'
    ).encode('utf-8') + file_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    oss_url = params['host']
    req = urllib.request.Request(
        oss_url, data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp_text = resp.read().decode('utf-8')
        # OSS callback返回的JSON里包含imageUrl
        resp_json = json.loads(resp_text)
        if 'data' in resp_json and 'imageUrl' in resp_json['data']:
            return resp_json['data']['imageUrl']
        elif 'imageUrl' in resp_json:
            return resp_json['imageUrl']
        # 有些情况URL在filePath拼接
        if 'AccessDenied' in resp_text:
            print('  OSS参数过期，需要重新获取')
            return None
        print(f'  OSS响应异常: {resp_text[:200]}')
        return None
    except Exception as e:
        print(f'  OSS上传异常: {e}')
        return None


def upload_image(image_path):
    """上传图片到CSDN图床，返回图片URL"""
    if not os.path.exists(image_path):
        print(f'❌ 图片文件不存在: {image_path}')
        return None

    suffix = os.path.splitext(image_path)[1].lstrip('.').lower() or 'png'
    print(f'--- 上传图片: {os.path.basename(image_path)} ---')

    # Step 1: 获取OSS参数
    params = _get_image_upload_params(suffix)
    if not params:
        print('❌ 获取上传参数失败')
        return None

    # Step 2: 上传到OSS
    url = _upload_to_oss(params, image_path)
    if url:
        print(f'✅ 图片上传成功: {url}')
        return url

    # 参数可能过期，重试一次
    print('  首次上传失败，重新获取参数后重试...')
    params = _get_image_upload_params(suffix)
    if params:
        url = _upload_to_oss(params, image_path)
        if url:
            print(f'✅ 图片上传成功（重试）: {url}')
            return url

    print('❌ 图片上传失败')
    return None


# ===== 文章发布 =====

def publish_article(title, markdown_content, html_content='',
                    tags='', status=0, article_type='original',
                    read_type='public', description=''):
    """
    发布文章到CSDN。
    参数：
      title: 标题（5-100字）
      markdown_content: Markdown原文
      html_content: HTML渲染内容（空字符串则CSDN自动渲染）
      tags: 标签，逗号分隔（如"Python,AI,工具"）
      status: 0=立即发布，1=存为草稿
      article_type: "original"原创 / "repost"转载
      read_type: "public"公开 / "private"私密 / "need_vip"付费
      description: 摘要（空则CSDN自动截取）
    返回：
      成功时返回 {url, article_id}，失败返回None
    """
    cookie = _get_cookie()
    if not cookie:
        return None

    if len(title) < 5 or len(title) > 100:
        print(f'⚠️ 标题长度不符: {len(title)}字（要求5-100字）')

    body = {
        'title': title,
        'markdowncontent': markdown_content,
        'content': html_content,
        'readType': read_type,
        'tags': tags,
        'status': status,
        'type': article_type,
        'source': 'pc_mdeditor',
        'cover_type': 1,
    }

    status_text = '发布' if status == 0 else '存为草稿'
    print(f'\n===== CSDN文章{status_text} =====')
    print(f'标题: {title}')
    print(f'标签: {tags or "无"}')
    print(f'类型: {article_type} / {read_type}')
    print(f'Markdown: {len(markdown_content)}字符')

    result = _api_post_json(CSDN_SAVE_URL, body)

    code = result.get('code', -1)
    if code == 200:
        data = result.get('data', {})
        article_url = data.get('url', '')
        article_id = data.get('id', data.get('article_id', ''))
        print(f'✅ {status_text}成功！')
        if article_url:
            print(f'   文章URL: {article_url}')
        if article_id:
            print(f'   文章ID: {article_id}')
        return {'url': article_url, 'article_id': article_id}
    else:
        msg = result.get('msg', result.get('message', '未知错误'))
        print(f'❌ {status_text}失败: {msg} (code={code})')
        if code == 401:
            print('   → Cookie可能已过期，请重新获取')
        return None


def save_draft(title, markdown_content, tags='', article_type='original', description=''):
    """保存为草稿（status=1的快捷方法）"""
    return publish_article(
        title, markdown_content,
        tags=tags, status=1, article_type=article_type,
        description=description
    )


# ===== 文章列表 =====

def list_articles(page=1, size=10):
    """获取文章列表"""
    cookie = _get_cookie()
    if not cookie:
        return None

    url = f'{CSDN_ARTICLE_LIST_URL}?pageNo={page}&pageSize={size}&type=all'
    result = _api_get_json(url)

    code = result.get('code', -1)
    if code == 200:
        data = result.get('data', {})
        articles = data.get('list', [])
        total = data.get('total', 0)
        print(f'\n✅ 文章列表（第{page}页，共{total}篇）：')
        for i, art in enumerate(articles):
            title = art.get('title', '无标题')
            art_id = art.get('articleId', art.get('id', ''))
            status_map = {0: '已发布', 1: '草稿'}
            st = status_map.get(art.get('status', 0), '未知')
            print(f'  {i + 1}. [{st}] {title} (ID={art_id})')
        return result
    else:
        msg = result.get('msg', result.get('message', '未知错误'))
        print(f'❌ 获取文章列表失败: {msg} (code={code})')
        if code == 401:
            print('   → Cookie可能已过期，请重新获取')
        return None


# ===== 测试连接 =====

def test_connection():
    """测试Cookie是否有效（尝试获取文章列表）"""
    cookie = _get_cookie()
    if not cookie:
        return False

    print('--- 测试CSDN连接 ---')
    url = f'{CSDN_ARTICLE_LIST_URL}?pageNo=1&pageSize=1&type=all'
    result = _api_get_json(url)
    code = result.get('code', -1)

    if code == 200:
        data = result.get('data', {})
        total = data.get('total', 0)
        print(f'✅ 连接正常，当前共{total}篇文章')
        return True
    elif code == 401:
        print('❌ Cookie已过期或无效，请重新获取')
        return False
    else:
        msg = result.get('msg', result.get('message', '未知错误'))
        print(f'❌ 连接失败: {msg} (code={code})')
        return False


# ===== Markdown图片替换 =====

def replace_local_images(markdown_text, image_dir=''):
    """
    扫描Markdown中的本地图片引用，上传到CSDN图床后替换为在线URL。
    返回替换后的Markdown文本。
    """
    pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    matches = pattern.findall(markdown_text)

    if not matches:
        return markdown_text

    replaced = markdown_text
    uploaded = 0

    for alt, img_path in matches:
        # 跳过已经是URL的图片
        if img_path.startswith(('http://', 'https://')):
            continue

        # 解析相对路径
        full_path = img_path
        if not os.path.isabs(img_path):
            if image_dir:
                full_path = os.path.join(image_dir, img_path)
            else:
                # 尝试从output目录解析
                full_path = os.path.join(PROJECT_ROOT, 'output', img_path)

        if not os.path.exists(full_path):
            print(f'  ⚠️ 本地图片不存在，跳过: {full_path}')
            continue

        url = upload_image(full_path)
        if url:
            old_ref = f'![{alt}]({img_path})'
            new_ref = f'![{alt}]({url})'
            replaced = replaced.replace(old_ref, new_ref)
            uploaded += 1

    if uploaded:
        print(f'\n✅ 共上传并替换了{uploaded}张本地图片')
    return replaced


# ===== 一键发布流程 =====

def auto_publish(md_file, title, tags='', html_file=None,
                 status=0, read_type='public', article_type='original'):
    """
    一键发布流程：
    1. 读取Markdown文件
    2. 扫描并上传本地图片
    3. 如果提供了HTML文件则用HTML内容，否则Markdown原文提交
    4. 调用发布接口
    """
    print(f'\n{"=" * 50}')
    print(f'  CSDN自动发布流程')
    print(f'{"=" * 50}')

    # 1. 读取文件
    if not os.path.exists(md_file):
        print(f'❌ Markdown文件不存在: {md_file}')
        return None

    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    print(f'✅ 读取Markdown: {len(md_content)}字符')

    # 2. 上传本地图片
    image_dir = os.path.dirname(os.path.abspath(md_file))
    md_content = replace_local_images(md_content, image_dir)

    # 3. HTML内容（可选）
    html_content = ''
    if html_file and os.path.exists(html_file):
        with open(html_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
        print(f'✅ 读取HTML: {len(html_content)}字符')

    # 4. 发布
    result = publish_article(
        title=title,
        markdown_content=md_content,
        html_content=html_content,
        tags=tags,
        status=status,
        article_type=article_type,
        read_type=read_type,
    )

    if result:
        print(f'\n🎉 CSDN发布流程完成！')
        if result.get('url'):
            print(f'   文章地址: {result["url"]}')
    else:
        print(f'\n⚠️ CSDN发布失败，请检查Cookie或手动发布')

    return result


# ===== Markdown标题提取 =====

def extract_title_from_md(md_file):
    """从Markdown文件中提取第一个#标题"""
    if not os.path.exists(md_file):
        return ''
    with open(md_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('# ') and not line.startswith('## '):
                return line.lstrip('# ').strip()
    return ''


# ===== CLI入口 =====

def main():
    if len(sys.argv) < 2:
        _print_help()
        return

    cmd = sys.argv[1]

    if cmd == 'test':
        test_connection()

    elif cmd == 'upload' and len(sys.argv) >= 3:
        upload_image(sys.argv[2])

    elif cmd == 'articles':
        page = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        list_articles(page=page)

    elif cmd == 'publish' and len(sys.argv) >= 3:
        md_file = sys.argv[2]
        title = sys.argv[3] if len(sys.argv) > 3 else extract_title_from_md(md_file)
        tags = sys.argv[4] if len(sys.argv) > 4 else ''
        html_file = sys.argv[5] if len(sys.argv) > 5 else None
        if not title:
            print('❌ 未指定标题且Markdown中未找到#标题，请手动指定')
            return
        auto_publish(md_file, title, tags=tags, html_file=html_file, status=0)

    elif cmd == 'draft' and len(sys.argv) >= 3:
        md_file = sys.argv[2]
        title = sys.argv[3] if len(sys.argv) > 3 else extract_title_from_md(md_file)
        tags = sys.argv[4] if len(sys.argv) > 4 else ''
        html_file = sys.argv[5] if len(sys.argv) > 5 else None
        if not title:
            print('❌ 未指定标题且Markdown中未找到#标题，请手动指定')
            return
        auto_publish(md_file, title, tags=tags, html_file=html_file, status=1)

    elif cmd == 'auto' and len(sys.argv) >= 3:
        # auto命令：自动从MD提取标题发布
        md_file = sys.argv[2]
        title = extract_title_from_md(md_file)
        tags = sys.argv[3] if len(sys.argv) > 3 else ''
        html_file = sys.argv[4] if len(sys.argv) > 4 else None
        if not title:
            print('❌ Markdown中未找到#标题，请用publish命令手动指定标题')
            return
        auto_publish(md_file, title, tags=tags, html_file=html_file, status=0)

    else:
        print(f'未知命令: {cmd}')
        _print_help()


def _print_help():
    print('CSDN自动发布工具（零依赖，纯stdlib）')
    print()
    print('前置条件：在 .env 中配置 CSDN_COOKIE=<浏览器Cookie>')
    print('  获取方法：浏览器登录CSDN → F12 → Network → 复制Cookie头')
    print()
    print('用法:')
    print('  python lib/csdn_publish.py test                          # 测试Cookie连接')
    print('  python lib/csdn_publish.py upload <图片路径>               # 上传图片到CSDN图床')
    print('  python lib/csdn_publish.py articles [页码]                # 查看文章列表')
    print('  python lib/csdn_publish.py publish <md> [标题] [标签] [html]  # 发布文章')
    print('  python lib/csdn_publish.py draft <md> [标题] [标签] [html]    # 存为草稿')
    print('  python lib/csdn_publish.py auto <md> [标签] [html]          # 自动提取标题发布')
    print()
    print('示例:')
    print('  python lib/csdn_publish.py test')
    print('  python lib/csdn_publish.py publish output/文章.md "AI工具实测" "AI,Python"')
    print('  python lib/csdn_publish.py draft output/文章.md "文章标题" "AI,工具"')
    print('  python lib/csdn_publish.py auto output/文章.md "AI,Python" output/文章.html')
    print()
    print('注意事项:')
    print('  1. CSDN无官方发布API，本工具使用逆向接口，可能随时失效')
    print('  2. Cookie有效期约数天到数周，过期后需重新获取')
    print('  3. 建议先用draft命令存草稿，确认无误后再手动发布')
    print('  4. 备选方案：Wechatsync浏览器插件（GitHub 5400+ stars）支持31平台同步')


if __name__ == '__main__':
    main()
