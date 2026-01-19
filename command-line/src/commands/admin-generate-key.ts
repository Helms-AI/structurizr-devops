import { Command } from 'commander';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { logger } from '../lib/logger';

function generateRandomKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateBcryptHash(key: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(key, salt);
}

export function registerAdminGenerateKeyCommand(program: Command): void {
  program
    .command('admin:generate-key')
    .description('Generate bcrypt API key for Admin API')
    .argument('[key]', 'Plaintext key to hash (generates random if not provided)')
    .action(async (providedKey?: string) => {
      logger.header('Structurizr Admin API Key Generator');

      let plaintextKey: string;

      if (providedKey) {
        logger.info('Using provided key...');
        plaintextKey = providedKey;
      } else {
        logger.info('Generating secure random key...');
        plaintextKey = generateRandomKey();
      }

      logger.blank();
      logger.info('Generating bcrypt hash...');

      const bcryptHash = generateBcryptHash(plaintextKey);

      logger.blank();
      logger.header('KEY GENERATED SUCCESSFULLY');

      logger.info('Plaintext Key (keep secret!):');
      console.log(plaintextKey);
      logger.blank();

      logger.info('Bcrypt Hash (for structurizr.properties):');
      console.log(bcryptHash);
      logger.blank();

      logger.header('CONFIGURATION');

      console.log(`1. Add to structurizr.properties:
   structurizr.apiKey=${bcryptHash}

2. Set environment variable:
   export STRUCTURIZR_ADMIN_API_KEY=${plaintextKey}

3. Use in API calls:
   curl -H 'X-Authorization: ${plaintextKey}' http://localhost:20000/api/workspace
`);
    });
}
