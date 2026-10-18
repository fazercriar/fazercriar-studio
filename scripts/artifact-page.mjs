// Gera dist/fazercriar-studio.html: a página publicada no claude.ai (Artifact).
// O Artifact recebe só o conteúdo (sem <html>/<head>/<body>) e os arquivos de dist/assets ao lado.

import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0].replace(/\s+crossorigin/g, ''));

const page = [
  '<title>FazerCriar Studio</title>',
  ...pick(/<link rel="stylesheet"[^>]*>/g),
  ...pick(/<link rel="modulepreload"[^>]*>/g),
  '<div id="root"></div>',
  ...pick(/<script type="module"[^>]*><\/script>/g),
  '',
].join('\n');

fs.writeFileSync('dist/fazercriar-studio.html', page);
const files = fs.readdirSync('dist/assets').map((f) => `assets/${f}`);
fs.writeFileSync('dist/artifact-files.json', JSON.stringify(files, null, 2));
console.log(`Página do Artifact: dist/fazercriar-studio.html (${files.length} arquivos em assets/)`);
