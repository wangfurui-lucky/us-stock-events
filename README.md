# 美股事件雷达 (US Stock Events Radar)

以**关键时间节点历史走势统计**与**自选美股财报反应分析**为核心的轻量网页工具（支持深色/浅色一键切换、手机端添加到主屏幕使用）。

## 功能概览

- **关键节点**：FOMC 议息（按加息/降息/不变分组）、非农就业 NFP、中期选举（含 1950–2022 选后 12 个月轨迹及 2026 当下对比）、近期大事倒计时，以及 SpaceX / Anthropic / 黄仁勋（GTC）一次性事件追踪。
- **自选财报**：默认覆盖 11 家标的（`DELL`、`MRVL`、`GLW`、`INTC`、`AMD`、`SMCI`、`LITE`、`NBIS`、`SNDK`、`CRCL`、`CRWV`），展示财报日波动倍数、EPS 超预期率 vs 次日收涨率、超预期反跌次数与近 8 季明细。
- **每日自动更新**：通过 GitHub Actions 在每个美股交易日收盘后（北京时间周二至周六 07:30）自动拉取最新数据并提交，触发 Vercel 自动重新发布。

## 目录结构

```text
├── .github/workflows/refresh-data.yml  # 每日定时更新工作流
├── scripts/
│   ├── export_web_data.py              # 生成前端 JSON 数据包
│   └── refresh.sh                      # 本地一键更新全部数据
├── validation/                         # 数据抓取与统计计算脚本
│   └── data/seed/fomc_hist_1990_2020.csv
├── web/                                # React + Vite + Recharts 前端
└── vercel.json                         # Vercel 零配置部署文件
```

## 本地运行

```bash
# 启动前端预览
npm --prefix web install
npm --prefix web run dev

# 手动更新全部行情与财报数据
./scripts/refresh.sh
```

## 免费部署到 Vercel（带每日自动更新）

1. 将本仓库推送到你的 GitHub（公开或私有仓库均可）。
2. 登录 [Vercel](https://vercel.com/) → **Add New Project** → 导入该 GitHub 仓库 → 直接点击 **Deploy**（仓库根目录的 `vercel.json` 已自动配置好构建命令和输出目录）。
3. 之后 GitHub Actions 每天会自动更新 `web/public/data/*.json` 并推送到 `main`，Vercel 会自动重新部署，无需任何手动维护。
