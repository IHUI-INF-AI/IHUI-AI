"""P18.6 种子数据扩展增强
增强 lives/comments/points 的字段名(camelCase)和数据关联性(关联用户名)
"""
import json
import os
import random

random.seed(20260619)

MOCK_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'mock-data')

def load(name):
    with open(os.path.join(MOCK_DIR, name), 'r', encoding='utf-8') as f:
        return json.load(f)

def save(name, data):
    with open(os.path.join(MOCK_DIR, name), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  增强 {name}: {len(data) if isinstance(data, list) else 1} 条')

# 加载 users.json 构建 user_id -> nickname 映射(用昵称作为显示名更真实)
print('[0/3] 加载 users.json 构建用户映射...')
users = load('users.json')
user_map = {u['id']: u.get('nickname', u.get('username', f'user_{u["id"]}')) for u in users}
print(f'  用户映射: {len(user_map)} 条')

# 1. 增强 lives.json:添加 createdAt 字段(camelCase),保留原有 lecturer/status
print('[1/3] 增强 lives.json...')
lives = load('lives.json')
for l in lives:
    l['createdAt'] = l.get('created_at', '')
    l['startAt'] = l.get('start_at', '')
save('lives.json', lives)

# 2. 增强 comments.json:将 user 字段改为关联真实 nickname,添加 createdAt
print('[2/3] 增强 comments.json...')
comments = load('comments.json')
for c in comments:
    uid = c.get('user_id', 0)
    # 用真实 nickname 替换 "user_xxxx" 格式
    c['user'] = user_map.get(uid, c.get('user', f'user_{uid}'))
    c['createdAt'] = c.get('created_at', '')
save('comments.json', comments)

# 3. 增强 points.json:将 user 字段改为关联真实 nickname,添加 createdAt
print('[3/3] 增强 points.json...')
points = load('points.json')
for p in points:
    uid = p.get('user_id', 0)
    # 用真实 nickname 替换 "user_xxxx" 格式
    p['user'] = user_map.get(uid, p.get('user', f'user_{uid}'))
    p['createdAt'] = p.get('created_at', '')
save('points.json', points)

print('\n=== P18.6 种子数据增强完成 ===')
print(f'增强文件: lives.json, comments.json, points.json')
print(f'输出目录: {MOCK_DIR}')
