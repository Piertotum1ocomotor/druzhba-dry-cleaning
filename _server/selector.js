(() => {
  'use strict';

  if (window.DruzhbaCheckout) return;

  const draftKey = 'druzhba_checkout_v1';
  const contactsKey = 'druzhba_checkout_contacts_v1';
  // Authoritative SKU migration for previously published custom buttons and stored carts.
  const legacyOffers = {"[\"Пуховик (на синтепоне)\",2400]":[1269070,3867855],"[\"Пуховик (с пуховым наполнителем)\",2400]":[1269070,3867855],"[\"Пуховик (с пуховым наполнителем)\",2600]":[1269070,3867855],"[\"Пальто\",2700]":[1269073,3867860],"[\"Шуба искусственная\",2600]":[1269074,3867861],"[\"Куртка тонкая (ветровка)\",1400]":[1269076,3867863],"[\"Рубашка (от 3 штук и более)\",400]":[3284679,10020251],"[\"Рубашка\",490]":[3284679,10018051],"[\"Пиджак\",800]":[3284695,10018091],"[\"Брюки\",750]":[3285013,10018983],"[\"Костюм\",1550]":[3285027,10019021],"[\"Свадебное платье\",3200]":[3285045,10019101],"[\"Свадебное платье\",4200]":[3285045,10019103],"[\"Кроссовки (кеды,   слипоны, сникерсы, и тд)\",2400]":[3283443,10014479],"[\"Угги\",1590]":[3285631,10020655],"[\"Ботинки\",2290]":[3285669,10020767],"[\"Туфли\",1590]":[3285683,10020807],"[\"Сапоги\",2590]":[3286707,10024247],"[\"Обувь\",1590]":[3286709,10024251],"[\"Постельное белье с ручной глажкой, кг\",390]":[3287381,10026183],"[\"Подушка пух-перо (с заменой наперника)\",950]":[3283449,10014485],"[\"Одеяло\",1300]":[3287365,10026143],"[\"Плед\",1100]":[3287401,10026277],"[\"Чехол мебельный (дивандек)\",2200]":[3288585,10029771],"[\"Подушка пух-перо (с заменой наперника)\",800]":[3283449,10014485],"[\"Подушка искусственная\",800]":[3283447,10014483],"[\"Диван 2х местный \",3500]":[3283445,10014481],"[\"Диван 2х местный\",4000]":[3283445,10024899],"[\"Диван угловой\",6000]":[3283445,10024901],"[\"Матрас\",2500]":[3287197,10025617],"[\"Кресло\",890]":[3287327,10026019],"[\"Стул\",390]":[3287327,10026017],"[\"Рубашка от 3 штук и более\",400]":[3284679,10020251],"[\"Жилет\",450]":[3285029,10019023],"[\"Вечернее платье\",1800]":[3285047,10019105],"[\"Платье\",1400]":[3285049,10019107],"[\"Костюм женский с юбкой\",1450]":[3285051,10019109],"[\"Юбка\",750]":[3285053,10019111],"[\"Джемпер\",850]":[3285055,10019113],"[\"Постельное белье, за кг\",450]":[3287381,10026183],"[\"Подушка искусственная\",950]":[3283447,10014483],"[\"Одеяло с натуральным наполнителем\",1300]":[3287365,10026143],"[\"Одеяло с искусственным наполнителем\",1100]":[3287365,10026141],"[\"Плед (любой размер)\",1100]":[3287401,10026277],"[\"Плед флисовый\",800]":[3287401,10026279],"[\"Наматрасник\",1500]":[3288583,10029767],"[\"Наматрасник\",1900]":[3288583,10029769],"[\"Чехол на кресло\",900]":[3288585,10029773],"[\"Шкурка из натурального меха\",1200]":[3288587,10029775],"[\"Игрушка мягкая \",500]":[3288589,10029777],"[\"Тюль\",200]":[3288795,10030303],"[\"Шторы\",320]":[3288809,10030341],"[\"Шторы двухслойные\",450]":[3288809,10030343],"[\"Шторы\",350]":[3288855,10030475],"[\"Пуховик (на синтепоне)\",2100]":[1269070,3867855],"[\"Пуховик (с пуховым наполнителем)\",2100]":[1269070,3867855],"[\"Шуба искусственная\",2400]":[1269074,3867861],"[\"Рубашка\",350]":[3284679,10018051],"[\"Пиджак\",790]":[3284695,10018091],"[\"Брюки\",720]":[3285013,10018983],"[\"Костюм\",1510]":[3285027,10019021],"[\"Свадебное платье\",2000]":[3285045,10019101],"[\"Свадебное платье\",2800]":[3285045,10019103],"[\"Кроссовки (кеды,   слипоны, сникерсы, и тд)\",1590]":[3283443,10014479],"[\"Постельное белье, кг\",325]":[3287381,10026183],"[\"Чехол мебельный (дивандек)\",1800]":[3288585,10029771],"[\"Подушка искусственная\",500]":[3283447,10014483],"[\"Диван 2х местный\",2090]":[3283445,10014481],"[\"Диван угловой\",3390]":[3283445,10024901],"[\"Матрас\",1490]":[3287197,10025617],"[\"Акция! При заказе 5 подушек - 1 бесплатно\",3800]":[3286883,10024789],"[\"Подушка 70х70см\",950]":[3283449,10014485],"[\"Подушка 50х70см\",950]":[3283449,10014485],"[\"Подушка 60х60см\",950]":[3283449,10014485],"[\"Подушка нестандартного размера\",950]":[3283449,10014485],"[\"Диван 2х местный\",3500]":[3283445,10014481],"[\"Игрушка мягкая\",500]":[3288589,10029777]};

  const money = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2});
  const initialDraft = {payment: 'cash', pickup: {mode: 'phone', address: '', date: '', window: 'any'},
    address_details: {apartment: '', entrance: '', floor: '', intercom: '', meet_outside: false},
    return: {mode: 'phone', date: '', window: 'any'}, comment: ''};
  const base = locationPath().startsWith('/druzhba-dry-cleaning/') ? '/druzhba-dry-cleaning' : '';
  const isCheckout = locationPath().replace(/\/$/, '') === base + '/checkout';
  const pagePath = locationPath().replace(base, '').replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
  const homeServiceCategories = {
    '816823': 977601, '864695': 409298, '231664': 409299,
    '243100564': 1005647, '343916': 1005639, '512205': 1005637, '512133': 1005641,
  };
  let requestedService = null;
  let requestedVariant = null;
  let cartLink;
  let reviewDialog;
  let reviewFocus;
  let suppressReviewFocus = false;
  let checkoutForm;
  let nativeForm;
  function locationPath() { return typeof location === 'undefined' ? '' : location.pathname; }
  function route(path) { return base + path; }
  function imagePath(value) {
    const url = typeof value === 'object' && value ? '/img/' + value.id + '.' + value.ext : String(value || '');
    return url.startsWith('/img/') ? route(url) : url;
  }
  let options;
  let selector;
  let activeCategory = '';
  let search = '';
  let returnFocus;
  let returnToCart = false;
  let draft = JSON.parse(JSON.stringify(initialDraft));

  try {
    const stored = sessionStorage.getItem(draftKey) || localStorage.getItem(draftKey);
    const saved = JSON.parse(stored);
    if (saved && saved.pickup && ['cash', 'online', 'manager'].includes(saved.payment)) {
      draft = {...initialDraft, ...saved, pickup: {...initialDraft.pickup, ...saved.pickup},
        address_details: {...initialDraft.address_details, ...saved.address_details}, return: {...initialDraft.return, ...saved.return}};
      if (draft.payment === 'online') draft.payment = 'cash';
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    }
    localStorage.removeItem(draftKey);
  } catch (_) {}

  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
  }

  function cartStore() {
    return window.flexbe_cli?.ecommerce?.cartStore;
  }

  function items() {
    return cartStore()?.getList() || [];
  }

  function productFor(item) {
    return options?.products.find(product => product.id === Number(item.productId || item.serverProductId));
  }

  function fulfillment() {
    const list = items().filter(item => item.count && !item.hidden);
    const visit = list.filter(item => productFor(item)?.fulfillment === 'visit');
    return visit.length ? (visit.length === list.length ? 'visit' : 'mixed') : 'pickup';
  }

  function imageForCartItem(item) {
    const normalize = value => String(value || '').toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
    const title = normalize(item.title);
    let product = productFor(item) || options.products.find(product => normalize(product.name) === title);
    if (!product) {
      const aliases = [
        [/^пуховик(?:\s|$)/u, 'Пуховик'],
        [/^шуба искусственная/u, 'Эко шуба'],
        [/^куртка тонкая/u, 'Куртка легкая'],
        [/^рубашка/u, 'Рубашка'],
        [/^костюм$/u, 'Костюм (пиджак + брюки)'],
        [/^кроссовки/u, 'Кроссовки, кеды, слипоны, сникерсы'],
        [/^угги/u, 'Угги, унты, валенки'],
        [/^ботинки/u, 'Ботинки, дезерты, тимберленды, челси'],
        [/^туфли/u, 'Туфли, босоножки, балетки, мокасины, топсайдеры'],
        [/^сапоги/u, 'Сапоги, ботильоны, луноходы, полусамоги и т.д'],
        [/^обувь$/u, 'Химчистка спортивной обуви от запахов'],
        [/^постельное белье/u, 'Постельное белье с глажкой'],
        [/^подушка.*замен/u, 'Подушка с заменой наперника'],
        [/^подушка/u, 'Подушка'],
        [/^диван/u, 'Диван'],
        [/^выдвижное спальное место/u, 'Выдвижное место'],
        [/^(?:кресло|стул)$/u, 'Стулья и кресла'],
      ];
      const alias = aliases.find(([pattern]) => pattern.test(title));
      if (alias) product = options.products.find(product => normalize(product.name) === normalize(alias[1]));
    }
    const variant = product?.variants.find(variant => variant.id === Number(item.serverVariantId || item.variantId))
      || product?.variants.find(variant => variant.name && title.includes(normalize(variant.name)));
    const match = (variant?.image || product?.image)?.match(/\/(\d+)\.([a-z]+)$/i);
    return match ? {id: match[1], ext: match[2]} : null;
  }

  function restoreCartImages() {
    let changed = false;
    const updated = items().map(item => {
      if (!item.productId && !item.serverProductId) {
        const mapped = (typeof legacyOffers === 'undefined' ? {} : legacyOffers)[JSON.stringify([item.title, item.price])];
        const product = mapped && options.products.find(product => product.id === mapped[0]);
        const variant = product?.variants.find(variant => variant.id === mapped[1]);
        if (variant) {
          item = {...item, serverProductId: product.id, serverVariantId: variant.id,
            title: product.name + (variant.name ? ' — ' + variant.name : ''), price: variant.price,
            druzhba_estimate: variant.reason, quantity: variant.quantity};
          changed = true;
        }
      }
      const knownProduct = productFor(item);
      const knownVariant = knownProduct?.variants.find(variant => variant.id === Number(item.serverVariantId || item.variantId));
      if (knownVariant) {
        const dimensions = item.druzhba_dimensions;
        const validDimensions = dimensions && Number.isFinite(Number(dimensions.length)) && Number(dimensions.length) > 0
          && Number.isFinite(Number(dimensions.width)) && Number(dimensions.width) > 0;
        // Native cards and the selector share an identity. A measured carpet never merges with an unknown size.
        if (!item.hidden && (!dimensions || validDimensions) && (!knownProduct.carpet || validDimensions)) {
          const suffix = knownProduct.carpet && dimensions ? Number(dimensions.length) + 'x' + Number(dimensions.width) : 'unit';
          const id = `druzhba_${knownProduct.id}_${knownVariant.id}_${suffix}`;
          if (item.id !== id || item.type !== 'custom' || !item.serverProductId || !item.serverVariantId || item.productId != null || item.variantId != null) {
            item = {...item, id, type: 'custom', serverProductId: knownProduct.id, serverVariantId: knownVariant.id,
              quantity: knownVariant.quantity, druzhba_estimate: knownVariant.reason};
            delete item.productId;
            delete item.variantId;
            changed = true;
          }
        }
        const price = knownProduct.carpet && dimensions
          ? measuredCents(knownVariant.price, dimensions) / 100 : knownVariant.price;
        if (Number.isFinite(price) && Number(item.price) !== price) {
          item = {...item, price, orderPrice: price};
          changed = true;
        }
      }
      // Native storage serializes its unlimited Infinity quantity as JSON null.
      // Restore only known native variants from the catalog, preserving finite stock and unknown items.
      if (item.type === 'product' && item.quantity == null) {
        const product = productFor(item);
        const variant = product?.variants.find(variant => variant.id === Number(item.variantId))
          || (product?.variants.length === 1 ? product.variants[0] : null);
        if (typeof variant?.quantity === 'number' && Number.isFinite(variant.quantity) && variant.quantity >= -1) {
          item = {...item, quantity: variant.quantity};
          changed = true;
        }
      }
      if (item.img) return item;
      const img = imageForCartItem(item);
      if (!img) return item;
      changed = true;
      return {...item, img};
    });
    const merged = [];
    const identities = new Map();
    for (const item of updated) {
      const product = productFor(item);
      const dimensions = item.druzhba_dimensions;
      const known = !item.hidden && product?.variants.some(variant => variant.id === Number(item.serverVariantId))
        && (!product.carpet || (Number(dimensions?.length) > 0 && Number(dimensions?.width) > 0
          && Number.isFinite(Number(dimensions?.length)) && Number.isFinite(Number(dimensions?.width))));
      const prior = known && identities.get(item.id);
      if (prior) {
        prior.count = Number(prior.count) + Number(item.count);
        changed = true;
      } else {
        const copy = {...item};
        merged.push(copy);
        if (known) identities.set(item.id, copy);
      }
    }
    if (changed) cartStore().dispatch('updateList', merged);
  }

  function estimateReason(item) {
    if (item.druzhba_estimate) return item.druzhba_estimate;
    const product = productFor(item);
    if (product) {
      const variant = product.variants.find(variant => variant.id === Number(item.variantId || item.serverVariantId));
      return variant?.reason || null;
    }
    const title = (item.title || '').toLowerCase().replaceAll('ё', 'е');
    if (/(?:^|\s)(?:ковер|ковры|ковра|ковров|ковролин)(?:\s|$|[,.(])/.test(title)) return 'measure';
    if (title.includes('за кг')) return 'weight';
    return null;
  }

  function provisional() {
    return items().some(item => estimateReason(item));
  }

  function unknownMeasure() {
    return items().some(item => item.count && !item.hidden && estimateReason(item) === 'measure' && !item.druzhba_dimensions);
  }

  function draftFrom(form) {
    const root = form.querySelector('.dr-checkout');
    if (!root) return null;
    const value = selector => root.querySelector(selector).value.trim();
    const visitOnly = fulfillment() === 'visit';
    return {
      payment: ['cash', 'manager'].includes(root.querySelector('[data-payment]:checked')?.value)
        ? root.querySelector('[data-payment]:checked').value : 'cash',
      pickup: {mode: root.querySelector('[data-pickup-requested]').checked ? 'requested' : 'phone',
        address: value('[data-pickup-address]'), date: value('[data-pickup-date]'), window: value('[data-pickup-window]')},
      address_details: {apartment: value('[data-apartment]'), entrance: value('[data-entrance]'),
        floor: value('[data-floor]'), intercom: value('[data-intercom]'), meet_outside: root.querySelector('[data-meet-outside]').checked},
      return: {mode: !visitOnly && root.querySelector('[data-return-requested]').checked ? 'requested' : 'phone',
        date: value('[data-return-date]'), window: value('[data-return-window]')},
      comment: value('[data-order-comment]'),
    };
  }

  function saveDraft(form) {
    const value = draftFrom(form);
    if (value) draft = value;
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch (_) {}
  }

  function contactControls(form) {
    return Array.from(form.querySelectorAll('.form-field[data-type="name"] input:not([type="hidden"]), .form-field[data-type="phone"] input:not([type="hidden"]), .form-field[data-type="email"] input:not([type="hidden"])'));
  }

  function saveContacts(form) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(contactsKey)) || {};
      for (const input of contactControls(form)) saved[input.closest('.form-field').dataset.type] = input.value;
      sessionStorage.setItem(contactsKey, JSON.stringify(saved));
    } catch (_) {}
  }

  function restoreContacts(form) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(contactsKey)) || {};
      for (const input of contactControls(form)) {
        const value = saved[input.closest('.form-field').dataset.type];
        if (!input.value && value) {
          input.value = value;
          input.dispatchEvent(new Event('input', {bubbles: true}));
          input.dispatchEvent(new Event('change', {bubbles: true}));
        }
      }
    } catch (_) {}
  }

  function applyDraft(form) {
    const panel = form.querySelector('.dr-checkout');
    panel.querySelector('[data-pickup-requested]').checked = draft.pickup.mode === 'requested';
    panel.querySelector('[data-return-requested]').checked = draft.return.mode === 'requested';
    panel.querySelector('[data-meet-outside]').checked = Boolean(draft.address_details.meet_outside);
    for (const [selector, value] of Object.entries({
      '[data-pickup-address]': draft.pickup.address, '[data-pickup-date]': draft.pickup.date,
      '[data-pickup-window]': draft.pickup.window, '[data-return-date]': draft.return.date,
      '[data-return-window]': draft.return.window, '[data-order-comment]': draft.comment,
      ...Object.fromEntries(['apartment', 'entrance', 'floor', 'intercom'].map(key => ['[data-' + key + ']', draft.address_details[key]])),
    })) panel.querySelector(selector).value = value || (selector.includes('window') ? 'any' : '');
    panel.querySelector('details').open = Boolean(draft.comment);
    for (const input of panel.querySelectorAll('[data-payment]')) input.checked = input.value === draft.payment;
    refreshForm(form);
  }

  function showError(form, message) {
    const error = form.querySelector('[data-checkout-error]');
    if (!error) return;
    error.textContent = message || '';
    error.hidden = !message;
    if (message) error.scrollIntoView({block: 'nearest'});
  }

  function refreshFulfillment(form) {
    const kind = fulfillment();
    const visit = kind === 'visit';
    const mixed = kind === 'mixed';
    const text = (selector, value) => { const node = form.querySelector(selector); if (node) node.textContent = value; };
    text('[data-address-help]', visit ? 'Мастер приедет по этому адресу и почистит мебель на месте.' : mixed ? 'По этому адресу мастер почистит мебель, а курьер заберёт остальные вещи. Время обоих визитов подтвердит менеджер.' : 'Заберём вещи и привезём их обратно по этому адресу.');
    text('[data-pickup-title]', visit ? 'Выезд мастера' : mixed ? 'Вывоз вещей и выезд мастера' : 'Когда забрать вещи');
    text('[data-pickup-help]', visit ? 'Без выбранной даты согласуем выезд мастера по телефону.' : mixed ? 'Укажите пожелание к дате. Выезд мастера и вывоз вещей согласуем отдельно по телефону.' : 'Без выбранной даты согласуем вывоз по телефону.');
    text('[data-meeting-label]', visit ? 'Встречу мастера на улице' : mixed ? 'Встречу мастера и курьера на улице' : 'Встречу курьера на улице');
    text('[data-cash-label]', visit ? 'Наличными мастеру' : mixed ? 'Наличными при оказании услуг' : 'Наличными курьеру');
    const returns = form.querySelector('[data-return-section]');
    if (returns) returns.hidden = visit;
    for (const input of form.querySelectorAll('[data-return-requested], [data-return-date], [data-return-window]')) if (visit) { input.disabled = true; input.required = false; }
    text('[data-delivery-label]', visit ? 'Выезд мастера' : mixed ? 'Выезд мастера и доставка' : 'Доставка');
    const deliveryHelp = form.querySelector('[data-delivery-help]');
    if (deliveryHelp) deliveryHelp.hidden = visit;
    text('[data-review-delivery]', visit ? 'Выезд мастера — согласуем с вами' : mixed ? 'Выезд мастера и доставка — согласуем отдельно' : 'Доставка — согласуем с вами');
  }

  function refreshForm(form) {
    const root = form.querySelector('.dr-checkout');
    if (!root || !options) return;
    const value = draftFrom(form);
    const requested = value.pickup.mode === 'requested';
    root.querySelector('[data-pickup-address]').required = requested;
    root.querySelector('[data-pickup-address]').minLength = requested ? 5 : 0;
    for (const kind of ['pickup', 'return']) {
      const selected = value[kind].mode === 'requested' && !(kind === 'return' && fulfillment() === 'visit');
      root.querySelector('[data-' + kind + '-date]').required = selected;
      for (const control of root.querySelectorAll('[data-' + kind + '-date], [data-' + kind + '-window]')) control.disabled = !selected;
    }
    root.querySelector('[data-return-date]').min = requested && value.pickup.date ? value.pickup.date : options.today;
    const outside = value.address_details.meet_outside;
    root.querySelector('[data-address-details]').hidden = outside;
    for (const input of root.querySelectorAll('[data-address-details] input')) input.disabled = outside;
    const buttonLabel = form.querySelector('.form-submit .form-button .btn-text');
    if (buttonLabel) buttonLabel.textContent = 'Отправить заказ';
    const returnRequested = root.querySelector('[data-return-requested]');
    returnRequested.disabled = fulfillment() === 'visit';
    refreshFulfillment(form);
    updateOrderCard();
  }

  function enhanceForm(form) {
    if (form.querySelector('.dr-checkout')) return;
    const panel = document.createElement('div');
    panel.className = 'dr-checkout';
    const windows = Object.entries(options.windows).map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('');
    const dates = kind => `<div class="dr-field-row dr-date-row">
      <label class="dr-field">Желаемая дата<input data-${kind}-date type="date" min="${options.today}" max="${options.maxDate}"></label>
      <label class="dr-field">Интервал времени<select data-${kind}-window>${windows}</select></label></div>`;
    panel.innerHTML = `
      <section class="dr-section"><h2>Адрес</h2><p class="dr-help" data-address-help>Заберём вещи и привезём их обратно по этому адресу.</p>
        <label class="dr-field">Улица и дом<input data-pickup-address type="text" autocomplete="street-address" maxlength="500" placeholder="Екатеринбург, улица, дом"></label>
        <div class="dr-address-details" data-address-details>
          ${[['apartment', 'Квартира / офис'], ['entrance', 'Подъезд'], ['floor', 'Этаж'], ['intercom', 'Домофон']].map(([key, label]) => `<label class="dr-field">${label}<input data-${key} type="text" maxlength="80" autocomplete="off"></label>`).join('')}
        </div>
        <label class="dr-check"><input data-meet-outside type="checkbox"><span data-meeting-label>Встречу курьера на улице</span></label>
        <details class="dr-comment"><summary>Добавить комментарий к заказу / проходу</summary>
          <label class="dr-field">Комментарий<textarea data-order-comment maxlength="1000" rows="3" placeholder="Например, как найти вход или что важно знать о вещах"></textarea></label>
        </details>
      </section>
      <section class="dr-section"><h2 data-pickup-title>Когда забрать вещи</h2>
        <label class="dr-check"><input data-pickup-requested type="checkbox"><span>Выбрать желаемые дату и время</span></label>
        ${dates('pickup')}<p class="dr-help" data-pickup-help>Без выбранной даты согласуем вывоз по телефону.</p>
      </section>
      <section class="dr-section" data-return-section><h2>Когда вернуть вещи</h2>
        <label class="dr-check"><input data-return-requested type="checkbox"><span>Указать пожелание по возврату</span></label>
        ${dates('return')}<p class="dr-help">По умолчанию дату возврата согласуем с менеджером.</p>
        <p class="dr-date-note">Мы свяжемся с вами и согласуем удобное время вывоза и доставки</p>
      </section>
      <section class="dr-section"><h2>Способ оплаты</h2>
        <label class="dr-radio"><input data-payment type="radio" value="cash"><span data-cash-label>Наличными курьеру</span></label>
        <label class="dr-radio"><input data-payment type="radio" value="manager"><span>Согласовать с менеджером</span></label>
      </section>
      <p class="dr-error" data-checkout-error role="alert" hidden></p>`;
    for (const input of panel.querySelectorAll('[data-payment]')) input.name = 'dr-payment';
    form.insertBefore(panel, form.querySelector('.form-submit'));
    applyDraft(form);
    restoreContacts(form);
    for (const event of ['input', 'change']) form.addEventListener(event, event => {
      if (contactControls(form).includes(event.target)) saveContacts(form);
      if (panel.contains(event.target)) {
        showError(form, '');
        saveDraft(form);
        refreshForm(form);
      }
    });
    // Native success resets the form; restore only after the confirmed success handler clears the draft.
    form.addEventListener('reset', () => setTimeout(() => { applyDraft(form); restoreContacts(form); }, 0));
    refreshForm(form);
  }

  function goCheckout() {
    if (checkoutForm) { saveDraft(checkoutForm); saveContacts(checkoutForm); }
    location.href = route('/checkout/');
  }

  function visibleItems() {
    return items().filter(item => item.count && !item.hidden);
  }

  function itemTitle(item) {
    const product = productFor(item);
    const variant = product?.variants.find(variant => variant.id === Number(item.serverVariantId || item.variantId));
    const title = String(item.title || product?.name || 'Услуга');
    return variant?.name && !title.toLowerCase().includes(variant.name.toLowerCase())
      ? title + ' — ' + variant.name : title;
  }

  function cartRows(list) {
    return list.map(item => `<li class="dr-order-item" data-item-id="${escape(item.id)}">
      ${item.img ? `<img src="${escape(imagePath(item.img))}" alt="" width="54" height="60">` : '<span class="dr-item-placeholder" aria-hidden="true"></span>'}
      <div class="dr-order-item-body"><strong>${escape(itemTitle(item))}</strong>${estimateReason(item) ? `<small>${estimateReason(item) === 'measure' && !item.druzhba_dimensions ? 'Тариф за м² · размер уточним' : 'Предварительная стоимость'}</small>` : ''}
        <div class="dr-item-controls"><div class="dr-quantity"><button type="button" data-count-change="-1" aria-label="Уменьшить количество: ${escape(itemTitle(item))}">−</button><span aria-label="Количество">${Number(item.count)}</span><button type="button" data-count-change="1" aria-label="Увеличить количество: ${escape(itemTitle(item))}" ${Number(item.count) >= itemLimit(item) ? 'disabled' : ''}>+</button></div>
        <span>${estimateReason(item) === 'measure' && !item.druzhba_dimensions ? money.format(Number(item.price)) + ' / м²' : money.format(Number(item.price) * Number(item.count))}</span></div><button class="dr-remove" type="button" data-remove-item aria-label="Удалить: ${escape(itemTitle(item))}">Удалить</button></div></li>`).join('');
  }

  function itemLimit(item) {
    const variant = productFor(item)?.variants.find(variant => variant.id === Number(item.serverVariantId || item.variantId));
    return typeof variant?.quantity === 'number' && variant.quantity >= 0 ? Math.min(100, variant.quantity) : 100;
  }

  function changeCartItem(event, root) {
    const button = event.target.closest('[data-count-change], [data-remove-item]');
    if (!button || !root.contains(button)) return;
    const row = button.closest('[data-item-id]');
    const list = items();
    const item = list.find(item => String(item.id) === row.dataset.itemId);
    if (!item) return;
    const count = button.hasAttribute('data-remove-item') ? 0 : Number(button.dataset.countChange) < 0 ? Math.max(0, Number(item.count) - 1) : Math.min(itemLimit(item), Number(item.count) + 1);
    cartStore().dispatch('updateList', list.filter(candidate => candidate.id !== item.id || count > 0).map(candidate => candidate.id === item.id ? {...candidate, count} : candidate));
    const changedRow = Array.from(root.querySelectorAll('[data-item-id]')).find(row => row.dataset.itemId === String(item.id));
    (changedRow?.querySelector(`[data-count-change="${button.dataset.countChange}"]`) || root.querySelector('[data-add-items]')).focus({preventScroll: true});
  }

  function openReview(event, returning = false) {
    event?.preventDefault();
    if (isCheckout || !reviewDialog) return;
    window.flexbe_cli.events.off('ui_cart_open.cart-widget');
    if (!returning) reviewFocus = document.activeElement;
    updateReview();
    if (!reviewDialog.open) reviewDialog.showModal();
    reviewDialog.querySelector('[data-review-close]').focus({preventScroll: true});
  }

  function installReview() {
    if (isCheckout || reviewDialog) return;
    document.body.classList.add('dr-shared-cart');
    reviewDialog = document.createElement('dialog');
    reviewDialog.className = 'dr-selector dr-review';
    reviewDialog.id = 'druzhba-cart-review';
    reviewDialog.setAttribute('aria-labelledby', 'druzhba-review-title');
    reviewDialog.innerHTML = `<div class="dr-dialog-header"><h2 id="druzhba-review-title">Ваш заказ</h2><button class="dr-close" type="button" data-review-close>Закрыть</button></div>
      <div class="dr-review-content"><ul class="dr-order-items" data-review-items></ul><p data-review-empty>В корзине пока нет вещей. Добавьте их, чтобы продолжить.</p>
      <div class="dr-cost-line"><span data-review-label>Стоимость услуг</span><strong data-review-total></strong></div>
      <p class="dr-help" data-review-estimate hidden>Точную стоимость подтвердим с вами до начала чистки</p>
      <p class="dr-help" data-review-delivery>Вывоз и доставку согласуем с вами</p></div>
      <div class="dr-selector-footer dr-review-buttons"><button class="dr-secondary" type="button" data-add-items>Добавить вещи</button><button class="dr-primary" type="button" data-go-checkout>Перейти к оформлению</button></div>`;
    document.body.append(reviewDialog);
    reviewDialog.querySelector('[data-review-close]').addEventListener('click', () => reviewDialog.close());
    reviewDialog.querySelector('[data-add-items]').addEventListener('click', openSelector);
    reviewDialog.querySelector('[data-go-checkout]').addEventListener('click', goCheckout);
    reviewDialog.addEventListener('click', event => {
      if (event.target === reviewDialog) {
        const bounds = reviewDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) reviewDialog.close();
      } else changeCartItem(event, reviewDialog);
    });
    reviewDialog.addEventListener('close', () => {
      if (!suppressReviewFocus) (reviewFocus?.isConnected ? reviewFocus : cartLink)?.focus({preventScroll: true});
      suppressReviewFocus = false;
    });
    // Native widgets have different IDs and may be absent. Their model stays shared; their review UI has one adapter.
    window.flexbe_cli.events.trigger('ui_cart_close');
    window.flexbe_cli.events.off('ui_cart_open.cart-widget');
    window.flexbe_cli.events.on('ui_cart_open.druzhba-review', () => openReview());
    window.flexbe_cli.events.on('ui_cart_close.druzhba-review', () => { if (reviewDialog.open) reviewDialog.close(); });
    updateReview();
  }

  function updateReview() {
    if (!reviewDialog) return;
    const list = visibleItems();
    reviewDialog.querySelector('[data-review-items]').innerHTML = cartRows(list);
    reviewDialog.querySelector('[data-review-empty]').hidden = Boolean(list.length);
    reviewDialog.querySelector('[data-review-label]').textContent = provisional() ? 'Предварительная стоимость' : 'Стоимость услуг';
    const total = list.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * Number(item.count), 0) / 100;
    reviewDialog.querySelector('[data-review-total]').textContent = unknownMeasure() ? 'Стоимость уточним' : money.format(total);
    reviewDialog.querySelector('[data-review-estimate]').hidden = !provisional();
    reviewDialog.querySelector('[data-go-checkout]').disabled = !list.length;
    const kind = fulfillment();
    reviewDialog.querySelector('[data-review-delivery]').textContent = kind === 'visit'
      ? 'Мебель чистим на дому. Выезд мастера согласуем с вами.'
      : kind === 'mixed' ? 'Выезд мастера для мебели, вывоз и возврат остальных вещей согласуем отдельно.' : 'Вывоз и возврат вещей согласуем с вами.';
  }

  function updateOrderCard() {
    updateCartLink();
    if (!checkoutForm) return;
    const list = items().filter(item => item.count && !item.hidden);
    const total = list.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * Number(item.count), 0) / 100;
    const count = list.reduce((sum, item) => sum + Number(item.count), 0);
    const estimate = provisional();
    const card = checkoutForm.querySelector('.dr-order-card');
    if (!card) return;
    card.querySelector('[data-order-items]').innerHTML = cartRows(list);
    card.querySelector('[data-order-empty]').hidden = Boolean(count);
    card.querySelector('[data-services-label]').textContent = estimate ? 'Предварительная стоимость' : 'Стоимость услуг';
    card.querySelector('[data-services-total]').textContent = unknownMeasure() ? 'Стоимость уточним' : money.format(total);
    card.querySelector('[data-order-estimate]').hidden = !estimate;
    const compact = document.querySelector('[data-compact-summary]');
    if (compact) compact.textContent = `${count ? 'Вещей: ' + count : 'Корзина пуста'} · ${unknownMeasure() ? 'стоимость уточним' : (estimate ? 'предварительно ' : 'услуги ') + money.format(total)}`;
    const button = card.querySelector('.form-submit .form-button');
    if (button) button.disabled = !count;
    if (nativeForm) {
      if (count && total >= 10) nativeForm.enableSubmit();
      else nativeForm.disableSubmit(count ? 'Минимальная стоимость услуг — 10 ₽' : 'Добавьте вещи в заказ');
    }
    updateReview();
  }

  async function mountCheckout() {
    const holder = document.querySelector('[data-checkout-holder]');
    const form = document.querySelector('.widget-cart form[data-cart]');
    if (!holder || !form || form.dataset.druzhbaCheckoutMounted) return;
    form.dataset.druzhbaCheckoutMounted = 'true';
    // Opening once lets the native cart create its form instance and attach its existing submit hooks.
    await window.flexbe_cli.events.trigger('ui_cart_open');
    nativeForm = window.flexbe_cli.components.initComponent(form, 'init');
    await window.flexbe_cli.events.trigger('ui_cart_close');
    checkoutForm = form;
    enhanceForm(form);
    form.classList.add('dr-order-form');
    const main = document.createElement('div');
    main.className = 'dr-form-main';
    const contacts = document.createElement('section');
    contacts.className = 'dr-section dr-contact-section';
    contacts.innerHTML = '<h2>Ваши контакты</h2>';
    contacts.append(form.querySelector('.form-fields'));
    contacts.querySelector('input[type="text"]').autocomplete = 'name';
    contacts.querySelector('input[type="tel"]').autocomplete = 'tel';
    main.append(contacts, form.querySelector('.dr-checkout'));
    const card = document.createElement('aside');
    card.className = 'dr-order-card';
    card.setAttribute('aria-label', 'Состав и стоимость заказа');
    card.innerHTML = `<div class="dr-card-title"><h2>Ваш заказ</h2><button class="dr-text-button" type="button" data-add-items>Добавить вещи</button></div>
      <ul class="dr-order-items" data-order-items></ul><p data-order-empty hidden>В заказе пока нет вещей. Добавьте их, чтобы продолжить.</p>
      <div class="dr-cost-line"><span data-services-label>Стоимость услуг</span><strong data-services-total></strong></div>
      <div class="dr-delivery-line"><span data-delivery-label>Доставка</span><span>Согласуем с вами</span></div>
      <p class="dr-help" data-delivery-help>Бесплатно по Екатеринбургу от 1 500 ₽, в города-спутники — от 4 000 ₽</p>
      <p class="dr-help" data-order-estimate hidden>Точную стоимость подтвердим с вами до начала чистки</p>`;
    card.append(form.querySelector('.form-submit'), form.querySelector('.captcha-global-error'), form.querySelector('.policy-data-warning'));
    form.append(main, card);
    holder.replaceChildren(form);
    card.querySelector('[data-add-items]').addEventListener('click', openSelector);
    card.addEventListener('click', event => changeCartItem(event, card));
    form.addEventListener('submitted', () => updateOrderCard());
    document.querySelector('[data-back-to-items]')?.addEventListener('click', event => {
      event.preventDefault(); saveDraft(form); saveContacts(form); openSelector();
    });
    document.querySelector('[data-checkout-loading]')?.remove();
    refreshForm(form);
  }

  function buildSelector() {
    selector = document.createElement('dialog');
    selector.className = 'dr-selector';
    selector.id = 'druzhba-items';
    selector.setAttribute('aria-labelledby', 'dr-selector-title');
    selector.innerHTML = `
      <div class="dr-dialog-header"><h2 id="dr-selector-title">Что почистить?</h2><button class="dr-close" type="button" data-close>Закрыть</button></div>
      <div class="dr-selector-controls">
        <label class="dr-field">Найти услугу<input type="search" data-search placeholder="Например, пуховик или ковёр" autocomplete="off"></label>
        <div class="dr-categories" role="group" aria-label="Категории услуг"></div>
      </div>
      <div class="dr-products"></div>
      <p class="dr-selector-status" role="status" aria-live="polite"></p>
      <div class="dr-selector-footer"><div><strong data-summary-total></strong><span data-summary-count></span><small data-summary-estimate hidden>Стоимость уточним после приёмки</small></div><button class="dr-primary" type="button" data-continue>Перейти к оформлению</button></div>`;
    document.body.append(selector);
    const categories = [{id: '', name: 'Все услуги'}, ...options.categories];
    for (const category of categories) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category.name;
      button.dataset.category = String(category.id);
      button.setAttribute('aria-pressed', String(String(category.id) === activeCategory));
      button.addEventListener('click', () => {
        activeCategory = String(category.id);
        requestedService = null;
        search = '';
        selector.querySelector('[data-search]').value = ''; 
        for (const sibling of selector.querySelectorAll('[data-category]')) sibling.setAttribute('aria-pressed', String(sibling === button));
        renderProducts();
      });
      selector.querySelector('.dr-categories').append(button);
    }
    selector.querySelector('[data-search]').value = search;
    selector.querySelector('[data-search]').addEventListener('input', event => {
      requestedService = null;
      search = event.target.value.toLowerCase().replaceAll('ё', 'е').trim();
      renderProducts();
    });
    selector.querySelector('[data-close]').addEventListener('click', () => selector.close());
    selector.addEventListener('close', async () => {
      if (returnToCart) {
        returnToCart = false;
        openReview(null, true);
      }
      if (returnFocus?.isConnected) returnFocus.focus();
    });
    selector.querySelector('[data-continue]').addEventListener('click', async () => {
      returnToCart = false;
      selector.close();
      if (isCheckout) { updateOrderCard(); checkoutForm?.querySelector('input[type="text"]')?.focus({preventScroll: true}); }
      else goCheckout();
    });
    renderProducts();
  }

  function priceText(product, variant) {
    return `${variant.prefix ? variant.prefix + ' ' : ''}${money.format(variant.price)}${variant.unit ? ' / ' + variant.unit : ''}`;
  }

  function renderProducts() {
    const list = selector.querySelector('.dr-products');
    const visible = options.products.filter(product => (!requestedService || product.id === requestedService) && (!activeCategory || product.categories.includes(Number(activeCategory))) && (!search || (product.name + ' ' + product.variants.map(v => v.name).join(' ')).toLowerCase().replaceAll('ё', 'е').includes(search)));
    list.replaceChildren();
    if (!visible.length) {
      list.innerHTML = '<p class="dr-empty">Такую услугу пока не нашли. Попробуйте другое название или выберите другую категорию.</p>';
    }
    for (const product of visible) {
      const variant = product.variants[0];
      const card = document.createElement('article');
      card.className = 'dr-product';
      card.dataset.product = product.id;
      card.innerHTML = `
        ${product.image ? `<img class="dr-product-image" src="${escape(product.image)}" alt="" loading="lazy">` : ''}
        <h3>${escape(product.name)}</h3>
        ${product.variants.length > 1 ? `<label class="dr-field dr-variant-label">Вариант<select data-variant>${product.variants.map(v => `<option value="${v.id}">${escape(v.name || product.name)} — ${escape(priceText(product, v))}</option>`).join('')}</select></label>` : ''}
        <p class="dr-product-price" data-price>${escape(priceText(product, variant))}</p>
        ${product.carpet ? '<label class="dr-radio dr-size-unknown"><input type="checkbox" data-size-unknown checked><span>Размеры пока не знаю</span></label><div class="dr-field-row" data-size-fields hidden><label class="dr-field">Длина, м<input data-length type="text" inputmode="decimal" placeholder="2,5"></label><label class="dr-field">Ширина, м<input data-width type="text" inputmode="decimal" placeholder="3"></label></div><p class="dr-help" data-area></p>' : ''}
        ${variant.reason ? '<p class="dr-help" data-product-note>Итоговую стоимость подтвердим перед чисткой.</p>' : ''}
        <div class="dr-product-actions"><label class="dr-quantity">${variant.unit === 'кг' ? 'Примерно, кг' : 'Количество'}<input type="number" data-quantity min="1" max="100" step="1" value="1"></label><button class="dr-primary" type="button" data-add>Добавить</button></div>
        <p class="dr-error" data-product-error role="alert" hidden></p>`;
      if (requestedService === product.id && requestedVariant && card.querySelector('[data-variant]')) card.querySelector('[data-variant]').value = String(requestedVariant);
      card.querySelector('img')?.addEventListener('error', event => event.target.hidden = true);
      const update = () => {
        const selected = getVariant(card, product);
        card.querySelector('[data-price]').textContent = priceText(product, selected);
        const image = card.querySelector('.dr-product-image');
        if (image && (selected.image || product.image)) {
          image.hidden = false;
          image.src = selected.image || product.image;
        }
        if (product.carpet) {
          const unknown = card.querySelector('[data-size-unknown]').checked;
          card.querySelector('[data-size-fields]').hidden = unknown;
          const result = readDimensions(card, false);
          const text = card.querySelector('[data-area]');
          const area = result ? (Number(result.length) * Number(result.width)).toLocaleString('ru-RU', {maximumFractionDigits: 4}) : '';
          text.textContent = result ? `${result.length} × ${result.width} м = ${area} м² · предварительно ${money.format(measuredCents(selected.price, result) / 100)}` : unknown ? 'Окончательную сумму согласуем после обмера. В корзине пока указана цена за 1 м².' : 'Введите размеры, чтобы узнать предварительную стоимость.';
        }
      };
      card.querySelector('[data-variant]')?.addEventListener('change', update);
      card.querySelector('[data-size-unknown]')?.addEventListener('change', update);
      card.querySelector('[data-length]')?.addEventListener('input', update);
      card.querySelector('[data-width]')?.addEventListener('input', update);
      card.querySelector('[data-add]').addEventListener('click', () => addProduct(card, product));
      list.append(card);
      update();
    }
    updateSummary();
  }

  function getVariant(card, product) {
    const id = card.querySelector('[data-variant]')?.value;
    return product.variants.find(variant => String(variant.id) === id) || product.variants[0];
  }

  function readDimensions(card, report) {
    if (!card.querySelector('[data-size-unknown]') || card.querySelector('[data-size-unknown]').checked) return null;
    const measured = {};
    for (const [key, max] of [['length', 30], ['width', 15]]) {
      const input = card.querySelector('[data-' + key + ']');
      const value = input.value.trim().replace(',', '.');
      if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(value) || Number(value) < 0.1 || Number(value) > max) {
        if (report) input.focus();
        return null;
      }
      measured[key] = String(Number(value));
    }
    return measured;
  }

  function measuredCents(rate, measured) {
    return Math.round(Math.round(rate * 100) * Math.round(Number(measured.length) * 100) * Math.round(Number(measured.width) * 100) / 10000);
  }

  function addProduct(card, product) {
    const error = card.querySelector('[data-product-error]');
    error.hidden = true;
    const count = Number(card.querySelector('[data-quantity]').value);
    const variant = getVariant(card, product);
    const measured = readDimensions(card, true);
    if (product.carpet && !card.querySelector('[data-size-unknown]').checked && !measured) {
      error.textContent = 'Введите длину от 0,1 до 30 м и ширину от 0,1 до 15 м.';
      error.hidden = false;
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      error.textContent = 'Укажите количество от 1 до 100.';
      error.hidden = false;
      card.querySelector('[data-quantity]').focus();
      return;
    }
    let title = product.name + (variant.name ? ' — ' + variant.name : '');
    let price = variant.price;
    if (product.carpet) {
      if (measured) {
        title += ` · ${measured.length} × ${measured.width} м`;
        price = measuredCents(variant.price, measured) / 100;
      } else title += ' · цена за м², размер уточним';
    } else if (variant.unit) title += ' · ' + variant.unit;
    const id = `druzhba_${product.id}_${variant.id}_${measured ? measured.length + 'x' + measured.width : 'unit'}`;
    cartStore().dispatch('addItem', {
      id, type: 'custom', title, price, count, quantity: -1,
      serverProductId: product.id, serverVariantId: variant.id,
      druzhba_dimensions: measured, druzhba_estimate: variant.reason,
      img: variant.image || product.image,
    });
    selector.querySelector('.dr-selector-status').textContent = `${product.name} добавлено в заказ`;
    updateSummary();
  }

  function updateSummary() {
    updateOrderCard();
    updateReview();
    if (!selector) return;
    const list = items();
    const count = list.reduce((total, item) => total + Number(item.count || 0), 0);
    const total = list.reduce((total, item) => total + Number(item.price || 0) * Number(item.count || 0), 0);
    const estimate = provisional();
    selector.querySelector('[data-summary-total]').textContent = unknownMeasure() ? 'Стоимость уточним' : (estimate ? 'Предварительно ' : '') + money.format(total);
    selector.querySelector('[data-summary-count]').textContent = count ? 'В заказе: ' + count : 'Выберите вещи для заказа';
    selector.querySelector('[data-summary-estimate]').hidden = !estimate;
    selector.querySelector('[data-continue]').disabled = !count;
    if (checkoutForm) refreshForm(checkoutForm);
  }

  async function openSelector(event, categoryId) {
    event?.preventDefault();
    returnFocus = document.activeElement;
    returnToCart = Boolean(reviewDialog?.open);
    if (returnToCart) { suppressReviewFocus = true; reviewDialog.close(); }
    if (!options) return;
    const category = options.categories.find(category => String(category.id) === String(categoryId));
    if (category) {
      activeCategory = String(category.id);
      requestedService = null;
      requestedVariant = null;
      search = '';
    }
    if (!selector) buildSelector();
    else if (category) {
      selector.querySelector('[data-search]').value = '';
      for (const button of selector.querySelectorAll('[data-category]')) {
        button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory));
      }
      renderProducts();
    }
    if (category) selector.querySelector('.dr-products').scrollTop = 0;
    await window.flexbe_cli.events.trigger('ui_cart_close');
    if (!selector.open) selector.showModal();
    updateSummary();
    selector.querySelector('[data-search]').focus();
    if (category) selector.querySelector(`[data-category="${category.id}"]`)?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }

  function confirmation(response) {
    const dialog = document.createElement('dialog');
    dialog.className = 'dr-confirmation';
    dialog.setAttribute('aria-labelledby', 'dr-confirmation-title');
    const title = response.checkout.state === 'deferred' ? 'Заказ отправлен на согласование' : 'Заказ принят';
    const kind = response.checkout.fulfillment || 'pickup';
    const pickupName = kind === 'visit' ? 'Выезд мастера' : kind === 'mixed' ? 'Вывоз вещей и выезд мастера' : 'Вывоз';
    const pickup = response.checkout.pickup;
    const pickupSummary = pickup?.mode === 'requested'
      ? `<p>${pickupName} — ${escape(pickup.date.split('-').reverse().join('.'))}, ${escape(pickup.window)}.<br><span class="dr-help">${escape(pickup.status)}</span></p>`
      : `<p>${pickupName} согласуем по телефону.</p>`;
    const returns = response.checkout.return;
    const returnSummary = kind === 'visit' ? '' : returns?.mode === 'requested'
      ? `<p>Желаемый возврат — ${escape(returns.date.split('-').reverse().join('.'))}, ${escape(returns.window)}.</p>`
      : '<p>Возврат согласуем с менеджером.</p>';
    dialog.innerHTML = `<h2 id="dr-confirmation-title">${title}</h2><p class="dr-help">Заказ №${Number(response.lead_id)}</p><p>${escape(response.checkout.message)}</p>${pickupSummary}${returnSummary}<p class="dr-help">${kind === 'visit' ? 'Менеджер подтвердит дату и время выезда мастера.' : kind === 'mixed' ? 'Менеджер отдельно согласует выезд мастера, вывоз и возврат остальных вещей.' : 'Менеджер подтвердит даты и время вывоза и возврата.'}</p><p>Способ оплаты — ${escape(response.checkout.payment)}.</p><button class="dr-primary" type="button">Понятно</button>`;
    document.body.append(dialog);
    const prior = document.querySelector('.cart-button');
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { dialog.remove(); prior?.focus(); });
    dialog.showModal();
  }

  window.DruzhbaCheckout = {
    read: draftFrom,
    enrichProducts(raw) {
      // Native cart serialization keeps only its own fields. Restore our sizing metadata by cart item ID.
      const products = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(products)) return raw;
      const stored = new Map(items().map(item => [item.id, item]));
      const result = products.map(product => {
        const item = stored.get(product.id);
        if (!item?.serverProductId) return product;
        return {...product, serverProductId: item.serverProductId, serverVariantId: item.serverVariantId,
          druzhba_dimensions: item.druzhba_dimensions};
      });
      return typeof raw === 'string' ? JSON.stringify(result) : result;
    },
    validate(form) {
      if (form.hasAttribute('data-cart') && !isCheckout) { goCheckout(); return false; }
      if (!form.querySelector('.dr-checkout')) return true;
      showError(form, '');
      saveDraft(form);
      saveContacts(form);
      if (!items().some(item => item.count && !item.hidden)) {
        showError(form, 'Добавьте вещи в заказ.');
        return false;
      }
      for (const input of form.querySelectorAll('.dr-checkout input, .dr-checkout select, .dr-checkout textarea')) {
        if (!input.checkValidity()) { input.reportValidity(); return false; }
      }
      if (nativeForm && !nativeForm.validateForm()) return false;
      return true;
    },
    error: showError,
    submitted(form, response) {
      try { localStorage.removeItem(draftKey); } catch (_) {}
      try { sessionStorage.removeItem(draftKey); } catch (_) {}
      try { sessionStorage.removeItem(contactsKey); } catch (_) {}
      draft = JSON.parse(JSON.stringify(initialDraft));
      if (!response.pay) form.addEventListener('submitted', () => confirmation(response), {once: true});
    },
    open: openSelector,
  };

  function updateCartLink() {
    if (!cartLink) return;
    const count = visibleItems().reduce((sum, item) => sum + Number(item.count), 0);
    cartLink.querySelector('[data-cart-count]').textContent = count;
    cartLink.setAttribute('aria-label', `Открыть корзину. Вещей: ${count}`);
  }

  function normalizeServiceButtons() {
    for (const action of document.querySelectorAll('[data-action="cart"]')) {
      const button = action.closest('[data-component="button"]');
      const label = button?.querySelector('.btn-text');
      const text = label?.textContent.trim();
      if (!label || !/\d/.test(text) || !/(?:₽|руб|р\b)/i.test(text)) continue;
      button.classList.add('dr-price-button');
    }
  }

  function isCartEntry(anchor) {
    if (!anchor) return false;
    try {
      const url = new URL(anchor.getAttribute('href'), location.href);
      return url.origin === location.origin && url.hash === '#customer_cart';
    } catch (_) { return false; }
  }

  function addCatalogOffer(productId, variantId) {
    const product = options.products.find(product => String(product.id) === String(productId));
    const variant = product?.variants.find(variant => String(variant.id) === String(variantId));
    if (!product || !variant || !cartStore()) return false;
    const id = `druzhba_${product.id}_${variant.id}_unit`;
    const prior = items().find(item => item.id === id);
    const maximum = typeof variant.quantity === 'number' && variant.quantity >= 0 ? Math.min(100, variant.quantity) : 100;
    if (Number(prior?.count || 0) >= maximum) return false;
    // Same canonical item as the selector, independent of the page's lazy productsStore.
    cartStore().dispatch('addItem', {id, type: 'custom', count: 1, quantity: variant.quantity,
      title: product.name + (variant.name ? ' — ' + variant.name : ''), price: variant.price,
      serverProductId: product.id, serverVariantId: variant.id, druzhba_estimate: variant.reason,
      druzhba_dimensions: null, img: variant.image || product.image});
    return true;
  }

  function handleEntry(event) {
    const nativeTrigger = event.target.closest?.('.cart-button, .cart-element, .cart-element-icon, .nav-header-controls--cart');
    if (nativeTrigger && !isCheckout) {
      event.preventDefault(); event.stopImmediatePropagation(); openReview(); return;
    }
    const component = event.target.closest?.('[data-component="button"]');
    const anchor = event.target.closest?.('a') || component?.querySelector('a');
    if (!anchor) return;
    const productId = anchor.dataset.drProductId;
    const serviceLink = anchor.hasAttribute('data-dr-service');
    const cartEntry = isCartEntry(anchor);
    if (!productId && !serviceLink && !cartEntry) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (serviceLink) { location.href = anchor.href; return; }
    if (productId) {
      addCatalogOffer(productId, anchor.dataset.drVariantId);
      return;
    }
    const homeCategory = pagePath === '/' && cartEntry
      ? homeServiceCategories[anchor.closest('.tab-content[data-tab-uid]')?.dataset.tabUid] : null;
    if (homeCategory) { openSelector(null, homeCategory); return; }
    openReview();
  }

  function installEntries() {
    // Resolve the live clicked anchor: native hydration rewrites hrefs and consumes data-product.
    document.addEventListener('click', handleEntry, true);
    if (!isCheckout) {
      cartLink = document.createElement('button');
      cartLink.type = 'button';
      cartLink.className = 'dr-cart-toggle';
      cartLink.setAttribute('aria-haspopup', 'dialog');
      cartLink.setAttribute('aria-controls', 'druzhba-cart-review');
      cartLink.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 5h3l3 16h15l3-12H8M12 26h.01M24 26h.01" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span data-cart-count aria-hidden="true">0</span>';
      cartLink.addEventListener('click', openReview);
      document.body.append(cartLink);
      updateCartLink();
    }
    normalizeServiceButtons();
    new MutationObserver(normalizeServiceButtons).observe(document.querySelector('.container-list') || document.body, {childList: true, subtree: true});
    const params = new URLSearchParams(location.search || '');
    const service = options.products.find(product => String(product.id) === params.get('service'));
    const category = options.categories.find(category => String(category.id) === params.get('category'));
    if (service || category) {
      requestedService = service?.id || null;
      requestedVariant = service?.variants.find(variant => String(variant.id) === params.get('variant'))?.id || null;
      activeCategory = String(category && (!service || service.categories.includes(category.id)) ? category.id : service?.categories[0] || '');
      openSelector();
    }
  }

  function normalizeCatalogQuery(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function catalogMatches(product, query) {
    const words = normalizeCatalogQuery(query).split(' ').filter(Boolean);
    const text = normalizeCatalogQuery([product.name, ...product.variants.map(variant => variant.name)].join(' '));
    return words.every(word => text.includes(word));
  }

  function catalogColumns(width) {
    return Math.max(1, Math.min(4, Math.floor((width + 20) / 240)));
  }

  function installCatalog() {
    if (!document.body.classList.contains('dr-catalog-page') || document.querySelector('.dr-catalog-shell')) return;
    const filter = document.querySelector('.custom-category-filter');
    const block = document.querySelector('.container-list [data-b-id="PRODUCTS"]');
    const shell = filter?.closest('.b_block');
    const filterElement = filter?.closest('.element-item');
    if (!shell || !block || !filterElement) return;
    const categories = options.categories;
    const products = new Map(options.products.map(product => [String(product.id), product]));
    shell.classList.add('dr-catalog-shell');
    const header = document.createElement('header');
    header.className = 'dr-catalog-header';
    header.innerHTML = '<h2>Каталог</h2><p>Выберите вещи и добавьте их в корзину</p>';
    const layout = document.createElement('div');
    layout.className = 'dr-catalog-layout';
    const aside = document.createElement('aside');
    aside.className = 'dr-catalog-sidebar';
    aside.setAttribute('aria-label', 'Разделы каталога');
    aside.innerHTML = `<h3>Разделы</h3><label class="dr-catalog-mobile-category">Категория<select data-catalog-category>${categories.map(category => `<option value="${Number(category.id)}">${escape(category.name)}</option>`).join('')}</select></label>`;
    // Move the existing filter with its listeners; native cards and category controls stay intact.
    aside.append(filterElement);
    const content = document.createElement('div');
    content.className = 'dr-catalog-content';
    content.innerHTML = '<div class="dr-catalog-search"><label for="dr-catalog-query" data-catalog-scope>Поиск в разделе</label><div class="dr-catalog-search-field"><input id="dr-catalog-query" type="search" placeholder="Название вещи или вариант" autocomplete="off"><button type="button" data-catalog-clear aria-label="Очистить поиск" hidden>×</button></div><p data-catalog-count role="status" aria-live="polite" aria-atomic="true"></p></div>';
    const empty = document.createElement('div');
    empty.className = 'dr-catalog-empty';
    empty.hidden = true;
    empty.innerHTML = '<p>По вашему запросу ничего не найдено</p><button type="button" data-catalog-reset>Сбросить поиск</button>';
    content.append(block, empty);
    layout.append(aside, content);
    shell.append(header, layout);
    const input = content.querySelector('input');
    const select = aside.querySelector('select');
    const clear = content.querySelector('[data-catalog-clear]');
    const count = content.querySelector('[data-catalog-count]');
    const scope = content.querySelector('[data-catalog-scope]');
    const buttons = [...filter.querySelectorAll('.filter-btn')];
    for (const button of buttons) {
      button.setAttribute('role', 'button');
      button.tabIndex = 0;
      button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); button.click(); }
      });
    }
    let scheduled = false;
    function refresh() {
      scheduled = false;
      const panel = [...block.querySelectorAll('[role="tabpanel"][data-tab-uid]')].find(panel => !panel.hidden);
      if (!panel) return;
      const category = categories.find(category => String(category.id) === panel.dataset.tabUid);
      if (!category) return;
      const query = normalizeCatalogQuery(input.value);
      let visible = 0;
      const cards = [...panel.querySelectorAll('[data-product-item]')];
      for (const card of cards) {
        const product = products.get(card.dataset.itemId);
        const matched = !query || Boolean(product && catalogMatches(product, query));
        card.classList.toggle('dr-search-hidden', !matched);
        if (matched) visible++;
      }
      select.value = String(category.id);
      for (const button of buttons) {
        const active = normalizeCatalogQuery(button.querySelector('.filter-label')?.textContent) === normalizeCatalogQuery(category.name);
        button.classList.toggle('active-filter', active);
        button.setAttribute('aria-pressed', String(active));
      }
      const label = `Поиск в разделе «${category.name}»`;
      if (scope.textContent !== label) scope.textContent = label;
      const summary = `Найдено услуг: ${visible}`;
      if (count.textContent !== summary) count.textContent = summary;
      clear.hidden = !input.value;
      empty.hidden = !query || visible > 0 || !cards.length;
    }
    function scheduleRefresh() {
      if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); }
    }
    function resetSearch() { input.value = ''; refresh(); input.focus({preventScroll: true}); }
    input.addEventListener('input', refresh);
    clear.addEventListener('click', resetSearch);
    empty.querySelector('button').addEventListener('click', resetSearch);
    filter.addEventListener('click', scheduleRefresh);
    select.addEventListener('change', () => {
      const category = categories.find(category => String(category.id) === select.value);
      const native = [...block.querySelectorAll('.tab-wrap')].find(tab => normalizeCatalogQuery(tab.querySelector('.tab-label')?.textContent) === normalizeCatalogQuery(category?.name));
      (native?.querySelector('a.tab') || native)?.click();
      scheduleRefresh();
    });
    // Variant changes can rerender a native card. Filter it again without changing its selected variant.
    new MutationObserver(scheduleRefresh).observe(block, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-selected']});
    const resize = () => {
      const zoom = Number(window.getComputedStyle(document.body).zoom);
      const nativeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
      const width = content.clientWidth > 0 ? content.clientWidth * nativeZoom : content.getBoundingClientRect().width;
      const columns = String(catalogColumns(width));
      if (content.style.getPropertyValue('--dr-catalog-columns') !== columns) content.style.setProperty('--dr-catalog-columns', columns);
    };
    let resizeScheduled = false;
    const scheduleResize = () => {
      if (resizeScheduled) return;
      resizeScheduled = true;
      requestAnimationFrame(() => { resizeScheduled = false; resize(); });
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleResize).observe(content);
    // Flexbe can zoom a fixed-width body without changing the observed content box.
    // Read its visual width after the native responsive style/class update has settled.
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('resized', scheduleResize);
    new MutationObserver(scheduleResize).observe(document.body, {attributes: true, attributeFilter: ['style', 'class']});
    // Native qn() writes --zoom on HTML; staying in desktop mode need not mutate BODY.
    new MutationObserver(scheduleResize).observe(document.documentElement, {attributes: true, attributeFilter: ['style', 'class']});
    resize();
    refresh();
  }

  async function init() {
    document.body?.classList.add('dr-unified');
    if (['/', '/order', '/techno_order'].includes(pagePath)) document.body?.classList.add('dr-catalog-page');
    if (pagePath === '/' && location.hash === '#price') {
      const target = new URL(location.href);
      target.hash = 'catalog';
      history.replaceState(history.state, '', target.href);
      requestAnimationFrame(() => document.getElementById('catalog')?.scrollIntoView({block: 'start'}));
    }
    try {
      const response = await fetch('/api/order/catalog', {credentials: 'same-origin'});
      if (!response.ok) throw new Error('catalog');
      options = await response.json();
    } catch (_) {
      return;
    }
    const interval = setInterval(() => {
      if (!cartStore() || !window.flexbe_cli?.isInited) return;
      clearInterval(interval);
      if (!options) return;
      restoreCartImages();
      installCatalog();
      installReview();
      installEntries();
      if (isCheckout) mountCheckout().catch(() => {
        const note = document.querySelector('[data-checkout-loading]');
        if (note) note.textContent = 'Не удалось загрузить оформление. Обновите страницу или позвоните нам.';
      });
      cartStore().on('dispatch.druzhba-checkout', () => {
        restoreCartImages();
        if (checkoutForm) refreshForm(checkoutForm);
        updateSummary();
        setTimeout(updateReview, 0);
      });
      window.flexbe_cli.events.on('cart_opened.druzhba-checkout', () => document.querySelectorAll('form[data-cart]').forEach(form => {
        if (!isCheckout) updateReview();
        if (checkoutForm) restoreContacts(checkoutForm);
      }));
      if (isCheckout) window.flexbe_cli.events.on('cart_opened.druzhba-checkout-page', () => {
        if (checkoutForm) window.flexbe_cli.events.trigger('ui_cart_close');
      });
    }, 100);
    setTimeout(() => clearInterval(interval), 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
