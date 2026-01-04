import { test, expect, describe } from 'bun:test';
import { transformAssignmentsForNotification } from '../src/lib/transformAssignments.js';

describe('transformAssignmentsForNotification', () => {
  const mockApiResponse = [
    {
      assignmentId: 1,
      assignmentName: 'Test Assignment',
      submissions: [
        {
          userId: 1,
          studentName: 'Alice',
          solutionUrl: 'https://example.com/alice',
          submittedAt: '2025-01-01 10:00:00',
          isGraded: false
        },
        {
          userId: 2,
          studentName: 'Bob',
          solutionUrl: 'https://example.com/bob',
          submittedAt: '2025-01-02 11:00:00',
          isGraded: true
        }
      ],
      criteria: []
    }
  ];

  test('includes individual submissions in transformed output', () => {
    const result = transformAssignmentsForNotification(mockApiResponse);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].name).toBe('Test Assignment');
    expect(result[0].submissions).toBe(2);
    expect(result[0].ungraded).toBe(1);

    // This is the new requirement: individual submissions should be included
    expect(result[0].individualSubmissions).toBeDefined();
    expect(result[0].individualSubmissions).toHaveLength(2);
    expect(result[0].individualSubmissions[0]).toEqual({
      userId: 1,
      studentName: 'Alice',
      solutionUrl: 'https://example.com/alice',
      submittedAt: '2025-01-01 10:00:00',
      isGraded: false
    });
  });

  test('handles empty assignments array', () => {
    const result = transformAssignmentsForNotification([]);
    expect(result).toEqual([]);
  });

  test('handles assignment with no submissions', () => {
    const result = transformAssignmentsForNotification([
      { assignmentId: 2, assignmentName: 'Empty', submissions: [], criteria: [] }
    ]);

    expect(result[0].submissions).toBe(0);
    expect(result[0].ungraded).toBe(0);
    expect(result[0].individualSubmissions).toEqual([]);
  });
});
