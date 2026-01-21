import chalk from 'chalk';

export const logger = {
  info: (message: string): void => {
    console.log(chalk.green('[INFO]'), message);
  },

  warn: (message: string): void => {
    console.log(chalk.yellow('[WARN]'), message);
  },

  error: (message: string): void => {
    console.log(chalk.red('[ERROR]'), message);
  },

  success: (message: string): void => {
    console.log(chalk.green('✓'), message);
  },

  /**
   * Display a step with optional progress indicator
   * Usage: step('message') or step(1, 4, 'message')
   */
  step: (messageOrCurrent: string | number, total?: number, message?: string): void => {
    if (typeof messageOrCurrent === 'number' && total !== undefined && message !== undefined) {
      console.log(chalk.blue(`[${messageOrCurrent}/${total}]`), message);
    } else {
      console.log(chalk.blue('[STEP]'), messageOrCurrent);
    }
  },

  command: (cmd: string): void => {
    console.log(chalk.gray('  $'), chalk.cyan(cmd));
  },

  header: (title: string): void => {
    console.log('');
    console.log('========================================');
    console.log(title);
    console.log('========================================');
    console.log('');
  },

  subheader: (title: string): void => {
    console.log('');
    console.log('----------------------------------------');
    console.log(title);
    console.log('----------------------------------------');
  },

  blank: (): void => {
    console.log('');
  },

  list: (items: string[], indent = '  '): void => {
    items.forEach((item) => {
      console.log(`${indent}- ${item}`);
    });
  },

  keyValue: (key: string, value: string): void => {
    console.log(`${chalk.cyan(key + ':')} ${value}`);
  },
};
