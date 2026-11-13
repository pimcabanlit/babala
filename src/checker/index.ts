export {
  checkDraft,
  checkTranslation,
  DEFAULT_MAX_SENTENCES,
  DEFAULT_MAX_WORDS,
  DEFAULT_REQUIRED,
  keptFacts,
  TRANSLATION_MAX_SENTENCES,
  TRANSLATION_MAX_WORDS,
} from './check'
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
