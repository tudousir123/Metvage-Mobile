import sys,json,time,subprocess,re,urllib.request
from pathlib import Path
sys.path.insert(0,'scripts/acceptance')
from device import Device
from runtime import Report,interruptible
from launch import verify_runtime
c=json.load(open('.acceptance/issue17-peer/config.json'));c['runtimeJournal']=str(Path('.acceptance/issue17-peer/runtime.json').resolve())
root=Path('.acceptance/issue17-peer/runs/issue17-u2-login');r=Report(root,'android-oauth-login');d=Device(c,r)
try:
 with interruptible(),d.session(root):
  r.event('runtime',**verify_runtime(c,d))
  d.run_plan({'steps':[{'action':'open','path':'/handleLogin','expect':{'label':'欢迎回来'}},{'action':'tap','label':'登录'}]},root,'issue17-u2-login')
  deadline=time.monotonic()+35
  while True:
   selected=subprocess.run(['node','.acceptance/issue17-peer/web.mjs','select-auth'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
   if selected.returncode==0:break
   if time.monotonic()>deadline:raise RuntimeError('Local OAuth page not ready')
   time.sleep(.2)
  page=json.loads(subprocess.check_output(['node','.acceptance/issue17-peer/web.mjs','probe'],text=True));print('OAuth test page:',json.dumps(page),flush=True)
  subprocess.run(['node','.acceptance/issue17-peer/web.mjs','authorize'],check=True,stdout=subprocess.DEVNULL)
  deadline=time.monotonic()+30
  while True:
   try:d.foreground();break
   except Exception:
    if time.monotonic()>deadline:raise
    time.sleep(.2)
  d.wait_condition({'label':'搜索宠物笔记'})
  raw=d.call('exec-out','run-as',d.package,'cat','files/mmkv/mmkv.default',binary=True)
  candidates=re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',raw)
  assert len(candidates)==1,'Expected one App access token'
  token=candidates[0].decode();r.secrets.append(token)
  req=urllib.request.Request(c['apiOrigin']+'/api/v1/accounts/verify_credentials',headers={'Accept':'application/json','Authorization':'Bearer '+token})
  profile=json.load(urllib.request.urlopen(req,timeout=15));assert profile['username']=='phoneu21103'
  r.event('oauth_identity',role='U2',verified_via_actual_app_token=True)
  d.capture(root/'u2-home-after-oauth.png')
  verify_runtime(c,d)
 r.finish('pass')
except BaseException as error:
 r.finish('fail',error=type(error).__name__+': '+str(error));raise
