const crypto = require("crypto");

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tagSlug(tag) {
  return crypto.createHash("md5").update(tag).digest("hex").slice(0, 10);
}

// months is set by build.js before rendering
let _months = [];
function setMonths(months) { _months = months; }

function renderMonthNav(root, currentMonth) {
  // Group months by year
  const byYear = new Map();
  for (const m of _months) {
    const year = m.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(m);
  }

  const years = [...byYear.keys()].sort().reverse();
  const items = years.map(year => {
    const months = byYear.get(year).sort().reverse();
    const monthLinks = months.map(m => {
      const mm = m.slice(5, 7);
      const cls = m === currentMonth ? ' class="active"' : '';
      return `<a href="${root}/${m}/index.html"${cls}>${mm}月</a>`;
    }).join(" ");
    return `<details${currentMonth && currentMonth.startsWith(year) ? " open" : ""}>
<summary>${year}年</summary>
<div class="month-links">${monthLinks}</div>
</details>`;
  }).join("\n");

  return `<aside class="month-nav">
<h2>月別</h2>
${items}
</aside>`;
}

function renderBase(title, content, { hasEmbeds = false, currentMonth = null, root = "." } = {}) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - 山崎エリイ活動記録</title>
<link rel="stylesheet" href="${root}/css/style.css">
${hasEmbeds ? `<link rel="dns-prefetch" href="https://platform.twitter.com">
<link rel="dns-prefetch" href="https://www.instagram.com">
<link rel="preconnect" href="https://platform.twitter.com" crossorigin>
<link rel="preconnect" href="https://www.instagram.com" crossorigin>
<link rel="preload" as="script" href="https://platform.twitter.com/widgets.js">
<link rel="preload" as="script" href="https://www.instagram.com/embed.js">` : ""}
</head>
<body>
<header>
  <nav>
    <a href="${root}/index.html" class="site-title">山崎エリイ活動記録</a>
    <a href="${root}/tags/index.html">タグ一覧</a>
    <a href="${root}/about.html">このサイトについて</a>
  </nav>
</header>
<div class="layout">
${renderMonthNav(root, currentMonth)}
<main>
${content}
</main>
</div>
<footer>
  <p><a href="${root}/about.html">このサイトについて</a></p>
</footer>
${hasEmbeds ? `<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
<script async src="https://www.instagram.com/embed.js"></script>` : ""}
</body>
</html>`;
}

function renderTagBadges(root, tags) {
  return tags.map(t =>
    `<a href="${root}/tags/${tagSlug(t)}/index.html" class="tag">${escapeHtml(t)}</a>`
  ).join(" ");
}

function renderPost(post) {
  const root = "..";
  const content = `
<article class="post-full">
  <h1>${escapeHtml(post.title)}</h1>
  <div class="tags">${renderTagBadges(root, post.tags)}</div>
  <div class="post-nav">
    ${post.prevUrl ? `<a href="${root}/${post.prevUrl}">&larr; 前の日</a>` : "<span></span>"}
    <a href="${root}/${post.month}/index.html">月の一覧</a>
    ${post.nextUrl ? `<a href="${root}/${post.nextUrl}">&rarr; 次の日</a>` : "<span></span>"}
  </div>
  <div class="post-content">
    ${post.content}
  </div>
</article>`;
  return renderBase(post.title, content, { hasEmbeds: true, currentMonth: post.month, root });
}

function renderPostListItem(root, post) {
  return `<li>
  <a href="${root}/${post.url}">${escapeHtml(post.title)}</a>
  <span class="tags-inline">${renderTagBadges(root, post.tags)}</span>
</li>`;
}

function renderPagination(current, total, baseUrl) {
  if (total <= 1) return "";
  const links = [];
  if (current > 1) {
    const prev = current === 2 ? `${baseUrl}index.html` : `${baseUrl}page/${current - 1}/index.html`;
    links.push(`<a href="${prev}">&laquo; 前へ</a>`);
  }

  const start = Math.max(1, current - 3);
  const end = Math.min(total, current + 3);
  for (let i = start; i <= end; i++) {
    const url = i === 1 ? `${baseUrl}index.html` : `${baseUrl}page/${i}/index.html`;
    if (i === current) {
      links.push(`<span class="current">${i}</span>`);
    } else {
      links.push(`<a href="${url}">${i}</a>`);
    }
  }

  if (current < total) {
    links.push(`<a href="${baseUrl}page/${current + 1}/index.html">次へ &raquo;</a>`);
  }
  return `<nav class="pagination">${links.join(" ")}</nav>`;
}

function renderIndex(posts, pagination, root) {
  const content = `
<h1>活動記録</h1>
<ul class="post-list">
${posts.map(p => renderPostListItem(root, p)).join("\n")}
</ul>
${renderPagination(pagination.current, pagination.total, `${root}/`)}`;
  return renderBase("活動記録", content, { root });
}

function renderMonthPostItem(root, post) {
  return `<article class="post-full" id="${post.day}">
  <h1><a href="${root}/${post.url}">${escapeHtml(post.title)}</a></h1>
  <div class="tags">${renderTagBadges(root, post.tags)}</div>
  <div class="post-content">
    ${post.content}
  </div>
</article>`;
}

function renderMonth(month, posts, { prevMonth = null, nextMonth = null } = {}) {
  const root = "..";
  const toc = posts.map(p =>
    `<li><a href="#${p.day}">${escapeHtml(p.title)}</a></li>`
  ).join("\n");
  const monthNav = `<div class="post-nav">
    ${prevMonth ? `<a href="${root}/${prevMonth}/index.html">&larr; ${prevMonth}</a>` : "<span></span>"}
    <a href="${root}/index.html">トップへ</a>
    ${nextMonth ? `<a href="${root}/${nextMonth}/index.html">${nextMonth} &rarr;</a>` : "<span></span>"}
  </div>`;
  const content = `
<h1>${month}</h1>
${monthNav}
<nav class="month-toc">
<ul>
${toc}
</ul>
</nav>
${posts.map(p => renderMonthPostItem(root, p)).join("\n<hr>\n")}
${monthNav}`;
  return renderBase(month, content, { hasEmbeds: true, currentMonth: month, root });
}

function renderTagList(tagCounts) {
  const root = "..";
  const items = tagCounts
    .sort((a, b) => b.count - a.count)
    .map(({ tag, count }) =>
      `<li><a href="${root}/tags/${tagSlug(tag)}/index.html">${escapeHtml(tag)}</a> <span class="count">(${count})</span></li>`
    );
  const content = `
<h1>タグ一覧</h1>
<ul class="tag-list">
${items.join("\n")}
</ul>
<p><a href="${root}/index.html">&larr; トップへ</a></p>`;
  return renderBase("タグ一覧", content, { root });
}

function renderTag(tag, posts) {
  const root = "../..";
  const content = `
<h1>${escapeHtml(tag)}</h1>
<p>${posts.length} 件の記録</p>
<ul class="post-list">
${posts.map(p => renderPostListItem(root, p)).join("\n")}
</ul>
<p><a href="${root}/tags/index.html">&larr; タグ一覧</a></p>`;
  return renderBase(tag, content, { root });
}

function renderAbout(htmlContent) {
  const root = ".";
  const content = `<article class="post-full">${htmlContent}</article>`;
  return renderBase("このサイトについて", content, { root });
}

module.exports = {
  setMonths,
  renderBase,
  renderPost,
  renderIndex,
  renderMonth,
  renderTagList,
  renderTag,
  renderAbout,
};
