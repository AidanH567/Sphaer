import {
  REPORT_KIND_OPTIONS,
  buildReportDetails,
  detailEntriesForRow,
  fieldsForKind,
  isReportKind,
  isReportSeverity,
  primaryAnswer,
  primaryLabel,
  showsScreen,
  showsSeverity,
  type ReportAnswers,
} from '../report-kinds';

// The report taxonomy is pure data + pure functions precisely so this can be
// tested without rendering a form. Everything the screen decides about
// "which fields does this kind show" is decided here.

describe('the kind → field map', () => {
  it('offers exactly bug, feature and change', () => {
    expect(REPORT_KIND_OPTIONS.map((option) => option.value)).toEqual([
      'bug',
      'feature',
      'change',
    ]);
  });

  it('asks a bug what happened, what was expected, and how to reproduce it', () => {
    expect(fieldsForKind('bug').map((field) => field.key)).toEqual([
      'description',
      'expected',
      'steps',
    ]);
  });

  it('asks a feature to describe itself first, then the problem, solution and audience', () => {
    // `description` leads deliberately (2026-08-18): a person arrives wanting
    // to say WHAT they want, and being asked the problem first is the harder
    // question in the harder order.
    expect(fieldsForKind('feature').map((field) => field.key)).toEqual([
      'description',
      'why',
      'solution',
      'audience',
    ]);
  });

  it('asks a change only what and why', () => {
    expect(fieldsForKind('change').map((field) => field.key)).toEqual(['description', 'why']);
  });

  it('never shows a bug question on a feature, or the reverse', () => {
    const bugKeys = fieldsForKind('bug').map((field) => field.key);
    const featureKeys = fieldsForKind('feature').map((field) => field.key);
    const shared = bugKeys.filter((key) => featureKeys.includes(key));
    // `description` is shared by design — it is the NOT NULL column every
    // kind's primary question writes into. Nothing else may overlap.
    expect(shared).toEqual(['description']);
  });

  it('requires exactly one field per kind, and it is always the first', () => {
    for (const { value } of REPORT_KIND_OPTIONS) {
      const fields = fieldsForKind(value);
      expect(fields.filter((field) => field.required)).toHaveLength(1);
      expect(fields[0].required).toBe(true);
    }
  });

  it('gives each kind its own primary label, so the form never says "the bug"', () => {
    expect(primaryLabel('bug')).toBe('What happened?');
    expect(primaryLabel('feature')).toBe('Describe this feature');
    expect(primaryLabel('change')).toBe('What should change?');
  });
});

describe('severity and the screen picker are bug-only', () => {
  it('shows both for a bug', () => {
    expect(showsSeverity('bug')).toBe(true);
    expect(showsScreen('bug')).toBe(true);
  });

  it('hides both for features and changes', () => {
    for (const kind of ['feature', 'change'] as const) {
      expect(showsSeverity(kind)).toBe(false);
      expect(showsScreen(kind)).toBe(false);
    }
  });
});

describe('buildReportDetails', () => {
  const answers: ReportAnswers = {
    description: 'the map opened blank',
    expected: 'the card slides up',
    steps: '1. tap a pin',
    solution: 'a chip on the feed',
    audience: 'circle followers',
    why: 'it is the action I reach for most',
  };

  it('keeps only the non-primary answers belonging to the current kind', () => {
    expect(buildReportDetails('bug', answers)).toEqual({
      expected: 'the card slides up',
      steps: '1. tap a pin',
    });
    // `why` belongs to BOTH feature and change since 2026-08-18 - a feature's
    // "What problem does this solve?" and a change's "Why?" are the same
    // question, so they share a key and the triage screen labels each by kind.
    expect(buildReportDetails('feature', answers)).toEqual({
      why: 'it is the action I reach for most',
      solution: 'a chip on the feed',
      audience: 'circle followers',
    });
    expect(buildReportDetails('change', answers)).toEqual({
      why: 'it is the action I reach for most',
    });
  });

  it('never carries the primary answer into details — it has its own column', () => {
    expect(buildReportDetails('bug', answers)).not.toHaveProperty('description');
  });

  it('drops blank and whitespace-only answers instead of storing empty keys', () => {
    expect(buildReportDetails('bug', { description: 'x', expected: '   ', steps: '' })).toEqual(
      {}
    );
  });

  it('trims what it keeps', () => {
    expect(buildReportDetails('change', { why: '  because  ' })).toEqual({ why: 'because' });
  });
});

describe('primaryAnswer', () => {
  it('reads the first field of the CURRENT kind, trimmed', () => {
    expect(primaryAnswer('feature', { description: '  a filter  ' })).toBe('a filter');
  });

  it('is empty when unanswered, so the caller can validate', () => {
    expect(primaryAnswer('bug', {})).toBe('');
    expect(primaryAnswer('bug', { description: '   ' })).toBe('');
  });
});

describe('detailEntriesForRow — reading a filed report back', () => {
  it('renders stored answers under the labels they were asked under', () => {
    expect(
      detailEntriesForRow('bug', { expected: 'the card slides up', steps: '1. tap a pin' })
    ).toEqual([
      { key: 'expected', label: 'What did you expect instead?', value: 'the card slides up' },
      { key: 'steps', label: 'Steps to reproduce', value: '1. tap a pin' },
    ]);
  });

  it('follows form order, not JSON key order', () => {
    const entries = detailEntriesForRow('feature', {
      audience: 'circle followers',
      solution: 'a chip',
    });
    expect(entries.map((entry) => entry.key)).toEqual(['solution', 'audience']);
  });

  it('skips keys that do not belong to the kind of the row', () => {
    // A row written by an older/newer build, or by Tina's Telegram inlet.
    expect(detailEntriesForRow('change', { steps: 'leftover', why: 'kept' })).toEqual([
      { key: 'why', label: 'Why?', value: 'kept' },
    ]);
  });

  it('survives a null, empty, or non-string details blob', () => {
    expect(detailEntriesForRow('bug', null)).toEqual([]);
    expect(detailEntriesForRow('bug', {})).toEqual([]);
    expect(detailEntriesForRow('bug', { expected: 42 })).toEqual([]);
  });
});

describe('type guards', () => {
  it('accepts the three kinds and nothing else', () => {
    expect(isReportKind('bug')).toBe(true);
    expect(isReportKind('feature')).toBe(true);
    expect(isReportKind('change')).toBe(true);
    expect(isReportKind('wishlist')).toBe(false);
    expect(isReportKind(null)).toBe(false);
  });

  it('accepts the three severities and nothing else', () => {
    expect(isReportSeverity('blocker')).toBe(true);
    expect(isReportSeverity('annoying')).toBe(true);
    expect(isReportSeverity('cosmetic')).toBe(true);
    expect(isReportSeverity('urgent')).toBe(false);
    expect(isReportSeverity(undefined)).toBe(false);
  });
});
