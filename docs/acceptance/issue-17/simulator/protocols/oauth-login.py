import sys,subprocess,time,json,re,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0,'scripts/acceptance')
from device import Device
from runtime import Report,read_json,write_json,interruptible
from launch import verify_runtime
config_path=Path(sys.argv[1]);role=sys.argv[2];port=int(sys.argv[3]);assert role in ['U1','U2'] and port in [19227,19228]
c=read_json(config_path);assert c['serial'] in ['emulator-5556','emulator-5558'];c['runtimeJournal']=str(config_path.resolve().parent/'runtime.json')
out=Path(c['runRoot'])/('issue17-sim-'+role.lower()+'-oauth');r=Report(out,'simulator-actual-oauth');d=Device(c,r)
def browser(op):
 return subprocess.run(['node','.acceptance/issue17-simulator/browser.mjs',op,role,str(port)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=15)
def chrome_setup():
 window=d.call('shell','dumpsys','window')
 if not re.search(r'mCurrentFocus=.*?\bu\d+\s+com\.android\.chrome/',window):return False
 path=f'/sdcard/issue17-browser-setup-{port}.xml'
 try:
  d.call('shell','uiautomator','dump',path);raw=d.call('shell','cat',path)
 finally:d.call('shell','rm','-f',path)
 root=ET.fromstring(raw);parents={child:parent for parent in root.iter() for child in parent}
 labels=['Use without an account','Accept & continue','No thanks','Not now','Got it','Continue without an account']
 for label in labels:
  for node in root.iter('node'):
   if node.get('package')!='com.android.chrome' or node.get('text')!=label:continue
   while node.get('clickable')!='true' and node in parents:node=parents[node]
   if node.get('clickable')!='true':continue
   b=list(map(int,re.findall(r'\d+',node.get('bounds',''))));assert len(b)==4
   assert 'com.android.chrome/' in d.call('shell','dumpsys','window')
   d.call('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));r.event('owned_emulator_browser_setup',control=label);return True
 return False
forwarded=False
try:
 with interruptible(),d.session(out,1.45):
  r.event('runtime',**verify_runtime(c,d),environment='emulator')
  assert not any(line.split()[1:2]==[f'tcp:{port}'] for line in d.call('forward','--list').splitlines()),'Host debug port already in use'
  d.call('forward',f'tcp:{port}','localabstract:chrome_devtools_remote');forwarded=True
  d.run_plan({'steps':[{'action':'open','path':'/handleLogin','expect':{'label':'欢迎回来'}},{'action':'tap','label':'登录'}]},out,'sim-oauth')
  end=time.monotonic()+75
  while browser('select-auth').returncode:
   if time.monotonic()>end:raise RuntimeError('Owned localhost browser authentication page not ready')
   chrome_setup();time.sleep(.2)
  page=browser('probe');assert page.returncode==0;view=json.loads(page.stdout);r.event('local_browser',**view)
  if any(x['type']=='password' for x in view['inputs']):
   result=browser('login');assert result.returncode==0,'Local login form submission failed'
   end=time.monotonic()+30
   while True:
    result=browser('probe')
    if result.returncode==0 and json.loads(result.stdout)['path']=='/oauth/authorize':break
    if time.monotonic()>end:raise RuntimeError('Local sign-in did not return to OAuth consent')
    time.sleep(.2)
  result=browser('authorize');assert result.returncode==0,'Actual OAuth consent failed'
  end=time.monotonic()+40
  while True:
   try:d.foreground();break
   except Exception:
    if time.monotonic()>end:raise
    chrome_setup();time.sleep(.2)
  d.wait_condition({'label':'搜索宠物笔记'},timeout=30)
  raw=d.call('exec-out','run-as',d.package,'cat','files/mmkv/mmkv.default',binary=True);tokens=re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',raw);assert len(tokens)==1,'Expected one current App access token'
  token=tokens[0].decode();r.secrets.append(token)
  request=urllib.request.Request(c['apiOrigin']+'/api/v1/accounts/verify_credentials',headers={'Accept':'application/json','Authorization':'Bearer '+token})
  profile=json.load(urllib.request.urlopen(request,timeout=15));assert profile['username']==c['profileUsername']
  r.event('oauth_identity',role=role,actual_app_token=True,environment='emulator');d.capture(out/'authenticated-home.png');verify_runtime(c,d)
  stored=read_json(config_path);stored['readyLabel']='搜索宠物笔记';write_json(config_path,stored)
 r.finish('pass')
except BaseException as error:r.finish('fail',error=str(error));raise
finally:
 if forwarded:d.call('forward','--remove',f'tcp:{port}')
