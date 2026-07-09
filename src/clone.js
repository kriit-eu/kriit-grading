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
import { mkdir, writeFile, rm } from 'fs/promises';
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
 * Check if URL is a Google Drive/Docs/Sheets URL.
 * These can't be cloned with git but can be graded via MCP tools.
 *
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's a Google Drive URL
 */
function isGoogleDriveUrl(url) {
  if (!url) return false;
  return url.includes('drive.google.com') ||
         url.includes('docs.google.com') ||
         url.includes('sheets.google.com');
}

/**
 * Normalize GitHub URL to a clonable repository URL.
 * Extracts user/repo from any GitHub URL and ignores paths, query strings, etc.
 * Also handles raw.githubusercontent.com URLs.
 *
 * @param {string} url - The GitHub URL to normalize
 * @returns {string} - The normalized clone URL (https://github.com/user/repo.git)
 */
export function normalizeGitHubUrl(url) {
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

export async function cloneRepository(studentName, assignmentId, solutionUrl, assignmentData) {
  const outputDir = getWorkDir();
  const studentDir = join(outputDir, studentName);
  const assignmentDir = join(studentDir, String(assignmentId));
  const submissionKey = `${studentName}/${assignmentId}`;

  // Handle Google Drive URLs (can't be cloned, but can be graded via MCP tools)
  if (isGoogleDriveUrl(solutionUrl)) {
    if (flags.verbose) {
      console.log(`📄 Google Drive: ${studentName}/${assignmentId}`);
    }

    // Check if already processed
    if (existsSync(join(assignmentDir, 'assignment_data.json'))) {
      await notify('clone:progress', { student: studentName, assignmentId, status: 'skipped' });
      await notify('submission:message', {
        submissionKey,
        action: 'Google Drive dokument',
        result: 'Juba töödeldud',
        failed: false
      });
      return { status: 'skipped', studentName, assignmentId, reason: 'google-drive already processed' };
    }

    // Create directory and save assignment_data.json
    if (!flags.dryRun) {
      await mkdir(assignmentDir, { recursive: true });
      await writeFile(
        join(assignmentDir, 'assignment_data.json'),
        JSON.stringify(assignmentData, null, 2)
      );
    }

    await notify('clone:progress', { student: studentName, assignmentId, status: 'google-drive' });
    await notify('submission:message', {
      submissionKey,
      action: 'Google Drive dokument',
      result: `${solutionUrl}`,
      failed: false,
      success: true
    });

    return { status: 'google-drive', studentName, assignmentId };
  }

  // Normalize GitHub URL (extract base repo from tree/blob/etc paths)
  const cloneUrl = normalizeGitHubUrl(solutionUrl);

  try {
    // Check if already cloned
    if (existsSync(join(assignmentDir, '.git'))) {
      try {
        await notify('clone:progress', { student: studentName, assignmentId, status: 'cloning' });
        
        const beforeHash = (await $`env git -C ${assignmentDir} rev-parse --short HEAD`.env(process.env).quiet().text()).trim();
        
        if (!flags.dryRun) {
          await $`env git -C ${assignmentDir} pull`.env(process.env).quiet();
          // Write/update assignment_data.json after successful pull
          await writeFile(
            join(assignmentDir, 'assignment_data.json'),
            JSON.stringify(assignmentData, null, 2)
          );
        }
        
        const afterHash = (await $`env git -C ${assignmentDir} rev-parse --short HEAD`.env(process.env).quiet().text()).trim();
        
        if (beforeHash !== afterHash) {
          const logOutput = (await $`env git -C ${assignmentDir} log --oneline -n 5 ${beforeHash}..${afterHash}`.env(process.env).quiet().text()).trim();
          const commitSummary = logOutput ? `:\n${logOutput}` : '';
          
          if (flags.verbose) {
            console.log(`🔄 Updated: ${studentName}/${assignmentId} (${beforeHash} -> ${afterHash})`);
          }
          await notify('submission:message', {
            submissionKey,
            action: 'Repositoorium uuendatud',
            result: `Tõmmati uued muudatused: ${beforeHash} -> ${afterHash}${commitSummary}`,
            failed: false,
            success: true
          });
          await notify('clone:progress', { student: studentName, assignmentId, status: 'done' });
          return { status: 'success', studentName, assignmentId, updated: true };
        } else {
          if (flags.verbose) {
            console.log(`⏭️  Already up-to-date: ${studentName}/${assignmentId} (${beforeHash})`);
          }
          await notify('submission:message', {
            submissionKey,
            action: 'Repositoorium kontrollitud',
            result: `Juba värske (commit: ${beforeHash})`,
            failed: false,
            success: true
          });
          await notify('clone:progress', { student: studentName, assignmentId, status: 'done' });
          return { status: 'success', studentName, assignmentId, updated: false };
        }
      } catch (error) {
        const stderr = error.stderr?.toString().trim();
        const gitError = stderr ? ` (Git viga: ${stderr})` : '';
        const fullErrorMessage = `${error.message}${gitError} for URL ${solutionUrl}`;
        
        if (flags.verbose) {
          console.error(`❌ Failed to update: ${studentName}/${assignmentId} - ${fullErrorMessage}`);
        }
        await notify('submission:message', {
          submissionKey,
          action: 'Uuendamine ebaõnnestus',
          result: `URL: ${solutionUrl}\nViga repositooriumi värskendamisel: ${fullErrorMessage}`,
          failed: true
        });
        await notify('clone:progress', { student: studentName, assignmentId, status: 'failed', error: fullErrorMessage });
        return { status: 'failed', studentName, assignmentId, error: fullErrorMessage };
      }
    }

    // If destination directory exists but is NOT a git repository, clean it up
    // to avoid exit code 128 (destination path already exists and is not empty)
    if (existsSync(assignmentDir)) {
      if (flags.verbose) {
        console.log(`🧹 Cleaning up non-git directory: ${assignmentDir}`);
      }
      if (!flags.dryRun) {
        await rm(assignmentDir, { recursive: true, force: true });
      }
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
      const result = await $`env git clone ${cloneUrl} ${assignmentDir}`.env(process.env).quiet();

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
    const stderr = error.stderr?.toString().trim();
    const gitError = stderr ? ` (Git viga: ${stderr})` : '';
    const fullErrorMessage = `${error.message}${gitError} for URL ${solutionUrl}`;

    if (flags.verbose) {
      console.error(`❌ Failed: ${studentName}/${assignmentId} - ${fullErrorMessage}`);
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

    await notify('clone:progress', { student: studentName, assignmentId, status: 'failed', error: fullErrorMessage });
    await notify('submission:message', {
      submissionKey,
      action: 'Kloonimine ebaõnnestus',
      result: `URL: ${solutionUrl}\nPõhjus: ${fullErrorMessage}`,
      failed: true
    });
    return {
      status: 'failed',
      studentName,
      assignmentId,
      error: fullErrorMessage
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
  const googleDrive = results.filter(r => r.status === 'google-drive');

  await notify('clone:complete', {
    success: success.length,
    failed: failed.length,
    skipped: skipped.length,
    googleDrive: googleDrive.length
  });

  return {
    success: success.length,
    failed: failed.length,
    skipped: skipped.length,
    googleDrive: googleDrive.length,
    results,
  };
}

function displaySummary(stats) {
  console.log('\n📊 Clone Summary\n');
  console.log('═'.repeat(70));
  console.log(`✅ Success:      ${stats.success}`);
  console.log(`📄 Google Drive: ${stats.googleDrive}`);
  console.log(`⏭️  Skipped:      ${stats.skipped}`);
  console.log(`❌ Failed:       ${stats.failed}`);
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
