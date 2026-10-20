/**
 * Explicit no-skip exemptions (P1 automation): tests that legitimately
 * skip in the STANDARD battery run (the report this gate reads) because
 * their fixture contracts ride opt-in env flags. Every entry names the
 * gating variable and why the dedicated run — not the standard battery —
 * owns that coverage.
 *
 * Adding an entry: the skipped title substring must be tight enough to
 * match ONLY the intended test(s) (the gate logs every match it accepts;
 * an over-broad fragment hides future skips — keep them specific).
 */
export const NOSKIP_EXEMPTIONS = [
  ...['home at 390','workspace at 390','home at 1440','workspace at 1440'].map(surface=>({
    file:'innovation-collaboration-visual.spec.ts',title:`R6 visual: ${surface}`,gate:'CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1',
    reason:'R6 collaboration pixels and axe use a separate pinned-font Linux world; the required dedicated visual run owns these four stable screens.',
  })),
  ...[
    'R5 mentor long content stays usable on mobile and desktop',
    'R5 mentor approved composition preserves independent columns, contact band and native fields',
    'R5 mentor lifecycle: operations, explicit consent, scoped maintenance, contact and project links',
    'R5 mentor conflict preserves operations input and resets stale personal consent',
    'R5 mentor uncertain save retries the same command and account changes clear private inputs',
    'R5 mentor create recovery survives navigation and clears after cross-tab logout',
    'R5 mentor and owner can reach older links and refresh the current page after actions',
  ].map(title=>({file:'innovation-mentors.spec.ts',title,gate:'CQ_E2E_MENTOR_WORLD=1',reason:'R5 uses a dedicated simulated mentor identity; its required dedicated run verifies real confirmation and authorizations without altering existing visual fixture counts.'})),
  ...['R4.1 visual: public materials remain neutral in directory and detail','R4 visual: owner, mobile preview and public talent','R4 visual: empty, unavailable, loading and error','R4 visual: long content and zero availability remain usable on mobile'].map(title=>({
    file:'innovation-talents-visual.spec.ts',title,gate:'CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1',
    reason:'Talent pixel and axe checks run in their own Linux pinned-font stage with a disposable real publication world.',
  })),
  ...["R3 visual: owner form, consent preview and public project/recruitment", "R3 visual: filtered empty and unavailable recruitment"].map((title) => ({
    file: "innovation-recruitment-visual.spec.ts", title,
    gate: "CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1",
    reason: "R3 pixels and axe run in a separate pinned-font Linux visual world with real publication and explicit contact grants.",
  })),
  {
    file: "innovation-navigation-visual.spec.ts",
    title: "R1 navigation visual: campus landing, mobile full menu and logout confirmation",
    gate: "CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1",
    reason: "R1 pixel and axe coverage runs in a separate pinned-font Linux world, with its own operations grant.",
  },
  {
    file: "innovation-review-visual.spec.ts",
    title: "achievement review visual: owner proof workspace, operator queue and campus empty list",
    gate: "CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1",
    reason: "Real three-surface pixel and axe scenario runs in its own pinned-font Linux visual stage.",
  },
  {
    file: "auth-cross-tab-fence.spec.ts",
    title: "sibling explicit login fences this tab",
    gate: "CQ_E2E_FENCE=1",
    reason: "Fence suite runs as its own dedicated battery stage.",
  },
  {
    file: "auth-cross-tab-fence.spec.ts",
    title: "out-of-order /me: a straggler answering OLD identity",
    gate: "CQ_E2E_FENCE=1",
    reason: "Same dedicated fence stage (round-5 P0 scenario).",
  },
  {
    file: "auth-wave-invariant.spec.ts",
    title: "one rotation per cold-start wave",
    gate: "CQ_E2E_PROBE=1",
    reason: "Wave-probe instrumentation runs as its own battery stage.",
  },
  {
    file: "notifications.spec.ts",
    title: "owner mark-read (the §28 owner-only surface)",
    gate: "runtime seed state",
    reason:
      "In-test conditional skip: needs a seeded UNREAD notification for the student at run time (the fixture seeds one, but an earlier same-battery consumer can drain it); the read-path coverage also rides the same spec's other green tests.",
  },
  {
    file: "rewards-ranking.spec.ts",
    title: "insufficient spendable disables the tile CTA",
    gate: "CQ_E2E_POOR_STUDENT",
    reason:
      "Needs a student whose spendable points sit below the cheapest reward; not part of the standard world export.",
  },
  {
    file: "submission.spec.ts",
    title: "mocked storage PUT: pinned wire shape",
    gate: "CQ_E2E_MOCK_STORAGE=1",
    reason:
      "Mock-mode test (inverse gate): runs only when real object storage is deliberately unavailable.",
  },
  // The four former "https-stack mixed content" exemptions are REMOVED:
  // the dedicated e2e MinIO https instance (compose profile "e2e",
  // :9002, presigned flow proven live during the run — objects observed
  // on the instance mid-battery, then wiped by the world clean) makes
  // the real-upload chain green on the https stack.
  ...["auth screens", "student core routes", "teacher routes", "admin routes"].map(
    (title) => ({
      file: "visual-capture.spec.ts",
      title,
      gate: "CQ_E2E_CAPTURE_DIR",
      reason:
        "Evidence-capture harness (screenshots for review), gated off the standard battery.",
    }),
  ),
  ...[
    "admin-approvals",
    "admin-dashboard",
    "admin-invitations",
    "admin-platforms",
    "admin-user-detail",
    "admin-users",
    "admin-owner-qualifications",
    "admin-innovation-operations",
    "auth-login",
    "auth-reset-password",
    "not-found",
    "dev-gallery",
    "student-claim",
    "student-dashboard",
    "student-notifications",
    "student-rankings",
    "student-rewards",
    "student-project-draft-form",
    "student-achievement-draft-form",
    "student-owner-profile-form",
    "student-task-detail",
    "student-tasks",
    "teacher-reviews",
  ].map((title) => ({
    file: "visual-regression.spec.ts",
    title,
    gate: "CQ_VISUAL=1",
    reason:
      "The pixel suite is its own battery/CI stage (`make visual-regression` + the CI visual job), skipped in the functional battery on purpose.",
  })),
  {
    // Wave 2a's detail shot: the deep link rides the world's
    // CQ_E2E_ADMIN_DETAIL_PATH export (the backend session's wave2a
    // PR adds it beside ADMIN_ID); before that lands the shot skips
    // on the missing export — the same conditional discipline as the
    // claim/task-detail deep links.
    file: "accessibility.spec.ts",
    title: "axe: admin-user-detail",
    gate: "CQ_E2E_ADMIN_DETAIL_PATH",
    reason: "World-export deep link (the seeded admin's own detail page).",
  },
];
