/**
 * Thin wrapper around the `git` binary.
 *
 * The sync checker needs read-only history access to upstream clones. It never
 * writes to an upstream working tree: it only reads refs, logs and blobs.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;

export async function git(
  args: readonly string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync('git', [...args], {
      cwd: options.cwd,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: DEFAULT_MAX_BUFFER,
      windowsHide: true,
      encoding: 'utf8',
    });
    return { ok: true, stdout, stderr, code: 0 };
  } catch (error) {
    const err = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    return {
      ok: false,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : (err.message ?? ''),
      code: typeof err.code === 'number' ? err.code : 1,
    };
  }
}

/** Resolve the commit a remote branch points at, without cloning. */
export async function lsRemoteHead(
  repository: string,
  branch: string,
): Promise<string | null> {
  const result = await git(['ls-remote', repository, `refs/heads/${branch}`]);
  if (!result.ok) return null;
  const first = result.stdout.trim().split('\n')[0];
  if (!first) return null;
  const sha = first.split(/\s+/)[0];
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/** List remote branches, used to discover the default branch when unknown. */
export async function lsRemoteHeads(repository: string): Promise<string[]> {
  const result = await git(['ls-remote', '--heads', repository]);
  if (!result.ok) return [];
  return result.stdout
    .trim()
    .split('\n')
    .map((line) => line.split(/\s+/)[1] ?? '')
    .filter((ref) => ref.startsWith('refs/heads/'))
    .map((ref) => ref.replace('refs/heads/', ''));
}

export async function localHead(repoPath: string): Promise<string | null> {
  const result = await git(['rev-parse', 'HEAD'], { cwd: repoPath });
  if (!result.ok) return null;
  const sha = result.stdout.trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

export async function hasCommit(repoPath: string, sha: string): Promise<boolean> {
  const result = await git(['cat-file', '-e', `${sha}^{commit}`], { cwd: repoPath });
  return result.ok;
}

export async function fetchRemote(repoPath: string, repository: string): Promise<boolean> {
  const result = await git(['fetch', '--quiet', repository, '+refs/heads/*:refs/remotes/upstream/*'], {
    cwd: repoPath,
    timeoutMs: 180_000,
  });
  return result.ok;
}

export interface FileChange {
  readonly status: string;
  readonly path: string;
}

export async function diffNameStatus(
  repoPath: string,
  fromRef: string,
  toRef: string,
): Promise<FileChange[]> {
  const result = await git(['diff', '--name-status', `${fromRef}..${toRef}`], { cwd: repoPath });
  if (!result.ok) return [];
  return result.stdout
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [status = '?', ...rest] = line.split(/\t/);
      return { status, path: rest.join('\t') };
    });
}

export async function commitLog(
  repoPath: string,
  fromRef: string,
  toRef: string,
  limit = 40,
): Promise<string[]> {
  const result = await git(
    ['log', `--max-count=${limit}`, '--pretty=format:%h %ad %s', '--date=short', `${fromRef}..${toRef}`],
    { cwd: repoPath },
  );
  if (!result.ok) return [];
  return result.stdout.split('\n').filter((line) => line.trim().length > 0);
}

/** Read a blob at a ref without touching the working tree. */
export async function showFile(
  repoPath: string,
  ref: string,
  filePath: string,
): Promise<string | null> {
  const result = await git(['show', `${ref}:${filePath}`], { cwd: repoPath });
  return result.ok ? result.stdout : null;
}

export async function listTree(repoPath: string, ref: string): Promise<string[]> {
  const result = await git(['ls-tree', '-r', '--name-only', ref], { cwd: repoPath });
  if (!result.ok) return [];
  return result.stdout.split('\n').filter((line) => line.trim().length > 0);
}
