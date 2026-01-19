import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import type { Config } from '../types';

/**
 * Get the path to the .env file
 */
export function getEnvFilePath(config: Config): string {
  return path.join(config.rootDir, 'containers', '.env');
}

/**
 * Parse a .env file into a key-value object
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!fs.existsSync(filePath)) {
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=value
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Write a key-value object to a .env file, preserving comments and order
 */
export function writeEnvFile(filePath: string, values: Record<string, string>): void {
  const lines: string[] = [];
  const writtenKeys = new Set<string>();

  // If file exists, preserve comments and update existing values
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const existingLines = content.split('\n');

    for (const line of existingLines) {
      const trimmed = line.trim();

      // Preserve empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        lines.push(line);
        continue;
      }

      // Parse existing key
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        lines.push(line);
        continue;
      }

      const key = trimmed.substring(0, equalIndex).trim();

      if (key in values) {
        // Update with new value
        lines.push(`${key}=${values[key]}`);
        writtenKeys.add(key);
      } else {
        // Preserve existing line
        lines.push(line);
        writtenKeys.add(key);
      }
    }
  }

  // Add any new keys that weren't in the original file
  for (const [key, value] of Object.entries(values)) {
    if (!writtenKeys.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, lines.join('\n'));
}

/**
 * Get a value from the .env file
 */
export function getEnvValue(config: Config, key: string): string | undefined {
  const filePath = getEnvFilePath(config);
  const values = parseEnvFile(filePath);
  return values[key];
}

/**
 * Set a value in the .env file
 */
export function setEnvValue(config: Config, key: string, value: string): boolean {
  try {
    const filePath = getEnvFilePath(config);
    const values = parseEnvFile(filePath);
    values[key] = value;
    writeEnvFile(filePath, values);
    return true;
  } catch (error) {
    logger.error(`Failed to set .env value: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * List all values from the .env file
 */
export function listEnvValues(config: Config): Array<{ name: string; value: string }> {
  const filePath = getEnvFilePath(config);
  const values = parseEnvFile(filePath);
  return Object.entries(values).map(([name, value]) => ({ name, value }));
}

/**
 * Delete a value from the .env file
 */
export function deleteEnvValue(config: Config, key: string): boolean {
  try {
    const filePath = getEnvFilePath(config);

    if (!fs.existsSync(filePath)) {
      return true;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const newLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Preserve empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      // Check if this line has the key we want to delete
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        newLines.push(line);
        continue;
      }

      const lineKey = trimmed.substring(0, equalIndex).trim();
      if (lineKey !== key) {
        newLines.push(line);
      }
    }

    fs.writeFileSync(filePath, newLines.join('\n'));
    return true;
  } catch (error) {
    logger.error(`Failed to delete .env value: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Check if .env file exists
 */
export function envFileExists(config: Config): boolean {
  return fs.existsSync(getEnvFilePath(config));
}
