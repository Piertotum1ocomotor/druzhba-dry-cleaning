"""Optional, mutually exclusive destinations for a new lead."""
import json
import os
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request

from payment import BANK_HTTP

AMO = 'https://chistoekb66.amocrm.ru'
ROISTAT = 'https://cloud.roistat.com/api/proxy/1.0/leads/add'


class UncertainDelivery(Exception):
    """Verify the provider's history before any resend."""


def settings():
    mode = os.getenv('CRM_MODE', 'off')
    if mode == 'off':
        return mode, {}
    if mode not in ('amo', 'roistat'):
        raise RuntimeError('CRM_MODE: off, amo или roistat')
    ids = {key: int(os.environ[env]) for key, env in (
        ('pipeline_id', 'AMO_PIPELINE_ID'), ('status_id', 'AMO_STATUS_ID'),
        ('responsible_user_id', 'AMO_RESPONSIBLE_ID'),
    )}
    cfields = json.loads(os.getenv('CRM_FIELDS_JSON', '{}'))
    if (any(i <= 0 for i in ids.values()) or not isinstance(cfields, dict)
            or any(type(i) is not int or i <= 0 for i in cfields.values())):
        raise RuntimeError('Проверьте ID воронки, этапа, ответственного и полей CRM')
    if mode == 'amo' and 'details' not in cfields:
        raise RuntimeError('Для amoCRM укажите ID поля details для текста заявки')
    token = os.environ['AMO_ACCESS_TOKEN' if mode=='amo' else 'ROISTAT_LEADS_KEY']
    if not token:
        raise RuntimeError('Не указан ключ интеграции CRM')
    return mode, (ids, cfields, token)


def prepare(row, message, routing):
    mode, (ids, cfields, token) = routing
    fields = {v['type']: v['value'] for v in json.loads(row['fields']) if v['value']}
    track = json.loads(row['tracking'])
    phone, email, name = (fields.get(k, '') for k in ('phone','email','name'))
    title = f'{row["form_name"]} • Дружба №{row["id"]}'[:240]
    custom = {**track, 'details': message[:3900], 'order_id': f'druzhba-{row["id"]}'}
    extra = {cfields[k]: str(v) for k, v in custom.items() if k in cfields and v}
    budget = (row['amount'] + 50) // 100
    if mode == 'amo':
        payload = dict(ids, name=title, price=budget, request_id=row['request_key'],
                       custom_fields_values=[{'field_id': k, 'values':[{'value': v}]} for k,v in extra.items()])
        contacts = [{'field_code': key, 'values':[{'value': v, 'enum_code':'WORK'}]}
                    for key,v in [('PHONE',phone),('EMAIL',email)] if v]
        if name or contacts:
            payload['_embedded']={'contacts':[{'name':name or 'Клиент сайта', 'custom_fields_values':contacts}]}
        return Request(AMO+'/api/v4/leads/complex', json.dumps([payload]).encode(),
                       {'Content-Type':'application/json','Authorization':'Bearer '+token})
    if not (phone or email):
        raise UncertainDelivery('Для отправки через Roistat нужен телефон или email')
    args = {
        'key':token, 'roistat':track.get('roistat_visit') or 'nocookie', 'title':title, 'comment':message[:1800],
        'name':name, 'phone':phone, 'email':email, 'sync':'1', 'is_need_callback':'0',
        **{f'fields[{k}]':v for k,v in dict(ids,price=budget).items()},
        **{f'fields[{k}]':v[:250] for k,v in extra.items() if k!=cfields.get('details')},
    }
    return Request(ROISTAT+'?'+urlencode(args))


def deliver(row, message, routing):
    mode, _ = routing
    req = prepare(row, message, routing)
    try:
        with BANK_HTTP.open(req,timeout=10) as response:
            result = json.loads(response.read(200_000))
    except HTTPError as e:
        if e.code in {400,401,403,404,415,422,429}:
            raise RuntimeError('CRM не приняла запрос') from None
        raise UncertainDelivery('Нет подтверждения CRM') from None
    except (OSError, ValueError):
        raise UncertainDelivery('Нет подтверждения CRM') from None
    if mode == 'amo':
        ok = (isinstance(result, list) and len(result)==1 and isinstance(result[0],dict)
              and type(result[0].get('id')) is int and row['request_key'] in (result[0].get('request_id') or ()))
    else:
        ok = (isinstance(result, dict) and result.get('status') in ('success','ok')
              and any(result.get(k) for k in ('id','lead_id','order_id')))
    if not ok:
        raise UncertainDelivery('Не удалось подтвердить получение заявки')
