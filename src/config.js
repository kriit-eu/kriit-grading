/**
 * Configuration loader and validator
 * Bun automatically loads .env file
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Load and validate configuration from environment
 * @returns {{apiUrl: string, apiKey: string, autoApproveHighConfidence: boolean}}
 * @throws {Error} if required env vars are missing
 */
export function loadConfig() {
  const apiUrl = process.env.KRIIT_API_URL;
  const apiKey = process.env.KRIIT_API_KEY;
  const autoApprove = process.env.AUTO_APPROVE_HIGH_CONFIDENCE;

  if (!apiUrl) {
    throw new Error('KRIIT_API_URL not set. Run "bun init" to create .env file.');
  }

  if (!apiKey) {
    throw new Error('KRIIT_API_KEY not set. Configure your API key in .env file.');
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ''), // Remove trailing slash
    apiKey,
    autoApproveHighConfidence: autoApprove !== 'false' // Default to true
  };
}

/**
 * Get working directory for grading data
 * @returns {string}
 */
export function getWorkDir() {
  return join(PROJECT_ROOT, 'student-grading');
}

/**
 * Get plagiarism reports directory
 * @returns {string}
 */
export function getPlagiarismReportsDir() {
  return join(PROJECT_ROOT, 'plagiarism-reports');
}

/**
 * Get batch data file path
 * @returns {string}
 */
export function getBatchFilePath() {
  return join(PROJECT_ROOT, 'grading-batch.json');
}

/**
 * Check if .env file exists
 * @returns {boolean}
 */
export function envFileExists() {
  return existsSync(join(PROJECT_ROOT, '.env'));
}
