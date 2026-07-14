#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { toJSONSchema } = require('zod');
const { canonicalContractSchemas } = require('../lib/schemas');

const outputDirectory = resolve(__dirname, '..', 'lib', 'json-schema');
mkdirSync(outputDirectory, { recursive: true });

const index = {};
for (const [name, schema] of Object.entries(canonicalContractSchemas)) {
  const fileName = `${name}.schema.json`;
  const document = {
    ...toJSONSchema(schema),
    $id: `https://schemas.infmonkeys.com/contracts/${fileName}`,
    title: name,
  };
  writeFileSync(resolve(outputDirectory, fileName), `${JSON.stringify(document, null, 2)}\n`);
  index[name] = `./${fileName}`;
}

writeFileSync(
  resolve(outputDirectory, 'index.json'),
  `${JSON.stringify({ version: 1, schemas: index }, null, 2)}\n`,
);

