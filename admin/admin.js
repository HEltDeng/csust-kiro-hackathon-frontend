(() => {
  const $ = selector => document.querySelector(selector);
  const state = { csrf: '', registrations: [], announcements: [], editing: null, selectedRegistration: null };
  const login = $('#login-view'), app = $('#app-view'), logout = $('#logout');
  const status = (form, message) => { form.querySelector('.status').textContent = message; };
  const formatDate = date => date ? new Date(date).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : '—';
  async function api(path, data) {
    const options = {cache:'no-store', credentials:'same-origin'};
    if (data !== undefined) {
      options.method = 'POST';
      options.headers = {'Content-Type':'application/json'};
      if (state.csrf) options.headers['X-CSRF-Token'] = state.csrf;
      options.body = JSON.stringify(data);
    }
    let response;
    try { response = await fetch('../api/admin/' + path, options); }
    catch (_) { throw new Error('暂时无法连接服务，请稍后重试。'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      if (response.status === 401 && path !== 'login') showLogin();
      throw new Error(result.error || '操作未完成，请稍后重试。');
    }
    return result;
  }
  function showLogin() { state.csrf = ''; app.hidden = true; logout.hidden = true; login.hidden = false; }
  async function showApp(csrf) {
    state.csrf = csrf; login.hidden = true; app.hidden = false; logout.hidden = false;
    await Promise.all([loadRegistrations(), loadAnnouncements(), loadMail()]);
  }
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form), button = form.querySelector('button');
    button.disabled = true; status(form, '正在登录…');
    try { const result = await api('login', {username:data.get('username'),password:data.get('password')}); form.reset(); status(form, ''); await showApp(result.csrf); }
    catch (error) { status(form, error.message); } finally { button.disabled = false; }
  });
  logout.addEventListener('click', async () => { try { await api('logout', {}); } catch (_) {} showLogin(); });
  document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => { item.classList.toggle('active', item === button); if (item === button) item.setAttribute('aria-current','page'); else item.removeAttribute('aria-current'); });
    document.querySelectorAll('.panel').forEach(panel => { panel.hidden = panel.id !== 'panel-' + button.dataset.tab; });
  }));
  async function loadRegistrations() {
    try { state.registrations = (await api('registrations')).registrations; renderRegistrations(); }
    catch (error) { $('#registration-empty').hidden = false; $('#registration-empty').textContent = error.message; }
  }
  function cell(row, text) { const td = document.createElement('td'); td.textContent = text || '—'; row.append(td); }
  function renderRegistrations() {
    const query = $('#search').value.trim().toLowerCase();
    const rows = state.registrations.filter(item => Object.values(item).some(value => String(value || '').toLowerCase().includes(query)));
    $('#registration-count').textContent = state.registrations.length;
    const tbody = $('#registration-rows'); tbody.replaceChildren();
    rows.forEach(item => {
      const row = document.createElement('tr');
      [item.name, item.affiliation, item.track, item.team_status, formatDate(item.created_at)].forEach(value => cell(row, value));
      const actions = document.createElement('td'), button = document.createElement('button');
      button.type = 'button'; button.className = 'row-button'; button.textContent = '查看详情'; button.addEventListener('click', () => showDetails(item)); actions.append(button); row.append(actions); tbody.append(row);
    });
    const empty = $('#registration-empty'); empty.hidden = rows.length > 0; empty.textContent = query ? '没有找到匹配的报名信息。' : '还没有报名信息。';
  }
  $('#search').addEventListener('input', renderRegistrations);
  $('#refresh-registrations').addEventListener('click', loadRegistrations);
  function showDetails(item) {
    state.selectedRegistration = item.id; const content = $('#detail-content'); content.replaceChildren();
    [['姓名', item.name], ['学校 / 院系', item.affiliation], ['联系方式', item.contact], ['赛道', item.track], ['参与方式', item.team_status], ['队伍名称', item.team_name], ['擅长方向', item.role], ['创意介绍', item.message], ['报名时间', formatDate(item.created_at)]].forEach(([label, value]) => {
      const row = document.createElement('div'); row.className = 'detail-row'; const name = document.createElement('span'), data = document.createElement('span'); name.textContent = label; data.textContent = value || '—'; row.append(name, data); content.append(row);
    });
    const form = $('#forward-form'); form.reset(); status(form, ''); $('#detail-dialog').showModal();
  }
  $('.close-dialog').addEventListener('click', () => $('#detail-dialog').close());
  $('#forward-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true; status(form, '正在发送…');
    try { await api('forward', {id:state.selectedRegistration,recipient:new FormData(form).get('recipient')}); status(form, '已发送。'); }
    catch (error) { status(form, error.message); } finally { button.disabled = false; }
  });
  async function loadAnnouncements() {
    try { state.announcements = (await api('announcements')).announcements; renderAnnouncements(); }
    catch (error) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = error.message; $('#announcement-list').replaceChildren(p); }
  }
  function renderAnnouncements() {
    const list = $('#announcement-list'); list.replaceChildren();
    if (!state.announcements.length) { const p = document.createElement('p'); p.className='empty'; p.textContent='还没有公告，写一条吧。'; list.append(p); return; }
    state.announcements.forEach(item => {
      const button = document.createElement('button'), title = document.createElement('strong'), meta = document.createElement('small');
      button.type='button'; button.className='announcement-item' + (state.editing === item.id ? ' selected' : '');
      title.textContent=item.title; meta.textContent=(item.published ? '已发布' : '草稿') + ' · ' + formatDate(item.updated_at); button.append(title, meta); button.addEventListener('click', () => editAnnouncement(item)); list.append(button);
    });
  }
  function editAnnouncement(item) {
    state.editing = item ? item.id : null; const form = $('#announcement-form'); form.reset();
    if (item) { form.elements.title.value=item.title; form.elements.body.value=item.body; }
    $('#editor-title').textContent=item ? '编辑公告' : '新建公告'; $('#editor-state').textContent=item && item.published ? '已发布' : '草稿'; status(form, ''); renderAnnouncements();
  }
  $('#new-announcement').addEventListener('click', () => editAnnouncement(null));
  async function saveAnnouncement(published) {
    const form = $('#announcement-form'); if (!form.reportValidity()) return;
    const existing = state.announcements.find(item => item.id === state.editing);
    if (!published && existing && existing.published && !window.confirm('保存为草稿后，这条公告将从官网撤下。确定继续吗？')) return;
    const data = new FormData(form); const buttons = form.querySelectorAll('button'); buttons.forEach(button => { button.disabled=true; }); status(form, '正在保存…');
    try {
      const result = await api('announcement', {id:state.editing,title:data.get('title'),body:data.get('body'),published});
      state.editing=result.id; await loadAnnouncements(); $('#editor-title').textContent='编辑公告'; $('#editor-state').textContent=published ? '已发布' : '草稿'; status(form, published ? '已发布，官网现在可以看到。' : '草稿已保存。');
    } catch (error) { status(form, error.message); } finally { buttons.forEach(button => { button.disabled=false; }); }
  }
  $('#announcement-form').addEventListener('submit', event => { event.preventDefault(); saveAnnouncement(true); });
  $('#save-draft').addEventListener('click', () => saveAnnouncement(false));
  async function loadMail() {
    try {
      const result = await api('mail-settings'), form=$('#mail-form');
      for (const key of ['host','username','from_address','from_name']) form.elements[key].value=result.mail[key] || '';
      form.elements.security.value=result.mail.security || 'ssl'; form.elements.password.value='';
      $('#mail-state').textContent=result.password_configured ? '已保存配置' : '未接入';
      $('#mail-password-note').textContent=result.password_configured ? '已保存授权码；如不更换，请留空。' : '请先在邮箱服务商处开启 SMTP 并获取授权码。';
    } catch (error) { status($('#mail-form'), error.message); }
  }
  $('#mail-form').addEventListener('submit', async event => {
    event.preventDefault(); const form=event.currentTarget, data=new FormData(form), button=form.querySelector('button'); button.disabled=true; status(form,'正在保存…');
    const security=data.get('security');
    try { await api('mail-settings', {host:data.get('host'),port:security === 'ssl' ? 465 : 587,security,username:data.get('username'),from_address:data.get('from_address'),from_name:data.get('from_name'),password:data.get('password')}); await loadMail(); status(form,'邮箱设置已保存。转发时会连接邮箱服务商。'); }
    catch (error) { status(form,error.message); } finally { button.disabled=false; }
  });
  $('#password-form').addEventListener('submit', async event => {
    event.preventDefault(); const form=event.currentTarget, data=new FormData(form), button=form.querySelector('button');
    if (data.get('new') !== data.get('confirm')) { status(form,'两次输入的新密码不一致。'); return; }
    button.disabled=true; status(form,'正在修改…');
    try { await api('password', {current:data.get('current'),new:data.get('new')}); form.reset(); showLogin(); status($('#login-form'),'密码已修改，请重新登录。'); }
    catch (error) { status(form,error.message); } finally { button.disabled=false; }
  });
  api('session').then(result => showApp(result.csrf)).catch(() => showLogin());
})();
