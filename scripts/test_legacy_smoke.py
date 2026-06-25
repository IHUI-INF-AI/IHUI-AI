from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# 测试 1: 一个 Python 现有端点
r1 = client.get('/member/by/mobile/13800000000')
print(f"Test 1 (现有 Python 端点): status={r1.status_code}")

# 测试 2: 一个 Java legacy 端点 (应该返回 501 stub)
r2 = client.get('/auth-api/by-mobile?mobile=13800000000')
print(f"Test 2 (Java legacy 端点): status={r2.status_code}, body={r2.json()}")

# 测试 3: Java update/avatar
r3 = client.put('/auth-api/update/avatar', json={'avatar': 'test.jpg', 'id': 1})
print(f"Test 3 (Java update/avatar): status={r3.status_code}, body={r3.json()}")

# 测试 4: Java 公共注册
r4 = client.post('/public-api/register/mobile', json={'mobile': '13800000000', 'authCode': '1234', 'password': 'pwd'})
print(f"Test 4 (Java register/mobile): status={r4.status_code}, body={r4.json()}")

# 测试 5: Java 密码重置
r5 = client.put('/public-api/pwd/reset', json={'username': '13800000000', 'authCode': '1234', 'password': 'pwd', 'confirmPassword': 'pwd'})
print(f"Test 5 (Java pwd/reset): status={r5.status_code}, body={r5.json()}")

# 测试 6: Java 列表
r6 = client.get('/list')
print(f"Test 6 (Java list): status={r6.status_code}, body={r6.json()}")
