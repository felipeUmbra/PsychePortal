import { defineConfig } from "cypress";
import mochawesomeReporter from "cypress-mochawesome-reporter/plugin";

export default defineConfig({
  reporter: "cypress-mochawesome-reporter",
  reporterOptions: {
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
    saveAllAttempts: false,
    html: true,
    json: true,
    timestamp: "yyyy-mm-dd_HH-MM-ss",
  },
  e2e: {
    baseUrl: "http://localhost:5173",
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false,
    setupNodeEvents(on, config) {
      // Required for cypress-mochawesome-reporter to generate reports.
      mochawesomeReporter(on);
      return config;
    },
  },
});
