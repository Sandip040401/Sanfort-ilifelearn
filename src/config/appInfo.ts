const appJson = require('../../app.json');
const packageJson = require('../../package.json');

export const APP_NAME = String(appJson.displayName || appJson.name || 'App');
export const APP_VERSION = String(packageJson.version || '0.0.0');
