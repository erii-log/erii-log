const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const markdownIt = require("markdown-it")({ html: true, linkify: true });
const {
  setMonths,
  renderPost,
  renderIndex,
  renderMonth,
  renderTagList,
  renderTag,
  renderAbout,
} = require("./templates");

const POSTS_DIR = path.resolve(__dirname, "../posts");
const OUT_DIR = path.resolve(__dirname, "../docs");
const PER_PAGE = 30;

// Tag name → short filesystem-safe slug
function tagSlug(tag) {
  return crypto.createHash("md5").update(tag).digest("hex").slice(0, 10);
}

// --- Utilities ---

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  mkdirp(dir);
}

// --- Step 1: Collect posts ---

function collectPosts() {
  const results = [];
  const monthDirs = fs.readdirSync(POSTS_DIR).filter((d) => {
    return fs.statSync(path.join(POSTS_DIR, d)).isDirectory() && /^\d{4}-\d{2}$/.test(d);
  });

  for (const monthDir of monthDirs.sort()) {
    const monthPath = path.join(POSTS_DIR, monthDir);
    const files = fs.readdirSync(monthPath).filter((f) => f.endsWith(".md"));

    for (const file of files.sort()) {
      const date = file.replace(".md", "");
      const day = date.slice(-2);
      const raw = fs.readFileSync(path.join(monthPath, file), "utf-8");

      // Extract title from h1
      const h1Match = raw.match(/^# (.+)$/m);
      const title = h1Match ? h1Match[1] : date;

      // Extract tags from h2
      const tags = [...raw.matchAll(/^## (.+)$/gm)].map((m) =>
        m[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim()
      );

      // Remove h1 from markdown before rendering (title is shown separately)
      const bodyMd = raw.replace(/^# .+$/m, "").trim();

      // Render markdown to HTML, strip <script> tags
      const content = markdownIt
        .render(bodyMd)
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

      results.push({
        date,
        day,
        month: monthDir,
        title,
        tags,
        content,
        url: `${monthDir}/${day}.html`,
      });
    }
  }

  // Sort descending by date
  results.sort((a, b) => b.date.localeCompare(a.date));

  // Add prev/next links
  for (let i = 0; i < results.length; i++) {
    results[i].nextUrl = i > 0 ? results[i - 1].url : null;
    results[i].prevUrl = i < results.length - 1 ? results[i + 1].url : null;
  }

  return results;
}

// --- Step 2: Build individual post pages ---

function buildPostPages(posts) {
  for (const post of posts) {
    const filePath = path.join(OUT_DIR, post.month, `${post.day}.html`);
    writeFile(filePath, renderPost(post));
  }
  console.log(`  Post pages: ${posts.length}`);
}

// --- Step 3: Build index pages with pagination ---

function buildIndexPages(posts) {
  const totalPages = Math.ceil(posts.length / PER_PAGE);

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * PER_PAGE;
    const slice = posts.slice(start, start + PER_PAGE);
    const root = page === 1 ? "." : "../..";
    const html = renderIndex(slice, { current: page, total: totalPages }, root);

    if (page === 1) {
      writeFile(path.join(OUT_DIR, "index.html"), html);
    } else {
      writeFile(path.join(OUT_DIR, "page", String(page), "index.html"), html);
    }
  }
  console.log(`  Index pages: ${totalPages}`);
}

// --- Step 4: Build month index pages ---

function buildMonthPages(posts) {
  const byMonth = new Map();
  for (const post of posts) {
    if (!byMonth.has(post.month)) byMonth.set(post.month, []);
    byMonth.get(post.month).push(post);
  }

  const sortedMonths = [...byMonth.keys()].sort();
  for (let i = 0; i < sortedMonths.length; i++) {
    const month = sortedMonths[i];
    const monthPosts = byMonth.get(month);
    const prevMonth = i > 0 ? sortedMonths[i - 1] : null;
    const nextMonth = i < sortedMonths.length - 1 ? sortedMonths[i + 1] : null;
    const filePath = path.join(OUT_DIR, month, "index.html");
    writeFile(filePath, renderMonth(month, monthPosts, { prevMonth, nextMonth }));
  }
  console.log(`  Month pages: ${byMonth.size}`);
}

// --- Step 5: Build tag pages ---

function buildTagPages(posts) {
  const byTag = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(post);
    }
  }

  // Tag list page
  const tagCounts = [...byTag.entries()].map(([tag, posts]) => ({
    tag,
    count: posts.length,
  }));
  writeFile(path.join(OUT_DIR, "tags", "index.html"), renderTagList(tagCounts));

  // Individual tag pages
  for (const [tag, tagPosts] of byTag) {
    const slug = tagSlug(tag);
    const filePath = path.join(OUT_DIR, "tags", slug, "index.html");
    writeFile(filePath, renderTag(tag, tagPosts));
  }
  console.log(`  Tag pages: ${byTag.size + 1}`);
}

// --- Step 6: Build sitemap.xml ---

const SITE_BASE_URL = "https://erii-log.github.io/";

function buildSitemap(posts) {
  const postUrls = posts.map((p) => {
    const lastmod = p.date;
    return `  <url>\n    <loc>${SITE_BASE_URL}/${p.url}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${postUrls.join("\n")}\n</urlset>\n`;

  writeFile(path.join(OUT_DIR, "sitemap.xml"), xml);
  console.log(`  Sitemap: ${posts.length} URLs`);
}

// --- Step 7: Build search index ---

function buildSearchIndex(posts) {
  const index = posts.map((p) => ({
    d: p.date,
    m: p.month,
    t: p.tags,
    u: p.url,
  }));
  writeFile(
    path.join(OUT_DIR, "search-index.json"),
    JSON.stringify(index)
  );
  const sizeKB = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
  console.log(`  Search index: ${sizeKB} KB`);
}

// --- Main ---

// --- Step 7: Copy static assets ---

function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    mkdirp(dest);
    for (const f of fs.readdirSync(src)) {
      copyRecursive(path.join(src, f), path.join(dest, f));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function copyAssets() {
  const assetsDir = path.join(__dirname, "assets");
  if (!fs.existsSync(assetsDir)) return;
  copyRecursive(assetsDir, OUT_DIR);
}

function copyPostsAssets() {
  const postsAssetDir = path.join(POSTS_DIR, "asset");
  if (!fs.existsSync(postsAssetDir)) return;
  copyRecursive(postsAssetDir, path.join(OUT_DIR, "asset"));
  console.log("  Posts assets: copied");
}

// --- Step 8: Build about page ---

function buildAboutPage() {
  const aboutPath = path.join(POSTS_DIR, "about.md");
  if (!fs.existsSync(aboutPath)) return;
  const raw = fs.readFileSync(aboutPath, "utf-8");
  const html = markdownIt.render(raw);
  writeFile(path.join(OUT_DIR, "about.html"), renderAbout(html));
  console.log("  About page: built");
}

// --- Main ---

console.log("Building static site...");
console.log(`  Posts dir: ${POSTS_DIR}`);
console.log(`  Output dir: ${OUT_DIR}`);

cleanDir(OUT_DIR);

const posts = collectPosts();
console.log(`  Total posts: ${posts.length}`);

// Pass month list to templates for sidebar navigation
const months = [...new Set(posts.map(p => p.month))].sort();
setMonths(months);

buildPostPages(posts);
buildIndexPages(posts);
buildMonthPages(posts);
buildTagPages(posts);
buildSitemap(posts);
buildSearchIndex(posts);
copyAssets();
copyPostsAssets();
buildAboutPage();

console.log("Done!");
