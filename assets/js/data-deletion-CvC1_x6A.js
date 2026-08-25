import{g as t,q as e,w as s,c as a,d as n,i as o,H as c,p as i,t as r}from"./index-DgjpGSD7.js";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data Deletion module - implements the Right to Erasure (GDPR/LGPD Article 18).
 * Deletes all patient data: patient document, sessions, consents, and Drive attachments.
 * Every deletion is logged to the tamper-evident audit trail.
 */async function d(d,l){const u={patientDeleted:!1,sessionsDeleted:0,consentsDeleted:0,attachmentsDeleted:0,executedAt:(new Date).toISOString()},D=(await t(e(a(n,"sessions"),s("patientId","==",d)))).docs.map(t=>({id:t.id,...t.data()}));for(const t of D){const e=t.attachments;if(e&&Array.isArray(e))for(const s of e)try{const e=s.storagePath||`patients/${l}/${t.id}/${s.name}`;await o({path:e}),u.attachmentsDeleted++}catch(h){}}u.attachmentsDeleted>0&&await c(l,"attachment",d,{count:u.attachmentsDeleted,context:"erasure_request"});try{await i(r(n,"patients",d)),u.patientDeleted=!0,await c(l,"patient",d,{context:"erasure_request",sessionsCount:D.length})}catch(h){}for(const t of D)try{await i(r(n,"sessions",t.id)),u.sessionsDeleted++}catch(h){}u.sessionsDeleted>0&&await c(l,"session",d,{count:u.sessionsDeleted,context:"erasure_request"});const p=await t(e(a(n,"patient_consents"),s("patientId","==",d)));for(const t of p.docs)try{await i(r(n,"patient_consents",t.id)),u.consentsDeleted++}catch(h){}return u.consentsDeleted>0&&await c(l,"consent",d,{count:u.consentsDeleted,context:"erasure_request"}),u}export{d};
