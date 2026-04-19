const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Required for @tanstack/react-query v5 (and other modern ESM packages) to
// resolve correctly. These libraries rely on the `exports` field in their
// package.json to pick the right build artefact per-platform. Without this
// flag Metro attempts to resolve `./retryer.js` literally and fails.
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: './global.css' });
