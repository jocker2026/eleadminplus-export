import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const mdScript = path.join(scriptDir, 'export-eleadminplus-md.mjs');
const viewerScript = path.join(scriptDir, 'build-eleadminplus-offline-viewer.mjs');

const options = {
  outDir: 'eleadminplus-doc-md-all',
  userDataDir: '/tmp/chrome-eleadmin-md-profile',
  chromePath: '',
  allLinks: true,
  skipMd: false,
  help: false
};

for (const arg of process.argv.slice(2)) {
  if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else if (arg === '--skip-md') {
    options.skipMd = true;
  } else if (arg === '--main-pages') {
    options.allLinks = false;
  } else if (arg === '--all-links') {
    options.allLinks = true;
  } else if (arg.startsWith('--out-dir=')) {
    options.outDir = arg.slice('--out-dir='.length);
  } else if (arg.startsWith('--user-data-dir=')) {
    options.userDataDir = arg.slice('--user-data-dir='.length);
  } else if (arg.startsWith('--chrome-path=')) {
    options.chromePath = arg.slice('--chrome-path='.length);
  } else {
    throw new Error(`Unknown argument: ${arg}`);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/export-eleadminplus-offline-docs.mjs [options]

Options:
  --user-data-dir=/path/to/chrome-profile  Chrome 登录态目录，默认 /tmp/chrome-eleadmin-md-profile
  --chrome-path=/path/to/chrome            Chrome 可执行文件路径，默认按系统自动推断
  --out-dir=DIR                           输出目录，默认 eleadminplus-doc-md-all
  --all-links                             导出左侧导航全部子页面，默认开启
  --main-pages                            只导出一级路由页面
  --skip-md                               不重新抓取 Markdown，只用现有 Markdown 重建 index.html
  --help                                  显示帮助

Examples:
  node scripts/export-eleadminplus-offline-docs.mjs
  node scripts/export-eleadminplus-offline-docs.mjs --user-data-dir=/tmp/chrome-eleadmin-md-profile --out-dir=eleadminplus-doc-md-all
  node scripts/export-eleadminplus-offline-docs.mjs --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  node scripts/export-eleadminplus-offline-docs.mjs --skip-md
`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${[command, ...args].join(' ')}`);
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

if (options.help) {
  printHelp();
  process.exit(0);
}

const outDirAbs = path.resolve(root, options.outDir);

if (!options.skipMd) {
  if (!fs.existsSync(options.userDataDir)) {
    console.warn(`Chrome 登录态目录不存在: ${options.userDataDir}`);
    console.warn('请先准备一个已登录 eleadmin.com 的 Chrome profile，或用 --user-data-dir 指定正确目录。');
  }

  const mdArgs = [
    mdScript,
    `--user-data-dir=${options.userDataDir}`,
    `--out-dir=${options.outDir}`
  ];

  if (options.chromePath) {
    mdArgs.push(`--chrome-path=${options.chromePath}`);
  }

  if (options.allLinks) {
    mdArgs.push('--all-links');
  }

  await run('node', mdArgs);
}

if (!fs.existsSync(path.join(outDirAbs, '_sidebar.md')) || !fs.existsSync(path.join(outDirAbs, 'README.md'))) {
  throw new Error(`Missing Markdown output in ${outDirAbs}. Need _sidebar.md and README.md before building index.html.`);
}

await run('node', [viewerScript, options.outDir]);

console.log('\n完成。离线文档入口：');
console.log(path.join(outDirAbs, 'index.html'));
