# 出海内容社区 · 前端 UI 设计交接文档

> 用途：把项目完整上下文交给 Gemini，由它产出**前端 UI 设计方案与设计规范**。
> 站点：https://si.kittywizards.com
> 仓库：https://github.com/Davyricardo/chuhai-community
> 文档版本：2026-10-19

---

## 一、项目是什么

一个**中文出海内容社区**，面向做 AI 产品出海、独立开发的用户。核心内容形态：

| 内容类型 | 说明 |
|---|---|
| 文章 | 站内正文，或外链（如微信公众号文章），由后台发布 |
| 话题 | 投票征集，用户提交「想了解什么」，投票高的优先创作 |
| 工具推荐 | 按用途分类的建站/支付/SEO/AI 工具导航 |
| 评论 | 挂在文章或话题下，需登录 |

产品气质参考对象：`aichuhai.dev`（AI 网站出海开发者社区，内容密度高、分类清晰、SEO 导向）。**不要**参考 `alivip.vip`（卡密商城，视觉偏电商促销风，与本站定位不符）。

---

## 二、站点与部署信息（交付时请知悉）

| 项 | 值 |
|---|---|
| 域名 | `si.kittywizards.com`（Cloudflare 自定义域，已生效） |
| 托管 | Cloudflare Workers（`chuhai-community`） |
| 数据库 | Cloudflare D1（`chuhai-db`，SQLite，9 张表） |
| 发信 | Resend（域名已验证，用于注册验证码） |
| 人机验证 | Cloudflare Turnstile（注册、评论） |
| 部署方式 | `git push` → Cloudflare Workers Builds 自动构建，**本地不参与构建** |
| 仓库 | GitHub `Davyricardo/chuhai-community`（public） |
| 构建产物 | Astro SSR → `dist/` → Worker |

---

## 三、技术栈与硬约束

### 已采用

- **Astro 7**（`output: 'server'`，SSR）+ `@astrojs/cloudflare` 适配器
- **React 19**（`@astrojs/react` 已装，但页面目前**尚未使用 React 组件**，全部是 Astro 页面 + 原生 `<script>`）
- **Drizzle ORM** + D1
- 样式：**目前没有设计系统**，全靠每个页面顶部的内联 `<style>` 和元素内联 `style=""`

### 硬约束（设计必须遵守）

1. **不得引入需要 Node 运行时或重型依赖的方案**——跑在 Cloudflare Workers 上，只能浏览器端 + 边缘运行时。
2. **不得引入 Tailwind 等需要构建期重依赖的方案**——香橙派内存只有 2GB，本地不构建；Cloudflare 构建有配额。若设计要用 Tailwind，必须评估 `@tailwindcss/vite` 在 Astro 7 上的兼容性并给出明确的构建配置，否则**优先纯 CSS 方案**。
3. **移动优先**——目标用户大量用手机阅读（出海从业者刷内容）。
4. **中文排版优先**——标题、正文、标签、按钮文案均为中文，需给出中文字体栈、行高、字重、标点悬挂等规范。
5. **必须支持深色模式**——现有页面已有 `dark:` 语义与主题切换思路，设计需给出双主题 token。
6. **性能预算**：首屏 CSS 控制在 ~30KB 内，零布局抖动，图片懒加载。
7. **可访问性**：对比度至少 AA，焦点可见，表单有 label。

---

## 四、当前页面与功能清单（现状）

| 路由 | 状态 | 现状说明 |
|---|---|---|
| `/` 首页 | ✅ 已上线 | 最新文章列表（8 条）+ 热门话题（按票数 5 条）+ 登录态导航 |
| `/articles` | ✅ | 文章列表 + 关键词搜索框（`?q=`） |
| `/articles/[slug]` | ✅ | 文章详情、外链跳转、评论区（加载/发表） |
| `/topics` | ✅ | 话题列表、投票按钮、提交话题表单（登录后） |
| `/tools` | ✅ | 工具推荐（标签含「工具」的文章自动收录） |
| `/search` | ✅ | 全站搜索（文章 + 话题，LIKE 匹配） |
| `/auth/register` | ✅ | 邮箱 + 验证码 + 昵称 + 密码 + Turnstile |
| `/auth/login` | ✅ | 邮箱 + 密码 |
| `/admin` | ✅ | 后台：发布文章表单 + 全部文章表格（仅管理员） |
| `/api/*` | ✅ | articles / auth(4) / comments / topics / topics/vote |

### 交互细节（设计时需保留）

- 注册流程：填邮箱 → 「发送验证码」按钮（**60 秒倒计时**，按钮禁用）→ 收邮件填 6 位码 → 提交
- 评论与注册均有 **Turnstile 人机验证框**（Cloudflare widget，浅色/深色需可配）
- 投票：点击 ▲ 切换投票/取消，票数即时刷新
- 首页/导航需区分「未登录」与「已登录（显示昵称 + 后台入口 + 退出）」

---

## 五、数据模型（D1 / SQLite）

```
users           id, email, password_hash, display_name, avatar_url, role(user|admin),
               email_verified, created_at
email_codes     id, email, code, purpose(register|login|reset), expires_at, used_at,
               attempts(错5次作废), created_at
sessions        id, user_id, expires_at, created_at        (30 天)
articles        id, title, slug, summary, content, link, cover_url, tags(JSON字符串),
               author_id, published(0|1), published_at, created_at
topics          id, title, description, user_id, status(open|planned|done), vote_count, created_at
topic_votes     id, topic_id, user_id, created_at          (唯一索引防重复)
comments        id, target_type(article|topic), target_id, user_id, content, parent_id, created_at
likes           id, target_type, target_id, user_id, created_at (唯一索引，功能未上线)
rate_limits     id(key), count, window_start               (安全加固用)
```

字段可直接作为设计的内容来源，例如：文章卡需要 `title / summary / published_at / tags`，话题卡需要 `title / vote_count / status`。

---

## 六、当前 UI 的真实问题（重点）

这是要交给 Gemini 解决的核心：

1. **没有任何设计系统**——9 个页面各自内联 `<style>`，配色、圆角、间距、字号互不一致（有的用蓝色 `#2563eb`，有的用 `blue-600`，按钮高度 36–44px 不等）。
2. **没有组件抽象**——导航、文章卡、话题卡、表单、按钮在多个页面重复手写。
3. **没有设计 token**——颜色/间距/圆角/阴影/字体全是硬编码。
4. **视觉偏"开发调试风"**——能读，但不像一个面向内容消费者的社区产品。
5. **首页信息架构弱**——只有两个平铺列表，没有分类入口、热门标签、作者信息、内容推荐逻辑。
6. **搜索/空态/加载态/错误态未设计**——目前只有一句灰字。
7. **无响应式断点规范**——靠零散的 `@media (max-width: 640px)`。

---

## 七、设计任务（要 Gemini 产出什么）

### 1. 设计规范（Design Tokens）
- 颜色：主色/中性色/语义色（成功、警告、危险、信息）+ 语义化命名（`--color-primary`、`--color-surface`、`--color-text-muted`…）
- **双主题**：light + dark，两套完整色板
- 字体：中文优先的字体栈、字号阶梯（12/13/14/16/18/24/30）、行高、字重
- 间距体系（4 的倍数或自定义 scale）、圆角、阴影、边框
- 动效：时长与缓动（微交互：hover、投票反馈、按钮 loading）

### 2. 组件库（Component Inventory）
至少覆盖：导航栏、页脚、按钮（primary/secondary/ghost/loading/disabled）、输入框、文本域、搜索框、标签 Tag、徽章 Badge、卡片（文章卡/话题卡/工具卡）、列表、表格、分页、空状态、加载骨架、提示条（成功/失败/警告）、头像、投票组件、评论区、Turnstile 容器、后台表单、Tabs。

每个组件给：用途、状态、HTML/CSS 结构示意、无障碍要求。

### 3. 页面设计（9 个页面）
首页、文章列表、文章详情（含评论）、话题列表、工具推荐、搜索结果、注册、登录、后台。每个页面给：
- 信息架构与模块顺序
- 桌面 / 平板 / 手机三档布局
- 与现有数据字段的对应关系（避免设计出数据库没有的字段）

### 4. 实现映射
- 组件如何落到 Astro（`.astro` 组件 + props），哪些该用 React island
- 样式方案建议（**优先纯 CSS 变量 + 单一样式文件**；如推荐 Tailwind 必须附 Astro 7 可行配置与构建代价评估）
- 迁移路径：如何从"每个页面内联 `<style>`"逐步替换，不破坏现有功能

---

## 八、明确的参考基准（实测数据）

对 `aichuhai.dev` 做过技术探测，结论：

- 框架：**TanStack Start + React + Vite**
- CSS：**Tailwind CSS**（大量工具类，如 `max-w-6xl mx-auto px-4`、`rounded-2xl`、`text-gray-900 dark:text:white`）
- UI 组件：**Base UI**（`data-slot="dropdown-menu-trigger"` 等）
- 图标：**Tabler Icons**
- CDN/边缘：**Cloudflare**，图片走对象存储 + 独立 `cdn.` 子域
- 认证：Google OAuth
- 布局特征：`max-w-6xl` 内容宽度、16 高 sticky 顶栏、大号渐变标题区、4 列文章网格、标签云区块、话题征集 CTA 区块

**可借鉴**：内容宽度约束、卡片网格、标签云、话题征集 CTA、SEO meta 完整度。
**不要照搬**：它的登录方式（我们用邮箱验证码）、它的技术栈（我们是 Astro）。

---

## 九、交付物清单（请 Gemini 输出）

1. `design-tokens.md` — 完整 token 表（light/dark）
2. `components.md` — 组件清单与结构示意
3. `pages.md` — 9 个页面的信息架构 + 三档布局
4. `tokens.css` — 可直接使用的 CSS 变量文件（**这是最关键的落地物**）
5. `migration.md` — 从现状迁移的实施步骤（按页面分批，标注每批影响范围）

输出用 Markdown，代码块用 `css` / `html`，不要输出需要构建的组件框架代码。

---

## 十、验收标准

- [ ] 所有 9 个页面有三档布局说明
- [ ] light/dark 双主题色板完整，命名语义化
- [ ] 组件覆盖第八节列出的全部类型，含状态
- [ ] 中文排版规范（字体栈/行高/标点）
- [ ] `tokens.css` 可直接放进项目使用，无外部依赖
- [ ] 未引入需要 Node 运行时或重型构建依赖的方案
- [ ] 未设计与数据库不符的字段
- [ ] 移动优先，触控目标 ≥ 44px
- [ ] 对比度 AA，焦点可见

---

## 十一、明确不要做的事

- ❌ 不要改成 Tailwind（除非附完整可行的 Astro 7 配置与代价评估）
- ❌ 不要引入 Material/Bootstrap 等重型 UI 框架
- ❌ 不要建议 WebGL、复杂动画库、大量图片
- ❌ 不要改变现有信息架构的实质（如把话题投票改成别的形态）
- ❌ 不要改动数据模型、API 契约、Cloudflare 部署方式
- ❌ 不要添加需要额外常驻服务的功能

---

## 十二、环境备忘（供 Gemini 理解约束来源）

- 部署机是 **Orange Pi Zero 3**（2GB 内存），**不参与构建**——所有构建在 Cloudflare 完成
- 因此任何"本地构建才能用"的方案都不可行
- 站点承载在 Cloudflare Workers 免费额度内（每天 10 万请求），设计不应诱导大量请求（如无限滚动加载全站）
