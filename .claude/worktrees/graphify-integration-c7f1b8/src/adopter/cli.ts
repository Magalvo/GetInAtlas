#!/usr/bin/env node
import { runAdopterCli } from './command.js';

process.exitCode = await runAdopterCli(process.argv.slice(2), {
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value),
});
