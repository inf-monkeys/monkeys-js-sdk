# Monkeys JS SDK

`@inf-monkeys-tech/monkeys` 是 Monkeys 跨仓 TypeScript 合同、运行时 Schema 与 JSON Schema 的唯一发布源。所有消费者只使用一套 canonical 合同和稳定公开入口，禁止导入包内 `src/*`。

## 安装

```bash
yarn add @inf-monkeys-tech/monkeys@^1.0.4 --registry https://registry.npmjs.org
```

## 稳定入口

```ts
import type {
  RequestScope,
  WorkflowDefinition,
} from '@inf-monkeys-tech/monkeys/contracts';
import {
  RequestScopeSchema,
  WorkflowDefinitionSchema,
} from '@inf-monkeys-tech/monkeys/schemas';
import { resolveThemeTokens } from '@inf-monkeys-tech/monkeys/runtime';
```

- `@inf-monkeys-tech/monkeys/contracts`：canonical TypeScript 合同。
- `@inf-monkeys-tech/monkeys/schemas`：同一合同的 Zod 运行时 Schema 与 schema registry。
- `@inf-monkeys-tech/monkeys/runtime`：同时提供浏览器 ESM 与 Node.js CommonJS 入口的运行时编译器。
- `@inf-monkeys-tech/monkeys/json-schema/*`：构建时生成的 JSON Schema 2020-12 文件。

当前 canonical 合同覆盖 RequestScope、ExecutionLink、Completion、Artifact/Output、Workflow、Capability、Page/Runtime Descriptor、Tenant Config、Theme Tokens、Ontology、Projection、Lineage、Domain Event 与 Trend/Radar 数据对象。运行时 Schema 严格拒绝未声明字段、错误引用和不满足不变量的数据；SDK 不提供旧合同迁移器、兼容别名或并行版本入口。

## 声明式控制合同

`Page`、`PageRelease`、`Workbench`、`WorkbenchRelease`、`Navigation` 与 `NavigationRelease` 是六个独立的 control Ontology 合同。它们复用显式的 tenant scope、不可变 revision/hash、受限 AccessPolicy、RouteSpace/RouteClaim、PublicationPlan 和发布证据；不保存业务 Records、用户组成员、任意 URL 或可执行代码。

`compilePageRuntimeBundle`、`compileWorkbenchRuntimeBundle` 与 `compileNavigationRuntimeBundle` 只接受精确依赖和调用方批准的规模上限，输出可重建、与用户身份无关的确定性 Bundle。现有 `PageDefinition`、`MenuDefinition` 及其编译器保持不变，消费者可以按独立部署节奏升级 SDK。

## 发布门禁

```bash
yarn typecheck
yarn test
yarn pack:check
```

`yarn test` 会重新构建包、生成全部 JSON Schema，并验证公开导出、所有 canonical 合同、严格字段边界和跨字段不变量。
