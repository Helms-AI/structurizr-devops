import execa = require('execa');
import { detectContainerRuntime } from './docker';
import { logger } from './logger';
import type { Config } from '../types';

export interface ComposeResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCompose(
  config: Config,
  args: string[],
  options: { stream?: boolean } = {}
): Promise<ComposeResult> {
  const runtime = await detectContainerRuntime();
  const composeArgs = ['compose', ...args];

  if (options.stream) {
    logger.info(`Running: ${runtime} ${composeArgs.join(' ')}`);
  }

  const execaOptions: execa.Options = {
    cwd: config.containersDir,
    ...(options.stream ? { stdio: 'inherit' } : {}),
  };

  try {
    const result = await execa(runtime, composeArgs, execaOptions);
    return {
      success: true,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode || 0,
    };
  } catch (error: unknown) {
    const execaError = error as {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
    };
    return {
      success: false,
      stdout: execaError.stdout || '',
      stderr: execaError.stderr || '',
      exitCode: execaError.exitCode ?? 1,
    };
  }
}

export async function composeUp(
  config: Config,
  options: { detached?: boolean; stream?: boolean } = {}
): Promise<ComposeResult> {
  const args = ['up'];
  if (options.detached !== false) {
    args.push('-d');
  }
  return runCompose(config, args, { stream: options.stream });
}

export async function composeDown(
  config: Config,
  options: { stream?: boolean } = {}
): Promise<ComposeResult> {
  return runCompose(config, ['down'], { stream: options.stream });
}

export async function composeRestart(
  config: Config,
  options: { stream?: boolean } = {}
): Promise<ComposeResult> {
  return runCompose(config, ['restart'], { stream: options.stream });
}

export async function composeLogs(
  config: Config,
  options: { follow?: boolean; stream?: boolean } = {}
): Promise<ComposeResult> {
  const args = ['logs'];
  if (options.follow) {
    args.push('-f');
  }
  return runCompose(config, args, { stream: options.stream });
}
