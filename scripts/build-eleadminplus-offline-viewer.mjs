import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.resolve(root, process.argv[2] || 'eleadminplus-doc-md-all');
const sidebarPath = path.join(outDir, '_sidebar.md');
const readmePath = path.join(outDir, 'README.md');
const indexPath = path.join(outDir, 'index.html');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function labelHtml(value) {
  return escapeHtml(value)
    .replace(/&lt;small[\s\S]*?&gt;/g, '<small>')
    .replace(/&lt;\/small&gt;/g, '</small>');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/:id=[\w-]+/g, '')
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function cleanMarkdown(markdown) {
  const lines = markdown
    .replace(/<script>new Function\(decodeURIComponent\(atob\('[\s\S]*?'\)\)\)\(\)<\/script>/g, '')
    .split(/\r?\n/);
  const cleaned = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('<div class="ele-docs-run"')) {
      cleaned.push(line);
      continue;
    }

    const block = [];
    let depth = 0;
    for (; i < lines.length; i += 1) {
      const current = lines[i];
      block.push(current);
      depth += (current.match(/<div\b/g) || []).length;
      depth -= (current.match(/<\/div>/g) || []).length;
      if (depth <= 0 && block.length > 1) {
        break;
      }
    }

    const html = block.join('\n');
    const href = html.match(/<a\s+[^>]*href="([^"]+)"/)?.[1];
    if (href) {
      cleaned.push('');
      cleaned.push(`> 在线演示：[新窗口打开](${href})`);
      cleaned.push('');
    }
  }

  return cleaned.join('\n').replace(/\n{4,}/g, '\n\n\n').trim() + '\n';
}

function parseReadme() {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const docs = [];

  for (const line of readme.split(/\r?\n/)) {
    const match = line.match(/^- \[([^\]]+)]\(\.\/(.+?\.md)\)$/);
    if (!match) {
      continue;
    }

    const title = match[1];
    const file = decodeURIComponent(match[2]);
    const filePath = path.join(outDir, file);
    docs.push({
      title,
      file,
      content: cleanMarkdown(fs.readFileSync(filePath, 'utf8'))
    });
  }

  return docs;
}

function parseSidebar(docs) {
  const sidebar = fs.readFileSync(sidebarPath, 'utf8');
  const rootNodes = [];
  const stack = [{ level: -1, children: rootNodes }];
  const routeMap = {};
  let docIndex = 0;

  for (const line of sidebar.split(/\r?\n/)) {
    const match = line.match(/^(\s*)- \[([\s\S]+?)]\(([^)]+)\)\s*$/);
    if (!match) {
      continue;
    }

    const level = Math.floor(match[1].length / 2);
    const rawTitle = match[2];
    const href = match[3];
    const node = {
      title: stripHtml(rawTitle),
      titleHtml: labelHtml(rawTitle),
      href,
      children: []
    };

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (href !== 'javascript:;') {
      const doc = docs[docIndex];
      if (!doc) {
        throw new Error(`Sidebar has more document links than README at: ${rawTitle}`);
      }
      node.file = doc.file;
      doc.route = href;
      doc.navTitle = node.title;
      doc.breadcrumb = stack
        .slice(1)
        .map((item) => item.node?.title)
        .filter(Boolean)
        .concat(node.title);
      routeMap[href] = doc.file;
      docIndex += 1;
    }

    stack[stack.length - 1].children.push(node);
    stack.push({ level, children: node.children, node });
  }

  if (docIndex !== docs.length) {
    throw new Error(`Sidebar links (${docIndex}) and README docs (${docs.length}) do not match.`);
  }

  return { nav: rootNodes, routeMap };
}

const docs = parseReadme();
const { nav, routeMap } = parseSidebar(docs);
const data = {
  generatedAt: new Date().toISOString(),
  docs,
  nav,
  routeMap
};

const dataJson = JSON.stringify(data)
  .replace(/<\/script/gi, '<\\/script')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EleAdminPlus 离线文档</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #fff;
      --text: #172033;
      --muted: #667085;
      --line: #d9e0ea;
      --brand: #1677ff;
      --brand-soft: #e8f1ff;
      --code-bg: #f1f4f8;
      --code-text: #223047;
      --shadow: 0 10px 28px rgba(16, 24, 40, .08);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
      color: var(--text);
      background: var(--bg);
      overflow: hidden;
    }
    button, input { font: inherit; }
    a { color: var(--brand); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .app {
      display: grid;
      grid-template-columns: minmax(260px, 340px) 1fr;
      height: 100vh;
      min-height: 0;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      height: 100vh;
      min-height: 0;
      min-width: 0;
      border-right: 1px solid var(--line);
      background: var(--panel);
    }
    .brand {
      padding: 18px 18px 12px;
      border-bottom: 1px solid var(--line);
      flex: 0 0 auto;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-mark {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      color: #fff;
      background: var(--brand);
      font-weight: 700;
      flex: 0 0 auto;
    }
    .brand h1 {
      margin: 0;
      font-size: 17px;
      line-height: 1.25;
    }
    .brand .count {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
    }
    .search {
      position: relative;
      margin-top: 14px;
    }
    .search input {
      width: 100%;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 34px 0 11px;
      color: var(--text);
      background: #fbfcfe;
      outline: none;
    }
    .search input:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(22, 119, 255, .12);
    }
    .clear-search {
      position: absolute;
      right: 4px;
      top: 4px;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 6px;
      color: var(--muted);
      background: transparent;
      cursor: pointer;
    }
    .clear-search:hover { background: #edf2f7; color: var(--text); }
    .tools {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .tools button, .mobile-menu {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      cursor: pointer;
      height: 32px;
      padding: 0 10px;
      font-size: 13px;
    }
    .tools button:hover, .mobile-menu:hover { border-color: var(--brand); color: var(--brand); }
    .nav {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 10px 10px 22px;
      overscroll-behavior: contain;
    }
    .nav-list, .nav-children {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .nav-item { margin: 1px 0; }
    .nav-item.depth-0 {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #eef2f6;
    }
    .nav-item.depth-0:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
    }
    .nav-link, .group-btn {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 30px;
      border-radius: 7px;
      color: #344054;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
      padding: 5px 8px;
      gap: 6px;
      line-height: 1.45;
      word-break: break-word;
    }
    .nav-link:hover, .group-btn:hover { background: #f1f5f9; text-decoration: none; }
    .nav-link.active {
      color: var(--brand);
      background: var(--brand-soft);
      font-weight: 600;
    }
    .group-btn { font-weight: 650; color: #1d2939; }
    .depth-0 > .group-btn,
    .depth-0 > .nav-link {
      min-height: 34px;
      color: #101828;
      font-size: 14px;
      font-weight: 750;
      background: #f8fafc;
      border: 1px solid #edf2f7;
    }
    .depth-0 > .group-btn:hover,
    .depth-0 > .nav-link:hover {
      background: #f1f5f9;
    }
    .depth-1 > .group-btn {
      margin-top: 7px;
      color: #1d2939;
      font-size: 13px;
      font-weight: 700;
    }
    .depth-2 > .nav-link,
    .depth-3 > .nav-link,
    .depth-4 > .nav-link {
      min-height: 28px;
      padding-top: 4px;
      padding-bottom: 4px;
      color: #475467;
      font-size: 13px;
    }
    .nav-link .index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 18px;
      padding: 0 5px;
      border-radius: 5px;
      background: #eef4ff;
      color: #175cd3;
      font-size: 11px;
      font-weight: 650;
      flex: 0 0 auto;
    }
    .chevron {
      width: 14px;
      color: #98a2b3;
      flex: 0 0 auto;
      transition: transform .16s ease;
    }
    .group-btn.collapsed .chevron { transform: rotate(-90deg); }
    .nav-children {
      margin-left: 10px;
      padding-left: 10px;
      border-left: 1px solid #edf1f6;
    }
    .depth-0 > .nav-children {
      margin-left: 5px;
      padding-left: 9px;
      border-left-color: #dbe7f5;
    }
    .depth-1 > .nav-children {
      margin-left: 8px;
      border-left-style: dashed;
    }
    .group-btn.collapsed + .nav-children { display: none; }
    .nav small { color: var(--muted); font-size: .92em; }
    .content-shell {
      min-width: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .topbar {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 58px;
      border-bottom: 1px solid var(--line);
      background: rgba(255,255,255,.86);
      backdrop-filter: blur(10px);
      padding: 0 24px;
    }
    .mobile-menu { display: none; }
    .title-stack {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .current-path {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .current-title {
      font-weight: 650;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .doc-wrap {
      overflow: auto;
      padding: 28px;
      min-height: 0;
    }
    .doc {
      max-width: 1040px;
      margin: 0 auto;
      padding: 34px 42px 52px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .doc h1, .doc h2, .doc h3, .doc h4, .doc h5, .doc h6 {
      margin: 1.6em 0 .75em;
      line-height: 1.35;
      letter-spacing: 0;
      color: #101828;
    }
    .doc h1:first-child, .doc h2:first-child, .doc h3:first-child { margin-top: 0; }
    .doc h1 { font-size: 28px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
    .doc h2 { font-size: 23px; padding-bottom: 10px; border-bottom: 1px solid #eef2f6; }
    .doc h3 { font-size: 19px; }
    .doc h4 { font-size: 16px; }
    .doc p, .doc li {
      color: #344054;
      font-size: 15px;
      line-height: 1.82;
    }
    .doc p { margin: .8em 0; }
    .doc ul, .doc ol { padding-left: 1.45em; margin: .7em 0 1em; }
    .doc blockquote {
      margin: 16px 0;
      padding: 10px 14px;
      border-left: 4px solid var(--brand);
      background: #f7fbff;
      color: #475467;
    }
    .doc pre {
      margin: 16px 0;
      padding: 15px 16px;
      overflow: auto;
      border-radius: 8px;
      border: 1px solid #d8e0ec;
      background: var(--code-bg);
      color: var(--code-text);
      line-height: 1.65;
      font-size: 13px;
    }
    .doc code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: .92em;
    }
    .doc :not(pre) > code {
      padding: 2px 5px;
      border-radius: 5px;
      background: #eef3f8;
      color: #0f4c81;
    }
    .table-wrap {
      width: 100%;
      overflow: auto;
      margin: 16px 0;
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .doc table {
      width: 100%;
      border-collapse: collapse;
      min-width: 560px;
      font-size: 14px;
    }
    .doc th, .doc td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      line-height: 1.65;
    }
    .doc th { background: #f8fafc; color: #1d2939; font-weight: 650; }
    .doc tr:last-child td { border-bottom: 0; }
    .md-tabs {
      margin: 18px 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
    .md-tab-buttons {
      display: flex;
      gap: 4px;
      padding: 8px 10px 0;
      border-bottom: 1px solid var(--line);
      background: #f8fafc;
      overflow-x: auto;
    }
    .md-tab-button {
      height: 34px;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: #475467;
      cursor: pointer;
      padding: 0 12px;
      font-weight: 650;
      white-space: nowrap;
    }
    .md-tab-button:hover {
      color: var(--brand);
      background: #eef4ff;
      border-radius: 7px 7px 0 0;
    }
    .md-tab-button.active {
      color: var(--brand);
      border-bottom-color: var(--brand);
      background: #fff;
      border-radius: 7px 7px 0 0;
    }
    .md-tab-panel {
      display: none;
      padding: 2px 16px 16px;
    }
    .md-tab-panel.active { display: block; }
    .md-tab-panel > :first-child { margin-top: 14px; }
    .md-tab-panel pre:last-child { margin-bottom: 0; }
    .empty {
      color: var(--muted);
      padding: 20px 8px;
      text-align: center;
      font-size: 14px;
    }
    mark {
      background: #fff3bf;
      color: inherit;
      padding: 0 1px;
    }
    @media (max-width: 860px) {
      body { overflow: auto; }
      .app { display: block; height: auto; min-height: 100vh; }
      .sidebar {
        position: fixed;
        z-index: 20;
        inset: 0 auto 0 0;
        width: min(88vw, 340px);
        transform: translateX(-102%);
        transition: transform .18s ease;
        box-shadow: 18px 0 34px rgba(16,24,40,.18);
      }
      body.sidebar-open .sidebar { transform: translateX(0); }
      .content-shell { height: auto; min-height: 100vh; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        padding: 0 14px;
      }
      .mobile-menu { display: inline-flex; align-items: center; justify-content: center; }
      .doc-wrap { padding: 14px; }
      .doc {
        padding: 24px 18px 36px;
        border-radius: 8px;
      }
      .doc h1 { font-size: 24px; }
      .doc h2 { font-size: 21px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-row">
          <div class="brand-mark">E</div>
          <div>
            <h1>EleAdminPlus 离线文档</h1>
            <div class="count" id="docCount"></div>
          </div>
        </div>
        <div class="search">
          <input id="searchInput" type="search" placeholder="搜索文档">
          <button class="clear-search" id="clearSearch" title="清空搜索" aria-label="清空搜索">×</button>
        </div>
        <div class="tools">
          <button id="expandAll" type="button">全部展开</button>
          <button id="collapseAll" type="button">全部收起</button>
        </div>
      </div>
      <nav class="nav" id="nav"></nav>
    </aside>
    <main class="content-shell">
      <div class="topbar">
        <button class="mobile-menu" id="mobileMenu" type="button">目录</button>
        <div class="title-stack">
          <div class="current-path" id="currentPath"></div>
          <div class="current-title" id="currentTitle"></div>
        </div>
      </div>
      <div class="doc-wrap" id="docWrap">
        <article class="doc" id="doc"></article>
      </div>
    </main>
  </div>
  <script type="application/json" id="doc-data">${dataJson}</script>
  <script>
    const DATA = JSON.parse(document.getElementById('doc-data').textContent);
    const docs = DATA.docs;
    const navTree = DATA.nav;
    const routeMap = DATA.routeMap;
    const docsByFile = new Map(docs.map(function(doc) { return [doc.file, doc]; }));
    const nav = document.getElementById('nav');
    const docEl = document.getElementById('doc');
    const docWrap = document.getElementById('docWrap');
    const currentTitle = document.getElementById('currentTitle');
    const currentPath = document.getElementById('currentPath');
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    const docCount = document.getElementById('docCount');
    let currentFile = docs[0] ? docs[0].file : '';

    docCount.textContent = docs.length + ' 个页面';

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function escapeAttr(value) {
      return escapeHtml(value).replaceAll(String.fromCharCode(96), '&#96;');
    }

    function normalizeRouteHref(href) {
      let value = String(href || '').trim();
      if (!value || value === 'javascript:;') return '';
      value = value.split(/[ \\t]/)[0];

      try {
        if (/^https?:\\/\\//i.test(value)) {
          const url = new URL(value);
          if (!/eleadmin\\.com$/i.test(url.hostname)) {
            return '';
          }
          value = url.pathname + url.search + url.hash;
        }
      } catch (_) {
        return '';
      }

      value = value.replace(/^\\.\\//, '');
      value = value.replace(/^\\/doc\\/eleadminplus\\/?#?\\/?/i, '');
      value = value.replace(/^#\\/?/, '');
      value = value.replace(/^\\/#\\/?/, '');

      if (value === '' || value === '/') return '/';
      value = value.replace(/^\\/+/, '');
      return value || '/';
    }

    function compactRouteHref(href) {
      const match = String(href || '').match(/^([^?]+)\\?id=([^#]+)(.*)$/);
      if (!match) return '';
      return match[1] + '?id=' + match[2].replaceAll('-', '') + match[3];
    }

    function findCompactRoute(href) {
      const compact = compactRouteHref(href);
      if (!compact) return '';
      let found = '';
      for (const key of Object.keys(routeMap)) {
        if (compactRouteHref(key) !== compact) continue;
        if (found && found !== routeMap[key]) return '';
        found = routeMap[key];
      }
      return found;
    }

    function correctedLinkLabel(label, localFile) {
      const rawLabel = String(label || '').trim();
      const labelNumber = rawLabel.match(/^\\d+(?:\\.\\d+)*$/)?.[0];
      const targetNumber = docsByFile.get(localFile)?.navTitle?.match(/^\\d+(?:\\.\\d+)*/)?.[0];
      if (!labelNumber || !targetNumber) return label;
      if (labelNumber.split('.').length !== targetNumber.split('.').length) return label;
      return targetNumber;
    }

    function renderInline(text) {
      const code = [];
      let value = String(text).replace(/<br\\s*\\/?\\s*>/gi, '\\n');
      value = value.replace(/\x60([^\x60]+)\x60/g, function(_, inner) {
        const token = '\\u0000CODE' + code.length + '\\u0000';
        code.push('<code>' + escapeHtml(inner) + '</code>');
        return token;
      });
      value = escapeHtml(value);
      value = value.replace(/\\[([^\\]]+)]\\(([^)]+)\\)/g, function(_, label, href) {
        const rawHref = href.trim();
        const localFile = resolveLocalHref(rawHref);
        const safeLabel = renderInline(correctedLinkLabel(label, localFile));
        if (localFile) {
          return '<a href="#doc=' + encodeURIComponent(localFile) + '">' + safeLabel + '</a>';
        }
        return '<a href="' + escapeAttr(rawHref) + '" target="_blank" rel="noopener noreferrer">' + safeLabel + '</a>';
      });
      value = value
        .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>');
      code.forEach(function(html, index) {
        value = value.replaceAll('\\u0000CODE' + index + '\\u0000', html);
      });
      return value;
    }

    function resolveLocalHref(href) {
      if (!href || href === 'javascript:;') return '';
      const clean = normalizeRouteHref(href);
      if (clean.endsWith('.md')) {
        try {
          return decodeURIComponent(clean);
        } catch (_) {
          return clean;
        }
      }
      if (routeMap[clean]) return routeMap[clean];
      const noHash = clean.split('#')[0];
      if (routeMap[noHash]) return routeMap[noHash];
      return findCompactRoute(noHash);
    }

    function headingText(line) {
      return line.replace(/\\s*:id=[\\w-]+\\s*$/i, '').trim();
    }

    function isTableSeparator(line) {
      return /^\\s*\\|?\\s*:?-{3,}:?\\s*(\\|\\s*:?-{3,}:?\\s*)+\\|?\\s*$/.test(line);
    }

    function splitTableRow(line) {
      return line.trim().replace(/^\\|/, '').replace(/\\|$/, '').split('|').map(function(cell) {
        return cell.trim();
      });
    }

    function tabTitleFromHeading(line) {
      const match = line.match(/^#{2,6}\\s+\\*\\*(.+?)\\*\\*\\s*$/);
      return match ? headingText(match[1]).trim() : '';
    }

    function renderTabs(lines) {
      const tabs = [];
      let current = null;

      lines.forEach(function(line) {
        const title = tabTitleFromHeading(line);
        if (title) {
          if (current) {
            tabs.push(current);
          }
          current = { title: title, lines: [] };
          return;
        }

        if (current) {
          current.lines.push(line);
        }
      });

      if (current) {
        tabs.push(current);
      }

      if (!tabs.length) {
        return renderMarkdown(lines.join('\\n'));
      }

      return '<div class="md-tabs"><div class="md-tab-buttons">' + tabs.map(function(tab, index) {
        return '<button type="button" class="md-tab-button' + (index === 0 ? ' active' : '') + '" data-tab-index="' + index + '">' + escapeHtml(tab.title) + '</button>';
      }).join('') + '</div>' + tabs.map(function(tab, index) {
        return '<section class="md-tab-panel' + (index === 0 ? ' active' : '') + '" data-tab-panel="' + index + '">' + renderMarkdown(tab.lines.join('\\n')) + '</section>';
      }).join('') + '</div>';
    }

    function renderMarkdown(markdown) {
      const lines = String(markdown || '').replace(/\\r\\n?/g, '\\n').split('\\n');
      const html = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
          i += 1;
          continue;
        }

        if (line.trim() === '<!-- tabs:start -->') {
          const tabLines = [];
          i += 1;
          while (i < lines.length && lines[i].trim() !== '<!-- tabs:end -->') {
            tabLines.push(lines[i]);
            i += 1;
          }
          if (i < lines.length) i += 1;
          html.push(renderTabs(tabLines));
          continue;
        }

        const fence = line.match(/^\\x60\\x60\\x60\\s*([\\w-]*)\\s*$/);
        if (fence) {
          const lang = fence[1] || '';
          const code = [];
          i += 1;
          while (i < lines.length && !/^\\x60\\x60\\x60\\s*$/.test(lines[i])) {
            code.push(lines[i]);
            i += 1;
          }
          if (i < lines.length) i += 1;
          html.push('<pre><code data-lang="' + escapeAttr(lang) + '">' + escapeHtml(code.join('\\n')) + '</code></pre>');
          continue;
        }

        const heading = line.match(/^(#{1,6})\\s+(.+)$/);
        if (heading) {
          const level = Math.min(heading[1].length + 1, 6);
          const text = headingText(heading[2]);
          const id = slugify(text);
          html.push('<h' + level + ' id="' + escapeAttr(id) + '">' + renderInline(text) + '</h' + level + '>');
          i += 1;
          continue;
        }

        if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
          const headers = splitTableRow(line);
          const rows = [];
          i += 2;
          while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
            rows.push(splitTableRow(lines[i]));
            i += 1;
          }
          html.push('<div class="table-wrap"><table><thead><tr>' + headers.map(function(cell) {
            return '<th>' + renderInline(cell) + '</th>';
          }).join('') + '</tr></thead><tbody>' + rows.map(function(row) {
            return '<tr>' + row.map(function(cell) {
              return '<td>' + renderInline(cell) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div>');
          continue;
        }

        if (/^>\\s?/.test(line)) {
          const quote = [];
          while (i < lines.length && /^>\\s?/.test(lines[i])) {
            quote.push(lines[i].replace(/^>\\s?/, ''));
            i += 1;
          }
          html.push('<blockquote>' + renderMarkdown(quote.join('\\n')) + '</blockquote>');
          continue;
        }

        if (/^\\s*[-*+]\\s+/.test(line) || /^\\s*\\d+\\.\\s+/.test(line)) {
          const ordered = /^\\s*\\d+\\.\\s+/.test(line);
          const tag = ordered ? 'ol' : 'ul';
          const items = [];
          const itemPattern = ordered ? /^\\s*\\d+\\.\\s+(.*)$/ : /^\\s*[-*+]\\s+(.*)$/;
          while (i < lines.length && itemPattern.test(lines[i])) {
            items.push(lines[i].replace(itemPattern, '$1'));
            i += 1;
          }
          html.push('<' + tag + '>' + items.map(function(item) {
            return '<li>' + renderInline(item) + '</li>';
          }).join('') + '</' + tag + '>');
          continue;
        }

        const paragraph = [line];
        i += 1;
        while (
          i < lines.length &&
          lines[i].trim() &&
          !/^\\x60\\x60\\x60/.test(lines[i]) &&
          lines[i].trim() !== '<!-- tabs:start -->' &&
          !/^(#{1,6})\\s+/.test(lines[i]) &&
          !/^>\\s?/.test(lines[i]) &&
          !/^\\s*[-*+]\\s+/.test(lines[i]) &&
          !/^\\s*\\d+\\.\\s+/.test(lines[i]) &&
          !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
        ) {
          paragraph.push(lines[i]);
          i += 1;
        }
        html.push('<p>' + renderInline(paragraph.join('\\n')).replace(/\\n/g, '<br>') + '</p>');
      }

      return html.join('\\n');
    }

    function slugify(value) {
      return String(value)
        .toLowerCase()
        .replace(/:id=[\\w-]+/g, '')
        .trim()
        .replace(/[^\\p{L}\\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'section';
    }

    function navIndex(title) {
      const match = String(title || '').match(/^(\\d+(?:\\.\\d+)*)/);
      return match ? match[1] : '';
    }

    function navTitleWithoutIndex(titleHtml) {
      return String(titleHtml || '').replace(/^\\d+(?:\\.\\d+)*[、.]\\s*/, '');
    }

    function renderTree(nodes, container, depth) {
      const ul = document.createElement('ul');
      ul.className = container === nav ? 'nav-list' : 'nav-children';
      nodes.forEach(function(node) {
        const li = document.createElement('li');
        li.className = 'nav-item depth-' + depth;
        if (node.file) {
          const link = document.createElement('a');
          link.className = 'nav-link depth-link-' + depth;
          link.href = '#doc=' + encodeURIComponent(node.file);
          link.dataset.file = node.file;
          const index = navIndex(node.title);
          const titleHtml = index ? navTitleWithoutIndex(node.titleHtml) : node.titleHtml;
          link.innerHTML = (index ? '<span class="index">' + escapeHtml(index) + '</span>' : '') + '<span>' + titleHtml + '</span>';
          li.appendChild(link);
        } else {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'group-btn depth-group-' + depth;
          const index = navIndex(node.title);
          const titleHtml = index ? navTitleWithoutIndex(node.titleHtml) : node.titleHtml;
          btn.innerHTML = '<span class="chevron">⌄</span>' + (index ? '<span class="index">' + escapeHtml(index) + '</span>' : '') + '<span>' + titleHtml + '</span>';
          btn.addEventListener('click', function() {
            btn.classList.toggle('collapsed');
          });
          li.appendChild(btn);
        }
        if (node.children && node.children.length) {
          renderTree(node.children, li, depth + 1);
        }
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    function renderSearch(query) {
      const q = query.trim().toLowerCase();
      nav.innerHTML = '';
      if (!q) {
        renderTree(navTree, nav, 0);
        markActive();
        return;
      }

      const matches = docs.filter(function(doc) {
        return (doc.title + ' ' + (doc.navTitle || '') + ' ' + doc.content).toLowerCase().includes(q);
      }).slice(0, 120);

      if (!matches.length) {
        nav.innerHTML = '<div class="empty">没有匹配结果</div>';
        return;
      }

      const ul = document.createElement('ul');
      ul.className = 'nav-list';
      matches.forEach(function(doc) {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const a = document.createElement('a');
        a.className = 'nav-link';
        a.href = '#doc=' + encodeURIComponent(doc.file);
        a.dataset.file = doc.file;
        a.innerHTML = '<span>' + escapeHtml((doc.breadcrumb || [doc.navTitle || doc.title]).join(' / ')) + '</span>';
        li.appendChild(a);
        ul.appendChild(li);
      });
      nav.appendChild(ul);
      markActive();
    }

    function loadFromHash() {
      const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
      let file = '';
      if (hash.startsWith('doc=')) {
        file = hash.slice(4);
      } else {
        const route = normalizeRouteHref(hash);
        if (routeMap[route]) {
          file = routeMap[route];
        }
      }
      if (!file || !docsByFile.has(file)) {
        file = currentFile || (docs[0] && docs[0].file);
      }
      showDoc(file);
    }

    function showDoc(file) {
      const doc = docsByFile.get(file);
      if (!doc) return;
      currentFile = file;
      currentTitle.textContent = doc.navTitle || doc.title;
      currentPath.textContent = (doc.breadcrumb || []).slice(0, -1).join(' / ');
      docEl.innerHTML = renderMarkdown(doc.content);
      docWrap.scrollTop = 0;
      markActive();
      document.body.classList.remove('sidebar-open');
    }

    function markActive() {
      document.querySelectorAll('.nav-link.active').forEach(function(link) {
        link.classList.remove('active');
      });
      document.querySelectorAll('.nav-link[data-file="' + CSS.escape(currentFile) + '"]').forEach(function(link) {
        link.classList.add('active');
        let parent = link.parentElement;
        while (parent) {
          const previous = parent.previousElementSibling;
          if (previous && previous.classList && previous.classList.contains('group-btn')) {
            previous.classList.remove('collapsed');
          }
          parent = parent.parentElement;
        }
      });
    }

    document.getElementById('expandAll').addEventListener('click', function() {
      document.querySelectorAll('.group-btn').forEach(function(btn) { btn.classList.remove('collapsed'); });
    });
    document.getElementById('collapseAll').addEventListener('click', function() {
      document.querySelectorAll('.group-btn').forEach(function(btn) { btn.classList.add('collapsed'); });
      markActive();
    });
    document.getElementById('mobileMenu').addEventListener('click', function() {
      document.body.classList.toggle('sidebar-open');
    });
    docEl.addEventListener('click', function(event) {
      const button = event.target.closest('.md-tab-button');
      if (!button || !docEl.contains(button)) return;
      const tabs = button.closest('.md-tabs');
      if (!tabs) return;
      const index = button.dataset.tabIndex;
      tabs.querySelectorAll('.md-tab-button').forEach(function(item) {
        item.classList.toggle('active', item === button);
      });
      tabs.querySelectorAll('.md-tab-panel').forEach(function(panel) {
        panel.classList.toggle('active', panel.dataset.tabPanel === index);
      });
    });
    searchInput.addEventListener('input', function() {
      renderSearch(searchInput.value);
    });
    clearSearch.addEventListener('click', function() {
      searchInput.value = '';
      renderSearch('');
      searchInput.focus();
    });
    window.addEventListener('hashchange', loadFromHash);

    renderTree(navTree, nav, 0);
    loadFromHash();
  </script>
</body>
</html>`;

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Built ${indexPath}`);
console.log(`Docs: ${docs.length}`);
