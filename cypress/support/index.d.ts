/// <reference types="cypress" />

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
        }
    }
}

export { };
