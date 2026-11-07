# 农语 AI 前端后端项目

这是根据 `农业宣传.html` 和 `农业宣传代码.docx` 中现有页面整理出的可部署网站。页面视觉和四种文案场景保持不变，原来的浏览器本地模板逻辑已迁移到 Node.js 后端，通过 `/api/generate` 接口生成文案和评分。

## 为什么别人可能打不开

原目录只有单个 `农业宣传.html` 文件，没有服务器、部署配置或公网网址。它在本机可以作为 `file://` 文件打开，但这不等于网站已经上线。常见原因如下：

- 把 `localhost`、`127.0.0.1` 或本机文件路径发给别人，对方访问到的是自己的电脑，不是你的电脑。
- 只发送了页面文件或聊天软件预览，文件没有完整保存为 `.html`，或聊天软件阻止直接打开。
- 页面没有部署到公网服务器，也没有域名和 HTTPS。
- 如果已有服务器，服务只监听了 `127.0.0.1`，或者云服务器安全组、Windows 防火墙没有放行端口。

当前项目默认监听 `0.0.0.0`，因此同一个局域网内的手机或电脑可以访问启动时打印的“局域网访问”地址。要让互联网上的任何人访问，仍需把项目部署到云服务器或托管平台。

## 项目结构

```text
nongyu-ai/
├─ public/                 前端页面
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  └─ favicon.svg
├─ src/generator.js        后端文案生成、输入校验和评分
├─ test/generator.test.js  自动化测试
├─ server.mjs              HTTP 服务和 API
├─ package.json
├─ Dockerfile
├─ render.yaml
├─ start-windows.bat
└─ deploy/                 Nginx 和 systemd 示例
```

项目没有第三方运行依赖，也没有数据库。用户提交的农产品信息只用于当前请求，不会写入磁盘。

## 本机运行

需要安装 Node.js 20.11 或更高版本，推荐使用 Node.js 22 LTS。

在项目目录打开 PowerShell：

```powershell
npm start
```

或者直接运行：

```powershell
node server.mjs
```

看到以下内容后，在浏览器打开 `http://localhost:3000`：

```text
农语 AI 已启动：http://localhost:3000
```

Windows 也可以双击 `start-windows.bat`。服务运行期间不要关闭终端窗口。

同一个 Wi-Fi 下的手机访问时，使用终端打印的 `http://192.168.x.x:3000`，不能用 `localhost`。如果无法访问，需要允许 Node.js 通过 Windows 防火墙，并确认设备和电脑处在同一个局域网。

## 运行测试

```powershell
npm test
```

## API

健康检查：

```http
GET /api/health
```

生成文案：

```http
POST /api/generate
Content-Type: application/json

{
  "productName": "烟台苹果",
  "place": "山东烟台",
  "features": "脆甜多汁、生态种植、产地直发",
  "style": "short"
}
```

`style` 可选值为 `short`、`shop`、`post`、`poster`。成功时返回三条文案、风格名称和三项传播评分。后端会检查字段类型、长度、所选风格、请求大小和访问频率。

## 需要用到的软件

本机开发和演示：

- Node.js 20.11 或更高版本，必需。
- Chrome、Edge、Firefox 或 Safari 等现代浏览器，必需。
- VS Code 等文本编辑器，可选。
- Git，可选，用于版本管理。

部署到公网：

- 一台云服务器或 Node.js 托管服务，用于获得公网网址。
- Nginx，可选，用于域名、HTTPS 和反向代理。
- systemd、PM2 或 Docker，用于保持服务持续运行。
- 域名，可选，但正式网站建议使用。
- HTTPS 证书，正式网站建议使用，可以从 Let's Encrypt 免费申请。

本项目没有数据库和账号系统，因此不需要安装 MySQL、PostgreSQL 或 Redis。

## 部署方案

### 方案一：Node.js 托管平台

项目包含 `render.yaml` 和 `Dockerfile`。可以把项目上传到 Git 仓库，再导入支持 Node.js 或 Docker 的平台。平台构建和启动时使用：

```text
构建命令：npm install
启动命令：npm start
健康检查：/api/health
```

平台会提供一个 `https://` 公网网址，把这个网址发给别人即可。计算机不必一直开机。

### 方案二：Linux 云服务器

将项目放到 `/opt/nongyu-ai`，安装 Node.js 20 或 22 后运行：

```bash
cd /opt/nongyu-ai
npm install
npm test
npm start
```

长期运行时建议把 `deploy/nongyu-ai.service` 复制到 `/etc/systemd/system/`：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nongyu-ai
sudo systemctl status nongyu-ai
```

然后把 `deploy/nginx.conf.example` 中的域名替换成自己的域名，复制到 Nginx 配置目录，检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

使用 Certbot 或云平台证书工具配置 HTTPS。云服务器安全组或防火墙需要允许公网访问 80 和 443 端口；Node.js 端口 3000 只对本机开放即可。

### 方案三：临时让外部访问

如果只想短暂演示，并且电脑保持开机，可以安装 Cloudflare Tunnel 或 ngrok，把 `http://localhost:3000` 映射成临时 HTTPS 网址。这种方式不适合长期运行。

## 上线前检查

- 从另一台没有开发环境的设备打开公网网址。
- 手机和电脑各测试一次布局与生成按钮。
- 确认域名使用 HTTPS，过期证书会导致浏览器警告。
- 确认云服务器安全组和系统防火墙只开放必要端口。
- 不要把数据库密码、API 密钥或 `.env` 文件提交到 Git。
- 定期更新 Node.js 和操作系统安全补丁。
