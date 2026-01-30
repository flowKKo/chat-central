[English](README.md) | [简体中文](README.zh-CN.md)

# Chat Central

统一的 AI 对话管理器 — 自动捕获、搜索、标签、导出你在 Claude、ChatGPT 和 Gemini 上的对话。

## 功能特性

### 核心

- **自动捕获** — 在你聊天时拦截 API 响应，无需手动操作
- **多平台** — 支持 Claude、ChatGPT 和 Gemini，采用统一的适配器架构
- **全文搜索** — 跨标题、预览、摘要和消息内容搜索，支持结果高亮
- **高级搜索语法** — `platform:claude`、`tag:work`、`before:2025-01`、`after:2024-06`、`is:favorite`
- **本地优先** — 所有数据存储在设备上的 IndexedDB 中，不依赖外部服务器

### 整理

- **标签** — 为对话添加自定义标签，便于分类管理
- **收藏** — 星标重要对话，快速访问
- **日期范围筛选** — 按日期筛选，内置预设选项
- **平台筛选** — 按平台查看对话，或一次查看全部

### 导出与同步

- **导出** — 单个或批量导出为 Markdown、JSON 或 ZIP（JSONL + manifest）格式
- **导入** — 从 ZIP 导入，支持冲突解决和校验
- **云同步** — 通过 OAuth2 实现 Google Drive 同步，支持自动同步、重试和冲突解决
- **同步引擎** — 拉取/合并/推送循环，字段级合并策略（LWW、union、max、min）

### 界面

- **扩展弹窗** — 紧凑的对话浏览器，支持搜索、平台标签页和收藏
- **仪表盘** — 全页面管理器，包含对话详情、消息渲染和批量操作
- **Markdown 渲染** — 消息气泡中的富文本显示（代码块、链接、列表、语法高亮）
- **AI 摘要** — 可折叠的对话摘要区块
- **主题** — 亮色、暗色和跟随系统模式，配有平台专属强调色

## 支持平台

| 平台    | 列表同步 | 详情同步 | 流式捕获 |
| ------- | -------- | -------- | -------- |
| Claude  | 是       | 是       | 是       |
| ChatGPT | 是       | 是       | 是       |
| Gemini  | 是       | 是       | —        |

## 工作原理

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Platform    │────▶│  API Interceptor  │────▶│  Background SW  │
│  (Claude/GPT/   │     │  (MAIN world CS)  │     │  (merge + store)│
│   Gemini)       │     └──────────────────┘     └────────┬────────┘
└─────────────────┘                                       │
                                                          ▼
                                              ┌─────────────────────┐
                                              │   IndexedDB (Dexie) │
                                              └────────┬────────────┘
                                                       │
                                         ┌─────────────┼─────────────┐
                                         ▼             ▼             ▼
                                   ┌──────────┐  ┌──────────┐  ┌──────────┐
                                   │  Popup   │  │Dashboard │  │  Cloud   │
                                   │  (quick  │  │  (full   │  │  Sync   │
                                   │  browse) │  │  manage) │  │ (GDrive)│
                                   └──────────┘  └──────────┘  └──────────┘
```

1. **拦截** — Content script（MAIN world）捕获 AI 平台的 API 响应
2. **标准化** — 平台适配器将响应解析为统一的 `Conversation` / `Message` 格式
3. **合并与存储** — Background service worker 合并数据并持久化到 IndexedDB
4. **访问** — 通过弹窗浏览、在仪表盘中管理、同步到 Google Drive

## 安装

### Chrome Web Store

即将上线。

### 手动安装

1. 从 [Releases](https://github.com/flowKKo/chat-central/releases) 下载最新版本
2. 解压文件
3. 打开 `chrome://extensions/`
4. 启用**开发者模式**
5. 点击**加载已解压的扩展程序**，选择解压后的文件夹

### 从源码构建

```bash
git clone https://github.com/flowKKo/chat-central.git
cd chat-central
pnpm install
pnpm build          # Chrome
pnpm build:firefox  # Firefox
```

输出目录为 `.output/`。

## 开发

```bash
pnpm install         # 安装依赖
pnpm dev             # 启动开发服务器（HMR）
pnpm dev:firefox     # Firefox 开发服务器
pnpm dev:reload      # 手动构建 + 自动重载（用于测试登录态）

pnpm validate        # 类型检查 + lint + 测试
pnpm type-check      # 仅 TypeScript 检查
pnpm lint            # 仅 ESLint 检查
pnpm test            # Vitest（990+ 测试用例）
```

## 技术栈

| 类别     | 技术                                 |
| -------- | ------------------------------------ |
| 扩展框架 | WXT (Manifest V3)                    |
| 界面     | React 19, Tailwind CSS, Lucide       |
| 状态管理 | Jotai                                |
| 数据库   | Dexie (IndexedDB)                    |
| 搜索     | MiniSearch                           |
| 云同步   | Google Drive (chrome.identity OAuth) |
| 校验     | Zod                                  |
| 测试     | Vitest, Testing Library              |
| 语言     | TypeScript (strict)                  |

## 隐私声明

- 所有数据本地存储在 IndexedDB 中 — 除非你启用云同步，否则数据不会离开你的设备
- 云同步使用 Google Drive 的应用专属数据文件夹（在你的 Drive 中不可见）
- 无分析、无遥测、无外部追踪
- 不会向任何第三方服务器发送数据
- 开源 — 你可以自行审查代码

## 参与贡献

```bash
pnpm install
pnpm dev
```

架构详情请参阅 `CLAUDE.md` 中的代码库结构。提交更改前请运行 `pnpm validate`。

## 许可证

[GPL-3.0](LICENSE)
