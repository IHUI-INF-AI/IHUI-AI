# 企业文档总目录(IHUI-AI Enterprise Documentation)

> **面向**:企业客户 / 销售 / 售前 / 技术决策者 / 商务
> **最后更新**:2026-07-28
> **维护方**:吉林省智汇人工智能科技有限公司 · 企业服务部

本目录包含 IHUI-AI 企业版(Enterprise Edition)对外提供的**全部商务与技术文档**。客户签约后可作为合同附件引用,内部销售 / 售前 / 交付 / 运维团队按需取用。

---

## 一、文档索引(9 份)

### 1.1 商务与决策类(4 份)

| 文档 | 用途 | 受众 |
|------|------|------|
| [whitepaper.md](./whitepaper.md) | 全景白皮书(产品定位 + 价值 + 发展规划) | 决策者 / 高管 |
| [ai-community-intro.md](./ai-community-intro.md) | AI 智能体社区介绍(普通用户/创作者/企业三视角) | 潜在客户 / 合作伙伴 |
| [decision-maker-community.md](./decision-maker-community.md) | 决策者社群介绍(行业洞察 + 高管对话圈) | C-level / VP |
| [human-ai-collaboration.md](./human-ai-collaboration.md) | 人机协作理念(产品哲学 + 未来工作模式) | 战略 / 趋势关注者 |

### 1.2 商务与合同类(2 份)

| 文档 | 用途 | 受众 |
|------|------|------|
| [pricing-quote.md](./pricing-quote.md) | 4 档报价单(标准 ¥5万 / 专业 ¥10万 / 旗舰 ¥30万 / 行业 ¥50万) | 采购 / 财务 |
| [sla-terms.md](./sla-terms.md) | 服务等级协议(99.9% / 99.95% / 99.99% 三档) | 法务 / 运维 |

### 1.3 技术与交付类(3 份)

| 文档 | 用途 | 受众 |
|------|------|------|
| [deployment-guide.md](./deployment-guide.md) | 三模式部署指南(私有云 / 公有云 / 混合云) | IT 运维 / SRE / 集成商 |
| [demo-environment.md](./demo-environment.md) | Demo 环境搭建(5 分钟一键启动) | 销售 / 售前 / POC |
| [feature-comparison.md](./feature-comparison.md) | 社区版 vs 企业版对比(24 个维度) | 技术决策者 / 架构师 |

### 1.4 配套脚本

- `scripts/setup-enterprise-demo.sh` — 一键 Demo 环境搭建脚本(idempotent,支持 `--dry-run` / `--status` / `--reset` / `--clean` / `--purge`)

---

## 二、按角色快速查找

### 2.1 商务 / 销售

- 与客户**初次接触** → [whitepaper.md](./whitepaper.md) + [ai-community-intro.md](./ai-community-intro.md)
- **报价阶段** → [pricing-quote.md](./pricing-quote.md)
- **演示 / POC** → [demo-environment.md](./demo-environment.md) + `./scripts/setup-enterprise-demo.sh`
- **签约阶段** → [sla-terms.md](./sla-terms.md) + [pricing-quote.md](./pricing-quote.md)
- **决策层对话** → [decision-maker-community.md](./decision-maker-community.md)

### 2.2 售前 / 解决方案

- **功能答疑** → [feature-comparison.md](./feature-comparison.md)
- **架构答疑** → [deployment-guide.md](./deployment-guide.md)
- **演示环境** → [demo-environment.md](./demo-environment.md)
- **POC 验收** → [feature-comparison.md](./feature-comparison.md) + [sla-terms.md](./sla-terms.md)

### 2.3 技术 / 运维

- **部署上线** → [deployment-guide.md](./deployment-guide.md)
- **Demo 自助** → [demo-environment.md](./demo-environment.md) + `./scripts/setup-enterprise-demo.sh`
- **合规对照** → [sla-terms.md](./sla-terms.md) §6 数据保护
- **故障处理** → [sla-terms.md](./sla-terms.md) §3 故障响应

### 2.4 客户内部

- **评估选型** → [feature-comparison.md](./feature-comparison.md) + [pricing-quote.md](./pricing-quote.md)
- **签约准备** → [sla-terms.md](./sla-terms.md) + [pricing-quote.md](./pricing-quote.md)
- **上线准备** → [deployment-guide.md](./deployment-guide.md) + [demo-environment.md](./demo-environment.md)
- **运维手册** → [sla-terms.md](./sla-terms.md) + [deployment-guide.md](./deployment-guide.md)

---

## 三、文档版本与更新

- **当前版本**:v1.0
- **更新频率**:每月 1 次小版本(每月 1 日),每季度 1 次大版本
- **变更通知**:签约客户通过工单系统 / 邮件提前 30 天通知
- **修订记录**:见每份文档末尾的"最后更新"字段

---

## 四、格式说明

文档中心支持以下格式的文档显示：

### 1. Markdown 文档（.md）
- 纯文本格式，支持基本的格式化（标题、列表、表格、代码块等）
- 适合技术文档、说明文档
- 示例：`whitepaper.md`

### 2. PDF 文档（.pdf）
- 保留原始格式，支持图片、表格、图表
- 浏览器直接预览
- 配置方式：
```javascript
{ 
  id: 'example-pdf', 
  fileUrl: '/docs/enterprise-service/example.pdf', 
  fileType: 'pdf', 
  title: '示例PDF文档', 
  category: '企业服务', 
  type: 'file' 
}
```

### 3. PowerPoint 文档（.ppt, .pptx）
- 完整保留幻灯片格式、动画、图片
- 使用微软 Office Online 预览服务
- 配置方式：
```javascript
{ 
  id: 'example-ppt', 
  fileUrl: '/docs/enterprise-service/example.pptx', 
  fileType: 'pptx', 
  title: '示例PPT文档', 
  category: '企业服务', 
  type: 'file' 
}
```

### 4. Word 文档（.doc, .docx）
- 完整保留文档格式、图片、表格
- 使用微软 Office Online 预览服务
- 配置方式：
```javascript
{ 
  id: 'example-doc', 
  fileUrl: '/docs/enterprise-service/example.docx', 
  fileType: 'docx', 
  title: '示例Word文档', 
  category: '企业服务', 
  type: 'file' 
}
```

### 5. Excel 文档（.xls, .xlsx）
- 完整保留表格数据、图表
- 使用微软 Office Online 预览服务
- 配置方式：
```javascript
{ 
  id: 'example-xls', 
  fileUrl: '/docs/enterprise-service/example.xlsx', 
  fileType: 'xlsx', 
  title: '示例Excel文档', 
  category: '企业服务', 
  type: 'file' 
}
```

## 添加新文档的步骤

1. **准备文档文件**
   - 将文档文件（PPT/Word/PDF/Excel）放入 `public/docs/enterprise-service/` 目录

2. **配置文档目录**
   - 打开 `src/views/EduDocumentation.vue`
   - 在 `DOC_CATALOG` 数组中添加新条目：
   ```javascript
   { 
     id: 'unique-doc-id',           // 唯一标识符
     fileUrl: '/docs/enterprise-service/filename.pptx',  // 文件路径
     fileType: 'pptx',              // 文件类型
     title: '文档标题',              // 显示标题
     category: '企业服务',          // 分类
     type: 'file'                   // 类型标记
   }
   ```

3. **重启开发服务器**
   - 如果是新添加的文件类型，可能需要重启 Vite 服务器

## 注意事项

1. **文件大小限制**
   - 建议单个文件不超过 50MB
   - 大文件可能影响加载速度

2. **Office 文档预览**
   - PPT/Word/Excel 使用微软 Office Online 预览服务
   - 需要文件可以通过公网访问（或 localhost 开发环境）
   - 如果文件无法访问，预览会失败

3. **PDF 预览**
   - 直接使用浏览器内置的 PDF 阅读器
   - 不需要外部服务

4. **安全性**
   - 敏感文档建议转换为 PDF 后上传
   - 避免上传包含敏感信息的可编辑文档

## 示例

当前目录中的文档文件(共 9 份):

**商务与决策类**:
- `whitepaper.md` - 全景白皮书
- `ai-community-intro.md` - AI 智能体社区介绍
- `decision-maker-community.md` - 决策者社群介绍
- `human-ai-collaboration.md` - 人机协作介绍

**商务与合同类**:
- `pricing-quote.md` - 4 档企业版报价单
- `sla-terms.md` - 服务等级协议(SLA)

**技术与交付类**:
- `deployment-guide.md` - 三模式部署指南
- `demo-environment.md` - Demo 环境搭建指南
- `feature-comparison.md` - 社区版 vs 企业版功能对比

**配套脚本**:
- `../../scripts/setup-enterprise-demo.sh` - Demo 环境一键搭建脚本

## 转换工具

如果需要将现有文档转换为支持的格式，可以使用以下工具：

- **PPT/Word/Excel 转 PDF**: Microsoft Office、WPS、Google Docs
- **图片压缩**: TinyPNG、Squoosh
- **PDF 优化**: Adobe Acrobat、PDF24
