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

export async function composeDownWithVolumes(
  config: Config,
  options: { stream?: boolean } = {}
): Promise<ComposeResult> {
  return runCompose(config, ['down', '-v'], { stream: options.stream });
}

/**
 * Start compose with a specific profile
 */
export async function composeUpWithProfile(
  config: Config,
  profile: string,
  options: { detached?: boolean; stream?: boolean; service?: string } = {}
): Promise<ComposeResult> {
  const args = ['--profile', profile, 'up'];
  if (options.detached !== false) {
    args.push('-d');
  }
  if (options.service) {
    args.push(options.service);
  }
  return runCompose(config, args, { stream: options.stream });
}

/**
 * Stop a specific service (optionally with profile)
 */
export async function composeStopService(
  config: Config,
  service: string,
  options: { stream?: boolean; profile?: string } = {}
): Promise<ComposeResult> {
  const args: string[] = [];
  if (options.profile) {
    args.push('--profile', options.profile);
  }
  args.push('stop', service);
  return runCompose(config, args, { stream: options.stream });
}

/**
 * Remove a specific service (optionally with profile)
 */
export async function composeRmService(
  config: Config,
  service: string,
  options: { stream?: boolean; profile?: string; force?: boolean } = {}
): Promise<ComposeResult> {
  const args: string[] = [];
  if (options.profile) {
    args.push('--profile', options.profile);
  }
  args.push('rm');
  if (options.force) {
    args.push('-f');
  }
  args.push(service);
  return runCompose(config, args, { stream: options.stream });
}

export interface ServiceStatus {
  name: string;
  running: boolean;
  status?: string;
  health?: string;
}

/**
 * Get status of a specific service
 */
export async function composePs(
  config: Config,
  service?: string
): Promise<ServiceStatus[]> {
  const args = ['ps', '--format', 'json'];
  if (service) {
    args.push(service);
  }

  const result = await runCompose(config, args);
  if (!result.success || !result.stdout.trim()) {
    return [];
  }

  try {
    // Docker compose outputs one JSON object per line
    const lines = result.stdout.trim().split('\n');
    const services: ServiceStatus[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line) as {
        Name?: string;
        Service?: string;
        State?: string;
        Health?: string;
      };
      services.push({
        name: data.Service || data.Name || 'unknown',
        running: data.State === 'running',
        status: data.State,
        health: data.Health,
      });
    }

    return services;
  } catch {
    return [];
  }
}
