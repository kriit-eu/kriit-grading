#!/usr/bin/env bun

/**
 * bun list
 *
 * Fetches all ungraded assignments from the API and displays a summary.
 * Saves the full response to grading-batch.json for use by other commands.
 */

import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, getBatchFilePath } from './config.js';
import { apiGet } from './api.js';
import { notify } from './lib/notify.js';
import { transformAssignmentsForNotification } from './lib/transformAssignments.js';

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
    await notify('list:start');
    console.log('🚀 Fetching ungraded assignments batch...');

    let data = await fetchUngradedBatch();
    const outputFile = getBatchFilePath();
    let assignments = data?.data || [];
    let usingLocalFallback = false;

    if (assignments.length === 0) {
      // Check if we have an existing non-empty grading-batch.json
      try {
        if (existsSync(outputFile)) {
          const content = await readFile(outputFile, 'utf8');
          const localData = JSON.parse(content);
          if (localData && localData.data && localData.data.length > 0) {
            data = localData;
            assignments = localData.data;
            usingLocalFallback = true;
          }
        }
      } catch (e) {
        // Ignore fallback error, stick with empty
      }
    }

    if (!flags.dryRun) {
      if (!usingLocalFallback) {
        await writeFile(outputFile, JSON.stringify(data, null, 2));
        if (flags.verbose) {
          console.log(`✓ Saved to: ${outputFile}`);
        }
      } else {
        console.log(`💡 API returned 0 ungraded assignments. Preserved existing local grading-batch.json with ${assignments.length} assignments.`);
      }
    } else {
      if (usingLocalFallback) {
        console.log(`🔍 DRY RUN: API returned 0 ungraded assignments. Would preserve existing local grading-batch.json with ${assignments.length} assignments.`);
      } else {
        console.log('🔍 DRY RUN: Would save to', outputFile);
      }
    }

    displaySummary(data);

    // Calculate totals for notification
    const totalSubmissions = assignments.reduce((sum, a) => sum + a.submissions.length, 0);
    const totalUngraded = assignments.reduce((sum, a) => sum + a.submissions.filter(s => !s.isGraded).length, 0);

    await notify('list:complete', {
      totalAssignments: assignments.length,
      totalSubmissions,
      totalUngraded,
      assignments: transformAssignmentsForNotification(assignments)
    });

    if (!flags.dryRun) {
      if (usingLocalFallback) {
        console.log(`💾 Preserved local batch data with: ${assignments.length} assignments`);
      } else {
        console.log(`💾 Batch data saved to: grading-batch.json`);
      }
      console.log(`\nNext steps:`);
      console.log(`  bun clone         # Clone all repositories`);
      console.log(`  bun plagiarism    # Check for plagiarism`);
    }

  } catch (error) {
    await notify('list:error', { message: error.message });
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
