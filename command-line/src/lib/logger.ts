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

  step: (message: string): void => {
    console.log(chalk.blue('[STEP]'), message);
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
