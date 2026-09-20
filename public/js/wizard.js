(function () {
  'use strict';
  const APP = window.APP;
  let lang = APP.lang || 'ta';
  let state = JSON.parse(JSON.stringify(APP.answers || {}));
  let stepIndex = 0;
  let latest = null;
  const stepsAll = APP.steps;
  const subtypes = APP.subtypes || {};
  const stylePreviews = APP.stylePreviews || {};
  const T = APP.i18n;

  function tl(o) { return o && o[lang] != null ? o[lang] : (o && o.en != null ? o.en : ''); }
  function tc(k) { return T[k] != null ? T[k] : k; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function evalShow(cond, st) {
    if (!cond || !cond.key) return true;
    const v = st[cond.key];
    if (cond.equals !== undefined) return v === cond.equals;
    if (cond.in) return cond.in.includes(v);
    if (cond.notIn) return !cond.notIn.includes(v);
    if (cond.includes !== undefined) return Array.isArray(v) && v.includes(cond.includes);
    return true;
  }
  function visibleSteps() { return stepsAll.filter((s) => evalShow(s.showIf, state)); }
  function fieldVisible(f) { return evalShow(f.showIf, state); }

  // ---------- Render ----------
  function render() {
    const vs = visibleSteps();
    if (stepIndex >= vs.length) stepIndex = vs.length - 1;
    if (stepIndex < 0) stepIndex = 0;
    const step = vs[stepIndex];
    const root = document.getElementById('wizard');
    root.innerHTML =
      `<div class="progress">${vs.map((s, i) => chip(s, i)).join('')}</div>` +
      `<div class="wizard-grid">` +
        `<div class="step-card">${stepHeader(step, vs)}${stepBody(step)}</div>` +
        `<div class="side">${sidebar()}</div>` +
      `</div>` +
      `<div class="sticky-nav">` +
        `<button class="btn" id="back" ${stepIndex === 0 ? 'disabled' : ''}>${tc('back')}</button>` +
        (stepIndex < vs.length - 1 ? `<button class="btn primary" id="next">${tc('next')}</button>` : '') +
      `</div>`;
    bindStep(step, vs);
    bindNav(vs);
    updatePreview();
  }

  function chip(s, i) {
    const cls = i === stepIndex ? 'active' : (i < stepIndex ? 'done' : '');
    return `<span class="chip ${cls}" data-i="${i}">${esc(tl(s.title))}</span>`;
  }
  function stepHeader(step, vs) {
    let extra = '';
    if (step.id === 5 && latest && latest.recommend) {
      const r = latest.recommend;
      extra = `<div class="flash info">AI பரிந்துரை / Recommendation: <b>${r.gender}</b> — ${esc(tl(r.reason))}</div>`;
    }
    return `<h2>${esc(tl(step.title))}</h2><div class="step-sub">${tc('step')} ${stepIndex + 1} ${tc('of')} ${vs.length}</div>${extra}`;
  }
  function stepBody(step) {
    if (step.type === 'dialogue') return dialogueBody(step);
    if (step.type === 'review') return reviewBody(step);
    return steps.fields ? fieldsBody(step) : '';
  }
  function fieldsBody(step) {
    return (step.fields || []).filter(fieldVisible).map(fieldHTML).join('');
  }

  function fieldHTML(f) {
    const key = f.key;
    const val = state[key];
    const label = `<label>${esc(tl(f.label))}</label>`;
    const help = f.help ? `<div class="help">${esc(tl(f.help))}</div>` : '';
    let control = '';
    switch (f.type) {
      case 'textarea':
        control = `<textarea data-key="${key}" placeholder="${f.placeholder ? esc(tl(f.placeholder)) : ''}">${esc(val || '')}</textarea>`;
        break;
      case 'select': {
        const opts = f.options || (f.dependsOn === 'category' && subtypes[state[f.dependsOn]] ? subtypes[state[f.dependsOn]] : []);
        control = `<select data-key="${key}"><option value="">—</option>` +
          opts.map((o) => `<option value="${esc(o.value)}" ${val === o.value ? 'selected' : ''}>${esc(tl(o.label))}</option>`).join('') + `</select>`;
        break;
      }
      case 'radio':
      case 'ratio':
        control = `<div class="opt-grid">` + f.options.map((o) =>
          `<span class="opt ${val === o.value ? 'sel' : ''}" data-key="${key}" data-val="${esc(o.value)}">${esc(tl(o.label))}</span>`).join('') + `</div>`;
        break;
      case 'multiselect':
      case 'stylecheck': {
        const arr = Array.isArray(val) ? val : [];
        control = `<div class="style-previews">` + f.options.map((o) => {
          const sel = arr.includes(o.value) ? 'sel' : '';
          const emo = stylePreviews[o.value] ? `<span class="emoji">${stylePreviews[o.value].emoji}</span>` : '';
          return `<span class="opt ${sel}" data-key="${key}" data-val="${esc(o.value)}" data-array="1">${emo}${esc(tl(o.label))}</span>`;
        }).join('') + `</div>`;
        break;
      }
      case 'toggle':
        control = `<label class="opt ${val ? 'sel' : ''}" data-key="${key}" data-bool="1"><input type="checkbox" ${val ? 'checked' : ''}> ${val ? 'On / ஆன்' : 'Off / ஆஃப்'}</label>`;
        break;
      case 'image':
        control = `<input type="file" data-key="${key}" data-img="1" accept="image/*" ${f.multiple ? 'multiple' : ''}><div class="img-preview" data-prev="${key}">${imgThumbs(val)}</div>`;
        break;
      default:
        control = `<input data-key="${key}" type="${f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : 'text'}" value="${esc(val || '')}" placeholder="${f.placeholder ? esc(tl(f.placeholder)) : ''}">`;
    }
    return `<div class="field">${label}${control}${help}</div>`;
  }
  function imgThumbs(v) {
    if (!v) return '';
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((x) => x && x.data ? `<img src="data:${x.mime || 'image/png'};base64,${x.data}">` : (x ? `<img src="/generated/..?">` : '')).join('');
  }

  function dialogueBody(step) {
    if (!state.dialogue && latest) state.dialogue = latest.dialogue;
    return `<h2>${esc(tl(step.title))}</h2>
      <p class="step-sub">இந்த டயலாக் ஓகேவா? / Is this dialogue OK?</p>
      <textarea id="dlg" style="min-height:200px" data-key="dialogue">${esc(state.dialogue || '')}</textarea>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        <button class="btn" id="regen">${tc('regenerate')}</button>
        <label class="opt ${state.dialogue_confirmed ? 'sel' : ''}" id="confirm"><input type="checkbox" ${state.dialogue_confirmed ? 'checked' : ''}> ${tc('confirm')} (இந்த டயலாக் ஓகேவா?)</label>
      </div>`;
  }

  function reviewBody(step) {
    const summary = summaryHTML();
    return `<h2>${esc(tl(step.title))}</h2>
      <h3>${tc('your_answers')}</h3>${summary}
      <h3>${tc('live_prompt')}</h3>
      <pre class="prompt-box">${latest ? esc(latest.prompt) : '…'}</pre>
      <p>Continuity: <b>${latest ? latest.continuity.score : 0}</b> · Credits: <b>${latest ? latest.credits.total : '—'}</b></p>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn" id="trial">${tc('free_trial')}</button>
        <button class="btn primary" id="full">${tc('full_video')}</button>
      </div>
      <div id="trial-ui"></div>`;
  }

  function labelFor(key) {
    for (const s of stepsAll) for (const f of (s.fields || [])) if (f.key === key) return tl(f.label);
    return key;
  }
  function summaryHTML() {
    let rows = '';
    for (const k of Object.keys(state)) {
      if (['dialogue', 'dialogue_confirmed'].includes(k)) continue;
      let v = state[k];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (typeof v === 'object') v = '(uploaded)';
      else if (Array.isArray(v)) v = v.join(', ');
      rows += `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #232c47"><div style="width:45%;color:var(--muted)">${esc(labelFor(k))}</div><div>${esc(String(v))}</div></div>`;
    }
    return `<div>${rows}</div>`;
  }

  function sidebar() {
    const m = latest ? latest.continuity : { score: 0, activeLocks: [], strictness: '' };
    const c = latest ? latest.credits : null;
    return `<h3>${tc('continuity')}</h3>
      <div class="meter-val">${m.score}</div>
      <div class="meter"><span style="width:${m.score}%"></span></div>
      <p class="help">${m.activeLocks.length} locks · ${m.strictness}</p>
      <h3>${tc('credit_estimate')}</h3>
      <div class="credit-big">${c ? c.total : '—'}</div>
      <h3>${tc('live_prompt')}</h3>
      <div class="prompt-box" id="prompt-box">${latest ? esc(latest.prompt) : '…'}</div>`;
  }

  // ---------- Bind ----------
  function bindStep(step, vs) {
    const root = document.getElementById('wizard');
    root.querySelectorAll('[data-key]').forEach((el) => {
      const key = el.getAttribute('data-key');
      if (el.dataset.img) return; // handled separately
      if (el.dataset.bool !== undefined) {
        el.addEventListener('click', (e) => {
          if (e.target.tagName === 'INPUT') return; // let checkbox toggle
          state[key] = !state[key];
          rerenderNeeded(key);
        });
        const inp = el.querySelector('input');
        if (inp) inp.addEventListener('change', () => { state[key] = inp.checked; rerenderNeeded(key); });
        return;
      }
      if (el.dataset.array !== undefined) {
        el.addEventListener('click', () => {
          const v = el.getAttribute('data-val');
          let arr = Array.isArray(state[key]) ? state[key].slice() : [];
          if (arr.includes(v)) arr = arr.filter((x) => x !== v); else arr.push(v);
          state[key] = arr;
          rerenderNeeded(key);
        });
        return;
      }
      if (el.dataset.val !== undefined) { // radio/ratio
        el.addEventListener('click', () => { state[key] = el.getAttribute('data-val'); rerenderNeeded(key); });
        return;
      }
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(evt, () => {
          state[key] = el.value;
          softUpdate();
        });
      }
    });
    // images
    root.querySelectorAll('[data-img]').forEach((el) => {
      el.addEventListener('change', () => handleFiles(el));
    });

    if (step.type === 'dialogue') bindDialogue();
    if (step.type === 'review') bindReview();
  }

  function rerenderNeeded(key) {
    // If any field's visibility depends on this key, re-render; otherwise soft update.
    let depends = false;
    for (const s of stepsAll) for (const f of (s.fields || [])) {
      if (f.showIf && f.showIf.key === key) depends = true;
    }
    // Also step 4 visibility depends on styles
    if (key === 'styles') depends = true;
    state && softUpdate();
    if (depends) render(); else { /* re-render current inputs selection */ render(); }
  }

  function handleFiles(el) {
    const key = el.getAttribute('data-key');
    const files = Array.from(el.files || []);
    const read = (file) => new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res({ filename: file.name, mime: file.type, data: r.result.split(',')[1] });
      r.readAsDataURL(file);
    });
    Promise.all(files.map(read)).then((objs) => {
      state[key] = el.multiple ? objs : objs[0];
      // update thumbnail preview without full re-render
      const prev = document.querySelector(`[data-prev="${key}"]`);
      if (prev) prev.innerHTML = imgThumbs(state[key]);
      softUpdate();
    });
  }

  function bindDialogue() {
    const ta = document.getElementById('dlg');
    if (ta) ta.addEventListener('input', () => { state.dialogue = ta.value; softUpdate(); });
    const regen = document.getElementById('regen');
    if (regen) regen.addEventListener('click', () => {
      fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: state }) })
        .then((r) => r.json()).then((d) => { state.dialogue = d.dialogue; if (ta) ta.value = d.dialogue; softUpdate(); });
    });
    const conf = document.getElementById('confirm');
    if (conf) conf.querySelector('input').addEventListener('change', (e) => { state.dialogue_confirmed = e.target.checked; conf.classList.toggle('sel', e.target.checked); softUpdate(); });
  }

  function bindReview() {
    const trial = document.getElementById('trial');
    const full = document.getElementById('full');
    if (full) full.addEventListener('click', () => generate('full'));
    if (trial) trial.addEventListener('click', () => showTrialUI());
  }

  function showTrialUI() {
    const ui = document.getElementById('trial-ui');
    ui.innerHTML = `
      <div class="card" style="margin-top:14px">
        <h3>${tc('free_trial')}</h3>
        <input id="mobile" placeholder="+91 9XXXXXXXXX" style="margin-bottom:10px">
        <button class="btn" id="sendotp">${tc('send_otp')}</button>
        <div id="otprow" style="display:none;margin-top:10px">
          <input id="otp" placeholder="OTP" style="margin-bottom:10px">
          <button class="btn primary" id="verifygen">${tc('verify_otp')} & ${tc('generate')}</button>
          <div id="devotp" class="help"></div>
        </div>
      </div>`;
    document.getElementById('sendotp').addEventListener('click', () => {
      const mobile = document.getElementById('mobile').value;
      fetch('/api/trial/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile }) })
        .then((r) => r.json()).then((d) => {
          if (!d.ok) { alert(d.error); return; }
          document.getElementById('otprow').style.display = 'block';
          if (d.devOtp) document.getElementById('devotp').textContent = 'Dev OTP: ' + d.devOtp;
        });
    });
    document.getElementById('verifygen').addEventListener('click', () => {
      const mobile = document.getElementById('mobile').value;
      const otp = document.getElementById('otp').value;
      fetch('/api/trial/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, otp }) })
        .then((r) => r.json()).then((d) => {
          if (!d.ok) { alert(d.error); return; }
          generate('trial', mobile, otp);
        });
    });
  }

  function generate(mode, mobile, otp) {
    const body = { mode, mobile: mobile || null, otp: otp || null };
    fetch('/api/orders/' + APP.orderId + '/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((r) => r.json()).then((d) => {
      if (!d.ok) { alert(d.error); return; }
      if (d.status === 'pending_approval') { alert('Awaiting character-sheet approval. Admin: POST /orders/' + d.orderId + '/approve'); }
      window.location.href = d.redirect;
    });
  }

  function bindNav(vs) {
    const back = document.getElementById('back');
    const next = document.getElementById('next');
    if (back) back.addEventListener('click', () => { stepIndex--; render(); });
    if (next) next.addEventListener('click', () => { stepIndex++; render(); });
    document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { stepIndex = parseInt(c.dataset.i, 10); render(); }));
  }

  // ---------- Persistence + preview ----------
  let pTimer = null, vTimer = null;
  function softUpdate() { // text changes: persist + preview without re-render
    clearTimeout(pTimer); pTimer = setTimeout(persist, 400);
    clearTimeout(vTimer); vTimer = setTimeout(updatePreview, 400);
  }
  function persist() {
    fetch('/api/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: APP.orderId, answers: state }) });
  }
  function updatePreview() {
    fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: state }) })
      .then((r) => r.json()).then((d) => {
        latest = d;
        const pb = document.getElementById('prompt-box');
        if (pb) pb.textContent = d.prompt;
        renderSidebarOnly();
      }).catch(() => {});
  }
  function renderSidebarOnly() {
    const side = document.querySelector('.side');
    if (side) side.innerHTML = sidebar();
    // update voice recommendation on step 5 if present
    if (latest && latest.recommend) {
      const sh = document.querySelector('.step-card .flash.info');
    }
  }

  window.toggleLang = function () {
    const n = lang === 'ta' ? 'en' : 'ta';
    document.cookie = 'lang=' + n + ';path=/;max-age=31536000';
    location.reload();
  };

  render();
})();
