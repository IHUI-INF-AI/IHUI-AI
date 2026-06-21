# 生成表格

根据数据结构生成完整的表格组件。

## 指令

请根据以下数据结构生成表格：

{{selection}}

### 表格结构

```vue
<template>
  <div class="table-container">
    <!-- 工具栏 -->
    <div class="table-toolbar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索"
        clearable
        style="width: 200px"
        @input="handleSearch"
      />
      <el-button type="primary" @click="handleAdd">
        新增
      </el-button>
    </div>

    <!-- 表格 -->
    <el-table
      v-loading="loading"
      :data="tableData"
      border
      stripe
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      
      <el-table-column prop="id" label="ID" width="80" />
      
      <el-table-column prop="name" label="名称" min-width="120">
        <template #default="{ row }">
          <el-link type="primary">{{ row.name }}</el-link>
        </template>
      </el-table-column>
      
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
            {{ row.status === 'active' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button link type="danger" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      @change="handlePaginationChange"
    />
  </div>
</template>
```

### 功能支持

- 搜索过滤
- 排序
- 多选
- 分页
- 自定义列渲染
- 操作按钮

### 输出

完整的表格组件代码
