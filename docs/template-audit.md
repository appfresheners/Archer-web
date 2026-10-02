# Template Audit — Reverse Goal Setting (Justin Sung Framework)

> This document assesses both existing templates against the canonical framework
> documented in `Reverse goal setting data.md`. Each gap is rated by severity:
> 🔴 Critical — breaks the logic of the framework
> 🟡 Important — weakens the method meaningfully
> 🟢 Minor — small omission or wording issue

---

## Template 1: Reverse Goal Setting Template

**File:** `Reverse Goal setting template.md`

### ✅ What it gets right

- Has all five steps in the correct sequence
- Uses the 1–10 rating scale for capabilities and resources
- Separates Target Profile (Step 2) from Current Profile (Step 3) — the core gap mechanic is present
- Has a Force Field section with Drivers and Barriers
- Has a Monthly Goal Check

---

### ❌ Gaps and Issues

#### 🔴 Gap 1 — Step 1 is missing the "Why" anchor

**What the template has:**
```
By [date], I will have: ...
I'll know I succeeded when: ...
```

**What Justin Sung requires:**
Step 1 is not just about defining the goal — it's about anchoring on the *underlying outcome*: the feeling, situation, or position the goal is meant to create. Without this, the user has no fixed point to hold when the goal needs to change. This is the most important philosophical concept in the entire framework.

**Fix needed:** Add a "Why this goal?" field directly under the goal statement. Something like:
- *What feeling or situation do I think achieving this will create?*
- *If I discover this goal won't deliver that, what would I pivot to?*

---

#### 🔴 Gap 2 — Step 2 scoring is measuring the wrong thing

**What the template has:**
```
Score each item by how important it is for success.
10 = essential | 5 = useful | 1 = barely relevant
```

**What Justin Sung requires:**
The rating is **not** about how important the attribute is. It's about **what level you need to be at** to have a high probability of success. These are completely different questions.

- Importance: "Is time management relevant?" → Yes, obviously
- Required level: "What level of time management do I actually need?" → Maybe only a 5/10, not a 10/10

Getting this wrong means the gap calculation in Step 3 is meaningless — you can't subtract "importance" from "my current level" and get a useful number.

**Fix needed:** Change the scoring instruction to:
```
Rate each item by the level you need to reach to succeed at this goal.
10 = you need to be near-expert level
5 = you need solid working competence
1 = a basic level is enough
```

---

#### 🟡 Gap 3 — No prioritization guidance after Step 3

**What the template has:**
Step 5 asks the user to "choose the highest gaps from Step 3."

**What Justin Sung requires:**
Prioritization uses a two-factor rule: focus on attributes where (a) the **required level is highest** AND (b) the **gap is widest**. These tend to coincide but not always. More importantly, Justin Sung is explicit that you pick **2–3 maximum** and work on those exclusively before shifting focus.

The template jumps from the gap table straight to filling in a priority card without explaining the selection logic.

**Fix needed:** Add a prioritization instruction between Step 3 and Step 5:
```
To choose your priorities: look for attributes where the required level is highest
AND the gap is widest. These are the things most important to your goal and
furthest from where you are now. Pick 2–3 only. Do not work on anything else
until these improve.
```

---

#### 🟡 Gap 4 — Force Field Analysis conflates Drivers and Resources

**What the template has:**
```
## Drivers (Things that help me)
## Barriers (Things that block me)
```

Resources are not separately called out — the template only shows Drivers and Barriers.

**What Justin Sung requires:**
Justin Sung explicitly separates **Drivers** (internal — your existing skills, habits, motivation, personality strengths) from **Resources** (external — time, money, people/network, tools, technology, courses, environments). This distinction matters because the strategies for deploying them are different. You leverage internal drivers differently from external resources.

**Fix needed:** Split the left side of the Force Field into two distinct sections:
```
Drivers — internal strengths (existing skills, habits, personal attributes)
Resources — external assets (time, money, network, tools, access to opportunities)
```

---

#### 🟡 Gap 5 — Step 5 does not capture the max-2 action plan

**What the template has:**
Step 5 selects the top gaps and asks for a "Project idea" and "First next action idea."

**What Justin Sung requires:**
Step 5 is specifically an **action plan with a hard cap of 2 focus points at any time**. It's not a project planning exercise — it's about distilling everything into the smallest possible immediate commitment. The two points might not even be skill development; they could be barrier removal (e.g., getting a part-time job so you can afford to move out).

The template routes straight to a project database which is a GTD overlay — useful, but it replaces the simplicity of "here are your 2 focus points right now" with a more complex planning layer.

**Fix needed:** Add an explicit "My 2 focus points this period" section as the core output of Step 5, before the project link. Keep it blunt:
```
Focus point 1: [one specific thing to work on]
Focus point 2: [one specific thing to work on]
These are the only things I'm improving right now.
```

---

#### 🟢 Gap 6 — Review cadences are missing from the template body

**What the template has:**
A "Monthly Goal Check" at the end.

**What Justin Sung requires:**
Four distinct review loops at different frequencies:
- Action plan: every 1–2 days
- Force field: every 1–2 weeks
- Gap/current level: every 2–4 weeks
- Goal alignment: every 1–2 months

**Fix needed:** Add a "Review Schedule" section — either at the end or embedded next to each relevant section. The monthly check alone is not sufficient.

---

### Summary — Template 1

| Gap | Severity | Fix |
|---|---|---|
| Missing "why" anchor in Step 1 | 🔴 Critical | Add underlying outcome + pivot permission field |
| Step 2 scores importance not required level | 🔴 Critical | Rewrite scoring instruction |
| No 2–3 max prioritization rule | 🟡 Important | Add selection guidance before Step 5 |
| Drivers and Resources conflated | 🟡 Important | Split Force Field left side into two sections |
| Step 5 missing max-2 action plan cap | 🟡 Important | Add explicit "2 focus points" output |
| Review cadences incomplete | 🟢 Minor | Add full review schedule |

---

---

## Template 2: MASTER GOAL → GTD PROJECT SYSTEM PROMPT

**File:** `MASTER GOAL → GTD PROJECT SYSTEM PROMPT.md`

### ✅ What it gets right

- Has a capability and resource analysis step (Steps 2–3)
- Output is outcome-based GTD projects — which aligns with Justin Sung's emphasis on actionable plans
- The "what does someone who achieves this easily have?" framing in Step 2 is directly from Justin Sung
- GTD next action discipline (physical, small, verb-first) is excellent execution hygiene

---

### ❌ Gaps and Issues

#### 🔴 Gap 1 — Skips the core of reverse goal setting: the gap and the person

**What the template has:**
Step 2 asks what the achiever has. Step 3 asks what resources they have. Step 4 immediately produces GTD projects.

**What Justin Sung requires:**
After defining the future self (Step 2), you must define your **current self** (Step 3) using the same attributes, calculate the gap, and let that gap drive what projects and actions are created. Without assessing current state, the system cannot know:
- Which skills are already adequate and don't need a project
- Which gaps are wide enough to need focused development work
- What the priority order of projects should be

This is the most significant structural gap. The prompt generates projects based on the goal alone, not based on the person's actual gap profile. That's precisely what Justin Sung calls "normal goal setting" — focusing on what to achieve without understanding the how via who you need to become.

**Fix needed:** Add a Step 3A (Current Self Assessment) using the same capability and resource table, with a Gap column. Projects in Step 4 should be generated from the highest-gap items, not from the goal directly.

---

#### 🔴 Gap 2 — Capability table scores importance, not required level

Same issue as Template 1. The Step 2 table is:
```
| What they can do | Rating (1–10) |
```

No instruction on what the rating means. In context it reads as "how capable is the ideal person" which slides toward "how important is this" rather than "what specific level is needed."

**Fix needed:** Add explicit scoring guidance matching Justin Sung's framing — rate the **required level** for this specific goal, not importance in the abstract.

---

#### 🔴 Gap 3 — No Force Field Analysis

The prompt has no equivalent of Step 4. It goes directly from goal + (partial) person analysis to GTD project creation.

**What Justin Sung requires:**
The Force Field is where you identify what is actually blocking progress — including life factors that have nothing to do with skill development. Without it, the action plan may be targeting the wrong bottleneck entirely. Justin Sung's example: a student failing not because of learning skills but because of an abusive home situation. The Force Field surfaces that.

**Fix needed:** Add a force field step between the capability assessment and the project creation step, using the Drivers / Resources / Barriers structure.

---

#### 🟡 Gap 4 — Projects are generated from the goal, not from the gap

Because there's no current-state assessment, all projects are derived from what the goal requires, not from where the user actually is deficient. This means:
- Skills the user already has at sufficient level get assigned projects anyway (wasted effort)
- The most critical gaps don't necessarily get the most project attention
- There's no mechanism to prioritize which 2–3 skills to develop first

**Fix needed:** After the gap calculation, add a prioritization filter — only generate development projects for the top 2–3 gaps. Projects for adequately-met capabilities can be skipped or deprioritized.

---

#### 🟢 Gap 5 — No review cadence or goal alignment check

The prompt generates a one-time plan with no built-in mechanism for re-evaluation. Justin Sung's framework is explicitly iterative — the plan is expected to change as you gain information.

**Fix needed:** Add a closing instruction about review frequency, especially the goal alignment check every 1–2 months.

---

### Summary — Template 2

| Gap | Severity | Fix |
|---|---|---|
| No current self assessment — gap mechanic missing | 🔴 Critical | Add Step 3A with same attributes + Gap column |
| Capability rating instruction ambiguous | 🔴 Critical | Clarify as required level, not importance |
| No Force Field Analysis | 🔴 Critical | Add Drivers / Resources / Barriers step |
| Projects driven by goal, not by gap | 🟡 Important | Add prioritization filter after gap calculation |
| No review cadence | 🟢 Minor | Add iterative review instruction |

---

---

## Overall Verdict

Both templates have the right instincts but share two critical errors:

1. **The scoring in the capability/resource tables measures the wrong dimension** — importance vs required level. This corrupts every gap calculation downstream.

2. **Neither template properly closes the loop between who you need to become and what you do next.** Template 1 gets closer (it has a current profile), but the action plan doesn't enforce the max-2 rule. Template 2 skips the current self entirely.

The MASTER GOAL prompt has the most serious structural problem: it is currently closer to normal goal setting (activities derived from the goal) than reverse goal setting (activities derived from the person gap). This is the exact failure mode Justin Sung warns against.

---

## Recommended Fix Priority

1. Fix the scoring instruction in both templates — this is one line each and unblocks everything else
2. Add "Why" anchor to Template 1 Step 1
3. Add current self assessment + gap column to Template 2
4. Add Force Field Analysis to Template 2
5. Split Drivers / Resources in Template 1 Force Field
6. Enforce max-2 action plan in both templates
7. Add review cadences to both templates
