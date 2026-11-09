import sys,json,urllib.request,urllib.error,urllib.parse,re,hashlib
from contextlib import contextmanager
from pathlib import Path
sys.path.insert(0,'scripts/acceptance')
sys.path.insert(0,'.acceptance')
from importlib.machinery import SourceFileLoader
team=SourceFileLoader('issue17_team','.acceptance/issue17-team.py').load_module()
from fixtures import FixtureRun,NoRedirect
from runtime import Report,write_json,execute
c=json.load(open('.acceptance/config.json'));directory=Path('.acceptance/runs/issue17-http-'+sys.argv[1]);r=Report(directory,'issue17-http-'+sys.argv[1]);op=sys.argv[1]
o=FixtureRun(c,Path('.acceptance/runs/issue17-u1'),'issue17-u1',r)
p=FixtureRun({**c,'profileUsername':'phoneu21103'},Path('.acceptance/runs/issue17-peer-token'),'issue17-peer-token',r)
context=Path('.acceptance/issue17-context.json');state=json.loads(context.read_text()) if context.exists() else {}
def check(value,name):
 if not value:raise AssertionError(name)
 r.event('assertion',name=name,result='pass')
def raw(path,token=None,expected=200):
 headers={'Accept':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 request=urllib.request.Request(c['apiOrigin']+path,headers=headers)
 try:
  with urllib.request.build_opener(NoRedirect).open(request,timeout=15) as response:status,data=response.status,response.read()
 except urllib.error.HTTPError as e:status,data=e.code,b''
 check(status==expected,f'HTTP {expected} '+path)
 return json.loads(data) if data and data[:1] in (b'{',b'[') else data
def record_path(id):return '/api/v1/metvage/records/'+str(id)

@contextmanager
def peer_app_authenticated():
 config=json.load(open('.acceptance/issue17-peer/config.json'))
 raw_storage=execute(['adb','-s',config['serial'],'exec-out','run-as',config['package'],'cat','files/mmkv/mmkv.default'],binary=True)
 tokens=re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',raw_storage)
 check(len(tokens)==1,'One access token in isolated U2 test App')
 p.token=tokens[0].decode();r.secrets.append(p.token)
 profile=raw('/api/v1/accounts/verify_credentials',p.token);check(profile['username']=='phoneu21103','Cross-account HTTP uses actual Android U2 OAuth session')
 p.state['account_id']=json.load(open('.acceptance/issue17-peer/registration-result.json'))['account_id']
 try:yield
 finally:p.token=None

try:
 with o.authenticated(),peer_app_authenticated():
  owner=o.pets();peer=p.pets();cat=next(x for x in o.state['pets'] if x['key']=='cat');dog=next(x for x in o.state['pets'] if x['key']=='dog');note=next(x for x in o.state['records'] if x['key']=='cat');rid=note['id']
  if op=='state':
   pc=next(x for x in peer['pets'] if x['nickname']=='17Cat');pd=next(x for x in peer['pets'] if x['nickname']=='17Dog')
   check(len(peer['pets'])==2,'U2 created exactly one cat and one dog through App')
   check(pc['species']=='cat' and pd['species']=='dog','Nickname-only profiles preserve species')
   state.update(owner_cat=cat['id'],owner_dog=dog['id'],owner_record=rid,peer_cat=pc['id'],peer_dog=pd['id'],peer_account=p.state['account_id'])
   variables={'peerCatId':pc['id'],'peerDogId':pd['id'],'ownerCatId':cat['id'],'ownerDogId':dog['id']}
   for path in [Path('.acceptance/config.json'),Path('.acceptance/issue17-peer/config.json')]:
    value=json.loads(path.read_text());value['variables'].update(variables);write_json(path,value)
  elif op=='identity':
   check(True,'Actual App OAuth session is still authenticated')
  elif op=='snapshot':
   state['original_owner_current_pet']=owner['current_pet_id'];state['original_owner_records']={}
   for pet in owner['pets']:
    if pet['id'] not in [cat['id'],dog['id']]:
     values=o.request('GET',f'/pets/{pet["id"]}/records')['records'];state['original_owner_records'][str(pet['id'])]=hashlib.sha256(json.dumps(values,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
   state['owner_photo_url']=o.request('GET',f'/records/{rid}')['record']['photos'][0]['url'];private_id=next(x['id'] for x in o.state['records'] if x['key']=='dog');state['owner_private_record']=private_id;state['owner_private_photo_url']=o.request('GET',f'/records/{private_id}')['record']['photos'][0]['url']
   check(True,'Original account resources and generated photo links snapshotted')
  elif op=='records':
   records=[item for pet in [state['peer_cat'],state['peer_dog']] for item in p.request('GET',f'/pets/{pet}/records')['records']]
   check(len(records)==6,'Six App saves produce six persisted records')
   for visibility in ['public','private']:
    values=[x for x in records if x['visibility']==visibility]
    check(len(values)==3,visibility+' has text-only, photo-only, and mixed records')
    for kind,test in [('text',lambda x:bool(x['text']) and not x['photos']),('photo',lambda x:not x['text'] and len(x['photos'])==1),('mixed',lambda x:bool(x['text']) and len(x['photos'])==1)]:
     matched=[x for x in values if test(x)];check(len(matched)==1,visibility+' '+kind+' persisted exactly once');item=matched[0];state[visibility+'_'+kind]=item['id']
     raw(record_path(item['id']),o.token,200 if visibility=='public' else 404);raw(record_path(item['id']),None,200 if visibility=='public' else 404)
     for photo in item['photos']:
      path=urllib.parse.urlsplit(photo['url']).path;data=raw(path,p.token,200);check(isinstance(data,bytes) and (data.startswith(b'\x89PNG') or data.startswith(b'\xff\xd8')),'Saved App photo is an actual image');r.event('saved_photo',record_id=item['id'],sha256=hashlib.sha256(data).hexdigest(),bytes=len(data));raw(path,o.token,200 if visibility=='public' else 404);raw(path,None,200 if visibility=='public' else 404)
   state['peer_records']=[x['id'] for x in records]
  elif op=='pixels':
   import io
   from PIL import Image
   source=Path('.acceptance')/next(x for x in c['fixtures'] if x['key']=='cat')['image'];original=Image.open(source).convert('RGBA');expected=hashlib.sha256(original.tobytes()).hexdigest()
   for key in ['public_photo','public_mixed','private_photo','private_mixed']:
    value=p.request('GET',f'/records/{state[key]}')['record'];data=raw(urllib.parse.urlsplit(value['photos'][0]['url']).path,p.token);image=Image.open(io.BytesIO(data)).convert('RGBA');check(image.size==original.size and hashlib.sha256(image.tobytes()).hexdigest()==expected,'Decoded App upload matches generated source pixels: '+key)
   r.event('image_identity',dimensions=list(original.size),rgba_sha256=expected)
  elif op=='social':
   value=o.request('GET',f'/records/{rid}/interactions');likes=[x for x in value['likes'] if x['actor_pet']['id']==state['peer_cat']];comments=[x for x in value['comments'] if x['text']=='issue17-peer-comment'];check(len(likes)==len(comments)==1,'App like and comment each persist once under U2 cat');check(comments[0]['actor_pet']['id']==state['peer_cat'],'Comment actor is selected pet');state['like_id']=likes[0]['id'];state['comment_id']=comments[0]['id']
   notifications=o.request('GET','/notifications')['notifications'];types={n['type'] for n in notifications if n['actor_pet']['id']==state['peer_cat']};check({'follow','like','comment'}<=types,'Owner receives follow, like and comment notifications with correct actor')
   follows=p.request('GET','/follows')['follows'];check(any(x['target_pet']['id']==cat['id'] for x in follows),'Follow persists after App operation')
  elif op in ['private','public']:
   value=o.request('GET',f'/records/{rid}')['record'];check(value['visibility']==op,'Owner App visibility mutation persisted')
   expected=404 if op=='private' else 200
   raw(record_path(rid),p.token,expected);raw(record_path(rid),None,expected)
   for token in [p.token,None]:
    result=raw('/api/v1/metvage/search?q=issue17-u1',token);check((rid in [x['id'] for x in result['records']])==(op=='public'),'Search follows current visibility')
    result=raw('/api/v1/metvage/records',token);check((rid in [x['id'] for x in result['records']])==(op=='public'),'Public feed follows current visibility')
   for photo in value['photos']:
    path=urllib.parse.urlsplit(photo['url']).path;raw(path,p.token,expected);raw(path,None,expected);raw(path,o.token,200)
   interactions=o.request('GET',f'/records/{rid}/interactions');check(any(x['id']==state['comment_id'] for x in interactions['comments']) and any(x['id']==state['like_id'] for x in interactions['likes']),'Historic interactions survive privacy round trip')
  elif op=='blocked':
   for pet in owner['pets']:
    raw('/api/v1/metvage/pets/'+str(pet['id']),p.token,404);p.request('POST',f'/pets/{pet["id"]}/follow',expected=(403,))
   o.request('POST',f'/pets/{state["peer_dog"]}/follow',expected=(403,));raw(record_path(rid),None,200);check(True,'Block covers both accounts and every pet; guest public read remains allowed')
  elif op=='unblocked':
   raw(record_path(rid),p.token,200);check(not p.request('GET','/blocks')['blocks'],'App unblock persisted without leaving a block')
  elif op=='species':
   rows=p.request('GET','/species-requests')['requests'];matched=[x for x in rows if x['species']=='rabbit-issue17' and x['note']=='issue17-species-request'];check(len(matched)==1,'App species request persists once');state['species_request_id']=matched[0]['id']
   check(not any(x['id']==matched[0]['id'] for x in o.request('GET','/species-requests')['requests']),'Other account cannot list applicant request');p.request('GET','/admin/species-requests',expected=(403,))
   with team.technical_team(c,r) as token:
    rows=team.team_request(c,r,token,'GET','/admin/species-requests')['requests'];check(any(x['id']==matched[0]['id'] and x['applicant_id']==p.state['account_id'] for x in rows),'Technical team can read actual App application')
   check(len(p.pets()['pets'])==2,'Species application does not create an unsupported pet')
  elif op=='reports':
   p.request('GET','/admin/reports',expected=(403,))
   with team.technical_team(c,r) as token:
    rows=team.team_request(c,r,token,'GET','/admin/reports')['reports'];rows=[x for x in rows if x['reason'] in ['issue17-report-record','issue17-report-comment','issue17-report-pet'] and x['reporter_id']==p.state['account_id']];check(len(rows)==3,'All three App reports are visible to authorized team');state['report_ids']=[x['id'] for x in rows]
    reports={x['target_type']:x for x in rows}
    for action,expected in [('hide',404),('restore',200)]:
     team.team_request(c,r,token,'PATCH',f'/admin/reports/{reports["record"]["id"]}',{'action':action,'resolution':'issue17-'+action});raw(record_path(rid),p.token,expected);raw(record_path(rid),None,expected)
    for action,visible in [('hide',False),('restore',True)]:
     team.team_request(c,r,token,'PATCH',f'/admin/reports/{reports["comment"]["id"]}',{'action':action,'resolution':'issue17-'+action});values=p.request('GET',f'/records/{rid}/interactions')['comments'];check(any(x['id']==state['comment_id'] for x in values)==visible,'Comment moderation '+action)
    state['team_suspension_pending']=True;write_json(context,state)
    try:
     team.team_request(c,r,token,'PATCH',f'/admin/reports/{reports["pet"]["id"]}',{'action':'suspend','resolution':'issue17-suspend'});o.request('POST',f'/pets/{state["peer_dog"]}/follow',expected=(403,));o.request('POST',f'/records/{state["public_photo"]}/likes',expected=(403,));check(True,'Technical suspension blocks new interactions')
    finally:
     team.team_request(c,r,token,'PATCH',f'/admin/reports/{reports["pet"]["id"]}',{'action':'unsuspend','resolution':'issue17-restored'});state['team_suspension_pending']=False;write_json(context,state)
   check(True,'Team actions persisted; technical account is not a designated human maintainer')
  elif op=='edited':
   value=o.request('GET',f'/records/{rid}')['record'];check(value['pet_id']==dog['id'] and value['text']=='issue17-owner-edited' and value['title']=='issue17-owner-title' and not value['photos'],'App edit changed title/text, removed photo and moved association');state['edited_pet']=dog['id'];interactions=o.request('GET',f'/records/{rid}/interactions');check(any(x['id']==state['comment_id'] for x in interactions['comments']) and any(x['id']==state['like_id'] for x in interactions['likes']),'Ordinary edit preserves historical interactions');raw(urllib.parse.urlsplit(state['owner_photo_url']).path,None,404)
  elif op=='deleted':
   for token in [o.token,p.token,None]:raw(record_path(state['owner_private_record']),token,404)
   raw(urllib.parse.urlsplit(state['owner_private_photo_url']).path,None,404)
  elif op=='dog-social':
   value=o.request('GET',f'/records/{rid}/interactions')
   check({state['peer_cat'],state['peer_dog']} <= {x['actor_pet']['id'] for x in value['likes']},'Likes retain both selected pet identities after switching')
   comments={x['text']:x for x in value['comments']}
   check(comments['issue17-peer-comment']['actor_pet']['id']==state['peer_cat'] and comments['issue17-dog-comment']['actor_pet']['id']==state['peer_dog'],'Comments retain cat and dog identities')
   check(comments['issue17-peer-comment']['id']==state['comment_id'],'Historic cat comment ID unchanged after switch')
  elif op=='cold':
   check(peer['current_pet_id']==state['peer_dog'],'Selected U2 dog persists after cold start')
   for pet in [state['peer_cat'],state['peer_dog']]:
    records=p.request('GET',f'/pets/{pet}/records')['records'];check(all(x['pet_id']==pet for x in records),'Timeline ownership survives pet switching and cold start')
  else:raise RuntimeError('Unknown HTTP verification phase')
  write_json(context,state)
 r.finish('pass')
except BaseException as error:
 r.finish('fail',error=str(error));raise
