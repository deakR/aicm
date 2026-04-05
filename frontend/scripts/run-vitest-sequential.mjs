import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, 'src');

function collectTestFiles(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }
    if (/\.test\.(js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

const testFiles = collectTestFiles(sourceRoot);

if (testFiles.length === 0) {
  console.log('No Vitest files found.');
  process.exit(0);
}

for (const file of testFiles) {
  const relativePath = relative(projectRoot, file);
  console.log(`\n[vitest] ${relativePath}`);

  const result = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=4096',
      './node_modules/vitest/vitest.mjs',
      'run',
      relativePath,
    ],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll frontend unit tests passed.');
