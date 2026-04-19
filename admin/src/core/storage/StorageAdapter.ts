/** A file listing returned by StorageAdapter.list(). */
export interface FileRef {
  path: string;
  name: string;
  sha: string;
  size: number;
}

/** A single file's contents plus its revision identifier (blob sha). */
export interface FileContent {
  path: string;
  content: string;
  sha: string;
}

export interface WriteOptions {
  message: string;
  /** Existing blob sha when updating; omitted when creating. */
  sha?: string;
}

/**
 * Thin abstraction over whatever's holding the repo. Swap implementations
 * without touching the UI or schema layer. GitHubAdapter is the
 * production backend; a future LocalAdapter could expose the working
 * tree via a dev-server endpoint.
 */
export interface StorageAdapter {
  list(folder: string, opts?: { extensions?: string[] }): Promise<FileRef[]>;
  read(path: string): Promise<FileContent>;
  write(path: string, content: string, opts: WriteOptions): Promise<FileContent>;
  uploadBinary(path: string, data: ArrayBuffer, opts: WriteOptions): Promise<FileContent>;
  delete(path: string, opts: WriteOptions): Promise<void>;
}
