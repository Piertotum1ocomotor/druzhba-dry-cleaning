"""T-Kassa protocol, payment state transitions, and reconciliation."""
import hashlib
import hmac
import ipaddress
import json
import os
import re
import secrets
import time
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


BANK_HTTP = build_opener(NoRedirect())

# Only these statuses allow another attempt. A stalled or unknown attempt is reconciled first.
RETRYABLE = {'REJECTED', 'CANCELED', 'DEADLINE_EXPIRED'}
REFUNDS = {'REFUNDED', 'PARTIAL_REFUNDED'}
PROGRESS = {s: i for i, s in enumerate((
    'NEW', 'FORM_SHOWED', 'AUTHORIZING', '3DS_CHECKING', '3DS_CHECKED',
    'AUTH_FAIL', 'AUTHORIZED', 'CONFIRMING', 'CONFIRMED',
))}
BANKS = {
    'test': 'https://rest-api-test.tinkoff.ru',
    'production': 'https://securepay.tinkoff.ru',
}

class Problem(Exception):
    def __init__(self, status, message, **extra):
        self.status = status
        self.message = message
        self.extra = extra


def token(params, password):
    fields = {
        k: v for k, v in params.items()
        if k not in {'Token', 'Password'} and isinstance(v, (str, bool, int))
    }
    fields['Password'] = password
    values = (str(v).lower() if isinstance(v, bool) else str(v)
              for _, v in sorted(fields.items()))
    return hashlib.sha256(''.join(values).encode()).hexdigest()


def https_origin(url):
    u = urlsplit(url)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.path not in ('', '/') or u.query or u.fragment:
        raise RuntimeError('PUBLIC_ORIGIN: укажите HTTPS-адрес без пути')
    try:
        host = ipaddress.ip_address(u.hostname)
    except ValueError:
        return url.rstrip('/')
    if not host.is_global:
        raise RuntimeError('PUBLIC_ORIGIN: требуется доступный банку HTTPS-адрес')
    return url.rstrip('/')


class Bank:
    def __init__(self, settings):
        self.mode = os.getenv('TBANK_MODE', 'off')
        if self.mode not in (*BANKS, 'off'):
            raise RuntimeError('TBANK_MODE: off, test или production')
        self.active = self.mode != 'off'
        self.origin = ''
        self.key = ''
        self.password = ''
        self.bearer = ''
        self.pay_type = ''
        if not self.active:
            return
        if self.mode == 'production' and os.getenv('TBANK_PRODUCTION_READY') != '1':
            raise RuntimeError('Перед рабочим режимом проверьте тестовый терминал, режим списания и чеки')
        cfg = settings['payments']['tbank']
        key_name = 'testTerminalKey' if self.mode == 'test' else 'terminalKey'
        self.key = os.getenv('TBANK_TERMINAL_KEY') or cfg[key_name]
        self.password = os.environ['TBANK_PASSWORD']
        if not self.password or (self.key.upper().endswith('DEMO') != (self.mode == 'test')):
            raise RuntimeError('Проверьте режим, номер и пароль терминала Т-Кассы')
        self.origin = https_origin(os.environ['PUBLIC_ORIGIN'])
        self.pay_type = os.getenv('TBANK_PAY_TYPE', '')
        if self.pay_type not in ('', 'O'):
            raise RuntimeError('Реализовано одностадийное списание. Двухстадийный режим требует отдельной настройки.')
        self.bearer = os.getenv('TBANK_API_BEARER', '')

    def request(self, operation, payload):
        payload = {'TerminalKey': self.key, **payload}
        payload['Token'] = token(payload, self.password)
        headers = {'Content-Type': 'application/json'}
        if self.bearer:
            headers['Authorization'] = 'Bearer ' + self.bearer
        req = Request(BANKS[self.mode] + '/v2/' + operation, json.dumps(payload).encode(), headers)
        with BANK_HTTP.open(req, timeout=8) as response:
            result = json.loads(response.read(512_000))
        if not isinstance(result, dict) or result.get('Success') is not True:
            raise RuntimeError('Т-Касса не подтвердила запрос')
        return result

    def init(self, order_id, amount):
        payload = {
            'OrderId': order_id,
            'Amount': amount,
            'Description': 'Оплата заказа химчистки «Дружба»',
            'NotificationURL': self.origin + '/payments/tbank/notify',
            'SuccessURL': self.origin + '/',
            'DATA': {'OperationInitiatorType': '0'},
        }
        if self.pay_type:
            payload['PayType'] = self.pay_type
        return self.request('Init', payload)

    def get_state(self, payment_id):
        return self.request('GetState', {'PaymentId': payment_id})

    def check_order(self, order_id):
        return self.request('CheckOrder', {'OrderId': order_id})


def bank_id(value):
    if type(value) not in (str, int) or not re.fullmatch(r'[0-9]{1,20}', str(value)):
        raise Problem(409, 'Не удалось сопоставить номер платежа')
    return str(value)


def payment_url(value):
    if not isinstance(value, str) or any(ord(c) < 33 for c in value):
        raise Problem(503, 'Т-Касса не вернула ссылку на оплату')
    u = urlsplit(value)
    if (u.scheme != 'https' or u.hostname not in {
        'securepayments.tinkoff.ru', 'securepay.tinkoff.ru',
        'securepayments.tbank.ru', 'securepay.tbank.ru',
        'rest-api-test.tinkoff.ru',
    } or u.username or u.password or u.port not in (None, 443)):
        raise Problem(503, 'Т-Касса вернула неожиданный адрес оплаты')
    return value


class Payments:
    def __init__(self, db, bank):
        self.db = db
        self.bank = bank

    def start(self, lead):
        if not self.bank.active:
            raise Problem(503, 'Онлайн-оплата пока недоступна')
        if lead['state'] == 'paid':
            raise Problem(409, 'Заказ уже оплачен')
        with self.db.write() as con:
            state = con.execute('SELECT state FROM leads WHERE id=?', (lead['id'],)).fetchone()[0]
            if state != 'awaiting_payment':
                raise Problem(409, 'Заказ не ожидает онлайн-оплаты')
            prev = con.execute('SELECT * FROM attempts WHERE lead_id=? ORDER BY rowid DESC LIMIT 1',
                               (lead['id'],)).fetchone()
            if prev and prev['state'] not in RETRYABLE:
                if prev['url'] and prev['state'] in {'NEW', 'FORM_SHOWED'}:
                    return prev['url']
                raise Problem(409, 'Проверяем предыдущую попытку оплаты. Повторите позже.')
            order_id = 'dz-' + secrets.token_hex(16)
            con.execute('INSERT INTO attempts(order_id, lead_id, amount, state, updated, next_check) VALUES (?,?,?,?,?,?)',
                        (order_id, lead['id'], lead['amount'], 'INIT_PENDING', time.time(), time.time() + 35))

        try:
            result = self.bank.init(order_id, lead['amount'])
            if (str(result.get('OrderId')) != order_id or str(result.get('TerminalKey')) != self.bank.key
                    or str(result.get('Amount')) != str(lead['amount'])):
                raise Problem(409, 'Ответ Т-Кассы не совпал с заказом')
            pid = bank_id(result.get('PaymentId'))
            url = payment_url(result.get('PaymentURL'))
            self.apply({**result, 'PaymentId': pid}, url=url)
            return url
        except Exception:
            with self.db.write() as con:
                con.execute("UPDATE attempts SET state='INIT_UNKNOWN', next_check=? WHERE order_id=? AND state='INIT_PENDING'",
                            (time.time(), order_id))
            raise Problem(503, 'Ответ Т-Кассы задерживается. Проверяем попытку оплаты.') from None

    def accept(self, body):
        provided = body.get('Token')
        if (not self.bank.active or not isinstance(provided, str)
                or not re.fullmatch(r'[0-9a-f]{64}', provided)
                or not hmac.compare_digest(provided, token(body, self.bank.password))):
            raise Problem(403, 'Неверная подпись Т-Кассы')
        self.apply(body)

    def apply(self, body, url=None):
        order_id = body.get('OrderId')
        if (not isinstance(order_id, str) or not re.fullmatch(r'dz-[0-9a-f]{32}', order_id)
                or body.get('TerminalKey') != self.bank.key):
            raise Problem(409, 'Терминал или платёж не совпал')
        pid = bank_id(body.get('PaymentId'))
        status = body.get('Status')
        if not isinstance(status, str) or not re.fullmatch(r'[A-Z0-9_]{2,32}', status):
            raise Problem(409, 'Некорректный статус платежа')
        with self.db.write() as con:
            attempt = con.execute('SELECT * FROM attempts WHERE order_id=?', (order_id,)).fetchone()
            if not attempt or (attempt['payment_id'] and attempt['payment_id'] != pid):
                raise Problem(409, 'Платёж не совпал')
            if str(body.get('Amount')) != str(attempt['amount']):
                # Some refund responses can report the refund amount. Reconcile manually if ambiguous.
                con.execute('INSERT OR IGNORE INTO payment_alerts VALUES (?,?,?)',
                            (order_id, 'amount_mismatch', time.time()))
                con.commit()
                raise Problem(409, 'Сумма платежа не совпала')
            if status == 'CONFIRMED' and body.get('Success') is not True:
                raise Problem(409, 'Банк не подтвердил списание')
            if status not in RETRYABLE | REFUNDS | PROGRESS.keys() | {'REVERSING', 'REVERSED', 'PARTIAL_REVERSED'}:
                con.execute('INSERT OR IGNORE INTO payment_alerts VALUES (?,?,?)',
                            (order_id, 'unknown_status:' + status, time.time()))
                return
            con.execute('INSERT OR IGNORE INTO bank_events VALUES (?,?,?)', (order_id, status, time.time()))
            current = attempt['state']
            lead_id = attempt['lead_id']
            if (current == 'REFUNDED' or (current == 'PARTIAL_REFUNDED' and status != 'REFUNDED')
                    or (current == 'CONFIRMED' and status not in REFUNDS)):
                return
            if current in RETRYABLE and status not in REFUNDS | {'CONFIRMED'}:
                return
            if status in PROGRESS and PROGRESS[status] < PROGRESS.get(current, -1):
                return
            con.execute('UPDATE attempts SET state=?, payment_id=?, url=COALESCE(?,url), updated=? WHERE order_id=?',
                        (status, pid, url, time.time(), order_id))
            if status == 'CONFIRMED':
                previous = con.execute('SELECT paid_attempt FROM leads WHERE id=?', (lead_id,)).fetchone()[0]
                if previous and previous != order_id:
                    con.execute('INSERT OR IGNORE INTO payment_alerts VALUES (?,?,?)', (order_id, 'double_payment', time.time()))
                    return
                con.execute("UPDATE leads SET state='paid', paid_attempt=? WHERE id=?", (order_id, lead_id))
                self.db.enqueue(con, lead_id, 'payment_confirmed')
            if status in REFUNDS:
                con.execute('UPDATE leads SET state=? WHERE id=? AND paid_attempt=?',
                            (status.lower(), lead_id, order_id))
                self.db.enqueue(con, lead_id, status.lower())

    def reconcile(self):
        if not self.bank.active:
            return 0
        checked = 0
        for _ in range(40):
            with self.db.write() as con:
                a = con.execute("""SELECT * FROM attempts WHERE next_check<=? AND
                    state NOT IN ('CONFIRMED','REJECTED','CANCELED','DEADLINE_EXPIRED','REFUNDED','PARTIAL_REFUNDED','REVERSED','PARTIAL_REVERSED')
                    ORDER BY next_check LIMIT 1""", (time.time(),)).fetchone()
                if not a:
                    break
                delay = 60 if a['state'] == 'INIT_UNKNOWN' else 180
                con.execute('UPDATE attempts SET next_check=? WHERE order_id=?', (time.time() + delay, a['order_id']))
            try:
                if a['payment_id']:
                    result = self.bank.get_state(a['payment_id'])
                    self.apply({**result, 'OrderId': result.get('OrderId', a['order_id'])})
                else:
                    result = self.bank.check_order(a['order_id'])
                    if result.get('OrderId') != a['order_id'] or result.get('TerminalKey') != self.bank.key:
                        raise Problem(409, 'CheckOrder вернул другой заказ')
                    attempts = result.get('Payments', [])
                    if len(attempts) == 1:
                        self.apply({**result, **attempts[0]})
                    elif len(attempts) > 1:
                        with self.db.write() as con:
                            con.execute('INSERT OR IGNORE INTO payment_alerts VALUES (?,?,?)',
                                        (a['order_id'], 'multiple_bank_attempts', time.time()))
                checked += 1
            except Exception:
                with self.db.write() as con:
                    if time.time() - a['updated'] > 900:
                        con.execute('INSERT OR IGNORE INTO payment_alerts VALUES (?,?,?)',
                                    (a['order_id'], 'reconciliation_failed', time.time()))
        return checked
