import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { rm } from 'fs/promises';

let cloneRepository;

describe('clone', () => {
  const originalEnv = { ...process.env };
  const tempGradingDir = join(import.meta.dirname, 'temp-student-grading');
  const tempBinDir = join(import.meta.dirname, 'temp-bin');

  beforeEach(async () => {
    // Clean up if directories exist
    await rm(tempGradingDir, { recursive: true, force: true });
    await rm(tempBinDir, { recursive: true, force: true });

    mkdirSync(tempGradingDir, { recursive: true });
    mkdirSync(tempBinDir, { recursive: true });

    // Set environment variables
    process.env.STUDENT_GRADING_DIR = tempGradingDir;
    process.env.KRIIT_API_URL = 'https://kriit.vikk.ee';
    process.env.KRIIT_API_KEY = 'test-key';

    // Create a mock git executable that pretends to succeed
    const mockGitContent = `#!/bin/sh
DIR=""
if [ "$1" = "-C" ]; then
  DIR="$2"
  shift 2
fi

CMD="$1"
shift

if [ "$CMD" = "clone" ]; then
  if [ "$1" = "invalid-url" ]; then
    echo "fatal: repository 'invalid-url' not found" >&2
    exit 128
  fi
  mkdir -p "$2/.git"
  echo "mock clone success"
  exit 0
fi

if [ "$CMD" = "rev-parse" ]; then
  if [ -n "$DIR" ] && [ -f "$DIR/mock_commit" ]; then
    cat "$DIR/mock_commit"
  else
    echo "a1b2c3d"
  fi
  exit 0
fi

if [ "$CMD" = "pull" ]; then
  if [ -n "$DIR" ] && [ -f "$DIR/mock_pull_fail" ]; then
    echo "fatal: Remote branch not found" >&2
    exit 128
  fi
  if [ -n "$DIR" ] && [ -f "$DIR/mock_pull_target" ]; then
    cat "$DIR/mock_pull_target" > "$DIR/mock_commit"
  fi
  echo "mock pull success"
  exit 0
fi

if [ "$CMD" = "log" ]; then
  echo "e5f6g7h New commit message from student"
  exit 0
fi

exit 1
`;
    const mockGitPath = join(tempBinDir, 'git');
    writeFileSync(mockGitPath, mockGitContent, { mode: 0o755 });

    // Prepend mock bin dir to PATH
    process.env.PATH = `${tempBinDir}:${process.env.PATH}`;

    const mod = await import('../src/clone.js');
    cloneRepository = mod.cloneRepository;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(tempGradingDir, { recursive: true, force: true });
    await rm(tempBinDir, { recursive: true, force: true });
  });

  test('cloneRepository cleans up non-empty non-git directory before cloning', async () => {
    const studentName = 'Test Student';
    const assignmentId = 42;
    const studentDir = join(tempGradingDir, studentName);
    const assignmentDir = join(studentDir, String(assignmentId));

    // Simulate pre-existing non-git directory containing files
    mkdirSync(assignmentDir, { recursive: true });
    const dummyFile = join(assignmentDir, 'assignment_data.json');
    writeFileSync(dummyFile, '{}');

    expect(existsSync(dummyFile)).toBe(true);
    expect(existsSync(join(assignmentDir, '.git'))).toBe(false);

    // Call cloneRepository
    const assignmentData = {
      assignmentId,
      assignmentName: 'Test Assignment',
      criteria: [],
      submissions: []
    };
    
    const result = await cloneRepository(
      studentName,
      assignmentId,
      'https://github.com/test-user/test-repo.git',
      assignmentData
    );

    expect(result.status).toBe('success');
  });

  test('cloneRepository deletes custom pre-existing files in non-git directory', async () => {
    const studentName = 'Test Student';
    const assignmentId = 43;
    const studentDir = join(tempGradingDir, studentName);
    const assignmentDir = join(studentDir, String(assignmentId));

    mkdirSync(assignmentDir, { recursive: true });
    const customFile = join(assignmentDir, 'leftover_file.txt');
    writeFileSync(customFile, 'important content');

    expect(existsSync(customFile)).toBe(true);

    const assignmentData = {
      assignmentId,
      assignmentName: 'Test Assignment',
      criteria: [],
      submissions: []
    };

    const result = await cloneRepository(
      studentName,
      assignmentId,
      'https://github.com/test-user/test-repo.git',
      assignmentData
    );

    expect(result.status).toBe('success');
    expect(existsSync(customFile)).toBe(false); // Should be cleaned up!
  });

  test('cloneRepository pulls and reports up-to-date when repo already exists and no new commits', async () => {
    const studentName = 'Test Student';
    const assignmentId = 44;
    const studentDir = join(tempGradingDir, studentName);
    const assignmentDir = join(studentDir, String(assignmentId));

    // Simulate pre-existing git repository
    mkdirSync(join(assignmentDir, '.git'), { recursive: true });

    const assignmentData = {
      assignmentId,
      assignmentName: 'Test Assignment',
      criteria: [],
      submissions: []
    };

    const result = await cloneRepository(
      studentName,
      assignmentId,
      'https://github.com/test-user/test-repo.git',
      assignmentData
    );

    expect(result.status).toBe('success');
    expect(result.updated).toBe(false);
  });

  test('cloneRepository pulls and reports updated when repo already exists and new commits are available', async () => {
    const studentName = 'Test Student';
    const assignmentId = 45;
    const studentDir = join(tempGradingDir, studentName);
    const assignmentDir = join(studentDir, String(assignmentId));

    // Simulate pre-existing git repository
    mkdirSync(join(assignmentDir, '.git'), { recursive: true });

    // Set initial commit hash
    writeFileSync(join(assignmentDir, 'mock_commit'), 'a1b2c3d');
    // Set target commit hash for pull
    writeFileSync(join(assignmentDir, 'mock_pull_target'), 'e5f6g7h');

    const assignmentData = {
      assignmentId,
      assignmentName: 'Test Assignment',
      criteria: [],
      submissions: []
    };

    const result = await cloneRepository(
      studentName,
      assignmentId,
      'https://github.com/test-user/test-repo.git',
      assignmentData
    );

    expect(result.status).toBe('success');
    expect(result.updated).toBe(true);
  });

  test('cloneRepository reports exact git stderr and URL when cloning fails', async () => {
    const studentName = 'Test Student';
    const assignmentId = 46;

    const assignmentData = {
      assignmentId,
      assignmentName: 'Test Assignment',
      criteria: [],
      submissions: []
    };

    const result = await cloneRepository(
      studentName,
      assignmentId,
      'invalid-url',
      assignmentData
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain("fatal: repository 'invalid-url' not found");
    expect(result.error).toContain('invalid-url');
  });

  test('cloneRepository reports exact git stderr and URL when pulling fails', async () => {
    const studentName = 'Test Student';
    const assignmentId = 47;
    const studentDir = join(tempGradingDir, studentName);
    const assignmentDir = join(studentDir, String(assignmentId));

    // Simulate pre-existing git repository
    mkdirSync(join(assignmentDir, '.git'), { recursive: true });

    // Mark as pull failure
    writeFileSync(join(assignmentDir, 'mock_pull_fail'), '1');

    const assignmentData = {
      assignmentId,
      assignmentName: 'Test Assignment',
      criteria: [],
      submissions: []
    };

    const result = await cloneRepository(
      studentName,
      assignmentId,
      'https://github.com/test-user/test-repo.git',
      assignmentData
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('fatal: Remote branch not found');
    expect(result.error).toContain('https://github.com/test-user/test-repo.git');
  });
});
