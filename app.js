import {mountLessonQA} from './qa.js';
import {lessons,stages,sources,revision,publishedLessonIds,currentLessonId} from './content.js';
import {STORAGE_KEY,emptyState,emptyRecord,grade,quizPassed,evidenceReady,validateState,mergeStates} from './state.js';

import {makeSubmission,REPOSITORY,ISSUE_PREFIX} from './submission.js';
import {differentialDrive} from './simulation.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = emptyState(), storageOK = true, toastTimer, wheelAnimation=0, wheelRunning=false;
try { const raw = localStorage.getItem(STORAGE_KEY); if(raw) state=validateState(JSON.parse(raw)); }
catch { storageOK=false; }
const record = id => state.lessons[id] ?? emptyRecord();
const byId = id => lessons.find(l=>l.id===id);
const isPublished = lesson => publishedLessonIds.includes(lesson.id);
function labTargetId(){const id=new URLSearchParams(location.hash.split('?')[1]||'').get('lesson');return publishedLessonIds.includes(id)?id:currentLessonId;}
function lessonLab(l){if(l.experiment.lab==='delay')return '<a class="button" href="#delay-lab?lesson='+l.id+'">打开本章延迟实验</a>';if(l.experiment.lab==='wheel')return '<a class="button" href="#lab?lesson='+l.id+'">打开本章轮式实验</a>';return l.id===currentLessonId?'<a class="button" href="#lab?lesson='+l.id+'">打开轮式仿真实验台</a><a class="text-link" href="https://github.com/Alisahhh/learning-page/tree/main/labs" target="_blank" rel="noopener noreferrer">可选：MuJoCo 接触实验 ↗</a>':'';}
const date = timestamp => timestamp ? new Date(timestamp).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : '尚未记录';
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500); }
function save() {
  if(!storageOK) { $('#save-state').textContent='未持久保存，请导出备份'; toast('浏览器存储不可用或旧档案无法读取。本次记录仍在内存，请导出备份；旧存储未覆盖。'); return false; }
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); $('#save-state').textContent='已保存到此浏览器'; return true; }
  catch { $('#save-state').textContent='保存失败，请导出备份'; toast('保存失败，可能是存储空间不足。请立即导出备份。'); return false; }
}
function update(id, edit) { state.lessons[id] ??= emptyRecord(); edit(state.lessons[id]); state.lessons[id].updatedAt=Date.now(); save(); }
function status(lesson) {
  if(!isPublished(lesson)) return ['planned','候选主题'];
  const r=record(lesson.id);
  if(evidenceReady(lesson,r)) return ['ready','已完成自查'];
  if(quizPassed(lesson,r)) return ['passed','小测已通过'];
  if(r.read || r.note || r.answers.length || Object.values(r.report).some(Boolean)) return ['active','学习中'];
  return ['new','待开始'];
}
function badge(lesson) { const [type,label]=status(lesson); return `<span class="status ${type}">${label}</span>`; }
function stats() {
  return {read:lessons.filter(l=>isPublished(l)&&record(l.id).read).length,quiz:lessons.filter(l=>isPublished(l)&&quizPassed(l,record(l.id))).length,evidence:lessons.filter(l=>isPublished(l)&&evidenceReady(l,record(l.id))).length};
}
function resourceCards(ids) {
  return ids.map(id=>sources.find(s=>s.id===id)).filter(Boolean).map(s=>`<article class="resource-card"><div class="resource-meta">${esc(s.type)} <span>${esc(s.topic)}</span></div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} <span aria-hidden="true">↗</span></a><p>${esc(s.read)}</p><div class="reading-question">带着问题读：${esc(s.question)}</div>${s.note?`<small>${esc(s.note)}</small>`:''}</article>`).join('');
}
function home() {
  const s=stats(), next=byId(currentLessonId);
  return `<div class="page-heading"><div><p class="eyebrow">FROM SYSTEMS TO INTELLIGENCE</p><h1>从系统，到智能。</h1><p class="subtitle">沿着一条机器人学习闭环，把熟悉的工程经验变成新的能力。</p></div><span class="edition">学习路线 / 01</span></div>
  <div class="overview-grid"><section class="continue-card"><div><span class="eyebrow">${s.read?'继续学习':'从这里开始'}</span><h2>${esc(next.title)}</h2><p>${esc(next.summary)}</p><a class="button white" href="#lesson/${next.id}">进入第 ${next.number} 单元</a></div><div class="loop-diagram" aria-label="学习闭环：观测、策略、动作与反馈"><span>观测</span><i>↓</i><span class="selected">策略 π</span><i>↓</i><span>动作</span><small>机器人 · 环境 · 反馈</small></div></section>
  <section class="progress-card"><div class="section-kicker">已开放课程进展</div><div class="progress-number">${s.evidence}<span> / ${publishedLessonIds.length} 已发布单元自查完成</span></div><progress value="${s.evidence}" max="${publishedLessonIds.length}" aria-label="单元自查完成进度"></progress><div class="progress-details"><span><b>${s.read}</b> 已阅读</span><span><b>${s.quiz}</b> 小测通过</span></div><p class="muted">提交实验成果、完成评审后，再决定下一轮课程。自查不等于审核通过。</p></section></div>
  <div class="notice"><b>主课按成果推进，基础课可提前阅读。</b> ${esc(byId(currentLessonId).number)} 单元是当前课程。目前开放 ${publishedLessonIds.length} 章，其余为候选主题；主课后续内容仍根据你的成果调整。</div>
  <div class="map-layout"><section><div class="section-heading"><h2>你的学习路线</h2><span>${stages.length} 个方向 · ${publishedLessonIds.length} 章已开放 · ${lessons.length-publishedLessonIds.length} 个候选主题 · 不设期限</span></div><div class="stages">${stages.map((stage,i)=>`<section class="stage"><div class="stage-header"><span class="stage-index">${String(i+1).padStart(2,'0')}</span><div><span class="eyebrow">${stage.tag}</span><h3>${stage.name}</h3><p>${stage.description}</p></div></div><div class="lesson-list">${stage.ids.map(id=>{const l=byId(id);return `<a class="lesson-row" href="#lesson/${id}"><span class="lesson-number">${l.number}</span><div><h4>${esc(l.title)}</h4><span>${esc(l.area)}</span></div>${badge(l)}<span class="row-chevron" aria-hidden="true">›</span></a>`;}).join('')}</div></section>`).join('')}</div></section>
  <aside class="right-rail"><section class="rail-card"><span class="section-kicker">本轮的验收目标</span><h3>${esc(byId(currentLessonId).title)}</h3><p>${esc(byId(currentLessonId).summary)}</p><ol class="goal-list">${byId(currentLessonId).goals.map(g=>`<li>${esc(g)}</li>`).join('')}</ol></section><section class="rail-card pale"><span class="section-kicker">怎样算真正学会</span><p><b>读懂 → 做出 → 验证 → 解释</b></p><p>每课都有讲解、小测和实验交付物。完成后在网页提交到 GitHub，说一句“检查进度”，我就去读取证据。</p><a class="text-link" href="#notebook">查看学习档案</a></section><section class="rail-note"><b>从工程问题进入原理</b><p>先理解“为什么动作会抖动”，再补延迟、控制频率与分布偏移。需要哪块数学，就把哪块补扎实。</p></section></aside></div>`;
}
function lessonPage(l) {
  const r=record(l.id), last=r.attempts.at(-1), index=lessons.indexOf(l);
  return `<a class="back-link" href="#home">‹ 返回学习地图</a><div class="lesson-heading"><span class="eyebrow">UNIT ${l.number} / ${esc(l.area)}</span><h1>${esc(l.title)}</h1><p class="subtitle">${esc(l.summary)}</p><div class="lesson-meta">${badge(l)}<span>先修：${l.prerequisites.length?l.prerequisites.map(id=>`<a href="#lesson/${id}">${byId(id).number} ${esc(byId(id).title)}</a>`).join(' / '):'ROS 系统与中间件经验'}</span></div></div>
  <div class="reader-layout"><article class="reader"><section class="objectives"><span class="section-kicker">学完后，你应该能够</span><ul>${l.goals.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></section><section id="explanation" class="prose">${l.sections.map((s,i)=>`<h2>${esc(s.title)}</h2><p>${esc(s.text)}</p><button class="text-button ask-section" data-ask-section="${i}" type="button">解释这段 ↗</button>`).join('')}<div class="example"><span class="section-kicker">具体例子 / 示意片段</span><pre>${esc(l.example)}</pre></div>${historySection(l)}<label class="read-check"><input type="checkbox" id="read-check" ${r.read?'checked':''}> 我已阅读，并能复述本课的主要概念</label></section>
  <section class="learning-section" id="experiment"><span class="eyebrow">LEARN BY DOING</span><h2>${esc(l.experiment.title)}</h2><div class="button-row">${lessonLab(l)}</div><ol class="experiment-steps">${l.experiment.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="deliverable"><b>要交付什么</b><p>${esc(l.experiment.deliverable)}</p></div><h3>实验报告</h3><p class="muted">写清你实际做了什么，区分运行结果和推测。草稿自动保存在此浏览器。只有你通过提交入口确认后，才会成为 GitHub 成果。</p>${[['question','问题与假设','你准备验证什么？预期看到什么？'],['method','环境与方法','代码版本、数据来源、参数、对照组、运行方法……'],['result','结果与证据','记录指标、失败轨迹、日志或代码位置；未运行的部分请明确说明。'],['reflection','解释、局限与下一步','结果支持什么结论？还有什么未知？下一步怎样验证？']].map(([field,label,placeholder])=>`<label class="field-label" for="report-${field}">${label}</label><textarea id="report-${field}" data-report="${field}" maxlength="20000" rows="4" placeholder="${placeholder}">${esc(r.report[field])}</textarea>`).join('')}<h3>验收自查</h3><div class="rubric">${l.experiment.rubric.map((item,i)=>`<label><input type="checkbox" data-check="${i}" ${r.checks[i]?'checked':''}><span>${esc(item)}</span></label>`).join('')}</div><p class="muted">自查不等于审核通过。阅读、小测通过、报告四栏各至少 10 个字且全部自查后，会标记“已完成自查”；字数仅检查是否填写。</p><div class="button-row"><button class="button secondary" data-export-lesson="${l.id}">导出本课评审报告</button><span id="evidence-status" class="muted">${evidenceReady(l,r)?'已完成自查，待实际证据评审':'继续补充实验与自查记录'}</span></div></section>
  ${submissionPanel(l)}<section class="learning-section" id="quiz"><span class="eyebrow">CHECK YOUR UNDERSTANDING</span><h2>概念小测</h2><p class="muted">三题全对视为本课小测通过。可以重复练习，每次提交都保留记录。</p><form id="quiz-form">${l.quiz.map((question,i)=>`<fieldset><legend><span>${i+1}.</span> ${esc(question.prompt)}</legend>${question.options.map((option,j)=>`<label class="option"><input required type="radio" name="q${i}" value="${j}" ${r.answers[i]===j?'checked':''}><span>${esc(option)}</span></label>`).join('')}</fieldset>`).join('')}<button class="button" type="submit">提交并查看解析</button></form><div id="quiz-result" aria-live="polite">${last?quizResult(l,last):''}</div></section>
  <section class="learning-section" id="notes"><h2>我的理解与疑问</h2><label class="field-label" for="lesson-notes">试着不用术语复述本课；记下还解释不清的地方。</label><textarea id="lesson-notes" maxlength="50000" rows="7" placeholder="今天理解了什么？哪里仍然卡住？">${esc(r.note)}</textarea></section><section class="learning-section" id="reading"><h2>带着问题去阅读</h2><div class="resource-list">${resourceCards(l.sources)}</div><p class="muted">资料入口首轮核查：${revision}。文档与源码会更新，安装或复现前请确认版本；这不代表已复现来源中的实验。</p></section>
  <div class="notice">本轮完成后，使用本课的提交入口提交 GitHub 成果。对话中说“检查进度”，我会自行读取、评审，再决定补课或发布下一课。</div><div class="lesson-pagination"><a class="button secondary" href="#home">返回学习地图</a><a class="button" href="#notebook">整理成果，准备评审</a></div></article><aside class="reader-toc"><span class="section-kicker">本课导航</span><a href="#lesson/${l.id}" data-scroll="explanation">01 · 原理与例子</a><a href="#lesson/${l.id}" data-scroll="experiment">02 · 实验与报告</a><a href="#lesson/${l.id}" data-scroll="quiz">03 · 概念小测</a><a href="#lesson/${l.id}" data-scroll="notes">04 · 理解与疑问</a><a href="#lesson/${l.id}" data-scroll="reading">05 · 延伸阅读</a><div class="toc-note">为什么现在学这一课？<br>${esc(l.sections.find(s=>s.title.includes('为什么'))?.text||l.summary)}</div>${lessonLab(l)}</aside></div>`;
}
function quizResult(l,attempt) {
  const score=grade(l,attempt.answers);
  return `<div class="quiz-summary ${score===l.quiz.length?'success':''}"><b>${score} / ${l.quiz.length} · ${score===l.quiz.length?'小测通过':'继续练习'}</b><span>${date(attempt.at)}（北京时间）</span></div>${l.quiz.map((q,i)=>`<div class="answer-review ${attempt.answers[i]===q.answer?'correct':'incorrect'}"><b>${i+1}. ${attempt.answers[i]===q.answer?'回答正确':'需要再想一想'}</b><p>正确答案：${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p></div>`).join('')}`;
}
function resourcesPage() {
  return `<div class="page-heading"><div><p class="eyebrow">READ WITH A QUESTION</p><h1>资料与论文</h1><p class="subtitle">每一份资料，都对应一个你需要回答的工程问题。</p></div></div><div class="notice">先读课程，再按问题选读。论文、文档与源码是技术依据，视频帮助理解；收藏数量不计入学习进度。</div><div class="resource-grid">${resourceCards(sources.map(s=>s.id))}</div><div class="reference-note"><h2>资料核查说明</h2><p>首轮入口核查于 ${revision}。已阅读部分官方文档与项目说明；论文入口、摘要和研究对象已核对，不表示全文复现。Bilibili 入口来自作者书籍仓库，尚未逐集审看。课程中的练习与讲解是面向你的工程学习设计，不能代替原始文献与具体项目版本。</p></div>`;
}
function notebook() {
  const s=stats(), touched=lessons.filter(l=>state.lessons[l.id]);
  return `<div class="page-heading"><div><p class="eyebrow">KEEP THE EVIDENCE</p><h1>学习档案</h1><p class="subtitle">留下你的理解、实验与问题，让下一次学习从这里继续。</p></div></div><div class="notice"><b>记录保存在当前浏览器。</b> 不会自动同步到 GitHub 或其他设备。清理浏览器数据会丢失本地记录，请定期导出备份。评审报告可通过本轮课程的提交按钮保存为 GitHub Issue，网页不会自动审核实验。</div><div class="archive-actions"><button class="button" id="export-backup">导出 JSON 备份</button><label class="button secondary upload-label" for="import-backup">导入备份</label><input type="file" id="import-backup" accept=".json,application/json" class="visually-hidden"><button class="button secondary" id="export-report">导出完整评审报告</button></div><p class="muted">导入会先校验格式，再按每课更新时间合并，保留较新的整课记录。合并前会下载当前档案备份；最多支持 5 MB 文件。</p><div class="archive-stats"><div><b>${s.read}</b><span>已阅读</span></div><div><b>${s.quiz}</b><span>小测通过</span></div><div><b>${s.evidence}</b><span>已完成自查</span></div></div><section class="submission-box"><h3>仓库中的成果与评审</h3><p>已提交的成果在 GitHub 持续保留。本地笔记与远端 Issue 分开，不会自动将网页草稿标记为已提交。</p><button class="button secondary" id="load-submissions">读取已提交成果</button><div id="remote-submissions" class="issue-list" aria-live="polite"></div><div id="published-reviews" aria-live="polite"></div></section><h2 style="margin-top:30px">课程记录</h2>${touched.length?touched.map(l=>{const r=record(l.id);return `<article class="archive-card"><div><span class="eyebrow">UNIT ${l.number}</span><h3><a href="#lesson/${l.id}">${esc(l.title)}</a></h3><p>${r.attempts.length} 次测验 · ${Object.values(r.report).filter(v=>v.trim()).length}/4 栏实验记录 · 更新于 ${date(r.updatedAt)}</p></div>${badge(l)}${r.note?`<blockquote>${esc(r.note.slice(0,180))}${r.note.length>180?'…':''}</blockquote>`:''}</article>`;}).join(''):'<div class="empty-state"><span aria-hidden="true">▧</span><h3>第一份记录，从一个问题开始。</h3><p>读完本轮课程，写下你对观测、策略与动作的理解。</p><a class="button" href="#lesson/sim-first">进入本轮课程</a></div>'}<section class="reference-note"><h2>怎样让我自己读取成果</h2><p>在本轮课程中点击“准备提交本课成果”，检查后在 GitHub 确认创建 Issue。之后对话里说“检查进度”即可，我会读取仓库成果；无需搬运报告。长报告会提供完整复制与粘贴提交方式。该仓库公开，成果 Issue 也公开。</p></section>`;
}
function lab() {
  return `<div class="page-heading"><div><p class="eyebrow">CHANGE ONE THING, OBSERVE THE RESULT</p><h1>延迟怎样改变闭环</h1><p class="subtitle">同一个控制器，为什么接上通信和推理链路后就开始来回晃？</p></div></div><div class="lab-layout"><section class="lab-controls"><span class="section-kicker">实验条件</span><h2>一维到点控制</h2><p>从 0 m 出发，目标为 1 m。先固定增益，只增加命令延迟，观察超调与最终误差。</p><label for="delay">命令延迟 <output id="delay-value">200 ms</output></label><input id="delay" type="range" min="0" max="800" step="20" value="200"><label for="gain">比例增益 Kp <output id="gain-value">2.0 s⁻¹</output></label><input id="gain" type="range" min="0.5" max="8" step="0.5" value="2"><button class="button" id="run-lab">运行对照实验</button><p class="muted">蓝线：当前延迟<br>灰色虚线：相同增益、零延迟<br>虚线水平线：目标位置</p><a class="text-link" href="#lesson/${labTargetId()}">回到对应课程</a></section><section class="lab-results"><div class="section-heading"><h2>位置随时间的变化</h2><span>数值示意 · 8 秒</span></div><svg id="lab-chart" viewBox="0 0 760 370" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">延迟和零延迟的到点响应对照</title><desc id="chart-description">运行实验后显示位置曲线和指标。</desc></svg><div class="lab-metrics" id="lab-metrics" aria-live="polite"></div><p id="lab-conclusion"></p><p class="muted">结果保存到：${esc(byId(labTargetId()).title)}</p><button class="button secondary" id="save-lab">把实验结果记入本轮报告</button></section></div><section class="reference-note"><h2>这里的模型是什么</h2><p>使用离散一阶运动学：x[k+1] = x[k] + Δt · u[k−d]，u[k] = clip(Kp · (1−x[k]), −1, 1) m/s，Δt = 0.02 s。延迟以前的命令设为 0。控制器当前计算的命令被队列延迟 d 步执行。</p><p>这里忽略质量、加速度、电机、轮胎、定位噪声与网络抖动。它用于理解延迟机制，不能作为真机参数整定或物理仿真验证。图中指标是本示意模型的计算值。</p><h3>先预测，再比较</h3><ol><li>固定 Kp = 2，分别运行 0、200、600 ms。</li><li>固定延迟 600 ms，再增大 Kp，观察是否出现更明显的振荡。</li><li>解释为什么“更快追上目标”的增益在有延迟时可能表现更差。</li></ol></section>`;
}
let labResult;
function simulate(delayMs,gain) {
  const dt=.02,steps=400,d=Math.round(delayMs/20),positions=[0],commands=[];
  for(let k=0;k<steps;k++){ commands.push(Math.max(-1,Math.min(1,gain*(1-positions[k])))); positions.push(positions[k]+dt*(k>=d?commands[k-d]:0)); }
  return {positions,overshoot:Math.max(0,...positions.map(x=>x-1)),error:Math.abs(positions.at(-1)-1)};
}
function drawLab() {
  const delay=Number($('#delay').value),gain=Number($('#gain').value),actual=simulate(delay,gain),base=simulate(0,gain);
  const min=Math.min(-.1,...actual.positions),max=Math.max(1.3,...actual.positions)+.08, x=t=>60+t/8*670,y=v=>310-(v-min)/(max-min)*270;
  const path=p=>p.map((v,i)=>`${i?'L':'M'}${x(i*.02).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  $('#lab-chart').innerHTML=`<title id="chart-title">延迟 ${delay} 毫秒与零延迟对照，增益 ${gain}</title><desc id="chart-description">当前延迟超调 ${actual.overshoot.toFixed(3)} 米，8 秒最终误差 ${actual.error.toFixed(3)} 米。</desc>${[0,.5,1,1.5,2].filter(v=>v<=max).map(v=>`<line x1="60" y1="${y(v)}" x2="730" y2="${y(v)}" stroke="#e6e9f1"/><text x="48" y="${y(v)+5}" text-anchor="end">${v.toFixed(1)}</text>`).join('')}<line x1="60" y1="${y(1)}" x2="730" y2="${y(1)}" stroke="#7a879b" stroke-dasharray="4 5"/>${[0,2,4,6,8].map(t=>`<text x="${x(t)}" y="339" text-anchor="middle">${t}</text>`).join('')}<text x="60" y="22">位置 / m</text><text x="730" y="362" text-anchor="end">时间 / s</text><path d="${path(base.positions)}" fill="none" stroke="#8993a6" stroke-width="2" stroke-dasharray="7 5"/><path d="${path(actual.positions)}" fill="none" stroke="#254ad6" stroke-width="3"/>`;
  $('#lab-metrics').innerHTML=`<div><b>${delay}<small> ms</small></b><span>命令延迟</span></div><div><b>${actual.overshoot.toFixed(3)}<small> m</small></b><span>最大超调</span></div><div><b>${actual.error.toFixed(3)}<small> m</small></b><span>8 秒最终误差</span></div>`;
  $('#lab-conclusion').textContent=actual.overshoot>.05?'出现了明显超调：旧命令仍在执行时，当前位置可能已经越过目标。比较同增益的零延迟曲线，再判断延迟的影响。':'这组参数下超调较小。保持增益不变，增大延迟再比较；一次平稳响应不能代表所有参数都稳定。';
  labResult={delay,gain,...actual};
}
function download(name,content,type) {
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function reportText(selected=lessons.filter(isPublished)) {
  return `# 具身学习手记 · 成果评审材料\n\n课程版本：${revision}\n导出时间：${date(Date.now())}（北京时间）\n\n说明：测验是概念检查，自查不是实验审核。请结合代码、日志和配置检查证据。\n\n`+selected.map(l=>{const r=record(l.id);return `## ${l.number} ${l.title}\n\n状态：${status(l)[1]}\n\n### 能力目标\n${l.goals.map(x=>'- '+x).join('\n')}\n\n### 我的理解与疑问\n${r.note||'尚未填写'}\n\n### 实验：${l.experiment.title}\n\n问题与假设：\n${r.report.question||'尚未填写'}\n\n环境与方法：\n${r.report.method||'尚未填写'}\n\n结果与证据：\n${r.report.result||'尚未填写'}\n\n解释、局限与下一步：\n${r.report.reflection||'尚未填写'}\n\n### 验收自查（非审核结论）\n${l.experiment.rubric.map((x,i)=>`- [${r.checks[i]?'x':' '}] ${x}`).join('\n')}\n\n### 小测记录\n${r.attempts.length?r.attempts.map(a=>`${date(a.at)}：${grade(l,a.answers)}/${l.quiz.length}；答案索引 ${JSON.stringify(a.answers)}`).join('\n'):'尚未提交'}\n\n### 请评审者检查\n1. 结论是否有对应证据？\n2. 方法、指标与比较协议是否合理？\n3. 有哪些错误、缺证据或尚未验证的边界？\n4. 下一次应补哪项能力？\n\n`;}).join('---\n\n');
}
function bind(l) {
  document.querySelectorAll('[data-scroll]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.getElementById(a.dataset.scroll).scrollIntoView({behavior:'smooth',block:'start'});}));
  if(l){
    const refreshEvidence=()=>{$('#evidence-status').textContent=evidenceReady(l,record(l.id))?'已完成自查，待实际证据评审':'继续补充实验与自查记录';};
    $('#read-check').addEventListener('change',e=>{update(l.id,r=>r.read=e.target.checked);refreshEvidence();});
    $('#lesson-notes').addEventListener('input',e=>update(l.id,r=>r.note=e.target.value));
    document.querySelectorAll('[data-report]').forEach(t=>t.addEventListener('input',e=>{update(l.id,r=>r.report[t.dataset.report]=e.target.value);refreshEvidence();}));
    document.querySelectorAll('[data-check]').forEach(c=>c.addEventListener('change',e=>{update(l.id,r=>{r.checks=Array.from({length:l.experiment.rubric.length},(_,i)=>i===Number(c.dataset.check)?e.target.checked:Boolean(r.checks[i]));});refreshEvidence();}));
    // Fill sparse arrays explicitly: JSON round trips must preserve valid booleans/answers.
    document.querySelectorAll('#quiz-form input').forEach(radio=>radio.addEventListener('change',()=>update(l.id,r=>{r.answers=Array.from({length:l.quiz.length},(_,i)=>{const v=document.querySelector(`input[name="q${i}"]:checked`);return v?Number(v.value):null;});})));
    $('#quiz-form').addEventListener('submit',e=>{e.preventDefault();const answers=l.quiz.map((_,i)=>Number(new FormData(e.target).get(`q${i}`))),attempt={at:Date.now(),answers};update(l.id,r=>{r.answers=answers;r.attempts=[...r.attempts,attempt].slice(-500);});$('#quiz-result').innerHTML=quizResult(l,attempt);refreshEvidence();$('#quiz-result').scrollIntoView({behavior:'smooth',block:'start'});});
    document.querySelector('[data-export-lesson]').addEventListener('click',()=>download(`learning-review-${l.id}.md`,reportText([l]),'text/markdown;charset=utf-8'));
  }
  $('#export-backup')?.addEventListener('click',()=>download('learning-backup.json',JSON.stringify(state,null,2),'application/json'));
  $('#export-report')?.addEventListener('click',()=>download('learning-review.md',reportText(),'text/markdown;charset=utf-8'));
  $('#import-backup')?.addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>5*1024*1024)throw Error('文件超过 5 MB，未导入。');const incoming=validateState(JSON.parse(await file.text())),merged=mergeStates(state,incoming);download('learning-backup-before-import.json',JSON.stringify(state,null,2),'application/json');state=merged;save();render();toast('已按每课更新时间合并。导入前的档案已下载备份。');}catch(error){toast(`导入失败：${error.message}`);}finally{e.target.value='';}
  });
  if($('#run-lab')) {
    for(const id of ['delay','gain']) $('#'+id).addEventListener('input',()=>{$('#delay-value').textContent=$('#delay').value+' ms';$('#gain-value').textContent=Number($('#gain').value).toFixed(1)+' s⁻¹';});
    $('#run-lab').addEventListener('click',drawLab);drawLab();
    $('#save-lab').addEventListener('click',()=>{const r=labResult;update(labTargetId(),v=>{v.report.result+=(v.report.result?'\n\n':'')+`[网页一维示意实验 ${date(Date.now())}] Kp=${r.gain} s⁻¹，命令延迟=${r.delay} ms，最大超调=${r.overshoot.toFixed(3)} m，8 秒最终误差=${r.error.toFixed(3)} m。该模型忽略动力学与噪声，不是真实机器人验证。`;});toast('已记入第 '+byId(labTargetId()).number+' 章的结果与证据，请补充解释。');});
  }
}
function render() {
  cancelAnimationFrame(wheelAnimation);wheelAnimation=0;wheelRunning=false;wheelResult=null;
  const route=location.hash.slice(1).split('?')[0]||'home',parts=route.split('/'),l=parts[0]==='lesson'?byId(parts[1]):null;
  const pages={home:['学习地图',home],resources:['资料与论文',resourcesPage],notebook:['学习档案',notebook],lab:['轮式仿真实验台',wheelLab],'delay-lab':['延迟响应实验',lab]};
  let title,html;
  if(l){title=`学习地图 / 第 ${l.number} 单元`;html=isPublished(l)?lessonPage(l):`<a class="back-link" href="#home">‹ 返回学习地图</a><div class="lesson-heading"><span class="eyebrow">候选主题 ${l.number} · ${esc(l.area)}</span><h1>${esc(l.title)}</h1><p class="subtitle">${esc(l.summary)}</p></div><div class="objectives"><h2>候选能力目标</h2><ul>${l.goals.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div><section class="reference-note"><h2>这一课由你的上一轮成果决定</h2><p>这是一项候选主题，还没有作为当前课程发布。先完成本轮实验并提交证据，我们再决定要不要进入这个主题、需要哪些先修补课，以及具体任务的难度。</p><p>测验全对或勾选自查不会自动发布下一课。课程发布会记录所依据的评审与教学判断。</p><a class="button" href="#lesson/${labTargetId()}">回到对应课程</a></section>`;}else if(pages[route]){title=pages[route][0];html=pages[route][1]();}else{title='页面未找到';html='<div class="empty-state"><h1>没有找到这个单元</h1><p>课程链接可能已改变，已有学习记录不会被删除。</p><a class="button" href="#home">返回学习地图</a></div>';}
  $('#main').innerHTML=html;$('#breadcrumb').textContent=title;document.title=`${l?l.title:title} · 具身学习手记`;
  document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(l?'home':route);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  bind(l&&isPublished(l)?l:null); bindExtras(l&&isPublished(l)?l:null); mountLessonQA(l&&isPublished(l)?l:null);window.scrollTo(0,0);
  if(!storageOK)$('#save-state').textContent='存储不可用，请导出备份';
}
function historySection(l){
  if(!l.history)return '';
  return `<section class="learning-section" id="history"><span class="eyebrow">WHY THESE METHODS EXIST</span><h2>从哪里来，为什么变成今天这样</h2><p>先看当时要解决的问题，再理解方法的价值与局限。旧方法与新方法可以在同一个系统中各司其职。</p><div class="history-timeline">${l.history.map(item=>{const source=sources.find(s=>s.id===item.source);return `<article><span>${esc(item.era)}</span><div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p>${source?`<a class="text-link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">来源：${esc(source.title)} ↗</a>`:''}</div></article>`;}).join('')}</div><h2>今天的进展，单独看</h2><p class="muted">以下是 ${revision} 核查官方资料得到的快照；日期可能是文档核查日，具体版本与成熟度见各条说明，不承诺此后持续为最新版，也不代表已复现其中的性能指标。</p><div class="release-grid">${l.developments.map(d=>`<article><div class="resource-meta">${esc(d.name)}<span>${esc(d.date)}</span></div><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(d.version)}</b> ↗</a><p>${esc(d.note)}</p></article>`).join('')}</div></section>`;
}
function submissionPanel(l){
  return `<section class="submission-box" id="submission"><h3>把这一课成果交给我</h3><p>网页会整理本课报告、你的理解、小测答案与自查。你在 GitHub 确认提交后，说一句“检查进度”，我就能自行读取。</p><button class="button" id="prepare-submission">准备提交本课成果</button><div id="submission-preview"></div><p class="privacy-line">目标：Alisahhh/learning-page 的公开 Issue。请检查内容，避免提交公司秘密、凭证或不适合公开的信息。打开提交页不代表已提交。</p></section>`;
}
let wheelResult;
function wheelLab(){
  return `<div class="page-heading"><div><p class="eyebrow">ROUND 01 · SIMULATION FIRST</p><h1>先让机器人动起来。</h1><p class="subtitle">先预测，再改参数。用三条轨迹理解差速底盘的运动。</p></div></div><div class="notice"><b>理想运动学仿真。</b> 这里没有摩擦、质量或接触求解。第一轮先学会解释运动，再用 MuJoCo 比较物理模型。</div><div class="lab-layout"><section class="lab-controls"><span class="section-kicker">小车参数</span><h2>两只轮子，一条轨迹</h2><p>轮半径 0.1 m · 轮距 0.5 m<br>从原点出发，朝向世界坐标 +x</p><label for="wheel-left">左轮速度 <output id="left-value">2 rad/s</output></label><input type="range" id="wheel-left" min="-6" max="6" step="0.1" value="2"><label for="wheel-right">右轮速度 <output id="right-value">2 rad/s</output></label><input type="range" id="wheel-right" min="-6" max="6" step="0.1" value="2"><label for="wheel-dt">积分步长</label><select id="wheel-dt"><option value="0.02">0.02 秒 · 较细</option><option value="0.1">0.1 秒</option><option value="0.5">0.5 秒 · 较粗</option></select><div class="preset-row"><button data-preset="2,2">直行</button><button data-preset="2,4">转弯</button><button data-preset="-2,2">原地旋转</button></div><div class="button-row"><button class="button" id="run-wheels">运行 6 秒仿真</button><button class="button secondary" id="restart-wheels" disabled>从头重跑</button></div><p id="wheel-status" role="status">选择参数后点击运行；连续点击不会打断当前仿真。</p><p class="muted">蓝线：欧拉积分轨迹<br>虚线：相同输入的解析轨迹<br>白色短线：小车前方</p><a class="text-link" href="#lesson/${labTargetId()}">阅读对应课程</a></section><section class="lab-results"><div class="section-heading"><h2>小车的世界坐标</h2><span id="wheel-time">t = 0.00 s</span></div><svg id="wheel-chart" viewBox="0 0 760 430" role="img" aria-labelledby="wheel-title wheel-desc"></svg><div class="lab-metrics" id="wheel-metrics" aria-live="polite"></div><p id="wheel-explanation"></p><p class="muted">结果保存到：${esc(byId(labTargetId()).title)}</p><button class="button secondary" id="save-wheel">将本次实验记入报告</button></section></div><section class="reference-note"><h2>本轮要解释的三个现象</h2><ol><li>为什么两轮同速时走直线，反向同速时原地旋转？</li><li>保持轮速不变，增大步长后与解析轨迹的误差为什么改变？</li><li>这个模型里没有质量和摩擦，你能用它验证小车打滑吗？</li></ol><p>积分公式：x[k+1]=x[k]+v·cosθ[k]·Δt；y[k+1]=y[k]+v·sinθ[k]·Δt；θ[k+1]=θ[k]+ω·Δt。速度命令被立即执行；不模拟执行器响应、接触、打滑与噪声。</p><div class="button-row"><a class="button" href="#lesson/${labTargetId()}">填写解释，提交成果</a><a class="text-link" href="#delay-lab">可选扩展：看看命令延迟</a></div></section>`;
}
function drawWheels(animate=true){
  cancelAnimationFrame(wheelAnimation);
  wheelResult=differentialDrive({left:Number($('#wheel-left').value),right:Number($('#wheel-right').value),dt:Number($('#wheel-dt').value)});
  wheelRunning=animate;
  $('#run-wheels').disabled=animate;$('#run-wheels').textContent=animate?'仿真运行中…':'运行 6 秒仿真';
  $('#restart-wheels').disabled=!animate;$('#save-wheel').disabled=true;$('#save-wheel').textContent='将本次实验记入报告';
  $('#wheel-status').textContent=animate?'正在运行，连续点击不会重置。需要重新开始时点击“从头重跑”。':'已就绪，点击运行开始。修改参数后需重新运行，再记录结果。';
  const r=wheelResult,cx=380,cy=215,scale=52,xy=p=>`${(cx+p.x*scale).toFixed(2)},${(cy-p.y*scale).toFixed(2)}`;
  const analytic=Array.from({length:181},(_,i)=>{const t=i/30;return Math.abs(r.omega)<1e-10?{x:r.v*t,y:0}:{x:r.v/r.omega*Math.sin(r.omega*t),y:r.v/r.omega*(1-Math.cos(r.omega*t))};});
  $('#wheel-chart').innerHTML=`<title id="wheel-title">差速小车运动学仿真</title><desc id="wheel-desc">左轮 ${r.left}、右轮 ${r.right} rad/s，线速度 ${r.v.toFixed(2)} m/s，角速度 ${r.omega.toFixed(2)} rad/s。最终位置 x=${r.final.x.toFixed(3)}, y=${r.final.y.toFixed(3)} 米。</desc><defs><pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse" x="${cx}" y="${cy}"><path d="M 52 0 L 0 0 0 52" fill="none" stroke="#e5eaf3" stroke-width="1"/></pattern></defs><rect width="760" height="430" fill="#f9fbff"/><rect width="760" height="430" fill="url(#grid)"/><line x1="20" y1="215" x2="740" y2="215" stroke="#c1cada"/><line x1="380" y1="20" x2="380" y2="410" stroke="#c1cada"/><text x="735" y="238" text-anchor="end">+x / m</text><text x="396" y="27">+y / m</text><text x="390" y="235">0</text><text x="432" y="235">1</text><text x="20" y="410">网格：1 m</text><polyline points="${analytic.map(xy).join(' ')}" stroke="#8996b0" stroke-width="2" stroke-dasharray="5 6" fill="none"/><polyline id="wheel-path" points="${xy(r.samples[0])}" stroke="#254ad6" stroke-width="3" fill="none"/><g id="wheel-robot"><rect x="-11" y="-11" width="22" height="22" rx="4" fill="#254ad6"/><rect x="-8" y="-16" width="16" height="5" rx="1" fill="#17243c"/><rect x="-8" y="11" width="16" height="5" rx="1" fill="#17243c"/><path d="M5 -7V7" stroke="white" stroke-width="3"/></g>`;
  $('#wheel-metrics').innerHTML=`<div><b>${r.v.toFixed(2)}<small> m/s</small></b><span>理想线速度</span></div><div><b>${r.omega.toFixed(2)}<small> rad/s</small></b><span>理想角速度</span></div><div><b>${r.error.toFixed(4)}<small> m</small></b><span>6 秒积分终点误差</span></div>`;
  $('#wheel-explanation').textContent=`计算的终点：x=${r.final.x.toFixed(3)} m，y=${r.final.y.toFixed(3)} m，累计航向=${(r.final.theta*180/Math.PI).toFixed(1)}°。${Math.abs(r.v)<1e-9?(Math.abs(r.omega)<1e-9?'两轮不动，位置与朝向保持不变。':'平均轮速为零，位置不变但朝向改变。'):Math.abs(r.omega)<1e-9?'两轮速度相同，保持朝向直行。':'轮速不同，形成弧线；步长影响离散轨迹的误差。'}`;
  const start=performance.now();
  const robot=$('#wheel-robot'),path=$('#wheel-path'),time=$('#wheel-time');
  const paint=now=>{
    if(!robot.isConnected)return;
    const t=animate?Math.min(r.duration,(now-start)/1000):0;
    const i=t>=r.duration?r.samples.length-1:Math.min(r.samples.length-1,Math.floor(t/r.dt)),p=r.samples[i];
    path.setAttribute('points',r.samples.slice(0,i+1).map(xy).join(' '));
    robot.setAttribute('transform',`translate(${xy(p)}) rotate(${-p.theta*180/Math.PI})`);time.textContent=`t = ${p.t.toFixed(2)} s`;
    if(animate&&t<r.duration)wheelAnimation=requestAnimationFrame(paint);
    else if(animate){wheelAnimation=0;wheelRunning=false;$('#run-wheels').disabled=false;$('#run-wheels').textContent='再运行一次（6 秒）';$('#restart-wheels').disabled=true;$('#save-wheel').disabled=false;$('#wheel-status').textContent='仿真完成。可以记录结果、再运行一次，或修改参数进行对照。';}
  };
  paint(start);
}
function bindExtras(l){
  document.querySelectorAll('[href="#lesson/sim-first"]').forEach(a=>a.href='#lesson/'+currentLessonId);
  if(l){
    $('#prepare-submission').addEventListener('click',()=>{
      const sub=makeSubmission(l,record(l.id),revision);
      $('#submission-preview').innerHTML=`<label class="field-label" for="submission-text">完整提交内容预览</label><textarea id="submission-text" readonly rows="10">${esc(sub.body)}</textarea>${sub.needsPaste?'<p>报告较长，为避免链接被截断，请先复制完整报告，再到 GitHub 正文粘贴。内容不会被缩短。</p>':'<p>报告将预填到 GitHub；登录后检查内容并点击创建 Issue。</p>'}<div class="button-row">${sub.needsPaste?'<button class="button secondary" id="copy-submission">复制完整报告</button>':''}<a class="button" id="open-submission" href="${esc(sub.url)}" target="_blank" rel="noopener noreferrer">${sub.needsPaste?'打开 GitHub 粘贴提交':'在 GitHub 确认提交'}</a></div>`;
      $('#copy-submission')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sub.body);toast('完整报告已复制，在 GitHub 正文粘贴后提交。');}catch{$('#submission-text').focus();$('#submission-text').select();toast('自动复制不可用，正文已选中，请使用复制快捷键。');}});
    });
  }
  $('#load-submissions')?.addEventListener('click',async()=>{
    const holder=$('#remote-submissions');holder.textContent='正在读取 GitHub…';
    try{const response=await fetch(`https://api.github.com/repos/${REPOSITORY}/issues?creator=Alisahhh&state=all&sort=updated&direction=desc&per_page=100`,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`GitHub 返回 ${response.status}`);const all=await response.json();const items=all.filter(i=>!i.pull_request&&i.title.startsWith(ISSUE_PREFIX)&&i.user.login==='Alisahhh');holder.innerHTML=items.length?items.map(i=>`<a href="https://github.com/${REPOSITORY}/issues/${Number(i.number)}" target="_blank" rel="noopener noreferrer">#${Number(i.number)} ${esc(i.title)} ↗<small>${esc(i.state==='closed'?'已关闭（不自动等于通过）':'已提交')} · ${esc(i.updated_at)}</small></a>`).join(''):'<p>当前返回的记录中没有学习成果 Issue。请在课程里准备提交，并在 GitHub 确认创建。</p>';if(all.length===100)holder.innerHTML+='<p>仅展示最近 100 条匹配作者的记录，完整历史请查看 GitHub。</p>';}catch(error){holder.textContent=`暂时无法读取：${error.message}。本地记录仍保留；可直接打开仓库 Issues。`;}
  });
  if($('#published-reviews'))fetch('./reviews.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{const el=$('#published-reviews');if(!el)return;el.innerHTML=data.reviews.length?`<h3>已记录的评审</h3>${data.reviews.map(r=>`<div class="review-item"><b>${esc(r.verdict)} · ${esc(r.lessonId)}</b><p>${esc(r.summary)}</p><p>下一步：${esc(r.nextStep)}</p>${/^https:\/\/github\.com\/Alisahhh\/learning-page\/issues\/\d+$/.test(r.issueUrl)?`<a class="text-link" href="${esc(r.issueUrl)}" target="_blank" rel="noopener noreferrer">对应成果 ↗</a>`:''}</div>`).join('')}`:'<p class="muted" style="margin-top:16px">还没有实际评审记录。提交成果后，说一句“检查进度”，我会读取并评审。</p>';}).catch(()=>{if($('#published-reviews'))$('#published-reviews').textContent='评审记录暂时无法加载。';});
  if($('#run-wheels')){
    for(const id of ['left','right'])$('#wheel-'+id).addEventListener('input',()=>{$('#'+id+'-value').textContent=$('#wheel-'+id).value+' rad/s';drawWheels(false);});
    document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{const [left,right]=b.dataset.preset.split(',');$('#wheel-left').value=left;$('#wheel-right').value=right;$('#left-value').textContent=left+' rad/s';$('#right-value').textContent=right+' rad/s';drawWheels(false);}));
    $('#wheel-dt').addEventListener('change',()=>drawWheels(false));
    $('#run-wheels').addEventListener('click',()=>{if(!wheelRunning)drawWheels();});
    $('#restart-wheels').addEventListener('click',()=>drawWheels());
    $('#save-wheel').addEventListener('click',()=>{if(wheelRunning||$('#save-wheel').disabled||!wheelResult)return;const r=wheelResult;update(labTargetId(),v=>{v.report.result+=(v.report.result?'\n\n':'')+`[网页运动学实验 ${date(Date.now())}] 左轮=${r.left} rad/s，右轮=${r.right} rad/s，dt=${r.dt} s，时长=${r.duration} s；v=${r.v.toFixed(3)} m/s，ω=${r.omega.toFixed(3)} rad/s；终点 x=${r.final.x.toFixed(4)} m，y=${r.final.y.toFixed(4)} m；累计 θ=${r.final.theta.toFixed(4)} rad；相对解析解的位置误差=${r.error.toFixed(6)} m。无摩擦/接触/执行器模型。预测与解释待本人填写。`;});$('#save-wheel').disabled=true;$('#save-wheel').textContent='本次结果已记入报告';toast('参数和结果已写入第 '+byId(labTargetId()).number+' 章报告，请补上预测、解释与局限。');});
    drawWheels(false);
  }
}
window.addEventListener('hashchange',()=>{render();$('#main').focus({preventScroll:true});});
render();
