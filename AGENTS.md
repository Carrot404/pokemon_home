# AGENTS.md

## 项目概览

- React 19 + Vite 8 中文网站，Node.js 同步服务通过 SQLite 保存单账户收藏状态。
- 用途：规划 Pokémon HOME 全国图鉴箱位；`localStorage` 仅作为浏览器缓存。
- 图片从 PokeAPI sprites CDN 加载；中文名以 52Poké 校对。
- 目标站点：`https://pokemon.carrot404.de/`，部署在域名根路径。
- 运行和部署统一使用 Docker Compose，宿主机不要求安装 Node.js 或 npm。

## 关键文件

- `src/App.jsx`：页面、搜索、筛选、详情和收藏状态。
- `src/styles.css`：全部样式及移动端横向箱子布局。
- `src/lib/boxPlanner.js`：箱位生成规则。
- `src/data/pokemon.json`：生成后的静态数据。
- `server/server.mjs`：认证、收藏同步和 SQLite 持久化。
- `scripts/generate-data.mjs`：从 52Poké 与 PokéAPI 重新生成数据。
- `scripts/check-data.mjs`：数据和箱位规则检查。
- `Dockerfile`、`compose.yaml`、`nginx.conf`：构建、服务编排和统一入口。

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

构建镜像的 `build` 阶段会安装依赖、运行全部测试并生成前端产物：

```bash
docker build --target build -t pokemon_home_build .
```

启动完整环境：

```bash
docker compose up -d --build
```

重新生成数据（需要联网）：

```bash
docker run --rm --mount type=bind,src="$PWD",dst=/app -w /app node:24-alpine npm run data:generate
```

不要直接手改 `src/data/pokemon.json`；应修改生成脚本后重新生成。

## 修改要求

- 保持简体中文界面和现有无障碍语义。
- 读取 `localStorage` 等外部数据时必须保留校验和异常处理。
- 不提交 `node_modules/` 或 `dist/`，也不要写入密钥。
- 避免无关重构、新依赖和后端功能。
- 完成代码或数据修改后必须成功构建 `build` 阶段，以运行测试和前端构建。

## 部署

- 仅使用 `docker compose up -d --build` 部署，不通过 `rsync` 或宿主机 Node.js 直接运行。
- Web 容器是唯一外部入口；API 仅在 Docker 网络中开放。
- SQLite 数据必须保存在 `pokemon_home_data` volume；不得在普通更新中执行 `docker compose down -v`。
- 源码由 Git 管理，`dist/` 和 `.env` 不进入 Git。
