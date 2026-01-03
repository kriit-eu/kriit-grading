# Kriit Grading

AI grading assistant for Kriit learning management system. This tool helps automate the grading workflow by fetching ungraded assignments, cloning student repositories, detecting plagiarism, **evaluating and grading student code**, and submitting feedback.

It works by providing Claude with structured instructions (in `CLAUDE.md`) for evaluating programming assignments. Claude clones the student repositories, runs the code in Docker containers, checks against assignment criteria, detects plagiarism, and generates feedback in Estonian.

**Grading outcomes:**

- **High confidence pass** - When Claude is confident that all criteria are met and there are no issues, the grade is automatically applied to the student's assignment (if `AUTO_APPROVE_HIGH_CONFIDENCE=true` in `.env`). The student sees their grade immediately.

- **Any suspicion or uncertainty** - When Claude detects potential issues (plagiarism, incomplete criteria, code that doesn't run, or low confidence), it does NOT auto-approve. Instead, it leaves a **teacher-only visible comment** in Kriit with detailed findings. The teacher can then review the submission, read Claude's analysis, and decide whether to approve, modify the grade, or request resubmission.

This two-tier approach ensures that clear passes are processed quickly while anything questionable gets human review.

**Grade types:**

- **Pass/fail assignments** (`A`/`MA`) - Claude evaluates whether all required criteria are met. If everything works correctly, the grade is `A` (arvestatud/passed). If any criterion fails, the grade is `MA` (mittearvestatud/not passed) with detailed feedback on what needs to be fixed.

- **Numeric grades** (`1`-`5`) - Claude evaluates each criterion and calculates a grade based on completion percentage. Grade `5` requires all criteria met with quality code. Lower grades reflect partial completion or quality issues. Detailed feedback explains which criteria passed/failed and why.

## Installation

```bash
git clone https://github.com/kriit-eu/kriit-grading.git
cd kriit-grading
bun setup
```

The `bun setup` command creates a `.env` file from the template. Edit it to add your API credentials:

```bash
KRIIT_API_URL=https://kriit.vikk.ee
KRIIT_API_KEY=your_api_key_here
AUTO_APPROVE_HIGH_CONFIDENCE=true  # Set to false to require teacher approval for all
```

## Getting Started

1. Open the project directory in [Claude Code](https://claude.ai/download):
   ```bash
   cd kriit-grading
   claude
   ```

2. Ask Claude to start grading:
   ```
   Grade student assignments
   ```

3. Claude will automatically:
   - Read `CLAUDE.md` for grading instructions
   - Fetch ungraded assignments from Kriit API
   - Clone student repositories
   - Run plagiarism detection
   - Test each submission in Docker
   - Generate feedback in Estonian
   - Submit grades back to Kriit

You can also ask Claude to grade specific assignments or re-evaluate submissions.

## Workflow

The grading process follows these steps:

```
bun list        → Fetch ungraded assignments
bun clone       → Clone student repositories
bun plagiarism  → Check for plagiarism
[Grade work]    → Review and grade each submission
bun submit      → Submit feedback to Kriit
```

## Commands

### `bun list`

Fetches all ungraded assignments from Kriit API and saves them to `grading-batch.json`.

```bash
bun list              # Fetch and display summary
bun list --verbose    # Show detailed output
bun list --dry-run    # Preview without saving
```

### `bun clone`

Clones all student repositories from `grading-batch.json` in parallel.

```bash
bun clone             # Clone all repositories
bun clone --verbose   # Show detailed output
bun clone --dry-run   # Preview without cloning
bun clone --strict    # Exit with error if any clone fails
```

Creates directory structure:
```
student-grading/
├── Mari Maasikas/
│   └── 42/
│       ├── [cloned repo]
│       └── assignment_data.json
└── Jaan Tamm/
    └── 42/
        └── [cloned repo]
```

### `bun plagiarism`

Multi-level plagiarism detection across all cloned repositories.

```bash
bun plagiarism              # Run detection
bun plagiarism --verbose    # Show detailed matches
bun plagiarism --threshold=0.90  # Custom threshold (default: 0.85)
bun plagiarism --dry-run    # Preview without saving reports
```

Detection levels:
1. **EXACT** - MD5 hash matching (identical files)
2. **NORMALIZED** - Similarity after removing comments/whitespace
3. **STRUCTURAL** - Same structure with different variable names
4. **PARTIAL_STRUCTURAL** - Partial structural similarity

Reports are saved to `plagiarism-reports/{assignmentId}.json`.

### `bun submit`

Submits AI grading feedback to Kriit.

```bash
bun submit "Mari Maasikas" 42    # Submit single assignment
bun submit --all                 # Submit all with ai_feedback.md
bun submit --dry-run             # Preview without submitting
```

The tool looks for `ai_feedback.md` in each assignment directory.

## API Reference

### GET /api/grading/getUngradedBatch

Returns all ungraded assignments grouped by assignment ID.

### POST /api/grading/submitAiFeedback

Submit AI grading feedback with:
- `assignmentId` - Assignment ID
- `userId` - Student user ID
- `completedCriteria` - Array of completed criterion IDs
- `incompleteCriteria` - Array of incomplete criterion IDs
- `criteriaNotEvaluated` - Array of unevaluated criterion IDs
- `suggestedGrade` - "1"-"5", "A", or "MA"
- `feedbackText` - Feedback text (in Estonian)
- `isConfidentPass` - Boolean
- `autoApprove` - Boolean
- `confidenceScore` - 0.0-1.0

### PUT /api/grading/editAiFeedback

Edit previously submitted feedback with:
- `assignmentId` - Assignment ID
- `userId` - Student user ID
- `feedbackText` - Updated feedback text

## Directory Structure

```
kriit-grading/
├── .env                  # API credentials (gitignored)
├── .env.example          # Credential template
├── package.json
├── README.md             # This file
├── CLAUDE.md             # AI assistant instructions
├── src/
│   ├── config.js         # Configuration loader
│   ├── api.js            # API client
│   ├── list.js           # Fetch ungraded assignments
│   ├── clone.js          # Clone repositories
│   ├── plagiarism.js     # Plagiarism detection
│   └── submit.js         # Submit feedback
├── student-grading/      # Cloned repos (gitignored)
├── plagiarism-reports/   # Detection reports (gitignored)
└── grading-batch.json    # Current batch (gitignored)
```

## License

MIT
