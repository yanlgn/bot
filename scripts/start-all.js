import { spawn } from 'node:child_process';
import path from 'node:path';

console.log('🚀 Lancement simultané de SciClub Bot et SciClub Web sur Render (avec --experimental-sqlite)...');

// 1. Démarrage du Bot Discord
const botProcess = spawn('node', ['--experimental-sqlite', path.resolve('apps/bot/dist/index.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --experimental-sqlite'
  }
});

// 2. Démarrage du Serveur Web & Dashboard
const webProcess = spawn('node', ['--experimental-sqlite', path.resolve('apps/web/dist-server/index.js')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --experimental-sqlite'
  }
});

const handleExit = (code) => {
  botProcess.kill();
  webProcess.kill();
  process.exit(code || 0);
};

process.on('SIGINT', () => handleExit(0));
process.on('SIGTERM', () => handleExit(0));

botProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ SciClub Bot s'est arrêté avec le code ${code}`);
  }
});

webProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ SciClub Web s'est arrêté avec le code ${code}`);
  }
});
