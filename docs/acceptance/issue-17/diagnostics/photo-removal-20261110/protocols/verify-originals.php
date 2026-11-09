<?php
require '/var/www/html/vendor/autoload.php';$app=require '/var/www/html/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$user=App\Models\User::whereHas('profile',fn($q)=>$q->where('username',$input['username']))->sole();
$rows=[];$pets=$user->pets()->whereIn('id',[1,2])->orderBy('id')->get();if($pets->count()!==2)throw new RuntimeException('Original two pets missing');
foreach($pets as $pet){$rows[]=$pet->getAttributes();foreach($pet->records()->orderBy('id')->get() as $record){$rows[]=$record->getAttributes();foreach($record->photos()->orderBy('id')->get() as $photo){$rows[]=$photo->getAttributes();$found=false;foreach(['local','public'] as $disk){if(Illuminate\Support\Facades\Storage::disk($disk)->exists($photo->path)){$found=true;$rows[]=hash('sha256',Illuminate\Support\Facades\Storage::disk($disk)->get($photo->path));}}if(!$found)throw new RuntimeException('Original photo bytes missing');}}}
echo json_encode(['original_pets_records_photos_sha256'=>hash('sha256',json_encode($rows)),'current_pet_id'=>$user->current_pet_id,'pet_count'=>$user->pets()->count()]);
