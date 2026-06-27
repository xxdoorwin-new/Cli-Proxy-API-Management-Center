# CLI Proxy API Management Center — 详细设计文档

> 版本：基于当前代码库分析生成
> 生成时间：2026-06-22

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈与依赖](#2-技术栈与依赖)
3. [项目结构](#3-项目结构)
4. [架构设计](#4-架构设计)
5. [路由设计](#5-路由设计)
6. [状态管理](#6-状态管理)
7. [API 服务层](#7-api-服务层)
8. [页面模块详解](#8-页面模块详解)
9. [功能特性模块](#9-功能特性模块)
10. [组件体系](#10-组件体系)
11. [安全机制](#11-安全机制)
12. [国际化](#12-国际化)
13. [主题与样式](#13-主题与样式)
14. [构建与发布](#14-构建与发布)
15. [数据流图](#15-数据流图)

---

## 1. 项目概述

**CLI Proxy API Management Center** 是一个基于 React + TypeScript 的单文件 Web 管理界面，专门用于操作和故障排查 **CLI Proxy API** 服务。通过该界面可以与后端的 Management API（`/v0/management`）进行交互，完成配置管理、凭据上传、日志查看等运维操作。

### 核心定位

- **纯前端 Web UI**，不参与任何流量代理。
- 对接 CLI Proxy API 的 `/v0/management` 接口。
- 编译产物为**单文件 HTML**，内联所有资源，可直接嵌入主程序分发（`management.html`）。

### 最低后端版本要求

≥ 7.1.0（推荐最新版）

---

## 2. 技术栈与依赖

### 运行时依赖

| 库 | 版本 | 用途 |
|---|---|---|
| React | ^19.2.1 | UI 框架 |
| react-dom | ^19.2.1 | DOM 渲染 |
| react-router-dom | ^7.10.1 | 客户端路由（HashRouter） |
| Zustand | ^5.0.9 | 轻量状态管理 |
| Axios | 1.15.2 | HTTP 客户端 |
| i18next | ^26.2.0 | 国际化框架 |
| react-i18next | ^17.0.8 | React 国际化绑定 |
| Motion | ^12.34.3 | 动效库 |
| @uiw/react-codemirror | ^4.25.3 | 代码编辑器组件 |
| @codemirror/lang-yaml | ^6.1.2 | YAML 语法支持 |
| @codemirror/merge | ^6.12.0 | YAML diff 对比 |
| yaml | ^2.8.2 | YAML 解析/序列化 |

### 开发依赖

| 工具 | 版本 | 用途 |
|---|---|---|
| Vite | ^8.0.10 | 构建工具 |
| vite-plugin-singlefile | ^2.3.3 | 单文件内联打包 |
| TypeScript | ^6.0.3 | 类型安全 |
| Sass | ^1.94.2 | CSS 预处理器 |
| ESLint | ^9.39.1 | 代码规范 |
| Prettier | ^3.7.4 | 代码格式化 |
| Bun | 1.3.14 | 包管理器 / 运行时 |

### 构建目标

- `ES2020`，支持现代浏览器（Chrome, Firefox, Safari, Edge）。

---

## 3. 项目结构

```
src/
├── App.tsx                  # 根组件，路由配置
├── main.tsx                 # 应用入口
├── assets/                  # 静态资源（如内联 Logo）
├── components/              # 共享组件
│   ├── common/              # 通用组件（通知、确认弹窗、页面过渡）
│   ├── config/              # 配置相关组件
│   ├── layout/              # 布局组件（MainLayout）
│   ├── modelAlias/          # 模型别名编辑组件
│   ├── providers/           # 提供商相关组件
│   ├── quota/               # 配额相关组件
│   └── ui/                  # 基础 UI 组件（Button、Icon 等）
├── features/                # 功能模块
│   ├── authFiles/           # 认证文件功能模块
│   ├── plugins/             # 插件系统功能模块
│   └── providers/           # AI 提供商 Workbench 功能模块
├── hooks/                   # 自定义 React Hooks
├── i18n/                    # 国际化配置与语言包
│   └── locales/             # en.json, zh-CN.json, zh-TW.json, ru.json
├── pages/                   # 页面组件（每个路由对应一个 Page）
├── router/                  # 路由配置
│   ├── MainRoutes.tsx       # 主路由表（受保护路由）
│   └── ProtectedRoute.tsx   # 认证守卫
├── services/                # 服务层
│   ├── api/                 # API 调用模块
│   │   ├── client.ts        # Axios 客户端单例
│   │   ├── config.ts        # 配置 API
│   │   ├── providers.ts     # 提供商 API
│   │   ├── authFiles.ts     # 认证文件 API
│   │   ├── oauth.ts         # OAuth API
│   │   ├── logs.ts          # 日志 API
│   │   ├── version.ts       # 版本检测 API
│   │   ├── models.ts        # 模型列表 API
│   │   ├── plugins.ts       # 插件 API
│   │   └── transformers.ts  # 响应数据规范化
│   └── storage/             # 存储服务
│       └── secureStorage.ts # 混淆存储工具
├── stores/                  # Zustand 状态仓库
│   ├── useAuthStore.ts      # 认证状态
│   ├── useConfigStore.ts    # 配置状态
│   ├── useLanguageStore.ts  # 语言状态
│   ├── useModelsStore.ts    # 模型列表状态
│   ├── useNotificationStore.ts # 通知状态
│   ├── useQuotaStore.ts     # 配额状态
│   └── useThemeStore.ts     # 主题状态
├── styles/                  # 全局样式与变量
├── types/                   # TypeScript 类型定义
│   ├── common.ts            # 通用类型
│   ├── api.ts               # API 相关类型
│   ├── config.ts            # 配置类型
│   ├── auth.ts              # 认证类型
│   ├── provider.ts          # 提供商类型
│   ├── authFile.ts          # 认证文件类型
│   ├── oauth.ts             # OAuth 类型
│   ├── log.ts               # 日志类型
│   ├── quota.ts             # 配额类型
│   └── plugin.ts            # 插件类型
└── utils/                   # 工具函数
    ├── constants.ts         # 常量定义
    ├── connection.ts        # 连接地址处理
    ├── encryption.ts        # 混淆/解混淆
    ├── validation.ts        # 输入校验
    └── ...                  # 其他工具
```

---

## 4. 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────┐
│                   Browser                       │
│  ┌───────────────────────────────────────────┐  │
│  │               React App                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────┐  │  │
│  │  │  Router  │  │ Zustand  │  │  i18n   │  │  │
│  │  │ HashRouter│  │  Stores  │  │ i18next │  │  │
│  │  └──────────┘  └──────────┘  └─────────┘  │  │
│  │  ┌───────────────────────────────────────┐  │  │
│  │  │            Pages / Features           │  │  │
│  │  └───────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────┐  │  │
│  │  │          API Service Layer            │  │  │
│  │  │  (Axios Client + 各 API 模块)         │  │  │
│  │  └───────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
│                      ↕ HTTP                      │
└─────────────────────────────────────────────────┘
            ↕ Authorization: Bearer <key>
┌─────────────────────────────────────────────────┐
│         CLI Proxy API Server                    │
│         /v0/management/*                        │
└─────────────────────────────────────────────────┘
```

### 分层设计

| 层次 | 职责 |
|---|---|
| **页面层 (Pages)** | 各功能页面，消费 Store 状态，调用 API 服务 |
| **功能模块层 (Features)** | 复杂功能的独立封装（Providers Workbench、Plugins、AuthFiles） |
| **组件层 (Components)** | 可复用 UI 组件，与业务无关 |
| **状态层 (Stores)** | Zustand 全局状态，跨页面共享 |
| **服务层 (Services/API)** | 所有 HTTP 调用封装，含请求/响应拦截器 |
| **工具层 (Utils)** | 纯函数工具，无副作用 |

---

## 5. 路由设计

采用 **HashRouter**（`createHashRouter`），适合单文件 HTML 部署场景。

### 路由结构

```
/ (RootShell)
├── /login                          → LoginPage（公开）
└── /*                              → ProtectedRoute → MainLayout
    ├── /                           → DashboardPage
    ├── /dashboard                  → DashboardPage
    ├── /ai-providers               → ProvidersWorkbenchPage
    ├── /auth-files                 → AuthFilesPage
    ├── /auth-files/oauth-excluded  → AuthFilesOAuthExcludedEditPage
    ├── /auth-files/oauth-model-alias → AuthFilesOAuthModelAliasEditPage
    ├── /oauth                      → OAuthPage
    ├── /quota                      → QuotaPage
    ├── /config                     → ConfigPage
    ├── /logs                       → LogsPage（需后端开启文件日志）
    ├── /system                     → SystemPage
    ├── /plugins                    → PluginsPage（需后端支持插件）
    ├── /plugin-store               → PluginStorePage（需后端支持插件）
    └── /plugin-pages/:pluginId/:menuIndex → PluginResourcePage
```

### 认证守卫（ProtectedRoute）

- 检查 `useAuthStore` 的 `isAuthenticated` 状态。
- 未认证时重定向至 `/login`。
- 支持会话恢复（`restoreSession`），启动时自动尝试重新登录。

### 动态路由

- 插件相关路由根据 `supportsPlugin` 标志动态开启/关闭。
- 插件支持信息来自服务端响应头 `x-cpa-support-plugin`。

---

## 6. 状态管理

使用 **Zustand v5** 管理全局状态，分多个 Store 按职责隔离。

### Store 一览

#### useAuthStore（认证状态）

持久化至 `localStorage`（混淆存储），核心字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `isAuthenticated` | boolean | 是否已登录 |
| `apiBase` | string | API 基础地址 |
| `managementKey` | string | 管理密钥（仅 rememberPassword=true 时持久化） |
| `rememberPassword` | boolean | 是否记住密码 |
| `serverVersion` | string\|null | 服务端版本 |
| `serverBuildDate` | string\|null | 服务端构建时间 |
| `serverRuntimeKind` | 'cpa'\|'home'\|'unknown' | 服务端类型 |
| `supportsPlugin` | boolean | 是否支持插件 |
| `connectionStatus` | ConnectionStatus | 连接状态 |
| `connectionError` | string\|null | 连接错误信息 |

关键方法：
- `login(credentials)` — 验证连接、检测 runtimeKind、更新状态
- `logout()` — 清空所有状态与缓存
- `restoreSession()` — 单例 Promise，启动时自动恢复
- `checkAuth()` — 重新验证连接有效性

全局事件监听：
- `unauthorized` → 自动登出
- `server-version-update` → 更新版本信息
- `server-plugin-support-update` → 更新插件支持标志

#### useConfigStore（配置状态）

- 缓存后端 `config.yaml` 配置，带 30s 过期逻辑
- 提供 `fetchConfig`、`clearCache` 等方法

#### useModelsStore（模型列表状态）

- 缓存 `/v1/models` 数据
- 提供 `clearCache` 方法

#### useQuotaStore（配额状态）

- 管理各提供商的配额数据

#### useNotificationStore（通知状态）

- 全局通知队列
- 支持 info / success / warning / error 类型
- 默认持续 3000ms

#### useThemeStore（主题状态）

- 支持 `light` / `white` / `dark` / `auto` 四种主题
- 持久化至 `localStorage`（key: `cli-proxy-theme`）

#### useLanguageStore（语言状态）

- 支持 `zh-CN` / `zh-TW` / `en` / `ru`
- 持久化至 `localStorage`（key: `cli-proxy-language`）

---

## 7. API 服务层

### ApiClient（单例）

位于 `src/services/api/client.ts`，封装 Axios 实例：

```
ApiClient
├── setConfig(apiBase, managementKey)  — 设置连接参数
├── setupInterceptors()                — 请求/响应拦截器
├── get / post / put / patch / delete  — 标准 HTTP 方法
├── getRaw / requestRaw                — 原始响应（用于下载）
└── postForm                           — FormData 上传
```

**请求拦截器**：
- 注入 `Authorization: Bearer <key>` 头
- 自动规范化废弃的 `/generative-language-api-key` 端点

**响应拦截器**：
- 读取响应头中的版本信息（`x-cpa-version`、`x-cpa-home-version` 等）
- 读取插件支持标志（`x-cpa-support-plugin`）
- 通过 CustomEvent（`server-version-update`、`server-plugin-support-update`）通知 Store
- HTTP 401 时触发 `unauthorized` 事件自动登出

### API 模块列表

| 模块 | 文件 | 主要接口 |
|---|---|---|
| 配置 | `config.ts` | GET/PUT `/config`, 各子项 PUT |
| 配置文件 | `configFile.ts` | YAML 文件读写、保存 diff |
| API Keys | `apiKeys.ts` | 管理代理 api-keys |
| 提供商 | `providers.ts` | Gemini/Codex/Claude/Vertex/OpenAI CRUD |
| 认证文件 | `authFiles.ts` | 上传/下载/删除 JSON 凭据 |
| OAuth | `oauth.ts` | 发起/轮询各提供商 OAuth 流程 |
| 日志 | `logs.ts` | 增量拉取日志、清空、下载 |
| 版本 | `version.ts` | 版本检测、runtimeKind 探测 |
| 模型 | `models.ts` | GET `/v1/models` |
| 配额 | 通过 config | 配额相关读写 |
| 插件 | `plugins.ts` | 插件列表、安装、卸载、资源页 |
| Vertex | `vertex.ts` | Vertex JSON 凭据导入 |
| 订阅 | `antigravitySubscription.ts` | Antigravity 订阅管理 |
| API 调用 | `apiCall.ts` | 浏览器侧 OpenAI chat/completions 测试 |
| API Key 用量 | `apiKeyUsage.ts` | Key 使用量查询 |

### 数据规范化（transformers.ts）

- `normalizeConfigResponse` — 规范化配置字段
- `normalizeGeminiKeyConfig` — Gemini Key 配置规范化
- `normalizeOpenAIProvider` — OpenAI 提供商配置规范化
- `normalizeProviderKeyConfig` — 通用提供商配置规范化

---

## 8. 页面模块详解

### LoginPage（登录页）

- 表单：API 地址 + 管理密钥 + 记住密码
- 地址格式自动归一化（支持多种输入格式）
- 语言切换入口
- 连接时显示连接状态与错误信息
- 会话恢复时自动跳转（无需手动登录）

### DashboardPage（仪表盘）

- 服务连接状态与版本/构建时间显示
- 关键数量概览（API Keys 数、提供商数等）
- 可用模型快照预览

### ConfigPage（配置面板）

- **可视化编辑**：常用 `config.yaml` 字段（基础设置、代理 api-keys）
- **YAML 源码编辑**：CodeMirror 6 编辑器，YAML 高亮与搜索
- 保存前**差异预览**（CodeMirror Merge 对比视图）
- 修改未保存时路由守卫提示

### AuthFilesPage（认证文件）

- 列表展示 JSON 凭据文件（支持筛选、搜索、分页）
- 上传（单文件 ≤ 10MB）/ 下载 / 删除
- Runtime-only 标记显示
- 查看单个凭据支持的模型（依赖后端接口）
- 跳转至 OAuth 排除模型编辑页
- 跳转至 OAuth 模型别名映射编辑页

### AuthFilesOAuthExcludedEditPage（OAuth 排除模型编辑）

- 为指定认证文件编辑 OAuth 排除模型列表
- 支持 `*` 通配符

### AuthFilesOAuthModelAliasEditPage（OAuth 模型别名编辑）

- 为指定认证文件编辑 OAuth 模型别名映射

### OAuthPage（OAuth 授权）

支持的提供商及流程：

| 提供商 | 流程 |
|---|---|
| Codex | 设备码 / OAuth 重定向 |
| Anthropic/Claude | 设备码 / OAuth |
| Antigravity | OAuth |
| Kimi | OAuth |
| xAI/Grok | 设备码（需提交显示的 code） |
| Vertex | JSON 凭据导入 |
| iFlow | Cookie 导入 |

- 轮询 OAuth 状态
- 支持提交回调 URL 或页面显示码

### QuotaPage（配额管理）

管理以下提供商的配额限制与使用情况：
- Claude、Antigravity、Codex、Kimi、xAI/Grok 及其他提供商

### LogsPage（日志）

- **增量轮询**：只拉取新增内容，避免重复传输
- 自动刷新（可配置间隔）
- 全文搜索
- 隐藏管理端流量（过滤 `/v0/management` 请求日志）
- 清空日志
- 下载请求错误日志文件
- **条件显示**：仅当后端开启文件日志时导航项可见

### SystemPage（系统信息）

- 快捷链接
- UI 版本（构建时注入）与后端版本对比
- 检查更新
- 请求日志开关
- 本地登录信息清理
- 拉取 `/v1/models` 并分组展示（需要至少一个代理 API Key）

---

## 9. 功能特性模块

### ProvidersWorkbenchPage（AI 提供商工作台）

位于 `src/features/providers/`，核心设计：

**支持的提供商品牌（ProviderBrand）：**
- `gemini` — Google Gemini API
- `codex` — Codex（支持 WebSockets）
- `claude` — Anthropic Claude（支持 Cloak 模式）
- `vertex` — Google Vertex AI
- `openaiCompatibility` — OpenAI 兼容提供商（多 Key、自定义 Headers）

**ProviderDescriptor（提供商能力描述符）：**

每个品牌通过 `PROVIDER_DESCRIPTORS` 声明其支持的功能项，包括：
- `supportsApiKey`, `supportsBaseUrl`, `supportsProxyUrl`
- `supportsHeaders`, `supportsModels`, `supportsExcludedModels`
- `supportsPrefix`, `supportsPriority`, `supportsTestModel`
- `supportsWebsockets`, `supportsCloak`, `supportsApiKeyEntries`

**ProviderResource（归一化视图模型）：**
- 统一不同品牌的异构配置数据
- `id`（稳定 React key）、`brand`、`name`、`identifier`
- `apiKeyPreview`（脱敏预览）
- `modelCount`、`modelNames`

**交互模式：**
- 列表视图 + 侧边抽屉（Sheet）编辑
- 支持排序（`name`, `priority`, `recent-success`）
- OpenAI 兼容提供商支持浏览器侧 `chat/completions` 测试
- 支持从 `/v1/models` 自动导入模型别名

### PluginsPage / PluginStorePage / PluginResourcePage（插件系统）

位于 `src/features/plugins/`：

- **PluginsPage**：已安装插件列表，管理插件状态
- **PluginStorePage**：插件商店，浏览/安装插件
- **PluginResourcePage**：加载插件自定义 UI 资源页（`/plugin-pages/:pluginId/:menuIndex`）
- **pluginPolling.ts**：插件状态轮询
- **pluginResources.ts**：插件资源条目收集、资源 URL 解析、刷新事件

插件相关导航项根据 `supportsPlugin` 动态注入侧边栏。

### AuthFiles 功能模块（src/features/authFiles/）

- 认证文件 UI 状态管理（`uiState.ts`）
- 相关常量定义（`constants.ts`）
- 专用 Hooks 和组件

---

## 10. 组件体系

### 布局组件（MainLayout）

- **侧边栏导航**：带图标的导航链接列表
- **抽屉式子菜单**：支持多级菜单展开（如插件菜单）
- **主题切换**：header 中的主题选择器
- **语言切换**：header 中的语言菜单
- **响应式**：移动端适配（侧边栏可收起）
- 通过 `PageTransition` 实现页面切换动画

### 通用组件

| 组件 | 功能 |
|---|---|
| `NotificationContainer` | 全局通知浮层，消费 `useNotificationStore` |
| `ConfirmationModal` | 全局确认弹窗 |
| `PageTransition` | 页面切换动画（Motion 驱动） |
| `SecondaryScreenShell` | 二级页面容器（如 OAuthExcluded 编辑页） |
| `SplashScreen` | 启动加载屏 |

### UI 基础组件（src/components/ui/）

- `Button` — 标准按钮
- `icons` — 所有 SVG 图标集合（侧边栏、操作图标等）

### 页面专用 Hooks（src/pages/hooks/）

各页面可附带专用 Hook，处理本页面的数据加载与状态逻辑。

---

## 11. 安全机制

### 管理密钥存储

管理密钥存储于浏览器 `localStorage`，采用**轻量混淆**（非加密）方案：

```
格式: enc::v1::<base64(XOR(data, keyBytes))>
密钥字节: SECRET_SALT | window.location.host | navigator.userAgent
```

- 混淆密钥绑定当前 host 和 UA，不同来源无法直接复用
- **重要声明**：这不是加密安全边界，仍应视为可读的敏感数据
- 仅当 `rememberPassword=true` 时才持久化管理密钥

### 认证流程

1. 每次 HTTP 请求自动附带 `Authorization: Bearer <MANAGEMENT_KEY>`
2. HTTP 401 响应触发全局 `unauthorized` 事件，自动执行登出
3. 登录时先用 `fetchConfig` 验证连接有效性，再保存状态
4. 支持旧版 localStorage 键名自动迁移（向后兼容）

### 远程访问

- 从非 localhost 浏览器访问时，服务端需开启 `allow-remote-management: true`
- 反复认证失败可能导致服务端临时封禁远程 IP

---

## 12. 国际化

基于 **i18next + react-i18next** 实现。

### 支持语言

| 语言代码 | 名称 |
|---|---|
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁体中文 |
| `en` | English |
| `ru` | Русский |

### 语言检测与切换

- 启动时自动检测浏览器语言（`navigator.language`）
- 可在登录页或 header 语言菜单手动切换
- 语言偏好持久化至 `localStorage`（key: `cli-proxy-language`）
- 切换同步更新 `document.documentElement.lang`

### 翻译文件位置

`src/i18n/locales/[lang].json`

---

## 13. 主题与样式

### 主题系统

支持 4 种主题：
- `light` — 浅色
- `white` — 纯白
- `dark` — 深色
- `auto` — 跟随系统

主题持久化至 `localStorage`（key: `cli-proxy-theme`）。

### 样式方案

- **SCSS Modules**：组件级样式隔离，命名规范 `ComponentName.module.scss`
- **全局 SCSS 变量**：通过 Vite 配置 `@use "@/styles/variables.scss" as *` 自动注入所有 SCSS 文件
- CSS 模块命名规则：`[name]__[local]___[hash:base64:5]`（camelCase 本地转换）

---

## 14. 构建与发布

### 构建流程

```bash
tsc --noEmit       # 类型检查
tsc                # TypeScript 编译
vite build         # Vite 构建 + 单文件内联
```

输出：`dist/index.html`（所有 JS/CSS/图片资源内联）

### 版本注入

构建时通过 `__APP_VERSION__` 全局变量注入版本号，优先级：
1. 环境变量 `VERSION`（GitHub Actions 设置）
2. Git Tag（`git describe --tags`）
3. `package.json` version 字段
4. 回退为 `'dev'`

### CI/CD（GitHub Actions）

- Tag `vX.Y.Z` 触发 `.github/workflows/release.yml`
- 构建后将 `dist/index.html` 重命名为 `management.html` 并发布 Release

### 开发命令

```bash
bun install --frozen-lockfile  # 安装依赖
bun run dev                    # Vite 开发服务器（localhost:5173）
bun run build                  # 生产构建
bun run preview                # 预览构建产物
bun run lint                   # ESLint（warnings 即失败）
bun run format                 # Prettier 格式化
bun run type-check             # tsc --noEmit 类型检查
```

---

## 15. 数据流图

### 认证数据流

```
LoginPage
  → useAuthStore.login()
    → apiClient.setConfig(apiBase, managementKey)
    → configApi.getConfig()  [验证连接]
    → versionApi.detectRuntimeKind()
    → set { isAuthenticated: true, ... }
      → ProtectedRoute 放行
        → MainLayout 渲染
```

### API 请求数据流

```
Page/Feature Component
  → 调用 API 模块（如 configApi.getConfig()）
    → apiClient.get('/config')
      → Axios 请求拦截器
        → 注入 Authorization 头
        → 设置 baseURL
      → HTTP 请求 → CLI Proxy API Server
      → Axios 响应拦截器
        → 提取版本头 → dispatchEvent('server-version-update')
        → 提取插件支持头 → dispatchEvent('server-plugin-support-update')
        → 401 → dispatchEvent('unauthorized') → useAuthStore.logout()
      → 返回规范化数据
  → 更新 Store 或本地状态
  → 触发 UI 重渲染
```

### 服务版本信息传播

```
Axios 响应拦截器
  → window.dispatchEvent('server-version-update', { version, buildDate, runtimeKind })
    → useAuthStore event listener
      → updateServerVersion() / updateServerRuntimeKind()

  → window.dispatchEvent('server-plugin-support-update', { supportsPlugin })
    → useAuthStore event listener
      → updateServerPluginSupport()
        → MainRoutes 重新计算路由表
        → MainLayout 重新渲染侧边栏
```

---

*本文档基于代码库现状分析生成，如代码有更新请同步维护。*
