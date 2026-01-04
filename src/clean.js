#!/usr/bin/env bun

/**
 * bun clean
 *
 * Removes all temporary student code related files:
 * - student-grading/     (cloned repositories and assignment data)
 * - plagiarism-reports/  (plagiarism analysis reports)
 * - grading-batch.json   (cached batch data)
 */

import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { getWorkDir, getPlagiarismReportsDir, getBatchFilePath } from './config.js';

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose') || args.includes('-v'),
};

async function removeIfExists(path, label) {
  if (!existsSync(path)) {
    if (flags.verbose) {
      console.log(`⏭️  Skipped: ${label} (not found)`);
    }
    return false;
  }

  if (flags.dryRun) {
    console.log(`🔍 Would remove: ${path}`);
    return true;
  }

  await rm(path, { recursive: true, force: true });
  console.log(`🗑️  Removed: ${label}`);
  return true;
}

async function main() {
  if (flags.dryRun) {
    console.log('🔍 DRY RUN: No files will be deleted\n');
  }

  console.log('🧹 Cleaning temporary student files...\n');

  let removed = 0;

  if (await removeIfExists(getWorkDir(), 'student-grading/')) removed++;
  if (await removeIfExists(getPlagiarismReportsDir(), 'plagiarism-reports/')) removed++;
  if (await removeIfExists(getBatchFilePath(), 'grading-batch.json')) removed++;

  console.log();
  if (removed === 0) {
    console.log('✓ Nothing to clean');
  } else if (flags.dryRun) {
    console.log(`Would remove ${removed} item(s)`);
  } else {
    console.log(`✓ Cleaned ${removed} item(s)`);
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
