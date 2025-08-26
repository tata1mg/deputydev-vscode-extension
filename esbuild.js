const esbuild = require('esbuild');
require('dotenv').config();

esbuild
  .build({
    entryPoints: ['src/extension.ts'], // adjust if your entry point differs
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'out/extension.js',
    external: ['vscode'], // vscode is provided by the editor
    sourcemap: true,
    minify: true,
    define: {
      'process.env.DD_HOST': JSON.stringify(process.env.DD_HOST || 'http://localhost:8084'),
      'process.env.ENABLE_OUTPUT_CHANNEL': JSON.stringify(process.env.ENABLE_OUTPUT_CHANNEL || 'false'),
      'process.env.USE_LOCAL_BINARY': JSON.stringify(process.env.USE_LOCAL_BINARY || 'false'),
      'process.env.LOCAL_BINARY_PORT': JSON.stringify(process.env.LOCAL_BINARY_PORT || '8001'),
    },
  })
  .catch(() => process.exit(1));
