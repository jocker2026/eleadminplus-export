# EleAdminPlus Offline Docs Exporter

将 EleAdminPlus 在线文档导出为本地 Markdown，并生成一个可离线打开的 `index.html` 文档站。

生成后的离线文档包含：

- 左侧多级导航，保留原站文档结构
- 全部子页面导出，默认按左侧导航的所有可点击页面导出
- Markdown 源文件
- 单文件离线阅读页 `index.html`
- 本地搜索
- docsify tabs 语法支持，例如 JavaScript / TypeScript 标签切换
- 文档内链自动映射到离线页面

> 说明：本项目只是导出工具，不包含 EleAdminPlus 文档内容、账号、Cookie 或登录态。请确保你有权限访问和备份对应文档内容。

## 环境要求

- Node.js 22 或更高版本
- Google Chrome
- 一个已经登录 `eleadmin.com` 文档站的 Chrome profile

脚本不依赖 npm 包，使用 Node.js 内置能力和 Chrome DevTools Protocol。

## 快速开始

### 1. 准备专用 Chrome profile

建议不要使用你的日常 Chrome profile。请创建一个专门用于导出的 profile。

macOS:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir=/tmp/chrome-eleadmin-md-profile \
  "https://eleadmin.com/doc/eleadminplus/#/"
```

Linux:

```bash
google-chrome \
  --user-data-dir=/tmp/chrome-eleadmin-md-profile \
  "https://eleadmin.com/doc/eleadminplus/#/"
```

Windows PowerShell:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --user-data-dir="$env:TEMP\chrome-eleadmin-md-profile" `
  "https://eleadmin.com/doc/eleadminplus/#/"
```

在打开的 Chrome 窗口中手动登录，确认能看到文档内容后关闭该 Chrome 窗口。

### 2. 导出 Markdown 并生成离线页面

macOS / Linux:

```bash
node scripts/export-eleadminplus-offline-docs.mjs \
  --user-data-dir=/tmp/chrome-eleadmin-md-profile \
  --out-dir=eleadminplus-doc-md-all
```

Windows PowerShell:

```powershell
node scripts/export-eleadminplus-offline-docs.mjs `
  --user-data-dir="$env:TEMP\chrome-eleadmin-md-profile" `
  --out-dir=eleadminplus-doc-md-all
```

完成后打开：

```text
eleadminplus-doc-md-all/index.html
```

## 常用命令

完整导出全部左侧子页面，并生成离线文档：

```bash
node scripts/export-eleadminplus-offline-docs.mjs
```

只用已有 Markdown 重新生成 `index.html`：

```bash
node scripts/export-eleadminplus-offline-docs.mjs --skip-md
```

指定 Chrome 路径：

```bash
node scripts/export-eleadminplus-offline-docs.mjs \
  --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir=/tmp/chrome-eleadmin-md-profile
```

只导出一级路由页面：

```bash
node scripts/export-eleadminplus-offline-docs.mjs --main-pages
```

查看帮助：

```bash
node scripts/export-eleadminplus-offline-docs.mjs --help
```

## 参数说明

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--user-data-dir` | `/tmp/chrome-eleadmin-md-profile` | Chrome profile 路径，需要提前登录 EleAdminPlus 文档站 |
| `--chrome-path` | 按系统自动推断 | Chrome 可执行文件路径 |
| `--out-dir` | `eleadminplus-doc-md-all` | 导出目录 |
| `--all-links` | 开启 | 导出左侧导航全部可点击页面 |
| `--main-pages` | 关闭 | 只导出一级路由页面 |
| `--skip-md` | 关闭 | 跳过在线抓取，只根据现有 Markdown 重新生成 `index.html` |
| `--help` | 关闭 | 显示帮助 |

## 输出目录

默认输出到：

```text
eleadminplus-doc-md-all/
```

目录内容：

```text
index.html      离线文档入口
README.md       Markdown 页面索引
_sidebar.md     原始导航结构
*.md            每个文档页面的 Markdown 源文件
```

`index.html` 是单文件离线文档，已经内嵌导航、样式、搜索和文档内容。你可以只分发 `index.html`，也可以打包整个输出目录。

## 脚本说明

| 脚本 | 作用 |
| --- | --- |
| `scripts/export-eleadminplus-offline-docs.mjs` | 一键导出脚本，串联 Markdown 导出和离线页面生成 |
| `scripts/export-eleadminplus-md.mjs` | 连接 Chrome，读取在线文档并保存 Markdown |
| `scripts/build-eleadminplus-offline-viewer.mjs` | 根据 Markdown、`README.md`、`_sidebar.md` 生成离线 `index.html` |


## 安全提醒

不要把 Chrome profile、Cookie、登录态目录提交到 GitHub。

不要复制你的日常浏览器 profile 给别人。Chrome profile 里可能包含其它网站 Cookie、会话、浏览器数据等敏感信息。

推荐每台电脑自己创建专用 profile，并手动登录一次。

## 常见问题

### 导出内容是“请先登录”

说明传入的 `--user-data-dir` 没有有效登录态。

解决方法：

1. 用同一个 `--user-data-dir` 打开 Chrome。
2. 手动登录 EleAdminPlus 文档站。
3. 确认能看到文档正文。
4. 关闭 Chrome。
5. 重新运行导出脚本。

### 提示找不到 Chrome

使用 `--chrome-path` 指定 Chrome 可执行文件路径。

macOS 示例：

```bash
node scripts/export-eleadminplus-offline-docs.mjs \
  --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Windows 示例：

```powershell
node scripts/export-eleadminplus-offline-docs.mjs `
  --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### 左侧导航或样式改了，是否需要重新抓取？

如果只是修改离线阅读页样式或渲染逻辑，不需要重新抓取在线文档：

```bash
node scripts/export-eleadminplus-offline-docs.mjs --skip-md
```

### 可以把生成的离线文档发给别人吗？

技术上可以。生成后的 `index.html` 不依赖登录态。

但请确认你有权分发文档内容。开源仓库建议只发布脚本，不提交导出的文档内容。
