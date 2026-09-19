export type SqlValue = string | number | null;

export interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  changes: number;
}

export interface Database {
  readonly driver: "d1" | "sqlite";
  /** Run a single SQL statement with positional (`?`) parameters. */
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<QueryResult<Row>>;
  /** Run several statements back to back. D1 executes them in one round-trip. */
  batch(statements: { sql: string; params?: SqlValue[] }[]): Promise<void>;
}
