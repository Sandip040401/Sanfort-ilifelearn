const fs = require('fs');
const path = require('path');

const orientationPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-orientation-locker',
  'iOS',
  'RCTOrientation',
  'Orientation.m',
);

const initHook = '        [self addListener:@"orientationDidChange"];\n';
const deallocHook = '    [self removeListeners:1];\n';

try {
  if (!fs.existsSync(orientationPath)) {
    console.log('[fix-react-native-orientation-locker-ios] file not found:', orientationPath);
    process.exit(0);
  }

  const source = fs.readFileSync(orientationPath, 'utf8');
  let next = source;

  if (next.includes(initHook)) {
    next = next.replace(initHook, '');
  }

  if (next.includes(deallocHook)) {
    next = next.replace(deallocHook, '');
  }

  if (next !== source) {
    fs.writeFileSync(orientationPath, next, 'utf8');
    console.log('[fix-react-native-orientation-locker-ios] patched Orientation.m');
  } else {
    console.log('[fix-react-native-orientation-locker-ios] already patched or target not found');
  }
} catch (err) {
  console.error('[fix-react-native-orientation-locker-ios] failed:', err);
  process.exit(0);
}
