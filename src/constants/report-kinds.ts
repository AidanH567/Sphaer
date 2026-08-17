import type { Ionicons } from '@expo/vector-icons';

/**
 * The report taxonomy — kinds, their per-kind question sets, and the pure
 * functions that turn a form's answers into a `bug_reports` row.
 *
 * WHY THIS IS A CONSTANTS MODULE AND NOT SCREEN STATE: "not everything we
 * want to add is a bug" (Aidan, 2026-08-17). Three surfaces have to agree on
 * the same question set — the form that asks, the service that writes
 * `details`, and the triage screen that reads it back as labelled fields.
 * Keeping the spec in one pure, dependency-free module means the triage
 * labels can never drift from the form labels, and the "which fields does
 * this kind show" logic is testable without rendering anything.
 *
 * Schema side: migration 20260817120000_bug_reports_kind_and_triage.sql.
 * `kind` and `severity` are CHECK-constrained columns (triage filters on
 * them); everything else here is a key inside the `details` JSONB.
 */

export type ReportKind = 'bug' | 'feature' | 'change';
export type ReportSeverity = 'blocker' | 'annoying' | 'cosmetic';

/** Keys of the non-primary answers — i.e. the `details` JSONB keys. */
export type ReportDetailKey = 'expected' | 'steps' | 'solution' | 'audience' | 'why';

/**
 * `description` is special: it is the NOT NULL column every row has had
 * since the first migration, so each kind's PRIMARY question writes there.
 * Existing rows, and Tina's Telegram inlet (which posts a description and
 * nothing else), keep working untouched.
 */
export type ReportFieldKey = 'description' | ReportDetailKey;

export interface ReportField {
  key: ReportFieldKey;
  label: string;
  placeholder: string;
  /** Only the primary question is required — see REQUIRED_FIELD_RULE. */
  required: boolean;
  lines: number;
}

export interface ReportKindOption {
  value: ReportKind;
  /** Segmented-control label. */
  label: string;
  /** One line under the control explaining what belongs here. */
  helper: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * REQUIRED_FIELD_RULE: exactly one required field per kind, always the
 * first. Everything else is optional and clearly marked so.
 *
 * Aidan wants reports "ultra specific", and the temptation is to make all
 * three fields mandatory. Resisted deliberately: a wall of required boxes is
 * how a reporting tool stops being used, and an empty "steps to reproduce"
 * is more honest than one filled in with "idk" to get past the validator.
 * The specificity comes from ASKING the right question, not from refusing
 * the report.
 */
export const REPORT_KIND_OPTIONS: readonly ReportKindOption[] = [
  {
    value: 'bug',
    label: 'Bug',
    helper: 'Something is broken or behaving wrongly.',
    icon: 'bug-outline',
  },
  {
    value: 'feature',
    label: 'Feature',
    helper: "Something that isn't there yet and should be.",
    icon: 'bulb-outline',
  },
  {
    value: 'change',
    label: 'Change',
    helper: 'Something that exists but should work or look different.',
    icon: 'swap-horizontal-outline',
  },
] as const;

const BUG_FIELDS: readonly ReportField[] = [
  {
    key: 'description',
    label: 'What happened?',
    placeholder: 'The map opened blank after I tapped a pin.',
    required: true,
    lines: 4,
  },
  {
    key: 'expected',
    label: 'What did you expect instead?',
    placeholder: "I expected the pin's event card to slide up.",
    required: false,
    lines: 3,
  },
  {
    key: 'steps',
    label: 'Steps to reproduce',
    placeholder: '1. Open Map\n2. Tap any pin\n3. Screen goes white',
    required: false,
    lines: 4,
  },
] as const;

const FEATURE_FIELDS: readonly ReportField[] = [
  {
    key: 'description',
    label: 'What problem does this solve?',
    placeholder: 'I can never find the events my circles posted last week.',
    required: true,
    lines: 4,
  },
  {
    key: 'solution',
    label: 'Proposed solution',
    placeholder: "A 'from my circles' filter on the feed.",
    required: false,
    lines: 4,
  },
  {
    key: 'audience',
    label: "Who's it for?",
    placeholder: 'Anyone following more than a couple of circles.',
    required: false,
    lines: 3,
  },
] as const;

const CHANGE_FIELDS: readonly ReportField[] = [
  {
    key: 'description',
    label: 'What should change?',
    placeholder: 'Save should sit next to Share on the event page.',
    required: true,
    lines: 4,
  },
  {
    key: 'why',
    label: 'Why?',
    placeholder: "It's the action I reach for most and the hardest to hit.",
    required: false,
    lines: 4,
  },
] as const;

const KIND_FIELDS: Record<ReportKind, readonly ReportField[]> = {
  bug: BUG_FIELDS,
  feature: FEATURE_FIELDS,
  change: CHANGE_FIELDS,
};

/** The ordered question set for a kind. The form renders exactly these. */
export function fieldsForKind(kind: ReportKind): readonly ReportField[] {
  return KIND_FIELDS[kind];
}

/**
 * Severity and the screen picker are BUG-ONLY. A feature request has no
 * severity, and "which screen" is a question about where something broke,
 * not about where an idea might land.
 */
export function showsSeverity(kind: ReportKind): boolean {
  return kind === 'bug';
}

export function showsScreen(kind: ReportKind): boolean {
  return kind === 'bug';
}

export const SEVERITY_OPTIONS: readonly { value: ReportSeverity; label: string }[] = [
  { value: 'blocker', label: 'Blocker' },
  { value: 'annoying', label: 'Annoying' },
  { value: 'cosmetic', label: 'Cosmetic' },
] as const;

/**
 * Fixed list of app surfaces. Human names, not route paths — these end up in
 * triage and in auto-drafted fix prompts. Not auto-captured from the router:
 * the entry point lives on Profile, so the current route would always say
 * "Profile".
 */
export const SCREEN_OPTIONS = [
  'Feed',
  'Map',
  'Mural',
  'Circles',
  'Create',
  'Messages',
  'Profile',
  'Event detail',
  'Onboarding',
  'Other',
] as const;

// ─── Form answers → row shape ────────────────────────────────────────────────

/** Every answer the form is holding, keyed by field. Sparse by design. */
export type ReportAnswers = Partial<Record<ReportFieldKey, string>>;

/**
 * The primary answer for a kind, trimmed. Empty string when unanswered —
 * the caller decides whether that is a validation error.
 */
export function primaryAnswer(kind: ReportKind, answers: ReportAnswers): string {
  const field = fieldsForKind(kind)[0];
  return (answers[field.key] ?? '').trim();
}

/**
 * The `details` JSONB for a kind: the non-primary answers, trimmed, with
 * blanks dropped.
 *
 * ⚠️ FILTERED BY KIND, not just by emptiness. The form keeps one answers map
 * across kind switches (so flipping bug → feature → bug does not wipe what
 * you typed), which means the map can hold a bug's `steps` while the kind is
 * now `feature`. Reading straight off the map would file a feature request
 * carrying invisible bug fields that triage would then render. Only keys
 * belonging to the CURRENT kind survive this function.
 */
export function buildReportDetails(
  kind: ReportKind,
  answers: ReportAnswers
): Record<string, string> {
  const details: Record<string, string> = {};
  for (const field of fieldsForKind(kind)) {
    if (field.key === 'description') continue;
    const value = (answers[field.key] ?? '').trim();
    if (value) details[field.key] = value;
  }
  return details;
}

// ─── Reading a row back (triage) ─────────────────────────────────────────────

export const KIND_LABEL: Record<ReportKind, string> = {
  bug: 'Bug',
  feature: 'Feature',
  change: 'Change',
};

export const SEVERITY_LABEL: Record<ReportSeverity, string> = {
  blocker: 'Blocker',
  annoying: 'Annoying',
  cosmetic: 'Cosmetic',
};

export function isReportKind(value: unknown): value is ReportKind {
  return value === 'bug' || value === 'feature' || value === 'change';
}

export function isReportSeverity(value: unknown): value is ReportSeverity {
  return value === 'blocker' || value === 'annoying' || value === 'cosmetic';
}

/**
 * Turn a stored `details` object into ordered, LABELLED lines for triage —
 * the whole point of the structured form. Order follows the form, unknown
 * keys are skipped (a key left behind by an older app version renders as
 * nothing rather than as a raw JSON dump), and the kind comes off the row so
 * an old 'bug' row with no details simply yields [].
 */
export function detailEntriesForRow(
  kind: ReportKind,
  details: Record<string, unknown> | null | undefined
): { key: ReportDetailKey; label: string; value: string }[] {
  if (!details) return [];
  const entries: { key: ReportDetailKey; label: string; value: string }[] = [];
  for (const field of fieldsForKind(kind)) {
    if (field.key === 'description') continue;
    const raw = details[field.key];
    if (typeof raw === 'string' && raw.trim()) {
      entries.push({ key: field.key, label: field.label, value: raw.trim() });
    }
  }
  return entries;
}

/** The label triage shows above the primary answer, per kind. */
export function primaryLabel(kind: ReportKind): string {
  return fieldsForKind(kind)[0].label;
}
