export const REPOSITORY='Alisahhh/learning-page';
export const ISSUE_PREFIX='[学习成果]';
export function makeSubmission(lesson, record, revision) {
  const body=[`<!-- learning-submission:v1 lesson=${lesson.id} curriculum=${revision} -->`,`# 第 ${lesson.number} 单元：${lesson.title}`,'','## 问题与假设',record.report.question||'尚未填写','','## 环境与方法',record.report.method||'尚未填写','','## 结果与证据',record.report.result||'尚未填写','','## 解释、局限与下一步',record.report.reflection||'尚未填写','','## 我的理解与疑问',record.note||'尚未填写','','## 小测答案（选项从 1 开始）',...lesson.quiz.map((q,i)=>`${i+1}. ${q.prompt}\n   我的当前选择：${Number.isInteger(record.answers[i])?record.answers[i]+1:'未作答'}`),'','## 验收自查（不代表评审通过）',...lesson.experiment.rubric.map((item,i)=>`- [${record.checks[i]?'x':' '}] ${item}`),'','请读取本 Issue 和引用的代码/日志，给出：通过、需补证据或需修正，并说明下一轮学习安排。'].join('\n');
  const title=`${ISSUE_PREFIX} ${lesson.number} ${lesson.title}`;
  const base=`https://github.com/${REPOSITORY}/issues/new`;
  const full=`${base}?${new URLSearchParams({title,body})}`;
  return {title,body,url:full.length<=7500?full:`${base}?${new URLSearchParams({title})}`,needsPaste:full.length>7500};
}
