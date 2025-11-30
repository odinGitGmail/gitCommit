# 规范化 Git 提交

VSCode 扩展：规范化 Git 提交信息，支持 Angular 格式和自定义模板，自动获取版本号，支持创建 Git Tag。

## 功能特性

- ✅ 支持 Angular 格式提交模板：`<icon> <type>(<scope>): <subject>`
- ✅ 支持自定义提交模板
- ✅ 支持自定义提交类型
- ✅ 自动获取版本号（可选）
- ✅ 支持 Emoji 图标（可配置）
- ✅ 交互式提交信息填写
- ✅ 支持多仓库工作区
- ✅ 支持创建 Git Tag
- ✅ 支持多项目配置（Monorepo）
- ✅ 自动从配置文件读取版本号

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
4. 选择操作类型（Tag 或 Commit）
5. 按照提示完成相应操作

### 使用流程

#### 1. 选择操作类型

每次使用时会提示选择操作类型：
- **Tag**：创建 Git Tag
- **Commit**：提交代码

> **注意**：在使用前，扩展会自动检查是否存在 `.gitcommit` 配置文件。如果不存在，会询问是否创建配置文件。

#### 2. Commit 流程

1. **选择模板**：选择提交使用的模板（默认 Angular 格式）
2. **选择类型**：选择提交类型（feat、fix、docs 等）
3. **填写信息**：
   - Scope（可选）：修改范围
   - Subject（必填）：提交概述
   - Body（可选）：详细说明
   - Footer（可选）：备注信息
4. **完成**：提交信息会自动填充到 Git 提交输入框，如果启用了 `autoVersion`，会自动添加版本信息

#### 3. Tag 流程

1. **输入 Tag 版本号**：默认值为 `.gitcommit` 配置文件中解析的版本号（格式：`v版本号`）
2. **输入 Tag 消息**：Tag 的说明信息
3. **执行命令**：自动执行 `git tag v版本号 -m "message"` 命令
4. **完成**：Tag 创建成功后会显示提示信息

> **注意**：如果 Tag 已存在，会询问是否覆盖。

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

**配置文件格式**（JSON 格式）：

**单项目配置**：
```json
{
  "projectName": "Insurance.Api",
  "path": "package.json",
  "versionRegex": "\"version\"\\s*:\\s*\"([\\d.]+)\"",
  "description": "项目版本号"
}
```

**多项目配置**：
```json
{
  "config": [
    {
      "projectName": "Insurance.Api",
      "path": "package.json",
      "versionRegex": "\"version\"\\s*:\\s*\"([\\d.]+)\"",
      "description": "API 项目版本号"
    },
    {
      "projectName": "Insurance.Web",
      "path": "package.json",
      "versionRegex": "\"version\"\\s*:\\s*\"([\\d.]+)\"",
      "description": "Web 项目版本号"
    }
  ]
}
```

**配置说明**：
- `projectName`：项目名称
- `path`：版本文件路径（相对于 `.gitcommit` 文件所在目录）
- `versionRegex`：用于从文件中提取版本号的正则表达式（第一个捕获组作为版本号）
- `description`：项目描述（可选）

**支持的版本文件类型及正则表达式示例**：

- `package.json` - `"version"\\s*:\\s*"([\\d.]+)"`
- `.csproj` - `<Version>([\\d.]+)</Version>`
- 其他文件 - 根据实际格式自定义正则表达式

**自动创建配置文件**：

首次使用时，如果没有 `.gitcommit` 配置文件，扩展会询问是否创建：
- **创建单项目配置**：生成单项目格式的配置文件
- **创建多项目配置**：生成多项目格式的配置文件

**多项目配置项目选择**：

如果使用多项目配置，在提交或创建 Tag 时，会提示选择要操作的项目。如果不选择项目，版本号将无效。

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

## 常见问题

### 1. 多项目配置中如何选择项目？

如果使用多项目配置，在提交或创建 Tag 时，扩展会显示项目列表供选择。如果不选择项目，版本号将无效，但提交流程可以继续。

### 2. Tag 版本号默认值来自哪里？

Tag 版本号的默认值从 `.gitcommit` 配置文件中解析，格式为 `v版本号`（例如：如果配置文件中的版本号是 `1.0.0`，默认 Tag 值为 `v1.0.0`）。

### 3. 如何修改配置文件？

`.gitcommit` 配置文件是 JSON 格式，可以直接在 VSCode 中编辑。配置文件的路径相对于配置文件所在目录。

### 4. 版本号正则表达式如何编写？

版本号正则表达式使用 JavaScript 正则表达式语法，第一个捕获组（括号）作为版本号。例如：
- `"version"\\s*:\\s*"([\\d.]+)"` - 匹配 `"version": "1.0.0"`，提取 `1.0.0`
- `<Version>([\\d.]+)</Version>` - 匹配 `<Version>1.0.0</Version>`，提取 `1.0.0`

### 5. 如何启用自动版本号？

在 VSCode 设置中搜索 `odinsamGitCommit.autoVersion`，设置为 `true` 即可。或者在设置文件中添加：

```json
{
  "odinsamGitCommit.autoVersion": true
}
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
│   │   ├── versionService.ts # 版本号服务
│   │   ├── configService.ts  # 配置服务
│   │   └── templateService.ts # 模板服务
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
