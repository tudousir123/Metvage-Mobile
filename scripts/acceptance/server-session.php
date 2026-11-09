<?php
// Local test-account administration. Input is JSON on stdin; credentials never go in argv.
try {
    require '/var/www/html/vendor/autoload.php';
    $app = require '/var/www/html/bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    if (!preg_match('/^[A-Za-z0-9_-]{1,48}$/', $input['run_id'])) throw new RuntimeException();
    $user = App\Models\User::whereHas('profile', fn ($q) => $q->where('username', $input['profile_username']))->sole();
    $tag = 'metvage-acceptance-'.$input['run_id'];
    $revoke = fn () => Laravel\Passport\Token::where('user_id', $user->id)->where('name', $tag)->update(['revoked' => true]);
    switch ($input['operation']) {
        case 'issue':
            $revoke();
            $issued = $user->createToken($tag);
            $result = ['token' => $issued->accessToken, 'account_id' => $user->id];
            break;
        case 'revoke':
            $revoke();
            $result = ['revoked' => true];
            break;
        case 'owned_records':
            $ids = [];
            foreach ($input['records'] as $entry) {
                $expected = $input['run_id'].'-'.substr(hash('sha256', $input['run_id']."\0".$entry['key']), 0, 24);
                if ($entry['request_id'] !== $expected) throw new RuntimeException();
                $record = $user->petRecords()->whereKey($entry['id'])->where('pet_profile_id', $entry['pet_id'])->where('client_request_id', $expected)->first();
                if ($record) $ids[] = $record->id;
            }
            $result = ['ids' => $ids];
            break;
        case 'find_record':
            $result = ['id' => $user->petRecords()->where('pet_profile_id', $input['pet_id'])->where('client_request_id', $input['request_id'])->value('id')];
            break;
        case 'purge':
            foreach ($input['pets'] as $entry) {
                $pet = $user->pets()->find($entry['id']);
                if (!$pet) continue;
                if ($pet->bio !== $entry['marker'] && $pet->nickname !== $entry['seed_name']) throw new RuntimeException();
                if ($pet->records()->exists()) throw new RuntimeException();
                if ((int) $user->fresh()->current_pet_id === (int) $pet->id) {
                    $previous = $input['original_current_pet_id'];
                    if ($previous !== null && !$user->pets()->whereKey($previous)->exists()) throw new RuntimeException();
                    $user->current_pet_id = $previous;
                    $user->save();
                }
                $pet->delete();
            }
            $result = ['purged' => true];
            break;
        default:
            throw new RuntimeException();
    }
    echo json_encode($result, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    fwrite(STDERR, "Local test-account operation rejected\n");
    exit(1);
}
