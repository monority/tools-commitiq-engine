import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const distScripts = join(dist, 'scripts');
mkdirSync(distScripts, { recursive: true });
copyFileSync(join(root, 'scripts', 'quality-staged.js'), join(distScripts, 'quality-staged.js'));
const cli = `#!/usr/bin/env node
import { run } from './scripts/quality-staged.js';
const cmd = process.argv[2] || 'staged';
if (cmd === 'staged') await run();
else if (cmd === 'init') console.log('init hook generator here');
else { console.error('Unknown command:', cmd); process.exit(1); }
`;
writeFileSync(join(dist, 'cli.js'), cli);
writeFileSync(join(dist, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));