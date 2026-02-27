<div align="center"><a name="readme-top"></a>

[![Chat Central](docs/images/banner.png)](https://www.chatcentral.cc/zh/)

一站式管理所有 AI 对话。

自动捕获你在 Claude、ChatGPT 和 Gemini 上的所有对话——搜索、标签、导出，数据完全存储在浏览器本地。

[English](README.md) · **简体中文** · [官方网站](https://www.chatcentral.cc/zh/) · [教程](https://www.chatcentral.cc/zh/tutorial) · [隐私政策](https://www.chatcentral.cc/zh/privacy)

[![][license-shield]][license-link]
[![][website-shield]][website-link]
[![][platforms-shield]][website-link]

</div>

## 功能路线图

| 功能            | 状态      | 描述                                           |
| --------------- | --------- | ---------------------------------------------- |
| 自动捕获        | ✅ 已完成 | 自动拦截 Claude、ChatGPT 和 Gemini 的对话      |
| 全文搜索        | ✅ 已完成 | 跨所有对话和消息即时搜索                       |
| 高级搜索        | ✅ 已完成 | 按平台、日期范围、`tag:`、`is:favorite` 等筛选 |
| 聚焦搜索        | ✅ 已完成 | `Cmd/Ctrl+Shift+K` 全局快捷键快速查找          |
| 标签与收藏      | ✅ 已完成 | 自定义标签，星标重要对话，任意组合筛选         |
| 导入 / 导出     | ✅ 已完成 | Markdown、JSON、ZIP 格式，含校验和冲突处理     |
| 管理面板        | ✅ 已完成 | 详情视图、批量导出、Markdown 渲染、主题切换    |
| 悬浮组件        | ✅ 已完成 | AI 平台页面上的快速访问气泡                    |
| 国际化          | ✅ 已完成 | 支持英文和简体中文                             |
| 云同步          | 🚧 进行中 | Google Drive 同步，支持自动后台同步            |
| 批量删除 / 收藏 | 📋 计划中 | 扩展批量操作（删除、收藏、标签）               |
| 键盘导航        | 📋 计划中 | J/K 导航、F 收藏、E 导出、? 帮助               |
| WebDAV 同步     | 📋 计划中 | 面向隐私用户的自托管同步方案                   |
| 语义搜索        | 📋 计划中 | 按含义搜索，而非仅靠关键词                     |
| 知识图谱        | 📋 计划中 | 跨对话链接主题和想法                           |

## 安装

### Chrome Web Store

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/mkkjdicijdpjgbbbfldonopfjaflllad?style=flat-square)](https://chromewebstore.google.com/detail/chat-central/mkkjdicijdpjgbbbfldonopfjaflllad)

[**从 Chrome Web Store 安装**](https://chromewebstore.google.com/detail/chat-central/mkkjdicijdpjgbbbfldonopfjaflllad)

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

## 隐私声明

- 所有数据存储在你的本地设备上 — 不会向任何服务器发送数据
- 无分析、无遥测、无追踪
- 不会向任何第三方服务器发送数据
- 完全开源

## 参与贡献

欢迎贡献！请随时提交 [Issue](https://github.com/flowKKo/chat-central/issues) 或 Pull Request。

```bash
pnpm install         # 安装依赖
pnpm dev             # 启动开发服务器（HMR）
pnpm validate        # 类型检查 + lint + 测试（提交前请运行）
```

架构详情请参阅 `CLAUDE.md`。

## 许可证

[GPL-3.0](LICENSE)

<!-- LINK GROUP -->

[license-shield]: https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square&labelColor=black
[license-link]: ./LICENSE
[website-shield]: https://img.shields.io/badge/官网-chatcentral.cc-blue?style=flat-square&labelColor=black
[website-link]: https://www.chatcentral.cc/zh/
[platforms-shield]: https://img.shields.io/badge/platforms-Claude%20%7C%20ChatGPT%20%7C%20Gemini-purple?style=flat-square&labelColor=black
