#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const MARKER = '## Commit Entries';

const parseArgs = (argv) => {
  const args = argv.slice(2);

  let dryRun = false;
  let subject;
  let hash = 'pending';
  let date = new Date().toISOString().slice(0, 10);
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--subject') {
      subject = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--subject=')) {
      subject = arg.slice('--subject='.length);
      continue;
    }

    if (arg === '--hash') {
      hash = args[index + 1] ?? hash;
      index += 1;
      continue;
    }

    if (arg.startsWith('--hash=')) {
      hash = arg.slice('--hash='.length) || hash;
      continue;
    }

    if (arg === '--date') {
      date = args[index + 1] ?? date;
      index += 1;
      continue;
    }

    if (arg.startsWith('--date=')) {
      date = arg.slice('--date='.length) || date;
      continue;
    }

    positional.push(arg);
  }

  if (!subject && positional.length > 0) {
    subject = positional.join(' ');
  }

  return {
    dryRun,
    hash,
    date,
    subject: subject || 'chore: describe this commit',
  };
};

const ensureDateFormat = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid --date value "${date}". Use YYYY-MM-DD.`);
  }
};

const buildEntry = ({ date, hash, subject }) => `### [${date}] ${hash} ${subject}
- Implemented:
  - TODO
- Affected areas:
  - TODO
- Notes:
  - TODO

`;

const insertEntry = (content, entry) => {
  const markerWithBlankLine = `${MARKER}\n\n`;
  const markerWithSingleLine = `${MARKER}\n`;

  if (content.includes(markerWithBlankLine)) {
    return content.replace(markerWithBlankLine, `${markerWithBlankLine}${entry}`);
  }

  if (content.includes(markerWithSingleLine)) {
    return content.replace(markerWithSingleLine, `${markerWithSingleLine}\n${entry}`);
  }

  throw new Error(`Marker "${MARKER}" was not found in tracker file.`);
};

const ensureNoTopPendingEntry = (content) => {
  const markerIndex = content.indexOf(MARKER);
  if (markerIndex === -1) {
    return;
  }

  const afterMarker = content.slice(markerIndex + MARKER.length);
  const firstEntryMatch = afterMarker.match(/### \[[^\]]+\] [^\n]+/);

  if (firstEntryMatch && firstEntryMatch[0].includes(' pending ')) {
    throw new Error(
      'Top tracker entry already has a pending hash. Finalize it before generating another entry.'
    );
  }
};

const main = async () => {
  const options = parseArgs(process.argv);
  ensureDateFormat(options.date);

  const repoRoot = process.cwd();
  const trackerPath = path.resolve(repoRoot, 'docs', 'IMPLEMENTATION_TRACKER.md');
  const trackerContent = await fs.readFile(trackerPath, 'utf8');

  ensureNoTopPendingEntry(trackerContent);

  const entry = buildEntry(options);
  const updated = insertEntry(trackerContent, entry);

  if (options.dryRun) {
    process.stdout.write(`Dry run: no files changed.\n\n${entry}`);
    return;
  }

  await fs.writeFile(trackerPath, updated, 'utf8');
  process.stdout.write(`Added tracker entry skeleton to ${trackerPath}\n`);
};

main().catch((error) => {
  process.stderr.write(`Failed to generate tracker entry: ${String(error.message ?? error)}\n`);
  process.exitCode = 1;
});
