import {promptPackage} from './qa-context.js';
const sessions=new Map();
let configPromise,activeAbort;
const config=()=>configPromise??=fetch('./qa-config.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>({endpoint:''}));
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountLessonQA(lesson){
  activeAbort?.abort();document.querySelector('#lesson-qa')?.remove();
  if(!lesson)return;
  const launch=document.createElement('button');launch.className='button secondary qa-launch';launch.textContent='看不懂？问一问';
  document.querySelector('.lesson-heading').append(launch);
  const dialog=document.createElement('dialog');dialog.id='lesson-qa';dialog.className='qa-dialog';
  dialog.innerHTML=`<div class="qa-heading"><div><span class="eyebrow">随时提问</span><h2>把这一处讲明白</h2></div><button type="button" class="button secondary" id="qa-close" aria-label="关闭问答">关闭</button></div><p>${e(lesson.title)}</p><p id="qa-availability" class="notice" role="status">正在读取问答设置…</p><label class="field-label" for="qa-quote">正在问的段落（可缩短）</label><textarea id="qa-quote" maxlength="3000" rows="3"></textarea><div class="qa-presets"><button type="button" data-question="请用白话解释这段，先别引入新术语。">说人话</button><button type="button" data-question="请用我熟悉的 ROS、驱动或通信举一个具体例子。">用 ROS 举例</button><button type="button" data-question="请把公式逐步拆开，说明每个变量、单位，并带入小数字算一次。">拆开公式</button><button type="button" data-question="请先给我一个提示，然后问一个小问题检查我是否理解，不要直接给完整作业答案。">给提示，考考我</button></div><label class="field-label" for="qa-question">哪里没懂？也可以继续追问</label><textarea id="qa-question" rows="3" maxlength="2000" placeholder="例如：为什么右轮转得更快，小车却向左拐？"></textarea><div id="qa-auth" hidden><label class="field-label" for="qa-access">个人问答访问码（不是 API key）</label><input id="qa-access" type="password" maxlength="200" autocomplete="off"><small>只用于你的问答服务，本页面不保存访问码。</small></div><p class="muted">发送时仅提交本课公开内容、引用段落及本次对话。不自动读取笔记或实验报告。回答用于答疑，不作为学习成果评审。</p><div class="button-row"><button class="button" id="qa-send" type="button" disabled>发送问题</button><button class="button secondary" id="qa-copy" type="button">复制问题与课文上下文</button><a class="text-link" href="https://chat.deepseek.com/" target="_blank" rel="noopener noreferrer">打开 DeepSeek ↗</a></div><p id="qa-status" role="status"></p><details><summary>查看将提交的内容</summary><textarea id="qa-package" readonly rows="8" aria-label="完整提问包"></textarea></details><div id="qa-conversation" class="qa-conversation" aria-live="polite"></div><button type="button" class="text-button" id="qa-clear">清空本章临时对话</button><p class="muted">对话只保留在当前页面内存中，刷新后消失；需要保留时复制到课程笔记。</p>`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s),history=sessions.get(lesson.id)??[];sessions.set(lesson.id,history);
  let busy=false,settings={endpoint:''};
  function draw(){const holder=$('#qa-conversation');holder.replaceChildren();for(const item of history){const article=document.createElement('article'),title=document.createElement('b'),body=document.createElement('p');title.textContent=item.role==='user'?'我的问题':'助教回答';body.textContent=item.content;article.append(title,body);holder.append(article);}preview();}
  function preview(){ $('#qa-package').value=promptPackage(lesson,$('#qa-quote').value,$('#qa-question').value,history.slice(-4)); }
  function open(quote=''){if(busy)return;$('#qa-quote').value=quote.slice(0,3000);preview();if(!dialog.open)dialog.showModal();$('#qa-question').focus();}
  launch.addEventListener('click',()=>open());
  document.querySelectorAll('[data-ask-section]').forEach(button=>button.addEventListener('click',()=>{const s=lesson.sections[Number(button.dataset.askSection)];open(s.title+'\n'+s.text);}));
  $('#qa-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{$('#qa-access').value='';activeAbort?.abort();});
  $('#qa-question').addEventListener('input',preview);$('#qa-quote').addEventListener('input',preview);
  dialog.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>{$('#qa-question').value=b.dataset.question;preview();}));
  $('#qa-clear').addEventListener('click',()=>{if(busy)return;history.length=0;draw();$('#qa-status').textContent='已清空临时对话。';});
  $('#qa-copy').addEventListener('click',async()=>{preview();try{await navigator.clipboard.writeText($('#qa-package').value);$('#qa-status').textContent='已复制。打开 DeepSeek 后粘贴即可，也可以粘贴到当前对话。';}catch{$('details').open=true;$('#qa-package').focus();$('#qa-package').select();$('#qa-status').textContent='请用复制快捷键复制已选中的完整内容。';}});
  $('#qa-send').addEventListener('click',async()=>{
    if(busy||!settings.endpoint)return;
    const question=$('#qa-question').value.trim();if(!question){$('#qa-status').textContent='请先输入问题，或选择一种提问方式。';return;}
    const access=$('#qa-access').value.trim();if(settings.requiresAccessCode&&!access){$('#qa-status').textContent='请填写个人问答访问码；这里不接受 DeepSeek API key。';return;}
    if(access.startsWith('sk-')){$('#qa-access').value='';$('#qa-status').textContent='这是 API key 的格式，请将它放在后端密钥设置，不要填到网页。';return;}
    busy=true;$('#qa-send').disabled=true;$('#qa-status').textContent='正在解释，请稍候…';const controller=new AbortController();activeAbort=controller;const timer=setTimeout(()=>controller.abort(),60000);
    try{const r=await fetch(settings.endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(access?{Authorization:'Bearer '+access}:{})},body:JSON.stringify({lessonId:lesson.id,question,quote:$('#qa-quote').value,history:history.slice(-4)}),signal:controller.signal,credentials:'omit'});const data=await r.json();if(!r.ok)throw Error(data.error||'问答暂时不可用');if(typeof data.answer!=='string'||!data.answer.trim())throw Error('没有收到有效回答，请重试。');history.push({role:'user',content:question},{role:'assistant',content:data.answer.slice(0,10000)});if(history.length>12)history.splice(0,history.length-12);draw();$('#qa-question').value='';preview();$('#qa-status').textContent=data.truncated?'回答达到长度上限，可继续追问。':'可以继续追问；回答不等于已验证结论。';}
    catch(error){$('#qa-status').textContent=error.name==='AbortError'?'请求已取消或超时；问题仍保留，可重试或复制到 AI 网页。':error.message;}
    finally{clearTimeout(timer);busy=false;$('#qa-send').disabled=!settings.endpoint;}
  });
  config().then(c=>{if(!dialog.isConnected)return;settings=c;let valid=false;try{valid=new URL(c.endpoint).protocol==='https:';}catch{}settings.endpoint=valid?c.endpoint:'';$('#qa-send').disabled=!valid;$('#qa-auth').hidden=!valid||!c.requiresAccessCode;$('#qa-availability').textContent=valid?'课内问答已配置。填写问题后点击发送。':'站内 AI 回答尚未连接。现在可复制带课文的提问包，到 DeepSeek 或当前对话中提问，无需 API key。';});draw();
}
