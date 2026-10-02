import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicFiles=new Set(['index.html','style.css','app.js','bootstrap.js','state.js','content.js','simulation.js','submission.js','curriculum.json','sources.json','reviews.json','favicon.svg','PLAN.md','README.md']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try {const u=new URL(req.url,'http://localhost'),name=decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g,'')||'index.html';
    if(!publicFiles.has(name)&&!/^courses\/[a-z][a-z0-9-]*\.json$/.test(name)){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':types[path.extname(name)]||'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Learning page: http://127.0.0.1:4173'));
