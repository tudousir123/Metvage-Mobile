import fs from 'node:fs';
const list = await fetch('http://127.0.0.1:9227/json').then(r=>r.json());
const allowed = t => { try {const u=new URL(t.url);return t.type==='page' && u.origin==='http://localhost:18080';} catch {return false;} };
const targetFile='.acceptance/issue17-peer/browser-target.json';
const stored=process.argv[2]==='select-auth'?null:(fs.existsSync(targetFile)?JSON.parse(fs.readFileSync(targetFile,'utf8')).id:null);
const invitation=JSON.parse(fs.readFileSync('<serverRoot>/storage/app/phone-fixtures.json','utf8')).U2.invite;
const targets=list.filter(t=>allowed(t)&&(stored?t.id===stored:(process.argv[2]==='select-auth'?new URL(t.url).pathname==='/oauth/authorize':t.url===('http://localhost:18080/auth/invite/a/'+invitation))));
if(targets.length!==1) throw new Error('Expected the isolated localhost test tab');
if(!stored)fs.writeFileSync(targetFile,JSON.stringify({id:targets[0].id}),{mode:0o600});
const endpoint=new URL(targets[0].webSocketDebuggerUrl);endpoint.hostname='127.0.0.1';endpoint.port='9227';
const ws=new WebSocket(endpoint);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no;});
let id=0; const pending=new Map();ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const [yes,no]=pending.get(m.id);pending.delete(m.id);m.error?no(new Error(m.error.message)):yes(m.result);}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id;pending.set(n,[yes,no]);ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Test page operation rejected');return r.result.value;};
try {
 if(!await evaluate("location.origin==='http://localhost:18080'"))throw new Error('Test origin changed');
 const operation=process.argv[2];
 if(operation==='select-auth') console.log('Selected local OAuth test tab');
 else if(operation==='authorize') {const ok=await evaluate(`(()=>{const e=[...document.querySelectorAll('button,input[type=submit]')].find(e=>e.offsetParent!==null&&/Authorize|授权|Allow/i.test(e.innerText||e.value));if(!e)return false;e.click();return true;})()`);if(!ok)throw new Error('Authorization control missing');console.log('OAuth consent submitted on Android');}
 else if(operation==='reload') {await call('Page.reload',{ignoreCache:true});console.log('Reloaded isolated test page');}
 else if(operation==='probe') console.log(JSON.stringify(await evaluate(`({path:location.pathname.replace(/(\\/auth\\/invite\\/a\\/).*/,'$1<private>'),title:document.title,labels:[...document.querySelectorAll('label')].filter(e=>e.offsetParent!==null).map(e=>e.innerText.trim()),inputs:[...document.querySelectorAll('input')].filter(e=>e.offsetParent!==null).map(e=>({type:e.type,id:e.id,name:e.name})),buttons:[...document.querySelectorAll('button,input[type=submit]')].filter(e=>e.offsetParent!==null).map(e=>({text:(e.innerText||e.value).trim(),disabled:e.disabled}))})`)));
 else if(operation==='fill') {
  const field=process.argv[3], credentials=JSON.parse(fs.readFileSync('<serverRoot>/storage/app/phone-fixtures.json','utf8')).U2;
  const value=field==='display_name'?'Metvage U2':credentials[field==='password_confirm'?'password':field];
  if(!value)throw new Error('Unknown private test field');
  const ok=await evaluate(`(()=>{const e=[...document.querySelectorAll('input')].find(e=>e.offsetParent!==null&&e.type!=='hidden'&&e.type!=='checkbox');if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  if(!ok)throw new Error('Visible test field missing'); console.log('Private test field entered');
 }
 else if(operation==='continue') {
  const ok=await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.offsetParent!==null&&e.innerText.trim()==='Continue'&&!e.disabled);if(!b)return false;b.click();return true;})()`);
  if(!ok)throw new Error('Enabled Continue missing'); console.log('Test registration step submitted');
 }
 else throw new Error('Unknown test operation');
} finally { ws.close(); }
