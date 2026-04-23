
#!/usr/bin / env node
import { run } from './quality-staged.js';
const cmd = process.argv[2];
if (cmd === 'staged') {
  await run();
} else if (cmd === 'init') {
  console.log('🚀 Initializing git-quality hooks...');
  await import('child_process').then(cp => cp.execSync('pnpm exec husky init', { stdio: 'inherit' }));
  await import('fs/promises').then(fs => fs.writeFile('.husky/pre-commit', '#!/usr/bin/env sh\n\npnpm git-quality staged'));
  console.log('✅ Hooks installed!');
} else {
  console.error('Commands: staged | init');
  process.exit(1);
}
