(() => {
  const languageButton = document.querySelector('#language');
  const form = document.querySelector('#registration-form');
  const status = document.querySelector('#form-status');
  const unavailable = document.querySelector('#registration-unavailable');
  const success = document.querySelector('#registration-success');
  let language = sessionStorage.getItem('kiro-language') === 'en' ? 'en' : 'zh';
  const strings = {
    zh: { invalid: '请填写必填项，并同意信息使用说明。', sending: '正在提交…', failure: '暂时无法提交，请稍后重试。' },
    en: { invalid: 'Please complete the required fields and consent.', sending: 'Submitting…', failure: 'Could not submit your registration. Please try again later.' }
  };
  function setLanguage(next) {
    language = next;
    sessionStorage.setItem('kiro-language', next);
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-zh][data-en]').forEach(node => { node.textContent = node.dataset[next].replace(/\\n/g, '\n'); });
    document.querySelectorAll('[data-placeholder-zh]').forEach(node => { node.placeholder = node.dataset[next === 'zh' ? 'placeholderZh' : 'placeholderEn']; });
    document.querySelectorAll('[data-aria-zh]').forEach(node => { node.setAttribute('aria-label', node.dataset[next === 'zh' ? 'ariaZh' : 'ariaEn']); });
    document.querySelectorAll('[data-alt-zh]').forEach(node => { node.alt = node.dataset[next === 'zh' ? 'altZh' : 'altEn']; });
    languageButton.textContent = next === 'zh' ? 'EN' : '中文';
    languageButton.setAttribute('aria-label', next === 'zh' ? 'Switch to English' : '切换为中文');
    if (status) status.textContent = '';
  }
  languageButton.addEventListener('click', () => setLanguage(language === 'zh' ? 'en' : 'zh'));
  setLanguage(language);
  const feed = document.querySelector('#announcement-feed');
  if (feed) fetch('./api/announcements', {cache:'no-store'}).then(response => {
    if (!response.ok) throw new Error('Announcements unavailable');
    return response.json();
  }).then(result => {
    if (!Array.isArray(result.announcements) || !result.announcements.length) return;
    result.announcements.forEach(item => {
      const card = document.createElement('article'); card.className = 'card public-announcement';
      const title = document.createElement('h3'), body = document.createElement('p'), date = document.createElement('time');
      title.textContent = item.title; body.textContent = item.body;
      date.dateTime = item.published_at;
      date.textContent = new Date(item.published_at).toLocaleDateString('zh-CN', {timeZone:'Asia/Shanghai'});
      card.append(date, title, body); feed.append(card);
    });
    document.querySelector('#announcements').hidden = false;
  }).catch(() => {});
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) { status.textContent = strings[language].invalid; return; }
    const data = new FormData(form);
    const payload = {
      name: data.get('name'), affiliation: data.get('affiliation'), contact: data.get('contact'),
      role: data.get('role'), team_status: data.get('team_status'), team_name: data.get('team_name'),
      track: data.get('track'), message: data.get('message'), website: data.get('website'),
      consent: data.get('consent') === 'on'
    };
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    status.textContent = strings[language].sending;
    try {
      const response = await fetch('./api/registrations', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error('Registration failed');
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({block:'center'});
    } catch (_) { status.textContent = strings[language].failure; }
    finally { button.disabled = false; }
  });
  fetch('./api/status', {cache:'no-store'}).then(response => {
    if (!response.ok) throw new Error('Service unavailable');
    return response.json();
  }).then(result => {
    if (!result.registration_open) { form.hidden = true; unavailable.hidden = false; }
  }).catch(() => { form.hidden = true; unavailable.hidden = false; });
})();
