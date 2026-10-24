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

`compilePageRuntimeBundle`, `compileWorkbenchRuntimeBundle`, and `compileNavigationRuntimeBundle` validate dependency evidence and caller-approved size limits, then produce rebuildable bundles before identity filtering. Navigation Page links use stable Page identity and the current published target registry; historical Page references in `NavigationRelease` remain audit evidence. Page upgrades, rollbacks, disappearance, and recovery do not require a Navigation publication. Workbench target and action dependency snapshots remain exact; runtime provider selection uses the public contract described below.

`projectCurrentNavigationPages` refreshes Page routes and access policies from a complete, tenant-authorized catalog. Consumers hide unavailable or disabled nodes and empty groups, and enforce both Navigation audience and current Page permissions. Catalog failures remain errors. Persisted release and dependency hashes are not rewritten by runtime projection.

### 首屏查询时机（候选）

`Page.initialQueryPolicy` 控制组件代码准备期间的提前请求：省略或 `"auto"` 自动推导可提前执行的查询；`"explicit"` 只考虑显式标记的查询；`"disabled"` 关闭本页所有提前请求，包括显式标记。关闭提前请求不影响组件挂载后的正常查询。

在节点 `data`（编译后为 `queryBindings`）中设置 `loadTiming: "page-start"` 可标记提前请求；`loadTiming: "component-mount"` 将该条查询排除，即使页面启用自动推导。省略 `loadTiming` 跟随页面策略。例如，仅提前获取列表：

```js
const page = {
  // ...其余 Page 必填字段
  initialQueryPolicy: 'explicit',
  body: {
    // ...已注册组件和端口
    data: [{
      // ...query、parameters、port、pagination 等必填字段
      bindingId: 'list',
      loadTiming: 'page-start',
    }],
  },
};
```

这些字段是调度提示，不绕过权限、`queryWhen`、节点及祖先的生命周期或参数依赖。当前 Studio 宿主仅提前执行已授权、可解析参数、`execution: "server"` 且 `cache: "identity-scoped"` 的 Design 组件查询，每次准备最多 8 条；未满足条件的仍走原查询流程。已有 `queryPolicy: "manual"` 等触发方式保持不变。同一请求结果仅向挂载后的组件交接一次，不增加业务数据持久缓存。

两个字段均不注入 schema 默认值，旧声明和编译身份保持不变。发布含新字段的 Page 前，需要先更新 SDK、服务端编译器和 Studio 宿主；当前仅为本地候选。

## 发布门禁

```bash
yarn typecheck
yarn test
yarn pack:check
```

`yarn test` 会重新构建包、生成全部 JSON Schema，并验证公开导出、所有 canonical 合同、严格字段边界和跨字段不变量。


### Legacy declarative Page releases

`compileLegacyPageRuntimeBundle` and `LegacyPageRuntimeBundleSchema` are explicit compatibility boundaries for pre-canonical resolved Page releases. They retain exact historical View or projection references, dependency checks, and content identities without inventing canonical View references or Shell descriptors. Legacy compilation rejects canonical bindings and Domain Query bindings; use `resolvePage` and `compilePageRuntimeBundle` for current declarations.

The current `OntologyBindingSchema`, `PageRuntimeBundleSchema`, and `compilePageRuntimeBundle` keep their canonical View and Shell requirements. Do not choose the legacy compiler as a fallback after a current contract fails validation. Server migrations must select the compatibility boundary for the existing legacy API, not expose that choice as an untrusted request option.

## Action program authoring (candidate)

The additive ActionProgramDefinition and Page programActions contracts describe
immutable, exact-version workflow programs; existing direct actions are unchanged.
The native browser Worker and Page host implement the runtime program bridge.
Server publication still retains an explicit activation gate; verify the target
deployment before using program bindings on published Pages.

Generate schema-based declarations with generateActionProgramTypes. The repository
authoring command yarn program:build <config.json> requires an entry (.ts or checked
.js), outputDirectory, a definition and exact schemas (definitionRevisionRef plus
Schema definition). The entry exports main with the generated Context/Input/Result
types. The command checks TypeScript/checkJs, bundles static imports into an IIFE
named __actionProgram, and emits program-artifact.json with JS/source-map hashes.
Unsupported schema keywords, invalid types, dynamic imports and require calls fail
explicitly. Compiler dependencies are pinned in this repository's dev toolchain.

Program hash fields use canonicalContentHash of the exact string or definition,
not engine bytecode. The author tool hashes the sorted local source-file map for
sourceHash. No generated artifacts authorize registration, publication or calls.
### Shared Page state bindings

`Page.sharedStateBindings` optionally connects declared root states to a host-registered shared-state provider. Each binding declares `bindingId`, `provider: { id, version }`, `states` (provider slot → state ID), `queries` (provider slot → query binding ID), and `writeInteractions` (deliberate interaction IDs). The resolver and compiler retain this declaration in the immutable runtime bundle. Duplicate owners, dangling references, repeated-instance state and writes to unmapped state are rejected. Existing Pages omit this field and retain their previous compiled identity.

This contract does not expose localStorage keys or execute scripts. The host must resolve exactly one supported provider/version, validate its slot and persistence requirements, enforce identity lifecycle guards, and grant writes only through the declared mappings. Missing providers must fail explicitly. Provider-specific semantics and shared namespaces remain host responsibilities. Deployments must upgrade SDK readers/compilers and the host provider together before publishing Pages using this field.

### Stable runtime contracts

`runtimeContractVersion` is a provider-owned public contract identifier, independent of implementation revisions. `resolvePage` and `compileWorkbenchRuntimeBundle` derive it from exact governed registrations. The Page compiler rejects user-supplied contract labels that disagree with those registrations. A compatible implementation can serve a previously compiled RenderNode without changing the published definition or its dependency hashes.

`assertViewProviderContract` checks provider/capability identity and ownership, then checks the declared contract. Unversioned nodes require exact revisions. `assertDeclarativeCapabilityContract` can prove an unversioned snapshot equivalent by reconstructing and comparing its complete immutable manifest/provider hashes; IDs alone are insufficient. `projectRuntimeContracts` additionally uses governed historical entries to enrich a rebuildable Page or Workbench projection. It preserves definitions, release references and dependency snapshots, and recalculates only the projection content hash.

`assertCompatibleCapabilityUpgrade` guards catalog activation and package publication. Compatible inputs accept every historical value; outputs must remain valid for historical consumers. Optional input properties, optional ports, enum widening and documentation annotations are supported; unknown Schema changes fail closed. Provider identity, lifecycle, effects, placement and access requirements remain protected. Breaking changes require a separate capability/provider identity with the existing implementation retained. Behavioral regression tests remain necessary alongside Schema checks.

`sameSchemaContract` compares stable identity, tenant scope, Schema version and content hash, allowing a different metadata revision for identical Schema content. Raw query results, permissions, command validation and immutable snapshot verification must continue to use their owning validators.
