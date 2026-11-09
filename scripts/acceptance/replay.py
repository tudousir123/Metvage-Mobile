"""Replay versioned UI plans with owned generated fixtures and guaranteed cleanup."""
import json
import hashlib
import urllib.error
import urllib.parse
import urllib.request

from plans import bind_plan
from fixtures import FixtureRun, NoRedirect, positive_id
from runtime import AcceptanceError, exclusive_lock


def guest_request(origin, path, expected=200):
    request = urllib.request.Request(origin + '/api/v1/metvage' + path, headers={'Accept': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            status, data = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, data = error.code, b''
    if status != expected:
        raise AcceptanceError(f'Guest request returned HTTP {status}, expected {expected}')
    return json.loads(data) if data else None


def verify_private_record(owner, peer, record):
    record_id = positive_id(record['id'])
    guest_request(owner.origin, f'/records/{record_id}', 404)
    if peer:
        peer.request('GET', f'/records/{record_id}', expected=(404,))


def verify_api(config, directory, run_id, report):
    if not config.get('peerProfileUsername') or config['peerProfileUsername'] == config['profileUsername']:
        raise AcceptanceError('Cross-account verification requires peerProfileUsername')
    owner = FixtureRun(config, directory, run_id, report)
    peer_config = {**config, 'profileUsername': config['peerProfileUsername']}
    peer = FixtureRun(peer_config, directory / 'peer', 'peer-' + hashlib.sha256((config['profileUsername'] + ':' + run_id).encode()).hexdigest()[:24], report)
    with exclusive_lock('account:' + owner.origin + ':' + config['profileUsername']), owner.authenticated(), peer.authenticated():
        if owner.state['account_id'] == peer.state['account_id']:
            raise AcceptanceError('Verification requires two distinct test accounts')
        pet_id = owner.pets()['current_pet_id']
        if pet_id is None:
            raise AcceptanceError('Selected test pet required for API verification')
        records = owner.request('GET', f'/pets/{pet_id}/records')['records']
        private = [record for record in records if record['visibility'] == 'private']
        if not private:
            raise AcceptanceError('Select a test pet with an existing private record')
        for record in private:
            verify_private_record(owner, peer, record)
        for records in [guest_request(owner.origin, f'/pets/{pet_id}/records')['records'], peer.request('GET', f'/pets/{pet_id}/records')['records']]:
            if any(record['visibility'] != 'public' for record in records):
                raise AcceptanceError('Public timeline returned a private record')
        term = urllib.parse.quote(config.get('variables', {}).get('publicSearchQuery', 'cat'))
        for result in [owner.request('GET', '/search?q=' + term), peer.request('GET', '/search?q=' + term), guest_request(owner.origin, '/search?q=' + term)]:
            if any(record['visibility'] != 'public' for record in result['records']):
                raise AcceptanceError('Public search returned a private record')
        report.event('api_visibility', private_records_checked=len(private), viewers=['owner', 'peer', 'guest'])


def replay(config, device, directory, run_id, plan, report, fail_after=None):
    keys = {spec['key'] for spec in config.get('fixtures', [])}
    if not set(plan.get('requiresFixtures', [])).issubset(keys) or not set(plan.get('publicFixtures', [])).issubset(keys):
        raise AcceptanceError('Plan fixture keys are missing from the local configuration')
    owner = FixtureRun(config, directory, run_id, report)
    report.event('plan', sources=plan['_sources'])
    with exclusive_lock('account:' + owner.origin + ':' + config['profileUsername']), owner.authenticated():
        try:
            owner.ensure()
            variables = {**config.get('variables', {}), 'fixture_run': run_id}
            pets = owner.pets()
            current_id = pets['current_pet_id']
            current = next((pet for pet in pets['pets'] if positive_id(pet['id']) == current_id), None)
            if variables.get('peerPetId'):
                follows = owner.request('GET', '/follows')['follows']
                followed = any(positive_id(item['target_pet']['id']) == int(variables['peerPetId']) for item in follows)
                variables['followLabel'] = '取消关注' if followed else '关注宠物'
            if current:
                variables.update(currentPetId=current_id, currentPetNickname=current['nickname'])
            for spec in config['fixtures']:
                entry = next(entry for entry in owner.state['pets'] if entry['key'] == spec['key'])
                record = next(record for record in owner.state['records'] if record['key'] == spec['key'])
                variables.update({spec['key'] + 'Id': entry['id'], spec['key'] + 'RecordId': record['id'], spec['key'] + 'Nickname': spec['nickname'], spec['key'] + 'RecordTitle': spec['nickname'] + '的测试照片'})
                if spec['key'] in plan.get('publicFixtures', []):
                    owner.request('PATCH', f'/records/{record["id"]}/visibility', {'visibility': 'public'})
            device.config = {**device.config, 'variables': variables}
            bound = bind_plan(plan, variables, run_id)
            with device.session(directory):
                device.run_plan(bound, directory, run_id, fail_after)
            for record in owner.state['records']:
                value = owner.request('GET', f'/records/{record["id"]}')['record']
                if value['visibility'] == 'private':
                    verify_private_record(owner, None, value)
            if plan.get('commentFixture'):
                record = next(entry for entry in owner.state['records'] if entry['key'] == plan['commentFixture'])
                comments = owner.request('GET', f'/records/{record["id"]}/interactions')['comments']
                matched = [comment for comment in comments if comment['text'] == run_id]
                if len(matched) != 1 or positive_id(matched[0]['actor_pet']['id']) != current_id:
                    raise AcceptanceError('UI comment did not persist exactly once under the selected pet')
                report.event('comment_persisted', count=1)
            if owner.pets()['current_pet_id'] != current_id:
                raise AcceptanceError('Replay changed the original selected pet')
        finally:
            owner.cleanup()
