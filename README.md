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
