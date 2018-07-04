module.exports = (locale) => {
  let strings;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    strings = require(`./${locale}`);
  } catch (e) {
    strings = {};
  }

  return string => (strings[string] ? strings[string] : string);
};
