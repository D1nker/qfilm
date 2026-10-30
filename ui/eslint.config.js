import { globalIgnores } from "eslint/config";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import pluginVue from "eslint-plugin-vue";
import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";

const NO_PARENT_IMPORTS = {
  group: ["../*"],
  message: "Utiliser l'alias `@/` plutôt qu'un chemin relatif parent.",
};

// Qui a le droit d'importer qui : un graphe sans cycle, du plus bas (photo) au plus haut (viewer).
const FEATURE_DEPENDENCIES = {
  photo: [],
  looks: ["photo"],
  inspector: ["photo"],
  geometry: ["photo", "inspector"],
  masks: ["photo", "looks", "inspector"],
  frames: ["photo", "looks", "inspector", "geometry"],
  history: ["photo", "looks", "frames", "geometry", "masks"],
  export: ["photo", "looks", "frames", "geometry", "masks"],
  viewer: ["photo", "looks", "frames", "geometry", "masks", "history", "inspector"],
};

const restrictImports = (...patterns) => ["error", { patterns: [NO_PARENT_IMPORTS, ...patterns] }];

const featureBoundaries = Object.entries(FEATURE_DEPENDENCIES).map(([feature, allowed]) => ({
  name: `app/boundaries/${feature}`,
  files: [`src/features/${feature}/**/*.{ts,vue}`],
  rules: {
    "no-restricted-imports": restrictImports(
      ...Object.keys(FEATURE_DEPENDENCIES)
        .filter((other) => other !== feature)
        .flatMap((other) =>
          allowed.includes(other)
            ? [
                {
                  group: [`@/features/${other}/*`],
                  message: `Passer par l'index public : \`@/features/${other}\`.`,
                },
              ]
            : [
                {
                  group: [`@/features/${other}`, `@/features/${other}/*`],
                  message: `\`${feature}\` ne dépend pas de \`${other}\` (voir FEATURE_DEPENDENCIES).`,
                },
              ],
        ),
      { group: ["@/app/*"], message: "Une feature ne dépend pas de la couche `app`." },
    ),
  },
}));

export default defineConfigWithVueTs(
  { name: "app/files-to-lint", files: ["**/*.{ts,mts,vue}"] },

  globalIgnores(["**/dist/**", "**/node_modules/**", "src/shared/api/bindings.ts"]),

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

  ...featureBoundaries,

  {
    name: "app/boundaries/shared",
    files: ["src/shared/**/*.{ts,vue}"],
    rules: {
      "no-restricted-imports": restrictImports({
        group: ["@/features/*", "@/app/*"],
        message: "`shared` ne dépend d'aucune feature ni de la couche `app`.",
      }),
    },
  },

  {
    name: "app/boundaries/app",
    files: ["src/app/**/*.{ts,vue}"],
    rules: {
      "no-restricted-imports": restrictImports({
        group: ["@/features/*/*"],
        message: "Passer par l'index public d'une feature : `@/features/<nom>`.",
      }),
    },
  },

  skipFormatting,
);
