/**
 * Module declaration for `eslint-plugin-jsx-a11y` 6.10.2, which ships no types
 * (design C15). Declares only the parts `eslint-config.ts` uses.
 */

declare module 'eslint-plugin-jsx-a11y' {
  import type { ESLint, Linter } from 'eslint';

  interface JsxA11yFlatConfig {
    readonly rules: Linter.RulesRecord;
  }

  interface JsxA11yPlugin extends ESLint.Plugin {
    readonly flatConfigs: {
      readonly recommended: JsxA11yFlatConfig;
      readonly strict: JsxA11yFlatConfig;
    };
  }

  const plugin: JsxA11yPlugin;
  export default plugin;
}
