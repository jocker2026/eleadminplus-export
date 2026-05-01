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

function renderCodeBlockHtml(code, lang = '') {
  const language = String(lang || '').trim();
  const languageBadge = language ? `<span class="code-lang">${escapeHtml(language)}</span>` : '';
  return `<div class="code-block"><div class="code-toolbar">${languageBadge}<button type="button" class="code-copy-btn">复制</button></div><pre><code data-lang="${escapeAttr(language)}">${escapeHtml(code)}</code></pre></div>`;
}

const browserCodeHelpers = String.raw`
    function normalizeCodeLang(lang) {
      const value = String(lang || '').trim().toLowerCase();
      if (!value) return '';
      if (value === 'javascript') return 'js';
      if (value === 'typescript') return 'ts';
      if (value === 'shell' || value === 'sh' || value === 'zsh') return 'bash';
      if (value === 'yml') return 'yaml';
      if (value === 'markup' || value === 'htm') return 'html';
      return value;
    }

    function renderWithRules(code, rules) {
      let index = 0;
      let output = '';
      while (index < code.length) {
        let matched = false;
        for (const rule of rules) {
          rule.regex.lastIndex = index;
          const match = rule.regex.exec(code);
          if (!match || match.index !== index) continue;
          output += '<span class="' + rule.className + '">' + escapeHtml(match[0]) + '</span>';
          index = rule.regex.lastIndex;
          matched = true;
          break;
        }
        if (!matched) {
          output += escapeHtml(code[index]);
          index += 1;
        }
      }
      return output;
    }

    function replaceOutsideTags(value, pattern, replacer) {
      return String(value).split(/(<[^>]+>)/g).map(function(part) {
        if (part.startsWith('<') && part.endsWith('>')) return part;
        return part.replace(pattern, replacer);
      }).join('');
    }

    function highlightJsLike(code) {
      let html = renderWithRules(code, [
        { regex: /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y, className: 'tok-comment' },
        { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\x60(?:\\.|[^\x60\\])*\x60/y, className: 'tok-string' },
        { regex: /\b(?:true|false|null|undefined|NaN|Infinity|new|return|await|async|import|from|export|default|const|let|var|if|else|switch|case|break|continue|for|while|do|try|catch|finally|throw|class|extends|super|this|typeof|instanceof|in|of|void|delete|get|set|static)\b/y, className: 'tok-keyword' },
        { regex: /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/iy, className: 'tok-number' },
        { regex: /\b(?:ref|computed|reactive|readonly|watch|watchEffect|toRef|toRefs|unref|isRef|defineProps|defineEmits|defineExpose|defineSlots|withDefaults|onMounted|onUnmounted|onUpdated|onBeforeMount|onBeforeUnmount|onBeforeUpdate|nextTick|useAttrs|useSlots|useCssModule|useCssVars)\b/y, className: 'tok-vue-api' },
        { regex: /\b(?:Array|Object|String|Number|Boolean|Promise|Map|Set|Date|Math|JSON|RegExp|Error|Symbol|Reflect|Proxy|console|window|document|navigator|location|history|URL|URLSearchParams|fetch|localStorage|sessionStorage|Intl)\b/y, className: 'tok-builtin' },
        { regex: /\b[A-Z][\w$]*(?=\s*(?:<[^>]+>\s*)?(?:extends\b|\(|\{))/y, className: 'tok-class' },
        { regex: /\b[A-Za-z_$][\w$]*(?=\s*\()/y, className: 'tok-function' }
      ]);
      html = replaceOutsideTags(html, /\b(class)\b/g, '<span class="tok-keyword">$1</span>');
      html = html.replace(/(<span class="tok-function">[A-Za-z_$][\w$]*<\/span>)(\s*\()([^)]*?)(\))/g, function(_, fn, open, params, close) {
        const highlightedParams = replaceOutsideTags(params, /\b([A-Za-z_$][\w$]*)\b/g, function(name, token) {
          if (/^(true|false|null|undefined|this)$/.test(token)) return name;
          return '<span class="tok-parameter">' + token + '</span>';
        });
        return fn + open + highlightedParams + close;
      });
      html = replaceOutsideTags(html, /(\.)([A-Za-z_$][\w$]*)/g, '$1<span class="tok-property">$2</span>');
      return html;
    }

    function highlightJson(code) {
      return renderWithRules(code, [
        { regex: /"(?:\\.|[^"\\])*"(?=\s*:)/y, className: 'tok-key' },
        { regex: /"(?:\\.|[^"\\])*"/y, className: 'tok-string' },
        { regex: /\b(?:true|false|null)\b/y, className: 'tok-keyword' },
        { regex: /\b-?\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/iy, className: 'tok-number' }
      ]);
    }

    function highlightBash(code) {
      return renderWithRules(code, [
        { regex: /#[^\n]*/y, className: 'tok-comment' },
        { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y, className: 'tok-string' },
        { regex: /\$[A-Za-z_][\w]*/y, className: 'tok-variable' },
        { regex: /--?[\w-]+/y, className: 'tok-operator' },
        { regex: /\b(?:npm|pnpm|yarn|node|npx|git|cd|ls|pwd|mkdir|rm|cp|mv|export|echo|cat|vite)\b/y, className: 'tok-keyword' }
      ]);
    }

    function highlightCss(code) {
      return renderWithRules(code, [
        { regex: /\/\*[\s\S]*?\*\//y, className: 'tok-comment' },
        { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y, className: 'tok-string' },
        { regex: /#[0-9a-fA-F]{3,8}\b/y, className: 'tok-number' },
        { regex: /\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|ms|s|deg)?\b/y, className: 'tok-number' },
        { regex: /[.#@]?[A-Za-z_-][\w-]*(?=\s*[:{])/y, className: 'tok-attr' }
      ]);
    }

    function highlightHtml(code) {
      let html = escapeHtml(code);
      const placeholders = [];
      const keep = function(markup) {
        return '\uE000' + (placeholders.push(markup) - 1) + '\uE001';
      };
      html = html.replace(/&lt;!--[\s\S]*?--&gt;/g, function(match) {
        return keep('<span class="tok-comment">' + match + '</span>');
      });
      html = html.replace(/(&lt;\/?)([\w:-]+)([\s\S]*?)(\/?&gt;)/g, function(_, open, tag, attrs, close) {
        const highlightedAttrs = attrs
          .replace(/([:@#]?[\w-]+(?:\.[\w-]+)*)(=)(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;)/g, function(_, name, eq, value) {
            let klass = 'tok-attr';
            if (/^v-/.test(name)) klass = 'tok-vue-directive';
            else if (/^@/.test(name)) klass = 'tok-vue-event';
            else if (/^:/.test(name)) klass = 'tok-vue-binding';
            else if (/^#/.test(name)) klass = 'tok-vue-slot';
            return '<span class="' + klass + '">' + name + '</span><span class="tok-punct">' + eq + '</span><span class="tok-string">' + value + '</span>';
          });
        const tagClass = /^[A-Z]/.test(tag) || tag.includes('-') ? 'tok-vue-component' : 'tok-tag';
        return keep('<span class="tok-punct">' + open + '</span><span class="' + tagClass + '">' + tag + '</span>' + highlightedAttrs + '<span class="tok-punct">' + close + '</span>');
      });
      return html.replace(/\uE000(\d+)\uE001/g, function(_, index) {
        return placeholders[Number(index)] || '';
      });
    }

    function highlightVue(code) {
      const blockPattern = /<(template|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
      let result = '';
      let lastIndex = 0;
      let match;

      while ((match = blockPattern.exec(code))) {
        if (match.index > lastIndex) {
          result += highlightHtml(code.slice(lastIndex, match.index));
        }

        const block = match[0];
        const openTagMatch = block.match(/^<[^>]+>/);
        const closeTagMatch = block.match(/<\/[^>]+>\s*$/);
        const openTag = openTagMatch ? openTagMatch[0] : '';
        const closeTag = closeTagMatch ? closeTagMatch[0] : '';
        const inner = block.slice(openTag.length, block.length - closeTag.length);
        const type = match[1].toLowerCase();

        result += highlightHtml(openTag);
        if (type === 'script') {
          result += highlightJsLike(inner);
        } else if (type === 'style') {
          result += highlightCss(inner);
        } else {
          result += highlightHtml(inner).replace(/\{\{([\s\S]*?)\}\}/g, function(_, expr) {
            return '<span class="tok-vue-mustache">{{</span><span class="tok-vue-expression">' + highlightJsLike(expr).trim() + '</span><span class="tok-vue-mustache">}}</span>';
          });
        }
        result += highlightHtml(closeTag);
        lastIndex = match.index + block.length;
      }

      if (lastIndex < code.length) {
        result += highlightHtml(code.slice(lastIndex));
      }

      return result || highlightHtml(code);
    }

    function createVueLineHighlighter() {
      let currentBlock = '';

      return function(line) {
        const openMatch = line.match(/<\s*(template|script|style)\b[^>]*>/i);
        const closeMatch = line.match(/<\s*\/\s*(template|script|style)\s*>/i);

        const highlightTemplateLine = function(value) {
          return highlightHtml(value).replace(/\{\{([\s\S]*?)\}\}/g, function(_, expr) {
            return '<span class="tok-vue-mustache">{{</span><span class="tok-vue-expression">' + highlightJsLike(expr).trim() + '</span><span class="tok-vue-mustache">}}</span>';
          });
        };

        if (!currentBlock) {
          if (!openMatch) {
            return highlightHtml(line);
          }

          const block = openMatch[1].toLowerCase();
          const openIndex = openMatch.index || 0;
          const openTag = openMatch[0];
          const before = line.slice(0, openIndex);
          const after = line.slice(openIndex + openTag.length);
          let output = highlightHtml(before) + highlightHtml(openTag);

          if (closeMatch && closeMatch[1].toLowerCase() === block && (closeMatch.index || 0) >= openIndex) {
            const closeIndex = closeMatch.index || 0;
            const inner = line.slice(openIndex + openTag.length, closeIndex);
            const closeTag = closeMatch[0];
            if (block === 'script') output += highlightJsLike(inner);
            else if (block === 'style') output += highlightCss(inner);
            else output += highlightTemplateLine(inner);
            output += highlightHtml(closeTag);
            output += highlightHtml(line.slice(closeIndex + closeTag.length));
            return output;
          }

          currentBlock = block;
          if (block === 'script') output += highlightJsLike(after);
          else if (block === 'style') output += highlightCss(after);
          else output += highlightTemplateLine(after);
          return output;
        }

        if (closeMatch && closeMatch[1].toLowerCase() === currentBlock) {
          const closeIndex = closeMatch.index || 0;
          const beforeClose = line.slice(0, closeIndex);
          const closeTag = closeMatch[0];
          const afterClose = line.slice(closeIndex + closeTag.length);
          let output = '';
          if (currentBlock === 'script') output += highlightJsLike(beforeClose);
          else if (currentBlock === 'style') output += highlightCss(beforeClose);
          else output += highlightTemplateLine(beforeClose);
          output += highlightHtml(closeTag);
          currentBlock = '';
          output += highlightHtml(afterClose);
          return output;
        }

        if (currentBlock === 'script') return highlightJsLike(line);
        if (currentBlock === 'style') return highlightCss(line);
        return highlightTemplateLine(line);
      };
    }

    function highlightCodeHtml(code, lang) {
      const language = normalizeCodeLang(lang);
      if (language === 'js' || language === 'jsx' || language === 'ts' || language === 'tsx') return highlightJsLike(code);
      if (language === 'json' || language === 'json5') return highlightJson(code);
      if (language === 'bash' || language === 'shellscript') return highlightBash(code);
      if (language === 'css' || language === 'scss' || language === 'less') return highlightCss(code);
      if (language === 'vue') return highlightVue(code);
      if (language === 'html' || language === 'xml') return highlightHtml(code);
      return escapeHtml(code);
    }

    function renderCodeLines(code, lang) {
      const rawLines = String(code || '').split('\n');
      if (rawLines.length && rawLines[rawLines.length - 1] === '') rawLines.pop();
      const lines = rawLines.length ? rawLines : [''];
      const language = normalizeCodeLang(lang);
      const vueLineHighlighter = language === 'vue' ? createVueLineHighlighter() : null;
      return lines.map(function(line, index) {
        const html = vueLineHighlighter ? vueLineHighlighter(line) : highlightCodeHtml(line, language);
        return '<span class="code-line" data-line="' + (index + 1) + '"><span class="code-line-no">' + (index + 1) + '</span><span class="code-line-text">' + html + '</span></span>';
      }).join('');
    }

    function renderCodeBlockHtml(code, lang) {
      const language = String(lang || '').trim();
      const languageBadge = language ? '<span class="code-lang">' + escapeHtml(language) + '</span>' : '';
      return '<div class="code-block"><div class="code-toolbar">' + languageBadge + '<button type="button" class="code-copy-btn">复制</button></div><pre><code data-lang="' + escapeAttr(language) + '">' + renderCodeLines(code, language) + '</code></pre></div>';
    }
`;

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
      --code-bg: linear-gradient(180deg, #1e1e1e 0%, #181818 100%);
      --code-surface: rgba(255, 255, 255, .06);
      --code-border: rgba(255, 255, 255, .12);
      --code-text: #d4d4d4;
      --code-muted: #858585;
      --code-inline-bg: #eef2ff;
      --code-inline-text: #1f3b8f;
      --shadow: 0 10px 28px rgba(16, 24, 40, .08);
    }
    body.theme-dark {
      color-scheme: dark;
      --bg: #0b1220;
      --panel: #101828;
      --text: #e5eefb;
      --muted: #9fb0c9;
      --line: #223048;
      --brand: #60a5fa;
      --brand-soft: rgba(96, 165, 250, .14);
      --code-inline-bg: rgba(96, 165, 250, .14);
      --code-inline-text: #b9dcff;
      --shadow: 0 14px 32px rgba(0, 0, 0, .34);
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
    .brand-actions {
      margin-left: auto;
      display: inline-flex;
      gap: 8px;
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
    .icon-btn {
      width: 32px;
      min-width: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255,255,255,.84);
      color: var(--muted);
      box-shadow: 0 4px 12px rgba(16,24,40,.05);
      backdrop-filter: blur(8px);
      transition: all .15s ease;
    }
    .icon-btn:hover {
      border-color: var(--brand);
      background: #fff;
      color: var(--brand);
      transform: translateY(-1px);
    }
    body.theme-dark .tools button,
    body.theme-dark .mobile-menu,
    body.theme-dark .icon-btn {
      background: rgba(16, 24, 40, .84);
      color: var(--text);
      box-shadow: 0 6px 16px rgba(0,0,0,.22);
    }
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
    body.sidebar-collapsed .app {
      grid-template-columns: 88px 1fr;
    }
    body.sidebar-collapsed .brand h1,
    body.sidebar-collapsed .brand .count,
    body.sidebar-collapsed .search,
    body.sidebar-collapsed .tools,
    body.sidebar-collapsed .nav-link span:not(.index),
    body.sidebar-collapsed .group-btn span:not(.chevron):not(.index),
    body.sidebar-collapsed .nav small {
      display: none;
    }
    body.sidebar-collapsed .brand {
      padding-left: 12px;
      padding-right: 12px;
    }
    body.sidebar-collapsed .brand-row {
      justify-content: center;
      gap: 0;
    }
    body.sidebar-collapsed .brand-actions {
      margin-left: 0;
      margin-top: 10px;
      width: 100%;
      justify-content: center;
    }
    body.sidebar-collapsed .nav {
      padding-left: 8px;
      padding-right: 8px;
    }
    body.sidebar-collapsed .nav-link,
    body.sidebar-collapsed .group-btn {
      justify-content: center;
      padding-left: 6px;
      padding-right: 6px;
    }
    body.sidebar-collapsed .nav-link .index,
    body.sidebar-collapsed .group-btn .index {
      min-width: 22px;
      padding: 0 3px;
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
      position: relative;
      overflow: auto;
      padding: 28px;
      min-height: 0;
    }
    .doc-pager-floating {
      position: sticky;
      top: 96px;
      z-index: 2;
      height: 0;
      pointer-events: none;
      opacity: .58;
      transition: opacity .18s ease, transform .18s ease;
    }
    .doc-pager-floating:hover,
    .doc-pager-floating.has-scroll {
      opacity: .96;
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
    .doc img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 16px auto;
      border-radius: 10px;
    }
    .doc ul, .doc ol { padding-left: 1.45em; margin: .7em 0 1em; }
    .doc blockquote {
      margin: 16px 0;
      padding: 10px 14px;
      border-left: 4px solid var(--brand);
      background: #f7fbff;
      color: #475467;
    }
    .code-block {
      margin: 16px 0;
      border: 1px solid var(--code-border);
      border-radius: 14px;
      background: var(--code-bg);
      overflow: hidden;
      box-shadow: 0 14px 28px rgba(0, 0, 0, .24);
    }
    .code-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 46px;
      padding: 0 14px;
      border-bottom: 1px solid rgba(255, 255, 255, .08);
      background:
        linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01)),
        rgba(255, 255, 255, .02);
    }
    .code-lang {
      color: #9cdcfe;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(86, 156, 214, .14);
      border: 1px solid rgba(86, 156, 214, .26);
    }
    .code-copy-btn {
      height: 30px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, .12);
      border-radius: 8px;
      background: rgba(255,255,255,.08);
      color: #d4d4d4;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
      transition: all .15s ease;
      backdrop-filter: blur(6px);
    }
    .code-copy-btn:hover {
      border-color: rgba(156, 220, 254, .34);
      background: rgba(255,255,255,.12);
    }
    .code-copy-btn.copied {
      border-color: rgba(78, 201, 176, .34);
      background: rgba(78, 201, 176, .18);
      color: #b5f5e6;
    }
    .doc pre {
      margin: 16px 0;
      padding: 18px 20px 20px;
      overflow: auto;
      border-radius: 0 0 14px 14px;
      border: 0;
      background: transparent;
      color: var(--code-text);
      line-height: 1.72;
      font-size: 13px;
    }
    .code-block pre { margin: 0; }
    .doc code {
      font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: .92em;
    }
    .doc pre code {
      display: block;
      color: var(--code-text);
      white-space: pre;
      tab-size: 2;
      -moz-tab-size: 2;
    }
    .code-line {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
      align-items: stretch;
      margin: 0 -20px;
      min-height: 24px;
    }
    .code-line:hover {
      background: rgba(255, 255, 255, .06);
    }
    .code-line-no {
      user-select: none;
      text-align: right;
      padding: 0 14px 0 0;
      color: #858585;
      border-right: 1px solid rgba(255, 255, 255, .08);
      background: rgba(255, 255, 255, .02);
    }
    .code-line-text {
      display: block;
      padding: 0 20px 0 16px;
      overflow-x: auto;
      white-space: pre;
    }
    .doc pre code .tok-comment { color: #6a9955; }
    .doc pre code .tok-keyword { color: #569cd6; }
    .doc pre code .tok-string { color: #ce9178; }
    .doc pre code .tok-number { color: #b5cea8; }
    .doc pre code .tok-function { color: #dcdcaa; }
    .doc pre code .tok-parameter { color: #9cdcfe; }
    .doc pre code .tok-class { color: #4ec9b0; }
    .doc pre code .tok-builtin { color: #4fc1ff; }
    .doc pre code .tok-vue-api { color: #dcdcaa; }
    .doc pre code .tok-property { color: #d4d4d4; }
    .doc pre code .tok-tag { color: #4ec9b0; }
    .doc pre code .tok-vue-component { color: #4fc1ff; }
    .doc pre code .tok-vue-directive { color: #c586c0; }
    .doc pre code .tok-vue-event { color: #d7ba7d; }
    .doc pre code .tok-vue-binding { color: #9cdcfe; }
    .doc pre code .tok-vue-slot { color: #c586c0; }
    .doc pre code .tok-vue-mustache { color: #c586c0; }
    .doc pre code .tok-vue-expression { color: #d4d4d4; }
    .doc pre code .tok-attr { color: #9cdcfe; }
    .doc pre code .tok-variable { color: #9cdcfe; }
    .doc pre code .tok-operator { color: #d4d4d4; }
    .doc pre code .tok-punct { color: #d4d4d4; }
    .doc pre code .tok-key { color: #9cdcfe; }
    .doc :not(pre) > code {
      padding: 3px 7px;
      border-radius: 7px;
      background: var(--code-inline-bg);
      color: var(--code-inline-text);
      border: 1px solid rgba(20, 71, 166, .08);
      font-size: .9em;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
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
    .doc-pager {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-left: auto;
      margin-right: 4px;
      width: 220px;
    }
    .doc-pager-progress {
      height: 4px;
      border-radius: 999px;
      background: rgba(191, 215, 255, .35);
      overflow: hidden;
      pointer-events: none;
    }
    .doc-pager-progress-bar {
      height: 100%;
      width: var(--doc-progress, 0%);
      background: linear-gradient(90deg, #60a5fa, #2563eb);
      border-radius: inherit;
      transition: width .12s linear;
    }
    .doc-pager-link {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 14px 16px 15px;
      border: 1px solid #e4e7ec;
      border-radius: 12px;
      background: rgba(251, 252, 254, .94);
      box-shadow: 0 10px 24px rgba(16, 24, 40, .08);
      backdrop-filter: blur(10px);
      color: inherit;
      text-decoration: none;
      transition: border-color .15s ease, background .15s ease, transform .15s ease;
    }
    .doc-pager-link:hover {
      border-color: #bfd7ff;
      background: #f7faff;
      text-decoration: none;
      transform: translateY(-1px);
    }
    .doc-pager-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: .02em;
    }
    .doc-pager-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      color: #98a2b3;
      font-size: 13px;
      flex: 0 0 auto;
    }
    .doc-pager-group {
      color: #98a2b3;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .doc-pager-title {
      color: #101828;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.45;
    }
    .doc-top-btn {
      pointer-events: auto;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid #d8e0ec;
      border-radius: 12px;
      background: rgba(255, 255, 255, .94);
      box-shadow: 0 10px 24px rgba(16, 24, 40, .08);
      color: #1d2939;
      font-weight: 650;
      cursor: pointer;
      backdrop-filter: blur(10px);
      transition: border-color .15s ease, background .15s ease, transform .15s ease;
    }
    .doc-top-btn[hidden] {
      display: none;
    }
    .doc-top-btn:hover {
      border-color: #bfd7ff;
      background: #f7faff;
      transform: translateY(-1px);
    }
    @media (max-width: 1280px) {
      .doc-pager-floating {
        position: static;
        height: auto;
        margin: 18px auto 0;
      }
      .doc-pager {
        width: auto;
        max-width: 1040px;
        margin: 0 auto;
        flex-direction: row;
        align-items: stretch;
      }
      .doc-pager-link,
      .doc-top-btn {
        flex: 1;
        min-width: 0;
      }
      .doc-top-btn {
        height: auto;
        padding: 14px 16px;
      }
    }
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
      body.sidebar-collapsed .app {
        grid-template-columns: 1fr;
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
      .doc-pager-floating {
        position: static;
        height: auto;
        margin: 0 auto 12px;
      }
      .doc-pager {
        width: auto;
        min-width: 0;
        flex-direction: column;
      }
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
          <div class="brand-actions">
            <button class="icon-btn" id="sidebarToggle" type="button" title="收起导航" aria-label="收起导航">≡</button>
            <button class="icon-btn" id="themeToggle" type="button" title="切换黑夜模式" aria-label="切换黑夜模式">◐</button>
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
        <nav class="doc-pager-floating" id="docPager"></nav>
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
    const docPager = document.getElementById('docPager');
    const currentTitle = document.getElementById('currentTitle');
    const currentPath = document.getElementById('currentPath');
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    const docCount = document.getElementById('docCount');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const themeToggle = document.getElementById('themeToggle');
    let currentFile = docs[0] ? docs[0].file : '';
    let docProgress = 0;
    let docIsScrollable = false;
    const THEME_KEY = 'eleadminplus-offline-theme';
    const SIDEBAR_KEY = 'eleadminplus-offline-sidebar';

    docCount.textContent = docs.length + ' 个页面';

    function applyTheme(theme) {
      document.body.classList.toggle('theme-dark', theme === 'dark');
      themeToggle.textContent = theme === 'dark' ? '☀' : '◐';
      themeToggle.title = theme === 'dark' ? '切换浅色模式' : '切换黑夜模式';
      themeToggle.setAttribute('aria-label', themeToggle.title);
    }

    function applySidebarCollapsed(collapsed) {
      if (window.innerWidth <= 860) return;
      document.body.classList.toggle('sidebar-collapsed', collapsed);
      sidebarToggle.textContent = collapsed ? '☰' : '≡';
      sidebarToggle.title = collapsed ? '展开导航' : '收起导航';
      sidebarToggle.setAttribute('aria-label', sidebarToggle.title);
    }

    applyTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');
    applySidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'collapsed');

    function siblingDocFiles(file) {
      for (const rootNode of navTree) {
        const files = leafFiles(rootNode);
        const index = files.indexOf(file);
        if (index >= 0) {
          const group = rootNode.title || '';
          return {
            prev: files[index - 1] || '',
            next: files[index + 1] || '',
            group
          };
        }
      }
      return { prev: '', next: '', group: '' };
    }

    function renderDocPager(file) {
      const siblings = siblingDocFiles(file);
      const renderLink = function(targetFile, kind, label) {
        if (!targetFile || !docsByFile.has(targetFile)) {
          return '';
        }
        const doc = docsByFile.get(targetFile);
        const icon = kind === 'prev' ? '←' : '→';
        const groupText = siblings.group ? '<span class="doc-pager-group">' + escapeHtml(navTitleWithoutIndex(siblings.group)) + '</span>' : '';
        return '<a class="doc-pager-link ' + kind + '" href="#doc=' + encodeURIComponent(targetFile) + '">' +
          '<span class="doc-pager-label"><span class="doc-pager-icon">' + icon + '</span>' + label + '</span>' +
          groupText +
          '<span class="doc-pager-title">' + escapeHtml(doc.navTitle || doc.title) + '</span>' +
        '</a>';
      };

      return '<nav class="doc-pager">' +
        '<div class="doc-pager-progress" aria-hidden="true"><div class="doc-pager-progress-bar"></div></div>' +
        renderLink(siblings.prev, 'prev', '上一篇') +
        renderLink(siblings.next, 'next', '下一篇') +
        '<button type="button" class="doc-top-btn" data-doc-action="top"><span class="doc-pager-icon">↑</span>回到顶部</button>' +
      '</nav>';
    }

    function updateDocPagerState() {
      const maxScroll = Math.max(0, docWrap.scrollHeight - docWrap.clientHeight);
      docIsScrollable = maxScroll > 160;
      docProgress = maxScroll > 0 ? Math.min(100, Math.max(0, (docWrap.scrollTop / maxScroll) * 100)) : 0;
      docPager.style.setProperty('--doc-progress', docProgress.toFixed(2) + '%');
      docPager.classList.toggle('has-scroll', docWrap.scrollTop > 8);
      const topButton = docPager.querySelector('.doc-top-btn');
      if (topButton) {
        topButton.hidden = !docIsScrollable || docWrap.scrollTop < 48;
      }
    }

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

${browserCodeHelpers}

    function sanitizeInlineHtml(value) {
      const htmlTagPattern = new RegExp('&lt;(\\\\/?)(span|br|small|strong|em)([\\\\s\\\\S]*?)&gt;', 'gi');
      return String(value).replace(htmlTagPattern, function(_, slash, tag, attrs) {
        let safeAttrs = '';
        if (!slash && tag.toLowerCase() === 'span') {
          const styleMatch = attrs.match(/style=(?:&quot;|&#39;)(.*?)(?:&quot;|&#39;)/i);
          if (styleMatch) {
            const safeStyle = styleMatch[1]
              .split(';')
              .map(function(item) { return item.trim(); })
              .filter(function(item) {
                return /^(color|font-weight)\s*:/i.test(item);
              })
              .join('; ');
            if (safeStyle) {
              safeAttrs = ' style="' + safeStyle.replace(/"/g, '&quot;') + '"';
            }
          }
        }
        return '<' + slash + tag + safeAttrs + '>';
      });
    }

    function imageHtml(markdown) {
      const imagePattern = new RegExp('!\\\\[([^\\\\]]*)\\\\]\\\\(([^)\\\\s]+)(?:\\\\s+[\\'\\"]([^\\'\\"]*)[\\'\\"])?\\\\)', 'g');
      return String(markdown).replace(imagePattern, function(_, alt, src, title) {
        const safeAlt = escapeAttr(alt || '');
        const safeSrc = escapeAttr(src || '');
        const sizeMatch = String(title || '').match(/:size=(\\d+)x(\\d+)/i);
        const styleAttr = sizeMatch ? ' style="max-width:min(100%, ' + sizeMatch[1] + 'px); width:100%; height:auto;"' : '';
        const safeTitle = title && !sizeMatch ? ' title="' + escapeAttr(title) + '"' : '';
        return '<img src="' + safeSrc + '" alt="' + safeAlt + '"' + safeTitle + styleAttr + ' loading="lazy">';
      });
    }

    function renderImageTag(alt, src, title) {
      const safeAlt = escapeAttr(alt || '');
      const safeSrc = escapeAttr(src || '');
      const sizeMatch = String(title || '').match(/:size=(\\d+)x(\\d+)/i);
      const styleAttr = sizeMatch ? ' style="max-width:min(100%, ' + sizeMatch[1] + 'px); width:100%; height:auto;"' : '';
      const safeTitle = title && !sizeMatch ? ' title="' + escapeAttr(title) + '"' : '';
      return '<img src="' + safeSrc + '" alt="' + safeAlt + '"' + safeTitle + styleAttr + ' loading="lazy">';
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
      const htmlTokens = [];
      let value = String(text).replace(/<br\\s*\\/?\\s*>/gi, '\\n');
      function reserveHtml(html) {
        const token = '\\u0000HTML' + htmlTokens.length + '\\u0000';
        htmlTokens.push(html);
        return token;
      }
      value = value.replace(/\x60([^\x60]+)\x60/g, function(_, inner) {
        const token = '\\u0000CODE' + code.length + '\\u0000';
        code.push('<code>' + escapeHtml(inner) + '</code>');
        return token;
      });
      value = value.replace(/!\\[([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+['"]([^'"]*)['"])?\\)/g, function(_, alt, src, title) {
        return reserveHtml(renderImageTag(alt, src, title));
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
      htmlTokens.forEach(function(html, index) {
        value = value.replaceAll('\\u0000HTML' + index + '\\u0000', html);
      });
      value = sanitizeInlineHtml(value);
      value = imageHtml(value);
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
          html.push(renderCodeBlockHtml(code.join('\\n'), lang));
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

    function scrollGroupToChildren(button) {
      const children = button.nextElementSibling;
      if (!children || !children.classList.contains('nav-children')) return;
      const firstChildLink = children.querySelector('.nav-link, .group-btn');
      if (!firstChildLink) return;
      firstChildLink.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }

    function firstDescendantFile(node) {
      if (!node) return '';
      if (node.file) return node.file;
      if (!node.children || !node.children.length) return '';
      for (const child of node.children) {
        const file = firstDescendantFile(child);
        if (file) return file;
      }
      return '';
    }

    function leafFiles(node) {
      if (!node) return [];
      if (node.file) return [node.file];
      if (!node.children || !node.children.length) return [];
      return node.children.flatMap(function(child) {
        return leafFiles(child);
      });
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
            const wasCollapsed = btn.classList.contains('collapsed');
            btn.classList.toggle('collapsed');
            if (wasCollapsed) {
              requestAnimationFrame(function() {
                scrollGroupToChildren(btn);
              });
            }
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
      docPager.innerHTML = renderDocPager(file);
      docWrap.scrollTop = 0;
      requestAnimationFrame(updateDocPagerState);
      markActive();
      document.body.classList.remove('sidebar-open');
    }

    async function copyCodeFromButton(button) {
      const block = button.closest('.code-block');
      const code = block && block.querySelector('code');
      const lineNodes = code ? Array.from(code.querySelectorAll('.code-line-text')) : [];
      const text = lineNodes.length
        ? lineNodes.map(function(line) { return line.textContent || ''; }).join('\\n')
        : (code ? code.textContent || '' : '');
      if (!text) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    function flashCopyButton(button, success) {
      const original = button.dataset.label || button.textContent;
      button.dataset.label = original;
      button.textContent = success ? '已复制' : '复制失败';
      button.classList.toggle('copied', success);
      clearTimeout(button._copyTimer);
      button._copyTimer = setTimeout(function() {
        button.textContent = original;
        button.classList.remove('copied');
      }, 1600);
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
    sidebarToggle.addEventListener('click', function() {
      if (window.innerWidth <= 860) {
        document.body.classList.toggle('sidebar-open');
        return;
      }
      const collapsed = !document.body.classList.contains('sidebar-collapsed');
      applySidebarCollapsed(collapsed);
      localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
    });
    themeToggle.addEventListener('click', function() {
      const dark = !document.body.classList.contains('theme-dark');
      applyTheme(dark ? 'dark' : 'light');
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    });
    document.addEventListener('click', function(event) {
      if (!document.body.classList.contains('sidebar-open')) return;
      const insideSidebar = event.target.closest('#sidebar');
      const mobileToggle = event.target.closest('#mobileMenu');
      if (insideSidebar || mobileToggle) return;
      document.body.classList.remove('sidebar-open');
    });
    window.addEventListener('resize', function() {
      if (window.innerWidth <= 860) {
        document.body.classList.remove('sidebar-collapsed');
      } else {
        applySidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'collapsed');
      }
    });
    docPager.addEventListener('click', function(event) {
      const actionButton = event.target.closest('[data-doc-action="top"]');
      if (!actionButton) return;
      docWrap.scrollTo({ top: 0, behavior: 'smooth' });
    });
    docWrap.addEventListener('scroll', updateDocPagerState);
    docEl.addEventListener('click', function(event) {
      const copyButton = event.target.closest('.code-copy-btn');
      if (copyButton && docEl.contains(copyButton)) {
        copyCodeFromButton(copyButton)
          .then(function() { flashCopyButton(copyButton, true); })
          .catch(function() { flashCopyButton(copyButton, false); });
        return;
      }
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
    nav.addEventListener('click', function(event) {
      const link = event.target.closest('.nav-link');
      if (!link) return;
      document.body.classList.remove('sidebar-open');
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
