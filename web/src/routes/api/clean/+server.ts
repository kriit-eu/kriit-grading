import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { resolve } from 'path';
import { handleEvent } from '$lib/server/state';

// Project root is parent of 'web' directory
const projectRoot = resolve(process.cwd(), '..');

const paths = {
  workDir: resolve(projectRoot, 'student-grading'),
  plagiarismReports: resolve(projectRoot, 'plagiarism-reports'),
  batchFile: resolve(projectRoot, 'grading-batch.json')
};

async function removeIfExists(path: string): Promise<boolean> {
  if (!existsSync(path)) {
    return false;
  }
  await rm(path, { recursive: true, force: true });
  return true;
}

export const POST: RequestHandler = async () => {
  const removed: string[] = [];

  try {
    if (await removeIfExists(paths.workDir)) {
      removed.push('student-grading/');
    }
    if (await removeIfExists(paths.plagiarismReports)) {
      removed.push('plagiarism-reports/');
    }
    if (await removeIfExists(paths.batchFile)) {
      removed.push('grading-batch.json');
    }

    // Reset server state
    handleEvent({
      type: 'clean:complete',
      data: {},
      timestamp: new Date().toISOString()
    });

    return json({
      success: true,
      removed,
      message: removed.length > 0
        ? `Removed: ${removed.join(', ')}`
        : 'Nothing to clean'
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
