import { spawn } from 'node:child_process';

// Runs one of the site's own commands the way a person or CI would, from site/, and keeps what it
// said, so a scenario can hold a failure to naming its cause. Asynchronous on purpose: a stand-in
// server the scenario started lives in this same process, and a synchronous spawn would block it
// from answering the very command waiting on it.
export function run(command: string, args: string[], env: Record<string, string> = {}) {
  return new Promise<{ status: number; output: string }>((resolve) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...env } });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    child.on('close', (code) => resolve({ status: code ?? -1, output }));
  });
}
