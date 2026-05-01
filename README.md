# EleAdminPlus Offline Docs Exporter

将 EleAdminPlus 在线文档导出为本地 Markdown，并生成一个可离线打开的 `index.html` 文档站。

EleAdminPlus 官网：[https://eleadmin.com](https://eleadmin.com)

Plus预览：[https://plus.eleadmin.com](https://plus.eleadmin.com)

![EleAdminPlus 导出功能预览](https://raw.githubusercontent.com/jocker2026/eleadminplus-export/refs/heads/main/Preview.png)

生成后的离线文档包含：

- 保留原站层级的左侧多级导航，支持全部展开、全部收起、当前项高亮
- 默认导出左侧导航中的全部可点击页面，也可切换为仅导出一级页面
- Markdown 源文件、`README.md` 页面索引、`_sidebar.md` 导航结构一并保留
- 单文件离线阅读页 `index.html`，内嵌文档数据、样式和脚本，可直接本地打开
- 本地全文搜索，支持按标题、导航标题和正文内容快速过滤
- 上一篇 / 下一篇切换、回到顶部、阅读进度条等阅读辅助能力
- 代码块语法高亮、语言标签、复制按钮
- docsify tabs 语法支持，例如 JavaScript / TypeScript 标签切换
- 表格、图片、引用块、常见 Markdown 结构的离线渲染
- 文档内链自动映射到离线页面，外链自动改为新窗口打开
- 深色 / 浅色主题切换、侧边栏折叠、移动端目录抽屉
- 在线演示区块自动转换为外链入口，避免离线页中出现失效的内嵌运行区域

> 说明：本项目只是导出工具，不包含 EleAdminPlus 文档内容、账号、Cookie 或登录态。请确保你有权限访问、备份和处理对应文档内容。

## 法律与合规风险

使用本工具前，请你自行评估并承担相关法律、合同与合规风险。

本工具可能涉及但不限于以下风险：

- 未经授权抓取、批量备份、离线保存、共享或传播 EleAdminPlus 文档内容，可能违反版权法、数据库保护规则、网站服务条款、购买协议或保密义务。
- 将导出的文档用于团队外传播、公开分发、商业售卖、镜像站、知识库二次发布等用途，可能引发版权、合同违约、不正当竞争或平台投诉风险。
- 使用共享账号、借用他人授权账号、绕过访问限制或将导出内容提供给无权访问者，可能引发账号封禁、授权失效、违约索赔或其他争议。
- 某些司法辖区下，自动化抓取、批量复制受限内容、规避技术限制措施，可能触发更严格的民事、行政甚至刑事风险。

你应当至少确认以下事项：

- 你对目标文档内容拥有合法访问权、备份权和必要的内部使用权限。
- 你的使用行为符合 EleAdminPlus 官方规则、购买协议、授权条款以及你所在组织的内部制度。
- 你不会将导出内容提供给未获授权的个人、客户、合作方或公开网络。

如果你不确定自己的使用场景是否合法合规，请先咨询对应权利人，再决定是否使用本工具。

## 环境要求

- Node.js 22 或更高版本
- Google Chrome
- 一个已经登录 `eleadmin.com` 文档站的 Chrome profile

脚本不依赖 npm 包，使用 Node.js 内置能力和 Chrome DevTools Protocol。

## 快速开始

### Windows 终端说明

Windows 下最容易踩坑的是：`PowerShell` 和 `cmd.exe` 的命令语法不一样。

- 如果提示符像 `PS C:\Users\name>`，你当前用的是 `PowerShell`。
- 如果提示符像 `C:\Users\name>`，你当前用的是 `cmd.exe`。
- `PowerShell` 可以使用反引号 `` ` `` 做多行续行。
- `cmd.exe` 不能使用反引号 `` ` ``，建议直接复制单行命令。

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

Windows `cmd.exe`:

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%TEMP%\chrome-eleadmin-md-profile" "https://eleadmin.com/doc/eleadminplus/#/"
```

在打开的 Chrome 窗口中手动登录，确认能看到文档内容后关闭该 Chrome 窗口。

如果你的 Chrome 不在默认安装路径，请把：

```text
C:\Program Files\Google\Chrome\Application\chrome.exe
```

替换成你本机的实际路径。

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

Windows `cmd.exe`:

```bat
node scripts/export-eleadminplus-offline-docs.mjs --user-data-dir="%TEMP%\chrome-eleadmin-md-profile" --out-dir=eleadminplus-doc-md-all
```

如果 Chrome 不在默认路径，可以显式指定：

PowerShell:

```powershell
node scripts/export-eleadminplus-offline-docs.mjs `
  --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --user-data-dir="$env:TEMP\chrome-eleadmin-md-profile" `
  --out-dir=eleadminplus-doc-md-all
```

Windows `cmd.exe`:

```bat
node scripts/export-eleadminplus-offline-docs.mjs --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%TEMP%\chrome-eleadmin-md-profile" --out-dir=eleadminplus-doc-md-all
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

它同时包含这些离线阅读能力：

- 左侧导航树、顶部当前路径、当前页面标题
- 搜索过滤、移动端目录按钮、侧边栏展开收起状态记忆
- 深色 / 浅色主题切换，并记住上次选择
- 代码复制、文档内页跳转、上一篇 / 下一篇导航
- 本地 hash 路由，可直接定位到某个离线页面

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

不要把导出的 Markdown、`index.html` 或打包后的离线文档上传到公开仓库、公开对象存储、CDN 或可被未授权人员访问的位置，除非你明确拥有对应分发权。

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

Windows `cmd.exe` 示例：

```bat
node scripts/export-eleadminplus-offline-docs.mjs --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### 提示 `Unknown argument: \``

说明你在 `cmd.exe` 里执行了 `PowerShell` 的多行命令，脚本把反引号 `` ` `` 当成了普通参数。

例如下面这种写法：

```powershell
node scripts/export-eleadminplus-offline-docs.mjs `
  --user-data-dir="$env:TEMP\chrome-eleadmin-md-profile" `
  --out-dir=eleadminplus-doc-md-all
```

只能在 `PowerShell` 里执行，不能在 `cmd.exe` 里执行。

如果你当前窗口提示符像 `C:\Users\name>`，请改用单行 `cmd.exe` 命令：

```bat
node scripts/export-eleadminplus-offline-docs.mjs --user-data-dir="%TEMP%\chrome-eleadmin-md-profile" --out-dir=eleadminplus-doc-md-all
```

### 提示 `--user-data-dir` 不是内部或外部命令

说明你把多行命令拆开逐行执行了，第二行 `--user-data-dir=...` 被 Windows 当成了一条新命令。

解决方法：

1. 在 `PowerShell` 里完整执行带反引号的多行命令。
2. 或者在 `cmd.exe` 里直接执行单行命令，不要拆行单独回车。

### 左侧导航或样式改了，是否需要重新抓取？

如果只是修改离线阅读页样式或渲染逻辑，不需要重新抓取在线文档：

```bash
node scripts/export-eleadminplus-offline-docs.mjs --skip-md
```

### 可以把生成的离线文档发给别人吗？

生成后的 `index.html` 不依赖登录态。

但这不代表你当然有权分发文档内容。请先确认对应版权、授权协议、购买条款和内部合规要求。
