# Monkeys JS SDK

`@inf-monkeys/monkeys` 是 Monkeys 跨仓 TypeScript 合同、运行时 Schema、JSON Schema 与迁移工具的唯一发布源。旧 Tool / Workflow 类型继续从主入口导出；新代码应使用稳定子路径，禁止导入包内 `src/*`。

## 安装

```bash
yarn add @inf-monkeys/monkeys@0.1.0 --registry https://registry.npmjs.org
```

## 稳定入口

```ts
import type {
  RequestScopeV1,
  WorkflowDefinitionV2,
} from '@inf-monkeys/monkeys/contracts';
import {
  RequestScopeV1Schema,
  WorkflowDefinitionV2Schema,
} from '@inf-monkeys/monkeys/schemas';
import {
  migrateLegacyWorkflowDefinition,
} from '@inf-monkeys/monkeys/migrations';
```

- `@inf-monkeys/monkeys/contracts`：版本化 TypeScript 合同。
- `@inf-monkeys/monkeys/schemas`：同一合同的 Zod 运行时 Schema 与 schema registry。
- `@inf-monkeys/monkeys/json-schema/*`：构建时生成的 JSON Schema 2020-12 文件。
- `@inf-monkeys/monkeys/migrations`：旧 Workflow、Tool Manifest、Theme 配置的一次性迁移器。

当前 canonical 合同覆盖 RequestScope、ExecutionLink、Completion、Artifact/Output、Workflow、Capability、Page/Runtime Descriptor、Tenant Config、Theme Tokens、Ontology、Projection、Lineage、Domain Event 与 Trend/Radar 数据对象。Schema 对新增 JSON 字段执行无损 round-trip，但已声明字段仍严格校验类型和不变量。

## 迁移 CLI

```bash
monkeys-contract-migrate \
  --kind workflow-definition-v2 \
  --input legacy-workflow.json \
  --output workflow-v2.json
```

支持的 kind：`workflow-definition-v2`、`theme-tokens-v1`、`capability-manifest-v1`。不传 `--input` 时从 stdin 读取，不传 `--output` 时写到 stdout。

## 发布门禁

```bash
yarn typecheck
yarn test
yarn pack:check
```

`yarn test` 会重新构建包、生成全部 JSON Schema、验证旧公共导出、合同不变量、未知字段 round-trip 和迁移结果。
