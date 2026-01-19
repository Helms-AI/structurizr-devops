import { Command } from 'commander';
import ora from 'ora';
import * as readline from 'readline';
import { logger } from '../lib/logger';
import * as git from '../lib/git';

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export function registerQuarterRolloverCommand(program: Command): void {
  program
    .command('quarter:rollover <from> <to>')
    .description('Manage quarterly git branch transitions')
    .action(async (from: string, to: string) => {
      logger.header('Quarterly Rollover');

      if (!git.validateQuarterFormat(from)) {
        logger.error(`Invalid previous quarter format: ${from} (expected: qN-YYYY)`);
        process.exit(1);
      }

      if (!git.validateQuarterFormat(to)) {
        logger.error(`Invalid new quarter format: ${to} (expected: qN-YYYY)`);
        process.exit(1);
      }

      const prevRelease = `release/${from}`;
      const newRelease = `release/${to}`;
      const planningBranch = `planning/${to}`;
      const tagName = `${from}-final`;

      logger.info('Performing pre-flight checks...');

      if (!(await git.isGitRepository())) {
        logger.error('Not in a git repository');
        process.exit(1);
      }

      if (await git.hasUncommittedChanges()) {
        logger.error('You have uncommitted changes. Please commit or stash them first.');
        process.exit(1);
      }

      const spinner = ora('Fetching latest from origin...').start();
      try {
        await git.fetchOrigin();
        spinner.succeed('Fetched latest from origin');
      } catch (error) {
        spinner.fail('Failed to fetch from origin');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      if (!(await git.remoteBranchExists(prevRelease))) {
        logger.error(`Previous quarter release branch does not exist: ${prevRelease}`);
        process.exit(1);
      }

      if (await git.remoteBranchExists(newRelease)) {
        logger.error(`New quarter release branch already exists: ${newRelease}`);
        process.exit(1);
      }

      logger.success('Pre-flight checks passed');
      logger.blank();

      // Step 1: Tag previous quarter
      logger.info(`Step 1: Creating final tag for ${from}`);

      if (await git.tagExists(tagName)) {
        logger.warn(`Tag ${tagName} already exists, skipping tag creation`);
      } else {
        try {
          await git.checkout(prevRelease);
          await git.pull('origin', prevRelease);
          await git.createTag(tagName, `Final quarterly snapshot: ${from}`);
          logger.success(`Created tag: ${tagName}`);
        } catch (error) {
          logger.error(`Failed to create tag: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      }

      logger.blank();

      // Step 2: Merge to main
      logger.info(`Step 2: Merging ${prevRelease} to main`);

      try {
        await git.checkout('main');
        await git.pull('origin', 'main');
        await git.merge(prevRelease, `Merge ${from} release to main`);
        logger.success(`Merged ${prevRelease} to main`);
      } catch (error) {
        logger.error(`Failed to merge: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }

      logger.blank();

      // Step 3: Create new quarter release branch
      logger.info(`Step 3: Creating release branch for ${to}`);

      try {
        await git.checkoutNewBranch(newRelease);
        logger.success(`Created branch: ${newRelease}`);
      } catch (error) {
        logger.error(`Failed to create branch: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }

      logger.blank();

      // Step 4: Merge planning branch if exists
      logger.info('Step 4: Checking for planning branch...');

      if (await git.remoteBranchExists(planningBranch)) {
        logger.info(`Found planning branch: ${planningBranch}`);
        try {
          await git.merge(`origin/${planningBranch}`, `Merge ${to} planning into release`);
          logger.success('Merged planning branch');
        } catch (error) {
          logger.warn(`Failed to merge planning branch: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        logger.info(`No planning branch found: ${planningBranch} (skipping)`);
      }

      logger.blank();

      // Push changes
      logger.info('Pushing changes to origin...');

      const answer = await askQuestion('Ready to push changes to origin? (y/N) ');

      if (answer === 'y' || answer === 'yes') {
        try {
          await git.pushTag(tagName).catch(() => {
            logger.warn(`Tag ${tagName} may already exist on remote`);
          });
          await git.checkout('main');
          await git.pushBranch('main');
          await git.checkout(newRelease);
          await git.pushBranch(newRelease, true);
          logger.success('All changes pushed to origin');
        } catch (error) {
          logger.error(`Failed to push: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      } else {
        logger.warn(`Changes not pushed. You are on branch: ${newRelease}`);
        logger.blank();
        console.log('To push manually, run:');
        console.log(`  git push origin ${tagName}`);
        console.log('  git push origin main');
        console.log(`  git push -u origin ${newRelease}`);
      }

      logger.blank();
      logger.header('Quarterly Rollover Complete');

      console.log(`Previous Quarter: ${from}
  - Tag created:    ${tagName}
  - Merged to:      main

New Quarter: ${to}
  - Release branch: ${newRelease}
  - You are now on: ${await git.getCurrentBranch()}

Next Steps:
  1. Run 'Quarterly Snapshot' workflow to create Structurizr branches
  2. Continue development on ${newRelease}
`);
    });
}
