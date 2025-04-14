// esbuild.js
const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src/extension.ts"], // adjust if your entry point differs
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "out/extension.js",
  external: ["vscode"], // vscode is provided by the editor
  sourcemap: true,
  minify: true,
}).catch(() => process.exit(1));
