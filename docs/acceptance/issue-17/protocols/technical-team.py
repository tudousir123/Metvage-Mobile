from contextlib import contextmanager
from pathlib import Path
import json,urllib.request,urllib.error
from runtime import execute
from fixtures import NoRedirect
PHP=r'''
require '/var/www/html/vendor/autoload.php'; $app=require '/var/www/html/bootstrap/app.php'; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$in=json_decode(stream_get_contents(STDIN),true); $u=App\Models\User::where('username','acceptance17team')->first();
if($u && ($u->name!=='Metvage #17 technical maintainer' || !$u->is_admin)) throw new RuntimeException('Fixture ownership mismatch');
if(!$u && $in['operation']==='issue') $u=App\Models\User::factory()->create(['username'=>'acceptance17team','name'=>'Metvage #17 technical maintainer','is_admin'=>true]);
if($u) Laravel\Passport\Token::where('user_id',$u->id)->where('name','metvage-acceptance-issue17-team')->update(['revoked'=>true]);
if($in['operation']==='issue') { $t=$u->createToken('metvage-acceptance-issue17-team',['read','write']); echo json_encode(['token'=>$t->accessToken,'account_id'=>$u->id]); } else echo '{}';
'''
@contextmanager
def technical_team(config,report):
 def admin(op):return json.loads(execute(['docker','exec','-i',config['serverContainer'],'php','-r',PHP],data=json.dumps({'operation':op}).encode()))
 token=None
 try:
  result=admin('issue');token=result['token'];report.secrets.append(token);report.event('technical_team',account_id=result['account_id'],human_maintainer='not-designated');yield token
 finally:admin('revoke')
def team_request(config,report,token,method,path,body=None):
 request=urllib.request.Request(config['apiOrigin']+'/api/v1/metvage'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Authorization':'Bearer '+token,'Accept':'application/json','Content-Type':'application/json'},method=method)
 with urllib.request.build_opener(NoRedirect).open(request,timeout=15) as response:
  assert response.status==200;value=json.load(response)
 report.event('team_http',method=method,path=path,status=200)
 return value
