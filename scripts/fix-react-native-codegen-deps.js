const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const targetDir = path.join(nodeModulesDir, 'tinyglobby');

if (fs.existsSync(targetDir)) {
  console.log('[fix-react-native-codegen-deps] tinyglobby already linked');
  process.exit(0);
}

const pnpmStoreDir = path.join(nodeModulesDir, '.pnpm');
const candidates = fs
  .readdirSync(pnpmStoreDir, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && entry.name.startsWith('tinyglobby@'))
  .map(entry =>
    path.join(pnpmStoreDir, entry.name, 'node_modules', 'tinyglobby'),
  )
  .filter(candidate => fs.existsSync(candidate));

if (candidates.length === 0) {
  console.warn('[fix-react-native-codegen-deps] tinyglobby package not found in pnpm store');
  process.exit(0);
}

const sourceDir = candidates[0];
const relativeSource = path.relative(nodeModulesDir, sourceDir);

try {
  fs.symlinkSync(relativeSource, targetDir, 'dir');
  console.log('[fix-react-native-codegen-deps] linked tinyglobby');
} catch (error) {
  console.warn(
    `[fix-react-native-codegen-deps] symlink failed, falling back to copy: ${error.message}`,
  );
  fs.cpSync(sourceDir, targetDir, {recursive: true});
  console.log('[fix-react-native-codegen-deps] copied tinyglobby');
}
