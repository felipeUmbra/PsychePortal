// Verifies that newly added data is properly persisted to:
// 1. Google Drive (workspace.json upload requests)
// 2. Google Calendar (event creation requests)
//
// NOTE: The app no longer mirrors clinical data into localStorage
// ('mock_db_cache') — that plaintext cache was removed by the CWE-312
// security fix. Google Drive's workspace.json is the only persistence
// target, so all persistence assertions below inspect the captured
// upload request bodies instead of web storage.
const NAME = 'Persistence Test Patient';
const MODAL = 'div[class*="inset-0"]';

// Intercept request bodies may be strings, Blobs or ArrayBuffers depending
// on how the app sends them; normalize everything to text for assertions.
async function toText(body: any): Promise<string> {
    if (typeof body === 'string') return body;
    if (body instanceof Blob) return await body.text();
    if (body && typeof body.arrayBuffer === 'function') {
        return new TextDecoder().decode(await body.arrayBuffer());
    }
    try {
        return JSON.stringify(body) ?? '';
    } catch {
        return String(body);
    }
}

function createPatient() {
    cy.visit('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    cy.get(`${MODAL} input`).eq(0).type(NAME);
    cy.get(`${MODAL} input[type="date"]`).first().type('1993-09-09');
    cy.contains('button', /Salvar|Save/i).click();
    cy.contains('.card', NAME).should('be.visible');
}

function scheduleTomorrow(hour: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString().slice(0, 10);

    cy.visit('/#/app/calendar/daily');
    cy.contains('button', /Nova Consulta|New Appointment/i).click();
    cy.contains(/Agendar Consulta|Schedule Appointment/i).should('be.visible');
    cy.get(`${MODAL} select`).eq(0).select(NAME);
    cy.get(`${MODAL} input[type="date"]`).type(iso);
    cy.get(`${MODAL} select`).eq(1).select(hour);
    cy.get(MODAL)
        .contains('button', /Confirmar Agendamento|Confirm Schedule|Agendar|Schedule/i)
        .click();
    cy.get(MODAL).should('not.exist');
}

describe('Data Persistence', () => {
    // Capture every workspace.json upload so persistence can be verified
    // against the actual sync payload. Registered BEFORE loginWithGoogle's
    // stubs so it takes precedence; it replies with the same stubbed
    // payload to keep the app offline.
    const uploadBodies: string[] = [];

    beforeEach(() => {
        cy.loginWithGoogle();

        // Capture every workspace.json upload so persistence can be verified
        // against the actual sync payload. Registered AFTER loginWithGoogle's
        // stubs because Cypress gives precedence to the latest matching
        // intercept; it replies with the same stubbed payload to keep the app
        // offline.
        uploadBodies.length = 0;
        cy.intercept('POST', '**/upload/drive/v3/files**', async (req) => {
            uploadBodies.push(await toText(req.body));
            req.reply({ id: 'mock-drive-file' });
        }).as('driveUploadCapture');

        createPatient();
    });

    it('stores the new patient in the synced workspace.json (Google Drive)', () => {
        // saveToDrive debounces writes by 500ms; the retrying assertion
        // waits until the Drive flush containing the patient lands.
        // Uploads are multipart requests whose JSON part embeds the full
        // state, so assertions run against the raw request text.
        cy.wrap(null, { timeout: 15000 }).should(() => {
            const flush = uploadBodies.find((t) => t.includes(NAME));
            expect(flush, 'patient saved in a Google Drive workspace.json upload').to.exist;
            expect(flush, 'patient linked to the psychologist').to.include('"psychologistId":"test-user-123"');
            expect(flush, 'birth date saved').to.include('1993-09-09');
        });
    });

    it('syncs the new patient to Google Drive (workspace.json upload)', () => {
        // Add another patient AFTER the beforeEach capture was registered so
        // the upload triggered by this mutation is guaranteed to be observed.
        const driveName = 'Persistence Drive Patient';
        cy.visit('/#/app/patients');
        cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
        cy.get(`${MODAL} input`).eq(0).type(driveName);
        cy.get(`${MODAL} input[type="date"]`).first().type('1994-10-10');
        cy.contains('button', /Salvar|Save/i).click();
        cy.contains('.card', driveName).should('be.visible');

        cy.wrap(null, { timeout: 15000 }).should(() => {
            expect(
                uploadBodies.some((t) => t.includes(driveName)),
                'a Google Drive upload contains the new patient'
            ).to.be.true;
        });
    });

    it('syncs scheduled appointments to Google Calendar and stores the event id', () => {
        // Takes precedence over the generic calendarApi stub; a handler-less
        // intercept forwards to the next matching stubbed intercept.
        cy.intercept('POST', '**/calendar/v3/calendars/primary/events**').as('calendarCreate');

        scheduleTomorrow('09:00');

        cy.wait('@calendarCreate', { timeout: 15000 }).then((interception) => {
            const text = typeof interception.request.body === 'string'
                ? interception.request.body
                : JSON.stringify(interception.request.body);
            expect(text, 'calendar event references the patient').to.include(`Psis: Consulta - ${NAME}`);
        });

        // The mocked calendar event id must be persisted with the session in
        // the next debounced Drive flush of workspace.json.
        cy.wrap(null, { timeout: 15000 }).should(() => {
            const flush = uploadBodies.find((t) => t.includes('"googleEventId":"mock-calendar-event"'));
            expect(flush, 'session stored with a Google Calendar event id in the Drive sync').to.exist;
        });
    });
});