
# Web Speed Test

一款双引擎的网站性能测试工具：服务器真实探测网络层 / 协议层，无头浏览器（Lighthouse）探测渲染层，站长和工程师都能用。

[在线使用](https://www.nocokit.cn/speedtest/)

<img width="1256" height="1294" alt="截屏2026-09-23 15 20 37" src="https://github.com/user-attachments/assets/379f7b98-e250-463b-ada6-1ccdb79e8928" />

## 特性

- 完整 DNS、TCP、TLS 分相时序
- 真实发起 HTTP/1.1、HTTP/2、HTTP/3 请求，报告真实 ALPN 协商结果
- Lighthouse 无头浏览器真实渲染，采集 FCP / LCP / CLS / TBT 核心指标
- 双模式：Webmaster（站长）与技术工程师，深浅两套视角
- 完整报告：性能等级、改进建议、资源瀑布、响应码、域名分布
- 页面截图、HAR 导出、结果分享
- RUM 真实用户监控：p75 / p95 百分位 + 设备 / 网络维度聚合
- 秒级返回初步结果，后台异步补全完整 Lab 报告
- 桌面端 / 移动端切换测试

## 快速开始

### 前置依赖

- Node.js ≥ 22
- Chrome / Chromium（Lighthouse 依赖，用于无头浏览器渲染）

### 本地开发

```bash
npm install
npm run dev        # 启动开发服务（Vite + tsx）
```

### 构建与运行

```bash
npm run build      # vite build 前端 + esbuild 打包后端到 dist/server.cjs
npm start          # node dist/server.cjs
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3000` | 监听端口 |
| `NODE_ENV` | - | 设为 `production` 时提供静态文件服务 |
| `API_KEY` | 空 | 设置后 `/api/audit-url`、`/api/diagnose` 需要 `x-api-key` 头 |
| `TRUST_PROXY` | 空 | 反向代理跳数（如 `1`），让限流拿到真实客户端 IP |
| `GEMINI_API_KEY` | 空 | 可选，AI 诊断 |
| `RUM_DB_PATH` | `rum-beacons.json` | RUM 数据持久化文件路径 |

## 技术栈

- 前端：Vue 3 + Vite + Tailwind CSS + Arco Design
- 后端：Node.js + Express + TypeScript
- 测量：Lighthouse + chrome-launcher + cheerio

## License

[MIT](./LICENSE)
