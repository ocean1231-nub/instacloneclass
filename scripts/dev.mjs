import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(path.join(root, 'backend', '.env'))) {
  console.error('backend/.env.example을 backend/.env로 복사하고 Supabase 정보를 입력해 주세요.');
  process.exit(1);
}
if (!existsSync(path.join(root, 'frontend', 'node_modules', 'vite'))) {
  console.log('화면 의존성을 설치합니다...');
  const npmCli = process.env.npm_execpath;
  const install = npmCli
    ? spawnSync(process.execPath, [npmCli, '--prefix', 'frontend', 'install'], { cwd: root, stdio: 'inherit', windowsHide: true })
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', 'frontend', 'install'], { cwd: root, stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32' });
  if (install.status !== 0) process.exit(install.status || 1);
}
const localUv = path.join(root, '.tools', 'bin', process.platform === 'win32' ? 'uv.exe' : 'uv');
const backend = spawn(existsSync(localUv) ? localUv : 'uv', ['run', '--project', 'backend', 'python', '-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000'], { cwd: root, stdio: 'inherit', windowsHide: true });
const vite = spawn(process.execPath, [path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0'], { cwd: path.join(root, 'frontend'), stdio: 'inherit', windowsHide: true });
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of [backend, vite]) if (child.pid && !child.killed) child.kill();
  process.exitCode = code;
}
for (const child of [backend, vite]) {
  child.on('error', error => { console.error(`실행 실패: ${error.message}. uv와 Node.js 설치를 확인해 주세요.`); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
