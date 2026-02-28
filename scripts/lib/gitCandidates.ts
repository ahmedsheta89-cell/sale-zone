import { execFileSync } from 'node:child_process';

export function listCandidateShas(maxCount = 20): string[] {
  const explicit = String(process.env.CANDIDATE_SHAS ?? '').trim();
  if (explicit) {
    return [...new Set(explicit.split(',').map((value) => value.trim()).filter(Boolean))];
  }
  const output = execFileSync('git', ['rev-list', `--max-count=${maxCount}`, 'HEAD'], { encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}

export function pathExistsAtSha(sha: string, filePath: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}:${filePath}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function readFileAtSha(sha: string, filePath: string): string {
  return execFileSync('git', ['show', `${sha}:${filePath}`], { encoding: 'utf8' });
}

export function getCommitUnixTime(sha: string): number {
  const value = execFileSync('git', ['show', '-s', '--format=%ct', sha], { encoding: 'utf8' }).trim();
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid_commit_time:${sha}`);
  }
  return parsed;
}
