# Heluowen 的个人主页

https://heluowen.github.io

Jekyll + GitHub Pages，深色毛玻璃（Liquid Glass）风格：首屏个人名片、GitHub 项目卡片（点击直达仓库）、随笔列表，背景图可自定义。

---

## 目录结构

```
_config.yml            站点配置（名字、简介、头像、外观、社交链接）
_data/projects.yml     首页项目卡片数据源 ← 加项目改这里
_includes/             页面片段（hero 首屏 / projects 项目区 / posts 文章区 / footer / 背景面板）
_layouts/              default（全站骨架）、page、post
_posts/                文章，文件名 YYYY-MM-DD-标题.md
_sass/                 样式变量与断点
style.scss             全站样式（会被 Jekyll 编译成 /style.css）
assets/js/site.js      交互脚本（滚动动画、卡片倾斜、star 刷新、背景面板）
images/                图片；背景图放 images/backgrounds/
tools/preview.mjs      本地预览脚本（不用装 Ruby）
```

## 改个人信息

全部在 `_config.yml`：

```yaml
name: Heluowen
description: 大学生 · 写点代码，做点好玩的东西   # 首屏名字下面那一行
intro: 在折腾……                                # 首屏那段自我介绍
avatar: https://...                            # 头像，也可以换成 /images/avatar.jpg
github_username: Heluowen                      # 项目卡片和 star 刷新都基于它
tags: [Python, TypeScript, ...]                # 首屏小标签
footer-links:                                  # 页脚图标，留空即隐藏
  email: ...
  github: Heluowen
  rss: true
```

## 加一个项目

编辑 `_data/projects.yml`，复制一段改几行：

```yaml
- name: 显示的名字
  repo: GitHub 仓库名              # 会自动拼成 https://github.com/<用户名>/<repo>
  description: 一句话介绍
  language: Python
  color: "#3572A5"                # 语言小圆点的颜色
  stars: 0                        # 静态兜底值，页面加载后会被 API 刷新
  forks: 0
  updated: 2026-11-03
  tags: [标签, 标签]
  featured: true                  # 青色高亮卡片，用来突出重点
  # url: https://自定义地址        # 可选：想跳到别的地址时再写
```

> star 数会在页面打开后由 `assets/js/site.js` 调 GitHub API 静默刷新；失败就用上面的静态值。
> 想关掉刷新：把 `_config.yml` 里 `projects.refresh` 改成 `false`。

## 换背景图

### 方式一：让所有访客都看到（推荐）

1. 把图片放进 `images/backgrounds/`，例如 `images/backgrounds/bg-01.jpg`
2. 打开 `_config.yml`，改这三行：

```yaml
appearance:
  background:
    image: /images/backgrounds/bg-01.jpg
    overlay: 62      # 遮罩浓度 0-90，图片太亮就调大
    blur: 0          # 背景模糊 0-24（px）
```

`image` 留空就回到默认的星云渐变背景。

> ⚠️ 只替换 `background:` 下面这三行，不要把整段（含 `appearance:`、`background:`）贴进去，否则 YAML 会坏掉。
> 图片建议宽度 1920~2560px、体积 500KB 以内，否则首屏会慢。手机和电脑共用同一张，
> 选中间有主体、四周不重要的图效果最好（默认按 cover 裁切）。
> 背景图偏亮时页面会自动切换到「烟熏玻璃 + 更亮的正文色」，保证文字看得清。

### 方式二：先在本机试效果

点页面右下角的齿轮 → 「选择一张本地图片」：

- 立即预览，不修改任何文件
- 可以拖滑块调遮罩浓度 / 背景模糊
- 图片存在浏览器 localStorage，只对你自己这台机器有效
- 满意后点「复制配置」，把那段 YAML 粘进 `_config.yml`（同时把图片放进 `images/backgrounds/`），就能让所有人看到

## 本地预览

不需要安装 Ruby / Jekyll：

```bash
cd tools
npm install        # 首次
node preview.mjs   # 构建到 ../_preview 并启动 http://127.0.0.1:4321/
```

只想构建不起服务：`node preview.mjs --build`。

它模拟了 Jekyll 的核心流程（渲染 Liquid 与 include、Markdown 转 HTML、编译 SCSS），
只用于看效果；正式构建仍由 GitHub Pages 完成。

## 发布

```bash
git add -A
git commit -m "更新主页"
git push origin master
```

GitHub Pages 会自动构建，1~2 分钟后 https://heluowen.github.io 生效。

## 写文章

在 `_posts/` 新建 `2026-03-01-我的标题.md`：

```markdown
---
layout: post
title: 我的标题
date: 2026-03-01
---

正文……
```

---

主题源自 [Jekyll Now](https://github.com/barryclark/jekyll-now)，布局与样式已重写。
