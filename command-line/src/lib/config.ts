import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as yaml from 'yaml';
import type { Config, DomainCredentials, EnvironmentCredentials, DomainsRegistry, Environment } from '../types';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, 'workspaces')) &&
      fs.existsSync(path.join(dir, 'containers'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function getCurrentQuarter(projectRoot: string): string {
  const domainsYamlPath = path.join(projectRoot, 'workspaces', 'shared', 'domains.yaml');
  if (fs.existsSync(domainsYamlPath)) {
    try {
      const content = fs.readFileSync(domainsYamlPath, 'utf-8');
      const registry = yaml.parse(content) as DomainsRegistry;
      if (registry.current_quarter) {
        return registry.current_quarter;
      }
    } catch {
      // Fall through to default
    }
  }
  return 'current';
}

export function loadConfig(): Config {
  const projectRoot = findProjectRoot();
  const envFile = path.join(projectRoot, 'containers', '.env');

  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }

  const currentQuarter = getCurrentQuarter(projectRoot);

  return {
    rootDir: projectRoot,
    projectRoot,
    workspacesDir: path.join(projectRoot, 'workspaces'),
    currentDir: path.join(projectRoot, 'workspaces', 'current'),
    sharedDir: path.join(projectRoot, 'workspaces', 'shared'),
    containersDir: path.join(projectRoot, 'containers'),
    envFile,
    structurizrUrl: process.env.STRUCTURIZR_URL || 'http://localhost:20000/api',
    structurizrUrlInt: process.env.STRUCTURIZR_URL_INT || process.env.STRUCTURIZR_URL || 'http://localhost:20000/api',
    structurizrUrlProd: process.env.STRUCTURIZR_URL_PROD || process.env.STRUCTURIZR_URL || '',
    adminApiKey: process.env.STRUCTURIZR_ADMIN_API_KEY || '',
    javaSSLOpts:
      '-Dcom.sun.net.ssl.checkRevocation=false -Djsse.enableSNIExtension=true -Dhttps.protocols=TLSv1.2,TLSv1.3 -Djdk.tls.client.protocols=TLSv1.2,TLSv1.3',
    currentQuarter,
  };
}

export function getDomainCredentials(domain: string, environment?: Environment): DomainCredentials {
  const domainUpper = domain.toUpperCase().replace(/-/g, '_');
  const envSuffix = environment ? `_${environment.toUpperCase().replace('INTEGRATION', 'INT')}` : '';

  return {
    workspaceId:
      process.env[`STRUCTURIZR_${domainUpper}_WORKSPACE_ID`] ||
      process.env.STRUCTURIZR_WORKSPACE_ID ||
      '',
    workspaceKey:
      process.env[`STRUCTURIZR_${domainUpper}_WORKSPACE_KEY${envSuffix}`] ||
      process.env[`STRUCTURIZR_${domainUpper}_WORKSPACE_KEY`] ||
      process.env.STRUCTURIZR_WORKSPACE_KEY ||
      '',
    workspaceSecret:
      process.env[`STRUCTURIZR_${domainUpper}_WORKSPACE_SECRET${envSuffix}`] ||
      process.env[`STRUCTURIZR_${domainUpper}_WORKSPACE_SECRET`] ||
      process.env.STRUCTURIZR_WORKSPACE_SECRET ||
      '',
  };
}

export function getEnvironmentCredentials(
  domain: string,
  environment: Environment,
  config: Config
): EnvironmentCredentials {
  const creds = getDomainCredentials(domain, environment);
  const url = environment === 'Production' ? config.structurizrUrlProd : config.structurizrUrlInt;

  return {
    url,
    ...creds,
  };
}

export function appendToEnvFile(
  envFile: string,
  entries: Record<string, string>,
  comment?: string
): void {
  let content = '\n';
  if (comment) {
    content += `# ${comment}\n`;
  }
  for (const [key, value] of Object.entries(entries)) {
    content += `${key}=${value}\n`;
  }
  fs.appendFileSync(envFile, content);
}
