#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { execa } from 'execa';

if (!existsSync('.git')) {
  process.exit(0);
}

try {
  await execa('git', ['--version']);
} catch {
  console.warn('Skipping husky install because git is not available.');
  process.exit(0);
}

await execa('husky', [], {
  stdio: 'inherit',
});
