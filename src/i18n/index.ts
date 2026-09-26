import nbNO from './nb_NO.json';
import svSE from './sv_SE.json';

type Dictionary = Record<string, string>;

const locales: Record<string, Dictionary> = {
  nb_NO: nbNO,
  sv_SE: svSE,
};

export const i18n = (locale?: string) => {
  const strings = (locale && locales[locale]) || {};
  return (input?: string): string | undefined => (input && strings[input]) || input;
};
