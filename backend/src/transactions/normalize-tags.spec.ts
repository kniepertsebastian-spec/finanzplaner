import { normalizeTags } from './normalize-tags';

describe('normalizeTags', () => {
  it('strips a leading # and trims whitespace', () => {
    expect(normalizeTags(['#Urlaub2026', '  Renovierung  '])).toEqual(['Urlaub2026', 'Renovierung']);
  });

  it('drops empty entries', () => {
    expect(normalizeTags(['#', '  ', 'Urlaub2026'])).toEqual(['Urlaub2026']);
  });

  it('deduplicates case-insensitively, keeping the first-seen casing', () => {
    expect(normalizeTags(['Urlaub2026', 'urlaub2026', 'URLAUB2026'])).toEqual(['Urlaub2026']);
  });
});
