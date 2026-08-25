// Verifies that newly added data is properly persisted to:
// 1. The browser cache (localStorage "mock_db_cache")
// 2. Google Drive (workspace.json upload requests)
// 3. Google Calendar (event creation requests)
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
    beforeEach(() => {
        cy.loginWithGoogle();
        createPatient();
    });

    it('stores the new patient in the browser cache (localStorage)', () => {
        // saveToDrive debounces writes by 500ms; the retrying assertion
        // waits until the cache flush containing the patient lands.
        cy.window({ timeout: 15000 }).should((win) => {
            const cache = JSON.parse(win.localStorage.getItem('mock_db_cache') || '{}');
            const stored = (cache.patients || []).find((p: any) => p.name === NAME);
            expect(stored, 'patient saved in mock_db_cache').to.exist;
            expect(stored.psychologistId, 'patient linked to the psychologist').to.equal('test-user-123');
            expect(stored.dateOfBirth, 'birth date saved').to.include('1993-09-09');
        });
    });

    it('syncs the new patient to Google Drive (workspace.json upload)', () => {
        const uploadBodies: string[] = [];
        // Registered after loginWithGoogle's stubs so it takes precedence;
        // it replies with the same stubbed payload to keep the app offline.
        cy.intercept('POST', '**/upload/drive/v3/files**', async (req) => {
            uploadBodies.push(await toText(req.body));
            req.reply({ id: 'mock-drive-file' });
        }).as('driveUploadCapture');

        // Add another patient AFTER registering the capture so the upload
        // triggered by this mutation is guaranteed to be observed.
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

        // The mocked calendar event id must be persisted with the session.
        cy.window({ timeout: 15000 }).should((win) => {
            const cache = JSON.parse(win.localStorage.getItem('mock_db_cache') || '{}');
            const session = (cache.sessions || []).find((s: any) => s.googleEventId);
            expect(session, 'session stored with a Google Calendar event id').to.exist;
            expect(session.googleEventId).to.equal('mock-calendar-event');
        });
    });
});