export const STORAGE_KEY = 'alisahhh-learning-v1';
export const emptyState = () => ({version:1, lessons:{}});
export const emptyRecord = () => ({read:false,answers:[],attempts:[],note:'',report:{question:'',method:'',result:'',reflection:''},checks:[],updatedAt:0});
export function grade(lesson, answers) {
  return lesson.quiz.reduce((n, question, i) => n + Number(answers[i] === question.answer), 0);
}
export function quizPassed(lesson, record) {
  return record.attempts.some(a => grade(lesson, a.answers) === lesson.quiz.length);
}
export function evidenceReady(lesson, record) {
  return record.read && quizPassed(lesson,record) && lesson.experiment.rubric.every((_,i)=>record.checks[i]) && Object.values(record.report).every(v=>v.trim().length>=10);
}
const plain = v => v && typeof v === 'object' && !Array.isArray(v);
const validTime = v => Number.isFinite(v) && v >= 0 && v <= 8640000000000000;
export function validateState(input) {
  if (!plain(input) || input.version !== 1 || !plain(input.lessons)) throw Error('不是支持的学习档案格式（需要 version: 1 和 lessons）。');
  if (Object.keys(input.lessons).length > 1000) throw Error('档案中的课程数量异常。');
  const result = emptyState();
  for (const [id, raw] of Object.entries(input.lessons)) {
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(id) || ['constructor','prototype'].includes(id) || !plain(raw)) throw Error('档案中存在无效的课程记录。');
    if (typeof raw.read !== 'boolean' || !Array.isArray(raw.answers) || !Array.isArray(raw.attempts) || !Array.isArray(raw.checks) || !plain(raw.report) || typeof raw.note !== 'string' || !validTime(raw.updatedAt)) throw Error('课程记录不完整，原有记录未修改。');
    if (raw.note.length > 50000 || raw.attempts.length > 500 || raw.answers.length > 100 || raw.checks.length > 100) throw Error('单课记录超过支持的大小。');
    const validAnswers = a => Array.isArray(a) && a.length <= 100 && a.every(v=>v===null || (Number.isInteger(v)&&v>=0&&v<=20));
    if (!validAnswers(raw.answers) || !raw.checks.every(v=>typeof v==='boolean')) throw Error('答案或自查格式无效。');
    for (const a of raw.attempts) if (!plain(a)||!validTime(a.at)||!validAnswers(a.answers)) throw Error('测验历史格式无效。');
    for (const field of ['question','method','result','reflection']) if (typeof raw.report[field] !== 'string' || raw.report[field].length>20000) throw Error('实验报告格式无效。');
    result.lessons[id] = {read:raw.read,answers:[...raw.answers],attempts:raw.attempts.map(a=>({at:a.at,answers:[...a.answers]})),note:raw.note,report:{question:raw.report.question,method:raw.report.method,result:raw.report.result,reflection:raw.report.reflection},checks:[...raw.checks],updatedAt:raw.updatedAt};
  }
  return result;
}
export function mergeStates(current, incoming) {
  const merged = validateState(current);
  for (const [id,record] of Object.entries(validateState(incoming).lessons)) {
    if (!merged.lessons[id] || record.updatedAt > merged.lessons[id].updatedAt) merged.lessons[id] = record;
  }
  return merged;
}
