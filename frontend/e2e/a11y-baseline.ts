/**
 * P3-A: the accessibility baseline, per shot — EXISTING violations the
 * gate tolerates, each with a reason. Policy: fix one, DELETE its entry
 * (the gate fails on stale entries — a rotting baseline hides nothing).
 * NOTHING may be added without the owner ruling the violation
 * acceptable; new findings fail the gate outright.
 *
 * Keyed by shot name (same names as the pixel suite); fingerprint =
 * `${rule}(${impact})@${selector}` — exactly what a failure prints.
 * Discovery 2026-10-08 had contrast and task-card heading debt. The
 * approved palette resolved the former. Fresh T4 axe on 2026-10-17
 * proved the final heading-order entry stale after discovery gained h2.
 * All sixteen measured surfaces now have no waived findings.
 */
export const A11Y_BASELINE: Record<string, { fingerprint: string; reason: string }[]> = {};
