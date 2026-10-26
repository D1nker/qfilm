import { globalIgnores } from "eslint/config";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";

export default defineConfigWithVueTs(
  { name: "app/files-to-lint", files: ["**/*.{ts,mts,vue}"] },

  globalIgnores(["**/dist/**", "**/node_modules/**", "src-tauri/**"]),

  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommendedTypeChecked,
  vueTsConfigs.stylistic,

  {
    name: "app/typescript",
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message: "Utiliser l'alias `@/` plutôt qu'un chemin relatif parent.",
            },
          ],
        },
      ],
    },
  },

  {
    name: "app/vue",
    rules: {
      "vue/block-order": ["error", { order: ["template", "script", "style"] }],
      "vue/block-lang": ["error", { script: { lang: "ts" } }],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/define-macros-order": ["error", { order: ["defineProps", "defineEmits"] }],
      "vue/define-props-declaration": ["error", "type-based"],
      "vue/define-emits-declaration": ["error", "type-literal"],
      "vue/multi-word-component-names": ["error", { ignores: ["App"] }],
      "vue/no-unused-refs": "error",
      "vue/prefer-true-attribute-shorthand": "error",
      "vue/v-on-event-hyphenation": ["error", "always"],
    },
  },

  skipFormatting,
);
