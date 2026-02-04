<div align="center"><a name="readme-top"></a>

[![Chat Central](docs/images/banner.png)](https://www.chatcentral.cc/zh/)

一站式管理所有 AI 对话。

自动捕获、搜索、整理和导出你的 AI 对话。

[English](README.md) · **简体中文** · [官方网站](https://www.chatcentral.cc/zh/) · [教程](https://www.chatcentral.cc/zh/tutorial) · [隐私政策](https://www.chatcentral.cc/zh/privacy)

[![][license-shield]][license-link]
[![][website-shield]][website-link]
[![][platforms-shield]][website-link]
[![][stars-shield]][stars-link]
[![][issues-shield]][issues-link]

</div>

## 功能特性

- **自动捕获** — 与 Claude、ChatGPT、Gemini 聊天时自动保存对话
- **全文搜索** — 跨平台闪电般快速查找任何对话
- **标签与收藏** — 自定义标签、星标重要对话，任意组合筛选
- **导出** — Markdown、JSON 或 ZIP，你的数据你做主
- **云同步** — Google Drive 同步，支持自动后台同步
- **管理仪表盘** — 全功能管理界面，详情查看、批量操作、Markdown 渲染
- **隐私优先** — 所有数据本地存储，零追踪，完全开源

## 即将推出

> **个人知识库** — 将你的 AI 对话转化为可搜索的知识图谱。

- **知识图谱** — 跨对话链接主题和想法
- **AI 记忆** — 在相关时自动浮现过去的洞察
- **语义搜索** — 按含义搜索，而非仅靠关键词
- **智能笔记** — 按主题整理的自动生成摘要

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

## 隐私声明

- 所有数据存储在你的本地设备上 — 除非启用云同步，否则数据不会离开设备
- 云同步使用 Google Drive 的私有文件夹，在你的 Drive 中不可见
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
[stars-shield]: https://img.shields.io/github/stars/nicepkg/chat-central?style=flat-square&label=stars&color=yellow&labelColor=black
[stars-link]: https://github.com/nicepkg/chat-central/stargazers
[issues-shield]: https://img.shields.io/github/issues/nicepkg/chat-central?style=flat-square&labelColor=black
[issues-link]: https://github.com/nicepkg/chat-central/issues
