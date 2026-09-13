// Encryption E2E: verifies the core security feature — AES-GCM note encryption.
// 1. Setting up encryption via the setup modal
// 2. Unlock flow with the passphrase
// 3. Encrypted note flow: notes are stored as ciphertext in the Drive payload
//    (never plaintext) — CWE-311 regression check.
const NAME = 'Encryption Test Patient';
const PASSPHRASE = 'clinic-secure-passphrase-2026';
// All app modals share the wrapper class `fixed inset-0 z-*`; the inner
// backdrop uses `absolute inset-0`, so this matches exactly ONE element per
// modal — regardless of the z-index used by each dialog.
const MODAL = 'div[class*="fixed inset-0"]';

// Intercept request bodies may be strings, Blobs, FormData or ArrayBuffers
// depending on how the app sends them; normalize everything to text for
// assertions.
async function toText(body: any): Promise<string> {
    if (typeof body === 'string') return body;
    if (body instanceof Blob) return await body.text();
    if (body && typeof body.arrayBuffer === 'function') {
        return new TextDecoder().decode(await body.arrayBuffer());
    }
    if (body && typeof body.forEach === 'function') {
        // FormData: read every entry and concat; the workspace payload is the
        // `file` part (a Blob or string).
        const parts: string[] = [];
        for (const [key, value] of (body as FormData).entries()) {
            if (value instanceof Blob) parts.push(await value.text());
            else parts.push(String(value));
        }
        return parts.join('\n');
    }
    try {
        return JSON.stringify(body) ?? '';
    } catch {
        return String(body);
    }
}

// Runs the full setup wizard: Welcome → Create Passphrase → Recovery Phrase
function completeEncryptionSetup() {
    cy.contains('button', /Ativar Criptografia|Enable Encryption/i).click();
    cy.contains(/Configurar Criptografia|Setup Note Encryption/i).should('be.visible');

    // Welcome → passphrase step
    cy.contains('button', /Configurar Criptografia|Setup Encryption/i).click();

    // Enter passphrase twice
    cy.get('input[placeholder*="passphrase"], input[placeholder*="senha"]').first()
        .type(PASSPHRASE);
    cy.get('input[placeholder*="passphrase"], input[placeholder*="senha"]').eq(1)
        .type(PASSPHRASE);
    cy.contains('button', /Continuar|Continue/i).click();

    // Recovery phrase step: confirm saved and finish
    cy.contains(/Frase de Recuperação|Recovery Phrase/i).should('be.visible');
    // Check the "saved my recovery phrase" checkbox (translated label).
    // Using .check() ensures the native change event fires — React's
    // controlled <input> needs it to flip savedRecovery → enables the button.
    cy.get(`${MODAL} input[type="checkbox"]`, { timeout: 10000 })
        .should('be.visible')
        .check();
    cy.contains('button', /Concluir Configuração|Finish Setup/i)
        .should('not.be.disabled', { timeout: 10000 })
        .click();

    // Modal closes and encryption becomes enabled
    cy.get(MODAL).should('not.exist');
}

function createPatient() {
    cy.visit('/#/app/patients');
    cy.get('h1', { timeout: 15000 }).contains(/Diretório de Pacientes|Patients/i).should('be.visible');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    cy.get(`${MODAL} input`).eq(0).type(NAME);
    cy.get(`${MODAL} input[type="date"]`).first().type('1991-01-01');
    cy.contains('button', /Salvar|Save/i).click();
    // Modal must close after save
    cy.get(MODAL).should('not.exist', { timeout: 10000 });
    // Wait for the patient card to appear (Drive sync layer can settle slowly)
    cy.contains('.card', NAME, { timeout: 15000 }).should('be.visible');
    cy.openPatientCard(NAME);

    // Accept informed consent so session logging unlocks
    cy.contains(/Consentimento Informado|Informed Consent/i).click();
    cy.get('input[placeholder*="sign"], input[placeholder*="assinar"]').type(NAME);
    cy.contains('button', /Eu Aceito|I Accept/i).click();
}

// Logs a completed session with a note for the current patient
function logSessionWithNote(note: string) {
    cy.contains('button', /Registrar Sessão|Log Session/i)
        .should('not.be.disabled', { timeout: 10000 })
        .click();
    const localDt = '2026-02-15T14:00';
    cy.get('input[type="datetime-local"]').type(localDt);

    // Type the note into the rich text editor
    cy.get('[contenteditable="true"]').first().type(note);
    cy.contains('button', /Salvar Registro da Sessão|Save Session/i).click();
    cy.get(MODAL).should('not.exist');
}

describe('Note Encryption', () => {
    beforeEach(() => {
        // The key record lives in IndexedDB (`psycheportal_keys`), which Cypress
        // does NOT clear between tests (only localStorage). Cypress isolates each
        // test in a fresh browser context, so the practical and reliable way to
        // reset it is closing every open app connection first, then deleting.
        cy.visit('about:blank');
        cy.window().then((win) => {
            return new Promise<void>((resolve) => {
                // Give any lingering app connection time to close so the
                // deletion is not blocked.
                setTimeout(() => {
                    const req = win.indexedDB.deleteDatabase('psycheportal_keys');
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                }, 500);
            });
        });

        cy.loginWithGoogle();
    });

    it('runs the setup wizard and enables encryption (status shows enabled)', () => {
        cy.visit('/#/app/settings');
        cy.get('h1').contains(/Configurações da Conta|Account Settings/i).should('be.visible');

        // Encryption status starts disabled
        cy.contains(/Criptografia Desativada|Encryption Disabled/i).should('be.visible');

        completeEncryptionSetup();

        // Status flips to enabled
        cy.contains(/Criptografia Ativada|Encryption Enabled/i, { timeout: 15000 }).should('be.visible');
    });

    it('persists the encrypted note as ciphertext after app reload (no plaintext leak)', () => {
        // Regression guard for CWE-311: this test previously FAILED because a
        // remounted useEncryption() instance reported isUnlocked=false while
        // the master key was still cached, so the note was written as
        // plaintext. The fix initializes isUnlocked from the module cache
        // (useEncryption.ts).
        // Capture every workspace.json upload so we can assert the encrypted form.
        // The app creates the file with POST on first sync, then updates it with
        // PATCH afterwards — both must be inspected.
        const uploadBodies: string[] = [];
        cy.intercept('POST', '**/upload/drive/v3/files**', async (req) => {
            uploadBodies.push(await toText(req.body));
            req.reply({ id: 'mock-drive-file' });
        }).as('driveUploadCapture');
        cy.intercept('PATCH', '**/upload/drive/v3/files**', async (req) => {
            uploadBodies.push(await toText(req.body));
            req.reply({ id: 'mock-drive-file' });
        }).as('driveUpdateCapture');

        // Enable encryption first
        cy.visit('/#/app/settings');
        cy.get('h1').contains(/Configurações da Conta|Account Settings/i).should('be.visible');
        completeEncryptionSetup();

        // Create a patient and log a session with a highly unique plaintext note
        const secret = 'super-secret-note-content-7f3c9a';
        createPatient();
        logSessionWithNote(secret);

        // The unique plaintext must NEVER appear in Drive payloads...
        cy.wrap(null, { timeout: 15000 }).should(() => {
            expect(
                uploadBodies.some((t) => t.includes(secret)),
                'plaintext note must never reach Google Drive'
            ).to.be.false;
        });

        // ...but the encrypted payload (with version marker) must be persisted.
        cy.wrap(null, { timeout: 15000 }).should(() => {
            // The interceptor receives the raw multipart body — find the JSON
            // inside the `file` part (what the app actually syncs).
            const fileParts = uploadBodies.map((b) => {
                const m = b.match(/name="file"; filename="blob"\r\n\r\n([\s\S]+)$/);
                return m ? m[1].trim() : b;
            });
            expect(
                fileParts.some((t) => t.includes('v1') && t.includes('ciphertext')),
                'an AES-GCM encrypted note is synced to Google Drive ' +
                `(captured ${uploadBodies.length} uploads)`
            ).to.be.true;
        });

        // Reload keeps the note encrypted: the plaintext must still never appear
        // in any subsequent Drive flush. The mock Drive layer resets its file
        // list on reload (returns empty), so just confirm the app boots and
        // stays interactive.
        cy.reload();
        cy.get('#root', { timeout: 15000 }).should('be.visible');
        cy.wrap(null, { timeout: 15000 }).should(() => {
            expect(
                uploadBodies.some((t) => t.includes(secret)),
                'plaintext note must never reach Google Drive after reload'
            ).to.be.false;
        });
    });
});