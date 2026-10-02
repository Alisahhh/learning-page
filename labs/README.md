# S1 可选进阶：MuJoCo 接触仿真

先完成网页里的运动学实验；本实验用于观察“轮速指令不等于理想轮速”的区别。

需要 Python 3.10 或以上及图形界面（使用 `--headless` 时不打开窗口）。建议在独立虚拟环境中安装：

```sh
python -m venv .venv
# Windows PowerShell：.venv\Scripts\Activate.ps1
# Linux / macOS：source .venv/bin/activate
python -m pip install mujoco==3.14.0
python labs/sim-first.py --left 2 --right 2 --output results/straight.json
python labs/sim-first.py --left 2 --right 4 --output results/turn.json
python labs/sim-first.py --left -2 --right 2 --output results/rotate.json
```

macOS 交互窗口按 MuJoCo 官方文档用 `mjpython` 代替 `python`。Windows 首次安装 Python 时按官方安装器配置可执行命令；本仓库不自动修改系统环境。

无图形界面时加 `--headless`。结果写入 JSON，已有文件不会被覆盖。不要把结果文件直接混入站点源码；在成果 Issue 中提交关键数值与解释，必要时附上脱敏文件。

模型包含自由底盘、两个速度执行器驱动的轮子、地面和两个低摩擦支撑球；支撑球是简化的滑动几何体，不是完整脚轮模型。它有接触动力学，但不是任何商业机器人经过标定的数字孪生。

固定其他参数后尝试 `--friction 0.05`，与默认设置对比。改变摩擦是否一定显著影响结果，取决于该任务是否接近摩擦极限；没有差异也应如实记录，不要为了证明预期而挑选结果。

记录：软件版本、命令、完成的仿真时间、最终位置、偏航角、接触数和模型局限。`yaw` 为映射到 ±π 的角度，与网页中的累计航向角比较前应处理角度环绕。

参考：[MuJoCo Python 文档](https://mujoco.readthedocs.io/en/latest/python.html)。核查日期：2026-10-02。
