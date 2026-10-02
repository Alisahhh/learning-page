import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {emptyState,emptyRecord,validateState,mergeStates,grade,evidenceReady} from '../state.js';
import {makeSubmission} from '../submission.js';
import {differentialDrive,playbackPose} from '../simulation.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const curriculum=await read('curriculum.json'),bibliography=await read('sources.json'),reviews=await read('reviews.json');
assert.equal(curriculum.schemaVersion,1);assert.equal(bibliography.schemaVersion,1);assert.equal(reviews.version,1);
assert.match(curriculum.revision,/^\d{4}-\d{2}-\d{2}$/);
const sourceIds=new Set();
for(const s of bibliography.sources){assert.ok(!sourceIds.has(s.id),`Duplicate source ${s.id}`);sourceIds.add(s.id);assert.equal(new URL(s.url).protocol,'https:');for(const key of ['title','type','read','question'])assert.ok(s[key]?.trim(),`Source ${s.id} missing ${key}`);}
const lessonIds=new Set(curriculum.lessons.map(l=>l.id));assert.equal(lessonIds.size,curriculum.lessons.length);
assert.ok(curriculum.lessons.find(l=>l.id===curriculum.currentLessonId&&l.published),'Current lesson must be published');
const staged=curriculum.stages.flatMap(s=>s.ids);assert.equal(staged.length,new Set(staged).size);assert.deepEqual(new Set(staged),lessonIds);
const published=[];
for(const meta of curriculum.lessons){
  assert.match(meta.id,/^[a-z][a-z0-9-]*$/);for(const p of meta.prerequisites)assert.ok(lessonIds.has(p),`Unknown prerequisite ${p}`);
  assert.equal(typeof meta.published,'boolean');assert.ok(meta.goals.length>=2);
  if(!meta.published)continue;
  const l=await read(`courses/${meta.id}.json`);assert.equal(l.id,meta.id);assert.equal(l.title,meta.title);published.push(l);
  for(const key of ['summary','area','number'])assert.ok(l[key]?.trim());assert.ok(l.sections.length>=3);assert.ok(l.history?.length>=2,'Published lessons need historical context');assert.ok(l.developments?.length>=1,'Published lessons need dated contemporary context');
  for(const s of l.sections){assert.ok(s.title.trim());assert.ok(s.text.length>30);}
  for(const s of l.history)if(s.source)assert.ok(sourceIds.has(s.source));
  for(const d of l.developments){assert.equal(new URL(d.url).protocol,'https:');assert.match(d.date,/^\d{4}-\d{2}-\d{2}$/);}
  for(const id of l.sources)assert.ok(sourceIds.has(id),`Unknown source ${id}`);
  assert.ok(l.quiz.length>=3);for(const q of l.quiz){assert.ok(q.options.length>=2);assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);assert.ok(q.explanation.length>10);}
  assert.ok(l.experiment.steps.length>=2);assert.ok(l.experiment.rubric.length>=3);assert.ok(l.experiment.deliverable);
  assert.equal(grade(l,l.quiz.map(q=>q.answer)),l.quiz.length);assert.equal(grade(l,[]),0);
}
for(const r of reviews.reviews){assert.ok(lessonIds.has(r.lessonId));assert.ok(['通过','需补证据','需修正'].includes(r.verdict));assert.match(r.issueUrl,/^https:\/\/github\.com\/Alisahhh\/learning-page\/issues\/\d+$/);for(const field of ['date','summary','nextStep'])assert.ok(r[field]?.trim());}
// Learning records are user data: test round trips, hostile/malformed inputs and non-destructive merging.
const state=emptyState(),r=emptyRecord();r.note='<script>not executable</script> 中文笔记';r.updatedAt=100;r.answers=[1,null,2];r.checks=[false,false,true];state.lessons['sim-first']=r;
assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);
assert.throws(()=>validateState({version:2,lessons:{}}));assert.throws(()=>validateState({version:1,lessons:{'../bad':r}}));
assert.throws(()=>validateState({version:1,lessons:{bad:{...r,checks:[null]}}}));assert.throws(()=>validateState({version:1,lessons:{bad:{...r,updatedAt:Infinity}}}));
const older=structuredClone(state);older.lessons['sim-first'].updatedAt=99;older.lessons['sim-first'].note='older';assert.equal(mergeStates(state,older).lessons['sim-first'].note,r.note);
const newer=structuredClone(older);newer.lessons['sim-first'].updatedAt=101;assert.equal(mergeStates(state,newer).lessons['sim-first'].note,'older');assert.equal(state.lessons['sim-first'].note,r.note);
const archived=structuredClone(state);archived.lessons['retired-course']=emptyRecord();assert.ok(mergeStates(archived,emptyState()).lessons['retired-course'],'Do not drop old course records');
const current=published.find(l=>l.id===curriculum.currentLessonId);assert.equal(evidenceReady(current,r),false);const checked=emptyRecord();checked.read=true;checked.answers=current.quiz.map(q=>q.answer);checked.attempts=[{at:1,answers:checked.answers}];checked.checks=current.experiment.rubric.map(()=>true);for(const k of Object.keys(checked.report))checked.report[k]='A sufficiently complete draft answer';assert.equal(evidenceReady(current,checked),true);
const short=makeSubmission(current,emptyRecord(),curriculum.revision);assert.ok(short.url.startsWith('https://github.com/Alisahhh/learning-page/issues/new?'));assert.ok(short.body.includes('lesson=sim-first'));const longRec=emptyRecord();longRec.note='这是很长的实验报告'.repeat(2000);const long=makeSubmission(current,longRec,curriculum.revision);assert.equal(long.needsPaste,true);assert.ok(long.body.includes(longRec.note),'Never silently truncate evidence');assert.ok(!new URL(long.url).searchParams.has('body'));
const straight=differentialDrive({left:2,right:2});assert.ok(Math.abs(straight.final.x-1.2)<1e-10);assert.ok(Math.abs(straight.final.y)<1e-10);const spin=differentialDrive({left:-2,right:2});assert.equal(spin.final.x,0);assert.equal(spin.final.y,0);assert.ok(Math.abs(spin.final.theta-4.8)<1e-10);assert.ok(differentialDrive({left:2,right:4,dt:.5}).error>differentialDrive({left:2,right:4,dt:.02}).error);
// Playback interpolation must not change the Euler experiment or its stored result.
const coarse=differentialDrive({left:2,right:4,dt:.5}),snapshot=JSON.stringify(coarse),mid=playbackPose(coarse,.25);
assert.ok(Math.abs(mid.x-.075)<1e-12);assert.equal(mid.y,0);assert.ok(Math.abs(mid.theta-.1)<1e-12);
for(const t of [0,.1,.49,.5,1.37,6,9]){const pose=playbackPose(coarse,t);assert.ok(Number.isFinite(pose.x)&&Number.isFinite(pose.y));}
const ending=playbackPose(coarse,6);assert.deepEqual({x:ending.x,y:ending.y,theta:ending.theta},coarse.final);
assert.equal(JSON.stringify(coarse),snapshot,'Rendering must never mutate simulation samples');
const partial=differentialDrive({left:2,right:4,dt:.5,duration:.7});assert.deepEqual(playbackPose(partial,2),{index:2,t:.7,...partial.final});
for(const name of ['qa.js','qa-context.js','backend/worker.js','bootstrap.js','app.js','content.js','state.js','simulation.js','submission.js','scripts/serve.mjs','scripts/build.mjs','scripts/read-submissions.mjs'])execFileSync(process.execPath,['--check',name],{stdio:'pipe'});
for(const name of ['index.html','style.css','favicon.svg','AGENTS.md','PLAN.md','STATUS.md','MAINTENANCE.md','REVIEW_WORKFLOW.md'])await access(name);
console.log(`PASS: ${published.length} published lesson(s), ${lessonIds.size} roadmap topics, ${sourceIds.size} sources; content/schema, grading, record round trips/merging, submission fallback and simulation invariants.`);

execFileSync(process.execPath,['scripts/check-qa.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/check-playback.mjs'],{stdio:'inherit'});
