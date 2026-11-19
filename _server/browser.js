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
