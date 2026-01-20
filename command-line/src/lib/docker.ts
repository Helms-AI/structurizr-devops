import execa = require('execa');
import { logger } from './logger';
import type { Config } from '../types';

export type ContainerRuntime = 'nerdctl' | 'docker';

export async function detectContainerRuntime(): Promise<ContainerRuntime> {
  try {
    await execa('nerdctl', ['--version']);
    return 'nerdctl';
  } catch {
    try {
      await execa('docker', ['--version']);
      return 'docker';
    } catch {
      throw new Error('No container runtime found. Install nerdctl or docker.');
    }
  }
}

export function translateUrlForContainer(url: string): string {
  if (url.includes('localhost')) {
    return url.replace('localhost', 'host.lima.internal');
  }
  return url;
}

export interface RunContainerOptions {
  image: string;
  args: string[];
  volumes?: Array<{ host: string; container: string; readonly?: boolean }>;
  env?: Record<string, string>;
  config: Config;
  stream?: boolean;
}

export async function runContainer(
  options: RunContainerOptions
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const runtime = await detectContainerRuntime();
  const { image, args, volumes = [], env = {}, config, stream = false } = options;

  const cmdArgs: string[] = ['run', '--rm'];

  for (const vol of volumes) {
    const mode = vol.readonly ? 'ro' : 'rw';
    cmdArgs.push('-v', `${vol.host}:${vol.container}:${mode}`);
  }

  cmdArgs.push('-e', `JAVA_TOOL_OPTIONS=${config.javaSSLOpts}`);

  for (const [key, value] of Object.entries(env)) {
    cmdArgs.push('-e', `${key}=${value}`);
  }

  cmdArgs.push(image, ...args);

  if (stream) {
    logger.info(`Running: ${runtime} ${cmdArgs.join(' ')}`);
  }

  const execaOptions: execa.Options = stream ? { stdio: 'inherit' } : {};

  try {
    const result = await execa(runtime, cmdArgs, execaOptions);
    return {
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
      stdout: execaError.stdout || '',
      stderr: execaError.stderr || '',
      exitCode: execaError.exitCode ?? 1,
    };
  }
}

export async function validateWorkspace(
  config: Config,
  workspacePath: string
): Promise<boolean> {
  const containerPath = workspacePath.replace(config.projectRoot, '/workspaces');

  const result = await runContainer({
    image: 'structurizr/cli:latest',
    args: ['validate', '-workspace', containerPath],
    volumes: [{ host: config.projectRoot, container: '/workspaces', readonly: true }],
    config,
    stream: true,
  });

  return result.exitCode === 0;
}

export interface PushWorkspaceOptions {
  config: Config;
  workspacePath: string;
  url: string;
  workspaceId: string;
  key: string;
  secret: string;
}

export async function pushWorkspace(
  config: Config,
  workspacePath: string,
  url: string,
  workspaceId: string,
  key: string,
  secret: string
): Promise<boolean> {
  const containerPath = workspacePath.replace(config.projectRoot, '/workspaces');
  const containerUrl = translateUrlForContainer(url);

  logger.info(`Pushing to ${containerUrl}`);
  logger.keyValue('Workspace ID', workspaceId);
  logger.keyValue('Workspace file', containerPath);

  const args = [
    'push',
    '-url',
    containerUrl,
    '-id',
    workspaceId,
    '-key',
    key,
    '-secret',
    secret,
    '-workspace',
    containerPath,
  ];

  const result = await runContainer({
    image: 'structurizr/cli:latest',
    args,
    volumes: [{ host: config.projectRoot, container: '/workspaces', readonly: true }],
    config,
    stream: true,
  });

  return result.exitCode === 0;
}

export async function pushWorkspaceWithOptions(options: PushWorkspaceOptions): Promise<boolean> {
  return pushWorkspace(
    options.config,
    options.workspacePath,
    options.url,
    options.workspaceId,
    options.key,
    options.secret
  );
}
