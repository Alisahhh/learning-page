import('./app.js').catch(error=>{
  const main=document.getElementById('main');
  const title=document.createElement('h1');title.textContent='课程暂时没有加载成功';
  const p=document.createElement('p');p.textContent='请刷新页面，或使用本地 HTTP 服务打开网站。直接双击 HTML 文件可能无法读取课程。已有浏览器学习记录不会因此被清除。';
  main.replaceChildren(title,p);console.error(error);
});
