import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

/// Les captures d'écran de l'application pour le site : elles ne font pas partie de la suite de tests.
export default defineConfig({
  ...base,
  testMatch: "site-screenshots.spec.ts",
  testIgnore: undefined,
  fullyParallel: false,
  workers: 1,
});
