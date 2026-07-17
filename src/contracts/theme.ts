import { z } from 'zod';
import {
  THEME_TOKEN_TYPES,
  validateThemeTokensDocument,
  validateThemeTokensDocumentStructure,
  type ResolvedThemeToken,
  type ResolvedThemeTokens,
  type ThemeColorValue,
  type ThemeDimensionValue,
  type ThemeDurationValue,
  type ThemeToken,
  type ThemeTokenDeprecated,
  type ThemeTokenExtensions,
  type ThemeTokenGroup,
  type ThemeTokenReference,
  type ThemeTokens,
  type ThemeTokenType,
  type ThemeTokenValidationIssue,
} from '../theme-tokens/core';

export const ThemeTokenTypeSchema = z.enum(THEME_TOKEN_TYPES);

export const ThemeTokenSchema = z.record(z.string(), z.unknown()).superRefine((input, context) => {
  const issues = validateThemeTokensDocumentStructure({ token: input });
  for (const issue of issues) {
    context.addIssue({ code: 'custom', message: `${issue.path} ${issue.message}` });
  }
});

export const ThemeTokenGroupSchema = z.record(z.string(), z.unknown()).superRefine((input, context) => {
  const issues = validateThemeTokensDocumentStructure(input);
  for (const issue of issues) {
    context.addIssue({ code: 'custom', message: `${issue.path} ${issue.message}` });
  }
});

/**
 * A complete Design Tokens Community Group 2025.10 token document.
 *
 * The document root is the DTCG group/token tree itself. Tenant identity,
 * source paths, feature flags and runtime options deliberately live outside it.
 */
export const ThemeTokensSchema: z.ZodType<ThemeTokens> = z
  .record(z.string(), z.unknown())
  .superRefine((input, context) => {
    const issues = validateThemeTokensDocument(input);
    for (const issue of issues) {
      context.addIssue({ code: 'custom', message: `${issue.path} ${issue.message}` });
    }
  });

const unresolvedReference = /^\{[^{}]+\}$/;

/** A browser-safe DTCG document whose aliases and JSON Pointer references have already been materialized. */
export const ResolvedThemeTokensSchema: z.ZodType<ThemeTokens> = ThemeTokensSchema.superRefine((input, context) => {
  const visit = (value: unknown, path: (string | number)[]): void => {
    if (typeof value === 'string' && unresolvedReference.test(value)) {
      context.addIssue({ code: 'custom', path, message: 'Resolved theme tokens cannot contain token aliases.' });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === '$ref') context.addIssue({ code: 'custom', path: [...path, key], message: 'Resolved theme tokens cannot contain $ref.' });
      visit(child, [...path, key]);
    }
  };
  visit(input, []);
});

export type {
  ResolvedThemeToken,
  ResolvedThemeTokens,
  ThemeColorValue,
  ThemeDimensionValue,
  ThemeDurationValue,
  ThemeToken,
  ThemeTokenDeprecated,
  ThemeTokenExtensions,
  ThemeTokenGroup,
  ThemeTokenReference,
  ThemeTokens,
  ThemeTokenType,
  ThemeTokenValidationIssue,
};
