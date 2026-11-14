import fs from 'node:fs';
const [operation,role,port]=process.argv.slice(2);
if(!['U1','U2'].includes(role)||!['19227','19228'].includes(port))throw new Error('Isolated simulator role/port required');
const list=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());
const targetFile=`.acceptance/issue17-simulator/browser-target-${role}.json`;
const stored=operation==='select-auth'?null:JSON.parse(fs.readFileSync(targetFile,'utf8')).id;
const candidates=list.filter(t=>{try{const u=new URL(t.url);return t.type==='page'&&u.origin==='http://localhost:18080'&&(stored?t.id===stored:['/login','/oauth/authorize'].includes(u.pathname));}catch{return false;}});
if(candidates.length!==1)throw new Error('Expected one owned localhost authentication tab');
const target=candidates[0];if(!stored)fs.writeFileSync(targetFile,JSON.stringify({id:target.id}),{mode:0o600});
const endpoint=new URL(target.webSocketDebuggerUrl);endpoint.hostname='127.0.0.1';endpoint.port=port;
const ws=new WebSocket(endpoint);await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no;});let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const[yes,no]=pending.get(m.id);pending.delete(m.id);m.error?no(new Error(m.error.message)):yes(m.result);}};
const call=(method,params={})=>new Promise((yes,no)=>{const n=++id;pending.set(n,[yes,no]);ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Local test page operation rejected');return r.result.value;};
try{
 if(!await evaluate("location.origin==='http://localhost:18080'"))throw new Error('Origin changed');
 if(operation==='select-auth')console.log('Owned local authentication page selected');
 else if(operation==='probe')console.log(JSON.stringify(await evaluate("({path:location.pathname,inputs:[...document.querySelectorAll('input')].filter(e=>e.offsetParent!==null).map(e=>({name:e.name,type:e.type})),buttons:[...document.querySelectorAll('button,input[type=submit]')].filter(e=>e.offsetParent!==null).map(e=>(e.innerText||e.value).trim())})")));
 else if(operation==='login'){
  const c=JSON.parse(fs.readFileSync('.acceptance/config.json','utf8'));
  const credentials=JSON.parse(fs.readFileSync(c.serverRoot+'/storage/app/phone-fixtures.json','utf8'))[role];
  const ok=await evaluate(`(()=>{const pw=[...document.querySelectorAll('input[type=password]')].find(e=>e.offsetParent!==null);const form=pw?.closest('form');if(!form)return false;const user=[...form.querySelectorAll('input')].find(e=>e.offsetParent!==null&&['email','username'].includes(e.name));if(!user)return false;const set=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};set(user,${JSON.stringify(credentials.email)});set(pw,${JSON.stringify(credentials.password)});const b=form.querySelector('button[type=submit],input[type=submit]');if(!b)return false;b.click();return true;})()`);
  if(!ok)throw new Error('Visible local sign-in form missing');console.log('Private test credentials submitted through browser form');
 }else if(operation==='authorize'){
  const ok=await evaluate("(()=>{const b=[...document.querySelectorAll('button,input[type=submit]')].find(e=>e.offsetParent!==null&&/Authorize|授权|Allow/i.test(e.innerText||e.value));if(!b)return false;b.click();return true;})()");if(!ok)throw new Error('Consent control missing');console.log('Local OAuth consent submitted');
 }else throw new Error('Unknown operation');
}finally{ws.close();}
