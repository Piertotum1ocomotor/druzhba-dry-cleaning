(() => {
  'use strict';

  const draftKey = 'druzhba_checkout_v1';
  const contactsKey = 'druzhba_checkout_contacts_v1';
  const money = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 2});
  const initialDraft = {payment: 'cash', pickup: {mode: 'phone', address: '', date: '', window: 'any'}};
  let options;
  let selector;
  let activeCategory = '';
  let search = '';
  let returnFocus;
  let returnToCart = false;
  let draft = initialDraft;

  try {
    const saved = JSON.parse(localStorage.getItem(draftKey));
    if (saved && saved.pickup && ['cash', 'online', 'manager'].includes(saved.payment)) {
      draft = saved;
    }
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

  function draftFrom(form) {
    const root = form.querySelector('.dr-checkout');
    if (!root) return null;
    return {
      payment: root.querySelector('[data-payment]:checked')?.value || 'cash',
      pickup: {
        mode: root.querySelector('[data-pickup-mode]').value,
        address: root.querySelector('[data-pickup-address]').value.trim(),
        date: root.querySelector('[data-pickup-date]').value,
        window: root.querySelector('[data-pickup-window]').value,
      },
    };
  }

  function saveDraft(form) {
    draft = draftFrom(form);
    try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch (_) {}
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
    panel.querySelector('[data-pickup-mode]').value = draft.pickup.mode === 'requested' ? 'requested' : 'phone';
    panel.querySelector('[data-pickup-address]').value = draft.pickup.address || '';
    panel.querySelector('[data-pickup-date]').value = draft.pickup.date || '';
    panel.querySelector('[data-pickup-window]').value = draft.pickup.window || 'any';
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
    root.querySelector('[data-pickup-details]').hidden = !requested;
    for (const control of root.querySelectorAll('[data-pickup-address], [data-pickup-date]')) {
      control.required = requested;
      control.disabled = !requested;
    }
    root.querySelector('[data-pickup-window]').disabled = !requested;
    const estimate = provisional();
    const status = root.querySelector('[data-checkout-note]');
    const online = root.querySelector('[data-payment][value="online"]');
    online.disabled = !options.onlineAvailable && !estimate;
    if (estimate) {
      status.textContent = 'Стоимость предварительная. Итоговую сумму согласуем после приёмки вещей. Способ оплаты сохраним, сейчас списания не будет.';
    } else if (!options.onlineAvailable) {
      status.textContent = 'Онлайн-оплата временно недоступна. Можно оформить заказ с оплатой наличными или согласовать её с менеджером.';
    } else {
      status.textContent = value.payment === 'online' ? 'После оформления вы перейдёте к оплате на странице Т-Банка.' : '';
    }
    status.hidden = !status.textContent;
    const buttonLabel = form.querySelector('.form-button .btn-text, .form-button .text');
    if (buttonLabel) {
      buttonLabel.textContent = estimate ? 'Отправить на согласование' : value.payment === 'online' ? 'Перейти к оплате' : 'Отправить заказ';
    }
    const totalLabel = form.closest('.widget-cart')?.querySelector('.cart-checkout-summary__text p');
    if (totalLabel) totalLabel.textContent = estimate ? 'Предварительно от' : 'Итого';
  }

  function enhanceForm(form) {
    if (form.querySelector('.dr-checkout')) return;
    const panel = document.createElement('div');
    panel.className = 'dr-checkout';
    const windows = Object.entries(options.windows).map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('');
    panel.innerHTML = `
      <button class="dr-text-button" type="button" data-add-items>Добавить вещи</button>
      <fieldset class="dr-fieldset">
        <legend>Вывоз вещей</legend>
        <label class="dr-field">Дата и время вывоза
          <select data-pickup-mode>
            <option value="phone">Согласовать по телефону</option>
            <option value="requested">Указать адрес и удобное время</option>
          </select>
        </label>
        <div data-pickup-details hidden>
          <label class="dr-field">Адрес вывоза
            <input data-pickup-address type="text" autocomplete="street-address" maxlength="500" placeholder="Улица, дом, квартира, подъезд">
          </label>
          <div class="dr-field-row">
            <label class="dr-field">Желаемая дата
              <input data-pickup-date type="date" min="${options.today}" max="${options.maxDate}">
            </label>
            <label class="dr-field">Удобное время
              <select data-pickup-window>${windows}</select>
            </label>
          </div>
          <p class="dr-help">Менеджер подтвердит время вывоза.</p>
        </div>
      </fieldset>
      <fieldset class="dr-fieldset">
        <legend>Способ оплаты</legend>
        <label class="dr-radio"><input data-payment type="radio" value="online"><span>Онлайн через Т-Банк</span></label>
        <label class="dr-radio"><input data-payment type="radio" value="cash"><span>Наличными курьеру</span></label>
        <label class="dr-radio"><input data-payment type="radio" value="manager"><span>Согласовать с менеджером</span></label>
      </fieldset>
      <p class="dr-help" data-checkout-note hidden></p>
      <p class="dr-error" data-checkout-error role="alert" hidden></p>`;
    const formId = 'dr-payment-' + document.querySelectorAll('.dr-checkout').length;
    for (const input of panel.querySelectorAll('[data-payment]')) input.name = formId;
    const submit = form.querySelector('.form-submit');
    form.insertBefore(panel, submit);
    applyDraft(form);
    restoreContacts(form);
    form.addEventListener('input', event => {
      if (contactControls(form).includes(event.target)) saveContacts(form);
    });
    form.addEventListener('change', event => {
      if (contactControls(form).includes(event.target)) saveContacts(form);
    });
    form.addEventListener('reset', () => setTimeout(() => applyDraft(form), 0));
    panel.querySelector('[data-add-items]').addEventListener('click', openSelector);
    for (const event of ['input', 'change']) {
      panel.addEventListener(event, () => {
        showError(form, '');
        saveDraft(form);
        refreshForm(form);
      });
    }
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
      await window.flexbe_cli.events.trigger('ui_cart_open');
      document.querySelector('.widget-cart form[data-cart] input:not([type="hidden"]):not([type="submit"])')?.focus({preventScroll: true});
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
    if (!selector) return;
    const list = items();
    const count = list.reduce((total, item) => total + Number(item.count || 0), 0);
    const total = list.reduce((total, item) => total + Number(item.price || 0) * Number(item.count || 0), 0);
    const estimate = provisional();
    selector.querySelector('[data-summary-total]').textContent = (estimate ? 'Предварительно от ' : '') + money.format(total);
    selector.querySelector('[data-summary-count]').textContent = count ? 'В заказе: ' + count : 'Выберите вещи для заказа';
    selector.querySelector('[data-summary-estimate]').hidden = !estimate;
    selector.querySelector('[data-continue]').disabled = !count;
    document.querySelectorAll('form[data-cart]').forEach(refreshForm);
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
    dialog.innerHTML = `<h2 id="dr-confirmation-title">${title}</h2><p class="dr-help">Заказ №${Number(response.lead_id)}</p><p>${escape(response.checkout.message)}</p>${pickupSummary}<p>Способ оплаты — ${escape(response.checkout.payment)}.</p><button class="dr-primary" type="button">Понятно</button>`;
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
      if (!form.querySelector('.dr-checkout')) return true;
      showError(form, '');
      for (const input of form.querySelectorAll('.dr-checkout input')) {
        if (!input.checkValidity()) { input.reportValidity(); return false; }
      }
      if (draftFrom(form).payment === 'online' && !options.onlineAvailable && !provisional()) {
        showError(form, 'Онлайн-оплата временно недоступна. Выберите другой способ оплаты.');
        return false;
      }
      return true;
    },
    error: showError,
    submitted(form, response) {
      try { localStorage.removeItem(draftKey); } catch (_) {}
      try { sessionStorage.removeItem(contactsKey); } catch (_) {}
      draft = initialDraft;
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
      document.querySelectorAll('form[data-cart]').forEach(enhanceForm);
      cartStore().on('dispatch.druzhba-checkout', () => {
        restoreCartImages();
        updateSummary();
      });
      window.flexbe_cli.events.on('cart_opened.druzhba-checkout', () => document.querySelectorAll('form[data-cart]').forEach(form => {
        restoreContacts(form);
        refreshForm(form);
      }));
      const path = location.pathname.replace(/\/$/, '');
      if (path === '/order' || path === '/druzhba-dry-cleaning/order') {
        const heading = document.querySelector('h1');
        if (heading) {
          const launcher = document.createElement('div');
          launcher.className = 'dr-launcher';
          launcher.innerHTML = '<button class="dr-primary" type="button">Выбрать вещи и дату вывоза</button>';
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
