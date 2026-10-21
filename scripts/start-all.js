import { spawn } from 'node:child_process';
import path from 'node:path';

console.log('🚀 Lancement simultané de SciClub Bot et SciClub Web sur Render...');

// 1. Démarrage du Bot Discord
const botProcess = spawn(process.execPath, [path.resolve('apps/bot/dist/index.js')], {
  stdio: 'inherit',
  env: process.env
});

// 2. Démarrage du Serveur Web & Dashboard
const webProcess = spawn(process.execPath, [path.resolve('apps/web/dist-server/index.js')], {
  stdio: 'inherit',
  env: process.env
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
  console.error(`❌ SciClub Web s'est arrêté avec le code ${code}`);
  handleExit(code || 1);
});
