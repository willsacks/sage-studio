/**
 * Builds a <script> tag that intercepts submissions for any <form
 * data-sage-form="true"> on an imported HTML page, posting them to
 * /api/form-submit so they show up in Sage Studio's Form Submissions —
 * the same place block-builder forms already land. Forms without that
 * attribute (the artist didn't opt in) are left completely untouched.
 *
 * Runs inside the page's own sandboxed iframe, so the endpoint must be an
 * absolute URL rather than relying on the iframe's ambiguous base URL.
 */
export function buildFormCaptureScript(siteSlug: string): string {
  const endpoint = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://sagestudio.org"}/api/form-submit`;

  return `<script>(function(){
    var ENDPOINT = ${JSON.stringify(endpoint)};
    var SITE_SLUG = ${JSON.stringify(siteSlug)};

    function labelFor(field) {
      if (field.id) {
        var byFor = document.querySelector('label[for="' + field.id.replace(/"/g, '\\\\"') + '"]');
        if (byFor && byFor.textContent.trim()) return byFor.textContent.trim();
      }
      var wrapping = field.closest('label');
      if (wrapping && wrapping.textContent.trim()) return wrapping.textContent.trim();
      if (field.placeholder) return field.placeholder;
      return (field.name || 'Field').replace(/[_-]+/g, ' ').replace(/\\b\\w/g, function(c){ return c.toUpperCase(); });
    }

    function collect(form) {
      var fields = form.querySelectorAll('input[name], select[name], textarea[name]');
      var seen = {};
      var questions = [];
      var answers = {};
      fields.forEach(function(field) {
        if (field.type === 'submit' || field.type === 'button' || field.type === 'image' || field.type === 'file') return;
        if ((field.type === 'checkbox' || field.type === 'radio') && !field.checked) return;
        var name = field.name;
        if (seen[name]) {
          answers[name] = answers[name] + ', ' + field.value;
          return;
        }
        seen[name] = true;
        questions.push({ id: name, label: labelFor(field), type: field.tagName.toLowerCase() === 'select' ? 'select' : (field.type || 'text') });
        answers[name] = field.value;
      });
      return { questions: questions, answers: answers };
    }

    function attach(form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var data = collect(form);
        if (Object.keys(data.answers).length === 0) return;

        var submitBtn = form.querySelector('[type="submit"]');
        var originalText = submitBtn ? submitBtn.textContent : null;
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

        var existingError = form.querySelector('.__sage_form_error__');
        if (existingError) existingError.remove();

        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formTitle: document.title || 'Imported Form',
            siteSlug: SITE_SLUG,
            answers: data.answers,
            questions: data.questions
          })
        }).then(function(res) {
          if (!res.ok) throw new Error('failed');

          var thanks = document.createElement('div');
          thanks.textContent = 'Thanks! Your message has been sent.';
          thanks.style.cssText = 'padding:1.5rem 0;font-family:system-ui,sans-serif;font-size:1rem;color:#16a34a;text-align:center;opacity:0;transition:opacity 0.3s ease;';
          form.style.transition = 'opacity 0.3s ease';
          form.style.opacity = '0';

          setTimeout(function() {
            form.style.display = 'none';
            form.insertAdjacentElement('afterend', thanks);
            requestAnimationFrame(function() { thanks.style.opacity = '1'; });
          }, 300);

          setTimeout(function() {
            thanks.style.opacity = '0';
            setTimeout(function() {
              thanks.remove();
              form.reset();
              if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
              form.style.display = '';
              form.style.opacity = '0';
              requestAnimationFrame(function() { form.style.opacity = '1'; });
            }, 300);
          }, 4000);
        }).catch(function() {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
          var err = document.createElement('div');
          err.className = '__sage_form_error__';
          err.textContent = 'Something went wrong. Please try again.';
          err.style.cssText = 'margin-top:0.5rem;font-family:system-ui,sans-serif;font-size:0.85rem;color:#dc2626;';
          form.appendChild(err);
        });
      });
    }

    document.querySelectorAll('form[data-sage-form="true"]').forEach(attach);
  })();</script>`;
}

/** Appends the capture script before </body>, or at the end if there's no closing body tag. */
export function injectFormCaptureScript(html: string, siteSlug: string): string {
  if (!html.includes('data-sage-form="true"')) return html;
  const script = buildFormCaptureScript(siteSlug);
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${script}</body>`) : `${html}${script}`;
}
