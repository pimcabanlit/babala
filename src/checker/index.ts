export {
  checkDraft,
  LANDFALL_WORDS,
  checkTranslation,
  DEFAULT_MAX_SENTENCES,
  DEFAULT_MAX_WORDS,
  DEFAULT_REQUIRED,
  keptFacts,
  TRANSLATION_MAX_SENTENCES,
  TRANSLATION_MAX_WORDS,
} from './check'
export { ANSWER_MAX_SENTENCES, ANSWER_MAX_WORDS, checkAnswer, isEverydayWord, placeNames, type AnswerAlert, type AnswerOptions } from './answer'
export { phrasePattern, sentences } from './text'
export { extractFigures, normalizeDate, normalizePhone, normalizeTime } from './figures'
export type {
  CheckOptions,
  CheckResult,
  FactSheet,
  Issue,
  IssueSubject,
  RequiredFact,
  Rule,
  Span,
  TranslatedClaim,
  TranslationOptions,
} from './types'
