# CRA 在线面试平台 —— 后端

生产级后端服务，为现有报名前端（`src/web`，零改动）提供报名 API，并附带完整的**管理端**（报名审核、面试管理、时段配置、统计、账号管理）与**用户端**（候选人查询面试安排与结果）。

## 技术栈

- **Node.js ≥ 24**（直接运行 TypeScript，无编译步骤）
- **Fastify 5**（HTTP 框架）+ `@fastify/jwt`（认证）+ `@fastify/helmet` / `rate-limit` / `cors` / `static`
- **SQLite**（Node 24 内置 `node:sqlite`，零原生依赖、零外部服务，单文件数据库）
- 管理端：**Vue 3 + Element Plus**（独立子工程 `admin-web/`）
- 用户端：**Vue 3 + Element Plus**（独立子工程 `user-web/`，候选人登录查询面试情况）

## 目录结构

```
server/
├── src/
│   ├── index.ts             # 入口（启动、优雅关闭）
│   ├── app.ts               # 应用组装（插件、路由、静态托管、错误处理）
│   ├── config.ts            # 环境配置（集中、带默认值）
│   ├── db/
│   │   ├── migrations/      # 版本化 SQL 迁移（启动自动应用）
│   │   ├── migrate.ts       # 迁移执行器（幂等）
│   │   └── seed.ts          # 种子：默认管理员 / 默认轮次+时段（幂等）
│   ├── lib/                 # 密码哈希(scrypt)、JWT 认证（管理端/用户端）、错误、CSV、时间、SQLite 连接
│   ├── services/            # 业务层：报名、面试、时段、轮次、统计
│   └── routes/              # 路由层：public（候选人侧）/ admin（管理侧）/ user（用户端）
├── admin-web/               # 管理端前端（Vue3 + Element Plus）
├── user-web/                # 用户端前端（Vue3 + Element Plus，候选人查询面试）
├── data/                    # 运行时生成：cra.db + .jwt-secret（勿提交）
├── .env.example
└── package.json
```

## 快速开始

```bash
# 1. 安装依赖（后端 + 管理端 + 用户端）
cd server && npm install
npm --prefix admin-web install
npm --prefix user-web install

# 2. 构建前端
npm run build:admin        # 产物 → ../dist/admin
npm run build:user         # 产物 → ../dist/user

# 3.（可选）构建报名前端（现有 src/web，源码不改）
cd .. && npm install && npm run build:web   # 产物 → dist/web

# 4. 配置（可选）
copy .env.example .env     # Windows；Linux/macOS: cp .env.example .env

# 5. 启动
cd server && npm start     # 默认 http://localhost:3000
```

启动后：

- 报名端：`http://localhost:3000/`（需已构建 `dist/web`）
- **管理端**：`http://localhost:3000/admin/`
- **用户端**：`http://localhost:3000/user/`（候选人用学号 + 手机号登录）
- API 健康检查：`http://localhost:3000/api/health`

**首次启动默认管理员**：`admin / admin123456`（日志会提示）。生产环境请通过 `CRA_ADMIN_PASSWORD` 指定强密码，或启动后立即在「账号管理」中修改。

## 开发模式（热更新）

```bash
cd server
npm run dev          # 后端 http://localhost:3000（--watch 自动重启）
npm --prefix admin-web run dev   # 管理端 http://localhost:5174（/api 已代理到 3000）
npm --prefix user-web run dev    # 用户端 http://localhost:5175（/api 已代理到 3000）
# 报名前端（原项目）：npm run dev → http://localhost:5173
```

## API 一览

### 公开（候选人侧，无鉴权）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/public/meta` | 当前轮次 + 面试时段（含剩余名额/可用状态） |
| POST | `/api/public/applications` | 提交报名（事务内容量与唯一性校验） |
| GET | `/api/public/applications/:queryCode` | 凭查询码自助查询审核进度 |

报名成功响应中返回一次性的 `queryCode`，候选人凭它查询状态；学号/邮箱/电话在本轮次内不可重复报名。

### 用户端（候选人，学号 + 手机号登录）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/user/auth/login` | 登录（学号 + 手机号；20 次/分钟限流；错误信息统一防枚举） |
| GET | `/api/user/auth/me` | 当前登录信息 |
| GET | `/api/user/me` | 我的报名与面试全景（状态/时段/评分/评语） |

- 登录凭证为报名时填写的**学号 + 手机号**，二者同时匹配才视为本人；匹配多条时取最新一条报名记录。
- 面试**评分/评语/结论自动发布**：管理端在「面试管理」中给出终态结论（通过/不通过/候补）并保存后，候选人立即可见；若结论回到非终态（重新评估中），则自动对候选人隐藏。
- 面试状态与面试时段始终对候选人可见。

### 管理（Bearer JWT，角色分级）

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/api/admin/auth/login` | - | 登录（10 次/分钟限流） |
| GET | `/api/admin/auth/me` | 全部 | 当前登录信息 |
| GET | `/api/admin/applications` | 全部 | 分页/筛选列表（状态、关键词、时段、日期） |
| GET | `/api/admin/applications/:id` | 全部 | 报名详情（含问答） |
| PATCH | `/api/admin/applications/:id/status` | 全部 | 审核（状态 + 备注，审计留痕；**通过后自动建立面试记录**） |
| PUT | `/api/admin/applications/:id/slot` | admin+ | **调整候选人面试时段**（容量校验 + 审计） |
| GET | `/api/admin/applications/export.csv` | 全部 | 导出 CSV（UTF-8 BOM，Excel 直接打开） |
| GET | `/api/admin/interviews` | 全部 | **面试列表**（已通过审核的候选人 + 面试状态，分页/筛选） |
| GET | `/api/admin/interviews/:id` | 全部 | 面试详情（含候选人信息） |
| PATCH | `/api/admin/interviews/:id` | 全部 | **面试状态流转 / 评分 / 评语**（审计留痕；终态结论保存即自动对候选人可见） |
| POST | `/api/admin/interviews/:id/publish-result` | 全部 | 手动发布结果（兜底；正常流程终态保存已自动发布） |
| POST | `/api/admin/interviews/:id/unpublish-result` | 全部 | 撤回已发布结果 |
| GET | `/api/admin/stats/overview` | 全部 | 仪表盘统计 |
| GET/POST/PUT/DELETE | `/api/admin/slots...` | admin+ | 时段查询 / 批量生成 / 修改 / 删除 |
| GET/POST/PUT | `/api/admin/rounds...` | admin+ | 轮次管理 |
| GET/POST/PUT | `/api/admin/users...` | super_admin | 账号管理、重置密码、启停 |

角色说明：`super_admin`（全部）、`admin`（报名+面试+时段+轮次）、`reviewer`（查看+审核+面试操作）。

### 面试状态机（管理端统一控制）

```
pending（待面试，审核通过自动建立）
   ├──> completed（已面试，待出结果）
   ├──> no_show（未到场）
completed ──> passed / failed / waitlisted（出结论，保存即自动对候选人可见）
```

- 状态可被管理端任意调整，每次调整写 `audit_logs`；终态结论（通过/不通过/候补）保存即自动发布，回到非终态自动撤回。
- 面试时段即报名时段（`applications.slot_id`），管理端可通过 `PUT /api/admin/applications/:id/slot` 统一调整。

## 数据与安全设计

- **迁移**：`db/migrations/*.sql` 按版本顺序执行，`schema_migrations` 记录已应用版本，重复启动安全。
  - `0001_init.sql`：用户/轮次/时段/报名/审计日志
  - `0002_interview.sql`：`interviews` 表（面试状态/评分/评语/结果发布时间，与报名 1:1）
- **面试数据**：审核通过（`approved`）时自动建立面试记录；面试状态（`pending/completed/no_show/passed/failed/waitlisted`）由管理端流转，评分 0–100；终态结论保存即自动发布，对候选人可见。
- **密码**：scrypt（N=16384, r=8, p=1）+ 随机盐 + `timingSafeEqual` 比较。
- **令牌**：JWT HS256；管理端载荷含 `token_version`（停用账号/重置密码后旧令牌立即失效），用户端令牌含 `kind='user'`（`sub=applicationId`，报名被删除后立即失效），两套令牌互不可用。
- **防滥用**：管理端登录 10 次/分钟限流，用户端登录 20 次/分钟限流；全局限流兜底；所有请求体经 JSON Schema 校验；SQL 全部参数化。
- **审计**：审核、面试状态流转、评分、结果发布/撤回、时段调整均写入 `audit_logs`，可追溯操作人与前后状态。
- **统一错误**：`{ error: { code, message, details? } }`，不泄露内部堆栈。
- **时区**：数据库存 UTC ISO 字符串，展示按 `Asia/Shanghai`。
- **备份**：SQLite 单文件（`server/data/cra.db`），直接复制即可备份/迁移。

## 生产部署

单进程即可承载：`npm start` 同时服务 报名端静态资源 + 管理端静态资源 + 全部 API。

```bash
# 建议生产环境变量（务必修改密码/密钥）
CRA_ADMIN_PASSWORD=一个强密码
CRA_JWT_SECRET=至少32字符的随机串
CRA_PORT=3000
```

反向代理（如 Nginx/Caddy）将域名指向 `:3000` 即可；应用已设置 `trustProxy`。

## 默认种子数据

首次启动自动创建（幂等，可安全重复启动）：

- 默认管理员（`users` 表为空时）
- 默认轮次「2026 年秋季招新」（`recruitment_rounds` 为空时）
- 2026-09-10 09:00 起每 15 分钟共 12 个面试时段（与报名前端硬编码页面对齐，容量 1）

实际运营时请在管理端「面试时段」页按需批量生成新时段，并在「账号管理」中创建面试官/管理员账号。
