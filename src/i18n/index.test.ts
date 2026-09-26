import { i18n } from './index';

describe('i18n', () => {
  it('uses an available locale', () => {
    const se = i18n('sv_SE');
    expect(se('Climate sensor')).toBe('Klimatdetektor');
    expect(se('A missing string')).toBe('A missing string');

    const no = i18n('nb_NO');
    expect(no('Climate sensor')).toBe('Klimasensor');
    expect(no('A missing string')).toBe('A missing string');
  });

  it('falls back to the input for an unavailable locale', () => {
    const en = i18n('en_US');
    expect(en('Climate sensor')).toBe('Climate sensor');
    expect(en('A missing string')).toBe('A missing string');
  });

  it('handles a missing locale', () => {
    const none = i18n(undefined);
    expect(none('Climate sensor')).toBe('Climate sensor');
    expect(none(undefined)).toBeUndefined();
  });
});
