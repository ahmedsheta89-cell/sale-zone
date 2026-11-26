// Launches Firebase Auth & Firestore Emulators (`demo-sale-zone-e2e`) and runs real emulator suites.
// Usage: node tools/run-emulator-suite.js [--only-rules | --only-e2e]

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveJavaEnv(baseEnv) {
  const env = { ...baseEnv };
  const probe = spawnSync('java', ['-version'], { env, stdio: 'ignore', shell: process.platform === 'win32' });
  if (probe.status === 0) return env;

  const candidates = [
    env.JAVA_HOME,
    'E:\\Programs\\تثبيت اندوريد استديو\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21',
    'C:\\Program Files\\Java\\jdk-21'
  ].filter(Boolean);

  for (const dir of candidates) {
    const javaBin = path.join(dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (fs.existsSync(javaBin)) {
      env.JAVA_HOME = dir;
      env.PATH = `${path.join(dir, 'bin')}${path.delimiter}${env.PATH || ''}`;
      return env;
    }
  }

  console.error('Java runtime (JDK 21+) not found on PATH or JAVA_HOME; required by Firebase Emulators.');
  process.exit(1);
}

function resolveFirebaseCli(env) {
  const globalProbe = spawnSync('firebase', ['--version'], { env, stdio: 'ignore', shell: process.platform === 'win32' });
  if (globalProbe.status === 0) {
    return { bin: 'firebase', prefixArgs: [] };
  }
  const npxProbe = spawnSync('npx', ['--no-install', 'firebase', '--version'], { env, stdio: 'ignore', shell: process.platform === 'win32' });
  if (npxProbe.status === 0) {
    return { bin: 'npx', prefixArgs: ['--no-install', 'firebase'] };
  }
  console.error('firebase-tools CLI is not available. Install firebase-tools globally or in PATH.');
  process.exit(1);
}

const env = resolveJavaEnv(process.env);
const cli = resolveFirebaseCli(env);
const onlyRules = process.argv.includes('--only-rules');
const onlyE2e = process.argv.includes('--only-e2e');

const innerFlags = [];
if (onlyRules) innerFlags.push('--only-rules');
if (onlyE2e) innerFlags.push('--only-e2e');

const innerCmd = ['node', 'tools/run-emulator-inner.js', ...innerFlags].join(' ');
const emulators = onlyRules ? 'firestore' : 'auth,firestore';
const onlyArg = process.platform === 'win32' ? `"--only=${emulators}"` : `--only=${emulators}`;
const innerArg = process.platform === 'win32' ? `"${innerCmd}"` : innerCmd;

const result = spawnSync(
  cli.bin,
  [
    ...cli.prefixArgs,
    'emulators:exec',
    onlyArg,
    '--project',
    'demo-sale-zone-e2e',
    '--config',
    'firebase.json',
    innerArg
  ],
  {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

process.exit(result.status === null ? 1 : result.status);
