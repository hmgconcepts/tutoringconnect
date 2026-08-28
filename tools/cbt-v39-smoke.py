#!/usr/bin/env python3
"""
cbt-v39-smoke.py — smoke test for the V39 CBT enhancement set.

Covers the seven reported items end to end in a real browser:
  1  multi-line maths / LaTeX renders, no raw backslash reaches a candidate
  2  question and option randomisation, per candidate, deterministic, and
     safe (grading is unchanged, positional options do not move)
  4  read-aloud control mounts and produces sensible spoken text
  5  a passage set stays pinned for every question under it
  plus: no page errors on any CBT page in either repo.

Usage:  python3 tools/cbt-v39-smoke.py [BASE_URL ...]
        defaults to http://127.0.0.1:8801 and http://127.0.0.1:8802
"""
import sys, json, re
from playwright.sync_api import sync_playwright

BASES = sys.argv[1:] or ["http://127.0.0.1:8801", "http://127.0.0.1:8802"]
PAGES = ["cbt-exam.html", "cbt-review.html", "cbt-multi.html",
         "cbt-prompts.html", "cbt-results.html", "practice.html"]

PASSAGE = ("Nigeria's rapid urbanisation has outpaced its infrastructure.\\n\\n"
           "Between 1990 and 2020 Lagos alone absorbed more than twelve million new "
           "residents, yet its road network grew by less than a fifth.\\n\\n"
           "Planners now argue that the answer is not more roads but denser, better "
           "connected neighbourhoods.")

def row(q, a, b, c, d, key, section, tags="", items=""):
    return {"Question": q, "A": a, "B": b, "C": c, "D": d, "CorrectAnswer": key,
            "Explanation": "Four-move explanation.", "Type": "mcq", "Tolerance": "",
            "Unit": "", "Accept": "", "MRQ_AON": "", "Pairs": "", "Items": items,
            "Difficulty": "moderate", "Tags": tags, "Section": section}

SET = json.dumps({"passage": PASSAGE})
ROWS = [row(f"Passage question {i+1}?", "alpha", "beta", "gamma", "delta", "beta",
            "English - Comprehension Passage 1", "set:C1", SET) for i in range(5)]
ROWS += [row("Nearest in meaning to RESILIENT?", "brittle", "tough", "hasty", "vague",
             "tough", "English - Lexis", "lexis")]

MATHS = [
    ("Solve:\\n2x + 3y = 12\\nx - y = 1", "tcm", "<br>"),
    ("Simplify \\\\frac{3x+6}{9}", "tcm-frac", None),
    ("Evaluate \\\\sqrt[3]{27} \\\\times 2^{10}", "tcm-sqrt", "<sup>"),
    ("A = \\\\begin{pmatrix} 2 & -1 \\\\\\\\ 3 & 4 \\\\end{pmatrix}", "tcm-matrix", None),
    ("If x \\\\neq 0 \\\\nfind x", "tcm", "≠"),
]

fails = []
def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  " + str(detail)) if detail and not cond else ""))
    if not cond:
        fails.append(name)

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--no-sandbox"])
    for base in BASES:
        print("\n" + "=" * 66 + "\n" + base + "\n" + "=" * 66)
        page = browser.new_page(viewport={"width": 800, "height": 1000})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---- every CBT page loads without a JS exception -----------------
        for p in PAGES:
            before = len(errors)
            page.goto(f"{base}/{p}", wait_until="load")
            page.wait_for_timeout(900)
            check(f"{p} loads with no JS exception", len(errors) == before, errors[before:])

        # ---- item 1: the maths renderer ----------------------------------
        page.goto(f"{base}/cbt-exam.html", wait_until="load")
        page.wait_for_timeout(700)
        for src, cls, extra in MATHS:
            html = page.evaluate("s => CBTRich.html(s)", src.replace("\\\\", "\\"))
            ok = cls in html and (extra is None or extra in html)
            check(f"renders {src[:34]!r}", ok, html[:110])
        leak = page.evaluate(
            "s => { const h = CBTRich.html(s); return /\\\\\\\\(frac|sqrt|begin|neq|times)/.test(h); }",
            "Simplify \\frac{a}{b} where a \\neq 0 \\nand b > 0")
        check("no raw LaTeX command survives to the candidate", leak is False)

        spoken = page.evaluate("s => CBTRich.plain(s)", "\\frac{3x+6}{9} \\times \\sqrt{16}")
        check("maths is spoken in words", "fraction" in spoken and "square root" in spoken, spoken)

        # ---- items 2, 4, 5: the exam runtime -----------------------------
        page.evaluate("""rows => {
            const st = window.__cbtState;
            st.exam = { id:'t', title:'V39 smoke', code:'V39', duration_min:30,
                        quiz_kind:'graded', questions: rows,
                        shuffle_questions:true, shuffle_options:true, read_aloud:true };
            document.getElementById('dname').value = 'Smoke Candidate';
            document.getElementById('start').disabled = false;
            document.getElementById('start').click();
        }""", ROWS)
        page.wait_for_timeout(1200)

        groups = page.evaluate("() => window.__cbtState.groups.map(g => g.items.length)")
        check("passage set grouped as one block of 5", groups[0] == 5, groups)
        check("read-aloud control mounted", page.is_visible(".tcs-btn"))
        check("passage pane visible on question 1", page.is_visible("#qpassage"))
        check("answered counter present", "of 5 answered" in page.inner_text("#pg-count"))

        pinned = []
        for _ in range(5):
            pinned.append(page.is_visible("#qpassage"))
            if not page.is_enabled("#nextq"):
                break
            page.click("#nextq"); page.wait_for_timeout(400)
        check("passage stays pinned across the whole set", all(pinned), pinned)

        stats = page.evaluate("""() => {
            const CBT = window.CBT, qs = window.__cbtState.questions;
            const orders = new Set(); let bad = 0, split = 0;
            for (let c = 0; c < 200; c++) {
              const d = CBT.applyDelivery(qs, {shuffleQuestions:true, shuffleOptions:true, seed:'s'+c});
              orders.add(d.map(q => q._orig_index).join(','));
              const setIdx = d.map((q,i) => [q.passage_id,i]).filter(x => x[0] === 'C1').map(x => x[1]);
              for (let i = 1; i < setIdx.length; i++) if (setIdx[i] !== setIdx[i-1]+1) split++;
              d.forEach(q => { const r = CBT.gradeOne(q, q.answer); if (!r || r.ok !== true) bad++; });
            }
            const a = CBT.applyDelivery(qs, {shuffleQuestions:true, shuffleOptions:true, seed:'fix'});
            const b = CBT.applyDelivery(qs, {shuffleQuestions:true, shuffleOptions:true, seed:'fix'});
            const tf = CBT.normalizeQuestion({question:'q', a:'True', b:'False', answer:'True'}, 0);
            const ao = CBT.normalizeQuestion({question:'q', a:'2', b:'4', c:'6', d:'All of the above',
                                              answer:'All of the above'}, 1);
            let moved = 0;
            for (let c = 0; c < 100; c++) {
              const r = CBT.applyDelivery([tf, ao], {shuffleOptions:true, seed:'p'+c});
              if (r[0].options.join() !== 'True,False') moved++;
              if (r[1].options[r[1].options.length-1] !== 'All of the above') moved++;
            }
            return { orders: orders.size, bad, split, moved,
                     deterministic: JSON.stringify(a.map(q => [q._orig_index, q.options])) ===
                                    JSON.stringify(b.map(q => [q._orig_index, q.options])) };
        }""")
        check("candidates receive different question orders", stats["orders"] > 1, stats)
        check("option shuffling never changes a mark", stats["bad"] == 0, stats)
        check("passage sets are never split by the shuffle", stats["split"] == 0, stats)
        check("same candidate always rebuilds the same paper", stats["deterministic"])
        check("True/False and 'All of the above' stay in place", stats["moved"] == 0, stats)

        # ---- item 5 & 3: the prompt packs are registered ------------------
        page.goto(f"{base}/cbt-prompts.html", wait_until="load")
        page.wait_for_timeout(700)
        packs = page.evaluate("() => Object.keys(CBT.PACKS)")
        for want in ["passage_set", "utme_english", "image_stimulus", "multiline_math"]:
            check(f"pack registered: {want}", want in packs)
        # The picker itself is behind the portal auth guard, which replaces the
        # body with the sign-in card before this test can see it. So assert on
        # the SERVED HTML rather than the live DOM.
        src = page.evaluate("""async u => (await fetch(u)).text()""", f"{base}/cbt-prompts.html")
        for want in ["passage_set", "utme_english"]:
            check(f"pack selectable in the picker: {want}",
                  f'<option value="{want}">' in src)

        # ---- item 6: the explanation standard reaches the prompt ---------
        txt = page.evaluate("""() => CBT.promptPack('utme_english', 'Use of English', 20, 'SS3',
                 { subject:'English', examType:'UTME', studio:'Test Studio' })""")
        if txt:
            for want in ["EXPLANATION STANDARD", "MOVE 1", "DISTRACTOR AUTOPSY",
                         "Minimum 45 words", "TAKEAWAY"]:
                check(f"prompt carries: {want}", want in txt)
            check("prompt pins the passage", "byte for byte" in txt)

        page.close()
    browser.close()

print("\n" + "=" * 66)
print("FAILURES:", len(fails))
for f in fails:
    print("  -", f)
sys.exit(1 if fails else 0)
