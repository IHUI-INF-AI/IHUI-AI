# 生成 Mock 数据

根据类型定义生成模拟数据。

## 指令

请根据以下类型生成 Mock 数据：

{{selection}}

### Mock 数据规则

1. **数据真实性**
   - 使用合理的示例值
   - 名字、邮箱等使用拟真数据
   - 数字在合理范围内

2. **数据多样性**
   - 生成多条记录时数据要有差异
   - 包含边界情况（空值、最大值等）

3. **Mock 函数**
```typescript
import { faker } from '@faker-js/faker'

// 单条数据
export const mockUser = (): User => ({
  id: faker.number.int({ min: 1, max: 10000 }),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  avatar: faker.image.avatar(),
  role: faker.helpers.arrayElement(['admin', 'user']),
  createdAt: faker.date.past().toISOString(),
})

// 列表数据
export const mockUserList = (count = 10): User[] => 
  Array.from({ length: count }, mockUser)

// 分页数据
export const mockPaginatedUsers = (
  page = 1, 
  pageSize = 10, 
  total = 100
): PaginatedResponse<User> => ({
  list: mockUserList(pageSize),
  total,
  page,
  pageSize,
})
```

### 输出

- 提供静态 Mock 数据
- 提供 Mock 函数（可选）
- 数据格式正确可用
