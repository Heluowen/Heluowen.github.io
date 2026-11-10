---
layout: post
title: CS2 赛事 MCP 装进 AstrBot：三个不太寻常的坑
date: 2026-11-10
---

cs-mcp 终于能在 AstrBot 群里回答赛事问题了。三个坑都挺阴：MCP 只允许 node/python 这类启动器，得用 node 包一层绕过白名单；AstrBot 会把 http_proxy 写进子进程环境，而我机器上残留着一个指向死端口 7890 的代理（Clash 实际在 7897），所有请求被塞进一条不存在的隧道，报错却只说 error sending request。最后靠错误链里的 tunnel error 才定位，改成只认专属变量名 CS_MCP_HTTP_PROXY。

代码：[Heluowen/cs-mcp](https://github.com/Heluowen/cs-mcp)
