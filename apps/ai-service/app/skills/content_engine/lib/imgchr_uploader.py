# -*- coding: utf-8 -*-
"""
路过图床 (imgchr.com) 图片上传模块
API 文档：https://imgchr.com/page/api-docs.html
注册获取 Token：https://imgchr.com/login
"""
from __future__ import annotations

import os
from typing import Any, cast

import requests
import urllib3

urllib3.disable_warnings()

API_URL = 'https://imgchr.com/api/upload'


def upload_image(file_path: str, token: str) -> str | None:
    """
    上传单张图片到路过图床。
    返回远程 URL 字符串，失败返回 None。
    """
    if not os.path.exists(file_path):
        print(f'  ❌ 图片不存在: {file_path}')
        return None

    headers = {'Authorization': f'Bearer {token}'}
    files = {'file': open(file_path, 'rb')}

    try:
        resp = requests.post(API_URL, headers=headers, files=files, timeout=30, verify=False)
        if resp.status_code == 200:
            data = cast(dict[str, Any], resp.json())
            if data.get('status_code') == 200:
                return cast(str, data['data']['url'])
            else:
                print(f'  ❌ 上传失败: {data}')
                return None
        else:
            print(f'  ❌ HTTP {resp.status_code}: {resp.text[:200]}')
            return None
    except Exception as e:
        print(f'  ❌ 上传异常: {e}')
        return None
    finally:
        files['file'].close()


def upload_batch(
    image_dir: str,
    token: str,
    extensions: tuple[str, ...] = ('.jpg', '.jpeg', '.png', '.gif', '.webp'),
) -> dict[str, str]:
    """
    批量上传目录中的图片，返回 {local_path: remote_url} 字典。
    """
    results: dict[str, str] = {}
    for fname in sorted(os.listdir(image_dir)):
        if not fname.lower().endswith(extensions):
            continue
        fpath = os.path.join(image_dir, fname)
        url = upload_image(fpath, token)
        if url:
            results[fpath] = url
    return results
