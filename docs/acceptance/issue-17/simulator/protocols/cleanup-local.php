<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$in=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$u=App\Models\User::findOrFail($in['peer_account']);
if($u->username!=='phoneu21103' || $u->created_at->timestamp!==Carbon\Carbon::parse($in['created_at'])->timestamp) throw new RuntimeException('New account ownership mismatch');
if(in_array($in['operation'],['owner_sessions','revoke_owner'])) {
 $owner=App\Models\User::findOrFail($in['owner_id']);
 if($owner->username!=='phoneu11103') throw new RuntimeException('Owner mismatch');
 $token=Laravel\Passport\Token::where('user_id',$owner->id)->whereKey($in['owner_jti'])->firstOrFail();
 $client=is_array($in['owner_client']) ? $in['owner_client'][0] : $in['owner_client'];
 if((string)$token->client_id!==(string)$client) throw new RuntimeException('Exact emulator token client mismatch');
 $others=Laravel\Passport\Token::where('user_id',$owner->id)->where('revoked',false)->where('id','!=',$token->id)->pluck('id')->sort()->values()->all();
 if($in['operation']==='owner_sessions') echo json_encode(['protected_ids'=>$others]);
 else {
  if($others!==$in['protected_ids']) throw new RuntimeException('Other owner sessions changed unexpectedly');
  Illuminate\Support\Facades\DB::table('oauth_refresh_tokens')->where('access_token_id',$token->id)->update(['revoked'=>true]);
  $token->revoked=true;$token->save();
  $after=Laravel\Passport\Token::where('user_id',$owner->id)->where('revoked',false)->pluck('id')->sort()->values()->all();
  if($after!==$others) throw new RuntimeException('Original owner sessions were changed');
  echo json_encode(['only_emulator_session_revoked'=>true,'other_owner_sessions_preserved'=>count($after)]);
 }
} elseif($in['operation']==='revoke') {
 $ids=Laravel\Passport\Token::where('user_id',$u->id)->pluck('id');
 Illuminate\Support\Facades\DB::table('oauth_refresh_tokens')->whereIn('access_token_id',$ids)->update(['revoked'=>true]);
 Laravel\Passport\Token::where('user_id',$u->id)->update(['revoked'=>true]);
 echo json_encode(['active_tokens'=>Laravel\Passport\Token::where('user_id',$u->id)->where('revoked',false)->count()]);
} elseif($in['operation']==='relations') {
 $result=Illuminate\Support\Facades\DB::transaction(function() use($in,$u) {
  if($u->petRecords()->exists() || $u->pets()->exists()) throw new RuntimeException('Delete only verified fixture contents first');
  foreach(App\Models\PetReport::whereIn('id',$in['report_ids'])->get() as $row) {
   if($row->reporter_id!==$u->id || !in_array([$row->target_type,(int)$row->target_id],[['record',$in['owner_record']],['comment',$in['comment_id']],['pet',$in['owner_cat']]]) || !in_array($row->reason,['issue17-report-record','issue17-report-comment','issue17-report-pet'])) throw new RuntimeException('Report mismatch');
   $row->delete();
  }
  $row=App\Models\SpeciesRequest::find($in['species_request_id']);
  if($row) {
   if($row->applicant_id!==$u->id || $row->species!=='rabbit-issue17' || $row->note!=='issue17-species-request') throw new RuntimeException('Species mismatch');
   $row->delete();
  }
  $petIds=[$in['owner_cat'],$in['owner_dog'],$in['peer_cat'],$in['peer_dog']];
  $notifications=App\Models\PetNotification::whereIn('actor_pet_id',$petIds)->orWhereIn('target_pet_id',$petIds)->orWhereIn('target_record_id',array_merge([$in['owner_record'],$in['owner_private_record']],$in['peer_records']))->delete();
  $team=App\Models\User::where('username','acceptance17team')->first();
  if($team) {
   if($team->name!=='Metvage #17 technical maintainer' || $team->pets()->exists() || $team->petRecords()->exists()) throw new RuntimeException('Technical role mismatch');
   $team->is_admin=false;$team->save();
   $tokens=Laravel\Passport\Token::where('user_id',$team->id)->pluck('id');
   Illuminate\Support\Facades\DB::table('oauth_refresh_tokens')->whereIn('access_token_id',$tokens)->update(['revoked'=>true]);
   Laravel\Passport\Token::where('user_id',$team->id)->update(['revoked'=>true]);
  }
  return ['fixture_notifications_removed'=>$notifications,'technical_role_disabled'=>!$team || !$team->is_admin,'new_account_retained_without_pets'=>true];
 });
 echo json_encode($result);
} else throw new RuntimeException('Unknown scoped cleanup');
