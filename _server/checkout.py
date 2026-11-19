"""Validation and pricing for the optional extended checkout."""
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo
import re

from payment import Problem

TIMEZONE = ZoneInfo('Asia/Yekaterinburg')
CARPET_CATEGORIES = {977601, 352553}
PICKUP_WINDOWS = {
    'any': 'С 10:00 до 20:00',
    'morning': 'С 10:00 до 13:00',
    'afternoon': 'С 13:00 до 16:00',
    'late': 'С 16:00 до 19:00',
    'evening': 'С 17:00 до 20:00',
}
PAYMENT_LABELS = {
    'online': 'Онлайн через Т-Банк',
    'cash': 'Наличными курьеру',
    'manager': 'Согласовать с менеджером',
}


def is_carpet(product):
    return any(category['id'] in CARPET_CATEGORIES for category in product['categories'])


def price_details(product, variant):
    vendor = (variant.get('vendor_code') or '').lower().strip()
    if is_carpet(product):
        return {'prefix': 'от', 'unit': 'м²', 'reason': 'measure'}
    if 'кг' in vendor:
        return {'prefix': 'от', 'unit': 'кг', 'reason': 'weight'}
    if vendor == 'от':
        return {'prefix': 'от', 'unit': '', 'reason': 'inspection'}
    return {'prefix': '', 'unit': '', 'reason': None}


def custom_estimate(title):
    value = title.lower().replace('ё', 'е')
    if re.search(r'\b(?:ковер|ковры|ковра|ковров|ковролин)\b', value):
        return 'measure'
    if 'за кг' in value or 'за килограмм' in value:
        return 'weight'
    return None


def dimensions(raw):
    if raw is None:
        return None
    if not isinstance(raw, dict) or set(raw) != {'length', 'width'}:
        raise Problem(422, 'Укажите длину и ширину ковра в метрах')
    result = {}
    for key, maximum in (('length', 30), ('width', 15)):
        value = str(raw[key]).replace(',', '.')
        if not re.fullmatch(r'\d{1,2}(?:\.\d{1,2})?', value):
            raise Problem(422, 'Размер ковра укажите числом, например 2,5')
        number = Decimal(value)
        if not Decimal('0.1') <= number <= maximum:
            raise Problem(422, 'Проверьте размеры ковра')
        result[key] = number
    return result


def measured_price(rate, measured):
    if measured is None:
        return rate
    area = measured['length'] * measured['width']
    return int((Decimal(rate) * area).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def requested_time(raw, title):
    date_text = raw.get('date')
    try:
        if not isinstance(date_text, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date_text):
            raise ValueError
        requested = datetime.strptime(date_text, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        raise Problem(422, f'Выберите желаемую дату {title}') from None
    now = datetime.now(TIMEZONE)
    if not now.date() <= requested <= now.date() + timedelta(days=90):
        raise Problem(422, 'Выберите дату в ближайшие 90 дней')
    window = raw.get('window')
    if not isinstance(window, str) or window not in PICKUP_WINDOWS:
        raise Problem(422, f'Выберите удобное время {title}')
    if requested == now.date():
        end_hour = {'morning': 13, 'afternoon': 16, 'late': 19, 'evening': 20, 'any': 20}[window]
        if now.hour >= end_hour:
            raise Problem(422, 'Этот промежуток сегодня уже прошёл. Выберите другое время или дату.')
    return date_text, window


def optional_text(raw, key, maximum, label):
    value = raw.get(key, '')
    if not isinstance(value, str) or len(value.strip()) > maximum:
        raise Problem(422, f'Проверьте поле «{label}»')
    return value.strip()


def checkout_fields(raw):
    if not isinstance(raw, dict):
        raise Problem(422, 'Проверьте параметры оформления заказа')
    method = raw.get('payment')
    if not isinstance(method, str) or method not in PAYMENT_LABELS:
        raise Problem(422, 'Выберите способ оплаты')
    pickup = raw.get('pickup')
    if not isinstance(pickup, dict) or pickup.get('mode') not in ('phone', 'requested'):
        raise Problem(422, 'Выберите, как согласовать вывоз вещей')
    fields = [field('druzhba_payment', 'Способ оплаты', PAYMENT_LABELS[method])]
    address = optional_text(pickup, 'address', 500, 'Адрес')
    if address:
        # Keep the original label: persisted field labels participate in the idempotency hash.
        fields.append(field('druzhba_address', 'Адрес вывоза', address))
    details = raw.get('address_details', {})
    if not isinstance(details, dict) or type(details.get('meet_outside', False)) is not bool:
        raise Problem(422, 'Проверьте детали адреса')
    if details.get('meet_outside'):
        fields.append(field('druzhba_meet_outside', 'Встреча курьера', 'Встречу курьера на улице'))
    else:
        for key, label in [('apartment', 'Квартира / офис'), ('entrance', 'Подъезд'),
                           ('floor', 'Этаж'), ('intercom', 'Домофон')]:
            value = optional_text(details, key, 80, label)
            if value:
                fields.append(field('druzhba_' + key, label, value))
    comment = optional_text(raw, 'comment', 1000, 'Комментарий к заказу / проходу')
    if comment:
        fields.append(field('druzhba_comment', 'Комментарий к заказу / проходу', comment))
    pickup_date = None
    if pickup['mode'] == 'phone':
        fields.append(field('druzhba_pickup', 'Вывоз вещей', 'Согласовать по телефону'))
    else:
        if len(address) < 5:
            raise Problem(422, 'Укажите адрес вывоза вещей')
        pickup_date, window = requested_time(pickup, 'вывоза')
        fields.extend([
            field('druzhba_date', 'Желаемая дата вывоза', pickup_date),
            field('druzhba_window', 'Желаемое время вывоза', PICKUP_WINDOWS[window]),
            field('druzhba_pickup', 'Подтверждение вывоза', 'Менеджер подтвердит время вывоза'),
        ])
    returns = raw.get('return', {'mode': 'phone'})
    if not isinstance(returns, dict) or returns.get('mode') not in ('phone', 'requested'):
        raise Problem(422, 'Выберите, как согласовать возврат вещей')
    if returns['mode'] == 'requested':
        date_text, window = requested_time(returns, 'возврата')
        if pickup_date and date_text < pickup_date:
            raise Problem(422, 'Дата возврата не может быть раньше даты вывоза')
        fields.extend([
            field('druzhba_return_date', 'Желаемая дата возврата', date_text),
            field('druzhba_return_window', 'Желаемое время возврата', PICKUP_WINDOWS[window]),
            field('druzhba_return', 'Подтверждение возврата', 'Менеджер подтвердит дату и время возврата'),
        ])
    elif 'return' in raw:
        fields.append(field('druzhba_return', 'Возврат вещей', 'Согласовать с менеджером'))
    return fields, method


def field(id_, name, value):
    return {'id': id_, 'type': 'text', 'name': name, 'value': value}


def catalog_options(site):
    def image_url(images):
        return '/img/{}.{}'.format(images[0]['id'], images[0]['ext']) if images else None

    categories = site.config['catalog']['categories']
    products = []
    for product in site.catalog:
        if not product.get('visible') or not product.get('available', True):
            continue
        variants = [
            {'id': variant['id'], 'name': ', '.join(variant['name']), 'price': variant['price'],
             'quantity': variant.get('quantity'),
             'image': image_url(variant.get('images') or product.get('images')),
             **price_details(product, variant)}
            for variant in product['variants']
            if variant.get('visible') and variant.get('price') is not None and variant.get('quantity') != 0
        ]
        if not variants:
            continue
        images = product.get('images') or []
        image = image_url(images) or next((variant['image'] for variant in variants if variant['image']), None)
        products.append({
            'id': product['id'], 'name': product['name'], 'variants': variants,
            'categories': [category['id'] for category in product['categories']],
            'carpet': is_carpet(product), 'image': image,
        })
    used = {id_ for product in products for id_ in product['categories']}
    # The old catalogue also has a duplicate "Ковры" category.
    public_categories = [
        {'id': category['id'], 'name': category['name']}
        for category in categories if category['id'] in used and category['id'] != 352553
    ]
    today = datetime.now(TIMEZONE).date()
    return {
        'products': products, 'categories': public_categories,
        'onlineAvailable': site.bank.active, 'today': today.isoformat(),
        'maxDate': (today + timedelta(days=90)).isoformat(),
        'windows': PICKUP_WINDOWS,
    }
