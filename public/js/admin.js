(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    const test = e.target.closest && e.target.closest('.test-btn');
    if (test) { testSlot(test.dataset.id); return; }
    const save = e.target.closest && e.target.closest('.save-btn');
    if (save) { saveSlot(save.dataset.id); return; }
    const retry = e.target.closest && e.target.closest('.retry-btn');
    if (retry) { retryJob(retry.dataset.id, retry.dataset.order); return; }
  });

  function saveSlot(id) {
    const row = document.querySelector('tr[data-id="' + id + '"]');
    if (!row) return;
    const f = {};
    row.querySelectorAll('.Slot').forEach((inp) => {
      const k = inp.dataset.f;
      if (inp.type === 'checkbox') f[k] = inp.checked ? 1 : 0;
      else f[k] = inp.value;
    });
    f.id = id;
    fetch('/admin/api-slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      .then((r) => r.json()).then((d) => { alert(d.ok ? 'Saved' : 'Failed'); });
  }

  function testSlot(id) {
    fetch('/admin/api-slots/' + id + '/test', { method: 'POST' })
      .then((r) => r.json()).then((d) => {
        const row = document.querySelector('tr[data-id="' + id + '"]');
        if (row) row.querySelector('.testcell').textContent = d.status;
        alert((d.note || d.status));
      });
  }

  function retryJob(id, order) {
    fetch('/admin/jobs/' + id + '/retry', { method: 'POST' })
      .then((r) => r.json()).then((d) => { alert(d.ok ? 'Retried' : 'Failed: ' + (d.error || '')); location.reload(); });
  }

  window.toggleLang = window.toggleLang || function () {
    const m = document.cookie.match(/lang=(ta|en)/);
    const n = m && m[1] === 'ta' ? 'en' : 'ta';
    document.cookie = 'lang=' + n + ';path=/;max-age=31536000';
    location.reload();
  };
})();
