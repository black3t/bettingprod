import { Pool } from 'pg';
import { getActiveDbPath } from './database-sqlite';
declare let pool: Pool | null;
export { pool };
export { getActiveDbPath };
export declare function query(text: string, params?: any[]): Promise<{
    rows: any[];
    rowCount: number;
} | import("pg").QueryResult<any>>;
export declare function transaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
//# sourceMappingURL=database.d.ts.map