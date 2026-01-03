#!/usr/bin/env bun

/**
 * bun list
 *
 * Fetches all ungraded assignments from the API and displays a summary.
 * Saves the full response to grading-batch.json for use by other commands.
 */

import { writeFile } from 'fs/promises';
import { loadConfig, getBatchFilePath } from './config.js';
import { apiGet } from './api.js';

// Parse command line flags
const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
};

async function fetchUngradedBatch() {
  const config = loadConfig();

  if (flags.verbose) {
    console.log(`🔍 Fetching from: ${config.apiUrl}/api/grading/getUngradedBatch`);
  }

  return apiGet('/api/grading/getUngradedBatch');
}

function displaySummary(data) {
  console.log('\n📋 Ungraded Assignments Batch\n');
  console.log('═'.repeat(70));

  if (!data || !data.data || data.data.length === 0) {
    console.log('✓ No ungraded assignments found');
    return;
  }

  const assignments = data.data;
  let totalUngraded = 0;
  let totalGraded = 0;

  assignments.forEach((assignment) => {
    const ungraded = assignment.submissions.filter(s => !s.isGraded).length;
    const graded = assignment.submissions.filter(s => s.isGraded).length;

    totalUngraded += ungraded;
    totalGraded += graded;

    console.log(`\n📝 Assignment #${assignment.assignmentId}: ${assignment.assignmentName}`);
    console.log(`   Ungraded: ${ungraded} | Graded: ${graded} (total: ${assignment.submissions.length})`);

    if (flags.verbose) {
      console.log(`   Linked: ${assignment.assignmentLinkedId || 'none'}`);
      console.log(`   Criteria: ${assignment.criteria.length}`);
    }
  });

  console.log('\n' + '─'.repeat(70));
  console.log(`📊 Total: ${totalUngraded} ungraded, ${totalGraded} graded (${totalUngraded + totalGraded} total)`);
  console.log('═'.repeat(70) + '\n');
}

async function main() {
  try {
    console.log('🚀 Fetching ungraded assignments batch...');

    const data = await fetchUngradedBatch();
    const outputFile = getBatchFilePath();

    if (!flags.dryRun) {
      await writeFile(outputFile, JSON.stringify(data, null, 2));
      if (flags.verbose) {
        console.log(`✓ Saved to: ${outputFile}`);
      }
    } else {
      console.log('🔍 DRY RUN: Would save to', outputFile);
    }

    displaySummary(data);

    if (!flags.dryRun) {
      console.log(`💾 Batch data saved to: grading-batch.json`);
      console.log(`\nNext steps:`);
      console.log(`  bun clone         # Clone all repositories`);
      console.log(`  bun plagiarism    # Check for plagiarism`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (flags.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Only run if executed directly (not imported as module)
if (import.meta.main) {
  main();
}
