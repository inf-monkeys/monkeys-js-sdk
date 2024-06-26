import { I18nValue } from "./i18n";

export type IJSONValue = string | number | boolean | IJSONObject | IJSONArray;
export type IJSONArray = Array<IJSONValue>;
export interface IJSONObject {
  [x: string]: IJSONValue;
}

export type ToolPropertyTypes =
  | "string"
  | "file"
  | "number"
  | "boolean"
  | "options"
  | "json"
  | "notice";

export const CODE_LANGUAGES = ["javaScript", "json", "python", "sql"] as const;

export type EditorType =
  | "code"
  | "codeNodeEditor"
  | "htmlEditor"
  | "sqlEditor"
  | "json";
export type CodeNodeEditorLanguage = (typeof CODE_LANGUAGES)[number];

export interface ToolPropertyTypeOptions {
  editor?: EditorType; // Supported by: string
  editorLanguage?: CodeNodeEditorLanguage; // Supported by: string in combination with editor: codeNodeEditor
  maxValue?: number; // Supported by: number
  minValue?: number; // Supported by: number
  multipleValues?: boolean; // Supported by: <All>
  multipleValueButtonText?: string; // Supported when "multipleValues" set to true
  numberPrecision?: number; // Supported by: number
  password?: boolean; // Supported by: string
  rows?: number; // Supported by: string
  assetType?: AssetType;
  accept?: string;
  max?: number;

  [key: string]: any;
}

export type ToolPropertyParameterValue =
  | string
  | number
  | boolean
  | undefined
  | null;

export type ResourceLocatorModes = "id" | "url" | "list" | string;
export interface IResourceLocatorResult {
  name: string;
  value: string;
  url?: string;
}

export interface ToolParameter {
  [key: string]: ToolParameterValueType;
}
export type ToolParameterValueType =
  // TODO: Later also has to be possible to add multiple ones with the name name. So array has to be possible
  | ToolPropertyParameterValue
  | ToolParameter
  | ToolPropertyParameterValue[]
  | ToolParameter[];

export interface ToolPropertyDisplayOptions {
  hide?: {
    [key: string]: ToolPropertyParameterValue[] | undefined;
  };
  show?: {
    [key: string]: ToolPropertyParameterValue[] | undefined;
  };
}

export interface ToolPropertyOptions {
  name: string | I18nValue;
  value: string | number | boolean;
  action?: string;
  description?: string | I18nValue;
}

export interface ToolPropertyCollection {
  displayName: string;
  name: string;
  values: ToolProperty[];
}

export interface ToolPropertyValueExtractorBase {
  type: string;
}

export interface ToolPropertyValueExtractorRegex {
  type: "regex";
  regex: string | RegExp;
}

export type AssetType =
  | "llm-model"
  | "sd-model"
  | "workflow"
  | "workflow-view"
  | "media-file"
  | "sql-knowledge-base-table"
  | "sql-knowledge-base"
  | "knowledge-base"
  | "canvas"
  | "workflow-template"
  | "fork-join-branch"
  | "workflow-version"
  | "comfyui-server"
  | "tools"
  | "comfyui-workflow"
  | 'llm-channel'
  ;

export interface ToolProperty {
  displayName: string | I18nValue;
  name: string;
  type: ToolPropertyTypes;
  typeOptions?: ToolPropertyTypeOptions;
  default?: ToolParameterValueType;
  description?: string | I18nValue;
  hint?: string;
  displayOptions?: ToolPropertyDisplayOptions;
  options?: Array<ToolPropertyOptions | ToolProperty | ToolPropertyCollection>;
  placeholder?: string | I18nValue;
  isNodeSetting?: boolean;
  noDataExpression?: boolean;
  required?: boolean;
  example?: string;
  extractValue?: ToolPropertyValueExtractorRegex;
  properties?: ToolProperty[];
  assetType?: AssetType;
}

export type ToolCategory =
  | "image" // 图像处理
  | "text" // 文本处理
  | "file" // 文件处理
  | "gen-image" // 图像生成
  | "gen-text" // 文本生成
  | "train-model" // 模型训练
  | "process" // 流程控制
  | "auto" // 自动化
  | "bio" // 生命科学
  | "human" // 用户交互
  | "query" // 搜索增强
  | "db" // 数据存储
  | "extra"; // 扩展能力

export enum ToolType {
  SIMPLE = "SIMPLE",
  FORK_JOIN = "FORK_JOIN",
  JOIN = "JOIN",
  DO_WHILE = "DO_WHILE",
  SWITCH = "SWITCH",
  DYNAMIC = "DYNAMIC",
  FORK_JOIN_DYNAMIC = "FORK_JOIN_DYNAMIC",
  TERMINATE = "TERMINATE",
  HUMAN = "HUMAN",
  SUB_WORKFLOW = "SUB_WORKFLOW",
  INLINE = "INLINE",
  SET_VARIABLE = "SET_VARIABLE",
}

export interface ToolRuleItem {
  type: string;
  [x: string]: any;
}

export interface ToolExtraInfo {
  [x: string]: any;
}

export interface ToolCredentialItem {
  name: string;
  required: boolean;
}

export interface ToolDef {
  type: ToolType;
  name: string;
  displayName: string | I18nValue;
  description?: string | I18nValue;
  icon?: string;
  input: ToolProperty[];
  output: ToolProperty[];
  categories?: ToolCategory[];
  rules?: ToolRuleItem[];
  extra?: ToolExtraInfo;
  credentials?: ToolCredentialItem[];
}
