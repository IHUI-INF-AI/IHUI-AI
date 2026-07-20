# -*- coding: utf-8 -*-
"""
微信公众号自动发布工具（零外部依赖）
功能：Token管理 + 素材上传 + 草稿箱 + 发布
用法：python lib/wechat_publish.py

对应AGENTS.md工作流：gzh-design排版HTML → 本工具自动上传发布
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
import mimetypes
import uuid

# ===== 配置 =====
# 在项目根目录的 .env 文件中设置（和现有API凭证放一起）：
# WECHAT_APP_ID=你的AppID
# WECHAT_APP_SECRET=你的AppSecret

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_CACHE = os.path.join(PROJECT_ROOT, '.wechat_token_cache.json')
API_BASE = 'https://api.weixin.qq.com/cgi-bin'


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
    return os.environ.get('WECHAT_APP_ID', ''), os.environ.get('WECHAT_APP_SECRET', '')


def _api_get(url):
    """GET请求，返回JSON"""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.URLError as e:
        return {'errcode': -1, 'errmsg': str(e)}


def _api_post_json(url, data):
    """POST JSON请求"""
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.URLError as e:
        return {'errcode': -1, 'errmsg': str(e)}


def _multipart_upload(url, filepath, field='media', content_type=None):
    """multipart/form-data文件上传"""
    boundary = uuid.uuid4().hex
    filename = os.path.basename(filepath)
    if not content_type:
        content_type = mimetypes.guess_type(filepath)[0] or 'application/octet-stream'

    with open(filepath, 'rb') as f:
        file_data = f.read()

    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f'Content-Type: {content_type}\r\n\r\n'
    ).encode('utf-8') + file_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.URLError as e:
        return {'errcode': -1, 'errmsg': str(e)}


# ===== Token管理 =====

def get_access_token(force_refresh=False):
    """获取access_token，自动缓存2小时"""
    app_id, app_secret = _load_env()
    if not app_id or not app_secret:
        print('❌ 未配置WECHAT_APP_ID或WECHAT_APP_SECRET，请在.env文件中设置')
        return None

    # 检查缓存
    if not force_refresh and os.path.exists(TOKEN_CACHE):
        try:
            with open(TOKEN_CACHE, 'r') as f:
                cache = json.load(f)
            if cache.get('expires_at', 0) > time.time() + 300:  # 提前5分钟刷新
                return cache['access_token']
        except (json.JSONDecodeError, KeyError):
            pass

    # 请求新token
    url = f'{API_BASE}/token?grant_type=client_credential&appid={app_id}&secret={app_secret}'
    result = _api_get(url)

    if 'access_token' in result:
        cache = {
            'access_token': result['access_token'],
            'expires_at': time.time() + result.get('expires_in', 7200)
        }
        with open(TOKEN_CACHE, 'w') as f:
            json.dump(cache, f)
        print(f'✅ access_token获取成功（有效期{result.get("expires_in", 7200)}秒）')
        return result['access_token']
    else:
        print(f'❌ 获取token失败: {result.get("errmsg", "未知错误")} (errcode={result.get("errcode")})')
        return None


# ===== 素材上传 =====

def upload_image(image_path):
    """上传文章内图片（不占素材库配额，返回URL）"""
    token = get_access_token()
    if not token:
        return None
    url = f'{API_BASE}/media/uploadimg?access_token={token}'
    result = _multipart_upload(url, image_path)
    if 'url' in result:
        print(f'✅ 图片上传成功: {result["url"][:60]}...')
        return result['url']
    else:
        print(f'❌ 图片上传失败: {result.get("errmsg", "未知错误")}')
        return None


def upload_media(media_path, media_type='image'):
    """上传临时素材（image/voice/video/thumb）"""
    token = get_access_token()
    if not token:
        return None
    url = f'{API_BASE}/media/upload?access_token={token}&type={media_type}'
    result = _multipart_upload(url, media_path)
    if 'media_id' in result:
        print(f'✅ 素材上传成功: media_id={result["media_id"]}')
        return result
    else:
        print(f'❌ 素材上传失败: {result.get("errmsg", "未知错误")}')
        return None


def upload_permanent_media(media_path, media_type='image'):
    """上传永久素材"""
    token = get_access_token()
    if not token:
        return None
    url = f'{API_BASE}/material/add_material?access_token={token}&type={media_type}'
    result = _multipart_upload(url, media_path)
    if 'media_id' in result:
        print(f'✅ 永久素材上传成功: media_id={result["media_id"]}')
        return result
    else:
        print(f'❌ 永久素材上传失败: {result.get("errmsg", "未知错误")}')
        return None


# ===== 草稿箱 =====

def create_draft(articles):
    """
    创建草稿。articles是文章列表，每篇格式：
    {
        "title": "标题",
        "author": "作者",
        "content": "<section>HTML正文</section>",
        "thumb_media_id": "封面图media_id",
        "digest": "摘要",
        "content_source_url": "",  # 原文链接
        "need_open_comment": 0,
        "only_fans_can_comment": 0,
    }
    """
    token = get_access_token()
    if not token:
        return None
    url = f'{API_BASE}/draft/add?access_token={token}'
    data = {'articles': articles}
    result = _api_post_json(url, data)
    if 'media_id' in result:
        print(f'✅ 草稿创建成功: media_id={result["media_id"]}')
        return result['media_id']
    else:
        print(f'❌ 草稿创建失败: {result.get("errmsg", "未知错误")} (errcode={result.get("errcode")})')
        return None


def list_drafts(offset=0, count=10):
    """获取草稿列表"""
    token = get_access_token()
    if not token:
        return None
    url = f'{API_BASE}/draft/batchget?access_token={token}'
    data = {'offset': offset, 'count': count, 'no_content': 0}
    result = _api_post_json(url, data)
    if 'item' in result:
        print(f'✅ 草稿列表: 共{result.get("total_count", 0)}篇')
        for item in result['item']:
            for art in item.get('content', {}).get('news_item', []):
                print(f'  - {art.get("title", "无标题")} (media_id={item["media_id"]})')
        return result
    else:
        print(f'❌ 获取草稿失败: {result.get("errmsg", "未知错误")}')
        return None


def delete_draft(media_id):
    """删除草稿"""
    token = get_access_token()
    if not token:
        return False
    url = f'{API_BASE}/draft/delete?access_token={token}'
    result = _api_post_json(url, {'media_id': media_id})
    if result.get('errcode', 0) == 0:
        print(f'✅ 草稿已删除: {media_id}')
        return True
    else:
        print(f'❌ 删除草稿失败: {result.get("errmsg", "未知错误")}')
        return False


# ===== 发布 =====

def publish_draft(media_id):
    """提交草稿发布（异步，返回publish_id用于查询状态）"""
    token = get_access_token()
    if not token:
        return None
    url = f'{API_BASE}/freepublish/submit?access_token={token}'
    result = _api_post_json(url, {'media_id': media_id})
    if 'publish_id' in result:
        print(f'✅ 发布提交成功: publish_id={result["publish_id"]}')
        return result['publish_id']
    else:
        print(f'❌ 发布提交失败: {result.get("errmsg", "未知错误")} (errcode={result.get("errcode")})')
        return None


def check_publish_status(publish_id):
    """查询发布状态"""
    token = get_access_token()
    if not token:
        return None
    url = f'{API_BASE}/freepublish/get?access_token={token}'
    result = _api_post_json(url, {'publish_id': publish_id})
    status_map = {0: '发布中', 1: '已发布', 2: '原创审核不通过', 3: '常规审核不通过', 4: '平台审核不通过'}
    status = result.get('publish_status', -1)
    print(f'发布状态: {status_map.get(status, f"未知({status})")}')
    if status == 1 and 'article_id' in result:
        print(f'  article_id: {result["article_id"]}')
    return result


# ===== 一键发布流程 =====

def auto_publish(html_file, title, thumb_image=None, author='智汇AI', digest=''):
    """
    一键发布：HTML文件 → 上传封面 → 创建草稿 → 提交发布
    html_file: gzh-design生成的HTML文件路径
    title: 文章标题
    thumb_image: 封面图路径（可选）
    author: 作者名
    digest: 文章摘要
    """
    print(f'\n===== 公众号自动发布 =====')
    print(f'标题: {title}')
    print(f'HTML: {html_file}')

    # 1. 读取HTML内容
    if not os.path.exists(html_file):
        print(f'❌ HTML文件不存在: {html_file}')
        return None
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    print(f'✅ 读取HTML: {len(content)}字符')

    # 2. 上传封面图
    thumb_media_id = ''
    if thumb_image and os.path.exists(thumb_image):
        print(f'\n--- 上传封面图 ---')
        result = upload_permanent_media(thumb_image, 'thumb')
        if result:
            thumb_media_id = result.get('media_id', '')

    # 3. 创建草稿
    print(f'\n--- 创建草稿 ---')
    article = {
        'title': title,
        'author': author,
        'content': content,
        'thumb_media_id': thumb_media_id,
        'digest': digest or title,
        'need_open_comment': 1,
        'only_fans_can_comment': 0,
    }
    draft_id = create_draft([article])
    if not draft_id:
        return None

    # 4. 提交发布
    print(f'\n--- 提交发布 ---')
    publish_id = publish_draft(draft_id)
    if publish_id:
        print(f'\n🎉 发布流程完成！publish_id={publish_id}')
        print(f'   请在公众号后台确认发布状态')
        return {'draft_id': draft_id, 'publish_id': publish_id}
    else:
        print(f'\n⚠️ 草稿已创建但未发布，请手动到草稿箱发布')
        return {'draft_id': draft_id, 'publish_id': None}


# ===== CLI入口 =====

def main():
    if len(sys.argv) < 2:
        print('公众号自动发布工具')
        print('用法:')
        print('  python lib/wechat_publish.py token              # 测试token获取')
        print('  python lib/wechat_publish.py upload <图片路径>    # 上传图片')
        print('  python lib/wechat_publish.py drafts              # 查看草稿箱')
        print('  python lib/wechat_publish.py publish <html> <标题> [封面图]  # 一键发布')
        print('  python lib/wechat_publish.py status <publish_id>  # 查询发布状态')
        print('  python lib/wechat_publish.py delete <media_id>    # 删除草稿')
        return

    cmd = sys.argv[1]

    if cmd == 'token':
        token = get_access_token(force_refresh=True)
        if token:
            print(f'token: {token[:20]}...')

    elif cmd == 'upload' and len(sys.argv) >= 3:
        upload_image(sys.argv[2])

    elif cmd == 'drafts':
        list_drafts()

    elif cmd == 'publish' and len(sys.argv) >= 4:
        html_file = sys.argv[2]
        title = sys.argv[3]
        thumb = sys.argv[4] if len(sys.argv) > 4 else None
        auto_publish(html_file, title, thumb)

    elif cmd == 'status' and len(sys.argv) >= 3:
        check_publish_status(sys.argv[2])

    elif cmd == 'delete' and len(sys.argv) >= 3:
        delete_draft(sys.argv[2])

    else:
        print(f'未知命令: {cmd}')
        main()


if __name__ == '__main__':
    main()
