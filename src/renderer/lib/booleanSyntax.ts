import type { BooleanSyntaxConfig } from '../types/jd';

export const DEFAULT_BOOLEAN_SYNTAX: BooleanSyntaxConfig = {
  andOperator: 'AND',
  orOperator: 'OR',
  notOperator: 'NOT',
  phraseDelimiter: '"',
  groupingStyle: 'parentheses',
};

/**
 * Transform a boolean search string from default (LinkedIn-compatible) syntax
 * to the configured platform syntax.
 *
 * Default syntax uses: AND, OR, NOT, "phrases", (grouping)
 */
export function transformBooleanSyntax(
  booleanString: string,
  config: BooleanSyntaxConfig
): string {
  let result = booleanString;

  if (config.andOperator !== 'AND') {
    result = result.replace(/\bAND\b/g, config.andOperator);
  }
  if (config.orOperator !== 'OR') {
    result = result.replace(/\bOR\b/g, config.orOperator);
  }
  if (config.notOperator !== 'NOT') {
    result = result.replace(/\bNOT\b/g, config.notOperator);
  }

  if (config.phraseDelimiter !== '"') {
    result = result.replace(/"/g, config.phraseDelimiter);
  }

  if (config.groupingStyle === 'none') {
    result = result.replace(/[()]/g, '');
  }

  return result;
}
