# RegloireStudio
## 游戏研发项目管理系统

> 多项目协同 · 版本节奏掌控 · 研发风险预警  
> `React` · `NestJS` · `Drizzle ORM` · `飞书妙搭`

---

## ✦ 快速开始

> **01｜进入项目**  
> 在项目入口选择已有项目，或新建项目后进入工作区。

> **02｜拆解与排期**  
> 在需求详情维护子需求、负责人、预计时间和流水线依赖。

> **03｜跟进风险**  
> 通过“异常事项”和个人工作台处理逾期、未排期、今日到期及阻塞项。

> **04｜确认发布**  
> 在版本详情查看关联需求、测试与缺陷，并确认实时关闭条件。

---

## ◈ 功能地图

| 工作区 | 能力 |
| :--- | :--- |
| 🗂️ **项目入口** | 新建、编辑、切换项目；业务数据按 `project_id` 分项目显示 |
| ◫ **项目总览** | 按版本查看 KPI、需求/缺陷分布、P0 待处理项和进行中测试 |
| ◇ **版本管理** | 版本风险与文档、关联需求状态、实时关闭条件校验 |
| ▦ **需求管理** | 父/子需求、优先级、计划版本、状态聚合、流水线依赖与关键路径 |
| ⚠ **异常事项** | 逾期、待拆分/未关联版本、未排期子需求、今日到期、流水线阻塞 |
| ▤ **排期管理** | 人员与需求甘特图；支持移动任务、调整工期和实时预览 |
| ◉ **测试与缺陷** | 测试计划跟踪、缺陷状态/驳回流程、关联需求和版本筛选 |
| ◎ **个人工作台** | 我的需求、缺陷、测试计划、参与版本与个人甘特图 |
| ✧ **全局能力** | 搜索、主题切换、保密水印、项目 Logo、开屏动画 |

---

## ⚙ 业务规则

| 规则 | 系统行为 |
| :--- | :--- |
| 父需求完成时间 | 有子需求时，自动汇总为最晚的子需求预计结束时间 |
| 子需求排期 | 缺少预计开始或结束时间时，进入“未排期子需求” |
| 异常统计范围 | 最多基于最近更新的 1000 条父需求统计；超出时给出提示 |
| 项目访问 | 任意已登录用户可切换项目；当前不包含成员可见性隔离 |

---

## ⛁ 数据模型

系统数据库字段截图位于 [`DB_Structure/`](DB_Structure)。复制系统或调整表结构前，请以截图中的**字段标识、类型、必填/唯一约束**为准；后端 ORM 会按这些字段标识读写数据。

| 数据表 | 用途 | 关键关联 |
| :--- | :--- | :--- |
| [`project`](DB_Structure/project.jpg) | 项目入口与项目资料 | `project_id` 为项目代号 |
| [`main_version_manage`](DB_Structure/main_version_manage.jpg) | 版本管理 | 通过 `project_id` 归属项目 |
| [`version_requirement`](DB_Structure/version_requirement.jpg) | 父需求 | `planning_version` 关联版本；保存流水线 JSON |
| [`sub_requirement_item`](DB_Structure/sub_requirement_item.jpg) | 子需求 | `app_parent_work_item` 关联父需求 |
| [`test_plan`](DB_Structure/test_plan.jpg) | 测试计划 | `related_version` 关联版本 |
| [`defect_item`](DB_Structure/defect_item.jpg) | 缺陷 | `app_parent_order` 关联父需求 |

> 除项目表外，五张业务表均需保留文本类型 `project_id`。所有表还应保留截图中的 `id`、`base_record_id`（如有）及创建/更新时间、创建/更新人等审计字段。

---

## 🎮 项目 Logo

将 Logo 放入 `client/public/project-logos/`，以项目代号命名，例如 `R01.png`。

`PNG / WebP / JPG / JPEG` · 推荐 `512 × 512` · `1:1` 比例  
未找到图片时，系统自动显示项目代号默认图标。

---

## ⇄ 复制给其他团队

### 01｜准备数据

- 依据上方“数据模型”及 [`DB_Structure/`](DB_Structure) 截图创建项目、版本、需求、子需求、测试计划、缺陷六张表。
- 五张业务表均需有文本字段 `project_id`，并与项目表的 `project_id` 对应。
- 为存量数据补齐 `project_id`，再在项目入口创建同代号项目。
- 确认飞书用户资料可用；负责人筛选、个人工作台和水印均依赖当前登录用户。
- 修改状态或字段选项后，同步检查状态聚合、异常事项和关闭规则。

### 02｜替换品牌

| 内容 | 修改位置 |
| :--- | :--- |
| 开屏文字 | `client/src/components/OpeningSplash.tsx` |
| 项目入口标题 | `client/src/pages/project-list/ProjectListPage.tsx` |
| 主题、开屏与水印样式 | `client/src/tailwind-theme.css` |
| 水印开关与内容 | `client/src/index.tsx`、`client/src/components/UserWatermark.tsx` |
| 游戏 Logo | `client/public/project-logos/` |

> 如需项目成员权限、角色控制或飞书通知，请补充服务端鉴权和消息配置。

---

## ⌘ 开发命令

```bash
npm install          # 安装依赖
npm run dev          # 启动开发环境
npm run type:check   # 类型检查
npm test             # 运行测试
```
