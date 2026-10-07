import{g as t,q as e,w as s,c as o,d as a,p as n,t as i,J as r,x as d}from"./index-Doi7Ieym.js";import"./vendor-editor-DHBHP2Dk.js";import"./vendor-react-Cl_rNibx.js";import"./vendor-firebase-BXYN1laN.js";import"./vendor-ui-react-CZAUeGLC.js";import"./vendor-motion-BAtLpE9C.js";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Retention Policy Enforcement module.
 * Deletes sessions older than the configured retention period for a psychologist.
 * Every deletion is logged to the tamper-evident audit trail.
 */async function c(c,p){const l={sessionsDeleted:0,executedAt:(new Date).toISOString()},m=Date.now()-365.25*p*24*60*60*1e3,u=(await t(e(o(a,"sessions"),s("psychologistId","==",c)))).docs.filter(t=>{var e;const s=t.data();return((null==(e=s.date)?void 0:e.toDate)?s.date.toDate():new Date(s.date)).getTime()<m});for(const t of u)try{const e=t.data();await n(i(a,"sessions",t.id)),await r(c,"session",t.id,{context:"retention_policy",retentionYears:p,sessionDate:e.date}),l.sessionsDeleted++}catch(w){}try{await d(i(a,"psychologists",c),{lastRetentionRun:l.executedAt})}catch(w){}return l}export{c as enforceRetentionPolicy};
