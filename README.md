# Chapter Quiz Hub · University of Kalba

Open-practice chapter quizzes for Dr Arun Korath's courses (MGMT160, MGMT363, MGMT464).

- `index.html` — student site (subject → chapter → Quiz 1 Ideas / Quiz 2 Applied → score + review; anonymised dashboard)
- `teacher.html` — teacher panel (subjects, chapters, question banks, videos, students & attempts, CSV export); needs the teacher key
- `apps-script/Code.gs` — the Google Apps Script backend (Google Sheet tabs: Subjects, Chapters, Questions, Videos, Students, Attempts)
- `config.json` — `scriptUrl` of the deployed Apps Script web app
- `uploads/` + `.github/workflows/generate.yml` + `scripts/generate.py` — drop a chapter deck in, drafts are generated with the Claude API into the Sheet

## One-time setup
1. Create a Google Sheet → Extensions → Apps Script → paste `apps-script/Code.gs` → Run `setup()` once (authorise) → note the TEACHER_KEY in the log.
2. Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone** → copy the `/exec` URL into `config.json`.
3. In teacher.html enter the teacher key; add subjects; seed the question banks (JSON); add videos.
4. (Optional) Repo → Settings → Secrets: `ANTHROPIC_API_KEY`, `APPS_SCRIPT_URL`, `TEACHER_KEY` to enable automatic generation on deck upload.

Students' names and IDs live only in the Sheet; the public site shows codenames.

## Student site themes (one world per subject)

| Subject | World | Inspiration |
|---|---|---|
| MGMT160 | **Night Drive** — neon road, car at your last checkpoint | bruno-simon.com |
| MGMT363 | **Idea Island** — low-poly island, drag-to-rotate ring of chapters | joshuasworld.netlify.app |
| MGMT464 | **The Leadership Gallery** — torch-lit, gold-framed chapter plates | adrianleon.art |

Mapping lives in `index.html` → `SUBJECT_THEME`. Any new subject code without a mapping cycles through the three themes.

### Game-style quiz
One question at a time, instant feedback (server sends a salted SHA-256 of the correct option, never the answer in clear text), streaks, XP with speed bonus, confetti, keyboard 1–4 / Enter, rank title at the end. The official score is still graded and recorded server-side on submit.
