/* Local presentation controls. No analytics, payment integration, or persistence. */
(() => {
  'use strict';
  const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const byId = id => document.getElementById(id);
  const display = (id, visible) => {
    const element = byId(id);
    if (element) {
      element.style.display = visible ? 'block' : 'none';
      element.setAttribute('aria-hidden', String(!visible));
    }
  };
  let lastFocus = null;
  let activePopup = null;

  function closePopups() {
    ['popup23', 'popup24', 'popup25', 'popup26', 'popup27', 'popup28',
      'popupCEPA2', 'popupOverlayCEPA2', 'popup171', 'overlay171', 'local-info-modal']
      .forEach(id => display(id, false));
    activePopup = null;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
  }

  function openPopup(id, overlay) {
    closePopups();
    lastFocus = document.activeElement;
    if (overlay) display(overlay, true);
    display(id, true);
    activePopup = byId(id);
    if (!activePopup) return;
    activePopup.setAttribute('role', 'dialog');
    activePopup.setAttribute('aria-modal', 'true');
    const focusable = activePopup.querySelector('button, input, [tabindex="0"]');
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function information(message, title = 'Informação') {
    let modal = byId('local-info-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'local-info-modal';
      modal.setAttribute('aria-labelledby', 'local-info-title');
      modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);padding:24px;overflow:auto';
      const panel = document.createElement('div');
      panel.style.cssText = 'box-sizing:border-box;margin:18vh auto 24px;max-width:440px;background:#fff;border-radius:8px;padding:32px;font-family:"Proxima Nova",Arial,sans-serif;color:#333;box-shadow:0 8px 40px #0003';
      const heading = document.createElement('h2');
      heading.id = 'local-info-title';
      heading.style.cssText = 'font-size:24px;line-height:1.25;margin:0 0 16px';
      const content = document.createElement('p');
      content.id = 'local-info-message';
      content.style.cssText = 'font-size:16px;line-height:1.5;margin:0 0 24px;overflow-wrap:anywhere';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'andes-button andes-button--loud';
      button.textContent = 'Entendi';
      button.style.cssText = 'background:#3483fa;color:white;border:0;border-radius:6px;padding:14px 24px;cursor:pointer;font:inherit';
      button.addEventListener('click', closePopups);
      panel.append(heading, content, button);
      modal.append(panel);
      modal.addEventListener('click', event => { if (event.target === modal) closePopups(); });
      document.body.append(modal);
    }
    byId('local-info-title').textContent = title;
    byId('local-info-message').textContent = message;
    openPopup('local-info-modal');
  }

  function sellerView() {
    const seller = byId('vendedor-item-get');
    const showSeller = seller && getComputedStyle(seller).display === 'none';
    display('product-item-get', !showSeller);
    display('vendedor-item-get', !!showSeller);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const actions = {
    paymentUnavailable: () => {},
    comprarAgora: () => {},
    toggleDisplay: sellerView,
    toggleDisplay2: sellerView,
    showPopupCEPA2: () => openPopup('popupCEPA2', 'popupOverlayCEPA2'),
    showPopupCEPA22: () => openPopup('popupCEPA2', 'popupOverlayCEPA2'),
    exibirPopup171: () => openPopup('popup171', 'overlay171'),
    exibirPopup17122: () => openPopup('popup171', 'overlay171'),
    closePopupCEPA2: closePopups,
    fecharPopup171: closePopups,
    fecharPopup1711: closePopups,
    ocultarSecao: () => display('minhaSecao', false),
    mostrarMensagem: () => display('quantity__messages1', true),
    mostrarMensagem11: () => display('sendmensage11', true),
    exibirmaisimgfooter: () => {
      display('blockimg1', false);
      display('blockimg2', true);
      display('sumirdomapaanimale', false);
    },
    toggleMenu: () => {
      all('.nav-header').forEach(header => {
        const expanded = header.classList.toggle('nav-header-menu-mobile-open');
        all('.nav-header-menu-switch', header).forEach(button => button.setAttribute('aria-expanded', String(expanded)));
      });
    }
  };
  [23, 24, 25, 26, 27, 28].forEach(number => {
    ['', 'A', 'B', 'C'].forEach(suffix => {
      actions[`openPopup${number}${suffix}`] = () => openPopup(`popup${number}`);
    });
    actions[`closePopup${number}`] = closePopups;
  });
  // Named functions also support the source's known, local onclick controls.
  Object.keys(actions).forEach(name => { window[name] = actions[name]; });

  function safeAsset(value) {
    if (!value) return false;
    const path = value.trim();
    return /^(?:\.?\.?\/|screen_files\/|assets\/)/i.test(path) && !/^\/\//.test(path)
      || /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(path);
  }

  function hydrateSnapshots() {
    // Some exports include inert source text; this snapshot already has result markup.
    for (let i = 1; i <= 26; i += 1) {
      const source = byId(`sourceCode${i}`);
      const selector = byId(`selector${i}`);
      const result = byId(`result${i}`);
      if (!source || !selector || !result || !source.value || !selector.value) continue;
      try {
        const template = document.createElement('template');
        template.innerHTML = source.value;
        all('script, iframe, object, embed, link, meta, base, style', template.content).forEach(node => node.remove());
        all('*', template.content).forEach(node => {
          Array.from(node.attributes).forEach(attribute => {
            const name = attribute.name.toLowerCase();
            if (name.startsWith('on') || ['srcdoc', 'action', 'formaction', 'ping', 'srcset', 'style'].includes(name)) node.removeAttribute(attribute.name);
            if (['src', 'data-src', 'href', 'xlink:href'].includes(name)
              && !attribute.value.startsWith('#') && !safeAsset(attribute.value)) node.removeAttribute(attribute.name);
          });
        });
        const selected = template.content.querySelector(selector.value);
        if (selected) result.replaceChildren(selected.cloneNode(true));
      } catch (_) { /* Keep the already rendered content if an export is incomplete. */ }
    }
  }

  function loadImages() {
    all('img[data-src]').forEach(img => {
      const source = img.getAttribute('data-src');
      if (safeAsset(source)) img.src = source.trim();
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
      img.removeAttribute('data-src-fallback');
      img.classList.remove('lazy-loadable', 'onload-loadable');
    });
  }

  function synchronizePresentation() {
    const title = byId('product-title');
    if (title && title.textContent.trim()) {
      all('h1.ui-pdp-title').forEach(heading => { heading.textContent = title.textContent.trim(); });
    }
    // The mirrored template kept prices from an unrelated listing in its hidden labels.
    // Derive those labels from the visible amount, preserving each displayed price.
    all('.andes-money-amount').forEach(amount => {
      const fraction = amount.querySelector('.andes-money-amount__fraction');
      if (!fraction) return;
      const visible = fraction.textContent.trim().replace(/R\$\s*/g, '').replace(/\s+/g, '');
      const cents = amount.querySelector('.andes-money-amount__cents');
      const digits = visible.replace(/\./g, '');
      const formatted = digits.includes(',') ? digits : `${digits},${cents ? cents.textContent.trim().padStart(2, '0') : '00'}`;
      if (!/^\d+,\d{2}$/.test(formatted)) return;
      const [whole, decimal] = formatted.split(',');
      const readable = `${whole} reais${decimal === '00' ? '' : ` e ${decimal} centavos`}`;
      all('.andes-visually-hidden', amount).filter(label => label.getAttribute('aria-hidden') !== 'true')
        .forEach(label => { label.textContent = `${amount.tagName === 'S' ? 'Preço anterior: ' : ''}${readable}`; });
      all('meta[itemprop="price"]', amount).forEach(meta => { meta.content = `${whole}.${decimal}`; });
    });
  }

  function desktopGallery() {
    all('.ui-pdp-gallery__column').forEach((column, galleryIndex) => {
      const controls = all('.ui-pdp-gallery__input', column);
      if (!controls.length) return;
      controls.forEach((radio, index) => {
        radio.removeAttribute('readonly');
        radio.name = `local-gallery-${galleryIndex}`;
        const wrapper = radio.nextElementSibling;
        if (!wrapper) return;
        const thumbnail = wrapper.querySelector('.ui-pdp-gallery__thumbnail img');
        const photo = wrapper.querySelector('.ui-pdp-gallery__figure__image');
        if (thumbnail && photo) photo.src = thumbnail.src;
        const label = wrapper.querySelector('label');
        if (label) {
          label.htmlFor = radio.id;
          label.setAttribute('tabindex', '0');
          label.setAttribute('role', 'button');
          label.setAttribute('aria-label', `Ver imagem ${index + 1}`);
          label.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); radio.checked = true; }
          });
        }
      });
      if (!controls.some(radio => radio.checked)) controls[0].checked = true;
    });
  }

  function mobileGallery() {
    all('.slick-carousel').forEach(slider => {
      const slides = Array.from(slider.children);
      if (!slides.length) return;
      const section = slider.closest('.ui-pdp-container__row') || slider.parentElement;
      const dots = section.querySelector('.slick-dots-container');
      const counter = section.querySelector('.pagination-current');
      const total = section.querySelector('.pagination-total');
      if (total) total.textContent = slides.length;
      if (dots) dots.replaceChildren();
      const setCurrent = index => {
        if (counter) counter.textContent = index + 1;
        if (dots) Array.from(dots.children).forEach((dot, dotIndex) => {
          dot.classList.toggle('active', dotIndex === index);
          dot.setAttribute('aria-current', String(dotIndex === index));
        });
      };
      const hasSlick = window.jQuery && typeof window.jQuery.fn.slick === 'function';
      const goTo = index => {
        if (hasSlick) window.jQuery(slider).slick('slickGoTo', index);
        else slider.scrollTo({ left: slider.clientWidth * index, behavior: 'smooth' });
        setCurrent(index);
      };
      slides.forEach((slide, index) => {
        slide.style.height = 'auto';
        all('img', slide).forEach(img => { img.style.aspectRatio = '1 / 1'; img.style.objectFit = 'contain'; });
        all('a[href="#"]', slide).forEach(link => link.addEventListener('click', event => event.preventDefault()));
        if (!dots) return;
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'slick-dot';
        dot.style.cssText = 'padding:0;border:0;flex-shrink:0';
        dot.setAttribute('aria-label', `Ver imagem ${index + 1}`);
        dot.addEventListener('click', () => goTo(index));
        dots.append(dot);
      });
      if (hasSlick) {
        const jq = window.jQuery(slider);
        jq.on('afterChange.localUI', (_event, _slick, index) => setCurrent(index));
        if (!jq.hasClass('slick-initialized')) jq.slick({ infinite: true, slidesToShow: 1, slidesToScroll: 1, dots: false, arrows: false, speed: 300, accessibility: true });
      } else {
        slider.style.cssText += ';display:flex;overflow-x:auto;scroll-snap-type:x mandatory';
        slides.forEach(slide => { slide.style.cssText += ';width:100%;flex:0 0 100%;scroll-snap-align:start'; });
        slider.addEventListener('scroll', () => setCurrent(Math.round(slider.scrollLeft / Math.max(slider.clientWidth, 1))), { passive: true });
      }
      setCurrent(0);
    });
  }

  function bindPresentation() {
    document.addEventListener('click', event => {
      const control = event.target.closest('[data-ui-action]');
      if (!control) return;
      const action = actions[control.dataset.uiAction];
      if (!action) return;
      event.preventDefault();
      action();
    });
    all('[id="ds2"], [data-ui-action="paymentUnavailable"]').forEach(button => {
      button.type = 'button';
      button.removeAttribute('onclick');
      button.dataset.uiAction = 'paymentUnavailable';
    });
    all('form').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.matches('.ui-pdp-buybox')) actions.paymentUnavailable();
      else if (form.matches('.nav-search')) information('A busca está indisponível no momento.');
    }));
    all('#consultaCEPA2, #bntCEPA1').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      information('A consulta de entrega está indisponível no momento.');
    }));
    ['popupOverlayCEPA2', 'overlay171'].forEach(id => { const overlay = byId(id); if (overlay) overlay.addEventListener('click', closePopups); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closePopups();
      if (event.key !== 'Tab' || !activePopup) return;
      const controls = all('button, a[href], input, [tabindex="0"]', activePopup).filter(node => !node.disabled && node.getClientRects().length);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
    });
    all('#nav-footer-access-switch').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      const footer = button.closest('.nav-footer-access') || document.querySelector('.nav-footer-access');
      if (!footer) return;
      const expanded = footer.classList.toggle('nav-footer-access-expanded');
      footer.classList.toggle('nav-footer-access-collapsed', !expanded);
      button.setAttribute('aria-expanded', String(expanded));
    }));
    all('.ui-pdp-bookmark__link-bookmark').filter(node => node.matches('button, a')).forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      const selected = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(selected));
      all('svg, svg g, svg use', button).forEach(svg => { svg.style.fill = selected ? '#3483fa' : ''; });
    }));
    all('.ui-pdp-share__link, .ui-pdp-share__link__label').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      information(window.location.origin + window.location.pathname, 'Compartilhar');
    }));
    [['descer1', 'baixo1'], ['descer2', 'baixo2'], ['buski', 'enconetr55']].forEach(([from, to]) => {
      const control = byId(from);
      const target = byId(to);
      if (control && target) control.addEventListener('click', event => { event.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); });
    });
    all('#exibirmaisimgfooter, #sumirdomapaanimale').forEach(button => button.addEventListener('click', event => { event.preventDefault(); actions.exibirmaisimgfooter(); }));
    all('[aria-controls]').forEach(button => {
      if (button.matches('[data-ui-action]')) return;
      const target = byId(button.getAttribute('aria-controls'));
      if (!target || !button.hasAttribute('aria-expanded')) return;
      button.addEventListener('click', event => {
        event.preventDefault();
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded));
        target.hidden = !expanded;
        target.style.display = expanded ? 'block' : 'none';
      });
    });
    all('.ui-pdp-variations__box__variant').forEach(item => item.addEventListener('click', () => {
      const name = item.getAttribute('data-variant-name');
      const variant = item.getAttribute('data-variant-id');
      if (byId('selected-variant-span45') && name) byId('selected-variant-span45').textContent = name;
      if (byId('variante1-true') && variant) byId('variante1-true').value = variant;
      all('.ui-pdp-variations__box__variant').forEach(other => { other.style.border = other === item ? '2px solid #3483fa' : 'none'; });
    }));
    const reviewCarousel = byId('carouselWrapper');
    if (reviewCarousel) {
      let current = 0;
      const previous = byId('prevButton');
      const next = byId('nextButton');
      const update = direction => {
        current = Math.max(0, Math.min(current + direction, reviewCarousel.children.length - 1));
        const first = reviewCarousel.firstElementChild;
        if (first) reviewCarousel.style.transform = `translateX(-${current * (first.getBoundingClientRect().width + 12)}px)`;
        if (previous) previous.disabled = current === 0;
        if (next) next.disabled = current >= reviewCarousel.children.length - 1;
      };
      if (previous) previous.addEventListener('click', () => update(-1));
      if (next) next.addEventListener('click', () => update(1));
      update(0);
    }
    display('finalizandoCEO', false);
  }

  function init() {
    hydrateSnapshots();
    closePopups();
    synchronizePresentation();
    loadImages();
    desktopGallery();
    mobileGallery();
    bindPresentation();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
