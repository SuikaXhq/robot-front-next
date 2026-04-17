# 代码规范检查清单（Code Style Checklist）

> 适用于 **Next.js 16 + React 19 + TypeScript 5** 项目

## 一、当前已启用的规则（基线配置）

当前 `eslint.config.mjs` 仅配置了 `eslint-config-next` 的两套预设：

| 配置来源 | 覆盖范围 | 规则数量 |
|---------|---------|---------|
| `eslint-config-next/core-web-vitals` | React、React Hooks、Next.js 最佳实践、核心 Web Vitals | ~40 条 |
| `eslint-config-next/typescript` | TypeScript 基础规则、与 ESLint 重叠规则的 TS 替代 | ~20 条 |

**已启用的关键规则示例：**
- `react-hooks/rules-of-hooks` — Hook 必须在顶层调用
- `react-hooks/exhaustive-deps` — 检查 useEffect 依赖数组
- `@next/next/no-html-link-for-pages` — 禁止用 `<a>` 做路由跳转
- `@typescript-eslint/no-explicit-any` — 限制滥用 `any`
- `@typescript-eslint/no-unused-vars` — 禁止未使用变量
- `prefer-const` — 能用 const 就不用 let
- `no-var` — 禁止使用 var

---

## 二、强烈建议同时启用的规则组合

以下按 **功能模块** 分组，建议整组同时启用，避免规则之间互相矛盾。

### 组 A：TypeScript 严格类型检查
**推荐度：** ⭐⭐⭐⭐⭐（强烈建议）

| 规则包/规则 | 作用 |
|------------|------|
| `@typescript-eslint/strict-type-checked` | 开启严格类型推断检查，捕获潜在运行时错误 |
| `@typescript-eslint/stylistic-type-checked` | 统一类型书写风格（如优先用 `interface` 而非 `type`） |

**具体值得关注的规则：**
- `@typescript-eslint/no-floating-promises` — 未处理的 Promise 必须加 `await` 或 `.catch()`
- `@typescript-eslint/no-misused-promises` — 禁止把 Promise 传给不需要 Promise 的地方
- `@typescript-eslint/await-thenable` — 禁止对非 Thenable 对象使用 `await`
- `@typescript-eslint/no-unnecessary-condition` — 消除永远为真/为假的条件判断
- `@typescript-eslint/prefer-nullish-coalescing` — 推荐用 `??` 替代 `||`
- `@typescript-eslint/prefer-optional-chain` — 推荐用 `a?.b` 替代 `a && a.b`

> **同时启用原因：** 这两套规则共享 `type-aware` 能力，必须同时配置 parserOptions 的 `projectService`，单独开启一部分会浪费类型检查基础设施。

---

### 组 B：React 热刷新与组件规范
**推荐度：** ⭐⭐⭐⭐⭐（强烈建议）

| 规则包/规则 | 作用 |
|------------|------|
| `react-refresh/only-export-components` | 禁止在组件文件里导出非组件内容，保证 Fast Refresh 正常工作 |

**补充可选规则（按团队偏好决定是否开启）：**
- `react/function-component-definition` — 统一函数组件写法（箭头函数 vs 普通函数）
- `react/jsx-sort-props` — 强制 props 按字母排序（适合大型项目）
- `react/jsx-curly-brace-presence` — 控制 `prop={"value"}` 还是 `prop="value"`

> **同时启用原因：** React 19 + Next.js 16 对 Fast Refresh 很敏感，`react-refresh` 规则与现有的 `react-hooks` 规则一起构成完整的 React 开发体验保障。

---

### 组 C：Import 排序与规范
**推荐度：** ⭐⭐⭐⭐☆（非常推荐）

| 规则包/规则 | 作用 |
|------------|------|
| `eslint-plugin-simple-import-sort` | 自动排序 import 语句，减少代码审查中的格式噪音 |
| `import/first` | 确保所有 import 在文件最顶部 |
| `import/newline-after-import` | import 块后必须有空行 |

**替代方案：** 也可以用 `import/order`，但配置较繁琐，`simple-import-sort` 开箱即用。

> **同时启用原因：** import 排序规则 + 空行规则 + 顶部规则共同作用，才能让整个文件的 import 区域呈现统一、可预测的结构。

---

### 组 D：代码格式（Prettier）
**推荐度：** ⭐⭐⭐⭐⭐（必须启用）

| 工具 | 作用 |
|------|------|
| `prettier` | 统一代码格式（换行、引号、尾逗号等） |
| `eslint-config-prettier` | 关闭与 Prettier 冲突的 ESLint 格式规则 |

**推荐配置项：**
- `semi: true` — 语句末尾加分号
- `singleQuote: true` — 使用单引号
- `trailingComma: "es5"` — 对象/数组最后一个元素带逗号
- `printWidth: 100` — 单行最大 100 字符
- `tabWidth: 2` — 缩进 2 空格

> **同时启用原因：** Prettier 负责所有格式问题，ESLint 负责代码质量问题。两者必须通过 `eslint-config-prettier` 解耦，否则会出现"修了又报错"的循环。

---

### 组 E：Node/服务端代码补充规则
**推荐度：** ⭐⭐⭐☆☆（视需要）

由于项目包含 `src/server/claude-bridge.ts` 等 Node 端代码，建议增加：

| 规则 | 作用 |
|------|------|
| `@typescript-eslint/no-misused-promises` | 防止把 async 函数传给不需要 Promise 的回调（如 `ws.on('message', asyncFn)`） |
| `n/no-process-exit` | 避免直接 `process.exit()`（如果写 CLI 工具则例外） |

---

## 三、可选的高级规则（按项目阶段决定）

| 规则包 | 适用场景 | 推荐度 |
|--------|---------|--------|
| `eslint-plugin-unicorn` | 代码现代化、禁用过时写法 | ⭐⭐⭐☆☆ |
| `eslint-plugin-security` | 安全相关（如 `eval`、正则 DoS） | ⭐⭐⭐⭐☆ |
| `eslint-plugin-perfectionist` | 极致排序（对象属性、枚举、接口成员） | ⭐⭐☆☆☆ |
| `eslint-plugin-tailwindcss` | 如果使用 Tailwind，排序 className | —（本项目未用） |

---

## 四、推荐的 "最小可用组合"

如果你只想做最基础的补强，**建议同时启用以下 4 组**（已在 `eslint.config.mjs` 中更新）：

1. **TypeScript 严格组** — `strict-type-checked` + `stylistic-type-checked`
2. **React 热刷新组** — `react-refresh/only-export-components`
3. **Import 排序组** — `simple-import-sort/imports` + `simple-import-sort/exports`
4. **Prettier 格式组** — `prettier` + `eslint-config-prettier`

---

## 五、命令行脚本推荐

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 六、规则启用速查表

| 规则 | 当前状态 | 建议 | 同时启用依赖 |
|------|---------|------|-------------|
| `@typescript-eslint/strict-type-checked` | 未启用 | **开启** | `stylistic-type-checked` + `projectService` |
| `@typescript-eslint/stylistic-type-checked` | 未启用 | **开启** | `strict-type-checked` |
| `react-refresh/only-export-components` | 未启用 | **开启** | 现有 React Hooks 规则 |
| `simple-import-sort/imports` | 未启用 | **开启** | `simple-import-sort/exports` + `import/first` |
| `prettier` | 未启用 | **开启** | `eslint-config-prettier` |
| `eslint-plugin-unicorn` | 未启用 | 可选 | 单独即可 |
| `eslint-plugin-security` | 未启用 | 可选 | 单独即可 |
| `husky + lint-staged` | 未启用 | 可选 | 需同时配置两者 |
