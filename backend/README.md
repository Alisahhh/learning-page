# 课内答疑后端（Cloudflare Workers）

状态（2026-10-02）：后端已发布至 https://alisa-learning-qa.embodied-learning-page.workers.dev ，两个 Secret 已配置。通过电脑现有系统代理完成真实 DeepSeek 调用，HTTP 200，约 4.4 秒返回；401/403/204 与 CORS 检查通过。网页配置为 verified，浏览器按钮端到端测试尚未完成。GitHub Pages 只发布前端，不部署本目录。

## 用户只需提供的设置

1. 登录自己的 Cloudflare 账号。无需购买服务器。
2. 在 Worker 的 Settings → Variables and Secrets 中添加两个 Secret：
   - `DEEPSEEK_API_KEY`：在 DeepSeek 控制台新建，仅填到此处，不发到聊天、Issue 或仓库。
   - `QA_ACCESS_CODE`：单独生成的至少 24 字符随机访问码，用于个人网页提问。它不是模型 API key。
3. 在网页输入访问码后提问；默认勾选“在此浏览器记住访问码”，以后自动填写。可取消勾选或点击“忘记访问码”清除保存。访问码只存当前浏览器，不写入公开配置、提问正文或学习档案导出；换浏览器或清理站点数据后需要重新填写。浏览器禁止存储时会显示提示。

已发进对话的 API key 建议撤销后重新生成。仓库不保留任何真实凭证。

## 维护者部署顺序

先核对官方 Wrangler 最新稳定版本再使用 CLI；需要正式 Cloudflare 账号授权。不要自行替用户接受注册条款或购买套餐。

```sh
npm run check
npx wrangler login
npx wrangler deploy --config backend/wrangler.jsonc
```

首次发布尚无 Secret 时，代理拒绝模型请求，这是预期行为。由用户在控制台填写 Secret，或自行运行 `wrangler secret put <名称> --config backend/wrangler.jsonc` 的交互输入。不要在命令参数或终端输出中带明文密钥。

测试 `/ask` 的认证、限速和一条真实公开课程问题，实际请求会产生模型调用费用；不能把模拟测试冒充真实调用。随后把 `qa-config.json` 的 endpoint 设置为实际 HTTPS Worker URL 加 `/ask`，构建并发布 Pages。设置为空可以随时停用站内问答并保留复制入口。

## 行为与边界

- 课程从仓库随 Worker 打包；当前仅 S1、loop、math，新增课程时要更新导入并重新部署 Worker。
- 只发送公开课程资料、用户选定的段落和当前问答，不读取浏览器学习档案。
- API key 仅服务器访问 DeepSeek 时使用；访问码鉴权与 CORS 同时检查。CORS 本身不当作认证。
- 6 次/60 秒限速在 Cloudflare 的各服务位置生效，属于近似保护，不是全局硬性支出上限。调用有输入/输出长度限制、超时；DeepSeek 的余额与费用需要另行管理。
- 不记录问题正文、授权头或 provider 错误正文；返回文本不能执行 HTML。此服务不执行模型指令或工具。
- 课堂答疑不是成果评审，不修改已掌握状态。对话在当前页面内存保留，刷新后消失。
- 模型名 `deepseek-flash` 来自 2026-10-02 官方文档；后续更新前重新核查，不照搬旧别名。

## 核查来源

- [DeepSeek 首次 API 调用](https://api-docs.deepseek.com/)
- [Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Rate Limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Workers 费用](https://developers.cloudflare.com/workers/platform/pricing/)

不能把本地模拟通过写成真实 DeepSeek 调用或云端部署成功。
