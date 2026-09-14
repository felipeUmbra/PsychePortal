import{g as t,q as e,w as s,c as o,d as n,p as a,t as i,J as c,x as d}from"./index-pThu2OGW.js";import"./vendor-editor-DHBHP2Dk.js";import"./vendor-react-Cl_rNibx.js";import"./vendor-firebase-BXYN1laN.js";import"./vendor-ui-react-DGnCPCJM.js";import"./vendor-motion-BAtLpE9C.js";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Retention Policy Enforcement module.
 * Deletes sessions older than the configured retention period for a psychologist.
 * Every deletion is logged to the tamper-evident audit trail.
 */async function r(r,p){const f={sessionsDeleted:0,consentsAffected:0,executedAt:(new Date).toISOString()},w=Date.now()-365.25*p*24*60*60*1e3,l=(await t(e(o(n,"sessions"),s("psychologistId","==",r)))).docs.filter(t=>{var e;const s=t.data();return((null==(e=s.date)?void 0:e.toDate)?s.date.toDate():new Date(s.date)).getTime()<w}),y=new Set;for(const t of l){const e=t.data();e.patientId&&y.add(e.patientId)}for(const t of l)try{const e=t.data();await a(i(n,"sessions",t.id)),await c(r,"session",t.id,{context:"retention_policy",retentionYears:p,sessionDate:e.date}),f.sessionsDeleted++}catch(m){}for(const d of y)try{if((await t(e(o(n,"sessions"),s("patientId","==",d),s("psychologistId","==",r)))).empty){const p=await t(e(o(n,"patient_consents"),s("patientId","==",d)));for(const t of p.docs)try{await a(i(n,"patient_consents",t.id)),await c(r,"consent",t.id,{context:"retention_policy",patientId:d}),f.consentsAffected++}catch(m){}}}catch(m){}try{await d(i(n,"psychologists",r),{lastRetentionRun:f.executedAt})}catch(m){}return f}export{r as enforceRetentionPolicy};
