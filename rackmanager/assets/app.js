/* ==========================================================================
   RackManager prototype — application
   RackManager 1.2.5 Features / User Guide 문서의 기능 구성을 옮긴 뒤
   IP 주소 관리(IPAM) · 장비 라이프사이클 · 전력 · 변경 이력 · 대시보드로
   관리 범위를 넓힌 프론트엔드 전용 프로토타입입니다.
   모든 CRUD는 메모리 배열을 조작하고, 변경 시 localStorage에 자동 저장합니다.
   ========================================================================== */
(function () {
  'use strict';

  const db = window.RM_DATA;
  const IP = window.RM_IP;
  const CURRENT_USER = 'rackmanager';

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
  const pad2 = (n) => String(n).padStart(2, '0');
  const nowStamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
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
     1-1. 영속성 — localStorage 자동 저장 / JSON 백업·복원
     ====================================================================== */
  const STORE_KEY = 'rm-db';
  const SCHEMA = 11;
  const COLLECTIONS = ['buildings', 'rooms', 'racks', 'hardware', 'operatingSystems', 'organisations', 'roles',
                       'serviceLevels', 'domains', 'devices', 'apps', 'appDevices', 'vlans', 'subnets', 'ipAddresses', 'changeLog'];
  // 스키마 10(원본 1.2.5 구성) 백업에는 없던 항목 — 복원 시 빈 배열로 채움
  const OPTIONAL_COLLECTIONS = ['vlans', 'subnets', 'ipAddresses', 'changeLog'];
  const store = { savedAt: null, restored: false, error: '', bytes: 0, resetting: false };

  function snapshot() {
    const data = {};
    COLLECTIONS.forEach((k) => { data[k] = db[k]; });
    return { app: 'RackManager', schema: SCHEMA, savedAt: nowStamp(), data: data };
  }

  function persist() {
    if (store.resetting) return;   // 초기화 직후 새로고침 전에 다시 저장되지 않도록
    try {
      const snap = snapshot();
      const json = JSON.stringify(snap);
      localStorage.setItem(STORE_KEY, json);
      store.savedAt = snap.savedAt;
      store.bytes = json.length;
      store.error = '';
    } catch (err) {
      store.error = '브라우저 저장소에 저장하지 못했습니다: ' + err.message;
    }
    updateSaveState();
  }

  /** 이전 버전 데이터에 새 필드 기본값을 채워 넣음 */
  function normalize(data) {
    data = data || db;
    data.devices.forEach((d) => {
      if (!d.status) d.status = d.inService === false ? 'maintenance' : 'active';
      d.inService = d.status === 'active';
      if (d.owner == null) d.owner = '';
    });
    data.racks.forEach((r) => { if (r.powerKw == null) r.powerKw = 6; });
    data.hardware.forEach((h) => { if (h.powerW == null) h.powerW = 0; });
  }

  function applyData(data) {
    if (!data || typeof data !== 'object') throw new Error('데이터 형식이 올바르지 않습니다.');
    const missing = COLLECTIONS.filter((k) => !Array.isArray(data[k]) && !OPTIONAL_COLLECTIONS.includes(k));
    if (missing.length) throw new Error('필수 항목 누락: ' + missing.join(', '));
    // 검증·정리를 모두 마친 뒤에만 현재 데이터와 교체 (실패 시 기존 데이터 유지)
    const next = {};
    COLLECTIONS.forEach((k) => { next[k] = Array.isArray(data[k]) ? data[k] : []; });
    const bad = COLLECTIONS.filter((k) => next[k].some((x) => !x || typeof x !== 'object'));
    if (bad.length) throw new Error('잘못된 항목 포함: ' + bad.join(', '));
    normalize(next);
    COLLECTIONS.forEach((k) => { db[k] = next[k]; });
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (!snap || snap.schema !== SCHEMA) return;
      applyData(snap.data);
      store.savedAt = snap.savedAt;
      store.bytes = raw.length;
      store.restored = true;
    } catch (err) {
      store.error = '저장된 데이터를 불러오지 못해 초기 데이터로 시작합니다.';
    }
  }

  function updateSaveState() {
    const el = $('#foot-saved');
    if (!el) return;
    el.textContent = store.error ? '저장 실패' : store.savedAt ? '자동 저장 ' + store.savedAt : '초기 데이터';
    el.classList.toggle('err', !!store.error);
  }

  /* --- 변경 이력 ------------------------------------------------------- */
  const ENTITY_LABEL = { device: '장비', rack: '랙', app: '앱', subnet: '서브넷', vlan: 'VLAN', ip: 'IP 주소', config: '설정', system: '시스템' };
  const ACTION_LABEL = { create: '추가', update: '수정', delete: '삭제', link: '연결', unlink: '연결 해제', import: '복원', bulk: '일괄 변경' };

  /** refs: 이 변경과 관련된 다른 개체 id (예: IP 변경 → 장비 id, 서브넷 id) */
  function logChange(entity, entityId, action, summary, refs) {
    db.changeLog.unshift({ id: uid('log'), at: nowStamp(), user: CURRENT_USER, entity: entity, entityId: entityId || '',
                           action: action, summary: summary, refs: (refs || []).filter(Boolean) });
    if (db.changeLog.length > 1000) db.changeLog.length = 1000;
  }

  /** 폼 필드 정의를 이용해 '항목: 이전 → 이후' 형태의 변경 요약을 생성 */
  function diffSummary(fields, before, after) {
    const fmt = (f, v) => {
      if (f.type === 'check') return v ? '예' : '아니오';
      if (v === '' || v == null) return '—';
      if (f.type === 'select') {
        const o = (f.options || []).find((x) => x.id === v);
        return o ? (f.labeler ? f.labeler(o) : o.name) : String(v);
      }
      const t = String(v);
      return t.length > 24 ? t.slice(0, 24) + '…' : t;
    };
    return fields.filter((f) => f.k && f.type !== 'section')
      .filter((f) => String(before[f.k] == null ? '' : before[f.k]) !== String(after[f.k] == null ? '' : after[f.k]))
      .map((f) => `${f.label}: ${fmt(f, before[f.k])} → ${fmt(f, after[f.k])}`)
      .join(', ');
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
    app:      (id) => find(db.apps, id),
    subnet:   (id) => find(db.subnets, id),
    vlan:     (id) => find(db.vlans, id),
    ip:       (id) => find(db.ipAddresses, id)
  };
  const nm = (o) => (o ? o.name : '');

  const customers    = () => db.organisations.filter((o) => o.customer);
  const hwMakers     = () => db.organisations.filter((o) => o.hardware);
  const swMakers     = () => db.organisations.filter((o) => o.software);
  const rackDevices  = (rackId) => db.devices.filter((d) => d.rackId === rackId);
  const deviceApps   = (devId) => db.appDevices.filter((l) => l.deviceId === devId).map((l) => L.app(l.appId)).filter(Boolean);
  const appDeviceList= (appId) => db.appDevices.filter((l) => l.appId === appId).map((l) => L.device(l.deviceId)).filter(Boolean);

  function deviceSize(d) { const h = L.hw(d.hardwareId); return h ? h.sizeU : 1; }
  function deviceWatts(d) { const h = L.hw(d.hardwareId); return h ? (Number(h.powerW) || 0) : 0; }

  /* --- 장비 라이프사이클 상태 ------------------------------------------- */
  const DEVICE_STATUS = {
    active:      { label: '운영',      cls: 'ok' },
    staging:     { label: '구축 중',   cls: 'info' },
    maintenance: { label: '점검 중',   cls: 'warn' },
    rma:         { label: 'RMA',       cls: 'danger' },
    decom:       { label: '폐기 예정', cls: 'mute' },
    stock:       { label: '재고/예비', cls: 'mute' }
  };
  const STATUS_ORDER = Object.keys(DEVICE_STATUS);
  const statusOptions = () => STATUS_ORDER.map((k) => ({ id: k, name: DEVICE_STATUS[k].label }));
  const statusLabel = (st) => (DEVICE_STATUS[st] || DEVICE_STATUS.active).label;
  function statusBadge(st) {
    const s = DEVICE_STATUS[st] || DEVICE_STATUS.active;
    return `<span class="badge ${s.cls}"><span class="dotstat ${s.cls}"></span> ${esc(s.label)}</span>`;
  }

  /* --- IPAM ------------------------------------------------------------ */
  const IP_STATUS = {
    assigned: { label: '할당', cls: 'accent' },
    reserved: { label: '예약', cls: 'warn' },
    dhcp:     { label: 'DHCP', cls: 'info' }
  };
  const IP_TYPES = { primary: '서비스', secondary: '보조', mgmt: '관리', ipmi: 'IPMI/BMC', vip: 'VIP', gateway: '게이트웨이', dhcp: 'DHCP 풀' };
  const SUBNET_PURPOSE = { svc: '서비스', mgmt: '관리', oob: 'IPMI/OOB', dr: 'DR/복제', etc: '기타' };
  const mapOptions = (obj, pickLabel) => Object.keys(obj).map((k) => ({ id: k, name: pickLabel ? pickLabel(obj[k]) : obj[k] }));
  const ipStatusBadge = (st) => { const s = IP_STATUS[st] || { label: st, cls: 'mute' }; return `<span class="badge ${s.cls}">${esc(s.label)}</span>`; };
  const ipSortKey = (addr) => { const n = IP.toInt(addr); return n === null ? -1 : n; };

  const subnetNet   = (s) => IP.parseCidr(s.cidr);
  const subnetIps   = (sid) => db.ipAddresses.filter((i) => i.subnetId === sid);
  const deviceIps   = (did) => db.ipAddresses.filter((i) => i.deviceId === did).sort((a, b) => IP.compare(a.address, b.address));
  const subnetLabel = (s) => s.cidr + ' — ' + s.name;
  const vlanLabel   = (v) => (v ? 'VLAN ' + v.vid + ' · ' + v.name : '');

  function subnetStats(s) {
    const net = subnetNet(s);
    const ips = subnetIps(s.id);
    const used = new Set(ips.map((i) => i.address)).size;
    const by = { assigned: 0, reserved: 0, dhcp: 0 };
    ips.forEach((i) => { by[i.status] = (by[i.status] || 0) + 1; });
    const total = net ? net.usable : 0;
    return { net: net, total: total, used: used, free: Math.max(0, total - used),
             pct: total ? Math.round((used / total) * 100) : 0,
             assigned: by.assigned, reserved: by.reserved, dhcp: by.dhcp, count: ips.length };
  }

  /** 주소가 속한 가장 구체적인(프리픽스가 긴) 서브넷 */
  function subnetFor(addr) {
    const n = IP.toInt(addr);
    if (n === null) return null;
    let best = null, bestPrefix = -1;
    db.subnets.forEach((s) => {
      const net = subnetNet(s);
      if (net && IP.contains(net, n) && net.prefix > bestPrefix) { best = s; bestPrefix = net.prefix; }
    });
    return best;
  }

  function nextFreeIp(s) {
    const net = s && subnetNet(s);
    if (!net) return '';
    const used = new Set(subnetIps(s.id).map((i) => IP.toInt(i.address)));
    if (s.gateway) used.add(IP.toInt(s.gateway));   // 예약 기록이 없어도 게이트웨이 주소는 내주지 않음
    const n = IP.nextFree(net, used);
    return n === null ? '' : IP.fromInt(n);
  }

  function primaryIp(did) {
    const ips = deviceIps(did);
    const p = ips.find((i) => i.type === 'primary') || ips.find((i) => i.type === 'mgmt') || ips.find((i) => i.type !== 'ipmi');
    return p ? p.address : '';
  }
  const ipmiIp = (did) => { const i = deviceIps(did).find((x) => x.type === 'ipmi'); return i ? i.address : ''; };

  /** 같은 주소가 두 번 이상 등록된 경우 (수기 입력/가져오기로 생길 수 있음) */
  function ipConflicts() {
    const map = new Map();
    db.ipAddresses.forEach((i) => { if (!map.has(i.address)) map.set(i.address, []); map.get(i.address).push(i); });
    return Array.from(map).filter(([, list]) => list.length > 1);
  }
  const conflictSet = () => new Set(ipConflicts().map(([addr]) => addr));

  /** 장비 유형 판별 — IPMI 점검 대상(서버류) 여부 */
  const isServerLike = (d) => !['ro-switch', 'ro-fw', 'ro-lb', 'ro-power'].includes(d.roleId) &&
    ['org-dell', 'org-hpe', 'org-smc'].includes((L.hw(d.hardwareId) || {}).manufacturerId);

  function fqdn(d) {
    const dom = L.domain(d.domainId);
    return dom && dom.id !== 'dm-none' ? d.name + '.' + dom.name : d.name;
  }

  function rackStats(rack) {
    const list = rackDevices(rack.id);
    const used = list.reduce((s, d) => s + deviceSize(d), 0);
    const watts = list.reduce((s, d) => s + deviceWatts(d), 0);
    const capW = (Number(rack.powerKw) || 0) * 1000;
    return { devices: list.length, used: used, free: Math.max(0, rack.sizeU - used), pct: Math.round((used / rack.sizeU) * 100),
             watts: watts, capW: capW, powerPct: capW ? Math.round((watts / capW) * 100) : 0 };
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
      status: d.status,
      statusLabel: statusLabel(d.status),
      owner: d.owner || '',
      watts: deviceWatts(d),
      ip: primaryIp(d.id),
      ipmi: ipmiIp(d.id),
      ips: deviceIps(d.id).map((i) => i.address).join(' '),
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

  function powerCell(st) {
    if (!st.capW) return '<span class="muted">—</span>';
    return `<div style="display:flex;align-items:center;gap:8px;min-width:150px">${meterBar(st.powerPct)}
      <span class="mono nowrap" style="font-size:11px">${(st.watts / 1000).toFixed(1)}/${(st.capW / 1000).toFixed(0)}kW</span></div>`;
  }

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
      filters: { q: '', customer: '', role: '', os: '', hardware: '', sl: '', building: '', rack: '', service: '', status: '' },
      selected: new Set()
    },
    racks: { sort: { key: 'name', dir: 1 }, selected: new Set() },
    apps:  { sort: { key: 'name', dir: 1 } },
    ipam:  { sort: { key: 'cidr', dir: 1 }, q: '', building: '', purpose: '' },
    ips:   { sort: { key: 'address', dir: 1 }, q: '', status: '', type: '', subnet: '', conflict: '' },
    vlans: { sort: { key: 'vid', dir: 1 } },
    activity: { entity: '', q: '', limit: 100 },
    readonly: false
  };

  /* ======================================================================
     4. 라우터
     ====================================================================== */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/dashboard';
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    return { parts, query, path };
  }

  const ROUTES = {
    dashboard: renderDashboard,
    devices:  renderDevices,
    device:   renderDeviceDetail,
    racks:    renderRacks,
    rack:     renderRackDetail,
    physical: renderPhysical,
    apps:     renderApps,
    app:      renderAppDetail,
    ipam:     renderIpam,
    subnet:   renderSubnetDetail,
    reports:  renderReports,
    activity: renderActivity,
    config:   renderConfig,
    system:   renderSystem,
    search:   renderSearch
  };

  let lastPath = null;
  function render() {
    const r = parseHash();
    const head = ROUTES[r.parts[0]] ? r.parts[0] : 'dashboard';
    $('#main').innerHTML = ROUTES[head](r) || '';
    syncNav(head);
    updateCounts();
    $('#foot-time').textContent = new Date().toLocaleString('ko-KR');
    // 같은 화면 안에서 정렬·필터·선택만 바뀐 경우에는 스크롤 위치를 유지
    if (r.path !== lastPath) window.scrollTo({ top: 0 });
    lastPath = r.path;
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
    const alerts = collectAlerts().filter((a) => a.level !== 'ok').length;
    const map = { devices: db.devices.length, racks: db.racks.length, apps: db.apps.length, subnets: db.subnets.length, alerts: alerts || '' };
    $$('[data-count]').forEach((el) => {
      el.textContent = map[el.dataset.count];
      el.classList.toggle('alert', el.dataset.count === 'alerts' && !!alerts);
    });
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

    // opts.select = { set: Set<id>, attr: 'dev' } → 행 앞에 선택 체크박스
    const sel = opts.select;
    const allOn = sel && rows.length > 0 && rows.every((row) => sel.set.has(row.id));
    const selHead = sel ? `<th class="selcol"><input type="checkbox" data-sel-all="${sel.attr}" ${allOn ? 'checked' : ''} aria-label="표시된 항목 모두 선택"></th>` : '';
    const span = cols.length + (opts.rowActions ? 1 : 0) + (sel ? 1 : 0);
    const body = rows.length ? rows.map((row) => {
      const pick = sel ? `<td class="selcol"><input type="checkbox" data-sel="${sel.attr}" value="${esc(row.id)}" ${sel.set.has(row.id) ? 'checked' : ''} aria-label="${esc(row.name || row.id)} 선택"></td>` : '';
      const cells = cols.map((c) => `<td class="${c.cls || ''}">${c.html ? c.html(row) : esc(c.value(row))}</td>`).join('');
      const extra = opts.rowActions ? `<td class="actions">${opts.rowActions(row)}</td>` : '';
      const on = sel && sel.set.has(row.id) ? ' picked' : '';
      return `<tr class="${opts.rowClass ? opts.rowClass(row) : ''}${on}">${pick}${cells}${extra}</tr>`;
    }).join('') : `<tr><td colspan="${span}"><div class="empty"><div class="big">🗂️</div><p>조건에 맞는 항목이 없습니다.</p></div></td></tr>`;

    return `<div class="table-wrap"><table class="tbl"><thead><tr>${selHead}${head}${opts.rowActions ? '<th class="num">작업</th>' : ''}</tr></thead><tbody>${body}</tbody></table></div>`;
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
    status:      { key: 'status', label: '상태', value: (r) => r.statusLabel, sortValue: (r) => STATUS_ORDER.indexOf(r.status),
                   html: (r) => statusBadge(r.status) },
    ip:          { key: 'ip', label: 'IP', cls: 'mono', value: (r) => r.ip, sortValue: (r) => ipSortKey(r.ip),
                   html: (r) => (r.ip ? `<a href="#/search?q=${encodeURIComponent(r.ip)}">${esc(r.ip)}</a>` : '<span class="muted">미할당</span>') },
    ipmi:        { key: 'ipmi', label: 'IPMI/BMC', cls: 'mono', value: (r) => r.ipmi, sortValue: (r) => ipSortKey(r.ipmi),
                   html: (r) => (r.ipmi ? `<a href="https://${esc(r.ipmi)}/" target="_blank" rel="noopener" title="BMC 웹 콘솔 열기">${esc(r.ipmi)}</a>` : nz('')) },
    owner:       { key: 'owner', label: '담당자', value: (r) => r.owner, html: (r) => nz(r.owner) },
    power:       { key: 'power', label: '전력', cls: 'num', value: (r) => r.watts, html: (r) => (r.watts ? r.watts + 'W' : nz('')) },
    monitored:   { key: 'monitored', label: '모니터링', value: (r) => (r.monitored ? 1 : 0),
                   html: (r) => r.monitored ? '<span class="badge info">감시 중</span>' : '<span class="badge mute">미감시</span>' },
    notes:       { key: 'notes', label: '비고', value: (r) => r.notes, html: (r) => nz(r.notes) },
    updated:     { key: 'updated', label: '최종 수정', value: (r) => r.updated, html: (r) => `<span class="muted">${esc(r.updated)}</span>` }
  };

  const DEVICE_VIEWS = {
    default: { label: '기본',        cols: ['name', 'ip', 'rack', 'pos', 'hardware', 'os', 'customer', 'role', 'status'] },
    network: { label: '네트워크/IP', cols: ['name', 'ip', 'ipmi', 'fqdn', 'role', 'rack', 'customer', 'status'] },
    ops:     { label: '운영/담당',   cols: ['name', 'status', 'owner', 'sl', 'monitored', 'customer', 'power', 'notes'] },
    asset:   { label: '자산',        cols: ['name', 'serial', 'asset', 'purchased', 'warranty', 'hardware', 'manufacturer', 'customer'] },
    dns:     { label: 'DNS', cols: ['name', 'domain', 'fqdn', 'role', 'rack', 'status'] },
    os:      { label: '운영체제',    cols: ['name', 'os', 'osKey', 'customer', 'role', 'status'] },
    support: { label: '하드웨어 지원', cols: ['name', 'manufacturer', 'hardware', 'serial', 'warranty', 'sl', 'customer'] },
    location:{ label: '위치',        cols: ['name', 'building', 'room', 'rack', 'pos', 'customer', 'status'] },
    apps:    { label: '앱',          cols: ['name', 'apps', 'role', 'customer', 'rack', 'status'] },
    full:    { label: '전체',        cols: ['name', 'fqdn', 'ip', 'ipmi', 'building', 'room', 'rack', 'pos', 'hardware', 'manufacturer', 'power', 'os', 'osKey',
                                            'customer', 'owner', 'role', 'sl', 'serial', 'asset', 'purchased', 'warranty', 'apps', 'monitored', 'status', 'notes', 'updated'] }
  };

  function filteredDevices() {
    const f = state.devices.filters;
    const q = f.q.trim().toLowerCase();
    return db.devices.map(dv).filter((r) => {
      if (q && !(r.name.toLowerCase().includes(q) || String(r.serial).toLowerCase().includes(q) || String(r.asset).toLowerCase().includes(q) ||
                 r.fqdn.toLowerCase().includes(q) || r.ips.includes(q) || r.owner.toLowerCase().includes(q))) return false;
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
      if (f.status && r.status !== f.status) return false;
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
    if (f.service)  push('service', f.service === 'in' ? '서비스: 운영 중' : '서비스: 운영 외');
    if (f.status)   push('status', '상태: ' + statusLabel(f.status));
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
    const ids = new Set(db.devices.map((d) => d.id));
    Array.from(s.selected).forEach((id) => { if (!ids.has(id)) s.selected.delete(id); });

    return pageHead('장비', `${rows.length}건 표시 · 전체 ${total}대${out ? ` · 운영 외 ${out}대` : ''}`, `
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
      ${bulkBar()}
      ${sortableTable(cols, rows, s.sort, 'devices', {
        select: { set: s.selected, attr: 'dev' },
        rowClass: (r) => (r.inService ? '' : 'off'),
        rowActions: (r) => `
          <a class="rowbtn" href="#/physical?racks=${esc(r.rackId)}&focus=${esc(r.id)}" title="랙에서 보기">📐</a>
          <button class="rowbtn mutating" data-action="edit-device" data-id="${esc(r.id)}" title="편집">✎</button>
          <button class="rowbtn mutating" data-action="copy-device" data-id="${esc(r.id)}" title="복사">⧉</button>
          <button class="rowbtn del mutating" data-action="del-device" data-id="${esc(r.id)}" title="삭제">🗑</button>`
      })}
    </div>`;
  }

  function bulkBar() {
    const n = state.devices.selected.size;
    if (!n) return '';
    const visible = new Set(filteredDevices().map((r) => r.id));
    const hidden = Array.from(state.devices.selected).filter((id) => !visible.has(id)).length;
    return `<div class="bulkbar">
      <b>${n}대 선택</b>${hidden ? `<span class="muted" style="font-size:12px">(${hidden}대는 현재 필터에 가려짐)</span>` : ''}
      <span class="grp">
        <select class="inp" id="bulk-status" aria-label="변경할 상태">${selectOptions(statusOptions(), 'active')}</select>
        <button class="btn sm mutating" data-action="bulk-status">상태 변경</button>
      </span>
      <button class="btn sm mutating" data-action="bulk-monitor" data-on="1">모니터링 켜기</button>
      <button class="btn sm mutating" data-action="bulk-monitor" data-on="0">모니터링 끄기</button>
      <button class="btn sm" data-action="export-selected">⬇ 선택 항목 CSV</button>
      <button class="btn sm danger mutating" data-action="bulk-delete">선택 삭제</button>
      <button class="btn sm ghost" data-action="bulk-clear">선택 해제</button>
    </div>`;
  }

  function filterPanel() {
    const f = state.devices.filters;
    const opt = (list, sel, blank) => `<option value="">${esc(blank)}</option>` + selectOptions(list, sel);
    return `<div class="filters">
      <div class="f"><label>이름/시리얼/자산번호/IP</label><input class="inp" type="search" data-filter="q" value="${esc(f.q)}" placeholder="부분 일치"></div>
      <div class="f"><label>고객사</label><select class="inp" data-filter="customer">${opt(customers(), f.customer, '전체')}</select></div>
      <div class="f"><label>역할</label><select class="inp" data-filter="role">${opt(db.roles, f.role, '전체')}</select></div>
      <div class="f"><label>운영체제</label><select class="inp" data-filter="os">${'<option value="">전체</option>' + selectOptions(db.operatingSystems, f.os, (o) => o.name + (o.version ? ' ' + o.version : ''))}</select></div>
      <div class="f"><label>하드웨어</label><select class="inp" data-filter="hardware">${opt(db.hardware, f.hardware, '전체')}</select></div>
      <div class="f"><label>서비스 수준</label><select class="inp" data-filter="sl">${opt(db.serviceLevels, f.sl, '전체')}</select></div>
      <div class="f"><label>건물</label><select class="inp" data-filter="building">${opt(db.buildings, f.building, '전체')}</select></div>
      <div class="f"><label>랙</label><select class="inp" data-filter="rack">${opt(db.racks, f.rack, '전체')}</select></div>
      <div class="f"><label>서비스 여부</label><select class="inp" data-filter="service">
        <option value="">전체</option>
        <option value="in"  ${f.service === 'in' ? 'selected' : ''}>운영 중</option>
        <option value="out" ${f.service === 'out' ? 'selected' : ''}>운영 외 (점검·RMA·재고 등)</option>
      </select></div>
      <div class="f"><label>라이프사이클 상태</label><select class="inp" data-filter="status">${opt(statusOptions(), f.status, '전체')}</select></div>
      <div class="f-actions"><button class="btn sm" data-reset-filters>필터 초기화</button></div>
    </div>`;
  }

  /* --- 장비 상세 --------------------------------------------------------- */
  function deviceIpTable(d) {
    const ips = deviceIps(d.id);
    const conflicts = conflictSet();
    if (!ips.length) return '<div class="card-body muted">할당된 IP가 없습니다.</div>';
    return `<div class="table-wrap"><table class="tbl">
      <thead><tr><th>주소</th><th>유형</th><th>인터페이스</th><th>서브넷</th><th class="num">작업</th></tr></thead>
      <tbody>${ips.map((i) => {
        const sn = L.subnet(i.subnetId);
        const vl = sn ? L.vlan(sn.vlanId) : null;
        return `<tr class="${conflicts.has(i.address) ? 'conflict' : ''}">
          <td class="mono"><a href="#/subnet/${esc(i.subnetId)}?hl=${encodeURIComponent(i.address)}">${esc(i.address)}</a>
            ${conflicts.has(i.address) ? '<span class="badge danger" title="같은 주소가 다른 곳에도 등록돼 있습니다">충돌</span>' : ''}</td>
          <td><span class="badge mute">${esc(IP_TYPES[i.type] || i.type)}</span></td>
          <td class="mono">${nz(i.iface)}</td>
          <td>${sn ? `${esc(sn.cidr)}<span class="sub">${esc(vlanLabel(vl) || sn.name)}</span>` : nz('')}</td>
          <td class="actions">
            <button class="rowbtn mutating" data-action="edit-ip" data-id="${esc(i.id)}" title="편집">✎</button>
            <button class="rowbtn del mutating" data-action="del-ip" data-id="${esc(i.id)}" title="할당 해제">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function historyList(entries, empty) {
    if (!entries.length) return `<div class="card-body muted">${esc(empty || '기록된 변경 이력이 없습니다.')}</div>`;
    return `<ul class="timeline">${entries.map((e) => `<li>
      <span class="t mono">${esc(e.at)}</span>
      <span class="badge ${e.action === 'delete' ? 'danger' : e.action === 'create' ? 'ok' : 'mute'}">${esc(ACTION_LABEL[e.action] || e.action)}</span>
      <span class="s">${esc(e.summary)}</span>
      <span class="u muted">${esc(e.user)}</span></li>`).join('')}</ul>`;
  }

  function renderDeviceDetail(r) {
    const d = L.device(r.parts[1]);
    if (!d) return notFound('장비');
    const v = dv(d);
    const hw = L.hw(d.hardwareId);
    const isDell = hw && hw.manufacturerId === 'org-dell';
    const rack = L.rack(d.rackId);
    const apps = deviceApps(d.id);
    const history = db.changeLog.filter((e) => e.entityId === d.id || (e.refs || []).includes(d.id)).slice(0, 15);

    return pageHead(d.name, `${esc(v.customer)} · ${esc(v.role)} · ${esc(v.rack)} ${esc(v.posLabel)}${v.ip ? ' · <span class="mono">' + esc(v.ip) + '</span>' : ''}`, `
      <a class="btn" href="#/physical?racks=${esc(d.rackId)}&focus=${esc(d.id)}">📐 랙에서 보기</a>
      <button class="btn mutating" data-action="copy-device" data-id="${esc(d.id)}">⧉ 복사</button>
      <button class="btn mutating" data-action="edit-device" data-id="${esc(d.id)}">✎ 편집</button>
      <button class="btn danger mutating" data-action="del-device" data-id="${esc(d.id)}">🗑 삭제</button>
    `, [{ label: '장비', href: '#/devices' }, { label: d.name }]) + `

    ${!d.inService ? `<div class="notice warn">⛔ <div><b>이 장비는 현재 '${esc(v.statusLabel)}' 상태로 서비스 중이 아닙니다.</b>${d.notes ? '<br>' + esc(d.notes) : ''}</div></div>` : ''}

    <div class="grid c2">
      <div>
        <div class="card">
          <div class="card-head"><h2>기본 정보</h2><span class="right">${statusBadge(d.status)}</span></div>
          <dl class="kv">
            <dt>장비명</dt><dd class="mono">${esc(d.name)}</dd>
            <dt>도메인</dt><dd>${nz(v.domain, '(도메인 없음)')}</dd>
            <dt>FQDN</dt><dd class="mono">${esc(v.fqdn)}
              <a class="btn sm" style="margin-left:8px" href="https://dns.google/query?name=${encodeURIComponent(v.fqdn)}" target="_blank" rel="noopener">DNS 조회 ↗</a></dd>
            <dt>고객사</dt><dd>${esc(v.customer)}</dd>
            <dt>담당자</dt><dd>${nz(v.owner, '미지정')}</dd>
            <dt>역할</dt><dd><span class="badge mute">${esc(v.role)}</span></dd>
            <dt>서비스 수준</dt><dd>${esc(v.sl)} <span class="muted">${esc((L.sl(d.serviceLevelId) || {}).notes || '')}</span></dd>
            <dt>모니터링</dt><dd>${d.monitored ? '<span class="badge info">감시 중</span>' : '<span class="badge mute">미감시</span>'}</dd>
          </dl>
        </div>

        <div class="card">
          <div class="card-head"><h2>네트워크 · IP</h2>
            <span class="right"><button class="btn sm mutating" data-action="add-ip" data-device="${esc(d.id)}">＋ IP 할당</button></span></div>
          ${deviceIpTable(d)}
          ${isServerLike(d) && !v.ipmi ? '<div class="card-body notice-inline">⚠ 서버 장비인데 IPMI/BMC 주소가 등록되지 않았습니다.</div>' : ''}
        </div>

        <div class="card">
          <div class="card-head"><h2>하드웨어 · 자산</h2></div>
          <dl class="kv">
            <dt>제조사</dt><dd>${esc(v.manufacturer)}</dd>
            <dt>모델</dt><dd>${esc(v.hardware)} <span class="muted">(${v.sizeU}U · ${v.watts}W)</span></dd>
            <dt>시리얼 ${isDell ? '(서비스 태그)' : ''}</dt>
            <dd class="mono">${esc(d.serial)}
              ${isDell ? `<a class="btn sm" style="margin-left:8px" href="https://www.dell.com/support/home/product-support/servicetag/${encodeURIComponent(d.serial)}/overview" target="_blank" rel="noopener">Dell 보증 조회 ↗</a>` : ''}</dd>
            <dt>자산번호</dt><dd class="mono">${esc(d.assetNo)}</dd>
            <dt>구매일</dt><dd class="mono">${esc(d.purchased)}</dd>
            <dt>보증 만료</dt><dd>${d.warrantyEnd ? warrantyBadge(d.warrantyEnd) : nz('')}</dd>
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

        <div class="card">
          <div class="card-head"><h2>변경 이력</h2><span class="right"><a class="btn sm" href="#/activity">전체 활동 로그</a></span></div>
          ${historyList(history)}
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
    { key: 'pct', label: '공간 사용률', value: (r) => r.st.pct,
      html: (r) => `<div style="display:flex;align-items:center;gap:8px;min-width:130px">${meterBar(r.st.pct)}<span class="mono" style="font-size:11px">${r.st.pct}%</span></div>` },
    { key: 'power', label: '전력', value: (r) => r.st.powerPct, html: (r) => powerCell(r.st) },
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
      <div class="stat"><div class="label">여유 공간</div><div class="value">${st.free}<small>U</small></div><div class="meta">장비 ${st.devices}대</div></div>
      <div class="stat"><div class="label">전력</div><div class="value" style="color:${st.powerPct >= 90 ? 'var(--danger)' : st.powerPct >= 80 ? 'var(--warn)' : 'inherit'}">${(st.watts / 1000).toFixed(1)}<small>/ ${rk.powerKw || 0}kW</small></div>
        <div class="meta">계약 용량 대비 ${st.powerPct}%</div></div>
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
                     title="${esc(v.name)} · ${esc(v.statusLabel)} · ${esc(v.hardware)} · ${esc(v.customer)} · ${esc(v.posLabel)}${v.ip ? ' · ' + esc(v.ip) : ''}">
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
      ${st.capW ? `<div class="rack-foot power" title="전력 ${st.watts}W / ${st.capW}W">
        <span class="mono">⚡ ${(st.watts / 1000).toFixed(1)}kW</span>
        ${meterBar(st.powerPct)}
        <span class="mono">${st.powerPct}%</span>
      </div>` : ''}
    </div>`;
  }

  function rackLegend() {
    return `<div class="legend">
      <span><b style="background:var(--accent-soft);border-color:var(--accent-line)"></b> 서버</span>
      <span><b style="background:var(--info-soft)"></b> 네트워크</span>
      <span><b style="background:var(--ok-soft)"></b> 스토리지</span>
      <span><b style="background:var(--warn-soft)"></b> 전원</span>
      <span><b style="background:var(--danger-soft)"></b> 운영 외 (점검·RMA·재고 등)</span>
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
     8-1. IP 관리 (IPAM) — 서브넷 · IP 주소 · VLAN
     ====================================================================== */
  function ipamTabs(active) {
    const conflicts = ipConflicts().length;
    const t = [
      ['subnets', '서브넷', db.subnets.length],
      ['ips', 'IP 주소', db.ipAddresses.length],
      ['vlans', 'VLAN', db.vlans.length]
    ];
    return `<div class="tabs">${t.map(([k, label, n]) =>
      `<a class="${k === active ? 'on' : ''}" href="#/ipam/${k}">${esc(label)} <span class="muted">${n}</span>${k === 'ips' && conflicts ? ' <span class="badge danger">충돌 ' + conflicts + '</span>' : ''}</a>`).join('')}</div>`;
  }

  function stateSelect(path, list, selected, blank) {
    return `<select class="inp" data-state="${path}">${blank !== undefined ? `<option value="">${esc(blank)}</option>` : ''}${selectOptions(list, selected)}</select>`;
  }

  const SUBNET_COLUMNS = [
    { key: 'cidr', label: '서브넷', value: (r) => r.s.cidr, sortValue: (r) => (r.st.net ? r.st.net.network : -1),
      html: (r) => `<a class="name-link mono" href="#/subnet/${esc(r.s.id)}">${esc(r.s.cidr)}</a><span class="sub">${esc(r.s.name)}</span>` },
    { key: 'vlan', label: 'VLAN', value: (r) => (r.vlan ? r.vlan.vid : -1),
      html: (r) => (r.vlan ? `<b class="mono">${r.vlan.vid}</b><span class="sub">${esc(r.vlan.name)}</span>` : nz('')) },
    { key: 'purpose', label: '용도', value: (r) => SUBNET_PURPOSE[r.s.purpose] || '',
      html: (r) => `<span class="badge ${r.s.purpose === 'svc' ? 'accent' : r.s.purpose === 'oob' ? 'warn' : r.s.purpose === 'mgmt' ? 'info' : 'mute'}">${esc(SUBNET_PURPOSE[r.s.purpose] || '기타')}</span>` },
    { key: 'building', label: '위치', value: (r) => nm(L.building(r.s.buildingId)) },
    { key: 'customer', label: '고객사', value: (r) => nm(L.org(r.s.customerId)), html: (r) => nz(nm(L.org(r.s.customerId)), '공용') },
    { key: 'gateway', label: '게이트웨이', cls: 'mono', value: (r) => r.s.gateway, sortValue: (r) => ipSortKey(r.s.gateway) },
    { key: 'used', label: '사용/가용', cls: 'num', value: (r) => r.st.used, html: (r) => `${r.st.used} / ${r.st.total}` },
    { key: 'free', label: '여유', cls: 'num', value: (r) => r.st.free,
      html: (r) => `<b style="color:${r.st.pct >= 90 ? 'var(--danger)' : r.st.pct >= 80 ? 'var(--warn)' : 'var(--ok)'}">${r.st.free}</b>` },
    { key: 'pct', label: '사용률', value: (r) => r.st.pct,
      html: (r) => `<div style="display:flex;align-items:center;gap:8px;min-width:120px">${meterBar(r.st.pct)}<span class="mono" style="font-size:11px">${r.st.pct}%</span></div>` }
  ];

  function subnetRows() {
    return db.subnets.map((sn) => ({ id: sn.id, name: sn.cidr, s: sn, st: subnetStats(sn), vlan: L.vlan(sn.vlanId) }));
  }

  function filteredSubnetRows() {
    const f = state.ipam;
    const q = f.q.trim().toLowerCase();
    return subnetRows().filter((r) => {
      if (f.building && r.s.buildingId !== f.building) return false;
      if (f.purpose && r.s.purpose !== f.purpose) return false;
      if (q) {
        const hay = [r.s.cidr, r.s.name, r.s.gateway, r.s.notes, r.vlan ? r.vlan.vid + ' ' + r.vlan.name : '', nm(L.org(r.s.customerId))].join(' ').toLowerCase();
        // 주소 하나를 입력하면 그 주소를 포함하는 서브넷을 찾아 줌
        const n = IP.toInt(q);
        if (!(hay.includes(q) || (n !== null && r.st.net && IP.contains(r.st.net, n)))) return false;
      }
      return true;
    });
  }

  const IP_COLUMNS = [
    { key: 'address', label: '주소', cls: 'mono', value: (r) => r.address, sortValue: (r) => ipSortKey(r.address),
      html: (r) => `<a class="name-link" href="#/subnet/${esc(r.subnetId)}?hl=${encodeURIComponent(r.address)}">${esc(r.address)}</a>${r.conflict ? ' <span class="badge danger">충돌</span>' : ''}` },
    { key: 'status', label: '상태', value: (r) => (IP_STATUS[r.status] || {}).label || r.status, html: (r) => ipStatusBadge(r.status) },
    { key: 'type', label: '유형', value: (r) => IP_TYPES[r.type] || r.type, html: (r) => `<span class="badge mute">${esc(IP_TYPES[r.type] || r.type)}</span>` },
    { key: 'device', label: '장비', value: (r) => (r.device ? r.device.name : ''),
      html: (r) => (r.device ? `<a href="#/device/${esc(r.device.id)}">${esc(r.device.name)}</a>${r.iface ? `<span class="sub mono">${esc(r.iface)}</span>` : ''}` : nz('', '미지정')) },
    { key: 'dns', label: 'DNS 이름', cls: 'mono', value: (r) => (r.device ? fqdn(r.device) : '') },
    { key: 'subnet', label: '서브넷', value: (r) => (r.subnet ? r.subnet.cidr : ''), sortValue: (r) => (r.subnet && subnetNet(r.subnet) ? subnetNet(r.subnet).network : -1),
      html: (r) => (r.subnet ? `<a href="#/subnet/${esc(r.subnet.id)}">${esc(r.subnet.cidr)}</a><span class="sub">${esc(r.subnet.name)}</span>` : '<span class="badge danger">서브넷 없음</span>') },
    { key: 'vlan', label: 'VLAN', value: (r) => (r.vlan ? r.vlan.vid : -1), html: (r) => (r.vlan ? esc(r.vlan.vid) : nz('')) },
    { key: 'notes', label: '비고', value: (r) => r.notes, html: (r) => nz(r.notes) }
  ];

  function ipRows() {
    const conflicts = conflictSet();
    return db.ipAddresses.map((i) => {
      const sn = L.subnet(i.subnetId);
      return Object.assign({}, i, { raw: i, name: i.address, subnet: sn, vlan: sn ? L.vlan(sn.vlanId) : null,
                                    device: i.deviceId ? L.device(i.deviceId) : null, conflict: conflicts.has(i.address) });
    });
  }

  function filteredIpRows() {
    const f = state.ips;
    const q = f.q.trim().toLowerCase();
    return ipRows().filter((r) => {
      if (f.status && r.status !== f.status) return false;
      if (f.type && r.type !== f.type) return false;
      if (f.subnet && r.subnetId !== f.subnet) return false;
      if (f.conflict && !r.conflict) return false;
      if (q) {
        const hay = [r.address, r.iface, r.notes, r.device ? r.device.name + ' ' + fqdn(r.device) : '', r.subnet ? r.subnet.name : ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  const VLAN_COLUMNS = [
    { key: 'vid', label: 'VID', cls: 'num', value: (v) => v.vid, html: (v) => `<b class="mono">${esc(v.vid)}</b>` },
    { key: 'name', label: '이름', value: (v) => v.name, html: (v) => `<b>${esc(v.name)}</b>` },
    { key: 'building', label: '건물', value: (v) => nm(L.building(v.buildingId)) },
    { key: 'subnets', label: '서브넷', value: (v) => db.subnets.filter((s) => s.vlanId === v.id).length,
      html: (v) => {
        const list = db.subnets.filter((s) => s.vlanId === v.id);
        return list.length ? list.map((s) => `<a class="chip" href="#/subnet/${esc(s.id)}">${esc(s.cidr)}</a>`).join(' ') : '<span class="muted">연결 없음</span>';
      } },
    { key: 'notes', label: '비고', value: (v) => v.notes, html: (v) => nz(v.notes) }
  ];

  function renderIpam(r) {
    const tab = ['subnets', 'ips', 'vlans'].includes(r.parts[1]) ? r.parts[1] : 'subnets';
    const all = subnetRows();
    const total = all.reduce((n, x) => n + x.st.total, 0);
    const used = all.reduce((n, x) => n + x.st.used, 0);
    const conflicts = ipConflicts().length;
    const sub = `서브넷 ${db.subnets.length}개 · 가용 ${total.toLocaleString()}개 중 ${used.toLocaleString()}개 사용 (${total ? Math.round((used / total) * 100) : 0}%)` +
                (conflicts ? ` · <b style="color:var(--danger)">IP 충돌 ${conflicts}건</b>` : '');

    // 대시보드의 '충돌 확인' 링크로 들어온 경우 한 번만 필터를 켜고 주소창은 정리
    if (r.query.conflict) { state.ips.conflict = '1'; history.replaceState(null, '', '#/ipam/ips'); }

    let actions = '', body = '';
    if (tab === 'subnets') {
      const f = state.ipam;
      const rows = applySort(filteredSubnetRows(), f.sort, SUBNET_COLUMNS);
      actions = `<button class="btn primary mutating" data-action="add-subnet">＋ 서브넷 추가</button>
                 <button class="btn mutating" data-action="add-ip">＋ IP 할당</button>
                 <button class="btn" data-action="export-subnets">⬇ CSV</button>`;
      body = `<div class="toolbar">
          <input class="inp" type="search" data-state="ipam.q" value="${esc(f.q)}" placeholder="CIDR · 이름 · VLAN · 주소로 검색 (예: 10.11.0.25)" style="min-width:260px">
          <div class="field"><label>위치</label>${stateSelect('ipam.building', db.buildings, f.building, '전체')}</div>
          <div class="field"><label>용도</label>${stateSelect('ipam.purpose', mapOptions(SUBNET_PURPOSE), f.purpose, '전체')}</div>
          <div class="grow"></div><span class="muted" style="font-size:12px">${rows.length}개 표시</span>
        </div>
        ${sortableTable(SUBNET_COLUMNS, rows, f.sort, 'ipam', {
          rowClass: (x) => (x.st.pct >= 90 ? 'hot' : ''),
          rowActions: (x) => `
            <button class="rowbtn mutating" data-action="add-ip" data-subnet="${esc(x.s.id)}" title="다음 빈 IP 할당">＋</button>
            <button class="rowbtn mutating" data-action="edit-subnet" data-id="${esc(x.s.id)}" title="편집">✎</button>
            <button class="rowbtn del mutating" data-action="del-subnet" data-id="${esc(x.s.id)}" title="삭제">🗑</button>`
        })}`;
    } else if (tab === 'ips') {
      const f = state.ips;
      const rows = applySort(filteredIpRows(), f.sort, IP_COLUMNS);
      actions = `<button class="btn primary mutating" data-action="add-ip">＋ IP 할당</button>
                 <button class="btn" data-action="export-ips">⬇ CSV</button>`;
      body = `<div class="toolbar">
          <input class="inp" type="search" data-state="ips.q" value="${esc(f.q)}" placeholder="주소 · 장비 · 인터페이스 · 비고" style="min-width:220px">
          <div class="field"><label>상태</label>${stateSelect('ips.status', mapOptions(IP_STATUS, (x) => x.label), f.status, '전체')}</div>
          <div class="field"><label>유형</label>${stateSelect('ips.type', mapOptions(IP_TYPES), f.type, '전체')}</div>
          <div class="field"><label>서브넷</label><select class="inp" data-state="ips.subnet"><option value="">전체</option>${selectOptions(db.subnets, f.subnet, subnetLabel)}</select></div>
          <label class="field"><input type="checkbox" data-state="ips.conflict" ${f.conflict ? 'checked' : ''}> <span style="font-size:12.5px">충돌만</span></label>
          <div class="grow"></div><span class="muted" style="font-size:12px">${rows.length}건 표시</span>
        </div>
        ${sortableTable(IP_COLUMNS, rows, f.sort, 'ips', {
          rowClass: (x) => (x.conflict ? 'conflict' : ''),
          rowActions: (x) => `
            <button class="rowbtn mutating" data-action="edit-ip" data-id="${esc(x.id)}" title="편집">✎</button>
            <button class="rowbtn del mutating" data-action="del-ip" data-id="${esc(x.id)}" title="삭제">🗑</button>`
        })}`;
    } else {
      const rows = applySort(db.vlans, state.vlans.sort, VLAN_COLUMNS);
      actions = `<button class="btn primary mutating" data-action="add-vlan">＋ VLAN 추가</button>`;
      body = sortableTable(VLAN_COLUMNS, rows, state.vlans.sort, 'vlans', {
        rowActions: (v) => `
          <button class="rowbtn mutating" data-action="edit-vlan" data-id="${esc(v.id)}" title="편집">✎</button>
          <button class="rowbtn del mutating" data-action="del-vlan" data-id="${esc(v.id)}" title="삭제">🗑</button>`
      });
    }

    return pageHead('IP 관리', sub, actions) + `<div class="card">${ipamTabs(tab)}${body}</div>`;
  }

  /* --- 서브넷 상세 + IP 맵 -------------------------------------------- */
  const IPMAP_LIMIT = 1024;

  function ipMap(sn, hl) {
    const net = subnetNet(sn);
    if (!net) return '<div class="card-body muted">CIDR 형식이 올바르지 않습니다.</div>';
    const limit = Math.min(net.size, IPMAP_LIMIT);
    const byAddr = new Map();
    subnetIps(sn.id).forEach((i) => {
      const n = IP.toInt(i.address);
      if (!byAddr.has(n)) byAddr.set(n, []);
      byAddr.get(n).push(i);
    });
    const hlInt = IP.toInt(hl);
    let cells = '';
    for (let k = 0; k < limit; k++) {
      const n = (net.network + k) >>> 0;
      const addr = IP.fromInt(n);
      const label = net.prefix >= 24 ? (n & 255) : ((n >>> 8) & 255) + '.' + (n & 255);
      const focus = n === hlInt ? ' focus' : '';
      const recs = byAddr.get(n);
      if (IP.isReserved(net, n)) {
        cells += `<span class="ipc sys${focus}" title="${esc(addr)} · ${n === net.network ? '네트워크 주소' : '브로드캐스트 주소'}">${label}</span>`;
      } else if (recs && recs.length > 1) {
        cells += `<a class="ipc conflict${focus}" href="#/ipam/ips?conflict=1" title="${esc(addr)} · 충돌: ${esc(recs.map((x) => (x.deviceId ? nm(L.device(x.deviceId)) : IP_TYPES[x.type])).join(', '))}">${label}</a>`;
      } else if (recs) {
        const i = recs[0];
        const dev = i.deviceId ? L.device(i.deviceId) : null;
        const cls = i.type === 'gateway' ? 'gw' : i.status;
        const tip = `${addr} · ${(IP_STATUS[i.status] || {}).label || i.status} · ${IP_TYPES[i.type] || i.type}${dev ? ' · ' + dev.name + (i.iface ? ' (' + i.iface + ')' : '') : ''}${i.notes ? ' · ' + i.notes : ''}`;
        cells += dev
          ? `<a class="ipc ${cls}${focus}" href="#/device/${esc(dev.id)}" title="${esc(tip)}">${label}</a>`
          : `<button type="button" class="ipc ${cls}${focus}" data-action="edit-ip" data-id="${esc(i.id)}" title="${esc(tip)}">${label}</button>`;
      } else {
        cells += `<button type="button" class="ipc free${focus}" data-action="add-ip" data-subnet="${esc(sn.id)}" data-address="${esc(addr)}" title="${esc(addr)} · 사용 가능 — 클릭해서 할당">${label}</button>`;
      }
    }
    return `<div class="ipmap">${cells}</div>
      ${net.size > limit ? `<div class="card-body muted" style="font-size:12px">앞쪽 ${limit}개 주소만 표시합니다. 전체 목록은 아래 표를 확인하세요.</div>` : ''}
      <div class="legend">
        <span><b class="ipc-sw free"></b> 사용 가능</span>
        <span><b class="ipc-sw assigned"></b> 할당</span>
        <span><b class="ipc-sw reserved"></b> 예약</span>
        <span><b class="ipc-sw dhcp"></b> DHCP</span>
        <span><b class="ipc-sw gw"></b> 게이트웨이</span>
        <span><b class="ipc-sw conflict"></b> 충돌</span>
        <span><b class="ipc-sw sys"></b> 네트워크/브로드캐스트</span>
      </div>`;
  }

  function renderSubnetDetail(r) {
    const sn = L.subnet(r.parts[1]);
    if (!sn) return notFound('서브넷');
    const st = subnetStats(sn);
    const net = st.net;
    const vl = L.vlan(sn.vlanId);
    const rows = applySort(ipRows().filter((x) => x.subnetId === sn.id), { key: 'address', dir: 1 }, IP_COLUMNS);
    const cols = IP_COLUMNS.filter((c) => !['subnet', 'vlan'].includes(c.key));
    const next = nextFreeIp(sn);

    return pageHead(sn.cidr, `${esc(sn.name)}${vl ? ' · ' + esc(vlanLabel(vl)) : ''} · ${esc(nm(L.building(sn.buildingId)))}`, `
      <button class="btn primary mutating" data-action="add-ip" data-subnet="${esc(sn.id)}" ${next ? '' : 'disabled'}>＋ 다음 빈 IP 할당${next ? ` <span class="mono" style="opacity:.8">${esc(next)}</span>` : ''}</button>
      <button class="btn mutating" data-action="edit-subnet" data-id="${esc(sn.id)}">✎ 편집</button>
      <button class="btn danger mutating" data-action="del-subnet" data-id="${esc(sn.id)}">🗑 삭제</button>
    `, [{ label: 'IP 관리', href: '#/ipam' }, { label: sn.cidr }]) + `

    <div class="grid c4" style="margin-bottom:16px">
      <div class="stat"><div class="label">가용 호스트</div><div class="value">${st.total.toLocaleString()}<small>개</small></div><div class="meta">/${net ? net.prefix : '?'} · 넷마스크 ${esc(net ? net.mask : '')}</div></div>
      <div class="stat"><div class="label">사용 중</div><div class="value">${st.used}<small>개</small></div><div class="meta">할당 ${st.assigned} · 예약 ${st.reserved} · DHCP ${st.dhcp}</div></div>
      <div class="stat"><div class="label">여유</div><div class="value" style="color:${st.pct >= 90 ? 'var(--danger)' : st.pct >= 80 ? 'var(--warn)' : 'inherit'}">${st.free}<small>개</small></div><div class="meta">다음 빈 주소 <span class="mono">${esc(next || '없음')}</span></div></div>
      <div class="stat"><div class="label">사용률</div><div class="value">${st.pct}<small>%</small></div><div class="meta">${meterBar(st.pct)}</div></div>
    </div>

    <div class="grid c2">
      <div class="card">
        <div class="card-head"><h2>서브넷 정보</h2></div>
        <dl class="kv">
          <dt>네트워크</dt><dd class="mono">${esc(net ? IP.fromInt(net.network) : '')}</dd>
          <dt>브로드캐스트</dt><dd class="mono">${esc(net ? IP.fromInt(net.broadcast) : '')}</dd>
          <dt>할당 범위</dt><dd class="mono">${esc(net ? IP.fromInt(net.first) + ' – ' + IP.fromInt(net.last) : '')}</dd>
          <dt>게이트웨이</dt><dd class="mono">${nz(sn.gateway)}</dd>
          <dt>VLAN</dt><dd>${vl ? `<a href="#/ipam/vlans">${esc(vlanLabel(vl))}</a>` : nz('')}</dd>
          <dt>용도</dt><dd>${esc(SUBNET_PURPOSE[sn.purpose] || '기타')}</dd>
          <dt>고객사</dt><dd>${nz(nm(L.org(sn.customerId)), '공용')}</dd>
          <dt>위치</dt><dd>${esc(nm(L.building(sn.buildingId)))}</dd>
          <dt>비고</dt><dd>${nz(sn.notes)}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="card-head"><h2>IP 맵</h2><span class="right hint">빈 칸을 누르면 그 주소로 할당합니다</span></div>
        ${ipMap(sn, r.query.hl)}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>등록된 주소 (${rows.length})</h2></div>
      ${sortableTable(cols, rows, { key: 'address', dir: 1 }, 'noop', {
        rowClass: (x) => (x.conflict ? 'conflict' : '') + (x.address === r.query.hl ? ' picked' : ''),
        rowActions: (x) => `
          <button class="rowbtn mutating" data-action="edit-ip" data-id="${esc(x.id)}" title="편집">✎</button>
          <button class="rowbtn del mutating" data-action="del-ip" data-id="${esc(x.id)}" title="삭제">🗑</button>`
      })}
    </div>`;
  }

  /* ======================================================================
     8-2. 대시보드 — 랙 · IP · 장비 통합 현황과 점검 항목
     ====================================================================== */
  /** level: danger | warn | info | ok */
  function collectAlerts() {
    const out = [];
    const devs = db.devices;
    const conflicts = ipConflicts();
    if (conflicts.length) out.push({ level: 'danger', icon: '🌐', title: `IP 주소 충돌 ${conflicts.length}건`,
      detail: conflicts.map(([a]) => a).join(', '), href: '#/ipam/ips?conflict=1' });

    const orphan = db.ipAddresses.filter((i) => { const sn = L.subnet(i.subnetId); const net = sn && subnetNet(sn); return !net || !IP.contains(net, IP.toInt(i.address)); });
    if (orphan.length) out.push({ level: 'danger', icon: '🧭', title: `서브넷 범위 밖 IP ${orphan.length}건`,
      detail: orphan.slice(0, 5).map((i) => i.address).join(', '), href: '#/ipam/ips' });

    db.racks.forEach((rk) => {
      const st = rackStats(rk);
      if (st.capW && st.powerPct >= 90) out.push({ level: st.powerPct >= 100 ? 'danger' : 'warn', icon: '⚡', title: `${rk.name} 전력 ${st.powerPct}%`,
        detail: `${(st.watts / 1000).toFixed(1)}kW / 계약 ${rk.powerKw}kW — 증설 시 전력 재배치 필요`, href: '#/rack/' + rk.id });
      if (st.pct >= 90) out.push({ level: 'warn', icon: '🗄️', title: `${rk.name} 공간 ${st.pct}% 사용`, detail: `여유 ${st.free}U`, href: '#/rack/' + rk.id });
    });

    db.subnets.forEach((sn) => {
      const st = subnetStats(sn);
      if (st.pct >= 80) out.push({ level: st.pct >= 90 ? 'danger' : 'warn', icon: '📶', title: `${sn.cidr} 사용률 ${st.pct}%`,
        detail: `${sn.name} · 여유 ${st.free}개`, href: '#/subnet/' + sn.id });
    });

    const expired = devs.filter((d) => d.warrantyEnd && daysUntil(d.warrantyEnd) < 0);
    const expiring = devs.filter((d) => d.warrantyEnd && daysUntil(d.warrantyEnd) >= 0 && daysUntil(d.warrantyEnd) <= 90);
    if (expired.length) out.push({ level: 'warn', icon: '🛡️', title: `보증 만료 장비 ${expired.length}대`, detail: expired.slice(0, 6).map((d) => d.name).join(', ') + (expired.length > 6 ? ' 외' : ''), href: '#/reports' });
    if (expiring.length) out.push({ level: 'info', icon: '🛡️', title: `90일 내 보증 만료 ${expiring.length}대`, detail: expiring.map((d) => d.name).join(', '), href: '#/reports' });

    const noIpmi = devs.filter((d) => d.status !== 'stock' && isServerLike(d) && !ipmiIp(d.id));
    if (noIpmi.length) out.push({ level: 'info', icon: '🔌', title: `IPMI/BMC 미등록 서버 ${noIpmi.length}대`, detail: noIpmi.map((d) => d.name).join(', '), href: '#/reports' });

    const noIp = devs.filter((d) => d.status === 'active' && !deviceIps(d.id).some((i) => i.type !== 'ipmi'));
    if (noIp.length) out.push({ level: 'info', icon: '❔', title: `서비스/관리 IP 없는 운영 장비 ${noIp.length}대`, detail: noIp.map((d) => d.name).join(', '), href: '#/devices' });

    const outOfService = devs.filter((d) => !d.inService && d.status !== 'stock');
    if (outOfService.length) out.push({ level: 'info', icon: '🛠️', title: `운영 외 장비 ${outOfService.length}대`,
      detail: outOfService.map((d) => d.name + '(' + statusLabel(d.status) + ')').join(', '), href: '#/devices' });

    const dupSerial = dupGroups(devs, (d) => d.serial).length + dupGroups(devs, (d) => d.assetNo).length;
    if (dupSerial) out.push({ level: 'warn', icon: '🏷️', title: `중복 시리얼/자산번호 ${dupSerial}건`, detail: '실사 및 데이터 정정 필요', href: '#/reports' });

    const order = { danger: 0, warn: 1, info: 2, ok: 3 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }

  function renderDashboard() {
    const devs = db.devices;
    const active = devs.filter((d) => d.status === 'active').length;
    const totalU = db.racks.reduce((n, r) => n + r.sizeU, 0);
    const rackSt = db.racks.map((rk) => ({ rk: rk, st: rackStats(rk) }));
    const usedU = rackSt.reduce((n, x) => n + x.st.used, 0);
    const watts = rackSt.reduce((n, x) => n + x.st.watts, 0);
    const capW = rackSt.reduce((n, x) => n + x.st.capW, 0);
    const sns = subnetRows();
    const ipTotal = sns.reduce((n, x) => n + x.st.total, 0);
    const ipUsed = sns.reduce((n, x) => n + x.st.used, 0);
    const alerts = collectAlerts();
    // barList는 첫 행을 최댓값으로 쓰므로 많은 순으로 정렬
    const byStatus = STATUS_ORDER.map((k) => ({ key: DEVICE_STATUS[k].label, n: devs.filter((d) => d.status === k).length }))
      .filter((x) => x.n).sort((a, b) => b.n - a.n);
    const topSubnets = sns.slice().sort((a, b) => b.st.pct - a.st.pct).slice(0, 6);
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

    return pageHead('대시보드', 'IDC 랙 · IP · 장비 자원을 한 화면에서 점검합니다', `
      <a class="btn" href="#/ipam">🌐 IP 관리</a>
      <button class="btn mutating" data-action="add-device">＋ 장비 추가</button>
    `) + `
    <div class="grid c4" style="margin-bottom:16px">
      <a class="stat link" href="#/devices"><div class="label">장비</div><div class="value">${devs.length}<small>대</small></div>
        <div class="meta">운영 ${active}대 · 운영 외 ${devs.length - active}대</div></a>
      <a class="stat link" href="#/racks"><div class="label">랙 공간</div><div class="value">${pct(usedU, totalU)}<small>%</small></div>
        <div class="meta">${db.racks.length}개 랙 · 여유 ${totalU - usedU}U</div>${meterBar(pct(usedU, totalU))}</a>
      <a class="stat link" href="#/racks"><div class="label">전력</div><div class="value">${(watts / 1000).toFixed(1)}<small>kW</small></div>
        <div class="meta">계약 ${(capW / 1000).toFixed(0)}kW 대비 ${pct(watts, capW)}%</div>${meterBar(pct(watts, capW))}</a>
      <a class="stat link" href="#/ipam"><div class="label">IP 주소</div><div class="value">${ipUsed}<small>/ ${ipTotal.toLocaleString()}</small></div>
        <div class="meta">서브넷 ${db.subnets.length}개 · VLAN ${db.vlans.length}개 · 사용률 ${pct(ipUsed, ipTotal)}%</div>${meterBar(pct(ipUsed, ipTotal))}</a>
    </div>

    <div class="card">
      <div class="card-head"><h2>점검이 필요한 항목</h2>
        <span class="right">${alerts.length ? `<span class="badge ${alerts.some((a) => a.level === 'danger') ? 'danger' : 'warn'}">${alerts.length}건</span>` : '<span class="badge ok">이상 없음</span>'}</span></div>
      ${alerts.length ? `<ul class="alerts">${alerts.map((a) => `<li class="lv-${a.level}">
          <span class="ic" aria-hidden="true">${a.icon}</span>
          <div class="tx"><b>${esc(a.title)}</b><span>${esc(a.detail)}</span></div>
          <a class="btn sm" href="${a.href}">확인</a></li>`).join('')}</ul>`
        : '<div class="empty"><div class="big">✅</div><p>모든 지표가 정상 범위입니다.</p></div>'}
    </div>

    <div class="grid c2" style="margin-top:16px">
      <div class="card">
        <div class="card-head"><h2>랙 현황</h2><span class="right hint">공간 · 전력</span></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>랙</th><th>공간</th><th>전력</th></tr></thead>
          <tbody>${rackSt.map(({ rk, st }) => `<tr>
            <td><a class="name-link" href="#/rack/${esc(rk.id)}">${esc(rk.name)}</a><span class="sub">${esc(rackLocation(rk))}</span></td>
            <td><div style="display:flex;align-items:center;gap:8px;min-width:120px">${meterBar(st.pct)}<span class="mono" style="font-size:11px">${st.used}/${rk.sizeU}U</span></div></td>
            <td>${powerCell(st)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>서브넷 사용률 상위</h2><span class="right"><a class="btn sm" href="#/ipam">전체 보기</a></span></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>서브넷</th><th class="num">여유</th><th>사용률</th></tr></thead>
          <tbody>${topSubnets.map((x) => `<tr>
            <td><a class="name-link mono" href="#/subnet/${esc(x.s.id)}">${esc(x.s.cidr)}</a><span class="sub">${esc(x.s.name)}</span></td>
            <td class="num">${x.st.free}</td>
            <td><div style="display:flex;align-items:center;gap:8px;min-width:120px">${meterBar(x.st.pct)}<span class="mono" style="font-size:11px">${x.st.pct}%</span></div></td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="card"><div class="card-head"><h2>장비 상태</h2></div>${barList(byStatus, devs.length)}</div>
      <div class="card">
        <div class="card-head"><h2>최근 변경</h2><span class="right"><a class="btn sm" href="#/activity">활동 로그</a></span></div>
        ${historyList(db.changeLog.slice(0, 8))}
      </div>
    </div>`;
  }

  /* ======================================================================
     8-3. 활동 로그
     ====================================================================== */
  function activityHref(e) {
    if (!e.entityId) return '';
    const map = { device: ['#/device/', L.device], rack: ['#/rack/', L.rack], app: ['#/app/', L.app], subnet: ['#/subnet/', L.subnet] };
    if (e.entity === 'ip') { const i = L.ip(e.entityId); return i ? '#/subnet/' + i.subnetId + '?hl=' + encodeURIComponent(i.address) : ''; }
    const m = map[e.entity];
    return m && m[1](e.entityId) ? m[0] + e.entityId : '';
  }

  function filteredActivity() {
    const f = state.activity;
    const q = f.q.trim().toLowerCase();
    return db.changeLog.filter((e) => (!f.entity || e.entity === f.entity) &&
      (!q || (e.summary + ' ' + e.user).toLowerCase().includes(q)));
  }

  function renderActivity() {
    const f = state.activity;
    const all = filteredActivity();
    const rows = all.slice(0, f.limit);
    return pageHead('활동 로그', `추가 · 수정 · 삭제 이력 ${db.changeLog.length}건 (최근 1,000건 보관)`, `
      <button class="btn" data-action="export-activity">⬇ CSV</button>`) + `
    <div class="card">
      <div class="toolbar">
        <input class="inp" type="search" data-state="activity.q" value="${esc(f.q)}" placeholder="내용 · 사용자 검색" style="min-width:220px">
        <div class="field"><label>대상</label>${stateSelect('activity.entity', mapOptions(ENTITY_LABEL), f.entity, '전체')}</div>
        <div class="grow"></div><span class="muted" style="font-size:12px">${all.length}건</span>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>일시</th><th>사용자</th><th>대상</th><th>작업</th><th>내용</th></tr></thead>
        <tbody>${rows.length ? rows.map((e) => {
          const href = activityHref(e);
          return `<tr>
            <td class="mono nowrap">${esc(e.at)}</td>
            <td>${esc(e.user)}</td>
            <td><span class="badge mute">${esc(ENTITY_LABEL[e.entity] || e.entity)}</span></td>
            <td><span class="badge ${e.action === 'delete' ? 'danger' : e.action === 'create' ? 'ok' : 'accent'}">${esc(ACTION_LABEL[e.action] || e.action)}</span></td>
            <td>${href ? `<a href="${href}">${esc(e.summary)}</a>` : esc(e.summary)}</td></tr>`;
        }).join('') : '<tr><td colspan="5"><div class="empty"><p>조건에 맞는 기록이 없습니다.</p></div></td></tr>'}</tbody>
      </table></div>
      ${all.length > rows.length ? `<div class="card-body" style="text-align:center"><button class="btn sm" data-action="activity-more">더 보기 (${all.length - rows.length}건 남음)</button></div>` : ''}
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
    const expiring = devs.map(dv).filter((v) => v.warranty && daysUntil(v.warranty) <= 90).sort((a, b) => cmp(a.warranty, b.warranty));

    const byCustomer = tally(devs, (d) => nm(L.org(d.customerId)));
    const byOs = tally(devs, (d) => { const o = L.os(d.osId); return o && o.id !== 'os-none' ? o.name + ' ' + o.version : null; });
    const byHw = tally(devs, (d) => nm(L.hw(d.hardwareId)));
    const byRole = tally(devs, (d) => nm(L.role(d.roleId)));
    const bySl = tally(devs, (d) => nm(L.sl(d.serviceLevelId)));
    const byStatus = tally(devs, (d) => statusLabel(d.status));
    const sns = subnetRows().sort((a, b) => b.st.pct - a.st.pct);
    const ipTotal = sns.reduce((n, x) => n + x.st.total, 0);
    const ipUsed = sns.reduce((n, x) => n + x.st.used, 0);
    const conflicts = ipConflicts();
    const noIpmi = devs.filter((d) => d.status !== 'stock' && isServerLike(d) && !ipmiIp(d.id));
    const noIp = devs.filter((d) => d.status === 'active' && !deviceIps(d.id).some((i) => i.type !== 'ipmi'));

    const rackRowsData = rackRows().sort((a, b) => b.st.free - a.st.free);

    return pageHead('리포트', '랙 · IP · 장비 현황을 한눈에 정리한 통계 화면입니다', `
      <button class="btn" id="print-inline">🖨 인쇄</button>
      <button class="btn" data-action="export-report">⬇ 요약 내보내기 (CSV)</button>
    `) + `

    <div class="grid c4" style="margin-bottom:16px">
      <div class="stat"><div class="label">전체 장비</div><div class="value">${total}<small>대</small></div>
        <div class="meta">서비스 중 ${total - outOfService.length}대 · 중지 ${outOfService.length}대</div></div>
      <div class="stat"><div class="label">랙 공간</div><div class="value">${totalU - usedU}<small>U 여유</small></div>
        <div class="meta">전체 ${totalU}U 중 ${usedU}U 사용 (${Math.round((usedU / totalU) * 100)}%)</div></div>
      <div class="stat"><div class="label">IP 주소</div><div class="value">${ipUsed}<small>/ ${ipTotal.toLocaleString()}</small></div>
        <div class="meta">서브넷 ${sns.length}개 · 충돌 ${conflicts.length}건</div></div>
      <div class="stat"><div class="label">보증 만료 임박</div><div class="value" style="color:${expiring.length ? 'var(--warn)' : 'inherit'}">${expiring.length}<small>대</small></div>
        <div class="meta">만료됨 또는 90일 이내</div></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>랙별 공간 현황</h2><span class="right hint">여유 공간이 많은 순</span></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>랙</th><th>위치</th><th class="num">크기</th><th class="num">장비</th><th class="num">사용</th><th class="num">여유</th><th>공간 사용률</th><th>전력</th></tr></thead>
        <tbody>${rackRowsData.map((r) => `<tr>
          <td><a class="name-link" href="#/physical?racks=${esc(r.rack.id)}">${esc(r.rack.name)}</a></td>
          <td>${esc(r.building)} · ${esc(r.room)}</td>
          <td class="num">${r.rack.sizeU}U</td>
          <td class="num">${r.st.devices}</td>
          <td class="num">${r.st.used}U</td>
          <td class="num"><b style="color:${r.st.free === 0 ? 'var(--danger)' : r.st.free < 6 ? 'var(--warn)' : 'var(--ok)'}">${r.st.free}U</b></td>
          <td><div style="display:flex;align-items:center;gap:8px;min-width:140px">${meterBar(r.st.pct)}<span class="mono" style="font-size:11px">${r.st.pct}%</span></div></td>
          <td>${powerCell(r.st)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="grid c2" style="margin-top:16px">
      <div class="card"><div class="card-head"><h2>고객사별 장비 수</h2></div>${barList(byCustomer, total)}</div>
      <div class="card"><div class="card-head"><h2>가장 많이 쓰는 운영체제</h2></div>${barList(byOs, total)}</div>
      <div class="card"><div class="card-head"><h2>가장 많이 쓰는 하드웨어</h2></div>${barList(byHw, total)}</div>
      <div class="card"><div class="card-head"><h2>역할별 분포</h2></div>${barList(byRole, total)}</div>
      <div class="card"><div class="card-head"><h2>서비스 수준별 분포</h2></div>${barList(bySl, total)}</div>
      <div class="card"><div class="card-head"><h2>라이프사이클 상태별 분포</h2></div>${barList(byStatus, total)}</div>
      <div class="card">
        <div class="card-head"><h2>운영 외 장비</h2>
          <span class="right"><span class="badge ${outOfService.length ? 'danger' : 'ok'}">${outOfService.length}대</span></span></div>
        ${outOfService.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>장비</th><th>상태</th><th>랙</th><th>사유</th></tr></thead>
          <tbody>${outOfService.map((d) => `<tr class="off">
            <td><a class="name-link" href="#/device/${esc(d.id)}">${esc(d.name)}</a></td>
            <td>${statusBadge(d.status)}</td>
            <td>${esc(nm(L.rack(d.rackId)))} U${d.rackPos}</td>
            <td>${nz(d.notes)}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="card-body muted">모든 장비가 운영 중입니다.</div>'}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>서브넷 사용률</h2><span class="right hint">사용률이 높은 순 · 80% 이상은 증설 검토</span></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>서브넷</th><th>VLAN</th><th>용도</th><th>고객사</th><th class="num">할당</th><th class="num">예약</th><th class="num">DHCP</th><th class="num">여유</th><th>사용률</th></tr></thead>
        <tbody>${sns.map((x) => `<tr class="${x.st.pct >= 90 ? 'hot' : ''}">
          <td><a class="name-link mono" href="#/subnet/${esc(x.s.id)}">${esc(x.s.cidr)}</a><span class="sub">${esc(x.s.name)}</span></td>
          <td>${x.vlan ? esc(x.vlan.vid) : nz('')}</td>
          <td>${esc(SUBNET_PURPOSE[x.s.purpose] || '기타')}</td>
          <td>${nz(nm(L.org(x.s.customerId)), '공용')}</td>
          <td class="num">${x.st.assigned}</td><td class="num">${x.st.reserved}</td><td class="num">${x.st.dhcp}</td>
          <td class="num"><b>${x.st.free}</b></td>
          <td><div style="display:flex;align-items:center;gap:8px;min-width:130px">${meterBar(x.st.pct)}<span class="mono" style="font-size:11px">${x.st.pct}%</span></div></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="grid c2" style="margin-top:16px">
      <div class="card">
        <div class="card-head"><h2>IP 주소 충돌</h2>
          <span class="right">${conflicts.length ? `<span class="badge danger">${conflicts.length}건</span>` : '<span class="badge ok">충돌 없음</span>'}</span></div>
        ${conflicts.length ? `<div class="table-wrap"><table class="tbl">
          <thead><tr><th>주소</th><th>등록 대상</th></tr></thead>
          <tbody>${conflicts.map(([addr, list]) => `<tr class="conflict">
            <td class="mono"><b>${esc(addr)}</b></td>
            <td>${list.map((i) => (i.deviceId ? `<a href="#/device/${esc(i.deviceId)}">${esc(nm(L.device(i.deviceId)))}</a>` : esc(IP_TYPES[i.type] || i.type)) +
              (i.iface ? ` <span class="muted mono">${esc(i.iface)}</span>` : '')).join(' · ')}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="card-body muted">같은 주소가 중복 등록된 경우가 없습니다.</div>'}
      </div>
      <div class="card">
        <div class="card-head"><h2>IP 등록 누락</h2>
          <span class="right"><span class="badge ${noIpmi.length + noIp.length ? 'warn' : 'ok'}">${noIpmi.length + noIp.length}건</span></span></div>
        <div class="card-body">
          <p style="margin:0 0 6px"><b>IPMI/BMC 미등록 서버</b> <span class="muted">(${noIpmi.length})</span></p>
          ${noIpmi.length ? noIpmi.map((d) => `<a class="chip" href="#/device/${esc(d.id)}">${esc(d.name)}</a>`).join(' ') : '<span class="muted">없음</span>'}
          <p style="margin:14px 0 6px"><b>서비스/관리 IP 없는 운영 장비</b> <span class="muted">(${noIp.length})</span></p>
          ${noIp.length ? noIp.map((d) => `<a class="chip" href="#/device/${esc(d.id)}">${esc(d.name)}</a>`).join(' ') : '<span class="muted">없음</span>'}
        </div>
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
      inUse: (x) => db.rooms.some((r) => r.buildingId === x.id) || db.subnets.some((s) => s.buildingId === x.id) || db.vlans.some((v) => v.buildingId === x.id),
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
             { label: '크기', v: (x) => x.sizeU + 'U', cls: 'num' }, { label: '소비전력', v: (x) => (x.powerW || 0) + 'W', cls: 'num' },
             { label: '비고', v: (x) => x.notes },
             { label: '장비', v: (x) => db.devices.filter((d) => d.hardwareId === x.id).length + '대', cls: 'num' }],
      inUse: (x) => db.devices.some((d) => d.hardwareId === x.id),
      fields: () => [{ k: 'name', label: '모델명', required: true },
                     { k: 'manufacturerId', label: '제조사', type: 'select', options: hwMakers() },
                     { k: 'sizeU', label: '크기 (U)', type: 'number', min: 1, max: 48, help: 'RackManager는 정수 U만 지원합니다 (1.5U 등은 반올림)' },
                     { k: 'powerW', label: '평균 소비전력 (W)', type: 'number', min: 0, max: 20000, help: '랙 전력 사용률 계산에 사용됩니다' },
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
      inUse: (x) => db.devices.some((d) => d.customerId === x.id) || db.hardware.some((h) => h.manufacturerId === x.id) ||
                    db.operatingSystems.some((o) => o.manufacturerId === x.id) || db.subnets.some((s) => s.customerId === x.id),
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
          <dt>버전</dt><dd class="mono">${esc(s.appVersion)} <span class="muted">(원본 RackManager ${esc(s.baseVersion || '1.2.5')} 기능 기반)</span></dd>
          <dt>빌드</dt><dd>${esc(s.build)}</dd>
          <dt>라이선스</dt><dd>${esc(s.licence)}</dd>
          <dt>사용자 에이전트</dt><dd class="mono" style="word-break:break-all">${esc(navigator.userAgent)}</dd>
        </dl>
      </div>
      <div class="card">
        <div class="card-head"><h2>데이터 저장소</h2></div>
        <dl class="kv">
          <dt>엔진</dt><dd>${esc(s.dbEngine)}</dd>
          <dt>스키마 버전</dt><dd class="mono">${SCHEMA}</dd>
          <dt>마지막 저장</dt><dd>${store.savedAt ? esc(store.savedAt) : '<span class="muted">아직 변경 없음 — 초기 데이터 사용 중</span>'}</dd>
          <dt>저장 용량</dt><dd class="mono">${store.bytes ? (store.bytes / 1024).toFixed(1) + ' KB' : '—'}</dd>
          ${store.error ? `<dt>오류</dt><dd style="color:var(--danger)">${esc(store.error)}</dd>` : ''}
        </dl>
        <div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border)">
          <button class="btn sm" data-action="backup-json">⬇ JSON 백업</button>
          <button class="btn sm mutating" data-action="import-json">⬆ JSON 복원</button>
          <button class="btn sm danger mutating" data-action="reset-data">초기 데이터로 재설정</button>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </div>
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
          ['도메인', db.domains.length], ['VLAN', db.vlans.length], ['서브넷', db.subnets.length],
          ['IP 주소', db.ipAddresses.length], ['변경 이력', db.changeLog.length]
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
    if (!q) return pageHead('검색', '검색어를 입력하세요') + '<div class="card"><div class="empty"><div class="big">🔎</div><p>장비명 · 시리얼 · 자산번호 · IP 주소 · 서브넷으로 부분 검색이 가능합니다.</p></div></div>';

    const devs = db.devices.map(dv).filter((v) =>
      v.name.toLowerCase().includes(lq) || v.fqdn.toLowerCase().includes(lq) ||
      String(v.serial).toLowerCase().includes(lq) || String(v.asset).toLowerCase().includes(lq) || v.ips.includes(lq));
    const rks = db.racks.filter((x) => x.name.toLowerCase().includes(lq));
    const aps = db.apps.filter((x) => x.name.toLowerCase().includes(lq));
    const ips = applySort(ipRows().filter((x) => x.address.includes(lq) || (x.notes || '').toLowerCase().includes(lq)), { key: 'address', dir: 1 }, IP_COLUMNS);
    const sns = db.subnets.filter((x) => (x.cidr + ' ' + x.name).toLowerCase().includes(lq));
    const cols = ['name', 'ip', 'rack', 'pos', 'hardware', 'serial', 'asset', 'customer', 'status'].map((k) => DEVICE_COLUMNS[k]);

    // 완전한 IPv4 주소인데 등록돼 있지 않으면 소속 서브넷과 할당 가능 여부 안내
    let hint = '';
    if (IP.isValid(q) && !db.ipAddresses.some((i) => i.address === q)) {
      const sn = subnetFor(q);
      const net = sn && subnetNet(sn);
      hint = sn
        ? `<div class="notice">🌐 <div><b class="mono">${esc(q)}</b>는 <a href="#/subnet/${esc(sn.id)}?hl=${encodeURIComponent(q)}">${esc(subnetLabel(sn))}</a>에 속한
            ${IP.isReserved(net, IP.toInt(q)) ? '<b>네트워크/브로드캐스트 주소</b>입니다.' : '<b>미사용 주소</b>입니다.'}
            ${IP.isReserved(net, IP.toInt(q)) ? '' : `<button class="btn sm mutating" style="margin-left:6px" data-action="add-ip" data-subnet="${esc(sn.id)}" data-address="${esc(q)}">이 주소 할당</button>`}</div></div>`
        : `<div class="notice warn">🌐 <div><b class="mono">${esc(q)}</b>는 등록된 어떤 서브넷에도 속하지 않습니다.</div></div>`;
    }

    return pageHead('검색 결과', `"${esc(q)}" · 장비 ${devs.length} · IP ${ips.length} · 서브넷 ${sns.length} · 랙 ${rks.length} · 앱 ${aps.length}`) + hint + `
    <div class="card">
      <div class="card-head"><h2>장비 ${devs.length}건</h2></div>
      ${devs.length ? sortableTable(cols, devs, { key: 'name', dir: 1 }, 'noop', { rowClass: (x) => (x.inService ? '' : 'off') })
        : '<div class="empty"><p>일치하는 장비가 없습니다.</p></div>'}
    </div>
    ${ips.length ? `<div class="card"><div class="card-head"><h2>IP 주소 ${ips.length}건</h2></div>
      ${sortableTable(IP_COLUMNS, ips, { key: 'address', dir: 1 }, 'noop', { rowClass: (x) => (x.conflict ? 'conflict' : '') })}</div>` : ''}
    ${sns.length ? `<div class="card"><div class="card-head"><h2>서브넷 ${sns.length}건</h2></div><div class="card-body">
      ${sns.map((x) => `<a class="chip" href="#/subnet/${esc(x.id)}"><span class="mono">${esc(x.cidr)}</span> <span class="muted">${esc(x.name)}</span></a> `).join('')}</div></div>` : ''}
    ${rks.length ? `<div class="card"><div class="card-head"><h2>랙 ${rks.length}건</h2></div><div class="card-body">
      ${rks.map((x) => `<a class="chip" href="#/rack/${esc(x.id)}">${esc(x.name)} <span class="muted">${esc(rackLocation(x))}</span></a> `).join('')}</div></div>` : ''}
    ${aps.length ? `<div class="card"><div class="card-head"><h2>앱 ${aps.length}건</h2></div><div class="card-body">
      ${aps.map((x) => `<a class="chip" href="#/app/${esc(x.id)}">${esc(x.name)}</a> `).join('')}</div></div>` : ''}`;
  }

  function notFound(what) {
    return `<div class="card"><div class="empty"><div class="big">🚫</div><p>요청한 ${esc(what)}을(를) 찾을 수 없습니다.</p>
      <p><a href="#/dashboard">대시보드로</a></p></div></div>`;
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
      () => onOk() !== false);
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
      { k: 'status', label: '라이프사이클 상태', type: 'select', options: statusOptions(), help: "'운영'이 아니면 서비스 중지 장비로 집계됩니다" },
      { k: 'owner', label: '담당자', placeholder: '예: 김정훈 / 인프라운영팀' },
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
      { type: 'section', label: '운영' },
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

  const deviceIpFields = () => [
    { type: 'section', label: '네트워크 (선택)' },
    { k: 'ipSubnetId', label: '서비스/관리 IP 서브넷', type: 'select', options: db.subnets, labeler: subnetLabel, blank: '(지금 할당 안 함)',
      help: '선택하면 해당 서브넷의 다음 빈 주소를 자동 할당합니다' },
    { k: 'ipmiSubnetId', label: 'IPMI/BMC 서브넷', type: 'select', options: db.subnets.filter((x) => x.purpose === 'oob'), labeler: subnetLabel, blank: '(지금 할당 안 함)' }
  ];

  /** 서브넷의 다음 빈 주소를 장비에 할당하고 할당된 주소를 반환 */
  function allocateIp(subnetId, deviceId, type, iface) {
    const sn = L.subnet(subnetId);
    const addr = nextFreeIp(sn);
    if (!addr) return '';
    const rec = { id: uid('ip'), address: addr, subnetId: sn.id, deviceId: deviceId, iface: iface, type: type, status: 'assigned', notes: '' };
    db.ipAddresses.push(rec);
    return addr;
  }

  function openDeviceForm(device, presets) {
    const isNew = !device;
    const fields = deviceFields().concat(isNew ? deviceIpFields() : []);
    const values = device ? Object.assign({}, device) : Object.assign({
      name: '', domainId: 'dm-gabia', customerId: customers()[0].id, roleId: 'ro-web', serviceLevelId: 'sl-silver',
      status: 'active', owner: '',
      rackId: db.racks[0].id, rackPos: 1, hardwareId: 'hw-r640', serial: '', assetNo: '',
      purchased: todayISO(), warrantyEnd: '', osId: 'os-u2204', osLicenceKey: '',
      monitored: true, notes: '', ipSubnetId: '', ipmiSubnetId: ''
    }, presets || {});

    openModal(isNew ? '장비 추가' : `장비 편집 — ${device.name}`, formHtml(fields, values), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      v.name = v.name.trim();
      if (!v.name) { toast('장비명을 입력하세요.'); return false; }
      const size = (L.hw(v.hardwareId) || { sizeU: 1 }).sizeU;
      const err = positionConflict(v.rackId, v.rackPos, size, device ? device.id : null);
      if (err) { toast(err); return false; }
      if (isNew && v.ipSubnetId && !nextFreeIp(L.subnet(v.ipSubnetId))) { toast('선택한 서브넷에 남은 주소가 없습니다.'); return false; }
      if (isNew && v.ipmiSubnetId && !nextFreeIp(L.subnet(v.ipmiSubnetId))) { toast('IPMI 서브넷에 남은 주소가 없습니다.'); return false; }
      if (isNew && v.ipSubnetId && v.ipSubnetId === v.ipmiSubnetId && subnetStats(L.subnet(v.ipSubnetId)).free < 2) {
        toast('서비스 IP와 IPMI를 같은 서브넷에 할당하려면 빈 주소가 2개 이상 필요합니다.'); return false;
      }
      const ipSubnetId = v.ipSubnetId, ipmiSubnetId = v.ipmiSubnetId;
      delete v.ipSubnetId; delete v.ipmiSubnetId;
      v.inService = v.status === 'active';
      const stamp = { updatedBy: CURRENT_USER, updatedAt: nowStamp() };
      if (isNew) {
        const rec = Object.assign({ id: uid('dev'), createdBy: CURRENT_USER }, v, stamp);
        db.devices.push(rec);
        const got = [];
        if (ipSubnetId) {
          const role = rec.roleId;
          const isNet = ['ro-switch', 'ro-fw', 'ro-lb', 'ro-power'].includes(role) && L.subnet(ipSubnetId).purpose === 'mgmt';
          got.push(allocateIp(ipSubnetId, rec.id, isNet ? 'mgmt' : 'primary', isNet ? 'mgmt0' : 'eth0'));
        }
        if (ipmiSubnetId) got.push(allocateIp(ipmiSubnetId, rec.id, 'ipmi', 'bmc'));
        const ips = got.filter(Boolean);   // 할당에 실패한 항목(빈 문자열)은 제외
        logChange('device', rec.id, 'create', `${rec.name} 장비 추가 (${nm(L.rack(rec.rackId))} U${rec.rackPos})${ips.length ? ' · IP ' + ips.join(', ') : ''}`);
        toast(`장비 '${v.name}'을(를) 추가했습니다.${ips.length ? ' IP ' + ips.join(', ') + ' 할당' : ''}`);
      } else {
        const diff = diffSummary(fields, device, v);
        Object.assign(device, v, stamp);
        if (diff) logChange('device', device.id, 'update', `${device.name} — ${diff}`);
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
      { k: 'powerKw', label: '전력 계약 용량 (kW)', type: 'number', min: 0, max: 60, help: '0이면 전력 사용률을 계산하지 않습니다' },
      { k: 'notes', label: '비고', type: 'textarea', full: true }
    ];
    const isNew = !rack;
    const values = rack || { name: '', roomId: db.rooms[0].id, row: '', sizeU: 42, powerKw: 6, notes: '' };
    openModal(isNew ? '랙 추가' : `랙 편집 — ${rack.name}`, formHtml(fields, values), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      if (!v.name.trim()) { toast('랙 이름을 입력하세요.'); return false; }
      if (!isNew) {
        const maxTop = Math.max(0, ...rackDevices(rack.id).map((d) => d.rackPos + deviceSize(d) - 1));
        if (v.sizeU < maxTop) { toast(`이미 U${maxTop}까지 장비가 있어 ${v.sizeU}U로 줄일 수 없습니다.`); return false; }
      }
      if (isNew) {
        const rec = Object.assign({ id: uid('rk') }, v);
        db.racks.push(rec);
        logChange('rack', rec.id, 'create', `${rec.name} 랙 추가 (${rackLocation(rec)})`);
        toast(`랙 '${v.name}'을(를) 추가했습니다.`);
      } else {
        const diff = diffSummary(fields, rack, v);
        Object.assign(rack, v);
        if (diff) logChange('rack', rack.id, 'update', `${rack.name} — ${diff}`);
        toast('저장했습니다.');
      }
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
      if (isNew) {
        const rec = Object.assign({ id: uid('app') }, v);
        db.apps.push(rec);
        logChange('app', rec.id, 'create', `${rec.name} 앱 추가`);
        toast('앱을 추가했습니다.');
      } else {
        const diff = diffSummary(fields, app, v);
        Object.assign(app, v);
        if (diff) logChange('app', app.id, 'update', `${app.name} — ${diff}`);
        toast('저장했습니다.');
      }
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
      logChange('app', v.appId, 'link', `${nm(L.app(v.appId))} ↔ ${d.name} 연결`, [deviceId]);
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
      logChange('app', appId, 'link', `${a.name} ↔ ${nm(L.device(v.deviceId))} 연결`, [v.deviceId]);
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
      if (isNew) {
        sec.list().push(Object.assign({ id: uid(secKey.slice(0, 3)) }, v));
        logChange('config', '', 'create', `${sec.entity} '${v.name}' 추가`);
        toast(`${sec.entity}을(를) 추가했습니다.`);
      } else {
        const diff = diffSummary(fields, item, v);
        Object.assign(item, v);
        if (diff) logChange('config', item.id, 'update', `${sec.entity} '${item.name}' — ${diff}`);
        toast('저장했습니다.');
      }
      return true;
    });
  }

  /* --- IPAM 폼 ---------------------------------------------------------- */
  function ipFields() {
    return [
      { k: 'address', label: 'IP 주소', required: true, placeholder: '예: 10.10.0.25', help: '서브넷을 비워 두면 주소로 자동 판별합니다' },
      { k: 'subnetId', label: '서브넷', type: 'select', options: db.subnets, labeler: subnetLabel, blank: '(주소로 자동 판별)' },
      { k: 'status', label: '상태', type: 'select', options: mapOptions(IP_STATUS, (x) => x.label) },
      { k: 'type', label: '유형', type: 'select', options: mapOptions(IP_TYPES) },
      { k: 'deviceId', label: '장비', type: 'select', options: db.devices.slice().sort((a, b) => cmp(a.name, b.name)),
        labeler: (d) => d.name + ' — ' + nm(L.rack(d.rackId)), blank: '(미지정)' },
      { k: 'iface', label: '인터페이스', placeholder: '예: eth0, bond0, bmc, vs-https' },
      { k: 'notes', label: '비고', type: 'textarea', full: true }
    ];
  }

  /** 장비에 다음으로 필요한 IP(관리 → 서비스 → IPMI → 보조)와 알맞은 서브넷을 제안 */
  function suggestIpFor(dev) {
    const out = { deviceId: dev.id };
    const rk = L.rack(dev.rackId), rm = rk && L.room(rk.roomId);
    const inBld = (x) => !rm || x.buildingId === rm.buildingId;
    const pick = (fn) => db.subnets.find((x) => fn(x) && inBld(x) && nextFreeIp(x));
    const ips = deviceIps(dev.id);
    const hasMain = ips.some((i) => ['primary', 'mgmt'].includes(i.type));
    const hasIpmi = ips.some((i) => i.type === 'ipmi');
    const svc = () => pick((x) => x.purpose === 'svc' && x.customerId === dev.customerId) || pick((x) => x.purpose === 'svc' && !x.customerId);
    let sn = null;
    if (['ro-switch', 'ro-fw', 'ro-power'].includes(dev.roleId) && !hasMain) {
      sn = pick((x) => x.purpose === 'mgmt'); Object.assign(out, { type: 'mgmt', iface: dev.roleId === 'ro-power' ? 'nmc' : 'mgmt0' });
    } else if (!hasMain) {
      sn = svc() || pick((x) => x.purpose === 'dr') || pick((x) => x.purpose === 'mgmt'); Object.assign(out, { type: 'primary', iface: 'eth0' });
    } else if (isServerLike(dev) && !hasIpmi) {
      sn = pick((x) => x.purpose === 'oob'); Object.assign(out, { type: 'ipmi', iface: 'bmc' });
    } else {
      sn = svc() || pick((x) => x.purpose === 'mgmt'); Object.assign(out, { type: dev.roleId === 'ro-lb' ? 'vip' : 'secondary', iface: '' });
    }
    if (sn) out.subnetId = sn.id;
    return out;
  }

  function openIpForm(ip, presets) {
    const fields = ipFields();
    const isNew = !ip;
    const values = ip ? Object.assign({}, ip) : Object.assign({ address: '', subnetId: '', status: 'assigned', type: 'primary', deviceId: '', iface: '', notes: '' }, presets || {});
    if (isNew && !values.address && values.subnetId) values.address = nextFreeIp(L.subnet(values.subnetId));
    if (isNew && values.deviceId && !(presets || {}).type) {
      const dev = L.device(values.deviceId);
      values.type = deviceIps(values.deviceId).some((i) => i.type === 'primary') ? 'secondary' : (dev && ['ro-switch', 'ro-fw', 'ro-power'].includes(dev.roleId) ? 'mgmt' : 'primary');
    }

    openModal(isNew ? 'IP 할당' : `IP 편집 — ${ip.address}`, formHtml(fields, values), `
      <button type="button" class="btn" data-action="ip-fill-next" style="margin-right:auto" title="선택한 서브넷의 다음 빈 주소로 채움">⤵ 다음 빈 IP</button>
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '할당' : '저장'}</button>`, () => {
      const v = readForm(fields);
      v.address = v.address.trim();
      const n = IP.toInt(v.address);
      if (n === null) { toast('올바른 IPv4 주소를 입력하세요. (예: 10.10.0.25)'); return false; }
      v.address = IP.fromInt(n);                       // 010.001.… 같은 표기 정규화
      let sn = L.subnet(v.subnetId);
      if (!sn || !IP.contains(subnetNet(sn), n)) {
        const auto = subnetFor(v.address);
        if (!auto) { toast(`${v.address}가 속한 서브넷이 없습니다. 먼저 서브넷을 등록하세요.`); return false; }
        if (sn) toast(`${sn.cidr} 범위 밖이라 ${auto.cidr}로 등록합니다.`);
        sn = auto;
      }
      v.subnetId = sn.id;
      if (IP.isReserved(subnetNet(sn), n)) { toast(`${v.address}는 ${sn.cidr}의 네트워크/브로드캐스트 주소라 쓸 수 없습니다.`); return false; }
      const dup = db.ipAddresses.find((i) => i.address === v.address && (!ip || i.id !== ip.id));
      if (dup) { toast(`${v.address}는 이미 ${dup.deviceId ? nm(L.device(dup.deviceId)) + '에' : (IP_TYPES[dup.type] || '') + '(으)로'} 등록돼 있습니다.`); return false; }
      if (v.deviceId) v.status = 'assigned';
      const devName = v.deviceId ? nm(L.device(v.deviceId)) : '';
      if (isNew) {
        const rec = Object.assign({ id: uid('ip') }, v);
        db.ipAddresses.push(rec);
        logChange('ip', rec.id, 'create', `${rec.address} ${(IP_STATUS[rec.status] || {}).label || ''}${devName ? ' → ' + devName : ''}${rec.iface ? ' (' + rec.iface + ')' : ''}`, [rec.deviceId, rec.subnetId]);
        toast(`${rec.address}를 등록했습니다.`);
      } else {
        const diff = diffSummary(fields, ip, v);
        const prevDevice = ip.deviceId;
        Object.assign(ip, v);
        if (diff) logChange('ip', ip.id, 'update', `${ip.address} — ${diff}`, [ip.deviceId, prevDevice, ip.subnetId]);
        toast('저장했습니다.');
      }
      return true;
    });
  }

  function subnetFields(isNew) {
    return [
      { k: 'cidr', label: '네트워크 (CIDR)', required: true, placeholder: '예: 10.50.0.0/24', help: '호스트 비트가 섞여 있으면 네트워크 주소로 정리합니다' },
      { k: 'name', label: '이름', required: true, placeholder: '예: 강남 신규 서비스망' },
      { k: 'purpose', label: '용도', type: 'select', options: mapOptions(SUBNET_PURPOSE) },
      { k: 'vlanId', label: 'VLAN', type: 'select', options: db.vlans.slice().sort((a, b) => a.vid - b.vid), labeler: (x) => vlanLabel(x) + ' (' + nm(L.building(x.buildingId)) + ')', blank: '(없음)' },
      { k: 'buildingId', label: '위치(건물)', type: 'select', options: db.buildings },
      { k: 'customerId', label: '고객사', type: 'select', options: customers(), blank: '(공용)' },
      { k: 'gateway', label: '게이트웨이', placeholder: '비워 두면 첫 번째 주소', help: isNew ? '게이트웨이 주소는 예약 IP로 함께 등록됩니다' : '' },
      { k: 'notes', label: '비고', type: 'textarea', full: true }
    ];
  }

  function openSubnetForm(sn) {
    const isNew = !sn;
    const fields = subnetFields(isNew);
    const values = sn || { cidr: '', name: '', purpose: 'svc', vlanId: '', buildingId: db.buildings[0].id, customerId: '', gateway: '', notes: '' };
    openModal(isNew ? '서브넷 추가' : `서브넷 편집 — ${sn.cidr}`, formHtml(fields, values), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      v.name = v.name.trim();
      const net = IP.parseCidr(v.cidr);
      if (!net) { toast('CIDR 형식이 올바르지 않습니다. (예: 10.50.0.0/24)'); return false; }
      if (net.prefix < 16) { toast('/16보다 큰 대역은 하위 서브넷으로 나눠 등록하세요.'); return false; }
      if (!v.name) { toast('이름을 입력하세요.'); return false; }
      if (net.hostBitsSet) toast(`${v.cidr} → ${net.cidr}로 정리했습니다.`);
      v.cidr = net.cidr;
      const clash = db.subnets.find((x) => (!sn || x.id !== sn.id) && subnetNet(x) && IP.overlaps(subnetNet(x), net));
      if (clash) { toast(`${clash.cidr} (${clash.name})와 대역이 겹칩니다.`); return false; }
      v.gateway = (v.gateway || '').trim() || IP.fromInt(net.first);
      const gw = IP.toInt(v.gateway);
      if (gw === null || !IP.contains(net, gw) || IP.isReserved(net, gw)) { toast('게이트웨이는 서브넷의 할당 가능 범위 안에 있어야 합니다.'); return false; }
      v.gateway = IP.fromInt(gw);
      if (sn && v.gateway !== sn.gateway) {
        const taken = db.ipAddresses.find((i) => i.address === v.gateway);
        if (taken) { toast(`${v.gateway}는 이미 ${taken.deviceId ? nm(L.device(taken.deviceId)) + '에' : (IP_TYPES[taken.type] || '') + '(으)로'} 등록돼 있어 게이트웨이로 쓸 수 없습니다.`); return false; }
      }
      if (sn) {
        // 현재 게이트웨이 예약 기록은 저장 시 새 게이트웨이로 옮기므로 검사에서 제외
        const outside = subnetIps(sn.id).filter((i) => !(i.type === 'gateway' && i.address === sn.gateway))
          .filter((i) => !IP.contains(net, IP.toInt(i.address)) || IP.isReserved(net, IP.toInt(i.address)));
        if (outside.length) { toast(`등록된 주소 ${outside.length}개(${outside.slice(0, 3).map((i) => i.address).join(', ')})가 새 범위를 벗어납니다.`); return false; }
      }
      if (isNew) {
        const rec = Object.assign({ id: uid('sn') }, v);
        db.subnets.push(rec);
        if (!db.ipAddresses.some((i) => i.address === rec.gateway)) {
          db.ipAddresses.push({ id: uid('ip'), address: rec.gateway, subnetId: rec.id, deviceId: '', iface: '', type: 'gateway', status: 'reserved', notes: '기본 게이트웨이' });
        }
        logChange('subnet', rec.id, 'create', `${rec.cidr} ${rec.name} 서브넷 추가`);
        toast(`서브넷 ${rec.cidr}을(를) 추가했습니다.`);
      } else {
        const diff = diffSummary(fields, sn, v);
        const oldGw = sn.gateway;
        Object.assign(sn, v);
        // 게이트웨이 예약 레코드도 함께 이동
        const gwRec = db.ipAddresses.find((i) => i.subnetId === sn.id && i.type === 'gateway' && i.address === oldGw);
        if (gwRec && oldGw !== sn.gateway) gwRec.address = sn.gateway;
        if (diff) logChange('subnet', sn.id, 'update', `${sn.cidr} — ${diff}`);
        toast('저장했습니다.');
      }
      return true;
    });
  }

  function openVlanForm(vl) {
    const isNew = !vl;
    const fields = [
      { k: 'vid', label: 'VLAN ID', type: 'number', min: 1, max: 4094, required: true },
      { k: 'name', label: '이름', required: true, placeholder: '예: GN-NEW-SVC' },
      { k: 'buildingId', label: '건물', type: 'select', options: db.buildings, help: 'VLAN ID는 건물(스위칭 도메인)별로 고유해야 합니다' },
      { k: 'notes', label: '비고', type: 'textarea', full: true }
    ];
    const values = vl || { vid: '', name: '', buildingId: db.buildings[0].id, notes: '' };
    openModal(isNew ? 'VLAN 추가' : `VLAN 편집 — ${vl.vid} ${vl.name}`, formHtml(fields, values), `
      <button type="button" class="btn" data-modal-close>취소</button>
      <button type="submit" class="btn primary">${isNew ? '추가' : '저장'}</button>`, () => {
      const v = readForm(fields);
      v.name = v.name.trim();
      if (!Number.isInteger(v.vid) || v.vid < 1 || v.vid > 4094) { toast('VLAN ID는 1–4094 사이 정수입니다.'); return false; }
      if (!v.name) { toast('이름을 입력하세요.'); return false; }
      const dup = db.vlans.find((x) => x.vid === v.vid && x.buildingId === v.buildingId && (!vl || x.id !== vl.id));
      if (dup) { toast(`${nm(L.building(v.buildingId))}에 VLAN ${v.vid}(${dup.name})가 이미 있습니다.`); return false; }
      if (isNew) {
        const rec = Object.assign({ id: uid('vl') }, v);
        db.vlans.push(rec);
        logChange('vlan', rec.id, 'create', `VLAN ${rec.vid} ${rec.name} 추가`);
        toast('VLAN을 추가했습니다.');
      } else {
        const diff = diffSummary(fields, vl, v);
        Object.assign(vl, v);
        if (diff) logChange('vlan', vl.id, 'update', `VLAN ${vl.vid} — ${diff}`);
        toast('저장했습니다.');
      }
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

  function exportDevices(onlySelected) {
    const view = DEVICE_VIEWS[state.devices.view] ? state.devices.view : 'default';
    const cols = DEVICE_VIEWS[view].cols.map((k) => DEVICE_COLUMNS[k]);
    // 선택 내보내기는 일괄 작업과 같은 대상(필터에 가려진 선택 포함)을 사용
    const source = onlySelected ? db.devices.filter((d) => state.devices.selected.has(d.id)).map(dv) : filteredDevices();
    const rows = applySort(source, state.devices.sort, cols);
    const csv = toCsv(cols.map((c) => c.label), rows.map((r) => cols.map((c) => {
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

  function exportSubnets() {
    const rows = applySort(filteredSubnetRows(), state.ipam.sort, SUBNET_COLUMNS);
    const csv = toCsv(['서브넷', '이름', 'VLAN', '용도', '위치', '고객사', '게이트웨이', '가용', '사용', '할당', '예약', 'DHCP', '여유', '사용률(%)', '비고'],
      rows.map((r) => [r.s.cidr, r.s.name, r.vlan ? r.vlan.vid : '', SUBNET_PURPOSE[r.s.purpose] || '', nm(L.building(r.s.buildingId)),
                       nm(L.org(r.s.customerId)), r.s.gateway, r.st.total, r.st.used, r.st.assigned, r.st.reserved, r.st.dhcp, r.st.free, r.st.pct, r.s.notes]));
    download(`rackmanager-subnets-${todayISO()}.csv`, csv);
    toast(`${rows.length}건을 내보냈습니다.`);
  }

  function exportIps() {
    const rows = applySort(filteredIpRows(), state.ips.sort, IP_COLUMNS);
    const csv = toCsv(['주소', '상태', '유형', '장비', '인터페이스', 'DNS 이름', '서브넷', 'VLAN', '충돌', '비고'],
      rows.map((r) => [r.address, (IP_STATUS[r.status] || {}).label || r.status, IP_TYPES[r.type] || r.type, r.device ? r.device.name : '', r.iface,
                       r.device ? fqdn(r.device) : '', r.subnet ? r.subnet.cidr : '', r.vlan ? r.vlan.vid : '', r.conflict ? '충돌' : '', r.notes]));
    download(`rackmanager-ips-${todayISO()}.csv`, csv);
    toast(`${rows.length}건을 내보냈습니다.`);
  }

  function exportActivity() {
    const rows = filteredActivity();
    const csv = toCsv(['일시', '사용자', '대상', '작업', '내용'],
      rows.map((e) => [e.at, e.user, ENTITY_LABEL[e.entity] || e.entity, ACTION_LABEL[e.action] || e.action, e.summary]));
    download(`rackmanager-activity-${todayISO()}.csv`, csv);
    toast(`${rows.length}건을 내보냈습니다.`);
  }

  function backupJson() {
    download(`rackmanager-backup-${todayISO()}.json`, JSON.stringify(snapshot(), null, 2), 'application/json');
    toast('전체 데이터를 JSON으로 백업했습니다.');
  }

  function exportReport() {
    const lines = [];
    lines.push(['구분', '항목', '값']);
    rackRows().forEach((r) => lines.push(['랙 공간', r.rack.name, `${r.st.used}/${r.rack.sizeU}U 사용, 여유 ${r.st.free}U`]));
    tally(db.devices, (d) => nm(L.org(d.customerId))).forEach((t) => lines.push(['고객사별 장비', t.key, t.n + '대']));
    tally(db.devices, (d) => { const o = L.os(d.osId); return o && o.id !== 'os-none' ? o.name + ' ' + o.version : null; })
      .forEach((t) => lines.push(['운영체제', t.key, t.n + '대']));
    tally(db.devices, (d) => nm(L.hw(d.hardwareId))).forEach((t) => lines.push(['하드웨어', t.key, t.n + '대']));
    tally(db.devices, (d) => statusLabel(d.status)).forEach((t) => lines.push(['라이프사이클 상태', t.key, t.n + '대']));
    rackRows().forEach((r) => lines.push(['랙 전력', r.rack.name, `${r.st.watts}W / ${r.st.capW}W (${r.st.powerPct}%)`]));
    subnetRows().forEach((r) => lines.push(['서브넷 사용률', r.s.cidr + ' ' + r.s.name, `${r.st.used}/${r.st.total} (${r.st.pct}%)`]));
    ipConflicts().forEach(([addr, list]) => lines.push(['IP 충돌', addr, list.map((i) => nm(L.device(i.deviceId)) || IP_TYPES[i.type]).join(' / ')]));
    const csv = toCsv(lines[0], lines.slice(1));
    download(`rackmanager-report-${todayISO()}.csv`, csv);
    toast('리포트 요약을 내보냈습니다.');
  }

  /* ======================================================================
     14. 이벤트 바인딩
     ====================================================================== */
  /** 장비 삭제 — 앱 연결과 할당 IP도 함께 해제. 해제된 주소 목록을 반환 */
  function deleteDevices(ids) {
    const set = new Set(ids);
    const released = [];
    for (let i = db.ipAddresses.length - 1; i >= 0; i--) {
      if (set.has(db.ipAddresses[i].deviceId)) { released.push(db.ipAddresses[i].address); db.ipAddresses.splice(i, 1); }
    }
    for (let i = db.appDevices.length - 1; i >= 0; i--) if (set.has(db.appDevices[i].deviceId)) db.appDevices.splice(i, 1);
    for (let i = db.devices.length - 1; i >= 0; i--) if (set.has(db.devices[i].id)) db.devices.splice(i, 1);
    ids.forEach((id) => state.devices.selected.delete(id));
    return released;
  }

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

    /* 장비 다중 선택 */
    const dsel = t.closest('[data-sel="dev"]');
    if (dsel) {
      if (dsel.checked) state.devices.selected.add(dsel.value); else state.devices.selected.delete(dsel.value);
      render();
      return;
    }
    const dall = t.closest('[data-sel-all="dev"]');
    if (dall) {
      const visible = $$('[data-sel="dev"]').map((el) => el.value);
      visible.forEach((id) => { if (dall.checked) state.devices.selected.add(id); else state.devices.selected.delete(id); });
      render();
      return;
    }

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

    const mutating = !['view-selected', 'select-all-racks', 'select-none-racks', 'bulk-clear', 'activity-more', 'ip-fill-next',
                       'export-devices', 'export-racks', 'export-apps', 'export-report', 'export-subnets', 'export-ips',
                       'export-activity', 'export-selected', 'backup-json'].includes(a);
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
        const nIp = deviceIps(d.id).length;
        confirmModal('장비 삭제', `<b>${esc(d.name)}</b> 장비를 삭제할까요?<br><span class="muted">연결된 앱 정보${nIp ? `와 할당된 IP ${nIp}개` : ''}도 함께 해제됩니다. 되돌릴 수 없습니다.</span>`, '삭제', () => {
          const released = deleteDevices([d.id]);
          logChange('device', d.id, 'delete', `${d.name} 장비 삭제${released.length ? ' · IP 해제 ' + released.join(', ') : ''}`);
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
          f.elements.powerKw.value = src.powerKw == null ? '' : src.powerKw;
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
          logChange('rack', rk.id, 'delete', `${rk.name} 랙 삭제`);
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
          logChange('app', ap.id, 'delete', `${ap.name} 앱 삭제`);
          toast('삭제했습니다.');
          if (parseHash().parts[0] === 'app') go('#/apps');
        });
        break;
      }
      case 'link-app':    openLinkAppForm(act.dataset.device); break;
      case 'link-device': openLinkDeviceForm(act.dataset.app); break;
      case 'unlink-app': {
        const i = db.appDevices.findIndex((l) => l.appId === act.dataset.app && l.deviceId === act.dataset.device);
        if (i >= 0) {
          db.appDevices.splice(i, 1);
          logChange('app', act.dataset.app, 'unlink', `${nm(L.app(act.dataset.app))} ↔ ${nm(L.device(act.dataset.device))} 연결 해제`, [act.dataset.device]);
          persist();
          toast('연결을 해제했습니다.');
          render();
        }
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
          logChange('config', item.id, 'delete', `${sec.entity} '${item.name}' 삭제`);
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

      /* --- 장비 일괄 작업 --- */
      case 'bulk-clear': state.devices.selected.clear(); render(); break;
      case 'bulk-status': {
        const st = ($('#bulk-status') || {}).value;
        const list = Array.from(state.devices.selected).map(L.device).filter(Boolean);
        if (!st || !list.length) break;
        const stamp = nowStamp();
        list.forEach((d) => { d.status = st; d.inService = st === 'active'; d.updatedAt = stamp; d.updatedBy = CURRENT_USER; });
        list.forEach((d) => logChange('device', d.id, 'bulk', `${d.name} 상태 일괄 변경 → ${statusLabel(st)}`));
        persist();
        toast(`${list.length}대의 상태를 '${statusLabel(st)}'(으)로 바꿨습니다.`);
        render();
        break;
      }
      case 'bulk-monitor': {
        const on = act.dataset.on === '1';
        const list = Array.from(state.devices.selected).map(L.device).filter(Boolean);
        list.forEach((d) => { d.monitored = on; });
        logChange('device', '', 'bulk', `${list.length}대 모니터링 ${on ? '켜기' : '끄기'}: ${list.map((d) => d.name).join(', ')}`, list.map((d) => d.id));
        persist();
        toast(`${list.length}대의 모니터링을 ${on ? '켰' : '껐'}습니다.`);
        render();
        break;
      }
      case 'bulk-delete': {
        const list = Array.from(state.devices.selected).map(L.device).filter(Boolean);
        if (!list.length) break;
        confirmModal('선택 장비 삭제', `선택한 장비 <b>${list.length}대</b>를 삭제할까요?<br>
          <span class="muted">${esc(list.slice(0, 12).map((d) => d.name).join(', '))}${list.length > 12 ? ' 외' : ''}<br>연결된 앱과 할당된 IP도 함께 해제됩니다.</span>`, '삭제', () => {
          const released = deleteDevices(list.map((d) => d.id));
          logChange('device', '', 'delete', `장비 ${list.length}대 일괄 삭제: ${list.map((d) => d.name).join(', ')}${released.length ? ' · IP 해제 ' + released.length + '개' : ''}`);
          state.devices.selected.clear();
          toast(`${list.length}대를 삭제했습니다.`);
        });
        break;
      }

      /* --- IPAM --- */
      case 'add-ip': {
        const presets = {};
        if (act.dataset.subnet) presets.subnetId = act.dataset.subnet;
        if (act.dataset.address) presets.address = act.dataset.address;
        if (act.dataset.device) Object.assign(presets, suggestIpFor(L.device(act.dataset.device)));
        openIpForm(null, presets);
        break;
      }
      case 'edit-ip': openIpForm(L.ip(id)); break;
      case 'del-ip': {
        const ip = L.ip(id);
        if (!ip) break;
        const owner = L.subnet(ip.subnetId);
        if (owner && ip.type === 'gateway' && ip.address === owner.gateway) {
          toast(`${ip.address}는 ${owner.cidr}의 게이트웨이입니다. 서브넷 편집에서 게이트웨이를 바꾸세요.`);
          break;
        }
        const dev = ip.deviceId ? L.device(ip.deviceId) : null;
        confirmModal('IP 삭제', `<b class="mono">${esc(ip.address)}</b>${dev ? ` (${esc(dev.name)})` : ''}를 해제할까요?<br><span class="muted">주소는 다시 사용 가능 상태가 됩니다.</span>`, '해제', () => {
          db.ipAddresses.splice(db.ipAddresses.indexOf(ip), 1);
          logChange('ip', '', 'delete', `${ip.address} 해제${dev ? ' (' + dev.name + ')' : ''}`, [ip.deviceId, ip.subnetId]);
          toast(`${ip.address}를 해제했습니다.`);
        });
        break;
      }
      case 'ip-fill-next': {
        const f = $('#modal-form');
        if (!f) break;
        const sn = L.subnet(f.elements.subnetId.value) || subnetFor(f.elements.address.value);
        if (!sn) { toast('서브넷을 먼저 선택하세요.'); break; }
        const next = nextFreeIp(sn);
        if (!next) { toast(`${sn.cidr}에 남은 주소가 없습니다.`); break; }
        f.elements.subnetId.value = sn.id;
        f.elements.address.value = next;
        break;
      }
      case 'add-subnet':  openSubnetForm(null); break;
      case 'edit-subnet': openSubnetForm(L.subnet(id)); break;
      case 'del-subnet': {
        const sn = L.subnet(id);
        const used = subnetIps(sn.id).filter((i) => i.type !== 'gateway');
        if (used.length) { toast(`${sn.cidr}에 등록된 주소 ${used.length}개가 있어 삭제할 수 없습니다.`); break; }
        confirmModal('서브넷 삭제', `<b class="mono">${esc(sn.cidr)}</b> ${esc(sn.name)} 서브넷을 삭제할까요?<br><span class="muted">게이트웨이 예약도 함께 삭제됩니다.</span>`, '삭제', () => {
          db.subnets.splice(db.subnets.indexOf(sn), 1);
          for (let i = db.ipAddresses.length - 1; i >= 0; i--) if (db.ipAddresses[i].subnetId === sn.id) db.ipAddresses.splice(i, 1);
          logChange('subnet', sn.id, 'delete', `${sn.cidr} ${sn.name} 서브넷 삭제`);
          toast('삭제했습니다.');
          if (parseHash().parts[0] === 'subnet') go('#/ipam');
        });
        break;
      }
      case 'add-vlan':  openVlanForm(null); break;
      case 'edit-vlan': openVlanForm(L.vlan(id)); break;
      case 'del-vlan': {
        const vl = L.vlan(id);
        const n = db.subnets.filter((x) => x.vlanId === vl.id).length;
        if (n) { toast(`VLAN ${vl.vid}을(를) 쓰는 서브넷 ${n}개가 있어 삭제할 수 없습니다.`); break; }
        confirmModal('VLAN 삭제', `<b>VLAN ${esc(vl.vid)} ${esc(vl.name)}</b>을(를) 삭제할까요?`, '삭제', () => {
          db.vlans.splice(db.vlans.indexOf(vl), 1);
          logChange('vlan', vl.id, 'delete', `VLAN ${vl.vid} ${vl.name} 삭제`);
          toast('삭제했습니다.');
        });
        break;
      }

      /* --- 데이터 관리 --- */
      case 'backup-json': backupJson(); break;
      case 'import-json': { const inp = $('#import-file'); if (inp) { inp.value = ''; inp.click(); } break; }
      case 'reset-data':
        confirmModal('초기 데이터로 재설정', '이 브라우저에 저장된 모든 변경 사항을 지우고 샘플 데이터로 되돌릴까요?<br><span class="muted">필요하면 먼저 JSON 백업을 받아 두세요.</span>', '재설정', () => {
          store.resetting = true;
          try { localStorage.removeItem(STORE_KEY); } catch (err) { /* 무시 */ }
          location.hash = '#/dashboard';
          location.reload();
          return true;
        });
        break;

      case 'activity-more': state.activity.limit += 100; render(); break;
      case 'export-subnets': exportSubnets(); break;
      case 'export-ips':     exportIps(); break;
      case 'export-activity': exportActivity(); break;
      case 'export-selected': exportDevices(true); break;
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
      if (ok !== false) { closeModal(); persist(); render(); }
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
    if (t.matches('[data-state]') && t.type !== 'search') { setStatePath(t.dataset.state, t.type === 'checkbox' ? (t.checked ? '1' : '') : t.value); render(); return; }
    if (t.id === 'import-file' && t.files && t.files[0]) { importJson(t.files[0]); return; }
    if (t.id === 'readonly-toggle') {
      state.readonly = t.checked;
      document.body.classList.toggle('ro', state.readonly);
      toast(state.readonly ? '읽기 전용 모드입니다.' : '편집 모드입니다.');
      return;
    }
  });

  /** 'ips.q' 같은 경로로 화면 상태 값을 설정 */
  function setStatePath(path, value) {
    const [ns, key] = path.split('.');
    if (state[ns] && key in state[ns]) state[ns][key] = value;
    if (ns === 'activity') state.activity.limit = 100;
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = function () {
      let snap;
      try { snap = JSON.parse(reader.result); } catch (err) { toast('JSON 파일을 읽을 수 없습니다.'); return; }
      if (!snap || typeof snap !== 'object') { toast('올바른 RackManager 백업 파일이 아닙니다.'); return; }
      const data = snap.data ? snap.data : snap;
      const n = data && Array.isArray(data.devices) ? data.devices.length : 0;
      confirmModal('JSON 복원', `<b>${esc(file.name)}</b>${snap.savedAt ? ` (저장 ${esc(snap.savedAt)})` : ''}의 데이터로 현재 데이터를 모두 바꿀까요?<br>
        <span class="muted">장비 ${n}대 · 서브넷 ${data && Array.isArray(data.subnets) ? data.subnets.length : 0}개</span>`, '복원', () => {
        try {
          applyData(data);
        } catch (err) { toast('복원 실패: ' + err.message); return false; }
        state.devices.selected.clear();
        state.racks.selected.clear();
        logChange('system', '', 'import', `${file.name}에서 데이터 복원 (장비 ${n}대)`);
        toast('데이터를 복원했습니다.');
        return true;
      });
    };
    reader.readAsText(file);
  }

  /* 필터 입력(디바운스) — 장비 필터와 data-state 검색창 공통 */
  let filterTimer = null;
  document.addEventListener('input', function (e) {
    const t = e.target;
    const isDevQ = t.matches('input[data-filter="q"]');
    const isState = t.matches('input[type="search"][data-state]');
    if (!isDevQ && !isState) return;
    clearTimeout(filterTimer);
    const val = t.value;
    const selector = isDevQ ? 'input[data-filter="q"]' : `input[data-state="${t.dataset.state}"]`;
    filterTimer = setTimeout(() => {
      if (isDevQ) state.devices.filters.q = val; else setStatePath(t.dataset.state, val);
      render();
      const inp = $(selector);
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }, 250);
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

  restore();
  normalize();
  $('#foot-version').textContent = db.system.appVersion;
  updateSaveState();
  if (store.restored) setTimeout(() => toast(`이 브라우저에 저장된 데이터를 불러왔습니다 (${store.savedAt}).`), 300);
  if (store.error) setTimeout(() => toast(store.error), 300);

  window.addEventListener('hashchange', render);
  render();
})();
