declare module "@webreflection/sql.js" {
	type SqlJsConfig = {
		wasmBinary?: ArrayLike<number>;
	};

	export type SqlJsDatabase = {
		run(sql: string, params?: unknown[]): SqlJsDatabase;
		exec(sql: string, params?: unknown[]): Array<{
			columns: string[];
			values: unknown[][];
		}>;
		prepare(sql: string): {
			bind(params?: unknown[]): boolean;
			step(): boolean;
			getAsObject(): Record<string, unknown>;
			free(): boolean;
		};
		export(): Uint8Array;
		close(): void;
	};

	type SqlJsStatic = {
		Database: new (data?: Uint8Array) => SqlJsDatabase;
	};

	export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}

declare module "sql.js/dist/sql-wasm.wasm" {
	const wasmBinary: Uint8Array;
	export default wasmBinary;
}
