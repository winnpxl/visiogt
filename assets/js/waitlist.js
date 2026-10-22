(function () {
  'use strict';

  var tabs = Array.from(document.querySelectorAll('[data-audience][role="tab"]'));
  var params = new URLSearchParams(window.location.search);
  var source = (params.get('ref') || params.get('utm_source') || params.get('source') || '').trim();
  var attribution = {};
  ['ref', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
    if (params.has(key)) attribution[key] = params.get(key).slice(0, 200);
  });

  function selectAudience(audience, updateURL) {
    audience = audience === 'client' ? 'client' : 'talent';
    tabs.forEach(function (tab) {
      var active = tab.dataset.audience === audience;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
    if (updateURL) {
      var url = new URL(window.location.href);
      url.searchParams.set('audience', audience);
      history.pushState(null, '', url);
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      if (tab.getAttribute('aria-selected') !== 'true') selectAudience(tab.dataset.audience, true);
    });
    tab.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      tabs[next].focus();
      selectAudience(tabs[next].dataset.audience, true);
    });
  });
  selectAudience(params.get('audience'), false);
  window.addEventListener('popstate', function () {
    selectAudience(new URLSearchParams(window.location.search).get('audience'), false);
  });

  // Preserve the current form and campaign attribution when switching from the banner.
  document.querySelector('.announce__link').addEventListener('click', function (event) {
    event.preventDefault();
    selectAudience('client', true);
    tabs[1].focus();
  });

  var experience = document.getElementById('talent-experience');
  var portfolio = document.getElementById('talent-portfolio');
  function updatePortfolio() {
    portfolio.required = experience.value !== 'student';
    document.getElementById('portfolio-label').textContent = experience.value === 'student' ? 'Optional' : 'Optional for students';
    clearError(portfolio);
  }
  experience.addEventListener('change', updatePortfolio);
  updatePortfolio();

  function clearError(input) {
    input.setCustomValidity('');
    input.removeAttribute('aria-invalid');
    var error = document.getElementById(input.id + '-error');
    if (error) error.remove();
    var descriptions = (input.getAttribute('aria-describedby') || '').split(' ').filter(function (id) {
      return id && id !== input.id + '-error';
    });
    if (descriptions.length) input.setAttribute('aria-describedby', descriptions.join(' '));
    else input.removeAttribute('aria-describedby');
  }

  function showError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    var error = document.createElement('span');
    error.className = 'field-error';
    error.id = input.id + '-error';
    error.textContent = message;
    input.closest('.form-field, .form-consent').appendChild(error);
    input.setAttribute('aria-describedby', ((input.getAttribute('aria-describedby') || '') + ' ' + error.id).trim());
  }

  function validate(form) {
    var invalid = [];
    form.querySelectorAll('input:not([type="hidden"]), select').forEach(function (input) {
      clearError(input);
      if (input.disabled) return;
      if (input.type !== 'checkbox') input.value = input.value.trim();
      if (input.name === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
        input.setCustomValidity('Enter a valid email address, for example you@example.com.');
      }
      if (input.name === 'phone' && input.value && !/^\+[\d\s().-]{7,29}$/.test(input.value)) {
        input.setCustomValidity('Enter a phone number with a country code, for example +234 801 234 5678.');
      } else if (input.name === 'phone' && input.value && !/^\d{8,15}$/.test(input.value.replace(/\D/g, ''))) {
        input.setCustomValidity('Use a phone number with 8–15 digits, including the country code.');
      }
      if (input.name === 'portfolio' && input.value && !/^https?:\/\//i.test(input.value)) {
        input.setCustomValidity('Enter a full link starting with https:// or http://.');
      }
      if (!input.checkValidity()) {
        var message = input.validationMessage;
        if (input.validity.valueMissing) message = input.type === 'checkbox' ? 'Please agree before joining the waitlist.' : 'Please fill in this field.';
        if (input.validity.typeMismatch && input.type === 'email') message = 'Enter a valid email address.';
        showError(input, message);
        invalid.push(input);
      }
    });
    if (invalid.length) invalid[0].focus();
    return invalid.length === 0;
  }

  document.querySelectorAll('.waitlist-form').forEach(function (form) {
    form.noValidate = true;
    if (source) {
      var matchedSource = Array.from(form.elements.source.options).find(function (option) {
        return option.value !== 'other' && option.value.toLowerCase() === source.toLowerCase();
      });
      form.elements.source.value = matchedSource ? matchedSource.value : 'other';
      if (!matchedSource) form.elements.sourceOther.value = source.slice(0, 200);
    }
    form.querySelectorAll('select[data-other-input]').forEach(function (select) {
      var other = document.getElementById(select.dataset.otherInput);
      function updateOther() {
        var visible = select.value === 'other';
        other.closest('.form-field').hidden = !visible;
        other.disabled = !visible;
        other.required = visible;
        clearError(other);
      }
      select.addEventListener('change', updateOther);
      updateOther();
    });
    form.addEventListener('input', function (event) { if (event.target.id) clearError(event.target); });
    form.addEventListener('change', function (event) { if (event.target.id) clearError(event.target); });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      var feedback = form.querySelector('.form-feedback');
      feedback.hidden = true;
      if (!validate(form)) return;

      var payload = Object.fromEntries(new FormData(form));
      form.querySelectorAll('select[data-other-input]').forEach(function (select) {
        var other = document.getElementById(select.dataset.otherInput);
        if (select.value === 'other') payload[select.name] = other.value.trim();
        delete payload[other.name];
      });
      payload.consent = form.elements.consent.checked;
      payload.attribution = attribution;
      var originalLabel = button.innerHTML;
      button.disabled = true;
      button.textContent = 'Joining the waitlist…';
      form.setAttribute('aria-busy', 'true');
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        var result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error('Submission failed');
        var card = form.closest('.waitlist-form-card');
        var success = card.querySelector('.form-success');
        // Only the local preview server returns this flag. Never imply a preview signup reached the team.
        var message = result.preview
          ? 'Your ' + payload.audience + ' signup has been saved for this local preview. It has not been sent to the Visio team.'
          : 'Thanks for joining, ' + payload.fullName + '. Your details are in. We’ll be in touch at ' + payload.email + ' about the next steps.';
        success.querySelector('[data-success-message]').textContent = message;
        form.hidden = true;
        card.querySelector('.waitlist-form-heading').hidden = true;
        success.hidden = false;
        success.focus({ preventScroll: true });
        success.scrollIntoView({ block: 'center', behavior: 'instant' });
      } catch (error) {
        feedback.textContent = error.name === 'AbortError'
          ? 'This is taking longer than expected. Please try again. Your details are still here.'
          : 'We couldn’t confirm your signup. Please try again in a moment. Your details are still here.';
        feedback.hidden = false;
      } finally {
        clearTimeout(timeout);
        button.disabled = false;
        button.innerHTML = originalLabel;
        form.removeAttribute('aria-busy');
      }
    });
  });
})();
