const fs = require('fs');
const path = require('path');

const voiceRoot = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native-voice',
  'voice',
);

const gradlePath = path.join(voiceRoot, 'android', 'build.gradle');
const srcIndexPath = path.join(voiceRoot, 'src', 'index.ts');
const distIndexPath = path.join(voiceRoot, 'dist', 'index.js');

const patchedGradle = `apply plugin: 'com.android.library'

repositories {
    google()
    mavenCentral()
}

android {
    namespace "com.wenkesj.voice"
    compileSdk rootProject.ext.compileSdkVersion

    defaultConfig {
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
    }

    lint {
        abortOnError false
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
`;

function writeFileIfExists(filePath, contents) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const current = fs.readFileSync(filePath, 'utf8');
  if (current === contents) {
    return;
  }

  fs.writeFileSync(filePath, contents);
}

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let current = fs.readFileSync(filePath, 'utf8');
  let next = current;

  replacements.forEach(([from, to]) => {
    next = next.replace(from, to);
  });

  if (next !== current) {
    fs.writeFileSync(filePath, next);
  }
}

writeFileIfExists(gradlePath, patchedGradle);

patchFile(srcIndexPath, [
  [
    'const Voice = NativeModules.Voice as VoiceModule;',
    'const Voice = (NativeModules.Voice || NativeModules.RCTVoice) as VoiceModule | null;',
  ],
  [
    "const voiceEmitter =\n  Platform.OS !== 'web' ? new NativeEventEmitter(Voice) : null;",
    "const voiceEmitter =\n  Platform.OS !== 'web' && Voice ? new NativeEventEmitter(Voice) : null;",
  ],
  [
    "  removeAllListeners() {\n    Voice.onSpeechStart = undefined;",
    "  removeAllListeners() {\n    if (!Voice) {\n      return;\n    }\n    Voice.onSpeechStart = undefined;",
  ],
  [
    "  destroy() {\n    if (!this._loaded && !this._listeners) {",
    "  destroy() {\n    if (!Voice) {\n      return Promise.resolve();\n    }\n    if (!this._loaded && !this._listeners) {",
  ],
  [
    "  start(locale: any, options = {}) {\n    if (!this._loaded && !this._listeners && voiceEmitter !== null) {",
    "  start(locale: any, options = {}) {\n    if (!Voice) {\n      return Promise.reject(new Error('Voice native module is unavailable'));\n    }\n    if (!this._loaded && !this._listeners && voiceEmitter !== null) {",
  ],
  [
    "  stop() {\n    if (!this._loaded && !this._listeners) {",
    "  stop() {\n    if (!Voice) {\n      return Promise.resolve();\n    }\n    if (!this._loaded && !this._listeners) {",
  ],
  [
    "  cancel() {\n    if (!this._loaded && !this._listeners) {",
    "  cancel() {\n    if (!Voice) {\n      return Promise.resolve();\n    }\n    if (!this._loaded && !this._listeners) {",
  ],
  [
    "  isAvailable(): Promise<0 | 1> {\n    return new Promise((resolve, reject) => {",
    "  isAvailable(): Promise<0 | 1> {\n    if (!Voice) {\n      return Promise.resolve(0);\n    }\n    return new Promise((resolve, reject) => {",
  ],
  [
    "  getSpeechRecognitionServices() {\n    if (Platform.OS !== 'android') {",
    "  getSpeechRecognitionServices() {\n    if (!Voice) {\n      return [];\n    }\n    if (Platform.OS !== 'android') {",
  ],
  [
    "  isRecognizing(): Promise<0 | 1> {\n    return new Promise(resolve => {",
    "  isRecognizing(): Promise<0 | 1> {\n    if (!Voice) {\n      return Promise.resolve(0);\n    }\n    return new Promise(resolve => {",
  ],
]);

patchFile(distIndexPath, [
  [
    'const Voice = react_native_1.NativeModules.Voice;',
    'const Voice = react_native_1.NativeModules.Voice || react_native_1.NativeModules.RCTVoice;',
  ],
  ['const voiceEmitter = react_native_1.Platform.OS !== \'web\' ? new react_native_1.NativeEventEmitter(Voice) : null;', "const voiceEmitter = react_native_1.Platform.OS !== 'web' && Voice ? new react_native_1.NativeEventEmitter(Voice) : null;"],
  [
    '    removeAllListeners() {\n        Voice.onSpeechStart = undefined;',
    '    removeAllListeners() {\n        if (!Voice) {\n            return;\n        }\n        Voice.onSpeechStart = undefined;',
  ],
  [
    '    destroy() {\n        if (!this._loaded && !this._listeners) {',
    '    destroy() {\n        if (!Voice) {\n            return Promise.resolve();\n        }\n        if (!this._loaded && !this._listeners) {',
  ],
  [
    '    start(locale, options = {}) {\n        if (!this._loaded && !this._listeners && voiceEmitter !== null) {',
    "    start(locale, options = {}) {\n        if (!Voice) {\n            return Promise.reject(new Error('Voice native module is unavailable'));\n        }\n        if (!this._loaded && !this._listeners && voiceEmitter !== null) {",
  ],
  [
    '    stop() {\n        if (!this._loaded && !this._listeners) {',
    '    stop() {\n        if (!Voice) {\n            return Promise.resolve();\n        }\n        if (!this._loaded && !this._listeners) {',
  ],
  [
    '    cancel() {\n        if (!this._loaded && !this._listeners) {',
    '    cancel() {\n        if (!Voice) {\n            return Promise.resolve();\n        }\n        if (!this._loaded && !this._listeners) {',
  ],
  [
    '    isAvailable() {\n        return new Promise((resolve, reject) => {',
    '    isAvailable() {\n        if (!Voice) {\n            return Promise.resolve(0);\n        }\n        return new Promise((resolve, reject) => {',
  ],
  [
    '    getSpeechRecognitionServices() {\n        if (react_native_1.Platform.OS !== \'android\') {',
    "    getSpeechRecognitionServices() {\n        if (!Voice) {\n            return [];\n        }\n        if (react_native_1.Platform.OS !== 'android') {",
  ],
  [
    '    isRecognizing() {\n        return new Promise(resolve => {',
    '    isRecognizing() {\n        if (!Voice) {\n            return Promise.resolve(0);\n        }\n        return new Promise(resolve => {',
  ],
]);
