"""Generate 30 draft MCQs (15 Ideas, 15 Applied) from one chapter deck and send them
to the Google Sheet (Questions tab, status=draft) through the Apps Script backend.
Usage: python scripts/generate.py uploads/MGMT160/ch01_What_Managers_Do.pptx
Env: ANTHROPIC_API_KEY, APPS_SCRIPT_URL, TEACHER_KEY
"""
import json, os, re, sys, requests
from pptx import Presentation
import anthropic

path = sys.argv[1]
m = re.match(r'uploads/([A-Za-z0-9]+)/ch(\d+)[_\-]?(.*)\.pptx$', path, re.I)
if not m:
    sys.exit(f'File name must look like uploads/SUBJECT/chNN_Title.pptx — got {path}')
subject, chapter, title = m.group(1).upper(), int(m.group(2)), m.group(3).replace('_', ' ').strip() or f'Chapter {m.group(2)}'

p = Presentation(path); parts = []
for i, s in enumerate(p.slides, 1):
    parts.append(f'--- SLIDE {i} ---')
    for sh in s.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip(): parts.append(sh.text_frame.text.strip())
        if getattr(sh, 'has_table', False) and sh.has_table:
            for r in sh.table.rows: parts.append(' | '.join(c.text.strip() for c in r.cells))
deck = '\n'.join(parts)[:60000]

RULES = f"""You write multiple-choice practice questions for first-year business students at the University of Kalba (UAE), who read English at about Grade-11 level.
Course: {subject}. Chapter {chapter}: {title}. Use ONLY the slide text below — every question must be answerable from it and must name the slide section it comes from (e.g. "1.3").
Produce exactly 30 questions as JSON: 15 with "quiz":1 (Ideas — Bloom level Understand: define, describe, identify, explain) and 15 with "quiz":2 (Applied — Bloom levels Apply or Analyse: situations, classify, determine, select, compare, analyse). Never use Evaluate.
Rules for every question:
- The stem must START with a Bloom verb such as Identify, Describe, Explain, Differentiate, Classify, Determine, Select, Apply, Analyse, Compare. Never start with What, Which, Why, How or Who.
- Very simple English, short stems, short options, keep the course's own terms.
- Exactly 4 options, one correct (put it first — the site shuffles), three plausible distractors of similar length.
- "clo": the course learning outcome the slide maps to (e.g. "CLO 1"); "sec": the slide section number; "bloom": Understand / Apply / Analyse.
- "why": one or two sentences explaining the correct answer and ending with "See §<section>".
- "id": "{subject[-3:]}-{chapter:02d}-I01".."I15" for quiz 1 and "A01".."A15" for quiz 2.
Return ONLY a JSON object: {{"subject":"{subject}","chapter":{chapter},"title":"{title}","clos":["CLO 1"],"questions":[...]}} with each question having id, quiz, bloom, clo, sec, stem, options (4), answer (0), why."""

client = anthropic.Anthropic()
msg = client.messages.create(model='claude-sonnet-4-5', max_tokens=12000, temperature=0.3,
    messages=[{'role': 'user', 'content': RULES + '\n\nSLIDE TEXT:\n' + deck}])
text = msg.content[0].text
text = text[text.find('{'): text.rfind('}') + 1]
bank = json.loads(text)
assert len(bank['questions']) >= 20, 'too few questions generated'
for q in bank['questions']:
    assert len(q['options']) == 4
    first = q['stem'].split()[0].lower().strip(',')
    assert first not in ('what', 'which', 'why', 'how', 'who'), f"bad stem: {q['stem']}"

r = requests.post(os.environ['APPS_SCRIPT_URL'], data=json.dumps({'action': 'seedQuestions', 'key': os.environ['TEACHER_KEY'], 'bank': bank, 'status': 'draft', 'replaceChapter': False}), headers={'Content-Type': 'text/plain;charset=utf-8'}, timeout=120)
print(subject, chapter, title, '->', r.text)
json.dump(bank, open(f'generated_{subject}_ch{chapter:02d}.json', 'w'), indent=1)
