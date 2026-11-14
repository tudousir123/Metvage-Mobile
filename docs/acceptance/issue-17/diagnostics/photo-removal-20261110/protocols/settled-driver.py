"""Replay the actual App combined edit and assert persisted photo removal."""
import sys,json,re,hashlib,time,argparse
from pathlib import Path
sys.path.insert(0,'scripts/acceptance')
from runtime import Report,read_json,write_json,interruptible,AcceptanceError
from fixtures import FixtureRun
from device import Device
from launch import verify_runtime
p=Path('.acceptance/photo-debug');c=read_json(p/'config.json');assert re.fullmatch(r'emulator-\d+',c['serial']), 'Only an emulator is permitted';c['runtimeJournal']=str((p/'runtime.json').resolve())
a=argparse.ArgumentParser();a.add_argument('--iterations',type=int,default=3);a.add_argument('--mode',choices=['combined','minimal','strict','hit-grid','history','race','race-revision','negative-control'],default='combined');args=a.parse_args()
out=p/'runs'/('loop-'+args.mode);r=Report(out,'photo-edit-loop');d=Device(c,r);f=FixtureRun(c,p/'fixtures','photo-debug-20261110',r)
base_tree=d.tree
def stable_transition_tree():
 end=time.monotonic()+3
 while True:
  try:return base_tree()
  except AcceptanceError as e:
   if str(e)!='Test app has no stable visible content' or time.monotonic()>end:raise
   d.foreground();time.sleep(.05)
d.tree=stable_transition_tree
def check(ok,label,**extra):
 r.event('assertion',name=label,result='pass' if ok else 'fail',**extra)
 if not ok:raise AssertionError(label)
try:
 with interruptible(),d.session(out,1.45):
  r.event('runtime',**verify_runtime(c,d),environment='emulator');r.event('protocol',script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),mode=args.mode,iterations=args.iterations,api_proxy_port=c['reversePorts']['18080'])
  raw=d.call('exec-out','run-as',d.package,'cat','files/mmkv/mmkv.default',binary=True);tokens=list(dict.fromkeys(re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',raw)));check(len(tokens)==1,'One real App OAuth token');f.token=tokens[0].decode();r.secrets.append(f.token)
  cat,dog=f.state['pets'][:2];image=Path(c['fixtures'][0]['image']).read_bytes()
  for i in range(args.iterations):
   if args.mode=='hit-grid':
    original_tap=Device.tap.__get__(d,Device)
    def probe_tap(label,index=None,timeout=15):
     if label!='移除第 1 张照片':return original_tap(label,index,timeout)
     nodes,_=d.stable();targets=d.targets(nodes,label);assert len(targets)==1
     bounds=list(map(int,re.findall(r'\d+',targets[0].get('bounds',''))));fx,fy=[(.75,.25),(.25,.75),(.75,.75),(.1,.1),(.9,.1)][i%5];x=int(bounds[0]+(bounds[2]-bounds[0])*fx);y=int(bounds[1]+(bounds[3]-bounds[1])*fy)
     r.event('removal_touch',bounds=bounds,fraction=[fx,fy],point=[x,y]);d.foreground();d.call('shell','input','tap',str(x),str(y))
    d.tap=probe_tap

   key='r'+str(len(f.state['records']));request_id=f.run_id+'-'+hashlib.sha256((f.run_id+'\0'+key).encode()).hexdigest()[:24];entry={'key':key,'pet_id':cat['id'],'id':None,'request_id':request_id};f.state['records'].append(entry);f.save()
   rec=f.request('POST','/records',{'pet_id':cat['id'],'visibility':'public','title':'历史照片' if args.mode=='history' else '棉花的测试照片','text':'acceptance:issue17-u1:cat','client_request_id':request_id},image=image,expected=(200,201))['record'];entry['id']=rec['id'];f.save();check(len(rec['photos'])==1,'Seed has exactly one generated photo',record_id=rec['id'])
   full=read_json('scripts/acceptance/plans/issue17-owner-edit-delete.json')['steps'][:11];full[0]['path']=f'/records/{rec["id"]}/edit';full[2]['text']='issue17-owner-edited';full[5]['text']='issue17-owner-title';full[8]['label']=c['fixtures'][1]['nickname'];full[9].pop('expect',None)
   if args.mode=='negative-control':
    r.event('negative_control',intentional=True,omitted_action='photo removal',not_a_bug_reproduction=True);full=full[:9]+full[10:]
   if args.mode=='minimal':full=[full[0],full[9],full[10]]
   if args.mode=='hit-grid':full=[full[0],full[7],full[8],full[9],full[10]]
   if args.mode=='strict':full[9]['expect']={'label':'添加照片，已选 0 张，最多 9 张'}
   if args.mode=='history':
    history=[]
    for private in [True,False]:
     history += [{'action':'open','path':f'/pets/{cat["id"]}/records','expect':{'label':'管理记录：历史照片'}},{'action':'tap','label':'管理记录：历史照片'},{'action':'tap','label':'改为私人记录' if private else '公开这条记录'},{'action':'tap','label':'设为仅自己' if private else '确认公开','expect':{'label':'仅自己' if private else '公开'}}]
    d.run_plan({'steps':history},out,str(rec['id']))
   if args.mode in ['race','race-revision']:
    write_json(p/'latency.json',{'seconds':0})
    d.run_plan({'steps':[full[0],{'action':'open','path':f'/pets/{cat["id"]}/records','expect':{'label':'把陪伴，写成故事'}}]},out,str(rec['id']))
    if args.mode=='race-revision':
     f.request('PATCH',f'/records/{rec["id"]}/visibility',{'visibility':'private'});r.event('generated_fixture_revision',record_id=rec['id'],before_edit=True)
    delay=40 if args.mode=='race-revision' else [32,38,44][i%3];write_json(p/'latency.json',{'seconds':delay});r.event('response_latency',seconds=delay,captured_before_delay=True,generated_record_id=rec['id'])
   if args.mode in ['race','race-revision']:full[-1].pop('expect',None)
   d.run_plan({'steps':full},out,str(rec['id']))
   if args.mode in ['race','race-revision']:write_json(p/'latency.json',{'seconds':0})
   deadline=time.monotonic()+5
   while True:
    saved=f.request('GET',f'/records/{rec["id"]}')['record']
    fields_match=saved['text']=='issue17-owner-edited' and saved['title']=='issue17-owner-title'
    save_confirmed=(saved['pet_id']==dog['id']) and (fields_match or args.mode=='hit-grid') if args.mode!='minimal' else True
    r.event('save_readback',record_id=rec['id'],photo_count=len(saved['photos']),other_changes_confirmed=save_confirmed)
    if (save_confirmed and not saved['photos']) or time.monotonic()>=deadline:break
    time.sleep(.25)
   entry['pet_id']=saved['pet_id'];f.save()
   check(save_confirmed,'Save of other intended changes is confirmed; otherwise not the target symptom')
   check(len(saved['photos'])==0,'Saved record has zero photos',iteration=i+1,record_id=rec['id'],photo_count=len(saved['photos']),pet_id=saved['pet_id'],combined_fields_match=fields_match)
   if args.mode not in ['minimal','hit-grid']:check(saved['pet_id']==dog['id'],'Association changed to generated dog')
  verify_runtime(c,d)
 r.finish('pass',iterations=args.iterations,mode=args.mode)
except BaseException as e:r.finish('fail',error=str(e));raise
