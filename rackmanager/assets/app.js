/* ==========================================================================
   RackManager prototype — application
   RackManager 1.2.5 Features / User Guide 문서의 기능 구성을 그대로 옮긴
   프론트엔드 전용 프로토타입. 모든 CRUD는 메모리 배열을 조작합니다.
   ========================================================================== */
(function () {
  'use strict';

  const db = window.RM_DATA;

  /* ======================================================================
     1. 유틸리티
     ====================================================================== */
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const nz = (v, fallback) => (v === '' || v == null ? `<span class="muted">${esc(fallback || '—')}</span>` : esc(v));
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const daysUntil = (iso) => Math.round((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
  const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number')
    ? a - b
    : String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'ko', { numeric: true });

  function toast(msg) {
    const root = $('#toast-root');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function download(filename, text, mime) {
    const blob = new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ======================================================================
     2. 조회 헬퍼 / 파생 데이터
     ====================================================================== */
  const find = (list, id) => list.find((x) => x.id === id) || null;
  const L = {
    org:      (id) => find(db.organisations, id),
    building: (id) => find(db.buildings, id),
    room:     (id) => find(db.rooms, id),
    rack:     (id) => find(db.racks, id),
    hw:       (id) => find(db.hardware, id),
    os:       (id) => find(db.operatingSystems, id),
    role:     (id) => find(db.roles, id),
    sl:       (id) => find(db.serviceLevels, id),
    domain:   (id) => find(db.domains, id),
    device:   (id) => find(db.devices, id),
    app:      (id) => find(db.apps, id)
  };
  const nm = (o) => (o ? o.name : '');

  const customers    = () => db.organisations.filter((o) => o.customer);
  const hwMakers     = () => db.organisations.filter((o) => o.hardware);
  const swMakers     = () => db.organisations.filter((o) => o.software);
  const rackDevices  = (rackId) => db.devices.filter((d) => d.rackId === rackId);
  const deviceApps   = (devId) => db.appDevices.filter((l) => l.deviceId === devId).map((l) => L.app(l.appId)).filter(Boolean);
  const appDeviceList= (appId) => db.appDevices.filter((l) => l.appId === appId).map((l) => L.device(l.deviceId)).filter(Boolean);

  function deviceSize(d) { const h = L.hw(d.hardwareId); return h ? h.sizeU : 1; }

  function fqdn(d) {
    const dom = L.domain(d.domainId);
    return dom && dom.id !== 'dm-none' ? d.name + '.' + dom.name : d.name;
  }

  function rackStats(rack) {
    const list = rackDevices(rack.id);
    const used = list.reduce((s, d) => s + deviceSize(d), 0);
    return { devices: list.length, used: used, free: Math.max(0, rack.sizeU - used), pct: Math.round((used / rack.sizeU) * 100) };
  }

  function rackLocation(rack) {
    const room = L.room(rack.roomId);
    const b = room ? L.building(room.buildingId) : null;
    return [nm(b), nm(room), rack.row].filter(Boolean).join(' · ');
  }

  /** 장비 뷰 모델 — 표/검색/내보내기에서 공통으로 사용 */
  function dv(d) {
    const rack = L.rack(d.rackId), hw = L.hw(d.hardwareId), os = L.os(d.osId);
    const room = rack ? L.room(rack.roomId) : null;
    const bld = room ? L.building(room.buildingId) : null;
    return {
      raw: d,
      id: d.id,
      name: d.name,
      fqdn: fqdn(d),
      domain: nm(L.domain(d.domainId)) === '(도메인 없음)' ? '' : nm(L.domain(d.domainId)),
      rack: nm(rack),
      rackId: d.rackId,
      room: nm(room),
      building: nm(bld),
      pos: d.rackPos,
      posLabel: rack ? 'U' + d.rackPos + (deviceSize(d) > 1 ? '–U' + (d.rackPos + deviceSize(d) - 1) : '') : '',
      sizeU: deviceSize(d),
      hardware: nm(hw),
      manufacturer: hw ? nm(L.org(hw.manufacturerId)) : '',
      os: os ? (os.name + (os.version ? ' ' + os.version : '')) : '',
      osKey: d.osLicenceKey,
      customer: nm(L.org(d.customerId)),
      role: nm(L.role(d.roleId)),
      sl: nm(L.sl(d.serviceLevelId)),
      serial: d.serial,
      asset: d.assetNo,
      purchased: d.purchased,
      warranty: d.warrantyEnd,
      inService: d.inService,
      monitored: d.monitored,
      apps: deviceApps(d.id).map((a) => a.name).join(', '),
      notes: d.notes,
      updated: d.updatedAt + ' · ' + d.updatedBy
    };
  }

  function warrantyBadge(iso) {
    const left = daysUntil(iso);
    if (left < 0)   return `<span class="badge danger">만료 ${esc(iso)}</span>`;
    if (left <= 90) return `<span class="badge warn">D-${left} · ${esc(iso)}</span>`;
    return `<span class="badge mute">${esc(iso)}</span>`;
  }

  const serviceBadge = (on) => on
    ? '<span class="badge ok"><span class="dotstat on"></span> 서비스 중</span>'
    : '<span class="badge danger"><span class="dotstat off"></span> 서비스 중지</span>';

  function unitClass(d) {
    const r = d.roleId;
    if (['ro-switch', 'ro-fw', 'ro-lb', 'ro-dns'].includes(r)) return 'net';
    if (['ro-storage', 'ro-backup'].includes(r)) return 'stor';
    if (r === 'ro-power') return 'power';
    return '';
  }

  /* ======================================================================
     3. 화면 상태
     ====================================================================== */
  const state = {
    devices: {
      view: 'default',
      sort: { key: 'name', dir: 1 },
      showFilters: false,
      filters: { q: '', customer: '', role: '', os: '', hardware: '', sl: '', building: '', rack: '', service: '' }
    },
    racks: { sort: { key: 'name', dir: 1 }, selected: new Set() },
    apps:  { sort: { key: 'name', dir: 1 } },
    readonly: false
  };

  /* ======================================================================
     4. 라우터
     ====================================================================== */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/devices';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    return { parts, query, path };
  }

  const ROUTES = {
    devices:  renderDevices,
    device:   renderDeviceDetail,
    racks:    renderRacks,
    rack:     renderRackDetail,
    physical: renderPhysical,
    apps:     renderApps,
    app:      renderAppDetail,
    reports:  renderReports,
    config:   renderConfig,
    system:   renderSystem,
    search:   renderSearch
  };

  function render() {
    const r = parseHash();
    const fn = ROUTES[r.parts[0]] || renderDevices;
    $('#main').innerHTML = fn(r) || '';
    syncNav(r.parts[0]);
    updateCounts();
    $('#foot-time').textContent = new Date().toLocaleString('ko-KR');
    window.scrollTo({ top: 0 });
  }

  function syncNav(head) {
    $$('#nav .nav-item, .sidebar-foot .nav-item').forEach((a) => {
      const match = (a.dataset.match || '').split(',');
      a.classList.toggle('active', match.includes(head));
    });
    document.body.classList.remove('nav-open');
    $('#scrim').hidden = true;
  }

  function updateCounts() {
    const map = { devices: db.devices.length, racks: db.racks.length, apps: db.apps.length };
    $$('[data-count]').forEach((el) => { el.textContent = map[el.dataset.count]; });
  }

  const go = (hash) => { location.hash = hash; };

  /* ======================================================================
     5. 공통 렌더 조각
     ====================================================================== */
  function pageHead(title, sub, actions, crumbs) {
    return `
      ${crumbs ? `<div class="crumb">${crumbs.map((c, i) =>
        (i ? '<span>/</span>' : '') + (c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<b>${esc(c.label)}</b>`)
      ).join('')}</div>` : ''}
      <div class="page-head">
        <div>
          <h1>${esc(title)}</h1>
          ${sub ? `<div class="sub">${sub}</div>` : ''}
        </div>
        <div class="actions">${actions || ''}</div>
      </div>`;
  }

  function sortableTable(cols, rows, sortState, sortNs, opts) {
    opts = opts || {};
    const head = cols.map((c) => {
      const on = sortState.key === c.key;
      return `<th class="${c.cls || ''} sortable ${on ? 'sorted' : ''}" data-sort="${sortNs}:${c.key}">
        ${esc(c.label)}<span class="arrow">${on ? (sortState.dir > 0 ? '▲' : '▼') : '◆'}</span></th>`;
    }).join('');

    const span = cols.length + (opts.rowActions ? 1 : 0);
    const body = rows.length ? rows.map((row) => {
      const cells = cols.map((c) => `<td class="${c.cls || ''}">${c.html ? c.html(row) : esc(c.value(row))}</td>`).join('');
      const extra = opts.rowActions ? `<td class="actions">${opts.rowActions(row)}</td>` : '';
      return `<tr class="${opts.rowClass ? opts.rowClass(row) : ''}">${cells}${extra}</tr>`;
    }).join('') : `<tr><td colspan="${span}"><div class="empty"><div class="big">🗂️</div><p>조건에 맞는 항목이 없습니다.</p></div></td></tr>`;

    return `<div class="table-wrap"><table class="tbl"><thead><tr>${head}${opts.rowActions ? '<th class="num">작업</th>' : ''}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function applySort(rows, sortState, cols) {
    const col = cols.find((c) => c.key === sortState.key) || cols[0];
    const get = col.sortValue || col.value;
    return rows.slice().sort((a, b) => cmp(get(a), get(b)) * sortState.dir);
  }

  function selectOptions(list, selected, labeler) {
    return list.map((o) => `<option value="${esc(o.id)}" ${o.id === selected ? 'selected' : ''}>${esc(labeler ? labeler(o) : o.name)}</option>`).join('');
  }

  function meterBar(pct) {
    const cls = pct >= 90 ? 'full' : pct >= 70 ? 'hi' : '';
    return `<div class="meter"><i class="${cls}" style="width:${Math.min(100, pct)}%"></i></div>`;
  }

  /* ======================================================================
     6. 장비 (Devices)
     ====================================================================== */
  const DEVICE_COLUMNS = {
    name:        { key: 'name', label: '장비', value: (r) => r.name,
                   html: (r) => `<a class="name-link" href="#/device/${r.id}">${esc(r.name)}</a>${r.domain ? `<span class="sub">${esc(r.fqdn)}</span>` : ''}` },
    domain:      { key: 'domain', label: '도메인', value: (r) => r.domain, html: (r) => nz(r.domain) },
    fqdn:        { key: 'fqdn', label: 'FQDN', cls: 'mono', value: (r) => r.fqdn },
    rack:        { key: 'rack', label: '랙', value: (r) => r.rack,
                   html: (r) => `<a href="#/physical?racks=${esc(r.rackId)}">${esc(r.rack)}</a><span class="sub">${esc(r.room)}</span>` },
    pos:         { key: 'pos', label: '위치', cls: 'num', value: (r) => r.pos, html: (r) => `${esc(r.posLabel)} <span class="muted">(${r.sizeU}U)</span>` },
    building:    { key: 'building', label: '건물', value: (r) => r.building },
    room:        { key: 'room', label: '전산실', value: (r) => r.room },
    hardware:    { key: 'hardware', label: '하드웨어', value: (r) => r.hardware,
                   html: (r) => `${esc(r.hardware)}<span class="sub">${esc(r.manufacturer)}</span>` },
    manufacturer:{ key: 'manufacturer', label: '제조사', value: (r) => r.manufacturer },
    os:          { key: 'os', label: '운영체제', value: (r) => r.os, html: (r) => nz(r.os) },
    osKey:       { key: 'osKey', label: 'OS 라이선스 키', cls: 'mono', value: (r) => r.osKey, html: (r) => nz(r.osKey) },
    customer:    { key: 'customer', label: '고객사', value: (r) => r.customer },
    role:        { key: 'role', label: '역할', value: (r) => r.role, html: (r) => `<span class="badge mute">${esc(r.role)}</span>` },
    sl:          { key: 'sl', label: '서비스 수준', value: (r) => r.sl },
    serial:      { key: 'serial', label: '시리얼', cls: 'mono', value: (r) => r.serial },
    asset:       { key: 'asset', label: '자산번호', cls: 'mono', value: (r) => r.asset },
    purchased:   { key: 'purchased', label: '구매일', cls: 'mono', value: (r) => r.purchased },
    warranty:    { key: 'warranty', label: '보증 만료', value: (r) => r.warranty, html: (r) => warrantyBadge(r.warranty) },
    apps:        { key: 'apps', label: '앱', value: (r) => r.apps, html: (r) => nz(r.apps, '연결 없음') },
    status:      { key: 'inService', label: '상태', value: (r) => (r.inService ? 1 : 0), html: (r) => serviceBadge(r.inService) },
    monitored:   { key: 'monitored', label: '모니터링', value: (r) => (r.monitored ? 1 : 0),
                   html: (r) => r.monitored ? '<span class="badge info">감시 중</span>' : '<span class="badge mute">미감시</span>' },
    notes:       { key: 'notes', label: '비고', value: (r) => r.notes, html: (r) => nz(r.notes) },
    updated:     { key: 'updated', label: '최종 수정', value: (r) => r.updated, html: (r) => `<span class="muted">${esc(r.updated)}</span>` }
  };

  const DEVICE_VIEWS = {
    default: { label: '기본',        cols: ['name', 'rack', 'pos', 'hardware', 'os', 'customer', 'role', 'status'] },
    asset:   { label: '자산',        cols: ['name', 'serial', 'asset', 'purchased', 'warranty', 'hardware', 'manufacturer', 'customer'] },
    dns:     { label: 'DNS', cols: ['name', 'domain', 'fqdn', 'role', 'rack', 'status'] },
    os:      { label: '운영체제',    cols: ['name', 'os', 'osKey', 'customer', 'role', 'status'] },
    support: { label: '하드웨어 지원', cols: ['name', 'manufacturer', 'hardware', 'serial', 'warranty', 'sl', 'customer'] },
    location:{ label: '위치',        cols: ['name', 'building', 'room', 'rack', 'pos', 'customer', 'status'] },
    apps:    { label: '앱',          cols: ['name', 'apps', 'role', 'customer', 'rack', 'status'] },
    full:    { label: '전체',        cols: ['name', 'fqdn', 'building', 'room', 'rack', 'pos', 'hardware', 'manufacturer', 'os', 'osKey',
                                            'customer', 'role', 'sl', 'serial', 'asset', 'purchased', 'warranty', 'apps', 'monitored', 'status', 'notes', 'updated'] }
  };

  function filteredDevices() {
    const f = state.devices.filters;
    const q = f.q.trim().toLowerCase();
    return db.devices.map(dv).filter((r) => {
      if (q && !(r.name.toLowerCase().includes(q) || String(r.serial).toLowerCase().includes(q) || String(r.asset).toLowerCase().includes(q) || r.fqdn.toLowerCase().includes(q))) return false;
      if (f.customer && r.raw.customerId !== f.customer) return false;
      if (f.role && r.raw.roleId !== f.role) return false;
      if (f.os && r.raw.osId !== f.os) return false;
      if (f.hardware && r.raw.hardwareId !== f.hardware) return false;
      if (f.sl && r.raw.serviceLevelId !== f.sl) return false;
      if (f.rack && r.raw.rackId !== f.rack) return false;
      if (f.building) {
        const rk = L.rack(r.raw.rackId); const rm = rk ? L.room(rk.roomId) : null;
        if (!rm || rm.buildingId !== f.building) return false;
      }
      if (f.service === 'in' && !r.inService) return false;
      if (f.service === 'out' && r.inService) return false;
      return true;
    });
  }

  function activeFilterChips() {
    const f = state.devices.filters;
    const chips = [];
    const push = (k, label) => chips.push(`<span class="chip">${esc(label)} <button data-clear-filter="${k}" title="필터 해제">✕</button></span>`);
    if (f.q)        push('q', '검색: ' + f.q);
    if (f.customer) push('customer', '고객사: ' + nm(L.org(f.customer)));
    if (f.role)     push('role', '역할: ' + nm(L.role(f.role)));
    if (f.os)       push('os', 'OS: ' + nm(L.os(f.os)));
    if (f.hardware) push('hardware', '하드웨어: ' + nm(L.hw(f.hardware)));
    if (f.sl)       push('sl', '서비스 수준: ' + nm(L.sl(f.sl)));
    if (f.building) push('building', '건물: ' + nm(L.building(f.building)));
    if (f.rack)     push('rack', '랙: ' + nm(L.rack(f.rack)));
    if (f.service)  push('service', f.service === 'in' ? '상태: 서비스 중' : '상태: 서비스 중지');
    if (!chips.length) return '';
    return `<div class="active-filters">${chips.join('')}<button class="btn sm ghost" data-reset-filters>모두 초기화</button></div>`;
  }

  function renderDevices() {
    const s = state.devices;
    const view = DEVICE_VIEWS[s.view] ? s.view : 'default';
    const cols = DEVICE_VIEWS[view].cols.map((k) => DEVICE_COLUMNS[k]);
    let rows = filteredDevices();
    rows = applySort(rows, s.sort, cols);

    const total = db.devices.length;
    const out = rows.filter((r) => !r.inService).length;

    return pageHead('장비', `${rows.length}건 표시 · 전체 ${total}대${out ? ` · 서비스 중지 ${out}대` : ''}`, `
      <button class="btn mutating" data-action="add-device">＋ 장비 추가</button>
      <button class="btn" data-action="export-devices">⬇ Excel 내보내기 (CSV)</button>
    `) + `
    <div class="card">
      <div class="toolbar">
        <div class="field">
          <label for="view-type">보기 형식</label>
          <select class="inp" id="view-type" data-devices-view>
            ${Object.keys(DEVICE_VIEWS).map((k) => `<option value="${k}" ${k === view ? 'selected' : ''}>${esc(DEVICE_VIEWS[k].label)}</option>`).join('')}
          </select>
        </div>
        <button class="btn sm" data-toggle-filters>${s.showFilters ? '필터 숨기기' : '필터 표시'}</button>
        <div class="grow"></div>
        <span class="muted" style="font-size:12px">열 제목을 클릭하면 정렬됩니다</span>
      </div>

      ${s.showFilters ? filterPanel() : ''}
      ${activeFilterChips()}
      ${sortableTable(cols, rows, s.sort, 'devices', {
        rowClass: (r) => (r.inService ? '' : 'off'),
        rowActions: (r) => `
          <a class="rowbtn" href="#/physical?racks=${esc(r.rackId)}&focus=${esc(r.id)}" title="랙에서 보기">📐</a>
          <button class="rowbtn mutating" data-action="edit-device" data-id="${esc(r.id)}" title="편집">✎</button>
          <button class="rowbtn mutating" data-action="copy-device" data-id="${esc(r.id)}" title="복사">⧉</button>
          <button class="rowbtn del mutating" data-action="del-device" data-id="${esc(r.id)}" title="삭제">🗑</button>`
      })}
    </div>`;
  }

  function filterPanel() {
    const f = state.devices.filters;
    const opt = (list, sel, blank) => `<option value="">${esc(blank)}</option>` + selectOptions(list, sel);
    return `<div class="filters">
      <div class="f"><label>이름/시리얼/자산번호</label><input class="inp" type="search" data-filter="q" value="${esc(f.q)}" placeholder="부분 일치"></div>
      <div class="f"><label>고객사</label><select class="inp" data-filter="customer">${opt(customers(), f.customer, '전체')}</select></div>
      <div class="f"><label>역할</label><select class="inp" data-filter="role">${opt(db.roles, f.role, '전체')}</select></div>
      <div class="f"><label>운영체제</label><select class="inp" data-filter="os">${'<option value="">전체</option>' + selectOptions(db.operatingSystems, f.os, (o) => o.name + (o.version ? ' ' + o.version : ''))}</select></div>
      <div class="f"><label>하드웨어</label><select class="inp" data-filter="hardware">${opt(db.hardware, f.hardware, '전체')}</select></div>
      <div class="f"><label>서비스 수준</label><select class="inp" data-filter="sl">${opt(db.serviceLevels, f.sl, '전체')}</select></div>
      <div class="f"><label>건물</label><select class="inp" data-filter="building">${opt(db.buildings, f.building, '전체')}</select></div>
      <div class="f"><label>랙</label><select class="inp" data-filter="rack">${opt(db.racks, f.rack, '전체')}</select></div>
      <div class="f"><label>서비스 상태</label><select class="inp" data-filter="service">
        <option value="">전체</option>
        <option value="in"  ${f.service === 'in' ? 'selected' : ''}>서비스 중</option>
        <option value="out" ${f.service === 'out' ? 'selected' : ''}>서비스 중지</option>
      </select></div>
      <div class="f-actions"><button class="btn sm" data-reset-filters>필터 초기화</button></div>
    </div>`;
  }

  /* --- 장비 상세 --------------------------------------------------------- */
  function renderDeviceDetail(r) {
    const d = L.device(r.parts[1]);
    if (!d) return notFound('장비');
    const v = dv(d);
    const hw = L.hw(d.hardwareId);
    const isDell = hw && hw.manufacturerId === 'org-dell';
    const rack = L.rack(d.rackId);
    const apps = deviceApps(d.id);

    return pageHead(d.name, `${esc(v.customer)} · ${esc(v.role)} · ${esc(v.rack)} ${esc(v.posLabel)}`, `
      <a class="btn" href="#/physical?racks=${esc(d.rackId)}&focus=${esc(d.id)}">📐 랙에서 보기</a>
      <button class="btn mutating" data-action="copy-device" data-id="${esc(d.id)}">⧉ 복사</button>
      <button class="btn mutating" data-action="edit-device" data-id="${esc(d.id)}">✎ 편집</button>
      <button class="btn danger mutating" data-action="del-device" data-id="${esc(d.id)}">🗑 삭제</button>
    `, [{ label: '장비', href: '#/devices' }, { label: d.name }]) + `

    ${!d.inService ? `<div class="notice warn">⛔ <div><b>이 장비는 현재 서비스 중이 아닙니다.</b>${d.notes ? '<br>' + esc(d.notes) : ''}</div></div>` : ''}

    <div class="grid c2">
      <div>
        <div class="card">
          <div class="card-head"><h2>기본 정보</h2><span class="right">${serviceBadge(d.inService)}</span></div>
          <dl class="kv">
            <dt>장비명</dt><dd class="mono">${esc(d.name)}</dd>
            <dt>도메인</dt><dd>${nz(v.domain, '(도메인 없음)')}</dd>
            <dt>FQDN</dt><dd class="mono">${esc(v.fqdn)}
              <a class="btn sm" style="margin-left:8px" href="https://dns.google/query?name=${encodeURIComponent(v.fqdn)}" target="_blank" rel="noopener">DNS 조회 ↗</a></dd>
            <dt>고객사</dt><dd>${esc(v.customer)}</dd>
            <dt>역할</dt><dd><span class="badge mute">${esc(v.role)}</span></dd>
            <dt>서비스 수준</dt><dd>${esc(v.sl)} <span class="muted">${esc((L.sl(d.serviceLevelId) || {}).notes || '')}</span></dd>
            <dt>모니터링</dt><dd>${d.monitored ? '<span class="badge info">감시 중</span>' : '<span class="badge mute">미감시</span>'}</dd>
          </dl>
        </div>

        <div class="card">
          <div class="card-head"><h2>하드웨어 · 자산</h2></div>
          <dl class="kv">
            <dt>제조사</dt><dd>${esc(v.manufacturer)}</dd>
            <dt>모델</dt><dd>${esc(v.hardware)} <span class="muted">(${v.sizeU}U)</span></dd>
            <dt>시리얼 ${isDell ? '(서비스 태그)' : ''}</dt>
            <dd class="mono">${esc(d.serial)}
              ${isDell ? `<a class="btn sm" style="margin-left:8px" href="https://www.dell.com/support/home/product-support/servicetag/${encodeURIComponent(d.serial)}/overview" target="_blank" rel="noopener">Dell 보증 조회 ↗</a>` : ''}</dd>
            <dt>자산번호</dt><dd class="mono">${esc(d.assetNo)}</dd>
            <dt>구매일</dt><dd class="mono">${esc(d.purchased)}</dd>
            <dt>보증 만료</dt><dd>${warrantyBadge(d.warrantyEnd)}</dd>
          </dl>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-head"><h2>설치 위치</h2>
            <span class="right"><a class="btn sm" href="#/physical?racks=${esc(d.rackId)}&focus=${esc(d.id)}">실장도 보기</a></span></div>
          <dl class="kv">
            <dt>건물</dt><dd>${esc(v.building)}</dd>
            <dt>전산실</dt><dd>${esc(v.room)}</dd>
            <dt>랙</dt><dd><a href="#/rack/${esc(d.rackId)}">${esc(v.rack)}</a>${rack && rack.row ? ` <span class="muted">${esc(rack.row)}</span>` : ''}</dd>
            <dt>위치</dt><dd class="mono">${esc(v.posLabel)} <span class="muted">(${v.sizeU}U 점유)</span></dd>
          </dl>
        </div>

        <div class="card">
          <div class="card-head"><h2>운영체제</h2></div>
          <dl class="kv">
            <dt>운영체제</dt><dd>${nz(v.os)}</dd>
            <dt>라이선스 키</dt><dd class="mono">${nz(d.osLicenceKey, '없음')}</dd>
          </dl>
        </div>

        <div class="card">
          <div class="card-head"><h2>연결된 앱</h2>
            <span class="right"><button class="btn sm mutating" data-action="link-app" data-device="${esc(d.id)}">＋ 앱 연결</button></span></div>
          <div class="card-body">
            ${apps.length ? apps.map((a) => `<span class="chip"><a href="#/app/${esc(a.id)}">${esc(a.name)}</a>
              <button class="mutating" data-action="unlink-app" data-app="${esc(a.id)}" data-device="${esc(d.id)}" title="연결 해제">✕</button></span> `).join('')
              : '<span class="muted">연결된 앱이 없습니다.</span>'}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>비고</h2></div>
          <div class="card-body">${d.notes ? esc(d.notes) : '<span class="muted">등록된 비고가 없습니다.</span>'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body muted" style="font-size:12px">
        최초 등록 <b>${esc(d.createdBy)}</b> · 최종 수정 <b>${esc(d.updatedAt)}</b> by <b>${esc(d.updatedBy)}</b>
      </div>
    </div>`;
  }

  /* ======================================================================
     7. 랙 (Racks)
     ====================================================================== */
  const RACK_COLUMNS = [
    { key: 'name', label: '랙', value: (r) => r.rack.name,
      html: (r) => `<a class="name-link" href="#/rack/${esc(r.rack.id)}">${esc(r.rack.name)}</a>${r.rack.row ? `<span class="sub">${esc(r.rack.row)}</span>` : ''}` },
    { key: 'building', label: '건물', value: (r) => r.building },
    { key: 'room', label: '전산실', value: (r) => r.room },
    { key: 'size', label: '크기', cls: 'num', value: (r) => r.rack.sizeU, html: (r) => r.rack.sizeU + 'U' },
    { key: 'devices', label: '장비', cls: 'num', value: (r) => r.st.devices },
    { key: 'used', label: '사용 U', cls: 'num', value: (r) => r.st.used, html: (r) => r.st.used + 'U' },
    { key: 'free', label: '여유 U', cls: 'num', value: (r) => r.st.free,
      html: (r) => `<b style="color:${r.st.free === 0 ? 'var(--danger)' : r.st.free < 6 ? 'var(--warn)' : 'var(--ok)'}">${r.st.free}U</b>` },
    { key: 'pct', label: '사용률', value: (r) => r.st.pct,
      html: (r) => `<div style="display:flex;align-items:center;gap:8px;min-width:130px">${meterBar(r.st.pct)}<span class="mono" style="font-size:11px">${r.st.pct}%</span></div>` },
    { key: 'notes', label: '비고', value: (r) => r.rack.notes, html: (r) => nz(r.rack.notes) }
  ];

  function rackRows() {
    return db.racks.map((rk) => {
      const room = L.room(rk.roomId);
      const b = room ? L.building(room.buildingId) : null;
      return { rack: rk, room: nm(room), building: nm(b), st: rackStats(rk) };
    });
  }

  function renderRacks() {
    const rows = applySort(rackRows(), state.racks.sort, RACK_COLUMNS);
    const sel = state.racks.selected;
    const totalU = db.racks.reduce((s, r) => s + r.sizeU, 0);
    const usedU = db.racks.reduce((s, r) => s + rackStats(r).used, 0);

    const head = RACK_COLUMNS.map((c) => {
      const on = state.racks.sort.key === c.key;
      return `<th class="${c.cls || ''} sortable ${on ? 'sorted' : ''}" data-sort="racks:${c.key}">${esc(c.label)}<span class="arrow">${on ? (state.racks.sort.dir > 0 ? '▲' : '▼') : '◆'}</span></th>`;
    }).join('');

    const body = rows.map((r) => `
      <tr>
        <td><input type="checkbox" data-rack-sel="${esc(r.rack.id)}" ${sel.has(r.rack.id) ? 'checked' : ''} aria-label="${esc(r.rack.name)} 선택"></td>
        ${RACK_COLUMNS.map((c) => `<td class="${c.cls || ''}">${c.html ? c.html(r) : esc(c.value(r))}</td>`).join('')}
        <td class="actions">
          <a class="rowbtn" href="#/physical?racks=${esc(r.rack.id)}" title="실장도">📐</a>
          <button class="rowbtn mutating" data-action="edit-rack" data-id="${esc(r.rack.id)}" title="편집">✎</button>
          <button class="rowbtn mutating" data-action="copy-rack" data-id="${esc(r.rack.id)}" title="복사">⧉</button>
          <button class="rowbtn del mutating" data-action="del-rack" data-id="${esc(r.rack.id)}" title="삭제">🗑</button>
        </td>
      </tr>`).join('');

    return pageHead('랙', `${db.racks.length}개 랙 · 전체 ${totalU}U 중 ${usedU}U 사용 (여유 ${totalU - usedU}U)`, `
      <button class="btn ${sel.size ? 'primary' : ''}" data-action="view-selected">📐 선택한 랙 실장도 (${sel.size})</button>
      <button class="btn mutating" data-action="add-rack">＋ 랙 추가</button>
      <button class="btn" data-action="export-racks">⬇ Excel 내보내기 (CSV)</button>
    `) + `
    <div class="card">
      <div class="toolbar">
        <button class="btn sm" data-action="select-all-racks">전체 선택</button>
        <button class="btn sm" data-action="select-none-racks">선택 해제</button>
        <div class="grow"></div>
        <span class="muted" style="font-size:12px">체크박스로 여러 랙을 골라 나란히 볼 수 있습니다</span>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th style="width:34px"></th>${head}<th class="num">작업</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
  }

  function renderRackDetail(r) {
    const rk = L.rack(r.parts[1]);
    if (!rk) return notFound('랙');
    const st = rackStats(rk);
    const rows = applySort(rackDevices(rk.id).map(dv), { key: 'pos', dir: -1 }, [DEVICE_COLUMNS.pos]);
    const cols = ['name', 'pos', 'hardware', 'os', 'customer', 'role', 'status'].map((k) => DEVICE_COLUMNS[k]);

    return pageHead(rk.name, rackLocation(rk), `
      <a class="btn" href="#/physical?racks=${esc(rk.id)}">📐 실장도</a>
      <button class="btn mutating" data-action="edit-rack" data-id="${esc(rk.id)}">✎ 편집</button>
      <button class="btn danger mutating" data-action="del-rack" data-id="${esc(rk.id)}">🗑 삭제</button>
    `, [{ label: '랙', href: '#/racks' }, { label: rk.name }]) + `

    <div class="grid c4" style="margin-bottom:16px">
      <div class="stat"><div class="label">랙 크기</div><div class="value">${rk.sizeU}<small>U</small></div></div>
      <div class="stat"><div class="label">사용 중</div><div class="value">${st.used}<small>U</small></div><div class="meta">사용률 ${st.pct}%</div></div>
      <div class="stat"><div class="label">여유 공간</div><div class="value">${st.free}<small>U</small></div></div>
      <div class="stat"><div class="label">장비 수</div><div class="value">${st.devices}<small>대</small></div></div>
    </div>

    <div class="grid c2">
      <div class="card">
        <div class="card-head"><h2>실장 장비</h2>
          <span class="right"><button class="btn sm mutating" data-action="add-device" data-rack="${esc(rk.id)}">＋ 장비 추가</button></span></div>
        ${sortableTable(cols, rows, { key: 'pos', dir: -1 }, 'noop', { rowClass: (x) => (x.inService ? '' : 'off') })}
      </div>
      <div class="card">
        <div class="card-head"><h2>실장도</h2></div>
        <div class="rack-scroll">${rackElevation(rk)}</div>
        ${rackLegend()}
      </div>
    </div>`;
  }

  /* --- 랙 실장도 (Physical View) ----------------------------------------- */
  function rackElevation(rk, focusId) {
    const list = rackDevices(rk.id);
    const st = rackStats(rk);
    const byTop = {};
    list.forEach((d) => { byTop[d.rackPos + deviceSize(d) - 1] = d; });
    const covered = {};
    list.forEach((d) => { for (let u = d.rackPos; u < d.rackPos + deviceSize(d); u++) covered[u] = d; });

    let ruler = '', slots = '';
    for (let u = rk.sizeU; u >= 1; u--) {
      ruler += `<i>${u}</i>`;
      const top = byTop[u];
      if (top) {
        const size = deviceSize(top);
        const v = dv(top);
        slots += `<a class="unit ${unitClass(top)} ${top.inService ? '' : 'off'} ${size > 1 ? 'tall' : ''}"
                     href="#/device/${esc(top.id)}"
                     style="grid-row: span ${size}; ${focusId === top.id ? 'box-shadow:0 0 0 2px var(--accent)' : ''}"
                     title="${esc(v.name)} · ${esc(v.hardware)} · ${esc(v.customer)} · ${esc(v.posLabel)}">
                    <span class="u-name">${esc(top.name)}</span>
                    <span class="u-meta">${esc(v.hardware)} · ${size}U</span>
                  </a>`;
      } else if (!covered[u]) {
        slots += `<div class="slot" data-add-at="${esc(rk.id)}:${u}" title="U${u}에 장비 추가"></div>`;
      }
    }

    return `<div class="rack">
      <div class="rack-head">
        <h3><a href="#/rack/${esc(rk.id)}">${esc(rk.name)}</a></h3>
        <span class="loc">${esc(rackLocation(rk))}</span>
        <span class="tools">
          <button class="rowbtn mutating" data-action="edit-rack" data-id="${esc(rk.id)}" title="랙 편집">✎</button>
        </span>
      </div>
      <div class="rack-body">
        <div class="rack-ruler">${ruler}</div>
        <div class="rack-slots">${slots}</div>
      </div>
      <div class="rack-foot">
        <span class="mono">${st.used}/${rk.sizeU}U</span>
        ${meterBar(st.pct)}
        <span class="mono">여유 ${st.free}U</span>
      </div>
    </div>`;
  }

  function rackLegend() {
    return `<div class="legend">
      <span><b style="background:var(--accent-soft);border-color:var(--accent-line)"></b> 서버</span>
      <span><b style="background:var(--info-soft)"></b> 네트워크</span>
      <span><b style="background:var(--ok-soft)"></b> 스토리지</span>
      <span><b style="background:var(--warn-soft)"></b> 전원</span>
      <span><b style="background:var(--danger-soft)"></b> 서비스 중지</span>
      <span>빈 슬롯을 클릭하면 해당 U에 장비를 추가합니다</span>
    </div>`;
  }

  function renderPhysical(r) {
    const ids = (r.query.racks || '').split(',').filter(Boolean);
    const focus = r.query.focus || '';
    const list = ids.length ? ids.map((id) => L.rack(id)).filter(Boolean)
               : (state.racks.selected.size ? Array.from(state.racks.selected).map((id) => L.rack(id)).filter(Boolean) : db.racks);

    return pageHead('랙 실장도', `${list.length}개 랙 · 나란히 비교 · 인쇄에 최적화된 화면입니다`, `
      <a class="btn" href="#/racks">랙 목록에서 선택</a>
      <button class="btn" id="print-inline">🖨 인쇄</button>
    `) + `
    <div class="card">
      <div class="card-head">
        <h2>${list.map((rk) => esc(rk.name)).join(' · ') || '표시할 랙 없음'}</h2>
        <span class="right hint">장비를 클릭하면 상세 화면으로 이동합니다</span>
      </div>
      ${list.length ? `<div class="rack-scroll">${list.map((rk) => rackElevation(rk, focus)).join('')}</div>` : '<div class="empty"><div class="big">📐</div><p>표시할 랙이 없습니다.</p></div>'}
      ${rackLegend()}
    </div>`;
  }

  /* ======================================================================
     8. 앱 (Apps)
     ====================================================================== */
  const APP_COLUMNS = [
    { key: 'name', label: '앱', value: (a) => a.name, html: (a) => `<a class="name-link" href="#/app/${esc(a.id)}">${esc(a.name)}</a>` },
    { key: 'devices', label: '연결 장비', cls: 'num', value: (a) => appDeviceList(a.id).length },
    { key: 'customers', label: '고객사', value: (a) => Array.from(new Set(appDeviceList(a.id).map((d) => nm(L.org(d.customerId))))).join(', '),
      html: (a) => nz(Array.from(new Set(appDeviceList(a.id).map((d) => nm(L.org(d.customerId))))).join(', ')) },
    { key: 'racks', label: '랙', value: (a) => Array.from(new Set(appDeviceList(a.id).map((d) => nm(L.rack(d.rackId))))).join(', '),
      html: (a) => nz(Array.from(new Set(appDeviceList(a.id).map((d) => nm(L.rack(d.rackId))))).join(', ')) },
    { key: 'notes', label: '비고', value: (a) => a.notes, html: (a) => nz(a.notes) }
  ];

  function renderApps() {
    const rows = applySort(db.apps, state.apps.sort, APP_COLUMNS);
    const head = APP_COLUMNS.map((c) => {
      const on = state.apps.sort.key === c.key;
      return `<th class="${c.cls || ''} sortable ${on ? 'sorted' : ''}" data-sort="apps:${c.key}">${esc(c.label)}<span class="arrow">${on ? (state.apps.sort.dir > 0 ? '▲' : '▼') : '◆'}</span></th>`;
    }).join('');
    const body = rows.map((a) => `<tr>
      ${APP_COLUMNS.map((c) => `<td class="${c.cls || ''}">${c.html ? c.html(a) : esc(c.value(a))}</td>`).join('')}
      <td class="actions">
        <button class="rowbtn mutating" data-action="edit-app" data-id="${esc(a.id)}" title="편집">✎</button>
        <button class="rowbtn del mutating" data-action="del-app" data-id="${esc(a.id)}" title="삭제">🗑</button>
      </td></tr>`).join('');

    return pageHead('앱', `${db.apps.length}개 앱 · 장비에 연결된 서비스/애플리케이션`, `
      <button class="btn mutating" data-action="add-app">＋ 앱 추가</button>
      <button class="btn" data-action="export-apps">⬇ Excel 내보내기 (CSV)</button>
    `) + `
    <div class="card">
      <div class="table-wrap"><table class="tbl">
        <thead><tr>${head}<th class="num">작업</th></tr></thead>
        <tbody>${body || ''}</tbody>
      </table></div>
    </div>`;
  }

  function renderAppDetail(r) {
    const a = L.app(r.parts[1]);
    if (!a) return notFound('앱');
    const devs = appDeviceList(a.id).map(dv);
    const cols = ['name', 'rack', 'pos', 'hardware', 'os', 'customer', 'status'].map((k) => DEVICE_COLUMNS[k]);

    return pageHead(a.name, a.notes || '연결된 장비 목록', `
      <button class="btn mutating" data-action="link-device" data-app="${esc(a.id)}">＋ 장비 연결</button>
      <button class="btn mutating" data-action="edit-app" data-id="${esc(a.id)}">✎ 편집</button>
      <button class="btn danger mutating" data-action="del-app" data-id="${esc(a.id)}">🗑 삭제</button>
    `, [{ label: '앱', href: '#/apps' }, { label: a.name }]) + `
    <div class="card">
      <div class="card-head"><h2>연결된 장비 (${devs.length})</h2></div>
      ${devs.length ? sortableTable(cols, devs, { key: 'name', dir: 1 }, 'noop', { rowClass: (x) => (x.inService ? '' : 'off') })
        : '<div class="empty"><div class="big">🧩</div><p>연결된 장비가 없습니다.</p></div>'}
    </div>`;
  }

  /* ======================================================================
     9. 리포트 (Reports)
     ====================================================================== */
  function tally(items, keyFn) {
    const map = new Map();
    items.forEach((it) => {
      const k = keyFn(it);
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([k, v]) => ({ key: k, n: v })).sort((a, b) => b.n - a.n);
  }

  function barList(rows, total) {
    if (!rows.length) return '<div class="empty"><p>데이터 없음</p></div>';
    const max = rows[0].n || 1;
    return `<div class="card-body">${rows.map((r) => `
      <div>
        <div class="bar-label"><b>${esc(r.key)}</b><span>${r.n}대 · ${Math.round((r.n / total) * 100)}%</span></div>
        <div class="bar-row"><div class="bar"><i style="width:${(r.n / max) * 100}%"></i></div><span class="mono" style="text-align:right">${r.n}</span></div>
      </div>`).join('')}</div>`;
  }

  function dupGroups(items, keyFn, minLen) {
    const map = new Map();
    items.forEach((it) => {
      const k = (keyFn(it) || '').trim();
      if (!k || k.length < (minLen || 1)) return;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    });
    return Array.from(map).filter(([, v]) => v.length > 1);
  }

  function dupCard(title, groups, labeler) {
    return `<div class="card">
      <div class="card-head"><h2>${esc(title)}</h2>
        <span class="right">${groups.length ? `<span class="badge danger">${groups.length}건 중복</span>` : '<span class="badge ok">중복 없음</span>'}</span></div>
      ${groups.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>값</th><th>중복 장비</th></tr></thead>
        <tbody>${groups.map(([k, list]) => `<tr>
          <td class="mono"><b>${esc(k)}</b></td>
          <td>${list.map((d) => `<a href="#/device/${esc(d.id)}">${esc(d.name)}</a> <span class="muted">(${esc(labeler(d))})</span>`).join(' · ')}</td>
        </tr>`).join('')}</tbody></table></div>`
        : '<div class="card-body muted">중복된 값이 없습니다.</div>'}
    </div>`;
  }

  function renderReports() {
    const devs = db.devices;
    const total = devs.length;
    const totalU = db.racks.reduce((s, r) => s + r.sizeU, 0);
    const usedU = db.racks.reduce((s, r) => s + rackStats(r).used, 0);
    const outOfService = devs.filter((d) => !d.inService);
    const expiring = devs.map(dv).filter((v) => daysUntil(v.warranty) <= 90).sort((a, b) => cmp(a.warranty, b.warranty));

    const byCustomer = tally(devs, (d) => nm(L.org(d.customerId)));
    const byOs = tally(devs, (d) => { const o = L.os(d.osId); return o && o.id !== 'os-none' ? o.name + ' ' + o.version : null; });
    const byHw = tally(devs, (d) => nm(L.hw(d.hardwareId)));
    const byRole = tally(devs, (d) => nm(L.role(d.roleId)));
    const bySl = tally(devs, (d) => nm(L.sl(d.serviceLevelId)));

    const rackRowsData = rackRows().sort((a, b) => b.st.free - a.st.free);

    return pageHead('리포트', '랙·장비 현황을 한눈에 정리한 통계 화면입니다', `
      <button class="btn" id="print-inline">🖨 인쇄</button>
      <button class="btn" data-action="export-report">⬇ 요약 내보내기 (CSV)</button>
    `) + `

    <div class="grid c4" style="margin-bottom:16px">
      <div class="stat"><div class="label">전체 장비</div><div class="value">${total}<small>대</small></div>
        <div class="meta">서비스 중 ${total - outOfService.length}대 · 중지 ${outOfService.length}대</div></div>
      <div class="stat"><div class="label">랙 공간</div><div class="value">${totalU - usedU}<small>U 여유</small></div>
        <div class="meta">전체 ${totalU}U 중 ${usedU}U 사용 (${Math.round((usedU / totalU) * 100)}%)</div></div>
      <div class="stat"><div class="label">고객사</div><div class="value">${byCustomer.length}<small>곳</small></div>
        <div class="meta">최다: ${esc(byCustomer[0] ? byCustomer[0].key + ' ' + byCustomer[0].n + '대' : '—')}</div></div>
      <div class="stat"><div class="label">보증 만료 임박</div><div class="value" style="color:${expiring.length ? 'var(--warn)' : 'inherit'}">${expiring.length}<small>대</small></div>
        <div class="meta">만료됨 또는 90일 이내</div></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>랙별 공간 현황</h2><span class="right hint">여유 공간이 많은 순</span></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>랙</th><th>위치</th><th class="num">크기</th><th class="num">장비</th><th class="num">사용</th><th class="num">여유</th><th>사용률</th></tr></thead>
        <tbody>${rackRowsData.map((r) => `<tr>
          <td><a class="name-link" href="#/physical?racks=${esc(r.rack.id)}">${esc(r.rack.name)}</a></td>
          <td>${esc(r.building)} · ${esc(r.room)}</td>
          <td class="num">${r.rack.sizeU}U</td>
          <td class="num">${r.st.devices}</td>
          <td class="num">${r.st.used}U</td>
          <td class="num"><b style="color:${r.st.free === 0 ? 'var(--danger)' : r.st.free < 6 ? 'var(--warn)' : 'var(--ok)'}">${r.st.free}U</b></td>
          <td><div style="display:flex;align-items:center;gap:8px;min-width:140px">${meterBar(r.st.pct)}<span class="mono" style="font-size:11px">${r.st.pct}%</span></div></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="grid c2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>고객사별 장비 수</h2></div>${barList(byCustomer, total)}</div>
      <div class="card"><div class="card-head"><h2>가장 많이 쓰는 운영체제</h2></div>${barList(byOs, total)}</div>
      <div class="card"><div class="card-head"><h2>가장 많이 쓰는 하드웨어</h2></div>${barList(byHw, total)}</div>
      <div class="card"><div class="card-head"><h2>역할별 분포</h2></div>${barList(byRole, total)}</div>
      <div class="card"><div class="card-head"><h2>서비스 수준별 분포</h2></div>${barList(bySl, total)}</div>
      <div class="card">
        <div class="card-head"><h2>서비스 중지 장비</h2>
          <span class="right"><span class="badge ${outOfService.length ? 'danger' : 'ok'}">${outOfService.length}대</span></span></div>
        ${outOfService.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>장비</th><th>랙</th><th>사유</th></tr></thead>
          <tbody>${outOfService.map((d) => `<tr class="off">
            <td><a class="name-link" href="#/device/${esc(d.id)}">${esc(d.name)}</a></td>
            <td>${esc(nm(L.rack(d.rackId)))} U${d.rackPos}</td>
            <td>${nz(d.notes)}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="card-body muted">모든 장비가 서비스 중입니다.</div>'}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>하드웨어 지원 · 보증 만료</h2><span class="right hint">만료되었거나 90일 이내 만료 예정</span></div>
      ${expiring.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>장비</th><th>제조사</th><th>모델</th><th>시리얼</th><th>보증 만료</th><th>서비스 수준</th><th>고객사</th></tr></thead>
        <tbody>${expiring.map((v) => `<tr>
          <td><a class="name-link" href="#/device/${esc(v.id)}">${esc(v.name)}</a></td>
          <td>${esc(v.manufacturer)}</td><td>${esc(v.hardware)}</td>
          <td class="mono">${esc(v.serial)}</td>
          <td>${warrantyBadge(v.warranty)}</td>
          <td>${esc(v.sl)}</td><td>${esc(v.customer)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="card-body muted">90일 이내 만료 예정인 장비가 없습니다.</div>'}
    </div>

    <div style="margin-top:16px">
      ${dupCard('중복 시리얼 번호', dupGroups(devs, (d) => d.serial), (d) => nm(L.rack(d.rackId)))}
      ${dupCard('중복 자산번호', dupGroups(devs, (d) => d.assetNo), (d) => nm(L.rack(d.rackId)))}
      ${dupCard('중복 OS 라이선스 키', dupGroups(devs, (d) => d.osLicenceKey), (d) => nm(L.os(d.osId)))}
    </div>`;
  }

  /* ======================================================================
     10. 설정 (Config)
     ====================================================================== */
  const CONFIG_SECTIONS = {
    buildings: {
      label: '건물', list: () => db.buildings, entity: '건물',
      cols: [{ label: '이름', v: (x) => x.name }, { label: '주소/비고', v: (x) => x.notes },
             { label: '전산실', v: (x) => db.rooms.filter((r) => r.buildingId === x.id).length + '개', cls: 'num' }],
      inUse: (x) => db.rooms.some((r) => r.buildingId === x.id),
      fields: () => [{ k: 'name', label: '건물명', required: true }, { k: 'notes', label: '주소/비고', type: 'textarea', full: true }]
    },
    rooms: {
      label: '전산실', list: () => db.rooms, entity: '전산실',
      cols: [{ label: '이름', v: (x) => x.name }, { label: '건물', v: (x) => nm(L.building(x.buildingId)) },
             { label: '비고', v: (x) => x.notes }, { label: '랙', v: (x) => db.racks.filter((r) => r.roomId === x.id).length + '개', cls: 'num' }],
      inUse: (x) => db.racks.some((r) => r.roomId === x.id),
      fields: () => [{ k: 'name', label: '전산실명', required: true },
                     { k: 'buildingId', label: '건물', type: 'select', options: db.buildings },
                     { k: 'notes', label: '비고', type: 'textarea', full: true }]
    },
    domains: {
      label: '도메인', list: () => db.domains, entity: '도메인',
      cols: [{ label: '도메인', v: (x) => x.name }, { label: '비고', v: (x) => x.notes },
             { label: '장비', v: (x) => db.devices.filter((d) => d.domainId === x.id).length + '대', cls: 'num' }],
      inUse: (x) => db.devices.some((d) => d.domainId === x.id),
      fields: () => [{ k: 'name', label: '도메인', required: true }, { k: 'notes', label: '비고', type: 'textarea', full: true }]
    },
    hardware: {
      label: '하드웨어 모델', list: () => db.hardware, entity: '하드웨어 모델',
      cols: [{ label: '모델', v: (x) => x.name }, { label: '제조사', v: (x) => nm(L.org(x.manufacturerId)) },
             { label: '크기', v: (x) => x.sizeU + 'U', cls: 'num' }, { label: '비고', v: (x) => x.notes },
             { label: '장비', v: (x) => db.devices.filter((d) => d.hardwareId === x.id).length + '대', cls: 'num' }],
      inUse: (x) => db.devices.some((d) => d.hardwareId === x.id),
      fields: () => [{ k: 'name', label: '모델명', required: true },
                     { k: 'manufacturerId', label: '제조사', type: 'select', options: hwMakers() },
                     { k: 'sizeU', label: '크기 (U)', type: 'number', min: 1, max: 48, help: 'RackManager는 정수 U만 지원합니다 (1.5U 등은 반올림)' },
                     { k: 'notes', label: '비고', type: 'textarea', full: true }]
    },
    os: {
      label: '운영체제', list: () => db.operatingSystems, entity: '운영체제',
      cols: [{ label: '이름', v: (x) => x.name }, { label: '버전', v: (x) => x.version },
             { label: '제조사', v: (x) => nm(L.org(x.manufacturerId)) }, { label: '비고', v: (x) => x.notes },
             { label: '장비', v: (x) => db.devices.filter((d) => d.osId === x.id).length + '대', cls: 'num' }],
      inUse: (x) => db.devices.some((d) => d.osId === x.id),
      fields: () => [{ k: 'name', label: '운영체제', required: true }, { k: 'version', label: '버전' },
                     { k: 'manufacturerId', label: '제조사', type: 'select', options: swMakers(), blank: '(없음)' },
                     { k: 'notes', label: '비고', type: 'textarea', full: true }]
    },
    organisations: {
      label: '조직', list: () => db.organisations, entity: '조직',
      cols: [{ label: '이름', v: (x) => x.name },
             { label: '구분', v: (x) => [x.customer ? '고객사' : '', x.hardware ? '하드웨어 제조사' : '', x.software ? '소프트웨어 제조사' : ''].filter(Boolean).join(', ') },
             { label: '비고', v: (x) => x.notes },
             { label: '장비', v: (x) => db.devices.filter((d) => d.customerId === x.id).length + '대', cls: 'num' }],
      inUse: (x) => db.devices.some((d) => d.customerId === x.id) || db.hardware.some((h) => h.manufacturerId === x.id) || db.operatingSystems.some((o) => o.manufacturerId === x.id),
      fields: () => [{ k: 'name', label: '조직명', required: true },
                     { k: 'customer', label: '고객사', type: 'check' },
                     { k: 'hardware', label: '하드웨어 제조사', type: 'check' },
                     { k: 'software', label: '소프트웨어 제조사', type: 'check' },
                     { k: 'notes', label: '비고', type: 'textarea', full: true }]
    },
    roles: {
      label: '역할', list: () => db.roles, entity: '역할',
      cols: [{ label: '역할', v: (x) => x.name }, { label: '비고', v: (x) => x.notes },
             { label: '장비', v: (x) => db.devices.filter((d) => d.roleId === x.id).length + '대', cls: 'num' }],
      inUse: (x) => db.devices.some((d) => d.roleId === x.id),
      fields: () => [{ k: 'name', label: '역할명', required: true }, { k: 'notes', label: '비고', type: 'textarea', full: true }]
    },
    servicelevels: {
      label: '서비스 수준', list: () => db.serviceLevels, entity: '서비스 수준',
      cols: [{ label: '이름', v: (x) => x.name }, { label: '설명', v: (x) => x.notes },
             { label: '장비', v: (x) => db.devices.filter((d) => d.serviceLevelId === x.id).length + '대', cls: 'num' }],
      inUse: (x) => db.devices.some((d) => d.serviceLevelId === x.id),
      fields: () => [{ k: 'name', label: '이름', required: true }, { k: 'notes', label: '설명', type: 'textarea', full: true }]
    }
  };

  function renderConfig(r) {
    const key = CONFIG_SECTIONS[r.parts[1]] ? r.parts[1] : 'buildings';
    const sec = CONFIG_SECTIONS[key];
    const rows = sec.list();

    return pageHead('설정', 'RackManager의 기본 구성 요소를 관리합니다. 장비를 등록하기 전에 먼저 채워두면 편합니다.', `
      <button class="btn primary mutating" data-action="cfg-add" data-sec="${esc(key)}">＋ ${esc(sec.entity)} 추가</button>
      <a class="btn" href="#/system">시스템 정보</a>
    `) + `
    <div class="card">
      <div class="tabs">
        ${Object.keys(CONFIG_SECTIONS).map((k) =>
          `<a class="${k === key ? 'on' : ''}" href="#/config/${k}">${esc(CONFIG_SECTIONS[k].label)} <span class="muted">${CONFIG_SECTIONS[k].list().length}</span></a>`).join('')}
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr>${sec.cols.map((c) => `<th class="${c.cls || ''}">${esc(c.label)}</th>`).join('')}<th class="num">작업</th></tr></thead>
        <tbody>${rows.map((x) => `<tr>
          ${sec.cols.map((c) => `<td class="${c.cls || ''}">${nz(c.v(x))}</td>`).join('')}
          <td class="actions">
            <button class="rowbtn mutating" data-action="cfg-edit" data-sec="${esc(key)}" data-id="${esc(x.id)}" title="편집">✎</button>
            <button class="rowbtn del mutating" data-action="cfg-del" data-sec="${esc(key)}" data-id="${esc(x.id)}" title="삭제">🗑</button>
          </td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }

  function renderSystem() {
    const s = db.system;
    return pageHead('시스템 정보', 'RackManager 프로토타입 및 데이터 현황', '', [{ label: '설정', href: '#/config' }, { label: '시스템 정보' }]) + `
    <div class="notice">ℹ️ <div>이 화면은 원본 RackManager의 <b>View RackManager System &amp; Database Information</b> 페이지에 대응합니다.
      버그 리포트 시 이 정보를 함께 첨부하면 도움이 됩니다.</div></div>

    <div class="grid c2">
      <div class="card">
        <div class="card-head"><h2>애플리케이션</h2></div>
        <dl class="kv">
          <dt>버전</dt><dd class="mono">${esc(s.appVersion)}</dd>
          <dt>빌드</dt><dd>${esc(s.build)}</dd>
          <dt>라이선스</dt><dd>${esc(s.licence)}</dd>
          <dt>사용자 에이전트</dt><dd class="mono" style="word-break:break-all">${esc(navigator.userAgent)}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="card-head"><h2>데이터 저장소</h2></div>
        <dl class="kv">
          <dt>엔진</dt><dd>${esc(s.dbEngine)}</dd>
          <dt>스키마 버전</dt><dd class="mono">${esc(s.dbSchema)}</dd>
          <dt>영속성</dt><dd>없음 — 새로고침 시 초기 데이터로 복원</dd>
        </dl>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>플러그인</h2></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>플러그인</th><th>상태</th><th>설명</th></tr></thead>
        <tbody>${s.plugins.map((p) => `<tr>
          <td><b>${esc(p.name)}</b></td>
          <td>${p.enabled ? '<span class="badge ok">사용</span>' : '<span class="badge mute">미사용</span>'}</td>
          <td>${esc(p.notes)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>데이터 건수</h2></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>항목</th><th class="num">건수</th></tr></thead>
        <tbody>${[
          ['건물', db.buildings.length], ['전산실', db.rooms.length], ['랙', db.racks.length],
          ['장비', db.devices.length], ['앱', db.apps.length], ['장비-앱 연결', db.appDevices.length],
          ['하드웨어 모델', db.hardware.length], ['운영체제', db.operatingSystems.length],
          ['조직', db.organisations.length], ['역할', db.roles.length], ['서비스 수준', db.serviceLevels.length],
          ['도메인', db.domains.length]
        ].map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num mono">${v}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }

  /* ======================================================================
     11. 통합 검색
     ====================================================================== */
  function renderSearch(r) {
    const q = (r.query.q || '').trim();
    const lq = q.toLowerCase();
    if (!q) return pageHead('검색', '검색어를 입력하세요') + '<div class="card"><div class="empty"><div class="big">🔎</div><p>장비명 · 시리얼 · 자산번호로 부분 검색이 가능합니다.</p></div></div>';

    const devs = db.devices.map(dv).filter((v) =>
      v.name.toLowerCase().includes(lq) || v.fqdn.toLowerCase().includes(lq) ||
      String(v.serial).toLowerCase().includes(lq) || String(v.asset).toLowerCase().includes(lq));
    const rks = db.racks.filter((x) => x.name.toLowerCase().includes(lq));
    const aps = db.apps.filter((x) => x.name.toLowerCase().includes(lq));
    const cols = ['name', 'rack', 'pos', 'hardware', 'serial', 'asset', 'customer', 'status'].map((k) => DEVICE_COLUMNS[k]);

    return pageHead('검색 결과', `"${esc(q)}" · 장비 ${devs.length} · 랙 ${rks.length} · 앱 ${aps.length}`) + `
    <div class="card">
      <div class="card-head"><h2>장비 ${devs.length}건</h2></div>
      ${devs.length ? sortableTable(cols, devs, { key: 'name', dir: 1 }, 'noop', { rowClass: (x) => (x.inService ? '' : 'off') })
        : '<div class="empty"><p>일치하는 장비가 없습니다.</p></div>'}
    </div>
    ${rks.length ? `<div class="card"><div class="card-head"><h2>랙 ${rks.length}건</h2></div><div class="card-body">
      ${rks.map((x) => `<a class="chip" href="#/rack/${esc(x.id)}">${esc(x.name)} <span class="muted">${esc(rackLocation(x))}</span></a> `).join('')}</div></div>` : ''}
    ${aps.length ? `<div class="card"><div class="card-head"><h2>앱 ${aps.length}건</h2></div><div class="card-body">
      ${aps.map((x) => `<a class="chip" href="#/app/${esc(x.id)}">${esc(x.name)}</a> `).join('')}</div></div>` : ''}`;
  }

  function notFound(what) {
    return `<div class="card"><div class="empty"><div class="big">🚫</div><p>요청한 ${esc(what)}을(를) 찾을 수 없습니다.</p>
      <p><a href="#/devices">장비 목록으로</a></p></div></div>`;
  }

  /* ======================================================================
     12. 모달 / 폼
     ====================================================================== */
  let modalSubmit = null;

  function closeModal() {
    $('#modal-root').innerHTML = '';
    modalSubmit = null;
  }

  function openModal(title, bodyHtml, footHtml, onSubmit, wide) {
    modalSubmit = onSubmit || null;
    $('#modal-root').innerHTML = `
      <div class="modal-back" data-modal-back>
        <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <form id="modal-form">
            <div class="modal-head"><h2>${esc(title)}</h2>
              <button type="button" class="icon-btn close" data-modal-close aria-label="닫기">✕</button></div>
            <div class="modal-body">${bodyHtml}</div>
            <div class="modal-foot">${footHtml}</div>
          </form>
        </div>
      </div>`;
    const first = $('#modal-form input:not([type=hidden]), #modal-form select, #modal-form textarea');
    if (first) first.focus();
  }

  function confirmModal(title, message, confirmLabel, onOk) {
    openModal(title, `<p style="margin:0 0 6px">${message}</p>`,
      `<button type="button" class="btn" data-modal-close>취소</button>
       <button type="submit" class="btn danger">${esc(confirmLabel)}</button>`,
      () => { onOk(); return true; });
  }

  /** 필드 정의 → 폼 HTML */
  function fieldHtml(f, values) {
    const val = values[f.k];
    const id = 'f-' + f.k;
    const cls = 'fld ' + (f.full ? 'full ' : '') + (f.type === 'check' ? 'check' : '');
    let input;
    if (f.type === 'select') {
      input = `<select class="inp" id="${id}" name="${esc(f.k)}">
        ${f.blank !== undefined ? `<option value="">${esc(f.blank)}</option>` : ''}
        ${selectOptions(f.options || [], val, f.labeler)}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea class="inp" id="${id}" name="${esc(f.k)}">${esc(val || '')}</textarea>`;
    } else if (f.type === 'check') {
      return `<div class="${cls}"><input type="checkbox" id="${id}" name="${esc(f.k)}" ${val ? 'checked' : ''}>
              <label for="${id}">${esc(f.label)}</label></div>`;
    } else {
      input = `<input class="inp" type="${f.type || 'text'}" id="${id}" name="${esc(f.k)}" value="${esc(val == null ? '' : val)}"
        ${f.required ? 'required' : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}
        ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
    }
    if (f.type === 'section') return `<div class="section-title">${esc(f.label)}</div>`;
    return `<div class="${cls}"><label for="${id}">${esc(f.label)}${f.required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>
      ${input}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
  }

  function formHtml(fields, values) {
    return `<div class="form-grid">${fields.map((f) =>
      f.type === 'section' ? `<div class="section-title">${esc(f.label)}</div>` : fieldHtml(f, values)).join('')}</div>`;
  }

  function readForm(fields) {
    const form = $('#modal-form');
    const out = {};
    fields.forEach((f) => {
      if (f.type === 'section') return;
      const el = form.elements[f.k];
      if (!el) return;
      if (f.type === 'check') out[f.k] = el.checked;
      else if (f.type === 'number') out[f.k] = Number(el.value);
      else out[f.k] = el.value;
    });
    return out;
  }

  /* --- 장비 폼 ----------------------------------------------------------- */
  function deviceFields() {
    return [
      { type: 'section', label: '기본' },
      { k: 'name', label: '장비명', required: true, placeholder: '예: web04' },
      { k: 'domainId', label: '도메인', type: 'select', options: db.domains },
      { k: 'customerId', label: '고객사', type: 'select', options: customers() },
      { k: 'roleId', label: '역할', type: 'select', options: db.roles },
      { k: 'serviceLevelId', label: '서비스 수준', type: 'select', options: db.serviceLevels },
      { type: 'section', label: '설치 위치' },
      { k: 'rackId', label: '랙', type: 'select', options: db.racks, labeler: (r) => r.name + ' — ' + rackLocation(r) },
      { k: 'rackPos', label: '시작 U 위치', type: 'number', min: 1, max: 60, required: true, help: '장비가 차지하는 가장 아래쪽 U 번호' },
      { type: 'section', label: '하드웨어 · 자산' },
      { k: 'hardwareId', label: '하드웨어 모델', type: 'select', options: db.hardware, labeler: (h) => h.name + ' (' + h.sizeU + 'U)' },
      { k: 'serial', label: '시리얼 / 서비스 태그' },
      { k: 'assetNo', label: '자산번호' },
      { k: 'purchased', label: '구매일', type: 'date' },
      { k: 'warrantyEnd', label: '보증 만료일', type: 'date' },
      { type: 'section', label: '소프트웨어' },
      { k: 'osId', label: '운영체제', type: 'select', options: db.operatingSystems, labeler: (o) => o.name + (o.version ? ' ' + o.version : '') },
      { k: 'osLicenceKey', label: 'OS 라이선스 키' },
      { type: 'section', label: '상태' },
      { k: 'inService', label: '서비스 중', type: 'check' },
      { k: 'monitored', label: '모니터링 대상', type: 'check' },
      { k: 'notes', label: '비고', type: 'textarea', full: true }
    ];
  }

  function positionConflict(rackId, pos, sizeU, ignoreId) {
    const rack = L.rack(rackId);
    if (!rack) return '랙을 선택하세요.';
    if (pos < 1 || pos + sizeU - 1 > rack.sizeU) return `U 위치가 랙 범위를 벗어납니다. (1 ~ ${rack.sizeU - sizeU + 1})`;
    const hit = rackDevices(rackId).find((d) => {
      if (d.id === ignoreId) return false;
      const a1 = d.rackPos, a2 = d.rackPos + deviceSize(d) - 1;
      return !(pos + sizeU - 1 < a1 || pos > a2);
    });
    return hit ? `U${pos}~U${pos + sizeU - 1} 구간이 '${hit.name}' 장비와 겹칩니다.` : '';
  }

  function openDeviceForm(device, presets) {
    const fields = deviceFields();
    const isNew = !device;
    const values = device ? Object.assign({}, device) : Object.assign({
      name: '', domainId: 'dm-gabia', customerId: customers()[0].id, roleId: 'ro-web', serviceLevelId: 'sl-silver',
      rackId: db.racks[0].id, rackPos: 1, hardwareId: 'hw-r640', serial: '', assetNo: '',
      purchased: todayISO(), warrantyEnd: '', osId: 'os-u2204', osLicenceKey: '',
      inService: true, monitored: true, notes: ''
    }, presets || {});

    openModal(isNew ? '장비 추가' : `장비 편집 — ${device.name}`, formHtml(fields, values), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      if (!v.name.trim()) { toast('장비명을 입력하세요.'); return false; }
      const size = (L.hw(v.hardwareId) || { sizeU: 1 }).sizeU;
      const err = positionConflict(v.rackId, v.rackPos, size, device ? device.id : null);
      if (err) { toast(err); return false; }
      if (isNew) {
        db.devices.push(Object.assign({
          id: uid('dev'), createdBy: 'rackmanager', updatedBy: 'rackmanager',
          updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
        }, v));
        toast(`장비 '${v.name}'을(를) 추가했습니다.`);
      } else {
        Object.assign(device, v, { updatedBy: 'rackmanager', updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') });
        toast('저장했습니다.');
      }
      return true;
    }, true);
  }

  /* --- 랙 / 앱 폼 -------------------------------------------------------- */
  function openRackForm(rack) {
    const fields = [
      { k: 'name', label: '랙 이름', required: true, placeholder: '예: GN-A-04' },
      { k: 'roomId', label: '전산실', type: 'select', options: db.rooms, labeler: (r) => nm(L.building(r.buildingId)) + ' · ' + r.name },
      { k: 'row', label: '열(Row)', placeholder: '예: A열', help: '원본 RackManager 1.2.5는 UI에서 행 관리를 지원하지 않습니다' },
      { k: 'sizeU', label: '크기 (U)', type: 'number', min: 1, max: 60, required: true },
      { k: 'notes', label: '비고', type: 'textarea', full: true }
    ];
    const isNew = !rack;
    const values = rack || { name: '', roomId: db.rooms[0].id, row: '', sizeU: 42, notes: '' };
    openModal(isNew ? '랙 추가' : `랙 편집 — ${rack.name}`, formHtml(fields, values), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      if (!v.name.trim()) { toast('랙 이름을 입력하세요.'); return false; }
      if (!isNew) {
        const maxTop = Math.max(0, ...rackDevices(rack.id).map((d) => d.rackPos + deviceSize(d) - 1));
        if (v.sizeU < maxTop) { toast(`이미 U${maxTop}까지 장비가 있어 ${v.sizeU}U로 줄일 수 없습니다.`); return false; }
      }
      if (isNew) { db.racks.push(Object.assign({ id: uid('rk') }, v)); toast(`랙 '${v.name}'을(를) 추가했습니다.`); }
      else { Object.assign(rack, v); toast('저장했습니다.'); }
      return true;
    });
  }

  function openAppForm(app) {
    const fields = [
      { k: 'name', label: '앱 이름', required: true },
      { k: 'notes', label: '비고', type: 'textarea', full: true }
    ];
    const isNew = !app;
    openModal(isNew ? '앱 추가' : `앱 편집 — ${app.name}`, formHtml(fields, app || { name: '', notes: '' }), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      if (!v.name.trim()) { toast('앱 이름을 입력하세요.'); return false; }
      if (isNew) { db.apps.push(Object.assign({ id: uid('app') }, v)); toast('앱을 추가했습니다.'); }
      else { Object.assign(app, v); toast('저장했습니다.'); }
      return true;
    });
  }

  function openLinkAppForm(deviceId) {
    const d = L.device(deviceId);
    const linked = new Set(db.appDevices.filter((l) => l.deviceId === deviceId).map((l) => l.appId));
    const options = db.apps.filter((a) => !linked.has(a.id));
    if (!options.length) { toast('연결할 수 있는 앱이 더 없습니다.'); return; }
    const fields = [{ k: 'appId', label: '앱', type: 'select', options: options }];
    openModal(`'${d.name}'에 앱 연결`, formHtml(fields, { appId: options[0].id }), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">연결</button>`, () => {
      const v = readForm(fields);
      db.appDevices.push({ appId: v.appId, deviceId: deviceId });
      toast('앱을 연결했습니다.');
      return true;
    });
  }

  function openLinkDeviceForm(appId) {
    const a = L.app(appId);
    const linked = new Set(db.appDevices.filter((l) => l.appId === appId).map((l) => l.deviceId));
    const options = db.devices.filter((d) => !linked.has(d.id));
    if (!options.length) { toast('연결할 수 있는 장비가 더 없습니다.'); return; }
    const fields = [{ k: 'deviceId', label: '장비', type: 'select', options: options, labeler: (d) => d.name + ' — ' + nm(L.rack(d.rackId)) }];
    openModal(`'${a.name}'에 장비 연결`, formHtml(fields, { deviceId: options[0].id }), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">연결</button>`, () => {
      const v = readForm(fields);
      db.appDevices.push({ appId: appId, deviceId: v.deviceId });
      toast('장비를 연결했습니다.');
      return true;
    });
  }

  function openConfigForm(secKey, item) {
    const sec = CONFIG_SECTIONS[secKey];
    const fields = sec.fields();
    const isNew = !item;
    const defaults = {};
    fields.forEach((f) => {
      if (f.type === 'check') defaults[f.k] = false;
      else if (f.type === 'select') defaults[f.k] = (f.options && f.options[0]) ? f.options[0].id : '';
      else if (f.type === 'number') defaults[f.k] = f.min || 1;
      else defaults[f.k] = '';
    });
    openModal(isNew ? `${sec.entity} 추가` : `${sec.entity} 편집 — ${item.name}`,
      formHtml(fields, item || defaults), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      if (!v.name || !v.name.trim()) { toast('이름을 입력하세요.'); return false; }
      if (isNew) { sec.list().push(Object.assign({ id: uid(secKey.slice(0, 3)) }, v)); toast(`${sec.entity}을(를) 추가했습니다.`); }
      else { Object.assign(item, v); toast('저장했습니다.'); }
      return true;
    });
  }

  /* ======================================================================
     13. CSV 내보내기
     ====================================================================== */
  function toCsv(headers, rows) {
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    return [headers.map(q).join(',')].concat(rows.map((r) => r.map(q).join(','))).join('\r\n');
  }

  function exportDevices() {
    const view = DEVICE_VIEWS[state.devices.view] ? state.devices.view : 'default';
    const cols = DEVICE_VIEWS[view].cols.map((k) => DEVICE_COLUMNS[k]);
    const rows = applySort(filteredDevices(), state.devices.sort, cols);
    const csv = toCsv(cols.map((c) => c.label), rows.map((r) => cols.map((c) => {
      if (c.key === 'inService') return r.inService ? '서비스 중' : '서비스 중지';
      if (c.key === 'monitored') return r.monitored ? '감시 중' : '미감시';
      if (c.key === 'pos') return r.posLabel + ' (' + r.sizeU + 'U)';
      return c.value(r);
    })));
    download(`rackmanager-devices-${view}-${todayISO()}.csv`, csv);
    toast(`${rows.length}건을 내보냈습니다.`);
  }

  function exportRacks() {
    const rows = rackRows();
    const csv = toCsv(['랙', '건물', '전산실', '열', '크기(U)', '장비 수', '사용(U)', '여유(U)', '사용률(%)', '비고'],
      rows.map((r) => [r.rack.name, r.building, r.room, r.rack.row, r.rack.sizeU, r.st.devices, r.st.used, r.st.free, r.st.pct, r.rack.notes]));
    download(`rackmanager-racks-${todayISO()}.csv`, csv);
    toast(`${rows.length}건을 내보냈습니다.`);
  }

  function exportApps() {
    const csv = toCsv(['앱', '연결 장비 수', '장비 목록', '비고'],
      db.apps.map((a) => [a.name, appDeviceList(a.id).length, appDeviceList(a.id).map((d) => d.name).join(' '), a.notes]));
    download(`rackmanager-apps-${todayISO()}.csv`, csv);
    toast(`${db.apps.length}건을 내보냈습니다.`);
  }

  function exportReport() {
    const lines = [];
    lines.push(['구분', '항목', '값']);
    rackRows().forEach((r) => lines.push(['랙 공간', r.rack.name, `${r.st.used}/${r.rack.sizeU}U 사용, 여유 ${r.st.free}U`]));
    tally(db.devices, (d) => nm(L.org(d.customerId))).forEach((t) => lines.push(['고객사별 장비', t.key, t.n + '대']));
    tally(db.devices, (d) => { const o = L.os(d.osId); return o && o.id !== 'os-none' ? o.name + ' ' + o.version : null; })
      .forEach((t) => lines.push(['운영체제', t.key, t.n + '대']));
    tally(db.devices, (d) => nm(L.hw(d.hardwareId))).forEach((t) => lines.push(['하드웨어', t.key, t.n + '대']));
    const csv = toCsv(lines[0], lines.slice(1));
    download(`rackmanager-report-${todayISO()}.csv`, csv);
    toast('리포트 요약을 내보냈습니다.');
  }

  /* ======================================================================
     14. 이벤트 바인딩
     ====================================================================== */
  function guard() {
    if (state.readonly) { toast('읽기 전용 모드에서는 변경할 수 없습니다.'); return false; }
    return true;
  }

  document.addEventListener('click', function (e) {
    const t = e.target;

    /* 모달 닫기 */
    if (t.closest('[data-modal-close]') || t.hasAttribute('data-modal-back')) { closeModal(); return; }

    /* 정렬 */
    const sortEl = t.closest('[data-sort]');
    if (sortEl) {
      const [ns, key] = sortEl.dataset.sort.split(':');
      if (ns !== 'noop' && state[ns]) {
        const s = state[ns].sort;
        s.dir = s.key === key ? -s.dir : 1;
        s.key = key;
        render();
      }
      return;
    }

    /* 필터 칩 해제 */
    const clr = t.closest('[data-clear-filter]');
    if (clr) { state.devices.filters[clr.dataset.clearFilter] = ''; render(); return; }
    if (t.closest('[data-reset-filters]')) {
      Object.keys(state.devices.filters).forEach((k) => { state.devices.filters[k] = ''; });
      render(); return;
    }
    if (t.closest('[data-toggle-filters]')) { state.devices.showFilters = !state.devices.showFilters; render(); return; }

    /* 랙 선택 */
    const rsel = t.closest('[data-rack-sel]');
    if (rsel) {
      const id = rsel.dataset.rackSel;
      if (rsel.checked) state.racks.selected.add(id); else state.racks.selected.delete(id);
      const btn = $('[data-action="view-selected"]');
      if (btn) { btn.textContent = `📐 선택한 랙 실장도 (${state.racks.selected.size})`; btn.classList.toggle('primary', state.racks.selected.size > 0); }
      return;
    }

    /* 빈 슬롯 클릭 → 해당 U에 장비 추가 */
    const slot = t.closest('[data-add-at]');
    if (slot) {
      if (!guard()) return;
      const [rackId, u] = slot.dataset.addAt.split(':');
      openDeviceForm(null, { rackId: rackId, rackPos: Number(u) });
      return;
    }

    if (t.closest('#print-inline')) { window.print(); return; }

    /* 액션 버튼 */
    const act = t.closest('[data-action]');
    if (!act) return;
    const a = act.dataset.action;
    const id = act.dataset.id;

    const mutating = !['view-selected', 'select-all-racks', 'select-none-racks',
                       'export-devices', 'export-racks', 'export-apps', 'export-report'].includes(a);
    if (mutating && !guard()) return;

    switch (a) {
      case 'add-device':  openDeviceForm(null, act.dataset.rack ? { rackId: act.dataset.rack } : null); break;
      case 'edit-device': openDeviceForm(L.device(id)); break;
      case 'copy-device': {
        const src = L.device(id);
        const copy = Object.assign({}, src, { name: src.name + '-copy', serial: '', assetNo: '' });
        delete copy.id;
        openDeviceForm(null, copy);
        break;
      }
      case 'del-device': {
        const d = L.device(id);
        confirmModal('장비 삭제', `<b>${esc(d.name)}</b> 장비를 삭제할까요?<br><span class="muted">연결된 앱 정보도 함께 제거됩니다. 되돌릴 수 없습니다.</span>`, '삭제', () => {
          db.devices.splice(db.devices.indexOf(d), 1);
          for (let i = db.appDevices.length - 1; i >= 0; i--) if (db.appDevices[i].deviceId === d.id) db.appDevices.splice(i, 1);
          toast(`'${d.name}'을(를) 삭제했습니다.`);
          if (parseHash().parts[0] === 'device') go('#/devices');
        });
        break;
      }

      case 'add-rack':  openRackForm(null); break;
      case 'edit-rack': openRackForm(L.rack(id)); break;
      case 'copy-rack': {
        const src = L.rack(id);
        openRackForm(null);
        setTimeout(() => {
          const f = $('#modal-form');
          if (!f) return;
          f.elements.name.value = src.name + '-copy';
          f.elements.roomId.value = src.roomId;
          f.elements.row.value = src.row || '';
          f.elements.sizeU.value = src.sizeU;
          f.elements.notes.value = src.notes || '';
        }, 0);
        break;
      }
      case 'del-rack': {
        const rk = L.rack(id);
        const n = rackDevices(rk.id).length;
        if (n) { toast(`'${rk.name}'에 장비 ${n}대가 있어 삭제할 수 없습니다.`); break; }
        confirmModal('랙 삭제', `<b>${esc(rk.name)}</b> 랙을 삭제할까요?`, '삭제', () => {
          db.racks.splice(db.racks.indexOf(rk), 1);
          state.racks.selected.delete(rk.id);
          toast('삭제했습니다.');
          if (parseHash().parts[0] === 'rack') go('#/racks');
        });
        break;
      }

      case 'add-app':  openAppForm(null); break;
      case 'edit-app': openAppForm(L.app(id)); break;
      case 'del-app': {
        const ap = L.app(id);
        confirmModal('앱 삭제', `<b>${esc(ap.name)}</b> 앱을 삭제할까요?<br><span class="muted">장비와의 연결도 함께 제거됩니다.</span>`, '삭제', () => {
          db.apps.splice(db.apps.indexOf(ap), 1);
          for (let i = db.appDevices.length - 1; i >= 0; i--) if (db.appDevices[i].appId === ap.id) db.appDevices.splice(i, 1);
          toast('삭제했습니다.');
          if (parseHash().parts[0] === 'app') go('#/apps');
        });
        break;
      }
      case 'link-app':    openLinkAppForm(act.dataset.device); break;
      case 'link-device': openLinkDeviceForm(act.dataset.app); break;
      case 'unlink-app': {
        const i = db.appDevices.findIndex((l) => l.appId === act.dataset.app && l.deviceId === act.dataset.device);
        if (i >= 0) { db.appDevices.splice(i, 1); toast('연결을 해제했습니다.'); render(); }
        break;
      }

      case 'cfg-add':  openConfigForm(act.dataset.sec, null); break;
      case 'cfg-edit': openConfigForm(act.dataset.sec, find(CONFIG_SECTIONS[act.dataset.sec].list(), id)); break;
      case 'cfg-del': {
        const sec = CONFIG_SECTIONS[act.dataset.sec];
        const item = find(sec.list(), id);
        if (sec.inUse(item)) { toast(`'${item.name}'은(는) 사용 중이라 삭제할 수 없습니다.`); break; }
        confirmModal(`${sec.entity} 삭제`, `<b>${esc(item.name)}</b>을(를) 삭제할까요?`, '삭제', () => {
          const list = sec.list();
          list.splice(list.indexOf(item), 1);
          toast('삭제했습니다.');
        });
        break;
      }

      case 'view-selected': {
        const ids = Array.from(state.racks.selected);
        go(ids.length ? '#/physical?racks=' + ids.join(',') : '#/physical');
        break;
      }
      case 'select-all-racks':  db.racks.forEach((r) => state.racks.selected.add(r.id)); render(); break;
      case 'select-none-racks': state.racks.selected.clear(); render(); break;

      case 'export-devices': exportDevices(); break;
      case 'export-racks':   exportRacks(); break;
      case 'export-apps':    exportApps(); break;
      case 'export-report':  exportReport(); break;
    }
  });

  /* 폼 제출 */
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'modal-form') {
      e.preventDefault();
      if (!modalSubmit) { closeModal(); return; }
      const ok = modalSubmit();
      if (ok !== false) { closeModal(); render(); }
      return;
    }
    if (e.target.id === 'search-form') {
      e.preventDefault();
      const q = $('#search-input').value.trim();
      go(q ? '#/search?q=' + encodeURIComponent(q) : '#/devices');
    }
  });

  /* 필터/보기형식 변경 */
  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t.matches('[data-devices-view]')) { state.devices.view = t.value; render(); return; }
    if (t.matches('[data-filter]')) { state.devices.filters[t.dataset.filter] = t.value; render(); return; }
    if (t.id === 'readonly-toggle') {
      state.readonly = t.checked;
      document.body.classList.toggle('ro', state.readonly);
      toast(state.readonly ? '읽기 전용 모드입니다.' : '편집 모드입니다.');
      return;
    }
  });

  /* 필터 입력(디바운스) */
  let filterTimer = null;
  document.addEventListener('input', function (e) {
    if (e.target.matches('input[data-filter="q"]')) {
      clearTimeout(filterTimer);
      const val = e.target.value;
      filterTimer = setTimeout(() => {
        state.devices.filters.q = val;
        render();
        const inp = $('input[data-filter="q"]');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }, 250);
    }
  });

  /* 키보드 단축키 */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('#modal-root').innerHTML) { closeModal(); return; }
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      $('#search-input').focus();
    }
  });

  /* 상단바 버튼 */
  $('#theme-btn').addEventListener('click', function () {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('rm-theme', next); } catch (err) { /* 무시 */ }
  });
  $('#print-btn').addEventListener('click', () => window.print());
  $('#menu-btn').addEventListener('click', function () {
    document.body.classList.toggle('nav-open');
    $('#scrim').hidden = !document.body.classList.contains('nav-open');
  });
  $('#scrim').addEventListener('click', function () {
    document.body.classList.remove('nav-open');
    this.hidden = true;
  });

  /* ======================================================================
     15. 시작
     ====================================================================== */
  try {
    const saved = localStorage.getItem('rm-theme');
    if (saved) document.documentElement.dataset.theme = saved;
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  } catch (err) { /* 무시 */ }

  window.addEventListener('hashchange', render);
  render();
})();
