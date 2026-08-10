declare module "cloudflare:workers" {
  export const env: any;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: { changes?: number; [key: string]: unknown };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag: string;
  range?: unknown;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  put(key: string, value: ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array | string, options?: R2PutOptions): Promise<unknown>;
  get(key: string, options?: { range?: Headers }): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

declare class FixedLengthStream {
  constructor(expectedLength: number | bigint);
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}
