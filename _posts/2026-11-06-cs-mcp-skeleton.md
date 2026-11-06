---
layout: post
title: 给 CS2 赛事写了个 MCP Server（骨架篇）
date: 2026-11-06
---

CS2 赛事 MCP Server 骨架跑通：Rust + rmcp 3.8，8 个工具全注册，stdio 与 HTTP 双传输可用；首次编译即过，clippy 零警告，14 个测试全绿。实测 HLTV 被 Cloudflare 拦，PandaScore 与 Liquipedia 可用。下一步接真实数据。

代码：[Heluowen/cs-mcp](https://github.com/Heluowen/cs-mcp)
