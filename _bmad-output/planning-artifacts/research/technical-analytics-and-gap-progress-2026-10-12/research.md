---
title: 'Analytics and gap progress research'
type: technical
topic: 'Analytics and gap progress'
decision: 'Define useful completion analytics and evidence-based gap progress for an Archer epic'
source: 'Native research; retrieved public sources and independent digests'
status: complete
preset: standard
validation: normal
created: '2026-10-12'
updated: '2026-10-14'
claims_verified: 1
claims_unverified: 2
---

# Analytics and Gap Progress

## Executive Summary

Build this as an **Analytics & Goal-Gap Progress** epic, but keep “work done” and “capability gained” as separate measures. A meta-analysis of randomized progress-monitoring interventions found an average improvement in goal attainment, supporting visible progress tracking in general; it does not establish that completing an individual project proves the user gained a skill [1]. A primary motor-learning experiment and an integrative review also distinguish observed practice performance from retention/transfer [2][3].

For completion analytics, define the start event, completion event, denominator, time window, reopening and archive rules before presenting percentages. Official service-measurement guidance emphasizes explicit start and end points and accounting for journeys that users save and resume later [4]. Archer's projects default to Paused; creation is not a meaningful “started” event. Current schema has only mutable statuses and `updated_at`, not status-transition timestamps; goals contain only a mutable skill-framework JSON snapshot. Thus current status counts are possible, but historical completion rates and rating trend lines are not trustworthy without new history [5].

Recommended gap view: per skill, show required level, baseline self-rating, latest self-rating, remaining gap, explicitly linked projects, and their current/completed counts. A completion updates linked-work progress; only a user reassessment updates a skill rating. Keep per-gap values visible, avoid unweighted hidden aggregate scores, and label missing history. Use simple bars for status/gap comparisons and lines only for actual dated assessment or completion series; provide text/table equivalents and non-color cues [7][8][9].

**Largest caveat:** The studies support monitoring and the performance-versus-learning distinction, but do not prove a particular reassessment cadence or self-rating scale. Epic 9 now offers 30/60/90-day maturity windows as user-selectable reporting options; that choice is a product design decision, not an empirically optimal window, and should be usability-tested.

## Recommendations

1. **Adopt the two-track model.** On Analytics and Goal detail, distinguish “Projects applied to this gap” from “Your assessed gap.” Project completion updates only the former. User re-rating updates the latter [1][2][3]. Confidence: medium-high on the measurement distinction; product workflow is a recommendation.
2. **Add reliable history before trend metrics.** Record goal/project status transitions; assign stable IDs to skill gaps; allow each project to link to multiple gaps and each gap to multiple projects; and store immutable, dated user assessments with the required-level version in effect at the time. Keep row-level security (RLS) and owner checks in place, and route writes through authenticated server-side paths. The current schema cannot supply historic timestamps or mappings [local schema]. Confidence: high for the data insufficiency; table design is a local architecture recommendation.
3. **Start with understandable counts and explicit cohorts.** Show current status distribution and first-completion throughput first. Offer 30/60/90-day maturity windows; calculate cohort percentages only with a named start, date window, denominator, reopened/archived policy, and as-of date, and only after the complete maturity window elapses [4][5]. Confidence: high for transparent metric semantics; the available window choices are a product decision.
4. **Keep the dashboard decision-oriented and restrained.** Show a small set of answers: active work, completions in period, goals completed, and which gaps have linked work or recent reassessments. Use bars for direct comparisons; use lines only for saved dated events. Avoid an aggregate score, leaderboards, streaks, and “skills unlocked” language. Nielsen Norman Group distinguishes analytical dashboards as decision aids from operational monitoring surfaces [10]. Confidence: medium; design requires user testing.
5. **Keep charts accessible and proportional.** State chart titles and periods in the page text; provide a text summary and a table or equivalent values; do not use color alone; check contrast and reflow against the Web Content Accessibility Guidelines (WCAG) 2.2. Government Analysis Function recommends selecting charts by the question, testing with users, small multiples for many series, and documenting axis breaks/discontinuities [7][8][9]. Confidence: high for normative WCAG criteria; medium-high for practitioner chart guidance.

## Evidence and Interpretation

### Progress Monitoring Is Useful, but Not a Skill Score

Harkin et al.'s meta-analysis of 138 randomized studies (N=19,951) found that monitoring interventions increased monitoring frequency and goal attainment on average; effects were larger when progress was physically recorded or made public [1]. This supports displaying user-visible progress as feedback. It does **not** justify interpreting project completion as an individual causal skill gain.

In motor-learning experiments, performance during a practice condition can diverge from later retention; the authors found participants could overpredict later performance based on practice ease [2]. Soderstrom and Bjork's review distinguishes observable performance from durable learning demonstrated through retention or transfer [3]. These sources concern learning studies, not all complex life projects, so the product conclusion is deliberately conservative: project completion is an outcome/work signal; current ability remains an explicit self-assessment.

### Completion Metrics Need Lifecycle Semantics

GDS defines transaction completion rate as completed transactions divided by all starts, including partial/failed attempts; it calls for explicit start/end points and matching journeys that save and return [4]. Adapted to Archer, a first activation (status becomes Active) is a more meaningful project start than row creation because new projects start Paused. Current state counts should remain separate from throughput and cohort completion rates. Every displayed percentage should show its numerator, denominator, observation window, and as-of date.

**Recommended definitions:**

- **Current portfolio:** count each goal/project once by current status. This answers “what is the state of my system now?”
- **Completion throughput:** number of unique projects first entering Completed during the selected period. Show reopen state separately; do not count a re-completion as a new project for first-completion throughput.
- **Cohort completion rate:** among projects first activated in a stated cohort, proportion that reached Completed by the stated as-of date. Show Started / Completed / Active / Paused / Someday / Archived counts. Recent cohorts have less time to complete; compare like-aged cohorts or adopt an explicit fixed observation window before making trend comparisons.
- **Time to completion:** elapsed time from first activation to first Completed transition for completed projects, with sample count. Do not present it alone as an overall efficiency measure because unfinished projects are not represented.
- **Goal completion:** explicit goal status transition to Completed, reported separately from completion of its child projects. Completion is user-confirmed in Archer and should stay that way.

GDS guidance also recommends deriving measures from the service's purpose, establishing baselines, checking data quality, and measuring trends with context rather than relying on isolated snapshots [5][6]. Here, started projects that are later paused, parked, or archived should remain visible in their original cohort. A future product decision may change the denominator, but the UI must disclose it.

### Gap Progress Is Two Axes, Not One

Local inspection of `supabase/migrations/0001_init_schema.sql` and `lib/supabase/schema.ts` found: `goals.skill_framework` contains each item’s required level and `user_rating`, but no stable skill ID or rating history; Projects point to a Goal but have no persisted gap-association field/table; project status changes have no event history; `updated_at` is a general modification time. This is project evidence, not external research.

For an unchanged requirement and a gap with baseline rating below target, define baseline gap $G_0 = \max(R - B, 0)$ and current gap $G_t = \max(R - C_t, 0)$, where $R$ is the frozen required level, $B$ is the first explicitly saved baseline rating, and $C_t$ is the latest user-entered rating at time $t$. Remaining gap is $G_t$; point change is $G_0 - G_t$. A closure percentage may be shown only when $G_0 > 0$: $(G_0 - G_t) / G_0 \times 100\%$. Preserve negative point change if a later self-rating falls; cap the displayed closure percentage at 100% only if the UI labels that convention. Never calculate a historical line from the current mutable rating alone.

Project links describe **work intended to address a gap**. They are not proof the gap closed. Display linked project counts/statuses adjacent to, but visually and semantically distinct from, the user’s assessment history. On framework/required-level edits, version the requirement or start a new comparison baseline; do not compare changed targets as though unchanged. Existing goals without history begin a clearly dated baseline at first supported assessment after the feature ships; do not infer original ratings/dates from `updated_at`.

## Open Questions

- Does the 30/60/90-day window selector make sense against the user's actual Project duration distribution? Validate before treating comparisons as meaningful.
- Do users understand first-completion throughput versus current Completed status and cohort completion rate? Usability-test labels and denominator visibility.
- The full texts for the task-learning papers were not retrieved; abstracts/metadata were used. Refresh/deepen with the original papers if stronger evidence is needed before expanding the capability-measurement model.

## Proposed Epic

The five-story Epic 9 outline is recorded in [epic-9-outline.md](epic-9-outline.md) and has been added to canonical `epics.md` and `sprint-status.yaml` as `backlog`. The order is history and semantics first, explicit linking/reassessment next, and analytics views last. The 30/60/90-day maturity selector is an implementation requirement to user-test, not a research-proven optimum.

## Sources

| Ref | Claim supported | Publisher and date | Accessed | Confidence |
| --- | --- | --- | --- | --- |
| [1] | Progress-monitoring intervention and goal attainment synthesis | Benjamin Harkin et al., *Psychological Bulletin*, 142(2), 198-229; online Feb 2016. [APA DOI record and abstract](https://psycnet.apa.org/doi/10.1037/bul0000025); independently checked against [OpenAlex](https://api.openalex.org/works/https://doi.org/10.1037/bul0000025). | 2026-10-13 | High for abstract findings; full text not retrieved |
| [2] | Practice performance can diverge from 24-hour retention and learners’ predictions | Dominic A. Simon & Robert A. Bjork, *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 27(4), 907-912, 2001. [APA DOI](https://doi.org/10.1037/0278-7393.27.4.907); abstract indexed at [OpenAlex](https://api.openalex.org/works/https://doi.org/10.1037/0278-7393.27.4.907). | 2026-10-13 | Medium: abstract indexed, full text not retrieved |
| [3] | Performance during training may not represent durable learning, retention, or transfer | Nicholas C. Soderstrom & Robert A. Bjork, *Perspectives on Psychological Science*, 10(2), 176-199, 2015. [SAGE DOI](https://doi.org/10.1177/1745691615569000); metadata indexed at [OpenAlex](https://api.openalex.org/works/https://doi.org/10.1177/1745691615569000). | 2026-10-13 | Medium: peer-reviewed review metadata; full text not retrieved |
| [4] | Completion-rate starts/endpoints, denominators, save-and-return matching | UK Government Digital Service, “Measuring completion rate,” updated 2021-02-19. [GOV.UK](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate). | 2026-10-13 | High for guidance; analogical adaptation |
| [5] | Metric semantics, baseline, data quality, trends, contextual segments | UK Government Digital Service, “How to set performance metrics for your service,” 2017-12-05. [GOV.UK](https://www.gov.uk/service-manual/measuring-success/how-to-set-performance-metrics-for-your-service). | 2026-10-13 | High for guidance; analogical adaptation |
| [6] | Task completion and time can assess non-transactional/end-to-end journeys; methods depend on the service type | UK Government Digital Service, “Measuring the success of your service,” 2018-08-06. [GOV.UK](https://www.gov.uk/service-manual/measuring-success/measuring-the-success-of-your-service). | 2026-10-13 | High for guidance; analogical adaptation |
| [7] | Chart type should serve its message; accessible labeling/text alternatives and user testing | UK Government Analysis Function, “Data visualisation: charts,” 2022-05-19. [Guidance](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/). | 2026-10-13 | Medium-high practitioner guidance |
| [8] | Accessible chart checklist, text alternative, contrast, readable labels | UK Government Analysis Function, “Accessible charts: a checklist of the basics,” 2023-05-02. [Checklist](https://analysisfunction.civilservice.gov.uk/policy-store/charts-a-checklist/). | 2026-10-13 | Medium-high practitioner guidance |
| [9] | Color is not sole information channel; 3:1 non-text and 4.5:1 normal text contrast | W3C, [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/), 2024-12-12; [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), updated 2025-09-16; [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), updated 2026-09-06. | 2026-10-13 | High: normative standards |
| [10] | Analytical dashboards support at-a-glance decisions; simple position/length encodings aid quantitative comparison | Page Laubheimer, Nielsen Norman Group, “Dashboards: Making Charts and Graphs Easier to Understand,” 2017-06-18. [NN/g](https://www.nngroup.com/articles/dashboards-preattentive/). | 2026-10-13 | Medium: established UX practitioner guidance |

## Staleness Map

Computed with `recon_kit.py staleness --today 2026-10-13` using the explicit assumption windows of 120 months for behavioral findings and 60 months for metric definitions. The W3C source remains a normative current standard; recheck it immediately before implementation.

| Claim | Class | Published | Recheck | State |
| --- | --- | --- | --- | --- |
| Progress-monitoring interventions improve goal attainment on average | behavior-change | 2016-02 | 2026-02-01 | Due |
| Practice performance can diverge from retention/transfer | behavior-change | 2015-03 | 2025-03-01 | Due |
| Completion-rate definitions require explicit starts, endpoints, and denominator | metric-definition | 2021-02 | 2026-02-01 | Due |

Earliest recheck date: **2025-03-01**. These sources describe foundational findings/guidance, but their age means a fresh literature/source pass is appropriate before treating Epic 9 as implementation-ready. Claims ledger: 1 verified, 2 unverified.

## Research Limitations

No general web-search tool was available; PubMed blocked automated access, while the APA publisher record exposed Harkin et al.'s abstract. Full text was not retrieved for the task-learning papers. Research used the retrieved publisher abstract, scholarly metadata, official guidance and direct source pages; this is decision-grade exploration, not an exhaustive systematic review.