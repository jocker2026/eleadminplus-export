import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = 'https://eleadmin.com/doc/eleadminplus/';
const port = 9228;

const getArgValue = (name) => {
  const arg = process.argv.find((item) => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : undefined;
};

function getDefaultChromePath() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return 'google-chrome';
}

const chromePath = getArgValue('--chrome-path') || process.env.CHROME_PATH || getDefaultChromePath();
const outDir = resolve(getArgValue('--out-dir') || 'eleadminplus-doc-md');
const chromeUserDataDir = getArgValue('--user-data-dir');
const allLinks = process.argv.includes('--all-links');
if (!chromeUserDataDir) {
  throw new Error('Missing --user-data-dir=/path/to/chrome-profile');
}

function rotateChars(text, offset) {
  const chars = [...text];
  const max = chars.length - offset;
  if (max <= 0) return text;
  const result = new Array(chars.length);
  for (let i = 0; i < chars.length; i++) {
    result[i] = i < offset ? chars[max + i] : chars[i - offset];
  }
  return result.join('');
}

function decodeDocsifyPayload(payload, length = 16, offset = 4) {
  const rotated = rotateChars(payload, offset);
  const chunks = [];
  for (let start = 0; start < rotated.length; start += length) {
    chunks.push([...rotated.slice(start, start + length)].reverse().join(''));
  }
  return Buffer.from(chunks.join('').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64').toString('utf8');
}

async function waitForChrome() {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Chrome did not start DevTools in time');
}

async function createTarget() {
  // Create a blank target first, then navigate with CDP.
  // This avoids Chrome trying to open its default new-tab page for the profile.
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT'
  });
  if (!res.ok) throw new Error(`Failed to create tab: ${res.status} ${res.statusText}`);
  return res.json();
}

function shouldIgnoreChromeStderr(text) {
  return [
    'Requested load of chrome://newtab/ for incorrect profile type.',
    'task_policy_set TASK_CATEGORY_POLICY: (os/kern) invalid argument (4)',
    'task_policy_set TASK_SUPPRESSION_POLICY: (os/kern) invalid argument (4)'
  ].some((pattern) => text.includes(pattern));
}

class CdpClient {
  constructor(socketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(socketUrl);
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id) return;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(`${msg.error.message}: ${msg.error.data || ''}`));
      else pending.resolve(msg.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.socket.close();
  }
}

function safeMdName(index, title, page) {
  const cleanTitle = title
    .replace(/<[^>]+>/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70);
  const cleanPage = page.replace(/[\\/:*?"<>|]/g, '-').replace(/^-?$/, 'home');
  return `${String(index + 1).padStart(2, '0')}-${cleanPage}-${cleanTitle}.md`;
}

function safeMdNameForItem(index, item) {
  const cleanTitle = item.title
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const cleanHref = item.href
    .replace(/[?&=]/g, '-')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/^-?$/, 'home')
    .slice(0, 90);
  return `${String(index + 1).padStart(3, '0')}-${cleanHref}-${cleanTitle}.md`;
}

function extractPages(sidebarMarkdown) {
  const pages = [];
  const seen = new Set();
  const matches = sidebarMarkdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of matches) {
    const title = match[1].replace(/<[^>]+>/g, '').trim();
    const href = match[2];
    if (href.startsWith('javascript:')) continue;
    const page = href.split('?')[0] || '/';
    const key = allLinks ? href : page;
    if (seen.has(key)) continue;
    seen.add(key);
    pages.push({ title, page, href });
  }
  return pages;
}

function stripInlineMarkdown(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSectionMarkdown(markdown, title, href = '') {
  const cleanTitle = stripInlineMarkdown(title);
  const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  const id = new URLSearchParams(query).get('id');
  if (!cleanTitle || cleanTitle === '更新日志') return markdown;
  const lines = markdown.split(/\r?\n/);
  let start = -1;
  let level = 6;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (!match) continue;
    const headingText = stripInlineMarkdown(match[2]);
    if ((id && match[2].includes(`:id=${id}`)) || headingText === cleanTitle || headingText.includes(cleanTitle) || cleanTitle.includes(headingText)) {
      start = i;
      level = match[1].length;
      break;
    }
  }
  if (start < 0) return markdown;
  let end = lines.length;
  inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+/.exec(lines[i]);
    if (match && match[1].length <= level) {
      end = i;
      break;
    }
  }
  return `${lines.slice(start, end).join('\n').trim()}\n`;
}

async function fetchTextInBrowser(client, url) {
  const result = await client.send('Runtime.evaluate', {
    expression: `fetch(${JSON.stringify(url)}, { credentials: 'include' }).then(async (res) => ({
      ok: res.ok,
      status: res.status,
      text: await res.text()
    }))`,
    awaitPromise: true,
    returnByValue: true,
    timeout: 30000
  });
  const value = result.result?.value;
  if (!value?.ok) throw new Error(`Fetch failed for ${url}: ${value?.status}`);
  return value.text;
}

function decodeRawJs(raw, url) {
  if (raw.includes('请登录') || raw.includes('前往登录')) {
    throw new Error(`Login prompt returned for ${url}`);
  }
  const payload = Function(`"use strict"; return (${raw});`)();
  return decodeDocsifyPayload(payload);
}

await mkdir(outDir, { recursive: true });
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${chromeUserDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--homepage=about:blank',
  '--lang=zh-CN'
], { stdio: ['ignore', 'ignore', 'pipe'] });

chrome.stderr.on('data', (chunk) => {
  const text = String(chunk);
  if (shouldIgnoreChromeStderr(text)) return;
  if (!text.includes('DevTools listening') && !text.includes('ERROR') && !text.includes('WARNING')) return;
  process.stderr.write(text);
});

try {
  await waitForChrome();
  const target = await createTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Page.navigate', { url: baseUrl });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const sidebarRaw = await fetchTextInBrowser(client, `${baseUrl}_sidebar.js`);
    const sidebarMarkdown = decodeRawJs(sidebarRaw, `${baseUrl}_sidebar.js`);
    await writeFile(`${outDir}/_sidebar.md`, sidebarMarkdown);

    const pages = extractPages(sidebarMarkdown);
    const pageCache = new Map();
    const indexRows = ['# EleAdminPlus 文档', '', `共 ${pages.length} 个页面。`, ''];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const sourceName = page.page === '/' ? 'main' : page.page;
      const url = `${baseUrl}${sourceName}.js`;
      if (!pageCache.has(sourceName)) {
        const raw = await fetchTextInBrowser(client, url);
        pageCache.set(sourceName, decodeRawJs(raw, url));
      }
      const fullMarkdown = pageCache.get(sourceName);
      const markdown = allLinks ? extractSectionMarkdown(fullMarkdown, page.title, page.href) : fullMarkdown;
      const filename = allLinks ? safeMdNameForItem(i, page) : safeMdName(i, page.title, page.page);
      await writeFile(`${outDir}/${filename}`, markdown);
      indexRows.push(`- [${page.title}](./${encodeURI(filename)})`);
      console.log(`${String(i + 1).padStart(2, '0')}/${pages.length} ${filename}`);
    }
    await writeFile(`${outDir}/README.md`, `${indexRows.join('\n')}\n`);
  } finally {
    client.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
} finally {
  chrome.kill('SIGTERM');
}
