#!/usr/bin/env bun

/**
 * bun submit
 *
 * Submits AI grading feedback for evaluated assignments.
 * Auto-detects grading context from directory structure and assignment_data.json.
 * Calls PUT /api/grading/editAiFeedback with feedback and context.
 *
 * Usage:
 *   bun submit <studentName> <assignmentId>
 *   bun submit --all                        # Submit all graded assignments
 */

import { existsSync, readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { loadConfig, getWorkDir } from './config.js';
import { apiPut } from './api.js';

const FEEDBACK_FILE = 'ai_feedback.md';

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  all: args.includes('--all'),
};

// Filter out flags from args to get positional arguments
const positionalArgs = args.filter(a => !a.startsWith('-'));

/**
 * Load assignment data and feedback from directory
 */
function loadGradingData(studentName, assignmentId) {
  const studentDir = getWorkDir();
  const assignmentDir = join(studentDir, studentName, String(assignmentId));
  const dataFile = join(assignmentDir, 'assignment_data.json');
  const feedbackFile = join(assignmentDir, FEEDBACK_FILE);

  if (!existsSync(dataFile)) {
    throw new Error(`assignment_data.json not found in ${assignmentDir}`);
  }

  if (!existsSync(feedbackFile)) {
    throw new Error(`${FEEDBACK_FILE} not found in ${assignmentDir}`);
  }

  const data = JSON.parse(readFileSync(dataFile, 'utf-8'));
  const feedback = readFileSync(feedbackFile, 'utf-8');

  return {
    assignmentId: data.assignmentId,
    userId: data.student.userId,
    studentName: data.student.studentName,
    feedback,
    context: {
      assignmentName: data.assignmentName,
      instructions: data.assignmentInstructions,
      criteria: data.criteria,
    },
  };
}

/**
 * Submit feedback to API
 */
async function submitFeedback(gradingData) {
  const config = loadConfig();

  const payload = {
    userId: gradingData.userId,
    assignmentId: gradingData.assignmentId,
    feedbackText: gradingData.feedback,
  };

  if (flags.verbose) {
    console.log(`📤 Submitting to: ${config.apiUrl}/api/grading/editAiFeedback`);
    console.log(`   User ID: ${gradingData.userId}`);
    console.log(`   Assignment ID: ${gradingData.assignmentId}`);
    console.log(`   Feedback length: ${gradingData.feedback.length} chars`);
  }

  return apiPut('/api/grading/editAiFeedback', payload);
}

/**
 * Find all graded assignments (have ai_feedback.md file)
 */
async function findGradedAssignments() {
  const studentDir = getWorkDir();

  if (!existsSync(studentDir)) {
    return [];
  }

  const graded = [];
  const students = await readdir(studentDir);

  for (const studentName of students) {
    const studentPath = join(studentDir, studentName);
    const assignments = await readdir(studentPath);

    for (const assignmentId of assignments) {
      const feedbackFile = join(studentPath, assignmentId, FEEDBACK_FILE);

      if (existsSync(feedbackFile)) {
        graded.push({ studentName, assignmentId: parseInt(assignmentId) });
      }
    }
  }

  return graded;
}

async function submitSingle(studentName, assignmentId) {
  try {
    console.log(`\n📝 Submitting: ${studentName} / Assignment #${assignmentId}`);

    const gradingData = loadGradingData(studentName, assignmentId);

    if (flags.dryRun) {
      console.log('   🔍 DRY RUN: Would submit feedback');
      return { status: 'dry-run', studentName, assignmentId };
    }

    await submitFeedback(gradingData);

    console.log('   ✅ Success');

    return { status: 'success', studentName, assignmentId };

  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return { status: 'failed', studentName, assignmentId, error: error.message };
  }
}

async function submitAll() {
  console.log('🔍 Finding all graded assignments...\n');

  const graded = await findGradedAssignments();

  if (graded.length === 0) {
    console.log('✓ No graded assignments found with ai_feedback.md');
    return { success: 0, failed: 0, results: [] };
  }

  console.log(`📋 Found ${graded.length} graded assignment(s)\n`);
  console.log('═'.repeat(70));

  const results = [];

  for (const { studentName, assignmentId } of graded) {
    const result = await submitSingle(studentName, assignmentId);
    results.push(result);
  }

  const success = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return { success, failed, results };
}

function displaySummary(stats) {
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 Submission Summary\n');
  console.log(`✅ Success: ${stats.success}`);
  console.log(`❌ Failed:  ${stats.failed}`);
  console.log('═'.repeat(70));

  if (stats.failed > 0) {
    console.log('\n❌ Failed submissions:');
    const failed = stats.results.filter(r => r.status === 'failed');
    failed.forEach(f => {
      console.log(`   ${f.studentName}/${f.assignmentId}: ${f.error}`);
    });
  }

  console.log();
}

async function main() {
  try {
    // Validate config exists
    loadConfig();

    if (flags.all) {
      // Submit all graded assignments
      const stats = await submitAll();
      displaySummary(stats);

      if (stats.failed > 0) {
        process.exit(1);
      }

    } else {
      // Submit single assignment
      if (positionalArgs.length < 2) {
        console.error('❌ Error: Missing arguments');
        console.error('\nUsage:');
        console.error('  bun submit <studentName> <assignmentId>');
        console.error('  bun submit --all');
        console.error('\nOptions:');
        console.error('  --verbose, -v    Show detailed output');
        console.error('  --dry-run        Show what would be submitted without actually submitting');
        process.exit(1);
      }

      const studentName = positionalArgs[0];
      const assignmentId = parseInt(positionalArgs[1]);

      if (isNaN(assignmentId)) {
        console.error('❌ Error: assignmentId must be a number');
        process.exit(1);
      }

      const result = await submitSingle(studentName, assignmentId);

      if (result.status === 'failed') {
        process.exit(1);
      }
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
