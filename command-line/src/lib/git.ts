import execa = require('execa');

export async function isGitRepository(): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

export async function hasUncommittedChanges(): Promise<boolean> {
  try {
    await execa('git', ['diff-index', '--quiet', 'HEAD', '--']);
    return false;
  } catch {
    return true;
  }
}

export async function fetchOrigin(): Promise<void> {
  await execa('git', ['fetch', 'origin']);
}

export async function remoteBranchExists(branch: string): Promise<boolean> {
  try {
    await execa('git', [
      'ls-remote',
      '--exit-code',
      '--heads',
      'origin',
      branch,
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function localBranchExists(branch: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--verify', branch]);
    return true;
  } catch {
    return false;
  }
}

export async function tagExists(tag: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', tag]);
    return true;
  } catch {
    return false;
  }
}

export async function checkout(branch: string): Promise<void> {
  await execa('git', ['checkout', branch]);
}

export async function checkoutNewBranch(branch: string): Promise<void> {
  await execa('git', ['checkout', '-b', branch]);
}

export async function pull(remote: string, branch: string): Promise<void> {
  await execa('git', ['pull', remote, branch]);
}

export async function merge(
  source: string,
  message: string
): Promise<void> {
  await execa('git', ['merge', source, '-m', message]);
}

export async function createTag(
  tag: string,
  message: string
): Promise<void> {
  await execa('git', ['tag', '-a', tag, '-m', message]);
}

export async function pushTag(tag: string): Promise<void> {
  await execa('git', ['push', 'origin', tag]);
}

export async function pushBranch(
  branch: string,
  setUpstream = false
): Promise<void> {
  const args = ['push'];
  if (setUpstream) {
    args.push('-u');
  }
  args.push('origin', branch);
  await execa('git', args);
}

export async function getCurrentBranch(): Promise<string> {
  const result = await execa('git', ['branch', '--show-current']);
  return result.stdout.trim();
}

export function validateQuarterFormat(quarter: string): boolean {
  return /^q[1-4]-\d{4}$/.test(quarter);
}
