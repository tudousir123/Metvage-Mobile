"""Emulator-only photo-removal probe; verify persistence after save settles."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import time
import urllib.request

from fixtures import FixtureRun, positive_id
from launch import verify_runtime
from plans import bind_plan, load_plan
from runtime import AcceptanceError, Report, exclusive_lock


def validate_probe_config(config, iterations):
    if not re.fullmatch(r'emulator-\d+', config.get('serial', '')):
        raise AcceptanceError('Photo probe only permits an Android emulator')
    if config.get('testAccount') is not True or not config.get('mobileRoot'):
        raise AcceptanceError('Photo probe requires a test account and mobileRoot')
    if not 1 <= iterations <= 100:
        raise AcceptanceError('Photo probe iterations must be between 1 and 100')
    specs = config.get('fixtures', [])
    if len(specs) != 2 or {spec['key'] for spec in specs} != {'cat', 'dog'}:
        raise AcceptanceError('Photo probe requires exactly cat and dog generated fixtures')


def observe_saved_record(fetch, expected, *, timeout=5, interval=.25, observe=None):
    """An early read of the old record is not evidence that a completed save failed."""
    deadline = time.monotonic() + timeout
    while True:
        record = fetch()
        changes_saved = all(record.get(key) == value for key, value in expected.items())
        if observe:
            observe(changes_saved, len(record['photos']))
        if changes_saved and not record['photos']:
            return 'removed', record
        if time.monotonic() >= deadline:
            return ('retained' if changes_saved else 'save-unconfirmed'), record
        time.sleep(interval)


@contextlib.contextmanager
def app_fixture_session(fixture, device):
    if not re.fullmatch(r'emulator-\d+', device.serial):
        raise AcceptanceError('App OAuth fixture recovery only permits an Android emulator')
    raw = device.call('exec-out', 'run-as', device.package, 'cat', 'files/mmkv/mmkv.default', binary=True)
    tokens = list(dict.fromkeys(re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', raw)))
    if len(tokens) != 1:
        raise AcceptanceError('One actual App OAuth token is required')
    fixture.token = tokens[0].decode()
    fixture.report.secrets.append(fixture.token)
    try:
        request = urllib.request.Request(fixture.origin + '/api/v1/accounts/verify_credentials',
                                         headers={'Accept': 'application/json', 'Authorization': 'Bearer ' + fixture.token})
        with fixture.http.open(request, timeout=15) as response:
            profile = json.load(response)
        if profile['username'] != fixture.config['profileUsername']:
            raise AcceptanceError('Actual App identity differs from the configured test account')
        yield
    finally:
        fixture.token = None


def probe_photos(config, device, directory, run_id, report, iterations=1, font_scale=1.45,
                 negative_control=False):
    validate_probe_config(config, iterations)
    if negative_control and iterations != 1:
        raise AcceptanceError('Use one iteration for the intentional negative control')
    plan = load_plan(Path(__file__).with_name('plans') / 'photo-edit-probe.json')
    fixture = FixtureRun(config, directory, run_id, report)
    if fixture.state['cleaned']:
        raise AcceptanceError('This probe run was cleaned; use a fresh run-id')
    with exclusive_lock('account:' + fixture.origin + ':' + config['profileUsername']), device.session(directory, font_scale):
        report.event('runtime', **verify_runtime(config, device), environment='emulator')
        report.event('probe_protocol', sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                     save_observation_seconds=5, intentional_negative_control=negative_control)
        with app_fixture_session(fixture, device):
            fixture.state['authentication'] = 'app-oauth'
            fixture.save()
            existing = fixture.pets()['pets']
            names = {spec['nickname'] for spec in config['fixtures']}
            if any(pet['nickname'] in names for pet in existing) and not fixture.state['pets']:
                raise AcceptanceError('Use fixture nicknames distinct from existing pets')
            try:
                fixture.ensure()
                cat = next(pet for pet in fixture.state['pets'] if pet['key'] == 'cat')
                dog = next(pet for pet in fixture.state['pets'] if pet['key'] == 'dog')
                cat_spec = next(spec for spec in config['fixtures'] if spec['key'] == 'cat')
                for iteration in range(iterations):
                    key = 'trial' + str(len(fixture.state['records']))
                    request_id = run_id + '-' + hashlib.sha256((run_id + '\0' + key).encode()).hexdigest()[:24]
                    entry = {'key': key, 'id': None, 'pet_id': cat['id'], 'request_id': request_id}
                    fixture.state['records'].append(entry)
                    fixture.save()
                    record = fixture.request('POST', '/records', {
                        'pet_id': cat['id'], 'visibility': 'private', 'title': 'Photo probe seed',
                        'text': cat['marker'], 'client_request_id': request_id,
                    }, image=Path(cat_spec['image']).read_bytes(), expected=(200, 201))['record']
                    entry['id'] = positive_id(record['id'])
                    fixture.save()
                    if positive_id(record['pet_id']) != cat['id'] or len(record['photos']) != 1:
                        raise AcceptanceError('Probe seed must have its owned cat and one generated photo')
                    report.event('probe_seed', record_id=entry['id'], source_pet_id=cat['id'],
                                 target_pet_id=dog['id'], photo_ids=[photo['id'] for photo in record['photos']])
                    expected = {'text': 'photo-probe-edited', 'title': 'photo-probe-title', 'pet_id': dog['id']}
                    variables = {'probeRecordId': entry['id'], 'probeText': expected['text'],
                                 'probeTitle': expected['title'], 'dogNickname': next(
                                     spec['nickname'] for spec in config['fixtures'] if spec['key'] == 'dog')}
                    bound = bind_plan(plan, variables, run_id)
                    report.event('plan', sources=plan['_sources'], iteration=iteration + 1,
                                 record_id=entry['id'], intentional_negative_control=negative_control)
                    if negative_control:
                        bound['steps'] = [step for step in bound['steps'] if step.get('label') != '移除第 1 张照片']
                    device.run_plan(bound, directory, run_id)
                    verdict, saved = observe_saved_record(
                        lambda: fixture.request('GET', f'/records/{entry["id"]}')['record'], expected,
                        observe=lambda confirmed, count: report.event('save_readback',
                            record_id=entry['id'], other_changes_confirmed=confirmed, photo_count=count))
                    if positive_id(saved['id']) != entry['id']:
                        raise AcceptanceError('Readback returned a different record')
                    entry['pet_id'] = positive_id(saved['pet_id'])
                    fixture.save()
                    report.event('photo_verdict', verdict=verdict, record_id=entry['id'],
                                 intentional_negative_control=negative_control)
                    if verdict == 'save-unconfirmed':
                        raise AcceptanceError('Save of other intended changes unconfirmed; not a photo-removal reproduction')
                    if verdict == 'retained':
                        if negative_control:
                            raise AcceptanceError('Negative control detected: removal intentionally omitted; not a bug reproduction')
                        raise AcceptanceError('Saved other changes, but generated photo remains')
                    if negative_control:
                        raise AcceptanceError('Negative control did not retain its seeded photo')
                verify_runtime(config, device)
            finally:
                primary_error = sys.exc_info()[1]
                cleanup = Report(directory, 'cleanup')
                try:
                    # A failed UI postcondition can still follow a successful reassociation.
                    for entry in fixture.state['records']:
                        if entry.get('id'):
                            saved = fixture.request('GET', f'/records/{entry["id"]}', expected=(200, 404))
                            if saved:
                                entry['pet_id'] = positive_id(saved['record']['pet_id'])
                    fixture.save()
                    fixture.cleanup()
                    with contextlib.redirect_stdout(io.StringIO()):
                        cleanup.finish('pass')
                except (AcceptanceError, OSError, ValueError) as error:
                    with contextlib.redirect_stdout(io.StringIO()):
                        cleanup.finish('fail', error=str(error))
                    if primary_error is None:
                        raise
                    report.event('cleanup_pending', error=str(error))
