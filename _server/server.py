"""Run the mirrored website and its server-side forms on the same origin."""
from contextlib import closing, contextmanager
from decimal import Decimal, InvalidOperation
from email.message import EmailMessage
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit, urlencode
from urllib.request import Request, urlopen
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import threading
import time

from payment import Bank, Payments, Problem, https_origin
import crm
import checkout

ROOT = Path(__file__).resolve().parent
PROJECT = '/mod/project/378840'
PREFIX = '/druzhba-dry-cleaning'
TOKEN = re.compile(r'^[A-Za-z0-9_-]{18,80}$')
KEYS = {'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_referrer',
        'referrer','url','yclid','ym_client_id','ga_client_id'}


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def clean(value, limit):
    if isinstance(value, (str, int)):
        return str(value)[:limit].strip()
    return ''


def price(value):
    try:
        result = Decimal(str(value)) * 100
        if not result.is_finite() or result < 0 or result > 10_000_000_00 or result != result.to_integral_value():
            raise ValueError
        return int(result)
    except (InvalidOperation, ValueError, TypeError):
        raise Problem(422, 'Проверьте цену позиции') from None


def page_route(value):
    path=urlsplit(clean(value, 800)).path
    if path == PREFIX or path.startswith(PREFIX + '/'):
        path=path.removeprefix(PREFIX)
    return path.rstrip('/') or '/'


class Database:
    def __init__(self, file):
        self.file = Path(file)
        self.file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self.read() as con:
            con.execute('PRAGMA journal_mode=WAL')
            con.executescript("""
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY, request_key TEXT UNIQUE, body_hash TEXT, access TEXT,
                path TEXT, form_name TEXT, fields TEXT, items TEXT, tracking TEXT,
                amount INTEGER, state TEXT, paid_attempt TEXT, ip_key TEXT, created REAL);
            CREATE INDEX IF NOT EXISTS repeat_ip ON leads(ip_key, created);
            CREATE TABLE IF NOT EXISTS attempts (
                order_id TEXT PRIMARY KEY, lead_id INTEGER REFERENCES leads(id),
                payment_id TEXT UNIQUE, amount INTEGER, state TEXT, url TEXT,
                updated REAL, next_check REAL);
            CREATE INDEX IF NOT EXISTS attempt_due ON attempts(next_check);
            CREATE TABLE IF NOT EXISTS bank_events (
                order_id TEXT, status TEXT, received REAL, PRIMARY KEY(order_id, status));
            CREATE TABLE IF NOT EXISTS payment_alerts (
                order_id TEXT, reason TEXT, created REAL, PRIMARY KEY(order_id, reason));
            CREATE TABLE IF NOT EXISTS outbox (
                lead_id INTEGER REFERENCES leads(id), event TEXT, channel TEXT, state TEXT DEFAULT 'pending',
                attempts INTEGER DEFAULT 0, next_run REAL DEFAULT 0,
                PRIMARY KEY(lead_id,event,channel));
            """)
        self.file.chmod(0o600)

    @contextmanager
    def read(self):
        with closing(sqlite3.connect(self.file, timeout=6)) as con:
            con.row_factory = sqlite3.Row
            con.execute('PRAGMA foreign_keys=ON')
            con.execute('PRAGMA synchronous=FULL')
            yield con

    @contextmanager
    def write(self):
        with self.read() as con:
            con.execute('BEGIN IMMEDIATE')
            try:
                yield con
                con.commit()
            except BaseException:
                con.rollback()
                raise

    def enqueue(self, con, lead_id, event):
        channels = ('email', 'telegram', 'crm') if event in ('new_order', 'new_lead') else ('email', 'telegram')
        for channel in channels:
            con.execute('INSERT OR IGNORE INTO outbox(lead_id,event,channel) VALUES (?,?,?)',
                        (lead_id,event,channel))


class Site:
    def __init__(self, file, db, bank):
        self.config = json.loads(Path(file).read_text())
        self.settings = self.config['settings']
        self.catalog = self.config['catalog']['products']
        self.products = {str(p['id']):p for p in self.catalog}
        self.db = db
        self.bank = bank
        self.payments = Payments(db,bank)
        self.captcha_secret = os.getenv('RECAPTCHA_SECRET', '')
        self.captcha_key = os.getenv('RECAPTCHA_SITE_KEY', '')
        if bool(self.captcha_key) != bool(self.captcha_secret):
            raise RuntimeError('Укажите оба ключа reCAPTCHA')
        self.live_origin = os.getenv('PUBLIC_ORIGIN', '').rstrip('/')
        if self.live_origin:
            self.live_origin = https_origin(self.live_origin)
        self.ip_key = os.getenv('APP_IP_HASH_KEY', '')
        if self.live_origin and not (self.captcha_secret and len(self.ip_key)>=32):
            raise RuntimeError('Публичный режим требует reCAPTCHA и APP_IP_HASH_KEY длиной от 32 символов')
        self.ip_key = self.ip_key or secrets.token_hex(32)

    def get_form(self, body, path):
        fid = clean(body.get('id'), 80)
        choices = self.config['forms'].get(path, {})
        form = choices.get(fid)
        if form is None:
            matched = [v for k,v in choices.items() if k.startswith('quiz') and fid.startswith(k + '_')]
            if len(matched) == 1:
                form = matched[0]
        if not form:
            raise Problem(422, 'Форма не найдена')
        return form

    def form_fields(self, source, definitions, branched=False):
        if not isinstance(source,list) or len(source)>100:
            raise Problem(422, 'Не удалось прочитать поля формы')
        fields=[]
        received={}
        for row in source:
            if not isinstance(row,dict):
                raise Problem(422, 'Не удалось прочитать поле формы')
            key=clean(row.get('id'),80)
            definition=definitions.get(key)
            if definition is None and definitions:
                continue
            ftype=(definition or {}).get('type') or clean(row.get('type'),40)
            value=row.get('value')
            if ftype in {'file','upload'}:
                if value:
                    raise Problem(422, 'Загрузка файлов пока недоступна')
                continue
            value='; '.join(clean(v,500) for v in value[:40]) if isinstance(value,list) else clean(value,4000)
            received[key]=value
            if value:
                label=(definition or {}).get('name') or clean(row.get('name'),180)
                fields.append({'id':key,'type':ftype,'name':label,'value':value})
        for key,definition in definitions.items():
            value=received.get(key,'')
            if not value and definition['required'] and not branched:
                raise Problem(422,'Заполните поле «'+definition['name']+'»')
            if value and definition['type']=='phone' and not 10<=len(re.sub(r'\D','',value))<=15:
                raise Problem(422,'Проверьте номер телефона')
            if value and definition['type']=='email' and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value):
                raise Problem(422,'Проверьте адрес электронной почты')
        return fields

    def cart(self, raw):
        if isinstance(raw,str):
            try: raw=json.loads(raw)
            except ValueError: raise Problem(422,'Корзина не распознана') from None
        if not isinstance(raw,list) or not 1<=len(raw)<=60:
            raise Problem(422,'Корзина пуста или содержит слишком много позиций')
        items={}
        for row in raw:
            if not isinstance(row,dict):
                raise Problem(422,'Корзина не распознана')
            qty=row.get('count',1)
            if type(qty) is not int or not 1<=qty<=100:
                raise Problem(422,'Некорректное количество')
            measured = None
            product_id = row.get('productId') or row.get('product_id') or row.get('serverProductId')
            if product_id:
                p=self.products.get(clean(product_id,30))
                if not p or not p.get('visible') or not p.get('available',True):
                    raise Problem(422,'Позиция недоступна')
                var_id=clean(row.get('variantId') or row.get('variant_id') or row.get('serverVariantId'),30)
                v=next((v for v in p['variants'] if str(v['id'])==var_id),None)
                if v is None or not v.get('visible') or v.get('quantity')==0 or v.get('price') is None:
                    raise Problem(422,'Вариант услуги недоступен')
                unit=price(v['price'])
                title=' — '.join((p['name'], ', '.join(v['name']))) if v['name'] else p['name']
                key=(str(p['id']),var_id)
                if checkout.is_carpet(p):
                    measured = checkout.dimensions(row.get('druzhba_dimensions'))
                    unit = checkout.measured_price(unit, measured)
                    if measured:
                        length, width = measured['length'], measured['width']
                        title += f' · {length:g} × {width:g} м ({length * width:g} м²)'
                        key += (str(length.normalize()), str(width.normalize()))
                    else:
                        title += ' · цена за м², размер уточним'
                        key += ('unknown',)
                stock=v.get('quantity',-1)
            else:
                title=clean(row.get('title'),220)
                unit=price(row.get('price'))
                # The original cart can keep static offers while the visitor navigates between pages.
                # Match a previously published title/amount pair, never charge an arbitrary client price.
                if not any([title,unit] in values for values in self.config['custom'].values()):
                    raise Problem(422,'Цена услуги в корзине изменилась')
                key=(title,unit)
                stock=-1
            if row.get('price') is not None and price(row['price'])!=unit:
                raise Problem(409,'Цена изменилась. Обновите корзину.')
            if key not in items:
                items[key]={'name':title,'unit':unit,'count':0,'productId':product_id,'variantId':var_id if product_id else row.get('variantId')}
                reason = checkout.price_details(p, v)['reason'] if product_id else checkout.custom_estimate(title)
                if reason:
                    items[key]['provisional'] = True
                    items[key]['estimateReason'] = reason
                if product_id and checkout.is_carpet(p):
                    items[key]['dimensions'] = {k: str(v) for k, v in measured.items()} if measured else None
            items[key]['count']+=qty
            if items[key]['count']>100 or (isinstance(stock,int) and stock>=0 and items[key]['count']>stock):
                raise Problem(422,'Недоступное количество товара')
        return list(items.values())

    def captcha(self, value):
        if not self.captcha_secret:
            return
        fields={'secret':self.captcha_secret,'response':clean(value,3500)}
        if fields['response']:
            req=Request('https://www.google.com/recaptcha/api/siteverify',urlencode(fields).encode())
            try:
                with urlopen(req,timeout=6) as res:
                    response=json.load(res)
                if response.get('success') is True and response.get('hostname')==urlsplit(self.live_origin).hostname:
                    return
            except (OSError, ValueError):
                raise Problem(503,'Проверка reCAPTCHA временно недоступна') from None
        raise Problem(400,'Подтвердите отправку формы',captcha='invisible')

    def submit(self, body, peer):
        key=body.get('druzhba_request_id')
        if not isinstance(key,str) or not TOKEN.fullmatch(key) or body.get('druzhba_consent') is not True:
            raise Problem(422,'Подтвердите согласие на обработку данных и повторите отправку')
        path=page_route(body.get('druzhba_path'))
        form=self.get_form(body,path)
        fields=self.form_fields(body.get('fields',[]),form['fields'],form.get('quiz',False))
        if form.get('quiz') and not fields:
            raise Problem(422,'Не получено ни одного ответа анкеты')
        items=self.cart(body.get('products')) if form['cart'] else []
        amount=sum(i['unit']*i['count'] for i in items)
        if items and amount < self.settings['commerce']['minTotalOrder']*100:
            raise Problem(422,'Сумма заказа меньше минимальной')
        if items and (body.get('shipping') or body.get('promocode')):
            raise Problem(422,'Этот способ доставки или промокод сейчас не действует')
        enhanced = form['cart'] and 'druzhba_checkout' in body
        method = None
        provisional = any(item.get('provisional') for item in items)
        if enhanced:
            extra_fields, method = checkout.checkout_fields(body['druzhba_checkout'], checkout.fulfillment_for(items, self.products))
            fields.extend(extra_fields)
            if provisional:
                fields.append(checkout.field('druzhba_estimate', 'Стоимость заказа', 'Предварительная, итоговую стоимость согласуем до начала чистки' if checkout.fulfillment_for(items, self.products) != 'pickup' else 'Предварительная, требуется согласование после приёмки вещей'))
        tracking=body.get('utmData')
        if isinstance(tracking,str):
            try: tracking=json.loads(tracking)
            except ValueError: tracking={}
        tracking={k:clean(v,800) for k,v in tracking.items() if k in KEYS} if isinstance(tracking,dict) else {}
        visit=clean(body.get('roistatVisit'),80)
        if visit:
            tracking['roistat_visit']=visit
        state='awaiting_payment' if items and form['action']=='pay' else 'received'
        if enhanced:
            state = {'online': 'awaiting_payment', 'cash': 'cash', 'manager': 'received'}[method]
        if provisional:
            state = 'deferred'
        fingerprint=hashlib.sha256(encoded([path,body.get('id'),fields,items]).encode()).hexdigest()
        ip=hmac.new(self.ip_key.encode(),peer.encode(),hashlib.sha256).hexdigest()
        with self.db.read() as con:
            old=con.execute('SELECT * FROM leads WHERE request_key=?',(key,)).fetchone()
            rate=con.execute('SELECT COUNT(*) FROM leads WHERE ip_key=? AND created>?',(ip,time.time()-300)).fetchone()[0]
        if old:
            if old['body_hash']!=fingerprint:
                raise Problem(409,'Форма изменилась. Отправьте её ещё раз.')
            return self.reply(old)
        if enhanced and method == 'online' and not provisional and not self.bank.active:
            raise Problem(503, 'Онлайн-оплата временно недоступна. Выберите оплату наличными или согласование с менеджером.')
        if rate>=12:
            raise Problem(429,'Слишком много заявок. Попробуйте чуть позже.')
        if rate:
            self.captcha(body.get('captcha-token'))
        with self.db.write() as con:
            old=con.execute('SELECT * FROM leads WHERE request_key=?',(key,)).fetchone()
            if old:
                if old['body_hash']!=fingerprint:
                    raise Problem(409,'Форма изменилась. Отправьте её ещё раз.')
                return self.reply(old)
            row=con.execute("""INSERT INTO leads(request_key,body_hash,access,path,form_name,fields,items,tracking,
                amount,state,ip_key,created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *""",
                (key,fingerprint,secrets.token_urlsafe(24),path,form['name'],encoded(fields),encoded(items),
                 encoded(tracking),amount,state,ip,time.time())).fetchone()
            self.db.enqueue(con,row['id'],'new_order' if items else 'new_lead')
            return self.reply(row)

    def reply(self, row):
        answer={'lead_id':row['id']}
        if row['state']=='awaiting_payment':
            answer['pay']={'pay_id':row['id'],'pay_hash':row['access'],'pay_link':f'/checkout/{row["id"]}'}
        fields = {item['id']: item['value'] for item in json.loads(row['fields'])}
        if 'druzhba_payment' in fields:
            message = 'Менеджер свяжется с вами и подтвердит детали заказа.'
            if row['state'] == 'deferred':
                reasons = {item.get('estimateReason') for item in json.loads(row['items']) if item.get('provisional')}
                detail = 'после обмера' if reasons == {'measure'} else 'после приёмки вещей'
                message = f'Стоимость предварительная. Менеджер согласует итоговую сумму {detail}. Выбранный способ оплаты сохранён.'
            elif row['state'] == 'cash':
                message = 'Заказ принят с оплатой наличными курьеру. Менеджер подтвердит детали вывоза.'
            fulfillment = {'Выезд мастера': 'visit', 'Выезд мастера и доставка': 'mixed'}.get(fields.get('druzhba_fulfillment'), 'pickup')
            if fulfillment == 'visit':
                message = 'Менеджер свяжется с вами и подтвердит детали выезда мастера. Мебель почистим на месте.'
            elif fulfillment == 'mixed':
                message = 'Менеджер отдельно согласует выезд мастера для мебели, вывоз и возврат остальных вещей.'
            if fulfillment != 'pickup' and row['state'] == 'deferred':
                message = 'Стоимость предварительная. Итоговую сумму согласуем до начала чистки. ' + message
            answer['checkout'] = {
                'state': row['state'], 'payment': fields['druzhba_payment'],
                'message': message, 'amount': row['amount'] / 100,
                'fulfillment': fulfillment,
            }
            if fields.get('druzhba_date'):
                answer['checkout']['pickup'] = {
                    'mode': 'requested', 'date': fields['druzhba_date'],
                    'window': fields.get('druzhba_window', ''),
                    'status': 'Ожидает подтверждения',
                }
            else:
                answer['checkout']['pickup'] = {'mode': 'phone'}
            answer['checkout']['return'] = ({
                'mode': 'requested', 'date': fields['druzhba_return_date'],
                'window': fields.get('druzhba_return_window', ''),
                'status': 'Ожидает подтверждения менеджером',
            } if fields.get('druzhba_return_date') else {'mode': 'phone'})
        return answer

    def get_lead(self, id_, access):
        with self.db.read() as con:
            row=con.execute('SELECT * FROM leads WHERE id=?',(id_,)).fetchone()
        if not row or not isinstance(access,str) or not hmac.compare_digest(row['access'],access):
            raise Problem(404,'Заказ не найден')
        return row

    def methods(self, row):
        suffix='?'+urlencode({'hash':row['access']})
        action=f'{PROJECT}/payment/{row["id"]}'
        methods=[]
        if self.bank.active and row['state'] == 'awaiting_payment':
            methods.append({'kind':'provider','type':'bank_card','url':action+'/tbank/'+suffix})
        selected_method = next((field['value'] for field in json.loads(row['fields']) if field['id'] == 'druzhba_payment'), None)
        if selected_method != checkout.PAYMENT_LABELS['online']:
            methods.append({'kind':'custom','instance_id':1,'type':'cash','title':'Оплата наличными',
                            'url':action+'/cash/'+suffix,'action':{'type':'description','text':self.settings['payments']['cash']['instructions']}})
        return {'payment':{'id':row['id'],'amount':row['amount']/100,'status':2 if row['state']=='paid' else 0},'methods':methods}

    def cash(self,row):
        with self.db.write() as con:
            if con.execute('SELECT 1 FROM attempts WHERE lead_id=?',(row['id'],)).fetchone():
                raise Problem(409,'Сначала проверьте предыдущую попытку онлайн-оплаты')
            con.execute("UPDATE leads SET state='cash' WHERE id=? AND state='awaiting_payment'",(row['id'],))
        return {'success':True}


class HTTP(SimpleHTTPRequestHandler):
    # Bind to loopback and put a trusted HTTPS reverse proxy in front in production.
    server_version='Druzhba'
    protocol_version='HTTP/1.1'

    def log_request(self, code='-', size='-'):
        # URLs can include a private order-access token.
        pass

    def log_error(self, format, *args):
        # In a malformed request, the server's parser can include part of the body in args.
        pass

    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
        if self.close_connection:
            self.send_header('Connection','close')
        super().end_headers()

    def output(self, status, data, mime='application/json; charset=utf-8'):
        payload=data.encode() if isinstance(data,str) else encoded(data).encode()
        self.send_response(status)
        self.send_header('Content-Type',mime)
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(payload)))
        self.end_headers()
        if self.command!='HEAD':
            self.wfile.write(payload)

    def body(self):
        if self.headers.get_content_type()!='application/json':
            raise Problem(415,'Ожидается JSON')
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 1<=length<=256_000:
                raise Problem(413,'Неверный размер запроса')
            data=json.loads(self.rfile.read(length))
            if not isinstance(data,dict):
                raise ValueError
            return data
        except (ValueError,UnicodeError):
            raise Problem(400,'Некорректный запрос') from None

    def peer(self):
        if self.server.site.live_origin and self.client_address[0] in ('127.0.0.1','::1'):
            return self.headers.get('X-Real-IP',self.client_address[0])[:100]
        return self.client_address[0]

    def same_origin(self):
        origin=self.headers.get('Origin')
        configured=self.server.site.live_origin
        expected=configured or 'http://'+self.headers.get('Host','')
        if origin != expected:
            raise Problem(403,'Недопустимый источник запроса')

    def safely(self, action):
        try:
            action()
        except Problem as e:
            if self.command=='POST':
                self.close_connection=True
            self.output(e.status,{'message':e.message,**e.extra})
        except (BrokenPipeError,ConnectionResetError):
            pass
        except Exception as e:
            if self.command=='POST':
                self.close_connection=True
            print(f'HTTP {self.command}: {type(e).__name__}',flush=True)
            self.output(500,{'message':'Внутренняя ошибка. Попробуйте позже.'})

    def do_POST(self):
        self.safely(self.post)

    def post(self):
        uri=urlsplit(self.path)
        path=uri.path.rstrip('/')
        site=self.server.site
        if path=='/payments/tbank/notify':
            site.payments.accept(self.body())
            return self.output(200,'OK','text/plain; charset=utf-8')
        self.same_origin()
        if path==PROJECT+'/lead/send':
            return self.output(200,site.submit(self.body(),self.peer()))
        match=re.fullmatch(re.escape(PROJECT)+r'/payment/(\d{1,15})/(cash|tbank)',path)
        if match:
            if self.headers.get('Content-Length') not in (None,'','0'):
                self.close_connection=True
            id_,method=match.groups()
            row=site.get_lead(int(id_),parse_qs(uri.query).get('hash',[''])[0])
            result=site.cash(row) if method=='cash' else {'redirect_url':site.payments.start(row)}
            return self.output(200,result)
        self.close_connection=True
        raise Problem(404,'Обработчик не найден')

    def do_GET(self):
        self.safely(self.get)

    def do_HEAD(self):
        self.safely(self.get)

    def get(self):
        u=urlsplit(self.path)
        pathname=u.path.removeprefix(PREFIX) if u.path.startswith(PREFIX+'/') else u.path
        path=pathname.rstrip('/') or '/'
        query=parse_qs(u.query)
        site=self.server.site
        match=re.fullmatch(re.escape(PROJECT)+r'/payment/(\d{1,15})/(methods|status)',path)
        if match:
            id_,op=match.groups()
            lead=site.get_lead(int(id_),query.get('hash',[''])[0])
            if op=='methods':
                return self.output(200,site.methods(lead))
            return self.output(200,{'state':lead['state'],'amount':lead['amount']})
        if path=='/api/promotions/get_list':
            return self.output(200,[])
        if path=='/api/promotions/get_promocode':
            return self.output(200,{'error':'PROMOTION_NOT_ACTIVE'})
        if path in ('/api/ecommerce/products','/api/ecommerce/data'):
            cat=site.config['catalog']['categories']
            selected=query.get('categoryId',[])+query.get('categoryIds[]',[])+query.get('categoryIds',[])
            requested=query.get('productIds[]',[])+query.get('productIds',[])
            ids={int(x) for x in requested if x.isdigit()}
            visible=[p for p in site.catalog if p.get('visible') and (not ids or p['id'] in ids)]
            if selected:
                visible=[p for p in visible if any(str(c['id']) in selected for c in p['categories'])]
            offset=int(query.get('page',['1'])[0]) if query.get('page',['1'])[0].isdigit() else 1
            limit=int(query.get('limit',['0'])[0]) if query.get('limit',['0'])[0].isdigit() else 0
            if limit:
                visible=visible[max(0,offset-1)*limit:max(1,offset)*limit]
            return self.output(200,visible if path.endswith('/products') else {'categories':cat,'products':visible})
        if path=='/_s/druzhba-server.js':
            return self.output(200,(ROOT/'browser.js').read_text(),'text/javascript; charset=utf-8')
        if path=='/_s/druzhba-checkout.js':
            return self.output(200,(ROOT/'selector.js').read_text(),'text/javascript; charset=utf-8')
        if path=='/_s/druzhba-checkout.css':
            return self.output(200,(ROOT/'checkout.css').read_text(),'text/css; charset=utf-8')
        if path=='/api/order/catalog':
            return self.output(200,checkout.catalog_options(site))
        if path=='/healthz':
            with site.db.read() as con:
                con.execute('SELECT 1')
            return self.output(200,{'ok':True})
        return self.static(pathname)

    def static(self, pathname):
        site=self.server.site
        root=self.server.www
        route=page_route(pathname)
        found=next((r for r in site.settings['seo']['redirects'] if r['source'].rstrip('/')==route),None)
        if found:
            destination=found['destination']
            if pathname.startswith(PREFIX+'/'):
                destination=PREFIX+destination
            query=urlsplit(self.path).query
            if query:
                destination+='?'+query
            self.send_response(301)
            self.send_header('Location',destination)
            self.send_header('Content-Length','0')
            self.end_headers()
            return
        try:
            target=(root/unquote(pathname).lstrip('/')).resolve()
        except (OSError,ValueError):
            raise Problem(404,'Страница не найдена') from None
        if not target.is_relative_to(root) or any(x.startswith('.') for x in target.relative_to(root).parts):
            raise Problem(404,'Страница не найдена')
        if target.is_dir():
            target=target/'index.html'
        if not target.is_file():
            raise Problem(404,'Страница не найдена')
        mime=self.guess_type(str(target))
        if target.suffix=='.html':
            markup=target.read_text().replace(PREFIX+'/','/')
            if site.captcha_key:
                markup=re.sub(r'("RECAPTCHA_INVISIBLE_SITE_KEY":")[^"]+', lambda m: m[1]+site.captcha_key, markup)
            version=hashlib.sha256(b''.join((ROOT/name).read_bytes() for name in ('browser.js','checkout.css','selector.js'))).hexdigest()[:12]
            add=(f'<script src="/_s/druzhba-server.js?v={version}"></script>'
                 f'<link rel="stylesheet" href="/_s/druzhba-checkout.css?v={version}">'
                 f'<script defer src="/_s/druzhba-checkout.js?v={version}"></script>')
            return self.output(200,markup.replace('</head>',add+'</head>',1),'text/html; charset=utf-8')
        if target.suffix in ('.js','.mjs','.css'):
            source=target.read_text().replace(PREFIX+'/','/')
            if target.suffix!='.css':
                add='window.DruzhbaForms.prepare(this,i);'
                anchor='i.jsform=448312'
                if anchor in source:
                    source=source.replace(anchor,add+anchor)
                    source=re.sub(r'((?:await )?this\.showDone\(i,([a-z]+)\))',
                                  r'(window.DruzhbaForms.done(this,i,\2),\1)', source)
                    source=source.replace('async sendForm(t=!1){',
                                          'async sendForm(t=!1){if(!window.DruzhbaForms.valid(this))return!1;')
                    source=source.replace('async sendFormError(t){',
                                          'async sendFormError(t){window.DruzhbaForms.error(this,t);')
                if source.count('/lead/send')>1:
                    source=re.sub(r'data:JSON\.stringify\((\w+\(i\))\)',
                                  r'data:JSON.stringify(window.DruzhbaForms.quiz(this,\1))',source)
                if '/lead/send' in source and not site.captcha_secret:
                    # Development without a site key for localhost. A public service requires both keys.
                    source=re.sub(r'(async initCaptcha\([^)]*\)\{)', r'\1return;', source)
                if site.captcha_key:
                    source=re.sub(r'6L[\w-]{38}',site.captcha_key,source)
                return self.output(200,source,'text/javascript; charset=utf-8')
            return self.output(200,source,mime+'; charset=utf-8')
        self.send_response(200)
        self.send_header('Content-Type',mime)
        self.send_header('Content-Length',str(target.stat().st_size))
        self.end_headers()
        if self.command!='HEAD':
            with target.open('rb') as stream:
                self.copyfile(stream,self.wfile)


def worker(site, stopped):
    while not stopped.is_set():
        try:
            site.payments.reconcile()
            deliver_notifications(site.db)
        except Exception as e:
            print(f'Фоновая обработка: {type(e).__name__}',flush=True)
        stopped.wait(12)


def configured_channels():
    channels={}
    if os.getenv('SMTP_HOST') and os.getenv('SMTP_USER') and os.getenv('SMTP_PASSWORD'):
        channels['email']=email_notification
    if os.getenv('BOT_TOKEN') and os.getenv('TELEGRAM_CHAT_ID'):
        channels['telegram']=telegram_notification
    routing=crm.settings()
    if routing[0]!='off':
        channels['crm']=lambda row: crm.deliver(row,notification(row)[1],routing)
    return channels


def notification(row):
    labels={
        'new_lead':'Новая заявка','new_order':'Новый заказ','payment_confirmed':'Оплата подтверждена',
        'refunded':'Возврат подтверждён','partial_refunded':'Частичный возврат',
    }
    message=[f'{labels[row["event"]]} №{row["id"]}',row['form_name'],row['path']]
    if row['amount']:
        message.append(f'Сумма заказа: {row["amount"]/100:.2f} ₽')
    message.extend(f'{field["name"]}: {field["value"]}' for field in json.loads(row['fields']))
    message.extend(f'{item["name"]} × {item["count"]}' for item in json.loads(row['items']))
    message.extend(f'{k}: {v}' for k,v in json.loads(row['tracking']).items() if v)
    return message[0],'\n'.join(message)


def email_notification(row):
    subject, body=notification(row)
    msg=EmailMessage()
    msg['From']=os.getenv('SMTP_FROM') or os.environ['SMTP_USER']
    msg['To']=os.getenv('SMTP_TO','kbo-ekb@mail.ru')
    msg['Subject']=subject
    msg.set_content(body)
    host=os.environ['SMTP_HOST']
    ctx=ssl.create_default_context()
    mode=os.getenv('SMTP_TLS','ssl')
    if mode not in ('ssl','starttls'):
        raise RuntimeError('SMTP_TLS: ssl или starttls')
    port=int(os.getenv('SMTP_PORT','465' if mode=='ssl' else '587'))
    connection=smtplib.SMTP_SSL(host,port,timeout=10,context=ctx) if mode=='ssl' else smtplib.SMTP(host,port,timeout=10)
    with connection as smtp:
        if mode=='starttls':
            smtp.starttls(context=ctx)
        smtp.login(os.environ['SMTP_USER'],os.environ['SMTP_PASSWORD'])
        smtp.send_message(msg)


def telegram_notification(row):
    _, message=notification(row)
    endpoint='https://api.telegram.org/bot'+os.environ['BOT_TOKEN']+'/sendMessage'
    data={'chat_id':os.environ['TELEGRAM_CHAT_ID'],'text':message[:4096]}
    topic=os.getenv('TELEGRAM_THREAD_ID')
    if topic:
        data['message_thread_id']=int(topic)
    req=Request(endpoint,encoded(data).encode(),{'Content-Type':'application/json'})
    with urlopen(req,timeout=10) as res:
        if not json.load(res).get('ok'):
            raise RuntimeError('Telegram не принял уведомление')


def deliver_notifications(db):
    for name, deliver in configured_channels().items():
        for _ in range(10):
            with db.write() as con:
                row=con.execute("""SELECT leads.*, outbox.event, outbox.attempts FROM outbox
                    JOIN leads ON leads.id=outbox.lead_id WHERE outbox.channel=? AND outbox.state='pending'
                    AND outbox.next_run<=? ORDER BY outbox.next_run, leads.id LIMIT 1""",
                    (name,time.time())).fetchone()
                if not row:
                    break
                key=(row['id'],row['event'],name)
                con.execute('UPDATE outbox SET next_run=?,state=? WHERE lead_id=? AND event=? AND channel=?',
                            (time.time()+90,'sending' if name=='crm' else 'pending',*key))
            try:
                deliver(row)
                status='sent'
                delay=0
            except crm.UncertainDelivery:
                status='uncertain'
                delay=0
            except Exception:
                status='pending'
                delay=min(3600,30*2**min(row['attempts'],7))
            with db.write() as con:
                con.execute('UPDATE outbox SET state=?,next_run=?,attempts=attempts+1 WHERE lead_id=? AND event=? AND channel=?',
                            (status,time.time()+delay,*key))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8080)
    parser.add_argument('--www',type=Path,default=ROOT.parent/'druzhba-dry-cleaning')
    parser.add_argument('--db',type=Path,default=ROOT/'private'/'orders.sqlite3')
    args=parser.parse_args()
    if not (args.www/'index.html').is_file():
        parser.error('В папке --www не найден index.html')
    settings=json.loads((ROOT/'config.json').read_text())['settings']
    site=Site(ROOT/'config.json',Database(args.db),Bank(settings))
    configured_channels()
    with site.db.write() as con:
        con.execute("UPDATE outbox SET state='uncertain' WHERE channel='crm' AND state='sending'")
    stopped=threading.Event()
    with ThreadingHTTPServer(('127.0.0.1',args.port),HTTP) as server:
        server.site=site
        server.www=args.www.resolve()
        thread=threading.Thread(target=worker,args=(site,stopped),daemon=True)
        thread.start()
        print(f'Дружба • http://127.0.0.1:{server.server_port}/ • Т-Касса: {site.bank.mode}',flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            stopped.set()
            thread.join(timeout=2)


if __name__=='__main__':
    main()
