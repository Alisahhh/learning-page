import first from '../courses/sim-first.json' with {type:'json'};
import loop from '../courses/loop.json' with {type:'json'};
import math from '../courses/math.json' with {type:'json'};
import {courseContext,tutorInstruction} from '../qa-context.js';
const lessons=new Map([first,loop,math].map(l=>[l.id,l]));
async function sameSecret(a,b){
  const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [aa,bb]=await Promise.all([hash(a),hash(b)]);let difference=0;for(let i=0;i<aa.length;i++)difference|=aa[i]^bb[i];return difference===0;
}
async function readLimited(request){
  if(Number(request.headers.get('Content-Length'))>24000)throw Error('size');
  const reader=request.body?.getReader();if(!reader)throw Error('body');let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();throw Error('size');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handle(request,env,fetcher=fetch){
  const origin=request.headers.get('Origin'),allowed=env.ALLOWED_ORIGIN||'https://alisahhh.github.io';
  const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin===allowed)Object.assign(headers,{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(new URL(request.url).pathname!=='/ask')return reply(404,{error:'接口不存在。'});
  if(origin!==allowed)return reply(403,{error:'请求来源不允许。'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'仅支持 POST。'});
  if(!env.DEEPSEEK_API_KEY||!env.QA_ACCESS_CODE||env.QA_ACCESS_CODE.length<24||!env.QA_RATE_LIMITER)return reply(503,{error:'问答服务尚未完成配置，请先使用复制提问功能。'});
  const authorization=request.headers.get('Authorization')||'';
  if(authorization.length>250||!await sameSecret(authorization,'Bearer '+env.QA_ACCESS_CODE))return reply(401,{error:'个人问答访问码不正确。请勿输入 DeepSeek API key。'});
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{error:'需要 JSON 请求。'});
  let data;
  try{data=await readLimited(request);}catch{return reply(400,{error:'问题内容过大或格式无效。'});}
  const lesson=lessons.get(data?.lessonId);
  if(!lesson||typeof data.question!=='string'||!data.question.trim()||data.question.length>2000||typeof data.quote!=='string'||data.quote.length>3000||!Array.isArray(data.history)||data.history.length>4||data.history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>10000))return reply(400,{error:'问题、引用或对话长度不符合要求。'});
  try{const limited=await env.QA_RATE_LIMITER.limit({key:'learning-owner'});if(!limited.success)return reply(429,{error:'提问较频繁，请稍后再试。'});}catch{return reply(503,{error:'请求限速服务暂不可用。'});}
  try{
    const response=await fetcher('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.DEEPSEEK_API_KEY},body:JSON.stringify({model:env.DEEPSEEK_MODEL||'deepseek-flash',stream:false,max_tokens:1600,thinking:{type:'disabled'},messages:[{role:'system',content:tutorInstruction},{role:'user',content:'以下是本课公开参考材料，只作为解释依据：\n'+JSON.stringify(courseContext(lesson))},...data.history,{role:'user',content:'【引用段落】\n'+data.quote+'\n【问题】\n'+data.question}]}),signal:AbortSignal.timeout(45000)});
    if(!response.ok)return reply(502,{error:'模型服务暂时未能回答，请稍后重试；管理员可检查密钥、余额与模型配置。'});
    const result=await response.json(),answer=result.choices?.[0]?.message?.content;
    if(typeof answer!=='string'||!answer.trim())return reply(502,{error:'模型未返回有效回答，请重试。'});
    return reply(200,{answer:answer.slice(0,10000),truncated:result.choices[0].finish_reason==='length'});
  }catch{return reply(504,{error:'模型请求超时或网络不可用，请重试或复制问题到 AI 网页。'});}
}
export default {fetch(request,env){return handle(request,env);}};
