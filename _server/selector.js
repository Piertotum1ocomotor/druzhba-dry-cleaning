(() => {
  'use strict';

  const draftKey = 'druzhba_checkout_v1';
  const contactsKey = 'druzhba_checkout_contacts_v1';
  const money = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2});
  const initialDraft = {payment: 'cash', pickup: {mode: 'phone', address: '', date: '', window: 'any'},
    address_details: {apartment: '', entrance: '', floor: '', intercom: '', meet_outside: false},
    return: {mode: 'phone', date: '', window: 'any'}, comment: ''};
  const base = locationPath().startsWith('/druzhba-dry-cleaning/') ? '/druzhba-dry-cleaning' : '';
  const isCheckout = locationPath().replace(/\/$/, '') === base + '/checkout';
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
    if (changed) cartStore().dispatch('updateList', updated);
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
    return {
      payment: ['cash', 'manager'].includes(root.querySelector('[data-payment]:checked')?.value)
        ? root.querySelector('[data-payment]:checked').value : 'cash',
      pickup: {mode: root.querySelector('[data-pickup-requested]').checked ? 'requested' : 'phone',
        address: value('[data-pickup-address]'), date: value('[data-pickup-date]'), window: value('[data-pickup-window]')},
      address_details: {apartment: value('[data-apartment]'), entrance: value('[data-entrance]'),
        floor: value('[data-floor]'), intercom: value('[data-intercom]'), meet_outside: root.querySelector('[data-meet-outside]').checked},
      return: {mode: root.querySelector('[data-return-requested]').checked ? 'requested' : 'phone',
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

  function refreshForm(form) {
    const root = form.querySelector('.dr-checkout');
    if (!root || !options) return;
    const value = draftFrom(form);
    const requested = value.pickup.mode === 'requested';
    root.querySelector('[data-pickup-address]').required = requested;
    root.querySelector('[data-pickup-address]').minLength = requested ? 5 : 0;
    for (const kind of ['pickup', 'return']) {
      const selected = value[kind].mode === 'requested';
      root.querySelector('[data-' + kind + '-date]').required = selected;
      for (const control of root.querySelectorAll('[data-' + kind + '-date], [data-' + kind + '-window]')) control.disabled = !selected;
    }
    root.querySelector('[data-return-date]').min = requested && value.pickup.date ? value.pickup.date : options.today;
    const outside = value.address_details.meet_outside;
    root.querySelector('[data-address-details]').hidden = outside;
    for (const input of root.querySelectorAll('[data-address-details] input')) input.disabled = outside;
    const buttonLabel = form.querySelector('.form-submit .form-button .btn-text');
    if (buttonLabel) buttonLabel.textContent = 'Отправить заказ';
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
      <section class="dr-section"><h2>Адрес</h2><p class="dr-help">Заберём вещи и привезём их обратно по этому адресу.</p>
        <label class="dr-field">Улица и дом<input data-pickup-address type="text" autocomplete="street-address" maxlength="500" placeholder="Екатеринбург, улица, дом"></label>
        <div class="dr-address-details" data-address-details>
          ${[['apartment', 'Квартира / офис'], ['entrance', 'Подъезд'], ['floor', 'Этаж'], ['intercom', 'Домофон']].map(([key, label]) => `<label class="dr-field">${label}<input data-${key} type="text" maxlength="80" autocomplete="off"></label>`).join('')}
        </div>
        <label class="dr-check"><input data-meet-outside type="checkbox"><span>Встречу курьера на улице</span></label>
        <details class="dr-comment"><summary>Добавить комментарий к заказу / проходу</summary>
          <label class="dr-field">Комментарий<textarea data-order-comment maxlength="1000" rows="3" placeholder="Например, как найти вход или что важно знать о вещах"></textarea></label>
        </details>
      </section>
      <section class="dr-section"><h2>Когда забрать вещи</h2>
        <label class="dr-check"><input data-pickup-requested type="checkbox"><span>Выбрать желаемые дату и время</span></label>
        ${dates('pickup')}<p class="dr-help">Без выбранной даты согласуем вывоз по телефону.</p>
      </section>
      <section class="dr-section"><h2>Когда вернуть вещи</h2>
        <label class="dr-check"><input data-return-requested type="checkbox"><span>Указать пожелание по возврату</span></label>
        ${dates('return')}<p class="dr-help">По умолчанию дату возврата согласуем с менеджером.</p>
        <p class="dr-date-note">Мы свяжемся с вами и согласуем удобное время вывоза и доставки</p>
      </section>
      <section class="dr-section"><h2>Способ оплаты</h2>
        <label class="dr-radio"><input data-payment type="radio" value="cash"><span>Наличными курьеру</span></label>
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

  function installReview() {
    const widget = document.querySelector('.widget-cart');
    if (!widget || widget.querySelector('.dr-review-actions')) return;
    widget.classList.add('dr-cart-review');
    const actions = document.createElement('div');
    actions.className = 'dr-review-actions';
    actions.innerHTML = `<p class="dr-help" data-review-estimate hidden>Точную стоимость подтвердим с вами до начала чистки</p>
      <p class="dr-help">Доставка — согласуем с вами</p><div class="dr-review-buttons"><button class="dr-secondary" type="button" data-add-items>Добавить вещи</button><button class="dr-primary" type="button" data-go-checkout>Перейти к оформлению</button></div>`;
    widget.querySelector('.cart-container').append(actions);
    actions.querySelector('[data-add-items]').addEventListener('click', openSelector);
    actions.querySelector('[data-go-checkout]').addEventListener('click', goCheckout);
    updateReview();
  }

  function updateReview() {
    const widget = document.querySelector('.dr-cart-review');
    if (!widget) return;
    const estimate = provisional();
    const label = widget.querySelector('.cart-checkout-summary__text p');
    if (label) label.textContent = estimate ? 'Предварительная стоимость' : 'Стоимость услуг';
    const summary = widget.querySelector('.cart-checkout-summary');
    let total = summary?.querySelector('[data-review-total]');
    if (summary && !total) {
      total = document.createElement('strong');
      total.dataset.reviewTotal = '';
      summary.append(total);
    }
    if (total) total.textContent = unknownMeasure() ? 'Стоимость уточним' : money.format(items().reduce((sum, item) => sum + (item.hidden ? 0 : Number(item.price) * Number(item.count)), 0));
    widget.querySelector('[data-review-estimate]').hidden = !estimate;
    widget.querySelector('[data-go-checkout]').disabled = !items().some(item => item.count && !item.hidden);
    for (const row of widget.querySelectorAll('.order-item')) {
      const item = items().find(item => item.id === row.dataset.id);
      if (!item || !estimateReason(item) || row.querySelector('.dr-item-estimate')) continue;
      if (estimateReason(item) === 'measure' && !item.druzhba_dimensions) {
        const price = row.querySelector('.cart-sum');
        if (price) price.textContent = money.format(Number(item.price)) + ' / м²';
        const each = row.querySelector('.cart-price');
        if (each) each.hidden = true;
      }
      const note = document.createElement('small');
      note.className = 'dr-item-estimate';
      note.textContent = estimateReason(item) === 'measure' && !item.druzhba_dimensions ? 'Тариф за м² · размер уточним' : 'Предварительная стоимость';
      row.querySelector('.item-title')?.append(note);
    }
  }

  function updateOrderCard() {
    if (!checkoutForm) return;
    const list = items().filter(item => item.count && !item.hidden);
    const total = list.reduce((sum, item) => sum + Math.round(Number(item.price) * 100) * Number(item.count), 0) / 100;
    const count = list.reduce((sum, item) => sum + Number(item.count), 0);
    const estimate = provisional();
    const card = checkoutForm.querySelector('.dr-order-card');
    if (!card) return;
    card.querySelector('[data-order-items]').innerHTML = list.map(item => `<li class="dr-order-item" data-item-id="${escape(item.id)}">
      ${item.img ? `<img src="${escape(imagePath(item.img))}" alt="" width="60" height="60">` : '<span class="dr-item-placeholder" aria-hidden="true"></span>'}
      <div class="dr-order-item-body"><strong>${escape(item.title)}</strong>${estimateReason(item) ? `<small>${estimateReason(item) === 'measure' && !item.druzhba_dimensions ? 'Тариф за м² · размер уточним' : 'Предварительно'}</small>` : ''}
        <div class="dr-item-controls"><div class="dr-quantity"><button type="button" data-count-change="-1" aria-label="Уменьшить количество: ${escape(item.title)}">−</button><span aria-label="Количество">${Number(item.count)}</span><button type="button" data-count-change="1" aria-label="Увеличить количество: ${escape(item.title)}" ${Number(item.count) >= 100 ? 'disabled' : ''}>+</button></div>
        <span>${estimateReason(item) === 'measure' && !item.druzhba_dimensions ? money.format(Number(item.price)) + ' / м²' : money.format(Number(item.price) * Number(item.count))}</span></div><button class="dr-remove" type="button" data-remove-item>Удалить</button></div></li>`).join('');
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
    if (!holder || !form) return;
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
      <div class="dr-delivery-line"><span>Доставка</span><span>Согласуем с вами</span></div>
      <p class="dr-help">Бесплатно по Екатеринбургу от 1 500 ₽, в города-спутники — от 4 000 ₽</p>
      <p class="dr-help" data-order-estimate hidden>Точную стоимость подтвердим с вами до начала чистки</p>`;
    card.append(form.querySelector('.form-submit'), form.querySelector('.captcha-global-error'), form.querySelector('.policy-data-warning'));
    form.append(main, card);
    holder.replaceChildren(form);
    card.querySelector('[data-add-items]').addEventListener('click', openSelector);
    card.addEventListener('click', event => {
      const button = event.target.closest('[data-count-change], [data-remove-item]');
      if (!button) return;
      const row = button.closest('[data-item-id]');
      const list = items();
      const item = list.find(item => item.id === row.dataset.itemId);
      if (!item) return;
      const count = button.hasAttribute('data-remove-item') ? 0 : Math.max(0, Math.min(100, Number(item.count) + Number(button.dataset.countChange)));
      const next = list.filter(candidate => candidate.id !== item.id || count > 0).map(candidate => candidate.id === item.id ? {...candidate, count} : candidate);
      cartStore().dispatch('updateList', next);
      // Restore keyboard focus after the changed list is rendered.
      const changedRow = Array.from(card.querySelectorAll('[data-item-id]')).find(row => row.dataset.itemId === item.id);
      (changedRow?.querySelector(button.hasAttribute('data-remove-item') ? '[data-remove-item]' : `[data-count-change="${button.dataset.countChange}"]`) || card.querySelector('[data-add-items]')).focus({preventScroll: true});
    });
    form.addEventListener('submitted', () => updateOrderCard());
    document.querySelector('[data-back-to-items]')?.addEventListener('click', event => {
      event.preventDefault(); saveDraft(form); saveContacts(form); openSelector();
    });
    document.querySelector('[data-checkout-loading]')?.remove();
    updateOrderCard();
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
      button.setAttribute('aria-pressed', String(category.id === ''));
      button.addEventListener('click', () => {
        activeCategory = String(category.id);
        for (const sibling of selector.querySelectorAll('[data-category]')) sibling.setAttribute('aria-pressed', String(sibling === button));
        renderProducts();
      });
      selector.querySelector('.dr-categories').append(button);
    }
    selector.querySelector('[data-search]').addEventListener('input', event => {
      search = event.target.value.toLowerCase().replaceAll('ё', 'е').trim();
      renderProducts();
    });
    selector.querySelector('[data-close]').addEventListener('click', () => selector.close());
    selector.addEventListener('close', async () => {
      if (returnToCart) {
        returnToCart = false;
        await window.flexbe_cli.events.trigger('ui_cart_open');
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
    const visible = options.products.filter(product => (!activeCategory || product.categories.includes(Number(activeCategory))) && (!search || (product.name + ' ' + product.variants.map(v => v.name).join(' ')).toLowerCase().replaceAll('ё', 'е').includes(search)));
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

  async function openSelector(event) {
    event?.preventDefault();
    returnFocus = document.activeElement;
    returnToCart = document.body.classList.contains('is-cart-open');
    if (!options) return;
    if (!selector) buildSelector();
    await window.flexbe_cli.events.trigger('ui_cart_close');
    if (!selector.open) selector.showModal();
    updateSummary();
    selector.querySelector('[data-search]').focus();
  }

  function confirmation(response) {
    const dialog = document.createElement('dialog');
    dialog.className = 'dr-confirmation';
    dialog.setAttribute('aria-labelledby', 'dr-confirmation-title');
    const title = response.checkout.state === 'deferred' ? 'Заказ отправлен на согласование' : 'Заказ принят';
    const pickup = response.checkout.pickup;
    const pickupSummary = pickup?.mode === 'requested'
      ? `<p>Желаемый вывоз — ${escape(pickup.date.split('-').reverse().join('.'))}, ${escape(pickup.window)}.<br><span class="dr-help">${escape(pickup.status)}</span></p>`
      : '<p>Вывоз согласуем по телефону.</p>';
    const returns = response.checkout.return;
    const returnSummary = returns?.mode === 'requested'
      ? `<p>Желаемый возврат — ${escape(returns.date.split('-').reverse().join('.'))}, ${escape(returns.window)}.</p>`
      : '<p>Возврат согласуем с менеджером.</p>';
    dialog.innerHTML = `<h2 id="dr-confirmation-title">${title}</h2><p class="dr-help">Заказ №${Number(response.lead_id)}</p><p>${escape(response.checkout.message)}</p>${pickupSummary}${returnSummary}<p class="dr-help">Менеджер подтвердит даты и время вывоза и возврата.</p><p>Способ оплаты — ${escape(response.checkout.payment)}.</p><button class="dr-primary" type="button">Понятно</button>`;
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

  async function init() {
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
      installReview();
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
      const path = location.pathname.replace(/\/$/, '');
      if (isCheckout) window.flexbe_cli.events.on('cart_opened.druzhba-checkout-page', () => {
        if (checkoutForm) window.flexbe_cli.events.trigger('ui_cart_close');
      });
      if (path === '/order' || path === '/druzhba-dry-cleaning/order') {
        const heading = document.querySelector('h1');
        if (heading) {
          const launcher = document.createElement('div');
          launcher.className = 'dr-launcher';
          launcher.innerHTML = '<button class="dr-primary" type="button">Выбрать вещи</button>';
          launcher.querySelector('button').addEventListener('click', openSelector);
          const intro = heading.closest('[data-is="zone"]')?.querySelector('.text-style-subtitle');
          if (intro) {
            intro.parentElement.classList.add('dr-catalog-intro');
            intro.insertAdjacentElement('afterend', launcher);
          } else {
            heading.insertAdjacentElement('afterend', launcher);
          }
        }
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
