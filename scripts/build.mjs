import {copyFile,mkdir,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,'dist');
if(path.dirname(out)!==root || path.basename(out)!=='dist')throw Error('Unexpected build path');
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'courses'),{recursive:true});
for(const f of ['qa.js','qa-context.js','qa-config.json','index.html','style.css','bootstrap.js','app.js','state.js','content.js','simulation.js','submission.js','curriculum.json','sources.json','reviews.json','favicon.svg','.nojekyll'])await copyFile(path.join(root,f),path.join(out,f));
const curriculum=JSON.parse(await readFile(path.join(root,'curriculum.json'),'utf8'));
for(const l of curriculum.lessons.filter(l=>l.published)){if(!/^[a-z][a-z0-9-]*$/.test(l.id))throw Error('Invalid lesson ID');await copyFile(path.join(root,'courses',l.id+'.json'),path.join(out,'courses',l.id+'.json'));}
console.log('Built dist/ with public site files and published lessons only. Drafts and private local records are excluded.');
