# 规范化 Git 提交

VSCode 扩展：规范化 Git 提交信息，支持 Angular 格式和自定义模板，自动获取版本号。

## 功能特性

- ✅ 支持 Angular 格式提交模板：`<icon> <type>(<scope>): <subject>`
- ✅ 支持自定义提交模板
- ✅ 支持自定义提交类型
- ✅ 自动获取版本号（可选）
- ✅ 支持 Emoji 图标（可配置）
- ✅ 交互式提交信息填写
- ✅ 支持多仓库工作区

## 安装

### 从源码安装

1. 克隆或下载本项目
2. 在项目目录下运行 `npm install` 安装依赖
3. 运行 `npm run compile` 编译项目
4. 按 `F5` 在扩展开发宿主中运行，或使用 `vsce package` 打包为 .vsix 文件

## 使用说明

### 基本使用

1. 在 VSCode 中打开包含 Git 仓库的项目
2. 在源代码管理（SCM）面板中，点击提交按钮旁的图标
3. 或者使用命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`），输入 "规范化 Git 提交"
4. 按照提示选择模板、类型、填写提交信息

### 提交流程

1. **选择模板**：选择提交使用的模板（默认 Angular 格式）
2. **选择类型**：选择提交类型（feat、fix、docs 等）
3. **填写信息**：
   - Scope（可选）：修改范围
   - Subject（必填）：提交概述
   - Body（可选）：详细说明
   - Footer（可选）：备注信息
4. **完成**：提交信息会自动填充到 Git 提交输入框

### 配置选项

在 VSCode 设置中搜索 "odinsamGitCommit" 进行配置：

- **showEmoji**: 是否显示 Emoji 图标（默认：true）
- **maxSubjectWords**: Subject 的最大长度（默认：50）
- **customCommitType**: 自定义提交类型
- **templates**: 自定义提交模板
- **autoVersion**: 是否在提交信息中自动添加版本号（默认：false）

### 自定义模板

在设置中配置自定义模板：

```json
{
  "odinsamGitCommit.templates": [
    {
      "templateName": "Angular",
      "templateContent": "<icon><space><type>(<scope>):<space><subject><enter><body><enter><footer>"
    },
    {
      "templateName": "git-cz",
      "templateContent": "<type>(<scope>):<space><icon><space><subject><enter><body><enter><footer>"
    }
  ]
}
```

**模板占位符说明：**
- `<icon>`: 图标（Emoji）
- `<type>`: 提交类型
- `<scope>`: 修改范围
- `<subject>`: 提交概述
- `<body>`: 详细说明
- `<footer>`: 备注信息
- `<enter>`: 换行（两个换行符）
- `<space>`: 空格

### 自动版本号

启用 `autoVersion` 后，提交信息会自动添加版本号信息。版本号的获取优先级如下：

1. **项目配置文件**（`.gitcommit`）- 最高优先级
2. **Git Tag** - 当前提交的 tag
3. **提交哈希** - 当前提交的哈希值（前8位）

#### 使用项目配置文件

在 monorepo 场景下，可以为每个项目创建独立的 `.gitcommit` 配置文件来指定版本号。

**配置文件位置**：放在项目根目录（每个子项目的根目录）

**配置文件格式**（支持两种格式）：

**方式1：Key-Value 格式**
```ini
# .gitcommit
projectName=Insurance.Api
version=1.0.0
```

**方式2：JSON 格式**
```json
{
  "projectName": "Insurance.Api",
  "version": "1.0.0"
}
```

**从其他文件读取版本号**：
```ini
# .gitcommit
projectName=Insurance.Api
versionFile=package.json
```

或

```json
{
  "projectName": "Insurance.Api",
  "versionFile": "package.json"
}
```

支持的版本文件类型：
- `package.json` - 读取 `version` 字段
- `.csproj` - 读取 `<Version>` 标签
- 纯文本文件 - 读取第一行或整个内容

**示例输出**：

如果从配置文件读取：
```
feat(缓存): 实现分布式缓存功能

版本: 1.0.0 (Insurance.Api)
分支: feature/odin-batchTemplateImport
```

如果从 Git Tag 读取：
```
feat(缓存): 实现分布式缓存功能

版本: v1.0.0 (基于 v1.0.0)
分支: feature/odin-batchTemplateImport
```

如果从提交哈希读取：
```
feat(缓存): 实现分布式缓存功能

版本: 2a65ad99
分支: feature/odin-batchTemplateImport
```

## 提交类型

默认支持的提交类型：

- ✨ **feat**: 添加新特性
- 🐞 **fix**: 修复bug
- 📃 **docs**: 仅仅修改文档
- 🌈 **style**: 代码格式修改
- 🦄 **refactor**: 代码重构
- 🎈 **perf**: 性能优化
- 🧪 **test**: 增加测试用例
- 🔧 **build**: 依赖相关的内容
- 🐎 **ci**: CI配置相关
- 🐳 **chore**: 改变构建流程、或者增加依赖库、工具等
- ↩ **revert**: 回滚到上一个版本

## 开发调试

### 环境准备

```bash
# 安装依赖
npm install

# 编译项目
npm run compile

# 监听模式编译（自动重新编译）
npm run watch
```

### 调试扩展

1. 在 VSCode 中打开本项目
2. 按 `F5` 或点击"运行和调试"面板中的"运行扩展"
3. 会打开一个新的 VSCode 窗口（扩展开发宿主）
4. 在新窗口中测试扩展功能

### 打包扩展

```bash
npm run package
```

会在项目根目录生成 `.vsix` 文件。

## 项目结构

```
odinsam-GitCommit/
├── src/
│   ├── config/              # 配置模块
│   │   ├── commit-type.ts   # 提交类型配置
│   │   ├── template-type.ts # 模板配置
│   │   ├── commit-detail.ts # 提交详情配置
│   │   └── commit-input.ts  # 输入框配置
│   ├── services/            # 服务模块
│   │   └── versionService.ts # 版本号服务
│   ├── types/               # 类型定义
│   │   ├── git.d.ts         # Git 类型定义
│   │   └── commit.d.ts      # 提交信息类型定义
│   └── extension.ts          # 扩展主入口
├── out/                     # 编译输出目录
├── package.json             # 扩展配置文件
├── tsconfig.json            # TypeScript 配置
└── README.md                # 说明文档
```

## 许可证

MIT
