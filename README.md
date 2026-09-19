# ATL 数据采集场景报备系统

> 一站式的 ATL 数据采集场景报备管理平台，从飞书 Excel 读数据到生成 Word 报备文档全流程可视化操作。

![GitHub](https://img.shields.io/badge/Node.js-Express-green) ![GitHub](https://img.shields.io/badge/Vue-3.5-blue) ![GitHub](https://img.shields.io/badge/Element_Plus-2.8-blue)

## ✨ 项目功能

| 模块 | 功能 |
|---|---|
| 📊 **数据看板** | 8 场景 / 15 工位 / 44 图片 / 4 采集人 + 业态分布/采集人贡献/报备状态 图表 |
| 🏢 **场景列表** | 8 个采集场景，每个场景显示首图缩略图，支持搜索/分类筛选 |
| 📋 **报备明细** | 15 条工位数据，支持搜索/状态筛选 |
| 📚 **业态字典** | 2 张业态表（采集范围表 + 业务采集表），4 个一级分类 |
| 📄 **生成 Word** | 按"场景"或按"单位"两种模式生成报备文档，调用 Python 脚本自动排版 |
| ✏️ **在线编辑** | 场景信息/工位信息编辑后实时保存到本地 edits.json |
| 🖼️ **图片浏览** | 46 张场景原图（自动从作业场景采集报备目录读取）|

## 🏗️ 技术栈

### 后端 (`backend/`)
- **Node.js** + **Express** 4.19
- **xlsx** — 解析 Excel
- **multer** — 上传 Excel
- **Python 3.14** 脚本 — 调用外部脚本生成 Word
- **CORS** — 跨域支持

### 前端 (`frontend/`)
- **Vue 3.5** + **Composition API**
- **Element Plus** 2.8 — UI 组件库
- **Vite** 5.4 — 构建工具
- **Vue Router** 4 — 路由
- **Pinia** — 状态管理
- **ECharts** 5.5 + **vue-echarts** — 数据可视化
- **axios** — HTTP 客户端

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm 或 pnpm
- （可选）Python 3.14 — 用于 Word 生成

### 安装

```bash
# 克隆仓库
git clone https://github.com/terlivy/atlas-cj.git
cd atlas-cj

# 安装后端依赖
cd backend
npm install
cd ..

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 启动（推荐）

使用一键启动脚本（同时启动后端 + 前端，自动健康检查）：

```bash
# 必须放在 ~/Desktop/ATL数据采集场景报备/web 下运行（脚本硬编码路径）
cd ~/Desktop/ATL数据采集场景报备/web
./start.sh
```

启动成功后会看到：
```
🔧 清理旧进程...
🚀 启动后端 (3001)...
🚀 启动前端 (5173)...
🔍 健康检查...
   ✅ 后端: http://localhost:3001
   ✅ 前端: http://127.0.0.1:5173
📊 数据统计:
   场景数: 8
   工位数: 15
   图片数: 44
   采集人: 4
🎉 启动完成！浏览器打开: http://127.0.0.1:5173/
```

### 手动启动

```bash
# 终端 1：后端 (3001)
cd backend
npm start

# 终端 2：前端 (5173)
cd frontend
npm run dev
```

### 停止

```bash
./stop.sh
```

## 🌐 端口与服务

| 端口 | 服务 | 地址 |
|---|---|---|
| **3001** | 后端 API | http://localhost:3001 |
| **5173** | 前端（Vite dev）| http://127.0.0.1:5173 |

## 📡 后端 API

所有接口都在 `/api` 前缀下：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/stats` | 数据看板统计 |
| GET | `/api/records` | 所有报备记录（15 条）|
| GET | `/api/scenes` | 按场景分组的报备数据 |
| GET | `/api/scenes/:name` | 单场景详情（含工位列表 + 图片）|
| GET | `/api/units` | 按单位聚合的场景数据 |
| POST | `/api/generate` | 生成 Word 报备文档（body: `{scenes?, units?, byUnit?, outputDir?}`）|
| GET | `/api/download/:filename` | 下载生成的 Word 文件 |
| GET | `/api/output` | 列出已生成的文件 |
| GET | `/api/edits` | 获取所有编辑记录 |
| PUT | `/api/edits/record/:id` | 更新某条工位的编辑 |
| DELETE | `/api/edits/record/:id` | 删除某条工位的编辑 |
| PUT | `/api/edits/scene/:name` | 更新某场景的整体编辑 |
| DELETE | `/api/edits/scene/:name` | 删除某场景的整体编辑 |
| DELETE | `/api/edits` | 清空所有编辑 |
| GET | `/api/categories` | 获取业态字典 |
| POST | `/api/categories/refresh` | 刷新业态字典 |
| GET | `/static/images/:filename` | 访问场景原图 |
| GET | `/static/output/:filename` | 访问生成的 Word 文件 |

## 📁 项目结构

```
web/
├── backend/                      # Express 后端
│   ├── server.js                 # 主入口（包含所有 API）
│   ├── store.js                  # edits.json 持久化
│   ├── package.json
│   └── package-lock.json
│
├── frontend/                     # Vue 3 前端
│   ├── src/
│   │   ├── App.vue               # 根组件（侧边栏 + 路由）
│   │   ├── main.js               # 入口
│   │   ├── router.js             # 路由配置
│   │   ├── api.js                # axios 实例
│   │   ├── style.css             # 全局样式
│   │   └── views/                # 页面组件
│   │       ├── Dashboard.vue     # 数据看板
│   │       ├── Scenes.vue        # 场景列表
│   │       ├── SceneDetail.vue   # 场景详情（含图片画廊 + 编辑）
│   │       ├── Generate.vue      # 生成 Word
│   │       ├── Records.vue       # 报备明细
│   │       └── Categories.vue    # 业态字典
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── start.sh                      # 一键启动脚本
├── stop.sh                       # 停止脚本
└── .gitignore
```

## 📊 数据源

系统从以下文件读取数据：

| 数据源 | 路径 | 说明 |
|---|---|---|
| **报备数据 Excel** | `~/Desktop/ATL数据采集场景报备/作业场景采集报备管理系统.xlsx` | 16 行 × 16 列原始报备数据 |
| **采集范围 Excel** | `~/Desktop/ATL数据采集场景报备/ATL项目采集范围.xlsx` | 业态分类表（4 行）+ 业务采集表（26 行）|
| **场景图片** | `~/Desktop/ATL数据采集场景报备/作业场景采集报备/` | 46 张场景原图 |
| **Word 模板** | `~/Desktop/ATL数据采集场景报备/场景报备文档-模版docx.docx` | 生成 Word 时套用的模板 |
| **Python 生成器** | `~/作业场景报备生成器/main.py` | 调用脚本生成 Word |

> ⚠️ **路径硬编码**：后端 `server.js` 中 `PROJECT_ROOT` 和 `DATA_ROOT` 是硬编码的相对路径。如需迁移项目，请修改这些路径常量。

## 🐍 Word 生成（依赖 Python 脚本）

生成 Word 报备的功能依赖外部 Python 脚本：
- 脚本路径：`~/作业场景报备生成器/main.py`
- Python 路径：`/opt/homebrew/bin/python3.14`（硬编码）
- 输出目录：`~/Desktop/ATL数据采集场景报备/{YYYYMMDD}/`

**两种生成模式**：
- **按场景**：每个场景生成一个独立 Word
- **按单位**：相同单位的所有场景合并成一个 Word（适合门店类）

## 🔧 常见问题

### Q: 启动后浏览器打不开？
1. 确认端口 3001 和 5173 没被占用：`lsof -i :3001 && lsof -i :5173`
2. 看日志：`tail -f logs/backend.log` 和 `tail -f logs/frontend.log`
3. 杀掉重试：`./stop.sh && ./start.sh`

### Q: Word 生成失败？
1. 确认 Python 3.14 在 `/opt/homebrew/bin/python3.14`
2. 确认 `~/作业场景报备生成器/main.py` 存在
3. 确认 Excel + 模板文件路径正确

### Q: 业态字典显示空？
- 检查 `~/Desktop/ATL数据采集场景报备/ATL项目采集范围.xlsx` 是否存在
- 点击「刷新」按钮重新加载

## 📜 许可证

私有项目，未开源许可证。

## 👥 作者

[@terlivy](https://github.com/terlivy)

---

**📌 提示**：项目最初为内部使用，硬编码了多个绝对路径。如需部署到其他机器，请先修改 `backend/server.js` 中的 `PROJECT_ROOT` 和 `DATA_ROOT` 常量。
