"""P17.3 种子数据真实化增强
增强现有种子数据的字段名(camelCase)和数据关联性
仅增强 3 个核心文件:users/courses/orders
"""
import json
import os
import random
from datetime import datetime, timedelta

random.seed(20260619)

MOCK_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'mock-data')

def load(name):
    with open(os.path.join(MOCK_DIR, name), 'r', encoding='utf-8') as f:
        return json.load(f)

def save(name, data):
    with open(os.path.join(MOCK_DIR, name), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  增强 {name}: {len(data) if isinstance(data, list) else 1} 条')

# 1. 增强 users.json:添加 mobile/level/createdAt 字段,status 改为 1=正常/0=禁用
print('[1/3] 增强 users.json...')
users = load('users.json')
LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5']
for u in users:
    u['mobile'] = u.get('phone', '')
    u['level'] = random.choice(LEVELS)
    u['createdAt'] = u.get('created_at', '')
    u['status'] = 1 if u.get('status', 0) == 0 else 0
save('users.json', users)

# 2. 增强 courses.json:添加 studentCount 字段
print('[2/3] 增强 courses.json...')
courses = load('courses.json')
for c in courses:
    c['studentCount'] = c.get('students', 0)
    c['createdAt'] = c.get('created_at', '')
save('courses.json', courses)

# 3. 增强 orders.json:添加 orderNo/user/createdAt 字段,关联用户名
print('[3/3] 增强 orders.json...')
orders = load('orders.json')
user_map = {u['id']: u.get('username', f'user_{u["id"]}') for u in users}
course_map = {c['id']: c.get('title', f'课程{c["id"]}') for c in courses}
for o in orders:
    o['orderNo'] = o.get('id', '')
    uid = o.get('user_id', 1)
    o['user'] = user_map.get(uid, f'user_{uid}')
    cid = o.get('course_id', 1)
    o['course'] = course_map.get(cid, f'课程{cid}')
    o['createdAt'] = o.get('created_at', '')
save('orders.json', orders)

print('\n=== P17.3 种子数据增强完成 ===')
print(f'增强文件:users.json, courses.json, orders.json')
print(f'输出目录:{MOCK_DIR}')
