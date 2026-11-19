(() => {
  function identity(form, data) {
    const snapshot = JSON.stringify([data.id, data.fields, data.products, data.druzhba_checkout]);
    if (form.druzhbaSnapshot !== snapshot) {
      form.druzhbaSnapshot = snapshot;
      form.druzhbaRequest = crypto.randomUUID();
    }
    return form.druzhbaRequest;
  }
  window.DruzhbaForms = {
    prepare(instance, request) {
      const form = instance.$form[0];
      if (form.hasAttribute('data-cart') && window.DruzhbaCheckout?.read(form)) {
        request.druzhba_checkout = window.DruzhbaCheckout.read(form);
        request.products = window.DruzhbaCheckout.enrichProducts(request.products);
      }
      request.druzhba_request_id = identity(form, request);
      request.druzhba_path = location.pathname;
      request.druzhba_consent = Array.from(form.querySelectorAll('.policy-data-warning__input')).some(input => input.checked);
      return request;
    },
    quiz(instance, request) {
      const form = instance.$form[0];
      const holder = form.closest('[data-is="modal"][data-id], [data-is="block"][data-id]');
      if (holder) request.id = holder.dataset.is === 'block' ? 'quiz-block-' + holder.dataset.id : holder.dataset.id;
      request.utmData = JSON.stringify(window.flexbe_cli?.utm?.data || {});
      if (window.roistat?.visit) request.roistatVisit = window.roistat.visit;
      return this.prepare(instance, request);
    },
    valid(instance) {
      return window.DruzhbaCheckout?.validate(instance.$form[0]) !== false;
    },
    error(instance, error) {
      window.DruzhbaCheckout?.error(instance.$form[0], error?.data?.message || error?.message);
    },
    done(instance, request, response) {
      if (request.druzhba_checkout && response?.checkout) {
        instance.action = response.pay ? 'pay' : 'close';
        window.DruzhbaCheckout?.submitted(instance.$form[0], response);
      }
      delete instance.$form[0].druzhbaSnapshot;
      delete instance.$form[0].druzhbaRequest;
      delete request.druzhba_request_id;
      delete request.druzhba_path;
      delete request.druzhba_consent;
      delete request.druzhba_checkout;
    },
  };
})();

(() => {
  function explain() {
    let dialog = document.getElementById('druzhba-preview-notice');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'druzhba-preview-notice';
      dialog.className = 'dr-confirmation';
      dialog.setAttribute('aria-labelledby', 'druzhba-preview-title');
      dialog.innerHTML = '<h2 id="druzhba-preview-title">Демонстрация оформления</h2><p>Это версия для просмотра. Заявка не отправлена, оплата не проводится.</p><button class="dr-primary" type="button">Понятно</button>';
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      document.body.append(dialog);
    }
    if (!dialog.open) dialog.showModal();
  }
  const validate = window.DruzhbaForms.valid.bind(window.DruzhbaForms);
  window.DruzhbaForms.valid = instance => {
    if (!validate(instance)) return false;
    explain();
    return false;
  };
  function blocked(raw, method) {
    const url = new URL(raw, location.href);
    return /\/lead\/send|\/payments?\//.test(url.pathname) ||
      (!/^(GET|HEAD)$/i.test(method) && /^(xn--80aaclkjaqq8bhmrs6a\.xn--p1ai|химчисткадружба\.рф)$/.test(url.hostname));
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    if (blocked(typeof input === 'string' || input instanceof URL ? input : input.url, init.method || input.method || 'GET')) {
      explain();
      return Promise.resolve(new Response(JSON.stringify({error: true, message: 'Демонстрация: заявка не отправлена'}), {status: 409, headers: {'Content-Type': 'application/json'}}));
    }
    return originalFetch(input, init);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.druzhbaPreviewBlocked = blocked(url, method);
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if (this.druzhbaPreviewBlocked) {
      explain();
      this.abort();
      this.dispatchEvent(new Event('error'));
      return;
    }
    return originalSend.call(this, body);
  };
})();
