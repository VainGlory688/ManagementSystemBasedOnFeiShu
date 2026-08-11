# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

> ℹ️ Section 1 为设计意图与决策上下文。Code agent 实现时以 Section 2 及之后的具体参数为准。

## 1. Design Archetype (设计原型)

### 1.1 内容理解

- **目标用户**: 游戏研发人员（PM/QA/Dev），高频查阅数据、追踪版本与缺陷进度，需快速识别风险
- **核心目的**: 高效决策 + 风险预警 + 进度掌控
- **情绪基调**: 冷静专注 / 秩序感；避免焦虑过载、廉价游戏化、视觉噪音

### 1.2 设计方向

- **Design Style**: Grid 网格风格 — 高密度数据管理需清晰分区，网格线+等宽数字强化工程精度感
- **Application Type**: Admin/SaaS（企业级项目管理工作台）
- **Aesthetic Direction**: 深空蓝侧边栏锚定导航，暖灰主区承载数据，精密如控制台仪表盘

## 2. Color System (色彩系统)

**色彩关系**: 深空蓝(H215)主色 + 暖灰底(H40) + 青绿/琥珀/朱红三级状态语义色
**配色设计理由**: 深空蓝传递专业克制，暖灰降低长时间阅读疲劳，状态色精准对应研发风险等级
**主色推导**: H215 深空蓝呼应游戏工业化气质，用于侧边栏、激活态、关键操作按钮
**使用比例**: 60% 暖灰中性底 / 30% 深空蓝结构色 / 10% 状态强调色（仅用于标签、指示条、风险标识）

### 2.1 主题颜色

| Token                | HSL 值                  | 说明                               |
| -------------------- | ----------------------- | ---------------------------------- |
| `background`         | hsl(40, 10%, 97%)       | 暖灰页面底色，降低冷白刺眼感       |
| `card`               | hsl(0, 0%, 100%)        | 纯白卡片容器                       |
| `foreground`         | hsl(215, 25%, 12%)      | 深墨文字，带微蓝倾向               |
| `muted-foreground`   | hsl(215, 12%, 50%)      | 次要说明文字                       |
| `primary`            | hsl(215, 60%, 28%)      | 深空蓝主交互色                     |
| `primary-foreground` | hsl(0, 0%, 100%)        | 主色上白字                         |
| `accent`             | hsl(215, 30%, 94%)      | 极浅蓝灰交互反馈背景               |
| `accent-foreground`  | hsl(215, 25%, 18%)      | accent 上深色文字                  |
| `border`             | hsl(215, 15%, 88%)      | 低饱和蓝灰边框                     |

### 2.2 导航区配色

- **基调关系**: 独立深色基底 hsl(215, 40%, 10%)，与浅色主区形成明确层级分割
- **关键状态**: 激活项左侧 2px primary 竖条 + bg-accent 背景；hover 为半透明白覆盖层
- **边界与背景**: 非透明深色实底，右侧 1px hsl(215, 20%, 18%) 分隔线

### 2.3 语义颜色

| 用途     | HSL 值                 | 衍生逻辑                          |
| -------- | ---------------------- | --------------------------------- |
| 正常推进 | hsl(160, 55%, 42%)     | 青绿，背景 hsl(160,40%,94%)       |
| 高优关注 | hsl(38, 90%, 50%)      | 琥珀，背景 hsl(38,70%,93%)        |
| 严重风险 | hsl(4, 75%, 52%)       | 朱红，背景 hsl(4,60%,95%)         |
| P0 优先级 | hsl(4, 75%, 52%)      | 同严重风险，白字深底胶囊          |
| P1 优先级 | hsl(28, 85%, 52%)     | 橙，白字中饱和底                  |
| P2 优先级 | hsl(215, 60%, 48%)    | 蓝，白字中饱和底                  |
| P3 优先级 | hsl(215, 12%, 58%)    | 灰，深字浅底                      |

## 3. Typography (字体排版)

- **Heading**: Space Grotesk, "Noto Sans SC", system-ui, sans-serif
- **Body**: Inter, "Noto Sans SC", system-ui, sans-serif
- **Data/Mono**: JetBrains Mono, ui-monospace, monospace（表格数值、版本号、日期）
- **字体策略**: Space Grotesk 几何感强化标题工程气质；JetBrains Mono 确保数据列对齐可读

## 4. Layout Strategy (布局策略)

- **导航意图**: 持久型左侧全局侧边栏（应用概要设计已声明）；至多一套；非透明深色底；移动端折叠为 Drawer
- **页面架构**: Sidebar(240px fixed) + Topbar(56px) + Content(scrollable)；max-w-[1400px] 居中约束
- **响应式**: ≥1024px 展开侧边栏双区布局；<1024px 隐藏侧边栏，Topbar 含汉堡菜单触发 Drawer

## 5. Visual Language (视觉语言)

- **形态参数**: 圆角 `rounded-sm`(2px) · 阴影 `shadow-none`（卡片用 1px border 替代）· 间距基调 `compact`
- **识别签名**: ① 表格行 hover 左侧 2px primary 指示条滑入 ② KPI 数字 JetBrains Mono + 0.6s 缓动滚动 ③ 状态标签 pill 形 + 对应语义色底
- **装饰策略**: 仅用 1px 网格线与状态色块；无渐变装饰、无插图背景
- **动效原则**: 克制精准，150-300ms；入场交错延迟 ≤50ms；呼吸脉冲 2s 周期
- **可及性**: 正文对比度 ≥4.5:1；风险行浅红底配深红字(≥4.5:1)；交互元素有明确 focus ring

## 6. Component Principles (组件原则)

- **状态完整性**: Button/Input/Card 覆盖 Default/Hover/Focus/Active/Disabled；Focus 用 2px primary outline offset-2
- **层级清晰**: Primary=实心深空蓝；Secondary=outline 边框；Ghost=transparent+accent hover；表格行 hover 仅变背景+指示条
- **一致性**: 所有列表页共享筛选栏+表格+分页模式；状态标签统一 pill 高度 22px padding-x 8px
- **特殊反馈**: 驳回卡片入场左右微晃 0.4s；逾期行警告图标 2s 呼吸摆动；测试中进度条 3s 微光扫过循环

## 7. Image Direction (图片与视觉资产)

- **Image Role**: 无强制图片需求
- **Image Art Direction**: 优先通过排版节奏、网格线、状态色块和微动效建立视觉记忆点；不使用 Hero 图或装饰插画
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 避免通用科技感插图、商务人物素材、无主题抽象渐变、游戏角色立绘

## 8. 应避免 (Anti-patterns)

- ❌ 大面积高饱和渐变色块或发光特效（破坏数据阅读专注度）
- ❌ 过度圆润的卡片和按钮（pill/rounded-xl+柔和阴影与 Grid 工程气质冲突）
- ❌ 缺少状态色语义区分（所有标签同色导致风险信号淹没）