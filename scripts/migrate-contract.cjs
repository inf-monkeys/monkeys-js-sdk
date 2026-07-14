#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { migrateContract } = require('../lib/migrations');

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const kind = readFlag('--kind');
if (!kind) {
  throw new Error('Usage: monkeys-contract-migrate --kind <kind> [--input file] [--output file] [--options json]');
}

const inputPath = readFlag('--input');
const outputPath = readFlag('--output');
const rawInput = inputPath
  ? readFileSync(resolve(process.cwd(), inputPath), 'utf8')
  : readFileSync(0, 'utf8');
const options = JSON.parse(readFlag('--options') || '{}');
const result = `${JSON.stringify(migrateContract(kind, JSON.parse(rawInput), options), null, 2)}\n`;

if (outputPath) {
  writeFileSync(resolve(process.cwd(), outputPath), result);
} else {
  process.stdout.write(result);
}

