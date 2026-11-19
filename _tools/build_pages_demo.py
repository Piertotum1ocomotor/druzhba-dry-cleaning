"""Build a non-submitting GitHub Pages review from the original mirrored sources."""
from pathlib import Path
from types import SimpleNamespace
import argparse
import hashlib
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = '/druzhba-dry-cleaning'


def build(output):
    output = output.resolve()
    if output == ROOT or ROOT.is_relative_to(output):
        raise ValueError('Use a separate output directory')
    output.mkdir(parents=True, exist_ok=True)
    for source in ROOT.iterdir():
        if source.name.startswith('.') or source.name in {'_server', '_tools', '_tests', 'README.md', output.name}:
            continue
        target = output / source.name
        if source.is_dir():
            shutil.copytree(source, target, dirs_exist_ok=True)
        else:
            shutil.copy2(source, target)
    (output / '.nojekyll').touch()

    server = ROOT / '_server'
    sys.path.insert(0, str(server))
    import checkout
    config = json.loads((server / 'config.json').read_text())
    catalogue = checkout.catalog_options(SimpleNamespace(
        config=config, catalog=config['catalog']['products'], bank=SimpleNamespace(active=False)))
    for product in catalogue['products']:
        if product['image']:
            product['image'] = BASE + product['image']
        for variant in product['variants']:
            if variant['image']:
                variant['image'] = BASE + variant['image']
    (output / '_s/druzhba-catalog.json').write_text(json.dumps(catalogue, ensure_ascii=False))

    selector = (server / 'selector.js').read_text()
    selector = selector.replace("fetch('/api/order/catalog'", "fetch('" + BASE + "/_s/druzhba-catalog.json'")
    selector = selector.replace('options = await response.json();', '''options = await response.json();
      const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Yekaterinburg', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
      const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
      options.today = `${date.year}-${date.month}-${date.day}`;
      const maximum = new Date(options.today + 'T12:00:00Z');
      maximum.setUTCDate(maximum.getUTCDate() + 90);
      options.maxDate = maximum.toISOString().slice(0, 10);''')
    (output / '_s/druzhba-checkout.js').write_text(selector)
    shutil.copy2(server / 'checkout.css', output / '_s/druzhba-checkout.css')

    preview_guard = r'''
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
'''
    (output / '_s/druzhba-server.js').write_text((server / 'browser.js').read_text() + preview_guard)
    version = hashlib.sha256((selector + (server / 'checkout.css').read_text()).encode()).hexdigest()[:12]
    bootstrap = (f'import "{BASE}/_s/druzhba-server.js?v={version}";\n'
                 f'import "{BASE}/_s/druzhba-checkout.js?v={version}";\n'
                 'const checkoutStyles = document.createElement("link");\n'
                 'checkoutStyles.rel = "stylesheet";\n'
                 f'checkoutStyles.href = "{BASE}/_s/druzhba-checkout.css?v={version}";\n'
                 'document.head.append(checkoutStyles);\n')
    entry_url = f'{BASE}/_s/druzhba-preview-entry.mjs?v={version}'
    (output / '_s/druzhba-preview-entry.mjs').write_text(bootstrap)
    pages = modules = 0
    for file in output.rglob('*'):
        if not file.is_file():
            continue
        if file.suffix == '.html':
            markup = file.read_text()
            if '</head>' in markup:
                if file.relative_to(output).as_posix() in {'index.html', 'order/index.html', 'checkout/index.html'}:
                    file.write_text(markup.replace('</head>', f'<script type="module" src="{entry_url}"></script></head>', 1))
                pages += 1
        elif file.suffix in {'.js', '.mjs'} and file.name not in {'druzhba-server.js', 'druzhba-checkout.js'}:
            source = file.read_text()
            if 'i.jsform=448312' in source:
                source = source.replace('i.jsform=448312', 'window.DruzhbaForms.prepare(this,i);i.jsform=448312')
                source = re.sub(r'((?:await )?this\.showDone\(i,([a-z]+)\))', r'(window.DruzhbaForms.done(this,i,\2),\1)', source)
                anchor = 'async sendForm(t=!1){'
                if anchor not in source:
                    raise ValueError('Native form interception anchor missing: ' + str(file))
                source = source.replace(anchor, anchor + 'if(!window.DruzhbaForms.valid(this))return!1;')
                source = source.replace('async sendFormError(t){', 'async sendFormError(t){window.DruzhbaForms.error(this,t);')
                source = re.sub(r'(async initCaptcha\([^)]*\)\{)', r'\1return;', source)
                file.write_text(source)
                modules += 1
    core = output / '_s/build/theme/4/_core.mjs'
    core.write_text(f'import "{entry_url}";\n' + core.read_text())
    if pages < 25 or modules < 1:
        raise ValueError('Missing expected mirrored pages or native form modules')
    print(f'Pages preview: {pages} pages, {modules} native form modules, {len(catalogue["products"])} products')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    build(parser.parse_args().output)
