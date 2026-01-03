#!/usr/bin/env bun

/**
 * bun plagiarism
 *
 * MULTI-LEVEL PLAGIARISM DETECTION
 *
 * Detects plagiarism across all cloned student repositories using multiple detection levels:
 * - Level 1: MD5 hash matching (exact copies)
 * - Level 2: Normalized text similarity (comments/whitespace removed)
 * - Level 3: Token-based structural similarity (variable renames detected)
 * - Level 4: Partial structural matching
 *
 * Uses file-by-file comparison to detect partial plagiarism (e.g., only SQL files copied).
 * Automatically ignores configuration/lock files (package.json, composer.lock, etc.)
 * to reduce false positives and focus on actual student code.
 * Automatically skips students who are authorized pair partners for the assignment.
 * Determines original author by submission timestamp.
 *
 * Outputs plagiarism-reports/{assignmentId}.json with detailed evidence.
 */

import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { mkdir, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { getWorkDir, getPlagiarismReportsDir } from './config.js';

const SIMILARITY_THRESHOLD = 0.85; // 85% similarity triggers plagiarism flag
const STRUCTURAL_THRESHOLD = 0.75; // 75% for structural similarity

// Files to completely ignore in plagiarism detection
const IGNORE_FILES = [
  // Package managers
  'package.json',
  'package-lock.json',
  'composer.json',
  'composer.lock',
  'bun.lockb',
  'yarn.lock',
  'pnpm-lock.yaml',

  // Configuration files (often same across projects)
  'tsconfig.json',
  'jsconfig.json',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'rollup.config.js',

  // Environment templates
  '.env.example',
  '.env.sample',

  // Git/Editor configs
  '.gitignore',
  '.editorconfig',
  '.DS_Store',

  // License files
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
];

// Parse command line flags
const args = process.argv.slice(2);
const flags = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  threshold: parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1] || SIMILARITY_THRESHOLD),
  dryRun: args.includes('--dry-run'),
};

/**
 * Get pair partnerships for an assignment from cloned assignment_data.json files
 * Returns a Map of userId -> pairPartnerUserId
 */
function getPairPartnerships(assignmentId) {
  const pairs = new Map();
  const studentDir = getWorkDir();

  if (!existsSync(studentDir)) {
    return pairs;
  }

  const students = readdirSync(studentDir);

  for (const studentName of students) {
    const dataFile = join(studentDir, studentName, String(assignmentId), 'assignment_data.json');

    if (!existsSync(dataFile)) {
      continue;
    }

    try {
      const data = JSON.parse(readFileSync(dataFile, 'utf-8'));
      const userId = data.student?.userId;
      const partnerId = data.student?.pairPartnerUserId;

      if (userId && partnerId) {
        pairs.set(userId, partnerId);
      }
    } catch (error) {
      if (flags.verbose) {
        console.error(`Warning: Could not read pair data from ${dataFile}: ${error.message}`);
      }
    }
  }

  return pairs;
}

/**
 * Check if two students are authorized pair partners
 */
function arePaired(userId1, userId2, pairMap) {
  return pairMap.get(userId1) === userId2 || pairMap.get(userId2) === userId1;
}

/**
 * Normalize source code for comparison:
 * - Remove single-line comments (// and #)
 * - Remove multi-line comments (/* *\/)
 * - Remove extra whitespace
 * - Convert to lowercase
 */
export function normalizeCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove /* */ comments
    .replace(/\/\/.*/g, '')             // Remove // comments
    .replace(/#.*/g, '')                // Remove # comments (Python, shell)
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .toLowerCase()
    .trim();
}

/**
 * Extract code structure tokens (variable-agnostic):
 * - Replace variable names with placeholders
 * - Replace function names with FUNC
 * - Replace strings with STRING
 * - Replace numbers with NUM
 */
export function extractTokens(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove comments
    .replace(/\/\/.*/g, '')
    .replace(/#.*/g, '')
    // Replace declarations
    .replace(/\b(const|let|var|function|class|import|export|interface|type)\s+\w+/g, '$1 VAR')
    // Replace function calls
    .replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g, 'FUNC(')
    // Replace strings
    .replace(/['"`].*?['"`]/g, 'STRING')
    // Replace numbers
    .replace(/\b\d+(\.\d+)?\b/g, 'NUM')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
export function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;

  // Use a simple matrix approach for Levenshtein distance
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  return 1 - (distance / maxLength);
}

/**
 * Recursively read all files from a directory
 */
async function getAllFiles(dir, fileList = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip common directories that shouldn't be checked for plagiarism
      const ignoredDirs = [
        '.git',
        'node_modules',
        'vendor',
        '.idea',           // JetBrains IDEs
        '.vscode',         // VS Code
        'dist',            // Build output
        'build',           // Build output
        '.next',           // Next.js
        '.nuxt',           // Nuxt.js
        'coverage',        // Test coverage
        '.cache',          // Cache
        'tmp',             // Temporary
        'temp',            // Temporary
        '.DS_Store',       // macOS
      ];

      if (ignoredDirs.includes(entry.name)) {
        continue;
      }
      await getAllFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      // Only include source code files
      const ext = entry.name.split('.').pop();
      if (['php', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rb', 'sql'].includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

/**
 * MULTI-LEVEL ANALYSIS: Analyze repository files at multiple levels
 * Returns a Map of filename -> analysis data
 */
async function analyzeRepository(repoPath) {
  try {
    const files = await getAllFiles(repoPath);
    const analysis = new Map();

    for (const filePath of files) {
      const filename = basename(filePath);

      // Skip ignored files
      if (IGNORE_FILES.includes(filename)) {
        continue;
      }

      const rawContent = readFileSync(filePath, 'utf-8');

      // LEVEL 1: Raw MD5 hash (catches exact copies)
      const md5Hash = createHash('md5').update(rawContent).digest('hex');

      // LEVEL 2: Normalized content (catches comment/whitespace changes)
      const normalized = normalizeCode(rawContent);

      // LEVEL 3: Token-based fingerprint (catches variable renames)
      const tokens = extractTokens(rawContent);
      const tokenFingerprint = createHash('md5').update(tokens).digest('hex');

      analysis.set(filename, {
        md5: md5Hash,
        normalized: normalized,
        tokens: tokens,
        tokenFingerprint: tokenFingerprint,
        size: rawContent.length
      });
    }

    return analysis;
  } catch (error) {
    if (flags.verbose) {
      console.error(`⚠️  Warning: Could not analyze ${repoPath}: ${error.message}`);
    }
    return new Map();
  }
}

/**
 * Compare two submissions file-by-file at multiple levels
 */
async function compareTwoSubmissions(sub1Analysis, sub2Analysis) {
  const matches = [];

  for (const [filename, data1] of sub1Analysis) {
    if (!sub2Analysis.has(filename)) continue;

    const data2 = sub2Analysis.get(filename);

    // LEVEL 1: Exact match (MD5)
    if (data1.md5 === data2.md5) {
      matches.push({
        file: filename,
        similarity: 1.0,
        level: 'EXACT',
        evidence: `Identical files (MD5: ${data1.md5.substring(0, 8)}...)`,
        size: data1.size
      });
      continue;
    }

    // LEVEL 2: Normalized similarity (comments/whitespace removed)
    if (data1.normalized.length > 10 && data2.normalized.length > 10) {
      const normSim = calculateSimilarity(data1.normalized, data2.normalized);
      if (normSim >= flags.threshold) {
        matches.push({
          file: filename,
          similarity: normSim,
          level: 'NORMALIZED',
          evidence: `${Math.round(normSim * 100)}% similarity after removing comments/whitespace`,
          size: data1.size
        });
        continue;
      }
    }

    // LEVEL 3: Structural similarity (same token fingerprint)
    if (data1.tokenFingerprint === data2.tokenFingerprint) {
      matches.push({
        file: filename,
        similarity: 0.95,
        level: 'STRUCTURAL',
        evidence: 'Identical code structure with different variable/function names',
        size: data1.size
      });
      continue;
    }

    // LEVEL 4: Partial structural similarity
    if (data1.tokens.length > 10 && data2.tokens.length > 10) {
      const tokenSim = calculateSimilarity(data1.tokens, data2.tokens);
      if (tokenSim >= STRUCTURAL_THRESHOLD) {
        matches.push({
          file: filename,
          similarity: tokenSim,
          level: 'PARTIAL_STRUCTURAL',
          evidence: `${Math.round(tokenSim * 100)}% structural similarity`,
          size: data1.size
        });
      }
    }
  }

  return matches;
}

/**
 * Calculate overall weighted similarity from file matches
 */
function calculateOverallSimilarity(matches, totalSize) {
  if (matches.length === 0 || totalSize === 0) return 0;

  let weightedSimilarity = 0;
  let matchedSize = 0;

  for (const match of matches) {
    weightedSimilarity += match.similarity * match.size;
    matchedSize += match.size;
  }

  return matchedSize > 0 ? weightedSimilarity / matchedSize : 0;
}

/**
 * Load submission data for an assignment
 */
function loadSubmissions(assignmentId) {
  const submissions = [];
  const studentDir = getWorkDir();

  if (!existsSync(studentDir)) {
    return submissions;
  }

  const students = readdirSync(studentDir);

  for (const studentName of students) {
    const assignmentDir = join(studentDir, studentName, String(assignmentId));
    const dataFile = join(assignmentDir, 'assignment_data.json');

    if (!existsSync(dataFile)) {
      continue;
    }

    try {
      const data = JSON.parse(readFileSync(dataFile, 'utf-8'));
      submissions.push({
        studentName,
        userId: data.student.userId,
        submittedAt: new Date(data.student.submittedAt),
        repoPath: assignmentDir,
      });
    } catch (error) {
      if (flags.verbose) {
        console.error(`⚠️  Warning: Could not load ${dataFile}: ${error.message}`);
      }
    }
  }

  return submissions;
}

/**
 * Find all unique assignment IDs from cloned repositories
 */
function findAllAssignmentIds() {
  const studentDir = getWorkDir();

  if (!existsSync(studentDir)) {
    return [];
  }

  const assignmentIds = new Set();
  const students = readdirSync(studentDir);

  for (const studentName of students) {
    const studentPath = join(studentDir, studentName);
    const assignments = readdirSync(studentPath);

    for (const assignmentId of assignments) {
      if (/^\d+$/.test(assignmentId)) {
        assignmentIds.add(parseInt(assignmentId));
      }
    }
  }

  return Array.from(assignmentIds).sort((a, b) => a - b);
}

/**
 * Compare all submissions for an assignment and detect plagiarism
 */
async function checkAssignmentPlagiarism(assignmentId) {
  const submissions = loadSubmissions(assignmentId);

  if (submissions.length < 2) {
    if (flags.verbose) {
      console.log(`⏭️  Assignment #${assignmentId}: Only ${submissions.length} submission(s), skipping`);
    }
    return null;
  }

  console.log(`🔍 Checking assignment #${assignmentId}: ${submissions.length} submission(s)`);

  // Get pair partnerships for this assignment from cloned data
  const pairMap = getPairPartnerships(assignmentId);
  const pairedCount = pairMap.size;
  if (pairedCount > 0) {
    console.log(`   👥 ${pairedCount} student(s) are working in authorized pairs (will be skipped)`);
  }

  // Analyze all submissions
  const submissionsWithAnalysis = await Promise.all(
    submissions.map(async (sub) => ({
      ...sub,
      analysis: await analyzeRepository(sub.repoPath),
    }))
  );

  // Compare all pairs
  const suspiciousPairs = [];
  let skippedPairs = 0;

  for (let i = 0; i < submissionsWithAnalysis.length; i++) {
    for (let j = i + 1; j < submissionsWithAnalysis.length; j++) {
      const sub1 = submissionsWithAnalysis[i];
      const sub2 = submissionsWithAnalysis[j];

      // Skip if either has no files
      if (sub1.analysis.size === 0 || sub2.analysis.size === 0) {
        continue;
      }

      // Skip if they are authorized pair partners
      if (arePaired(sub1.userId, sub2.userId, pairMap)) {
        if (flags.verbose) {
          console.log(`   ⏭️  Skipping authorized pair: ${sub1.studentName} ↔ ${sub2.studentName}`);
        }
        skippedPairs++;
        continue;
      }

      // Compare file-by-file
      const matches = await compareTwoSubmissions(sub1.analysis, sub2.analysis);

      if (matches.length === 0) continue;

      // Calculate total size for weighting
      const totalSize = Array.from(sub1.analysis.values())
        .reduce((sum, f) => sum + f.size, 0);

      // Calculate overall weighted similarity
      const overallSimilarity = calculateOverallSimilarity(matches, totalSize);

      if (overallSimilarity >= flags.threshold) {
        // Determine who copied from whom based on timestamp
        const original = sub1.submittedAt < sub2.submittedAt ? sub1 : sub2;
        const plagiarist = sub1.submittedAt < sub2.submittedAt ? sub2 : sub1;

        suspiciousPairs.push({
          similarity: Math.round(overallSimilarity * 100) / 100,
          originalAuthor: {
            studentName: original.studentName,
            userId: original.userId,
            submittedAt: original.submittedAt.toISOString(),
          },
          plagiarist: {
            studentName: plagiarist.studentName,
            userId: plagiarist.userId,
            submittedAt: plagiarist.submittedAt.toISOString(),
          },
          matchedFiles: matches.map(m => ({
            file: m.file,
            similarity: Math.round(m.similarity * 100) / 100,
            level: m.level,
            evidence: m.evidence
          })),
          evidence: matches.map(m => `${m.file}: ${m.level} (${Math.round(m.similarity * 100)}%)`).join(', ')
        });

        if (flags.verbose) {
          console.log(`   ⚠️  ${overallSimilarity.toFixed(2)} similarity: ${plagiarist.studentName} ← ${original.studentName}`);
          for (const match of matches) {
            console.log(`      - ${match.file}: ${match.level} (${Math.round(match.similarity * 100)}%)`);
          }
        }
      }
    }
  }

  if (suspiciousPairs.length > 0) {
    console.log(`   ❌ Found ${suspiciousPairs.length} suspicious pair(s)`);
  } else {
    console.log(`   ✅ No plagiarism detected`);
  }

  if (skippedPairs > 0) {
    console.log(`   ⏭️  Skipped ${skippedPairs} authorized pair(s)`);
  }

  return {
    assignmentId,
    submissionsChecked: submissions.length,
    suspiciousPairs,
    threshold: flags.threshold,
    detectionMethod: 'multi-level (MD5 + normalized + structural)',
    authorizedPairsSkipped: skippedPairs,
    checkedAt: new Date().toISOString(),
  };
}

async function main() {
  try {
    const studentDir = getWorkDir();
    const reportsDir = getPlagiarismReportsDir();

    if (!existsSync(studentDir)) {
      console.error('❌ Error: student-grading/ directory not found');
      console.error('   Run: bun clone');
      process.exit(1);
    }

    if (flags.dryRun) {
      console.log('🔍 DRY RUN: No reports will be saved\n');
    }

    console.log(`🔍 Multi-Level Plagiarism Detection (threshold: ${Math.round(flags.threshold * 100)}%)\n`);
    console.log('Detection levels:');
    console.log('  1. MD5 hash (exact copies)');
    console.log('  2. Normalized similarity (comments/whitespace removed)');
    console.log('  3. Structural fingerprint (variable renames detected)');
    console.log('  4. Partial structural matching\n');
    console.log('═'.repeat(70));

    const assignmentIds = findAllAssignmentIds();

    if (assignmentIds.length === 0) {
      console.log('✓ No assignments to check');
      process.exit(0);
    }

    // Create reports directory
    if (!flags.dryRun) {
      await mkdir(reportsDir, { recursive: true });
    }

    const reports = [];
    let totalSuspicious = 0;

    for (const assignmentId of assignmentIds) {
      const report = await checkAssignmentPlagiarism(assignmentId);

      if (report && report.suspiciousPairs.length > 0) {
        reports.push(report);
        totalSuspicious += report.suspiciousPairs.length;

        // Save individual report
        if (!flags.dryRun) {
          await writeFile(
            join(reportsDir, `${assignmentId}.json`),
            JSON.stringify(report, null, 2)
          );
        }
      }
    }

    console.log('═'.repeat(70));
    console.log(`\n📊 Summary:\n`);
    console.log(`   Assignments checked: ${assignmentIds.length}`);
    console.log(`   Suspicious pairs found: ${totalSuspicious}`);
    console.log(`   Reports with findings: ${reports.length}`);

    if (totalSuspicious > 0 && !flags.dryRun) {
      console.log(`\n📁 Reports saved to: ${reportsDir}/\n`);
      console.log(`Next steps:`);
      console.log(`  Review plagiarism reports before grading`);
      console.log(`  bun submit    # Submit grades and feedback`);
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
