"""Validate every action before device mutation; bind navigation conditions once."""
import hashlib
from pathlib import Path
import re
from runtime import AcceptanceError, read_json

ACTIONS = {'tap', 'assert', 'type', 'back', 'keyboard', 'swipe', 'capture', 'open', 'api_connection', 'touch'}


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def valid_app_path(value):
    return nonempty(value) and value.startswith('/') and not any(ch.isspace() or ord(ch) < 32 or ch in "'\"" for ch in value)


def validate_condition(condition):
    if not isinstance(condition, dict) or not condition or set(condition) - {'label','keyboard'}:
        raise AcceptanceError('Invalid navigation postcondition')
    if 'label' in condition and not nonempty(condition['label']):
        raise AcceptanceError('Navigation postcondition label must be nonempty')
    if 'keyboard' in condition and (not isinstance(condition['keyboard'],str) or condition['keyboard'] not in {'hidden','visible'}):
        raise AcceptanceError('Invalid keyboard postcondition')


def validate_plan(plan):
    if not isinstance(plan, dict) or not isinstance(plan.get('steps'), list):
        raise AcceptanceError('Plan requires a steps array')
    for key in ['requiresFixtures','publicFixtures']:
        if key in plan and (not isinstance(plan[key],list) or not all(nonempty(value) for value in plan[key])):
            raise AcceptanceError('Plan fixture keys must be arrays of nonempty strings')
    if 'commentFixture' in plan and not nonempty(plan['commentFixture']):
        raise AcceptanceError('Comment fixture key must be nonempty')
    for number, step in enumerate(plan['steps'], 1):
        if not isinstance(step, dict) or not isinstance(step.get('action'),str) or step['action'] not in ACTIONS:
            raise AcceptanceError(f'Plan step {number}: unsupported action')
        action = step['action']
        if action in {'back','open'} and not step.get('expect'):
            raise AcceptanceError(f'Plan step {number}: {action} requires a postcondition')
        if 'expect' in step:
            validate_condition(step['expect'])
        if 'timeout' in step and (type(step['timeout']) not in {int,float} or not 0 < step['timeout'] <= 120):
            raise AcceptanceError(f'Plan step {number}: timeout must be within 120 seconds')
        if action in {'tap','assert','keyboard','touch'} and not nonempty(step.get('label')):
            raise AcceptanceError(f'Plan step {number}: nonempty label required')
        if 'index' in step and (type(step['index']) is not int or step['index'] < 0):
            raise AcceptanceError(f'Plan step {number}: index must be a nonnegative integer')
        if action == 'type' and not isinstance(step.get('text'),str):
            raise AcceptanceError(f'Plan step {number}: text required')
        if 'replace' in step and (action != 'type' or type(step['replace']) is not bool):
            raise AcceptanceError(f'Plan step {number}: replace must be a boolean on type actions')
        if action == 'open' and not valid_app_path(step.get('path')):
            raise AcceptanceError(f'Plan step {number}: encoded app-relative path required')
        if action == 'capture' and ('name' in step and (not isinstance(step['name'],str) or not re.fullmatch(r'[A-Za-z0-9_-]+',step['name']))):
            raise AcceptanceError(f'Plan step {number}: screenshot name must be a plain filename')
        if action == 'swipe':
            points = step.get('fractions')
            if not isinstance(points,list) or len(points) != 4 or not all(type(point) in {int,float} and 0 <= point <= 1 for point in points):
                raise AcceptanceError(f'Plan step {number}: swipe requires four fractions between zero and one')
        if action == 'api_connection' and (not isinstance(step.get('state'),str) or step['state'] not in {'on','off'}):
            raise AcceptanceError(f'Plan step {number}: connection state required')
    return plan


def bind_plan(plan, variables, run_id):
    values = {**variables, 'run_id':run_id}
    def expand(value):
        if isinstance(value,str):
            def replace(match):
                if match.group(1) not in values:
                    raise AcceptanceError('Unknown plan variable: ' + match.group(1))
                return str(values[match.group(1)])
            return re.sub(r'\{([A-Za-z_][A-Za-z0-9_]*)\}',replace,value)
        if isinstance(value,list):
            return [expand(item) for item in value]
        if isinstance(value,dict):
            return {key:expand(item) for key,item in value.items()}
        return value
    return validate_plan({**plan, 'steps':expand(plan['steps']), '_bound':True})


def load_plan(path, stack=()):
    path = Path(path).resolve()
    if path in stack:
        raise AcceptanceError('Cyclic plan include')
    value = read_json(path)
    if not isinstance(value,dict) or not isinstance(value.get('include',[]),list):
        raise AcceptanceError('Invalid plan includes')
    merged = {'steps':[], 'requiresFixtures':[], 'publicFixtures':[], '_sources':[]}
    for name in value.get('include',[]):
        if not nonempty(name):
            raise AcceptanceError('Plan include must be a local filename')
        child = (path.parent/name).resolve()
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
    merged['_sources'].append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    return validate_plan(merged)
