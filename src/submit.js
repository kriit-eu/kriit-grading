#!/usr/bin/env bun

/**
 * bun run submit
 *
 * Submits AI grading feedback for evaluated assignments.
 * Auto-detects grading context from directory structure and assignment_data.json.
 *
 * For new submissions: reads ai_grading.json and calls POST /api/grading/submitAiFeedback
 * For edits: reads ai_feedback.md and calls PUT /api/grading/editAiFeedback
 *
 * Usage:
 *   bun run submit <studentName> <assignmentId>
 *   bun run submit --all                        # Submit all graded assignments
 */

import { existsSync, readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { loadConfig, getWorkDir } from './config.js';
import { apiPost, apiPut } from './api.js';
import { notify } from './lib/notify.js';

const GRADING_FILE = 'ai_grading.json';
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
 * Load assignment data from directory
 */
function loadAssignmentData(studentName, assignmentId) {
  const studentDir = getWorkDir();
  const assignmentDir = join(studentDir, studentName, String(assignmentId));
  const dataFile = join(assignmentDir, 'assignment_data.json');

  if (!existsSync(dataFile)) {
    throw new Error(`assignment_data.json not found in ${assignmentDir}`);
  }

  return JSON.parse(readFileSync(dataFile, 'utf-8'));
}

/**
 * Load grading data for new submission (ai_grading.json)
 */
function loadGradingJson(studentName, assignmentId) {
  const studentDir = getWorkDir();
  const assignmentDir = join(studentDir, studentName, String(assignmentId));
  const gradingFile = join(assignmentDir, GRADING_FILE);

  if (!existsSync(gradingFile)) {
    return null;
  }

  const grading = JSON.parse(readFileSync(gradingFile, 'utf-8'));

  // Validate required fields
  const required = ['completedCriteria', 'incompleteCriteria', 'criteriaNotEvaluated',
    'suggestedGrade', 'feedbackText', 'isConfidentPass', 'autoApprove', 'confidenceScore'];

  for (const field of required) {
    if (grading[field] === undefined) {
      throw new Error(`Missing required field '${field}' in ${GRADING_FILE}`);
    }
  }

  return grading;
}

/**
 * Load feedback text for edit (ai_feedback.md)
 */
function loadFeedbackMd(studentName, assignmentId) {
  const studentDir = getWorkDir();
  const assignmentDir = join(studentDir, studentName, String(assignmentId));
  const feedbackFile = join(assignmentDir, FEEDBACK_FILE);

  if (!existsSync(feedbackFile)) {
    return null;
  }

  return readFileSync(feedbackFile, 'utf-8');
}

/**
 * Submit new grading via POST /api/grading/submitAiFeedback
 */
async function submitNewGrading(assignmentData, gradingData) {
  const payload = {
    assignmentId: assignmentData.assignmentId,
    userId: assignmentData.student.userId,
    completedCriteria: gradingData.completedCriteria,
    incompleteCriteria: gradingData.incompleteCriteria,
    criteriaNotEvaluated: gradingData.criteriaNotEvaluated,
    suggestedGrade: gradingData.suggestedGrade,
    feedbackText: gradingData.feedbackText,
    isConfidentPass: gradingData.isConfidentPass,
    autoApprove: gradingData.autoApprove,
    confidenceScore: gradingData.confidenceScore,
  };

  if (flags.verbose) {
    console.log(`   📤 POST /api/grading/submitAiFeedback`);
    console.log(`   User ID: ${payload.userId}`);
    console.log(`   Assignment ID: ${payload.assignmentId}`);
    console.log(`   Grade: ${payload.suggestedGrade}`);
    console.log(`   Auto-approve: ${payload.autoApprove}`);
  }

  return apiPost('/api/grading/submitAiFeedback', payload);
}

/**
 * Edit existing feedback via PUT /api/grading/editAiFeedback
 */
async function editFeedback(assignmentData, feedbackText) {
  const payload = {
    assignmentId: assignmentData.assignmentId,
    userId: assignmentData.student.userId,
    feedbackText,
  };

  if (flags.verbose) {
    console.log(`   📤 PUT /api/grading/editAiFeedback`);
    console.log(`   User ID: ${payload.userId}`);
    console.log(`   Assignment ID: ${payload.assignmentId}`);
    console.log(`   Feedback length: ${feedbackText.length} chars`);
  }

  return apiPut('/api/grading/editAiFeedback', payload);
}

/**
 * Find all graded assignments (have ai_grading.json or ai_feedback.md)
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

    // Skip if not a directory
    try {
      const assignments = await readdir(studentPath);

      for (const assignmentId of assignments) {
        const gradingFile = join(studentPath, assignmentId, GRADING_FILE);
        const feedbackFile = join(studentPath, assignmentId, FEEDBACK_FILE);

        if (existsSync(gradingFile) || existsSync(feedbackFile)) {
          graded.push({
            studentName,
            assignmentId: parseInt(assignmentId),
            hasGradingJson: existsSync(gradingFile),
          });
        }
      }
    } catch {
      // Not a directory, skip
    }
  }

  return graded;
}

async function submitSingle(studentName, assignmentId) {
  const submissionKey = `${studentName}/${assignmentId}`;

  try {
    console.log(`\n📝 Submitting: ${studentName} / Assignment #${assignmentId}`);
    await notify('submit:progress', { student: studentName, assignmentId, status: 'submitting' });
    await notify('submission:message', {
      submissionKey,
      action: 'Esitan hindamist',
      result: '',
      failed: false,
    });

    const assignmentData = loadAssignmentData(studentName, assignmentId);
    const gradingJson = loadGradingJson(studentName, assignmentId);
    const feedbackMd = loadFeedbackMd(studentName, assignmentId);

    if (!gradingJson && !feedbackMd) {
      throw new Error(`No ${GRADING_FILE} or ${FEEDBACK_FILE} found`);
    }

    if (flags.dryRun) {
      const mode = gradingJson ? 'new submission' : 'edit';
      console.log(`   🔍 DRY RUN: Would submit (${mode})`);
      return { status: 'dry-run', studentName, assignmentId };
    }

    let result;
    if (gradingJson) {
      // New submission with full grading data
      console.log(`   📊 New submission (${GRADING_FILE})`);
      result = await submitNewGrading(assignmentData, gradingJson);
      await notify('submission:message', {
        submissionKey,
        action: 'Esitan hindamist',
        result: `Hinne: ${gradingJson.suggestedGrade}, Auto-approve: ${gradingJson.autoApprove}`,
        failed: false,
      });
    } else {
      // Edit existing feedback
      console.log(`   ✏️  Edit feedback (${FEEDBACK_FILE})`);
      result = await editFeedback(assignmentData, feedbackMd);
      await notify('submission:message', {
        submissionKey,
        action: 'Muudan tagasisidet',
        result: `${feedbackMd.length} tähemärki`,
        failed: false,
      });
    }

    console.log('   ✅ Success');
    await notify('submit:progress', { student: studentName, assignmentId, status: 'done' });
    await notify('submission:message', {
      submissionKey,
      action: 'Esitamine õnnestus',
      result: result.message || 'OK',
      failed: false,
      success: true,
    });

    return { status: 'success', studentName, assignmentId };

  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    await notify('submit:progress', { student: studentName, assignmentId, status: 'error', error: error.message });
    await notify('submission:message', {
      submissionKey,
      action: 'Esitamine ebaõnnestus',
      result: error.message,
      failed: true,
    });
    return { status: 'failed', studentName, assignmentId, error: error.message };
  }
}

async function submitAll() {
  console.log('🔍 Finding all graded assignments...\n');

  const graded = await findGradedAssignments();

  if (graded.length === 0) {
    console.log(`✓ No graded assignments found with ${GRADING_FILE} or ${FEEDBACK_FILE}`);
    return { success: 0, failed: 0, results: [] };
  }

  await notify('submit:start', { total: graded.length });
  console.log(`📋 Found ${graded.length} graded assignment(s)\n`);
  console.log('═'.repeat(70));

  const results = [];

  for (const { studentName, assignmentId } of graded) {
    const result = await submitSingle(studentName, assignmentId);
    results.push(result);
  }

  const success = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  await notify('submit:complete', { success, failed });

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
        console.error('  bun run submit <studentName> <assignmentId>');
        console.error('  bun run submit --all');
        console.error('\nOptions:');
        console.error('  --verbose, -v    Show detailed output');
        console.error('  --dry-run        Show what would be submitted without actually submitting');
        console.error('\nFiles:');
        console.error(`  ${GRADING_FILE}  - Full grading data (new submission)`);
        console.error(`  ${FEEDBACK_FILE}    - Feedback text only (edit existing)`);
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
    await notify('submit:error', { message: error.message });
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
