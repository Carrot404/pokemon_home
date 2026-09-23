# HOME 全国图鉴收纳册

一个用于规划 Pokémon HOME 全国图鉴箱位的 React 网页。普通与闪光形态左右相邻，每代从新箱开始；单账户同步服务使用 SQLite 保存收藏状态，可跨设备使用。

## 项目结构

```text
├── src/
│   ├── App.jsx                 页面、搜索筛选、详情与收藏同步
│   ├── main.jsx                React 入口
│   ├── styles.css              页面样式与移动端布局
│   ├── data/pokemon.json       生成的宝可梦静态数据（不要手动修改）
│   └── lib/                    箱位规则、待同步变更、API 请求及相关测试
├── server/                     登录、SQLite 同步服务、密码哈希工具及测试
├── scripts/                    数据生成与校验脚本
├── public/                     图片加载失败时使用的占位图
├── index.html                  Vite 页面入口
├── vite.config.js              Vite 配置
├── package.json                依赖与检查命令
├── package-lock.json           npm 依赖锁文件
├── Dockerfile                  构建、API、密码工具和 Web 镜像
├── compose.yaml                服务编排与数据库持久化卷
├── nginx.conf                  静态文件及 /api 反向代理配置
├── .env.example                部署环境变量示例（.env 不提交）
├── .gitignore / .dockerignore  Git 与 Docker 构建上下文排除规则
├── AGENTS.md                   项目维护约定
└── README.md                   使用与维护说明
```

`dist/` 是构建产物，`node_modules/` 是本机安装的依赖，均不入库且可重新生成。`backup/` 中的本机收藏 JSON 备份也不入库，但包含用户数据，清理构建产物时不要删除；`.env` 包含部署配置，也不要删除或提交。实际收藏数据保存在 Docker volume `pokemon_home_data` 中，不在项目目录内。

## Docker 部署

运行只需要 Docker Engine 和 Docker Compose 插件，不需要在宿主机安装 Node.js 或 npm。

首次部署时复制配置，并在一次性容器中生成密码哈希：

```bash
cp .env.example .env
docker compose run --rm --build password_hash
```

将命令输出的完整 `SYNC_PASSWORD_HASH=...` 写入 `.env`，并按需修改 `SYNC_USERNAME`。不要提交 `.env`。然后构建并启动全部服务：

```bash
docker compose up -d --build
docker compose ps
```

网页默认监听宿主机 `25173` 端口，可通过 <http://localhost:25173> 访问；如需修改端口，编辑 `.env` 中的 `HOST_PORT`。精灵图片来自远程 CDN，浏览器访问时需要联网。

生产环境中，Nginx Proxy Manager 使用 `http` 协议转发到服务器 IP 的 `25173` 端口，并为正式域名启用 HTTPS。外部只有一个入口；Web 容器提供静态网页，并将 `/api` 转发给仅在 Docker 网络内开放的同步服务。

查看日志：

```bash
docker compose logs -f
```

更新源码后重新构建即可，构建阶段会自动运行数据检查、服务测试和前端构建：

```bash
docker compose up -d --build
```

停止服务使用 `docker compose down`。SQLite 数据保存在 Docker volume `pokemon_home_data` 中，普通更新、停止或重建容器不会删除收藏数据；不要使用 `docker compose down -v`，除非确定需要删除数据库。

修改账户密码时，重新运行密码生成容器，将新哈希写入 `.env`，再重新创建 API 容器。用户名或密码哈希变化会使已有登录会话失效：

```bash
docker compose run --rm --build password_hash
docker compose up -d --force-recreate pokemon_home_api
```

### 迁移原有本机收藏

如果旧数据属于 <http://localhost:5173>，可在原电脑上临时让 Docker 部署监听同一来源：

```bash
HOST_PORT=5173 docker compose up -d --build
```

1. 打开 <http://localhost:5173>，在登录页点击“导出本机备份”。
2. 运行 `docker compose down` 停止临时部署。
3. 打开正式网站并登录。
4. 首次同步页面选择“导入 JSON 备份”，确认数量后上传到服务器。

如果原地址不同，应使用原来完全相同的协议、主机和端口。服务器初始化后以 SQLite 数据为准；浏览器 `localStorage` 只保留一份本机缓存。在线设备每次修改都会立即提交，并在页面重新获得焦点或最多约 15 秒后读取其他设备的更新。

## 收纳规则

- 全国图鉴范围：`#0001–#1025`，第一至第九世代。
- 收录 1,025 个默认形态与 57 个地区形态。
- 不收录性别差异、纯外观差异和战斗临时形态。
- 每个形态占两个连续位置：普通在左、闪光在右。
- 每箱固定 30 格（6 列 × 5 行）。
- 每一世代从新箱开始，上一世代末尾未使用的格子保留为空。
- 后世代引入的地区形态归入首次登场世代；同一世代内按全国图鉴编号排序。
- 不判断闪光是否已经开放，所有闪光箱位都纳入收集进度。
- 当前 87 个可超级进化种族关联 97 个 Mega 图片形态；Mega 仅供详情展示，不占箱位或收藏进度。

| 世代 | 默认形态 | 地区形态 | 有效箱位 | HOME 箱号 |
| --- | ---: | ---: | ---: | --- |
| 第一世代 | 151 | 0 | 302 | 1–11 |
| 第二世代 | 100 | 0 | 200 | 12–18 |
| 第三世代 | 135 | 0 | 270 | 19–27 |
| 第四世代 | 107 | 0 | 214 | 28–35 |
| 第五世代 | 156 | 0 | 312 | 36–46 |
| 第六世代 | 72 | 0 | 144 | 47–51 |
| 第七世代 | 88 | 18 | 212 | 52–59 |
| 第八世代 | 96 | 35 | 262 | 60–68 |
| 第九世代 | 120 | 4 | 248 | 69–77 |
| **合计** | **1,025** | **57** | **2,164** | **77 箱** |

帕底亚肯泰罗的斗战种、火炽种和水澜种分别作为地区形态收录。

## 页面功能

- 上一箱、下一箱、箱号选择和世代快捷跳转。
- 按全国编号、简体中文名或地区形态搜索，并跳转到准确箱位。
- 按收集状态以及普通/闪光筛选；筛选只淡化项目，不会重排箱位。
- 可超级进化的宝可梦会显示对应进化石图标；新增进化石缺少图标素材时使用钥石代替。
- 点击宝可梦查看中文名、分类、属性、世代、箱号、格号、行列位置和普通/闪光图片；详情底部同时展示全部 Mega 普通与闪光形态。
- 使用单账户登录将收集状态保存到 SQLite，并在在线设备间同步；浏览器 `localStorage` 仅作为本机缓存。
- 首次登录可导入原有本机进度，登录后也可随时导出 JSON 备份。
- 手机端维持完整 6 × 5 箱子，可横向滑动查看。

## 数据与检查

中文名称以 [52Poké 全国图鉴列表](https://wiki.52poke.com/wiki/%E5%AE%9D%E5%8F%AF%E6%A2%A6%E5%88%97%E8%A1%A8%EF%BC%88%E6%8C%89%E5%85%A8%E5%9B%BD%E5%9B%BE%E9%89%B4%E7%BC%96%E5%8F%B7%EF%BC%89) 校对；属性、分类与 HOME 风格精灵图路径来自 [PokéAPI](https://pokeapi.co/) 及 [PokeAPI/sprites](https://github.com/PokeAPI/sprites)。

维护数据时可通过一次性 Node 容器重新获取并生成静态数据（需要联网）：

```bash
docker run --rm --mount type=bind,src="$PWD",dst=/app -w /app node:24-alpine npm run data:generate
```

构建 `build` 阶段会检查形态数量、排序、箱号、普通/闪光相邻规则、认证和 SQLite 持久化，并生成前端产物：

```bash
docker build --target build -t pokemon_home_build .
```

本项目是非官方收藏辅助工具。宝可梦相关名称与图像版权归其各自权利人所有。
