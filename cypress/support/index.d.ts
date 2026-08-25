/// <reference types="cypress" />

declare module "cypress-mochawesome-reporter/plugin" {
    const plugin: (on: Cypress.PluginEvents, config?: Cypress.PluginConfigOptions) => void;
    export default plugin;
}

declare global {
    interface Window {
        Cypress?: any;
        mockAuth?: {
            setUser: (user: any) => void;
            signOut: () => void;
        };
        setTestTokens?: (tokens: { driveToken: string | null; calendarToken: string | null }) => void;
    }

    namespace Cypress {
        interface Chainable {
            login(tokens: { driveToken: string; calendarToken: string }): Chainable<void>;
            loginWithGoogle(): Chainable<void>;
            openPatientCard(name: string): Chainable<void>;
            mockDriveApi(): Chainable<void>;
            mockCalendarApi(): Chainable<void>;
        }
    }
}

export { };
