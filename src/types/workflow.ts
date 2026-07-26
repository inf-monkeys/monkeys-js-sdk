export enum ValidationIssueType {
  ERROR = 'ERROR',
  WANTING = 'WANTING',
}

export enum ValidationReasonType {
  VALUE_REQUIRED = 'VALUE_REQUIRED',
  VALUE_TYPE_NOT_MATCH = 'VALUE_TYPE_NOT_MATCH',
  DO_WHILE_EMPTY_LOOP_OVER = 'DO_WHILE_EMPTY_LOOP_OVER',
}

export interface ValidationIssueReason {
  type: ValidationReasonType;
  name: string;
}

export interface WorkflowValidationIssue {
  taskReferenceName: string;
  issueType: ValidationIssueType;
  detailReason: ValidationIssueReason;
  humanMessage: {
    en: string;
    zh: string;
  };
}

export interface WorkflowTriggerConfig {
  triggerType: WorkflowTriggerType;
  cron?: string;
}

export enum WorkflowTriggerType {
  MANUALLY = 'MANUAL',
  SCHEDULER = 'SCHEDULER',
  WEBHOOK = 'WEBHOOK',
}
  
