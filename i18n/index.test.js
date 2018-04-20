const i18n = require('./index');

describe('I18n', () => {
  it('use available locale', () => {
    const se = i18n('sv_SE');
    expect(se('Climate sensor')).toBe('Klimatdetektor');
    expect(se('A missing string')).toBe('A missing string');

    const no = i18n('nb_NO');
    expect(no('Climate sensor')).toBe('Klimasensor');
    expect(no('A missing string')).toBe('A missing string');
  });

  it('use unavailable locale', () => {
    const en = i18n('en_US');
    expect(en('Climate sensor')).toBe('Climate sensor');
    expect(en('A missing string')).toBe('A missing string');
  });
});
