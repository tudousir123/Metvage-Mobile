<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$user=App\Models\User::whereHas('profile',fn($q)=>$q->where('username',$input['username']))->sole();
if ((int)$user->id !== (int)$input['account_id'] || $input['username'] !== 'phoneu21103') throw new RuntimeException('Unexpected dedicated account');
if ($input['operation']==='protected') {
 $rows=[];
 foreach(App\Models\User::where('id','!=',$user->id)->orderBy('id')->get() as $other) {
  $rows[]=$other->getAttributes();
  foreach($other->pets()->orderBy('id')->get() as $pet) {
   $rows[]=$pet->getAttributes();
   foreach($pet->records()->orderBy('id')->get() as $record) {
    $rows[]=$record->getAttributes();
    foreach($record->photos()->orderBy('id')->get() as $photo) {
     $rows[]=$photo->getAttributes();$found=false;
     foreach(['local','public'] as $disk) {
      if(Illuminate\Support\Facades\Storage::disk($disk)->exists($photo->path)) {
       $found=true;$rows[]=['disk'=>$disk,'bytes_sha256'=>hash('sha256',Illuminate\Support\Facades\Storage::disk($disk)->get($photo->path))];
      }
     }
     if(!$found) throw new RuntimeException('Protected original photo unavailable');
    }
   }
  }
 }
 echo json_encode(['sha256'=>hash('sha256',json_encode($rows))]);
} elseif ($input['operation']==='revoke') {
 $client=is_array($input['aud']) ? $input['aud'][0] : $input['aud'];
 $token=Laravel\Passport\Token::whereKey($input['jti'])->where('user_id',$user->id)->where('client_id',$client)->sole();
 $others=Laravel\Passport\Token::where('id','!=',$token->id)->orderBy('id')->get(['id','revoked'])->toJson();
 Illuminate\Support\Facades\DB::table('oauth_refresh_tokens')->where('access_token_id',$token->id)->update(['revoked'=>true]);
 $token->revoked=true;$token->save();
 if($others!==Laravel\Passport\Token::where('id','!=',$token->id)->orderBy('id')->get(['id','revoked'])->toJson()) throw new RuntimeException('Other tokens changed');
 echo json_encode(['owned_app_token_revoked'=>true,'all_other_token_states_unchanged'=>true]);
} else throw new RuntimeException('Unknown local operation');
