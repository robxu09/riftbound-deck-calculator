const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Standalone printed declarations, not references or keywords granted by an effect. */
export function printedKeywords(text: string | null | undefined): string[] {
  const keywords = new Set<string>();
  for (const line of (text ?? '').split(/\r?\n/)) {
    let remaining = line.trim();
    while (remaining) {
      // Catalog examples: [Hidden], [Shield 2], [Show Off]. A few printings
      // omit brackets: Windsinger's "Hidden (...)", Laurent Bladekeeper's "Ganking (...)".
      const declaration = /^\[([A-Za-z][A-Za-z -]*(?: \d+)?)\]/.exec(remaining)
        ?? /^([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?(?: \d+)?)\s*(?=\(|$)/.exec(remaining);
      if (!declaration || normalize(declaration[1]) === 'no text') break;
      keywords.add(declaration[1].trim());
      remaining = remaining.slice(declaration[0].length).trimStart();
      // Adjacent declarations may have reminder text between them. Stop as soon
      // as an effect, condition, or trigger separator begins instead.
      if (remaining.startsWith('(')) {
        let depth = 0;
        let end = 0;
        for (; end < remaining.length; end++) {
          if (remaining[end] === '(') depth++;
          if (remaining[end] === ')' && --depth === 0) { end++; break; }
        }
        remaining = remaining.slice(end).trimStart();
      }
    }
  }
  return [...keywords];
}

/** Commas combine keywords with AND; an unnumbered keyword also matches its numbered forms. */
export function matchesKeywords(text: string | null | undefined, query = ''): boolean {
  if (!query.trim()) return true;
  const requested = query.split(',').map(normalize);
  if (requested.some(keyword => !keyword)) return false;
  const declared = printedKeywords(text).map(normalize);
  return requested.every(keyword => declared.some(value => value === keyword || value.replace(/ \d+$/, '') === keyword));
}

export function keywordChoices(cards: Iterable<{ text?: string }>): string[] {
  return [...new Set([...cards].flatMap(card => printedKeywords(card.text)).map(keyword => keyword.replace(/ \d+$/, '')))].sort();
}
