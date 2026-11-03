/**
 * 本地预览（不需要装 Ruby / Jekyll）
 *
 *   cd tools
 *   npm install
 *   node preview.mjs            # 构建到 ../_preview 并起一个本地服务
 *   node preview.mjs --build    # 只构建，不起服务
 *
 * 它做的是 Jekyll 最核心的那一小部分事情：
 * 渲染 Liquid（含 include）、把 Markdown 变成 HTML、编译 style.scss。
 * 只用来看效果，正式构建仍然由 GitHub Pages 的 Jekyll 完成。
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { Liquid } from "liquidjs";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import * as sass from "sass";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "_preview");
const PORT = Number(process.env.PORT || 4321);
const BUILD_ONLY = process.argv.includes("--build");

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ---------------- YAML / Markdown / Liquid ---------------- */

function parseYaml(src) {
  return matter(`---\n${src}\n---\n`).data || {};
}

const engine = new Liquid({ strictFilters: false, strictVariables: false });

const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, " ");

engine.registerFilter("relative_url", (p) => p || "");
engine.registerFilter("absolute_url", (p) => (p || "").startsWith("http") ? p : `${config.url || ""}${p || ""}`);
engine.registerFilter("strip_html", stripHtml);
engine.registerFilter("normalize_whitespace", (s) => String(s || "").replace(/\s+/g, " ").trim());
engine.registerFilter("date_to_xmlschema", (d) => new Date(d).toISOString());
engine.registerFilter("jsonify", (v) => JSON.stringify(v === undefined || v === null ? "" : v));
engine.registerFilter("xml_escape", (s) => String(s || ""));

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleize(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Jekyll 的 {% include xxx.html %} 语义在这里是纯文本展开 */
function expandIncludes(src, depth = 0) {
  if (depth > 6) return src;
  return src.replace(/\{%-?\s*include\s+([^\s%]+)\s*-?%\}/g, (_all, name) => {
    const file = path.join(ROOT, "_includes", name);
    if (!fs.existsSync(file)) return `<!-- include not found: ${name} -->`;
    return expandIncludes(fs.readFileSync(file, "utf8"), depth + 1);
  });
}

async function renderLiquid(src, data) {
  return engine.parseAndRender(expandIncludes(src), data);
}

/* ---------------- 站点数据 ---------------- */

const config = parseYaml(read("_config.yml"));
const projects = fs.existsSync(path.join(ROOT, "_data", "projects.yml"))
  ? parseYaml(read(path.join("_data", "projects.yml")))
  : [];

function loadPosts() {
  const dir = path.join(ROOT, "_posts");
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => /\.(md|markdown|html)$/i.test(f))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = matter(raw);
      const base = file.replace(/\.(md|markdown|html)$/i, "");
      const m = base.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})-(.+)$/);

      let date = new Date(parsed.data.date || Date.now());
      let slug = slugify(base);

      if (m) {
        const year = Number(m[1]) < 100 ? 2000 + Number(m[1]) : Number(m[1]);
        date = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3])));
        slug = slugify(m[4]);
      }

      return {
        file,
        slug,
        url: `/${slug}/`,
        date,
        data: parsed.data,
        title: parsed.data.title || titleize(slug),
        body: parsed.content
      };
    })
    .sort((a, b) => b.date - a.date);
}

const posts = loadPosts();

const site = {
  ...config,
  url: config.url || "",
  baseurl: config.baseurl || "",
  time: new Date(),
  data: { projects },
  posts: posts.map((p) => ({
    url: p.url,
    title: p.title,
    date: p.date,
    excerpt: p.data.excerpt || ""
  }))
};

/* 文章正文（需要 Liquid + Markdown 两步） */
async function postHtml(post) {
  const liquid = await renderLiquid(post.body, { site, page: { ...post.data, title: post.title, date: post.date } });
  const html = md.render(liquid);
  const firstP = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1];
  post.excerptHtml = firstP || html.replace(/<pre[\s\S]*?<\/pre>/gi, "").trim();
  return html;
}

/* ---------------- 构建 ---------------- */

function frontMatter(src) {
  const parsed = matter(src);
  return { data: parsed.data, content: parsed.content };
}

async function buildPage({ layout, page, content, outFile }) {
  /* 像 Jekyll 一样逐层套 layout（post.html → default.html） */
  let body = content;
  let currentLayout = layout;
  let depth = 0;

  while (currentLayout && depth < 6) {
    const raw = read(path.join("_layouts", `${currentLayout}.html`));
    const fm = frontMatter(raw);
    body = await renderLiquid(fm.content, { site, page, content: body, layout: fm.data || {} });
    currentLayout = fm.data && fm.data.layout;
    depth += 1;
  }

  const target = path.join(OUT, outFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, "utf8");
  return outFile;
}

async function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  /* style.css（去掉 Jekyll 的前置分隔符后交给 sass） */
  const scss = read("style.scss").replace(/^---\r?\n---\r?\n/, "");
  const css = sass.compileString(scss, {
    loadPaths: [path.join(ROOT, "_sass"), ROOT],
    style: "expanded",
    silenceDeprecations: ["import", "global-builtin"]
  });
  fs.writeFileSync(path.join(OUT, "style.css"), css.css, "utf8");

  /* 静态资源 */
  for (const dir of ["assets", "images"]) {
    if (exists(dir)) {
      fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
    }
  }

  /* 首页 */
  const home = frontMatter(read("index.html"));
  const homeContent = await renderLiquid(home.content, { site, page: home.data });
  await buildPage({
    layout: home.data.layout || "default",
    page: { ...home.data, url: "/" },
    content: homeContent,
    outFile: "index.html"
  });

  /* 普通页面（about.md） */
  if (exists("about.md")) {
    const page = frontMatter(read("about.md"));
    const liquid = await renderLiquid(page.content, {
      site,
      page: { ...page.data, url: "/about/" }
    });
    await buildPage({
      layout: page.data.layout || "page",
      page: { ...page.data, url: "/about/" },
      content: md.render(liquid),
      outFile: "about/index.html"
    });
  }

  /* 文章 */
  for (const post of posts) {
    const html = await postHtml(post);
    await buildPage({
      layout: post.data.layout || "post",
      page: { ...post.data, title: post.title, date: post.date, url: post.url },
      content: html,
      outFile: path.join(post.slug, "index.html")
    });
  }

  /* 首页文章摘要需要 post.excerpt，重新渲染一次首页 */
  site.posts = posts.map((p) => ({
    url: p.url,
    title: p.title,
    date: p.date,
    excerpt: p.excerptHtml || ""
  }));
  const homeContent2 = await renderLiquid(home.content, { site, page: home.data });
  await buildPage({
    layout: home.data.layout || "default",
    page: { ...home.data, url: "/" },
    content: homeContent2,
    outFile: "index.html"
  });

  /* 404 */
  fs.writeFileSync(
    path.join(OUT, "404.html"),
    `<!DOCTYPE html><meta charset="utf-8"><title>404</title>` +
      `<body style="background:#06070b;color:#e9ecf5;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">` +
      `<div style="text-align:center"><h1 style="font-size:64px;margin:0">404</h1><p>页面不存在</p>` +
      `<a style="color:#22d3ee" href="/">← 回首页</a></div></body>`,
    "utf8"
  );

  const pages = ["index.html", "about/index.html", ...posts.map((p) => `${p.slug}/index.html`), "style.css"];
  console.log(`已构建到 ${path.relative(process.cwd(), OUT)}`);
  pages.forEach((p) => console.log("  · " + p));
}

/* ---------------- 本地服务 ---------------- */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

function serve() {
  http
    .createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let file = path.join(OUT, urlPath);
      if (urlPath.endsWith("/")) file = path.join(file, "index.html");
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        const alt = path.join(file, "index.html");
        file = fs.existsSync(alt) ? alt : path.join(OUT, "404.html");
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    })
    .listen(PORT, () => {
      console.log(`\n本地预览： http://127.0.0.1:${PORT}/`);
    });
}

await build();
if (!BUILD_ONLY) serve();
