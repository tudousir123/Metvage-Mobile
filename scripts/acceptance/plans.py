"""Validate input before any device mutation; postconditions bound navigation."""
import hashlib
from pathlib import Path
from runtime import AcceptanceError, read_json

ACTIONS = {'tap', 'assert', 'type', 'back', 'keyboard', 'swipe', 'capture', 'open', 'api_connection', 'touch'}


def validate_plan(plan):
    if not isinstance(plan, dict) or not isinstance(plan.get('steps'), list):
        raise AcceptanceError('Plan requires a steps array')
    for key in ['requiresFixtures', 'publicFixtures']:
        if key in plan and (not isinstance(plan[key],list) or not all(isinstance(value,str) for value in plan[key])):
            raise AcceptanceError('Plan fixture keys must be arrays of strings')
    for number, step in enumerate(plan['steps'], 1):
        if not isinstance(step, dict) or step.get('action') not in ACTIONS:
            raise AcceptanceError(f'Plan step {number}: unsupported action')
        action = step['action']
        expect = step.get('expect')
        if action in {'back', 'open'} and not expect:
            raise AcceptanceError(f'Plan step {number}: {action} requires a postcondition')
        if expect is not None:
            if not isinstance(expect, dict) or not expect or set(expect) - {'label', 'keyboard'}:
                raise AcceptanceError(f'Plan step {number}: invalid postcondition')
            if 'keyboard' in expect and expect['keyboard'] not in {'hidden', 'visible'}:
                raise AcceptanceError(f'Plan step {number}: invalid keyboard postcondition')
            if 'label' in expect and not isinstance(expect['label'], str):
                raise AcceptanceError(f'Plan step {number}: invalid label postcondition')
        if 'timeout' in step and (type(step['timeout']) not in {int,float} or not 0 < step['timeout'] <= 120):
            raise AcceptanceError(f'Plan step {number}: timeout must be within 120 seconds')
        if action == 'type' and not isinstance(step.get('text'),str):
            raise AcceptanceError(f'Plan step {number}: text required')
        if action == 'open' and not isinstance(step.get('path'),str):
            raise AcceptanceError(f'Plan step {number}: app path required')
        if action in {'tap', 'assert', 'keyboard', 'touch'} and not isinstance(step.get('label'), str):
            raise AcceptanceError(f'Plan step {number}: label required')
        if 'index' in step and (type(step['index']) is not int or step['index'] < 0):
            raise AcceptanceError(f'Plan step {number}: index must be a nonnegative integer')
        if action == 'api_connection' and step.get('state') not in {'on', 'off'}:
            raise AcceptanceError(f'Plan step {number}: connection state required')
    return plan


def load_plan(path, stack=()):
    path = Path(path).resolve()
    if path in stack:
        raise AcceptanceError('Cyclic plan include')
    value = read_json(path)
    if not isinstance(value,dict) or not isinstance(value.get('include',[]),list):
        raise AcceptanceError('Invalid plan includes')
    merged = {'steps':[], 'requiresFixtures':[], 'publicFixtures':[], '_sources':[]}
    for name in value.get('include',[]):
        if not isinstance(name,str):
            raise AcceptanceError('Plan include must be a local filename')
        child = (path.parent / name).resolve()
        if not child.is_relative_to(path.parent):
            raise AcceptanceError('Plan include must stay in its directory')
        plan = load_plan(child, (*stack,path))
        for key in ['steps','requiresFixtures','publicFixtures','_sources']:
            merged[key].extend(plan.get(key,[]))
        if plan.get('commentFixture'):
            if merged.get('commentFixture') not in {None,plan['commentFixture']}:
                raise AcceptanceError('Conflicting comment fixture plans')
            merged['commentFixture'] = plan['commentFixture']
    local = validate_plan({**value, 'steps':value.get('steps',[])})
    for key in ['steps','requiresFixtures','publicFixtures']:
        merged[key].extend(local.get(key,[]))
    if local.get('commentFixture'):
        if merged.get('commentFixture') not in {None,local['commentFixture']}:
            raise AcceptanceError('Conflicting comment fixture plans')
        merged['commentFixture'] = local['commentFixture']
    merged['_sources'].append({'file':path.name, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    return validate_plan(merged)
