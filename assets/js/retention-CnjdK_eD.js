import{g as t,q as e,w as s,c as o,d as n,p as a,t as i,H as c,x as r}from"./index-DaPnrxAg.js";import"./vendor-editor-ocSpIE3X.js";import"./vendor-react-4XfLXq7U.js";import"./vendor-firebase-BXYN1laN.js";import"./vendor-recharts-DXgHyOgZ.js";import"./vendor-ui-react-B_XAFiFw.js";import"./vendor-motion-BAtLpE9C.js";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Retention Policy Enforcement module.
 * Deletes sessions older than the configured retention period for a psychologist.
 * Every deletion is logged to the tamper-evident audit trail.
 */async function d(d,p){const f={sessionsDeleted:0,consentsAffected:0,executedAt:(new Date).toISOString()},w=Date.now()-365.25*p*24*60*60*1e3,l=(await t(e(o(n,"sessions"),s("psychologistId","==",d)))).docs.filter(t=>{var e;const s=t.data();return((null==(e=s.date)?void 0:e.toDate)?s.date.toDate():new Date(s.date)).getTime()<w}),m=new Set;for(const t of l){const e=t.data();e.patientId&&m.add(e.patientId)}for(const t of l)try{const e=t.data();await a(i(n,"sessions",t.id)),await c(d,"session",t.id,{context:"retention_policy",retentionYears:p,sessionDate:e.date}),f.sessionsDeleted++}catch(y){}for(const r of m)try{if((await t(e(o(n,"sessions"),s("patientId","==",r),s("psychologistId","==",d)))).empty){const p=await t(e(o(n,"patient_consents"),s("patientId","==",r)));for(const t of p.docs)try{await a(i(n,"patient_consents",t.id)),await c(d,"consent",t.id,{context:"retention_policy",patientId:r}),f.consentsAffected++}catch(y){}}}catch(y){}try{await r(i(n,"psychologists",d),{lastRetentionRun:f.executedAt})}catch(y){}return f}export{d as enforceRetentionPolicy};
