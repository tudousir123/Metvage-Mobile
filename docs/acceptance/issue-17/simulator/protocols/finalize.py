"""Complete guest/moderation checks, then remove only this run's generated fixtures."""
import sys,json,re,base64,urllib.request,urllib.error,urllib.parse
from pathlib import Path
from importlib.machinery import SourceFileLoader
sys.path.insert(0,'scripts/acceptance')
from runtime import Report,read_json,write_json,execute,interruptible
from fixtures import FixtureRun,NoRedirect
from device import Device
from launch import verify_runtime
team=SourceFileLoader('cleanup_team','.acceptance/issue17-team.py').load_module()
c=read_json('.acceptance/config.json');pc=read_json('.acceptance/issue17-sim-peer/config.json');oc=read_json('.acceptance/issue17-sim-owner/config.json');state=read_json('.acceptance/issue17-context.json')
for config,folder in [(pc,'issue17-sim-peer'),(oc,'issue17-sim-owner')]:config['runtimeJournal']=str((Path('.acceptance')/folder/'runtime.json').resolve())
out=Path('.acceptance/issue17-sim-http/runs/issue17-finalize');r=Report(out,'simulator-finalize');o=FixtureRun(c,Path('.acceptance/runs/issue17-u1'),'issue17-u1',r);p=FixtureRun({**c,'profileUsername':'phoneu21103'},Path('.acceptance/runs/issue17-peer-token'),'issue17-peer-token',r)
def check(value,name):
 if not value:raise AssertionError(name)
 r.event('assertion',name=name,result='pass')
def app_token(config):
 raw=execute(['adb','-s',config['serial'],'exec-out','run-as',config['package'],'cat','files/mmkv/mmkv.default'],binary=True)
 tokens=list(dict.fromkeys(re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',raw)));check(len(tokens)==1,'One current access token in owned emulator App')
 token=tokens[0].decode();r.secrets.append(token);req=urllib.request.Request(c['apiOrigin']+'/api/v1/accounts/verify_credentials',headers={'Accept':'application/json','Authorization':'Bearer '+token});profile=json.load(urllib.request.urlopen(req,timeout=15));check(profile['username']==config['profileUsername'],'Actual emulator OAuth identity '+config['profileUsername'])
 payload=token.split('.')[1];claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)));return token,claims
def raw(path,token=None,status=404):
 headers={'Accept':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 try:
  with urllib.request.build_opener(NoRedirect).open(urllib.request.Request(c['apiOrigin']+path,headers=headers),timeout=15) as response:actual=response.status
 except urllib.error.HTTPError as error:actual=error.code
 check(actual==status,f'HTTP {status} '+path)
def ui(config,plan,run_id):
 folder=Path(config['runRoot'])/run_id;report=Report(folder,'simulator-final-ui');d=Device(config,report)
 try:
  with interruptible(),d.session(folder,1.45):
   report.event('runtime',**verify_runtime(config,d),environment='emulator');d.run_plan(plan,folder,run_id);verify_runtime(config,d)
  report.finish('pass')
 except BaseException as error:report.finish('fail',error=str(error));raise

def local(operation,**extra):
 source=Path('.acceptance/issue17-cleanup-local.php').read_text().removeprefix('<?php');return json.loads(execute(['docker','exec','-i',c['serverContainer'],'php','-r',source],data=json.dumps({**state,'operation':operation,'created_at':read_json('.acceptance/issue17-peer/registration-result.json')['created_at'],**extra}).encode()))
try:
 o.token,owner_claims=app_token(oc);p.token,peer_claims=app_token(pc);check(int(peer_claims['sub'])==state['peer_account'],'U2 subject matches actual invited account');check(int(owner_claims['sub'])==o.state['account_id'],'U1 subject matches protected owner')
 owner_protected=local('owner_sessions',owner_id=int(owner_claims['sub']),owner_jti=owner_claims['jti'],owner_client=owner_claims['aud'])['protected_ids'];original_photos={}
 for pet_id,expected in state['original_owner_records'].items():
  import hashlib
  values=o.request('GET',f'/pets/{pet_id}/records')['records']
  for record in values:
   for photo in record['photos']:
    path=urllib.parse.urlsplit(photo['url']).path;request=urllib.request.Request(c['apiOrigin']+path,headers={'Authorization':'Bearer '+o.token});original_photos[path]=hashlib.sha256(urllib.request.urlopen(request,timeout=15).read()).hexdigest()
  check(hashlib.sha256(json.dumps(values,sort_keys=True,ensure_ascii=False).encode()).hexdigest()==expected,'Original U1 records unchanged before cleanup: '+pet_id)
 expected={state['public_text'],state['public_photo'],state['public_mixed'],state['private_text'],state['private_photo'],state['private_mixed']}
 actual={x['id'] for pet_id in [state['peer_cat'],state['peer_dog']] for x in p.request('GET',f'/pets/{pet_id}/records')['records']};check(actual==expected,'Only six known U2 acceptance records are eligible for removal')
 # Keep actual App OAuth tokens in memory across local logout; never persist them.
 ui(pc,{'steps':[
  {'action':'open','path':f'/pets/{state["peer_cat"]}/records','expect':{'label':'把陪伴，写成故事'}},
  {'action':'swipe','fractions':[.5,.84,.5,.25]},
  {'action':'tap','label':'管理记录：issue17-text-public'},
  {'action':'tap','label':'改为私人记录'},
  {'action':'tap','label':'设为仅自己','expect':{'label':'仅自己'}},
  {'action':'capture','name':'owner-private-text-before-logout'},
  {'action':'open','path':'/settings','expect':{'label':'设置'}},
  {'action':'swipe','fractions':[.5,.85,.5,.2]},
  {'action':'tap','label':'退出登录','expect':{'label':'退出登录？'}},
  {'action':'tap','label':'退出登录','expect':{'label':'欢迎回来'}},
  {'action':'capture','name':'actual-logout'},
  {'action':'open','path':f'/note/{state["public_text"]}','expect':{'label':'此笔记暂时无法查看。'}},
  {'action':'capture','name':'guest-old-link-now-private-denied'},
  {'action':'open','path':f'/note/{state["private_photo"]}','expect':{'label':'此笔记暂时无法查看。'}},
  {'action':'capture','name':'guest-private-photo-note-denied'},
  {'action':'open','path':f'/note/{state["public_photo"]}','expect':{'label':'登录后点赞或评论'}},
  {'action':'assert','label':'笔记照片 1'},
  {'action':'capture','name':'guest-public-photo-visible'}]},'issue17-final-guest')
 for token in [o.token,None]:raw('/api/v1/metvage/records/'+str(state['public_text']),token)
 with team.technical_team(c,r) as token:
  rows=team.team_request(c,r,token,'GET','/admin/reports')['reports'];rows=[x for x in rows if x['id'] in state['report_ids'] and x['reporter_id']==state['peer_account']];check(len(rows)==3,'Governance targets match actual App reports');reports={x['target_type']:x for x in rows}
  team.team_request(c,r,token,'PATCH',f'/admin/reports/{reports["comment"]["id"]}',{'action':'delete','resolution':'issue17-final-delete-comment'})
  comments=o.request('GET',f'/records/{state["owner_record"]}/interactions')['comments'];check(not any(x['id']==state['comment_id'] for x in comments) and any(x['id']==state['dog_comment_id'] for x in comments),'Team deletes only reported cat comment and retains dog comment')
  team.team_request(c,r,token,'PATCH',f'/admin/reports/{reports["record"]["id"]}',{'action':'delete','resolution':'issue17-final-delete-record'})
 for token in [o.token,p.token,None]:raw('/api/v1/metvage/records/'+str(state['owner_record']),token)
 ui(pc,{'steps':[{'action':'open','path':f'/note/{state["owner_record"]}','expect':{'label':'此笔记暂时无法查看。'}},{'action':'capture','name':'guest-team-deleted-old-link-denied'}]},'issue17-team-delete-guest')
 photos=[]
 for record_id in sorted(expected):
  record=p.request('GET',f'/records/{record_id}')['record'];check(record['pet_id'] in [state['peer_cat'],state['peer_dog']],'Cleanup record is owned generated pet content');photos += [urllib.parse.urlsplit(x['url']).path for x in record['photos']]
  p.request('DELETE',f'/records/{record_id}',expected=(204,))
  for token in [o.token,p.token,None]:raw('/api/v1/metvage/records/'+str(record_id),token)
 for path in photos:
  for token in [o.token,p.token,None]:raw(path,token)
 p.admin('purge',pets=[{'id':state['peer_cat'],'marker':'issue17-cat-profile','seed_name':'17Cat'},{'id':state['peer_dog'],'marker':'','seed_name':'17Dog'}],original_current_pet_id=None)
 o.cleanup()
 owner=o.pets();check(owner['current_pet_id']==state['original_owner_current_pet'],'Original U1 selection restored');check({x['id'] for x in owner['pets']}=={int(x) for x in state['original_owner_records']},'Only original U1 pets remain')
 for pet_id,expected_hash in state['original_owner_records'].items():
  import hashlib
  values=o.request('GET',f'/pets/{pet_id}/records')['records'];check(hashlib.sha256(json.dumps(values,sort_keys=True,ensure_ascii=False).encode()).hexdigest()==expected_hash,'Original U1 record hash matches after cleanup: '+pet_id)
 for path,expected_hash in original_photos.items():
  request=urllib.request.Request(c['apiOrigin']+path,headers={'Authorization':'Bearer '+o.token});check(hashlib.sha256(urllib.request.urlopen(request,timeout=15).read()).hexdigest()==expected_hash,'Original U1 photo bytes match before/after cleanup')
 check(not p.pets()['pets'] and p.pets()['current_pet_id'] is None,'Invited U2 account retained empty with no selected pet');r.event('relations_cleanup',**local('relations'))
 r.event('u2_token_cleanup',**local('revoke'));r.event('owner_emulator_token_cleanup',**local('revoke_owner',owner_jti=owner_claims['jti'],owner_client=owner_claims['aud'],owner_id=int(owner_claims['sub']),protected_ids=owner_protected))
 write_json('.acceptance/issue17-simulator/finalized.json',{'status':'pass','original_owner_records_unchanged':True,'fixture_resources_removed':True,'invited_account_retained':True,'technical_role_disabled':True,'original_phone_owner_session_preserved':True})
 r.finish('pass')
except BaseException as error:r.finish('fail',error=str(error));raise
