import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
declare let db: Database | null;
export declare function healthDbCheck(): Promise<boolean>;
export declare function initSQLite(): Promise<Database<sqlite3.Database, sqlite3.Statement>>;
export declare function querySQLite(text: string, params?: any[]): Promise<{
    rows: any[];
    rowCount: number;
}>;
export { db };
export declare function transactionSQLite<T>(callback: (client: any) => Promise<T>): Promise<T>;
//# sourceMappingURL=database-sqlite.d.ts.map