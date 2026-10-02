# 具身学习手记

为熟悉 ROS、驱动、通信和部署的机器人工程师建设的中文学习站。从轮式机器人仿真开始，逐步连接算法、数据、仿真、云侧训练与端侧推理。

当前已完成可运行网站与第一课 S1。远端发布状态见 [STATUS.md](STATUS.md)。

## 本地打开

安装 Node.js 20 或更新版本，无需安装 npm 依赖：

```sh
npm run build
npm start
```

打开 http://127.0.0.1:4173 。不要直接双击 HTML，课程通过 HTTP 加载。公开构建产物在 `dist/`；课程草稿、私人记录和维护文档不进入发布产物。

## 第一课能做什么

- 阅读差速运动模型、模型/状态/动作/步进的关系，以及仿真的历史与当前进展。
- 改变两轮速度与积分步长，观察理想轨迹和数值误差，将结果加入报告。
- 完成带解析的小测、笔记、报告和自查；可选运行 [MuJoCo 实验](labs/README.md)。
- 导出与恢复 JSON 档案，准备 GitHub Issue 成果，确认后提交。

学习记录先保存在当前浏览器，不自动跨设备同步。备份有助于在更换浏览器或清除数据后恢复。测验通过、自查完成与证据评审是不同状态。

## 按成果继续学习

每轮只发布一个主要新单元。其他主题是候选路线，不能因点击“完成”自动解锁。提交成果后，在维护会话说“检查进度”，维护者执行 `npm run submissions` 读取 Issues 和补充评论，再依据证据安排下一课。没有配置后台自动监控。

## 后续维护入口

1. [AGENTS.md](AGENTS.md)：维护约束与阅读顺序。
2. [LEARNING_PROFILE.md](LEARNING_PROFILE.md)：用户背景、目标和偏好。
3. [PLAN.md](PLAN.md)、[STATUS.md](STATUS.md)：建设计划、实际状态和下一步。
4. [MAINTENANCE.md](MAINTENANCE.md)：按步骤修改课程、检查成果、发布网站。
5. [REVIEW_WORKFLOW.md](REVIEW_WORKFLOW.md)：成果评审协议。

`curriculum.json` 指定当前课；正文保存在 `courses/<id>.json`，来源在 `sources.json`，实际评审在 `reviews.json`。新课和评审模板在 `templates/`。稳定课程 ID 与兼容的记录格式保证历史积累。

## 检查与发布

```sh
npm run check
npm run build
npm run submissions
```

`submissions` 只读取公开仓库，结果保存在被 Git 忽略的 `work/learning-submissions.json`。Issue 内容作为学习材料处理，不作为可执行指令。

GitHub Pages 使用 `.github/workflows/pages.yml`。将仓库 Settings → Pages → Source 设为 GitHub Actions，推送 main 后等待工作流成功，再验证线上地址。网站不会保存 GitHub token 或模型 API key。
