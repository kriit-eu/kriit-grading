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

## Requirements

Only two external dependencies:

| Dependency | Purpose |
|------------|---------|
| **Bun** | JavaScript runtime and package manager |
| **Git** | Cloning student repositories |

### Installation by OS

**macOS:**
```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Git (via Xcode Command Line Tools)
xcode-select --install
```

**Debian/Ubuntu:**
```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Git
sudo apt update && sudo apt install -y git
```

**Fedora:**
```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Git
sudo dnf install -y git
```

**Alpine:**
```bash
# Bun (requires glibc, not musl - use unzip method)
apk add --no-cache curl unzip git
curl -fsSL https://bun.sh/install | bash
```

## Installation

```bash
git clone https://github.com/kriit-eu/kriit-grading.git
cd kriit-grading
bun install
cd web && bun install && cd ..
bun run setup
```

The `bun run setup` command creates a `.env` file from the template. Edit it to add your API credentials:

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

## Google Drive Access (Optional)

If students submit Google Drive links, Claude needs OAuth access to read those files. This requires a one-time setup.

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click project dropdown (top left) → **New Project** → Name it "Kriit Grading" → **Create**
3. Wait for project creation, then select it from the dropdown
4. Go to **APIs & Services** → **Library** (left menu)
5. Search for "Google Drive API" → Click it → **Enable**

### 2. Configure OAuth Consent Screen

1. In left menu, go to **Google Auth Platform** → **Overview**
2. Click **Get started**
3. Step 1 "App Information":
   - **App name**: `Kriit Grading MCP`
   - **User support email**: Select your email from dropdown
   - Click **Next**
4. Step 2 "Audience":
   - Select **External** (allows any Google account, required for non-Workspace users)
   - Click **Next**
5. Step 3 "Contact Information":
   - **Email addresses**: Your email
   - Click **Next**
6. Step 4 "Finish":
   - Check **I agree to the Google API Services: User Data Policy**
   - Click **Continue**, then **Create**

### 3. Create OAuth Client

1. Go to **Clients** → **Create OAuth client** (or click the link on Overview page)
2. **Application type**: Select **Desktop app**
3. **Name**: `Kriit Grading MCP`
4. Click **Create**
5. In the "OAuth client created" dialog, click **Download JSON**
6. Save to your **Downloads folder** (file will be named `client_secret_...json`)

### 4. Add Test User

Since the app is in "Testing" mode, you must add yourself as a test user:

1. Go to **Audience** (left menu) → **Add users**
2. Enter your Google email address
3. Click **Save**

### 5. Setup MCP Server

Run the setup script (it looks for credentials in `~/Downloads` by default):

```bash
bun run setup:gdrive
# Or specify path: bun run setup:gdrive -- /path/to/client_secret.json
```

This script is safe to run multiple times. It will:
- Copy credentials to `~/.config/google-drive-mcp/` (overwrites existing)
- Configure MCP server in Claude Code (replaces existing if present)
- Open browser for Google authentication

After authentication, restart Claude Code.

**Available MCP tools:**
- `search` - Search for files across Google Drive
- `listFolder` - List files in a folder
- `getGoogleDocContent` - Read Google Docs content
- `getGoogleSheetContent` - Read Google Sheets data
- `createTextFile`, `updateTextFile` - Create/update text files

**To verify it works**, ask Claude: "List my recent Google Drive files" or provide a Drive link.

**Re-authentication** (when token expires after 7 days):
```bash
bun run setup:gdrive
```

## Web Dashboard

Real-time dashboard showing grading progress. Start the server:

```bash
bun start
```

Open http://localhost:3000 to see:
- Statistics cards (assignments, submissions, ungraded)
- Progress bar during operations
- Clone/submit status per student
- Plagiarism matches with similarity scores

The dashboard updates automatically as CLI commands run.

## Workflow

The grading process follows these steps:

```
bun start           → Start web dashboard (optional)
bun run list        → Fetch ungraded assignments
bun run clone       → Clone student repositories
bun run plagiarism  → Check for plagiarism
[Grade work]        → Review and grade each submission
bun run submit      → Submit feedback to Kriit
```

## Commands

### `bun run list`

Fetches all ungraded assignments from Kriit API and saves them to `grading-batch.json`.

```bash
bun run list              # Fetch and display summary
bun run list --verbose    # Show detailed output
bun run list --dry-run    # Preview without saving
```

### `bun run clone`

Clones all student repositories from `grading-batch.json` in parallel.

```bash
bun run clone             # Clone all repositories
bun run clone --verbose   # Show detailed output
bun run clone --dry-run   # Preview without cloning
bun run clone --strict    # Exit with error if any clone fails
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

### `bun run plagiarism`

Multi-level plagiarism detection across all cloned repositories.

```bash
bun run plagiarism              # Run detection
bun run plagiarism --verbose    # Show detailed matches
bun run plagiarism --threshold=0.90  # Custom threshold (default: 0.85)
bun run plagiarism --dry-run    # Preview without saving reports
```

Detection levels:
1. **EXACT** - MD5 hash matching (identical files)
2. **NORMALIZED** - Similarity after removing comments/whitespace
3. **STRUCTURAL** - Same structure with different variable names
4. **PARTIAL_STRUCTURAL** - Partial structural similarity

Reports are saved to `plagiarism-reports/{assignmentId}.json`.

### `bun run submit`

Submits AI grading feedback to Kriit.

```bash
bun run submit "Mari Maasikas" 42    # Submit single assignment
bun run submit --all                 # Submit all with ai_feedback.md
bun run submit --dry-run             # Preview without submitting
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
│   ├── submit.js         # Submit feedback
│   └── lib/
│       └── notify.js     # Web dashboard notifications
├── web/                  # SvelteKit dashboard
│   ├── src/
│   │   ├── routes/       # Pages and API endpoints
│   │   └── lib/          # Components and stores
│   └── package.json
├── tests/                # Unit and e2e tests
├── student-grading/      # Cloned repos (gitignored)
├── plagiarism-reports/   # Detection reports (gitignored)
└── grading-batch.json    # Current batch (gitignored)
```

## License

MIT
