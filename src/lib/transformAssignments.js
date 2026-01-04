/**
 * Transforms API assignment data for notification to the web dashboard.
 * Includes both aggregated counts and individual submission details.
 *
 * @param {Array} assignments - Raw assignment data from API
 * @returns {Array} Transformed assignments with individual submissions
 */
export function transformAssignmentsForNotification(assignments) {
  return assignments.map(a => ({
    id: a.assignmentId,
    name: a.assignmentName,
    submissions: a.submissions.length,
    ungraded: a.submissions.filter(s => !s.isGraded).length,
    individualSubmissions: a.submissions.map(s => ({
      userId: s.userId,
      studentName: s.studentName,
      solutionUrl: s.solutionUrl,
      submittedAt: s.submittedAt,
      isGraded: s.isGraded
    }))
  }));
}
