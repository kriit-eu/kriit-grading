#!/usr/bin/env bun

/**
 * bun clone
 *
 * Clones all student repositories from grading-batch.json in parallel.
 * Creates directory structure: ./student-grading/{studentName}/{assignmentId}/
 * Saves assignment_data.json in each directory with full assignment context.
 *
 * Best-effort: continues if some repos fail (student may have deleted repo).
 */

import { existsSync, readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { $ } from 'bun';
import { getBatchFilePath, getWorkDir } from './config.js';
import { notify } from './lib/notify.js';

// Parse command line flags
const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  strict: args.includes('--strict'),
  permissive: !args.includes('--strict'), // default to permissive
};

/**
 * Normalize GitHub URL to a clonable repository URL.
 * Extracts user/repo from any GitHub URL and ignores paths, query strings, etc.
 * Also handles raw.githubusercontent.com URLs.
 *
 * @param {string} url - The GitHub URL to normalize
 * @returns {string} - The normalized clone URL (https://github.com/user/repo.git)
 */
function normalizeGitHubUrl(url) {
  if (!url) return url;

  // Match raw.githubusercontent.com URLs
  // Format: https://raw.githubusercontent.com/{user}/{repo}/{branch-or-ref}/{path}
  const rawMatch = url.match(/^https?:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)/);
  if (rawMatch) {
    const [, user, repo] = rawMatch;
    return `https://github.com/${user}/${repo}.git`;
  }

  // Match any GitHub URL and extract just user/repo (first two path segments)
  const githubMatch = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/?#]+)/);
  if (githubMatch) {
    const [, user, repo] = githubMatch;
    // Remove .git suffix if present
    const cleanRepo = repo.replace(/\.git$/, '');
    return `https://github.com/${user}/${cleanRepo}.git`;
  }

  // Not a GitHub URL, return as-is
  return url;
}

function loadBatchData() {
  const batchFile = getBatchFilePath();

  if (!existsSync(batchFile)) {
    console.error('❌ Error: grading-batch.json not found');
    console.error('   Run: bun list');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(batchFile, 'utf-8'));

  if (!data.data || data.data.length === 0) {
    console.log('✓ No assignments to clone');
    process.exit(0);
  }

  return data.data;
}

async function cloneRepository(studentName, assignmentId, solutionUrl, assignmentData) {
  const outputDir = getWorkDir();
  const studentDir = join(outputDir, studentName);
  const assignmentDir = join(studentDir, String(assignmentId));
  const submissionKey = `${studentName}/${assignmentId}`;

  // Normalize GitHub URL (extract base repo from tree/blob/etc paths)
  const cloneUrl = normalizeGitHubUrl(solutionUrl);

  try {
    // Check if already cloned
    if (existsSync(join(assignmentDir, '.git'))) {
      if (flags.verbose) {
        console.log(`⏭️  Skipped: ${studentName}/${assignmentId} (already exists)`);
      }
      await notify('clone:progress', { student: studentName, assignmentId, status: 'skipped' });
      await notify('submission:message', {
        submissionKey,
        action: 'Kloonimine vahele jäetud',
        result: 'Repositoorium on juba kloonitud',
        failed: false
      });
      return { status: 'skipped', studentName, assignmentId, reason: 'already exists' };
    }

    // Clone repository
    await notify('clone:progress', { student: studentName, assignmentId, status: 'cloning' });

    // Log if URL was normalized
    const urlNormalized = cloneUrl !== solutionUrl;
    await notify('submission:message', {
      submissionKey,
      action: 'Kloonin projekti',
      result: urlNormalized
        ? `git clone ${cloneUrl} (normaliseeritud URL-ist: ${solutionUrl})`
        : `git clone ${cloneUrl}`,
      failed: false
    });

    if (!flags.dryRun) {
      // Create parent directory
      await mkdir(studentDir, { recursive: true });

      // Clone repository into target directory (git creates assignmentDir)
      const result = await $`git clone ${cloneUrl} ${assignmentDir}`.quiet();

      // Save assignment data after successful clone
      await writeFile(
        join(assignmentDir, 'assignment_data.json'),
        JSON.stringify(assignmentData, null, 2)
      );

      await notify('submission:message', {
        submissionKey,
        action: 'Kloonimine õnnestus',
        result: `Kloonitud kausta: ${assignmentDir}`,
        failed: false,
        success: true
      });
    }

    if (flags.verbose) {
      console.log(`✅ Cloned: ${studentName}/${assignmentId}`);
    }

    await notify('clone:progress', { student: studentName, assignmentId, status: 'done' });
    return { status: 'success', studentName, assignmentId };

  } catch (error) {
    if (flags.verbose) {
      console.error(`❌ Failed: ${studentName}/${assignmentId} - ${error.message}`);
    }

    // Still save assignment_data.json so grading can continue
    if (!flags.dryRun) {
      try {
        await mkdir(assignmentDir, { recursive: true });
        await writeFile(
          join(assignmentDir, 'assignment_data.json'),
          JSON.stringify(assignmentData, null, 2)
        );
      } catch {
        // Ignore errors saving assignment data
      }
    }

    await notify('clone:progress', { student: studentName, assignmentId, status: 'failed', error: error.message });
    await notify('submission:message', {
      submissionKey,
      action: 'Kloonimine ebaõnnestus',
      result: error.message,
      failed: true
    });
    return {
      status: 'failed',
      studentName,
      assignmentId,
      error: error.message
    };
  }
}

async function cloneAllRepositories(assignments) {
  const tasks = [];

  // Prepare all clone tasks
  for (const assignment of assignments) {
    for (const submission of assignment.submissions) {
      if (!submission.solutionUrl || submission.solutionUrl === '') {
        continue;
      }

      // Prepare assignment context for this student
      const assignmentData = {
        assignmentId: assignment.assignmentId,
        assignmentName: assignment.assignmentName,
        assignmentInstructions: assignment.assignmentInstructions,
        assignmentLinkedId: assignment.assignmentLinkedId,
        criteria: assignment.criteria,
        prerequisites: assignment.prerequisites,
        student: {
          userId: submission.userId,
          studentName: submission.studentName,
          solutionUrl: submission.solutionUrl,
          submittedAt: submission.submittedAt,
          isGraded: submission.isGraded,
          // Include pair partner ID for plagiarism detection
          pairPartnerUserId: submission.pairPartnerUserId || null,
        },
        // Include peer submissions for plagiarism detection
        peerSubmissions: assignment.submissions
          .filter(s => s.userId !== submission.userId)
          .map(s => ({
            userId: s.userId,
            studentName: s.studentName,
            solutionUrl: s.solutionUrl,
            submittedAt: s.submittedAt,
            isGraded: s.isGraded,
            pairPartnerUserId: s.pairPartnerUserId || null,
          })),
      };

      tasks.push(
        cloneRepository(
          submission.studentName,
          assignment.assignmentId,
          submission.solutionUrl,
          assignmentData
        )
      );
    }
  }

  if (tasks.length === 0) {
    console.log('✓ No repositories to clone');
    return { success: 0, failed: 0, skipped: 0, results: [] };
  }

  await notify('clone:start', { total: tasks.length });
  console.log(`🔄 Cloning ${tasks.length} repositories in parallel...\n`);

  // Execute all clones in parallel
  const results = await Promise.all(tasks);

  // Categorize results
  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped');

  await notify('clone:complete', {
    success: success.length,
    failed: failed.length,
    skipped: skipped.length
  });

  return {
    success: success.length,
    failed: failed.length,
    skipped: skipped.length,
    results,
  };
}

function displaySummary(stats) {
  console.log('\n📊 Clone Summary\n');
  console.log('═'.repeat(70));
  console.log(`✅ Success: ${stats.success}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`❌ Failed:  ${stats.failed}`);
  console.log('═'.repeat(70));

  if (stats.failed > 0) {
    console.log('\n❌ Failed repositories:');
    const failed = stats.results.filter(r => r.status === 'failed');
    failed.forEach(f => {
      console.log(`   ${f.studentName}/${f.assignmentId}: ${f.error}`);
    });
  }

  console.log();
}

async function main() {
  try {
    if (flags.dryRun) {
      console.log('🔍 DRY RUN: No repositories will be cloned\n');
    }

    const assignments = loadBatchData();

    if (flags.verbose) {
      console.log(`📋 Loaded ${assignments.length} assignment(s) from grading-batch.json\n`);
    }

    const stats = await cloneAllRepositories(assignments);

    displaySummary(stats);

    if (!flags.dryRun) {
      console.log(`📁 Repositories cloned to: ${getWorkDir()}/\n`);
      console.log(`Next steps:`);
      console.log(`  bun plagiarism    # Check for plagiarism`);
    }

    // Exit with error in strict mode if any clones failed
    if (flags.strict && stats.failed > 0) {
      console.error('\n❌ Exiting with error (--strict mode)');
      process.exit(1);
    }

  } catch (error) {
    await notify('clone:error', { message: error.message });
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
