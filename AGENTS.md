# AGENTS.md

## 项目概览

- React 19 + Vite 8 的纯静态中文网站，无后端。
- 用途：规划 Pokémon HOME 全国图鉴箱位并通过 `localStorage` 记录收藏状态。
- 图片从 PokeAPI sprites CDN 加载；中文名以 52Poké 校对。
- 目标站点：`https://pokemon.carrot404.de/`，部署在域名根路径。

## 关键文件

- `src/App.jsx`：页面、搜索、筛选、详情和收藏状态。
- `src/styles.css`：全部样式及移动端横向箱子布局。
- `src/lib/boxPlanner.js`：箱位生成规则。
- `src/data/pokemon.json`：生成后的静态数据。
- `scripts/generate-data.mjs`：从 52Poké 与 PokéAPI 重新生成数据。
- `scripts/check-data.mjs`：数据和箱位规则检查。

## 不可破坏的数据规则

- 范围固定为 `#0001–#1025`：1,025 个默认形态、57 个地区形态。
- 每个形态占两个连续格：普通在前，闪光在后。
- 每箱 30 格（6 × 5），每代从新箱开始，尾部空位不得压缩。
- 地区形态归入首次登场世代；代内按全国图鉴编号排序。
- 总计应为 1,082 个形态、2,164 个有效箱位、77 个箱子。
- 筛选只能淡化项目，不得重排固定箱位。
- 不判断闪光开放状态，所有闪光均计入收藏进度。
- Mega 形态只作为默认形态的展示元数据，不得生成箱位、收藏键或进度。

## 开发命令

```bash
npm ci
npm run dev
npm test
npm run build
```

重新生成数据（需要联网）：

```bash
npm run data:generate
```

不要直接手改 `src/data/pokemon.json`；应修改生成脚本后重新生成。

## 修改要求

- 保持简体中文界面和现有无障碍语义。
- 读取 `localStorage` 等外部数据时必须保留校验和异常处理。
- 不提交 `node_modules/` 或 `dist/`，也不要写入密钥。
- 避免无关重构、新依赖和后端功能。
- 完成代码或数据修改后必须运行 `npm test` 和 `npm run build`。

## 部署

`dist/` 是唯一部署产物，通过 `rsync` 同步到服务器 Web 根目录；源码由 Git 管理，构建产物不进入 Git。
