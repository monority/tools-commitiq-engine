import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const entry of ['scripts', 'src', 'README.md', 'LICENSE', 'cq', 'cqc']) {
    const source = join(root, entry);
    if (!existsSync(source)) {
        continue;
    }

    cpSync(source, join(dist, entry), { recursive: true });
}

const distPackage = {
    name: rootPackage.name,
    version: rootPackage.version,
    description: rootPackage.description,
    type: rootPackage.type,
    main: rootPackage.main,
    bin: rootPackage.bin,
    exports: rootPackage.exports,
    files: rootPackage.files,
    scripts: {
        prepare: rootPackage.scripts?.prepare,
    },
    publishConfig: rootPackage.publishConfig,
    keywords: rootPackage.keywords,
    author: rootPackage.author,
    license: rootPackage.license,
    dependencies: Object.fromEntries(
        Object.entries(rootPackage.dependencies || {}).filter(([name]) => name !== rootPackage.name),
    ),
    engines: rootPackage.engines,
};

writeFileSync(join(dist, 'package.json'), `${JSON.stringify(distPackage, null, 2)}\n`);
