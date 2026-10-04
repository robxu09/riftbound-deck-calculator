import { keywordChoices, matchesKeywords, printedKeywords } from './card-keywords';

describe('Printed keyword matching', () => {
  it('matches actual Hidden declarations, including the unbracketed gallery spelling', () => {
    expect(matchesKeywords('[Hidden] (Hide now to react with later.)\nWhen you play me, draw 1.', ' HIDDEN ')).toBeTrue();
    expect(matchesKeywords('Hidden (Hide now to react with later.)\nWhen you play me, return a unit.', 'hidden')).toBeTrue();
    expect(matchesKeywords('[Reaction]\n[Hidden]', 'hidden')).toBeTrue();
    expect(matchesKeywords('[Hidden] (Reminder (with parentheses).) [Reaction] (Another reminder.)', 'Hidden, Reaction')).toBeTrue();
  });

  it('excludes references, granted keywords, reminder text, and conditional effects', () => {
    for (const text of [
      'When I attack, play a card with [Hidden] from your hand.',
      'Your opponents\' [Hidden] cards cannot be revealed here.',
      'When you play a card from [Hidden], give me +2 Might.',
      '[Action] (Hidden cards can react.)\nReturn cards with [Hidden] to your hand.',
      '[Deathknell][>] Play a unit token with [Hidden].',
      'While I am buffed, I have [Hidden].',
      '[Empowered][>] I have [Hidden].'
    ]) expect(matchesKeywords(text, 'Hidden')).withContext(text).toBeFalse();
    expect(matchesKeywords('[Hidden]\nGive a unit [Shield 3] and [Tank].', 'Shield')).toBeFalse();
  });

  it('supports complete keyword names, numbered forms and comma-separated combinations', () => {
    const text = '[Shield 3] (Extra Might while defending.)\n[Show Off] (Reminder.)\n[Quick-Draw]';
    expect(matchesKeywords(text, 'shield')).toBeTrue();
    expect(matchesKeywords(text, 'Shield 3')).toBeTrue();
    expect(matchesKeywords(text, 'Shield 2')).toBeFalse();
    expect(matchesKeywords(text, 'show   off, SHIELD')).toBeTrue();
    expect(matchesKeywords(text, 'Show Off, Hidden')).toBeFalse();
    expect(matchesKeywords(text, 'Show')).toBeFalse();
    expect(matchesKeywords(text, 'Shield,')).toBeFalse();
    expect(matchesKeywords('[Empowered][>] Draw a card.', 'Empower')).toBeFalse();
    expect(matchesKeywords('Ganking (Move between battlefields.)', 'Ganking')).toBeTrue();
  });

  it('handles missing text and derives suggestions only from declarations', () => {
    expect(matchesKeywords('', 'Hidden')).toBeFalse();
    expect(matchesKeywords(undefined, 'Hidden')).toBeFalse();
    expect(matchesKeywords(null, '')).toBeTrue();
    expect(matchesKeywords('[Hidden]', '   ')).toBeTrue();
    expect(printedKeywords('[NO TEXT]')).toEqual([]);
    expect(keywordChoices([{ text: '[Shield 2]\n[Shield 3]\n[Hidden]' },
      { text: 'Hidden (Reminder.)\nGive a unit [Tank].' }, {}])).toEqual(['Hidden', 'Shield']);
  });
});
