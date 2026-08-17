export type LogicalOperator = 'AND' | 'OR';

export type SortOrder = 'ASC' | 'DESC';

export type ConditionOperator =
  | 'is'
  | 'isNot'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'exists';

export interface SortInput<TField extends string = string> {
  attribute: TField;
  order: SortOrder;
}

export interface ConditionGroupInput {
  operator: LogicalOperator;
  operands: ConditionInput[];
}

export interface ConditionPredicateInput<TField extends string = string> {
  attribute: TField;
  operator: ConditionOperator;
  value?: unknown;
}

export type ConditionInput<TField extends string = string> =
  | ConditionGroupInput
  | ConditionPredicateInput<TField>;

export interface ListRequestInput<TField extends string = string> {
  page?: number;
  pageSize?: number;
  sort?: SortInput<TField>[];
  conditions?: ConditionInput<TField> | null;
}

export interface LogicalNode {
  kind: 'logical';
  operator: LogicalOperator;
  operands: ConditionNode[];
}

export interface PredicateNode {
  kind: 'predicate';
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export type ConditionNode = LogicalNode | PredicateNode;

export type FieldDataType =
  | 'string'
  | 'number'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'objectId';

export interface FieldDefinition {
  field: string;
  dbPath: string;
  dataType: FieldDataType;
  sortable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  enumValues?: string[];
  operators: ConditionOperator[];
  normalizeValue?: (value: unknown) => unknown;
}

export interface EntityListConfig<TDoc> {
  entityName: string;
  model: {
    aggregate(pipeline: object[]): Promise<TDoc[]>;
  };
  fields: Record<string, FieldDefinition>;
  defaultSort: SortInput[];
  maxPageSize?: number;
  defaultPageSize?: number;
  maxConditionDepth?: number;
  maxPredicates?: number;
  tenantMatchFactory?: (runtimeContext: Record<string, unknown>) => object;
  basePipelineFactory?: (runtimeContext: Record<string, unknown>) => object[];
  projectStage?: object | null;
}

export interface ListInfoNormalized {
  page: number;
  pageSize: number;
  sort: SortInput[];
  conditions: ConditionInput | null;
}

export interface PaginationInfo {
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ListMeta {
  executionTime: number;
  cached: boolean;
}

export interface ListResponse<TData> {
  data: TData[];
  listInfo: ListInfoNormalized;
  pagination: PaginationInfo;
  meta: ListMeta;
}

export interface OperatorDefinition {
  name: ConditionOperator;
  validateValue: (value: unknown, field: FieldDefinition) => void;
  normalizeValue?: (value: unknown, field: FieldDefinition) => unknown;
  toMongoPredicate: (args: {
    field: FieldDefinition;
    dbPath: string;
    value: unknown;
  }) => object;
}

