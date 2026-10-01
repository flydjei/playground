/* ==========================================================================
   RackManager prototype — in-memory sample dataset
   --------------------------------------------------------------------------
   프로토타입이므로 데이터베이스는 사용하지 않습니다.
   모든 데이터는 이 파일에서 생성되어 브라우저 메모리에만 존재하며,
   새로고침하면 초기 상태로 되돌아갑니다.
   ========================================================================== */
(function (global) {
  'use strict';

  /* --- 결정적 난수 (새로고침해도 같은 시리얼/자산번호가 나오도록) --------- */
  let _seed = 20260806;
  function rnd() {
    _seed = (_seed * 1664525 + 1013904223) % 4294967296;
    return _seed / 4294967296;
  }
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = (n) => Array.from({ length: n }, () => CHARS[Math.floor(rnd() * CHARS.length)]).join('');
  const dstr = (d) => d.toISOString().slice(0, 10);
  const addYears = (iso, y) => { const d = new Date(iso); d.setFullYear(d.getFullYear() + y); return dstr(d); };

  /* --- 조직 (고객사 / 제조사) ------------------------------------------- */
  const organisations = [
    { id: 'org-next',      name: '넥스트커머스',           customer: true,  hardware: false, software: false, notes: '이커머스 플랫폼 · 계약 2023-03 ~' },
    { id: 'org-hanbit',    name: '한빛금융',               customer: true,  hardware: false, software: false, notes: '금융권 · 망분리 요건 적용' },
    { id: 'org-sky',       name: '스카이로지스',           customer: true,  hardware: false, software: false, notes: '물류 트래킹 서비스' },
    { id: 'org-mir',       name: '미르게임즈',             customer: true,  hardware: false, software: false, notes: '게임 서비스 · 트래픽 변동 큼' },
    { id: 'org-core',      name: '코어헬스',               customer: true,  hardware: false, software: false, notes: '헬스케어 SaaS' },
    { id: 'org-infra',     name: '사내 인프라팀',          customer: true,  hardware: false, software: false, notes: '내부 공용 인프라' },
    { id: 'org-dell',      name: 'Dell',                   customer: false, hardware: true,  software: false, notes: '서비스 태그로 보증 조회 가능' },
    { id: 'org-hpe',       name: 'HPE',                    customer: false, hardware: true,  software: false, notes: '' },
    { id: 'org-cisco',     name: 'Cisco',                  customer: false, hardware: true,  software: true,  notes: '' },
    { id: 'org-juniper',   name: 'Juniper Networks',       customer: false, hardware: true,  software: true,  notes: '' },
    { id: 'org-netapp',    name: 'NetApp',                 customer: false, hardware: true,  software: true,  notes: '' },
    { id: 'org-syno',      name: 'Synology',               customer: false, hardware: true,  software: true,  notes: '' },
    { id: 'org-f5',        name: 'F5 Networks',            customer: false, hardware: true,  software: true,  notes: '' },
    { id: 'org-forti',     name: 'Fortinet',               customer: false, hardware: true,  software: true,  notes: '' },
    { id: 'org-apc',       name: 'APC by Schneider',       customer: false, hardware: true,  software: false, notes: '' },
    { id: 'org-smc',       name: 'Supermicro',             customer: false, hardware: true,  software: false, notes: '' },
    { id: 'org-ms',        name: 'Microsoft',              customer: false, hardware: false, software: true,  notes: '' },
    { id: 'org-vmware',    name: 'VMware',                 customer: false, hardware: false, software: true,  notes: '' },
    { id: 'org-canonical', name: 'Canonical',              customer: false, hardware: false, software: true,  notes: '' },
    { id: 'org-redhat',    name: 'Red Hat',                customer: false, hardware: false, software: true,  notes: '' },
    { id: 'org-rocky',     name: 'Rocky Enterprise SF',    customer: false, hardware: false, software: true,  notes: '' }
  ];

  /* --- 건물 / 전산실 / 랙 ----------------------------------------------- */
  const buildings = [
    { id: 'b-gn',   name: '가비아 IDC 강남', notes: '서울 강남구 테헤란로 152' },
    { id: 'b-jj',   name: '가비아 IDC 죽전', notes: '경기 용인시 수지구 죽전로 15' },
    { id: 'b-jeju', name: '가비아 IDC 제주', notes: '제주시 첨단로 213' }
  ];

  const rooms = [
    { id: 'rm-gn-a',   buildingId: 'b-gn',   name: '1F 서버룸 A',   notes: '항온항습 2계통 · UPS 이중화' },
    { id: 'rm-gn-b',   buildingId: 'b-gn',   name: '1F 서버룸 B',   notes: '고밀도 존 (랙당 12kW)' },
    { id: 'rm-jj-2f',  buildingId: 'b-jj',   name: '2F 코로케이션', notes: '' },
    { id: 'rm-jeju-1f',buildingId: 'b-jeju', name: '1F 클라우드존', notes: '재해복구(DR) 용도' }
  ];

  const racks = [
    { id: 'rk-gna01', roomId: 'rm-gn-a',    name: 'GN-A-01', row: 'A열', sizeU: 42, notes: '넥스트커머스 전용' },
    { id: 'rk-gna02', roomId: 'rm-gn-a',    name: 'GN-A-02', row: 'A열', sizeU: 42, notes: '한빛금융 전용 · 잠금 랙' },
    { id: 'rk-gna03', roomId: 'rm-gn-a',    name: 'GN-A-03', row: 'B열', sizeU: 42, notes: '' },
    { id: 'rk-gnb01', roomId: 'rm-gn-b',    name: 'GN-B-01', row: 'A열', sizeU: 42, notes: '고밀도 · 후면 냉각 도어' },
    { id: 'rk-gnb02', roomId: 'rm-gn-b',    name: 'GN-B-02', row: 'A열', sizeU: 42, notes: '증설 여유 많음' },
    { id: 'rk-jj01',  roomId: 'rm-jj-2f',   name: 'JJ-2F-01',row: 'C열', sizeU: 42, notes: '사내 공용 인프라' },
    { id: 'rk-jj02',  roomId: 'rm-jj-2f',   name: 'JJ-2F-02',row: 'C열', sizeU: 42, notes: '예비 랙' },
    { id: 'rk-jeju01',roomId: 'rm-jeju-1f', name: 'JEJU-C-01',row: 'A열',sizeU: 42, notes: 'DR 사이트' }
  ];

  // 랙별 전력 계약 용량(kW) — 고밀도 존(GN-B)은 12kW
  const RACK_POWER = { 'rk-gna01': 8, 'rk-gna02': 8, 'rk-gna03': 6, 'rk-gnb01': 12, 'rk-gnb02': 12, 'rk-jj01': 6, 'rk-jj02': 4, 'rk-jeju01': 6 };
  racks.forEach((r) => { r.powerKw = RACK_POWER[r.id] || 6; });

  /* --- 하드웨어 모델 ----------------------------------------------------- */
  const hardware = [
    { id: 'hw-r640',   manufacturerId: 'org-dell',    name: 'PowerEdge R640',        sizeU: 1, notes: '1U 2소켓 범용 서버' },
    { id: 'hw-r740',   manufacturerId: 'org-dell',    name: 'PowerEdge R740',        sizeU: 2, notes: '' },
    { id: 'hw-r750',   manufacturerId: 'org-dell',    name: 'PowerEdge R750',        sizeU: 2, notes: 'DB 표준 모델' },
    { id: 'hw-r940',   manufacturerId: 'org-dell',    name: 'PowerEdge R940',        sizeU: 4, notes: '4소켓 대용량' },
    { id: 'hw-dl360',  manufacturerId: 'org-hpe',     name: 'ProLiant DL360 Gen10',  sizeU: 1, notes: '' },
    { id: 'hw-dl380',  manufacturerId: 'org-hpe',     name: 'ProLiant DL380 Gen10',  sizeU: 2, notes: '가상화 호스트 표준' },
    { id: 'hw-6029p',  manufacturerId: 'org-smc',     name: 'SuperServer 6029P-TRT', sizeU: 2, notes: '' },
    { id: 'hw-c9300',  manufacturerId: 'org-cisco',   name: 'Catalyst 9300-48P',     sizeU: 1, notes: '액세스 스위치' },
    { id: 'hw-n9336',  manufacturerId: 'org-cisco',   name: 'Nexus 9336C-FX2',       sizeU: 1, notes: '스파인 스위치' },
    { id: 'hw-ex4300', manufacturerId: 'org-juniper', name: 'EX4300-48T',            sizeU: 1, notes: '' },
    { id: 'hw-fas2750',manufacturerId: 'org-netapp',  name: 'FAS2750',               sizeU: 2, notes: 'NAS/SAN 겸용' },
    { id: 'hw-rs3621', manufacturerId: 'org-syno',    name: 'RackStation RS3621xs+', sizeU: 2, notes: '백업 스토리지' },
    { id: 'hw-bigip',  manufacturerId: 'org-f5',      name: 'BIG-IP i4800',          sizeU: 1, notes: 'L4/L7 로드밸런서' },
    { id: 'hw-fg600f', manufacturerId: 'org-forti',   name: 'FortiGate 600F',        sizeU: 1, notes: '' },
    { id: 'hw-srt5k',  manufacturerId: 'org-apc',     name: 'Smart-UPS SRT 5000VA',  sizeU: 4, notes: '랙마운트 UPS' }
  ];

  // 모델별 평균 소비전력(W) — 랙 전력 사용률 계산에 사용. UPS는 공급 설비라 0W로 계산
  const HW_POWER = {
    'hw-r640': 450, 'hw-r740': 750, 'hw-r750': 800, 'hw-r940': 1600, 'hw-dl360': 500, 'hw-dl380': 800,
    'hw-6029p': 900, 'hw-c9300': 400, 'hw-n9336': 450, 'hw-ex4300': 250, 'hw-fas2750': 700,
    'hw-rs3621': 300, 'hw-bigip': 400, 'hw-fg600f': 250, 'hw-srt5k': 0
  };
  hardware.forEach((h) => { h.powerW = HW_POWER[h.id] || 0; });

  /* --- 운영체제 --------------------------------------------------------- */
  const operatingSystems = [
    { id: 'os-none',    manufacturerId: '',            name: '해당 없음',      version: '',            notes: '전원·네트워크 설비 등' },
    { id: 'os-u2204',   manufacturerId: 'org-canonical', name: 'Ubuntu Server', version: '22.04 LTS',   notes: '표준 리눅스 이미지' },
    { id: 'os-u2004',   manufacturerId: 'org-canonical', name: 'Ubuntu Server', version: '20.04 LTS',   notes: '2025-04 표준 지원 종료' },
    { id: 'os-rocky9',  manufacturerId: 'org-rocky',   name: 'Rocky Linux',    version: '9.3',         notes: '' },
    { id: 'os-c7',      manufacturerId: 'org-redhat',  name: 'CentOS',         version: '7.9',         notes: 'EOL — 마이그레이션 대상' },
    { id: 'os-ws2022',  manufacturerId: 'org-ms',      name: 'Windows Server', version: '2022 Std',    notes: '' },
    { id: 'os-ws2019',  manufacturerId: 'org-ms',      name: 'Windows Server', version: '2019 Std',    notes: '' },
    { id: 'os-esxi8',   manufacturerId: 'org-vmware',  name: 'VMware ESXi',    version: '8.0 U2',      notes: '' },
    { id: 'os-iosxe',   manufacturerId: 'org-cisco',   name: 'Cisco IOS-XE',   version: '17.9.4',      notes: '' },
    { id: 'os-nxos',    manufacturerId: 'org-cisco',   name: 'Cisco NX-OS',    version: '10.2(5)',     notes: '' },
    { id: 'os-junos',   manufacturerId: 'org-juniper', name: 'Junos',          version: '21.4R3',      notes: '' },
    { id: 'os-ontap',   manufacturerId: 'org-netapp',  name: 'ONTAP',          version: '9.12.1',      notes: '' },
    { id: 'os-dsm',     manufacturerId: 'org-syno',    name: 'DSM',            version: '7.2',         notes: '' },
    { id: 'os-tmos',    manufacturerId: 'org-f5',      name: 'TMOS',           version: '15.1.10',     notes: '' },
    { id: 'os-fortios', manufacturerId: 'org-forti',   name: 'FortiOS',        version: '7.2.8',       notes: '' }
  ];

  /* --- 역할 / 서비스 수준 / 도메인 --------------------------------------- */
  const roles = [
    { id: 'ro-web',     name: '웹 서버',        notes: '' },
    { id: 'ro-was',     name: '애플리케이션 서버', notes: 'WAS' },
    { id: 'ro-db',      name: 'DB 서버',        notes: '' },
    { id: 'ro-vhost',   name: '가상화 호스트',   notes: '' },
    { id: 'ro-storage', name: '스토리지',       notes: '' },
    { id: 'ro-switch',  name: '네트워크 스위치', notes: '' },
    { id: 'ro-lb',      name: '로드밸런서',      notes: '' },
    { id: 'ro-fw',      name: '방화벽',          notes: '' },
    { id: 'ro-backup',  name: '백업 서버',       notes: '' },
    { id: 'ro-batch',   name: '배치/워커',       notes: '' },
    { id: 'ro-mon',     name: '모니터링',        notes: '' },
    { id: 'ro-cache',   name: '캐시 서버',       notes: '' },
    { id: 'ro-dns',     name: 'DNS 서버',        notes: '' },
    { id: 'ro-mail',    name: '메일 서버',       notes: '' },
    { id: 'ro-log',     name: '로그 수집',       notes: '' },
    { id: 'ro-power',   name: '전원 설비',       notes: '' },
    { id: 'ro-spare',   name: '예비/미배정',     notes: '' }
  ];

  const serviceLevels = [
    { id: 'sl-gold',   name: '골드',      notes: '24x7 · 4시간 이내 온사이트' },
    { id: 'sl-silver', name: '실버',      notes: '평일 09-18 · 8시간 이내' },
    { id: 'sl-bronze', name: '브론즈',    notes: '베스트 에포트' },
    { id: 'sl-dev',    name: '개발/테스트', notes: 'SLA 없음' }
  ];

  const domains = [
    { id: 'dm-none',   name: '(도메인 없음)', notes: '완전한 이름을 직접 입력하는 장비' },
    { id: 'dm-gabia',  name: 'gabia.co.kr',    notes: '사내 인프라 기본 도메인' },
    { id: 'dm-next',   name: 'nextcommerce.kr',notes: '' },
    { id: 'dm-hanbit', name: 'hanbit-fin.com', notes: '' },
    { id: 'dm-sky',    name: 'skylogis.net',   notes: '' },
    { id: 'dm-mir',    name: 'mirgames.io',    notes: '' },
    { id: 'dm-core',   name: 'corehealth.kr',  notes: '' }
  ];

  /* --- 장비 ------------------------------------------------------------- */
  // [name, domainId, rackId, rackPos, hardwareId, osId, customerId, roleId, serviceLevelId, extra]
  const DEV = [
    // ---- GN-A-01 : 넥스트커머스
    ['sw-gna-01',  'dm-gabia', 'rk-gna01', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['sw-gna-02',  'dm-gabia', 'rk-gna01', 41, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['lb-gna-01',  'dm-gabia', 'rk-gna01', 39, 'hw-bigip',   'os-tmos',   'org-infra', 'ro-lb',     'sl-gold'],
    ['web01',      'dm-next',  'rk-gna01', 37, 'hw-r740',    'os-u2204',  'org-next',  'ro-web',    'sl-gold'],
    ['web02',      'dm-next',  'rk-gna01', 35, 'hw-r740',    'os-u2204',  'org-next',  'ro-web',    'sl-gold'],
    ['web03',      'dm-next',  'rk-gna01', 33, 'hw-r740',    'os-u2204',  'org-next',  'ro-web',    'sl-gold'],
    ['ncdb01',     'dm-next',  'rk-gna01', 31, 'hw-r750',    'os-rocky9', 'org-next',  'ro-db',     'sl-gold',   { serial: 'SN-DUP-4471', notes: '마스터 · 동기 복제' }],
    ['ncdb02',     'dm-next',  'rk-gna01', 29, 'hw-r750',    'os-rocky9', 'org-next',  'ro-db',     'sl-gold',   { serial: 'SN-DUP-4471', notes: '스탠바이 — 시리얼 중복 입력 의심' }],
    ['ncbatch01',  'dm-next',  'rk-gna01', 25, 'hw-r940',    'os-u2204',  'org-next',  'ro-batch',  'sl-silver'],
    ['ncnas01',    'dm-next',  'rk-gna01', 23, 'hw-fas2750', 'os-ontap',  'org-next',  'ro-storage','sl-gold'],
    ['ups-gna-01', 'dm-gabia', 'rk-gna01',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver', { monitored: true }],

    // ---- GN-A-02 : 한빛금융
    ['sw-gna-03',  'dm-gabia', 'rk-gna02', 42, 'hw-n9336',   'os-nxos',   'org-infra', 'ro-switch', 'sl-gold'],
    ['fw-gna-01',  'dm-gabia', 'rk-gna02', 40, 'hw-fg600f',  'os-fortios','org-infra', 'ro-fw',     'sl-gold'],
    ['hbvh01',     'dm-hanbit','rk-gna02', 37, 'hw-dl380',   'os-esxi8',  'org-hanbit','ro-vhost',  'sl-gold'],
    ['hbvh02',     'dm-hanbit','rk-gna02', 35, 'hw-dl380',   'os-esxi8',  'org-hanbit','ro-vhost',  'sl-gold'],
    ['hbvh03',     'dm-hanbit','rk-gna02', 33, 'hw-dl380',   'os-esxi8',  'org-hanbit','ro-vhost',  'sl-gold'],
    ['hbvh04',     'dm-hanbit','rk-gna02', 31, 'hw-dl380',   'os-esxi8',  'org-hanbit','ro-vhost',  'sl-gold'],
    ['hbdb01',     'dm-hanbit','rk-gna02', 28, 'hw-r750',    'os-ws2022', 'org-hanbit','ro-db',     'sl-gold',   { licence: 'WS22-4KX9-QM71-BB30' }],
    ['hbdb02',     'dm-hanbit','rk-gna02', 26, 'hw-r750',    'os-ws2022', 'org-hanbit','ro-db',     'sl-gold',   { licence: 'WS22-4KX9-QM71-BB30', notes: '라이선스 키 중복 — 확인 필요' }],
    ['hbbkp01',    'dm-hanbit','rk-gna02', 24, 'hw-rs3621',  'os-dsm',    'org-hanbit','ro-backup', 'sl-silver'],
    ['ups-gna-02', 'dm-gabia', 'rk-gna02',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- GN-A-03 : 스카이로지스
    ['sw-gna-04',  'dm-gabia', 'rk-gna03', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['skweb01',    'dm-sky',   'rk-gna03', 40, 'hw-r640',    'os-u2004',  'org-sky',   'ro-web',    'sl-silver', { asset: 'AST-2024-0311' }],
    ['skweb02',    'dm-sky',   'rk-gna03', 39, 'hw-r640',    'os-u2004',  'org-sky',   'ro-web',    'sl-silver', { asset: 'AST-2024-0311', notes: '자산번호 중복 — 실사 필요' }],
    ['skapp01',    'dm-sky',   'rk-gna03', 37, 'hw-dl380',   'os-u2204',  'org-sky',   'ro-was',    'sl-silver'],
    ['skdb01',     'dm-sky',   'rk-gna03', 35, 'hw-r750',    'os-rocky9', 'org-sky',   'ro-db',     'sl-gold'],
    ['sktrk01',    'dm-sky',   'rk-gna03', 33, 'hw-r640',    'os-c7',     'org-sky',   'ro-batch',  'sl-bronze', { notes: 'CentOS 7 EOL — 교체 계획 수립 중' }],
    ['sktrk02',    'dm-sky',   'rk-gna03', 32, 'hw-r640',    'os-c7',     'org-sky',   'ro-batch',  'sl-bronze', { status: 'rma', monitored: false, notes: 'RMA 진행 중 (메인보드 교체)' }],
    ['ups-gna-03', 'dm-gabia', 'rk-gna03',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- GN-B-01 : 미르게임즈
    ['sw-gnb-01',  'dm-gabia', 'rk-gnb01', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['mglb01',     'dm-mir',   'rk-gnb01', 40, 'hw-bigip',   'os-tmos',   'org-mir',   'ro-lb',     'sl-gold'],
    ['mggame01',   'dm-mir',   'rk-gnb01', 38, 'hw-r640',    'os-u2204',  'org-mir',   'ro-was',    'sl-gold'],
    ['mggame02',   'dm-mir',   'rk-gnb01', 37, 'hw-r640',    'os-u2204',  'org-mir',   'ro-was',    'sl-gold'],
    ['mggame03',   'dm-mir',   'rk-gnb01', 36, 'hw-r640',    'os-u2204',  'org-mir',   'ro-was',    'sl-gold'],
    ['mggame04',   'dm-mir',   'rk-gnb01', 35, 'hw-r640',    'os-u2204',  'org-mir',   'ro-was',    'sl-gold'],
    ['mggame05',   'dm-mir',   'rk-gnb01', 34, 'hw-r640',    'os-u2204',  'org-mir',   'ro-was',    'sl-gold'],
    ['mggame06',   'dm-mir',   'rk-gnb01', 33, 'hw-r640',    'os-u2204',  'org-mir',   'ro-was',    'sl-gold'],
    ['mgdb01',     'dm-mir',   'rk-gnb01', 30, 'hw-r750',    'os-rocky9', 'org-mir',   'ro-db',     'sl-gold'],
    ['mgdb02',     'dm-mir',   'rk-gnb01', 28, 'hw-r750',    'os-rocky9', 'org-mir',   'ro-db',     'sl-gold'],
    ['mgcache01',  'dm-mir',   'rk-gnb01', 26, 'hw-r640',    'os-u2204',  'org-mir',   'ro-cache',  'sl-silver'],
    ['ups-gnb-01', 'dm-gabia', 'rk-gnb01',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- GN-B-02 : 코어헬스 (여유 많음)
    ['sw-gnb-02',  'dm-gabia', 'rk-gnb02', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-silver'],
    ['chweb01',    'dm-core',  'rk-gnb02', 40, 'hw-r640',    'os-ws2019', 'org-core',  'ro-web',    'sl-silver'],
    ['chdb01',     'dm-core',  'rk-gnb02', 38, 'hw-r750',    'os-ws2022', 'org-core',  'ro-db',     'sl-gold'],
    ['chnas01',    'dm-core',  'rk-gnb02', 36, 'hw-rs3621',  'os-dsm',    'org-core',  'ro-storage','sl-silver', { status: 'staging', notes: '증설 구축 중 — 2026-10 오픈 예정' }],

    // ---- JJ-2F-01 : 사내 인프라
    ['sw-jj-01',   'dm-gabia', 'rk-jj01',  42, 'hw-n9336',   'os-nxos',   'org-infra', 'ro-switch', 'sl-gold'],
    ['sw-jj-02',   'dm-gabia', 'rk-jj01',  41, 'hw-ex4300',  'os-junos',  'org-infra', 'ro-switch', 'sl-gold'],
    ['mon1',       'dm-gabia', 'rk-jj01',  39, 'hw-r640',    'os-u2204',  'org-infra', 'ro-mon',    'sl-silver', { status: 'maintenance', notes: '2026-07-30 하드웨어 점검을 위해 서비스 중지' }],
    ['logcol01',   'dm-gabia', 'rk-jj01',  37, 'hw-dl380',   'os-u2204',  'org-infra', 'ro-log',    'sl-gold'],
    ['dns01',      'dm-gabia', 'rk-jj01',  36, 'hw-r640',    'os-u2204',  'org-infra', 'ro-dns',    'sl-gold'],
    ['dns02',      'dm-gabia', 'rk-jj01',  35, 'hw-r640',    'os-u2204',  'org-infra', 'ro-dns',    'sl-gold'],
    ['mail01',     'dm-gabia', 'rk-jj01',  33, 'hw-dl380',   'os-u2204',  'org-infra', 'ro-mail',   'sl-silver'],
    ['gw-jj-01',   'dm-gabia', 'rk-jj01',  31, 'hw-fg600f',  'os-fortios','org-infra', 'ro-fw',     'sl-gold'],
    ['ups-jj-01',  'dm-gabia', 'rk-jj01',   1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- JJ-2F-02 : 예비
    ['sw-jj-03',   'dm-gabia', 'rk-jj02',  42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-bronze'],
    ['spare-01',   'dm-none',  'rk-jj02',  40, 'hw-r740',    'os-none',   'org-infra', 'ro-spare',  'sl-dev',    { status: 'stock', monitored: false, notes: '미배정 예비 장비' }],

    // ---- JEJU-C-01 : DR
    ['sw-jeju-01', 'dm-gabia', 'rk-jeju01',42, 'hw-n9336',   'os-nxos',   'org-infra', 'ro-switch', 'sl-gold'],
    ['esx-jeju01', 'dm-gabia', 'rk-jeju01',39, 'hw-dl380',   'os-esxi8',  'org-infra', 'ro-vhost',  'sl-gold'],
    ['esx-jeju02', 'dm-gabia', 'rk-jeju01',37, 'hw-dl380',   'os-esxi8',  'org-infra', 'ro-vhost',  'sl-gold'],
    ['stor-jeju01','dm-gabia', 'rk-jeju01',34, 'hw-fas2750', 'os-ontap',  'org-infra', 'ro-storage','sl-gold'],
    ['ups-jeju-01','dm-gabia', 'rk-jeju01', 1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver']
  ];

  const EDITORS = ['rackmanager', 'jhkim', 'ryan', 'sypark', 'dwlee'];
  // 고객사별 기본 담당 엔지니어
  const OWNERS = { 'org-next': '김정훈', 'org-hanbit': '박서연', 'org-sky': '이도윤', 'org-mir': '최민재', 'org-core': '박서연', 'org-infra': '인프라운영팀' };
  const PURCHASE_YEARS = ['2021-11-02', '2022-05-17', '2023-02-09', '2023-08-24', '2024-01-15',
                          '2024-06-30', '2024-11-11', '2025-03-05', '2025-09-19', '2026-01-22'];

  const devices = DEV.map(function (t, i) {
    const [name, domainId, rackId, rackPos, hardwareId, osId, customerId, roleId, serviceLevelId] = t;
    const extra = t[9] || {};
    const hw = hardware.find((h) => h.id === hardwareId);
    const mfr = hw.manufacturerId;
    const isDell = mfr === 'org-dell';
    const purchased = extra.purchased || pick(PURCHASE_YEARS);
    const warrantyYears = int(3, 5);
    return {
      id: 'dev-' + (i + 1),
      name: name,
      domainId: domainId,
      rackId: rackId,
      rackPos: rackPos,
      hardwareId: hardwareId,
      osId: osId,
      osLicenceKey: extra.licence || (osId === 'os-ws2022' || osId === 'os-ws2019'
        ? 'WS' + code(2) + '-' + code(4) + '-' + code(4) + '-' + code(4) : ''),
      customerId: customerId,
      roleId: roleId,
      serviceLevelId: serviceLevelId,
      serial: extra.serial || (isDell ? code(7) : 'SN-' + code(4) + '-' + code(4)),
      assetNo: extra.asset || 'AST-' + purchased.slice(0, 4) + '-' + String(int(100, 999) * 1 + i).padStart(4, '0'),
      purchased: purchased,
      warrantyEnd: extra.warranty || addYears(purchased, warrantyYears),
      status: extra.status || 'active',
      inService: !extra.status || extra.status === 'active',
      monitored: extra.monitored !== undefined ? extra.monitored : (extra.status && extra.status !== 'active' ? false : true),
      owner: OWNERS[customerId] || '',
      notes: extra.notes || '',
      updatedBy: pick(EDITORS),
      updatedAt: '2026-0' + int(1, 7) + '-' + String(int(10, 28)) + ' ' + String(int(9, 18)).padStart(2, '0') + ':' + String(int(0, 59)).padStart(2, '0'),
      createdBy: 'rackmanager'
    };
  });

  /* --- 앱 및 장비-앱 연결 ------------------------------------------------ */
  const apps = [
    { id: 'app-member',  name: '통합회원 API',    notes: 'OAuth2 인증 · 전사 공통' },
    { id: 'app-shop',    name: '쇼핑몰 프론트',   notes: '넥스트커머스 메인 서비스' },
    { id: 'app-pay',     name: '결제 게이트웨이', notes: 'PG 연동 · PCI-DSS 범위' },
    { id: 'app-track',   name: '배송 추적',       notes: '' },
    { id: 'app-group',   name: '사내 그룹웨어',   notes: '' },
    { id: 'app-log',     name: '중앙 로그 수집',  notes: 'OpenSearch 기반' },
    { id: 'app-back',    name: '백오피스',        notes: '' },
    { id: 'app-match',   name: '게임 매치메이킹', notes: '미르게임즈 전용' }
  ];

  const byName = {};
  devices.forEach((d) => { byName[d.name] = d.id; });
  const link = (appId, names) => names.map((n) => ({ appId: appId, deviceId: byName[n] }));

  const appDevices = [].concat(
    link('app-shop',   ['web01', 'web02', 'web03']),
    link('app-member', ['web01', 'web02', 'skapp01', 'chweb01']),
    link('app-pay',    ['web03', 'ncdb01', 'hbdb01']),
    link('app-track',  ['skapp01', 'sktrk01', 'sktrk02', 'skdb01']),
    link('app-group',  ['mail01', 'logcol01']),
    link('app-log',    ['logcol01', 'mon1']),
    link('app-back',   ['chweb01', 'chdb01', 'hbvh01']),
    link('app-match',  ['mggame01', 'mggame02', 'mggame03', 'mggame04', 'mggame05', 'mggame06', 'mgcache01'])
  ).filter((l) => l.deviceId);


  /* --- IPAM: VLAN / 서브넷 / IP 주소 ------------------------------------- */
  const IP = global.RM_IP;

  const vlans = [
    { id: 'vl-gn-10',   vid: 10,  name: 'GN-MGMT',        buildingId: 'b-gn',   notes: '강남 장비 관리망' },
    { id: 'vl-gn-11',   vid: 11,  name: 'GN-OOB',         buildingId: 'b-gn',   notes: '강남 IPMI/iDRAC/iLO 대역' },
    { id: 'vl-gn-101',  vid: 101, name: 'NEXT-SVC',       buildingId: 'b-gn',   notes: '넥스트커머스 서비스망' },
    { id: 'vl-gn-201',  vid: 201, name: 'HANBIT-PRIV',    buildingId: 'b-gn',   notes: '한빛금융 내부망 (망분리)' },
    { id: 'vl-gn-301',  vid: 301, name: 'SKY-SVC',        buildingId: 'b-gn',   notes: '' },
    { id: 'vl-gn-401',  vid: 401, name: 'MIR-SVC',        buildingId: 'b-gn',   notes: '' },
    { id: 'vl-gn-501',  vid: 501, name: 'CORE-SVC',       buildingId: 'b-gn',   notes: '' },
    { id: 'vl-jj-10',   vid: 10,  name: 'JJ-MGMT',        buildingId: 'b-jj',   notes: '' },
    { id: 'vl-jj-11',   vid: 11,  name: 'JJ-OOB',         buildingId: 'b-jj',   notes: '' },
    { id: 'vl-jj-100',  vid: 100, name: 'INFRA-SVC',      buildingId: 'b-jj',   notes: '사내 공용 서비스' },
    { id: 'vl-jeju-10', vid: 10,  name: 'JEJU-MGMT',      buildingId: 'b-jeju', notes: '' },
    { id: 'vl-jeju-11', vid: 11,  name: 'JEJU-OOB',       buildingId: 'b-jeju', notes: '' },
    { id: 'vl-jeju-900',vid: 900, name: 'DR-REPL',        buildingId: 'b-jeju', notes: 'DR 복제 전용' }
  ];

  // purpose: svc(서비스) · mgmt(관리) · oob(IPMI/OOB) · dr(DR/복제)
  const subnets = [
    { id: 'sn-gn-mgmt',  cidr: '10.10.0.0/24',     name: '강남 관리망',        vlanId: 'vl-gn-10',   buildingId: 'b-gn',   customerId: 'org-infra',  purpose: 'mgmt', gateway: '10.10.0.1',     notes: '.200–.209 DHCP 풀 (작업용 노트북)' },
    { id: 'sn-gn-oob',   cidr: '10.11.0.0/24',     name: '강남 OOB',           vlanId: 'vl-gn-11',   buildingId: 'b-gn',   customerId: 'org-infra',  purpose: 'oob',  gateway: '10.11.0.1',     notes: '' },
    { id: 'sn-next',     cidr: '203.0.113.0/26',   name: '넥스트커머스 서비스', vlanId: 'vl-gn-101',  buildingId: 'b-gn',   customerId: 'org-next',   purpose: 'svc',  gateway: '203.0.113.1',   notes: '공인 /26 · VIP 포함' },
    { id: 'sn-hanbit',   cidr: '172.16.10.0/24',   name: '한빛금융 내부망',     vlanId: 'vl-gn-201',  buildingId: 'b-gn',   customerId: 'org-hanbit', purpose: 'svc',  gateway: '172.16.10.1',   notes: '외부 라우팅 없음' },
    { id: 'sn-sky',      cidr: '203.0.113.64/27',  name: '스카이로지스 서비스', vlanId: 'vl-gn-301',  buildingId: 'b-gn',   customerId: 'org-sky',    purpose: 'svc',  gateway: '203.0.113.65',  notes: '' },
    { id: 'sn-mir',      cidr: '198.51.100.0/25',  name: '미르게임즈 서비스',   vlanId: 'vl-gn-401',  buildingId: 'b-gn',   customerId: 'org-mir',    purpose: 'svc',  gateway: '198.51.100.1',  notes: '이벤트 기간 증설 대비 여유 확보' },
    { id: 'sn-core',     cidr: '203.0.113.96/29',  name: '코어헬스 서비스',     vlanId: 'vl-gn-501',  buildingId: 'b-gn',   customerId: 'org-core',   purpose: 'svc',  gateway: '203.0.113.97',  notes: '/29 — 증설 시 재할당 필요' },
    { id: 'sn-jj-mgmt',  cidr: '10.20.0.0/24',     name: '죽전 관리망',        vlanId: 'vl-jj-10',   buildingId: 'b-jj',   customerId: 'org-infra',  purpose: 'mgmt', gateway: '10.20.0.1',     notes: '' },
    { id: 'sn-jj-oob',   cidr: '10.21.0.0/24',     name: '죽전 OOB',           vlanId: 'vl-jj-11',   buildingId: 'b-jj',   customerId: 'org-infra',  purpose: 'oob',  gateway: '10.21.0.1',     notes: '' },
    { id: 'sn-infra',    cidr: '192.0.2.0/26',     name: '사내 공용 서비스',    vlanId: 'vl-jj-100',  buildingId: 'b-jj',   customerId: 'org-infra',  purpose: 'svc',  gateway: '192.0.2.1',     notes: 'DNS · 메일 · 로그' },
    { id: 'sn-jeju-mgmt',cidr: '10.30.0.0/24',     name: '제주 관리망',        vlanId: 'vl-jeju-10', buildingId: 'b-jeju', customerId: 'org-infra',  purpose: 'mgmt', gateway: '10.30.0.1',     notes: '' },
    { id: 'sn-jeju-oob', cidr: '10.31.0.0/24',     name: '제주 OOB',           vlanId: 'vl-jeju-11', buildingId: 'b-jeju', customerId: 'org-infra',  purpose: 'oob',  gateway: '10.31.0.1',     notes: '' },
    { id: 'sn-dr',       cidr: '10.40.0.0/24',     name: 'DR 복제망',          vlanId: 'vl-jeju-900',buildingId: 'b-jeju', customerId: 'org-infra',  purpose: 'dr',   gateway: '10.40.0.1',     notes: '강남 ↔ 제주 스토리지 복제' }
  ];

  const ipAddresses = [];
  let ipSeq = 0;
  const cursor = {};          // 서브넷별 다음 할당 위치
  const addIp = (subnetId, address, rec) => {
    ipAddresses.push(Object.assign({ id: 'ip-' + (++ipSeq), address: address, subnetId: subnetId,
      deviceId: '', iface: '', type: 'primary', status: 'assigned', notes: '' }, rec));
  };
  const takeIp = (subnetId) => {
    const net = IP.parseCidr(subnets.find((s) => s.id === subnetId).cidr);
    // 큰 대역은 앞쪽 10개를 인프라용으로 비워 두고, 작은 대역은 게이트웨이 바로 뒤부터 사용
    if (cursor[subnetId] == null) cursor[subnetId] = net.first + (net.usable >= 30 ? 10 : 2);
    return IP.fromInt(cursor[subnetId]++);
  };

  // 게이트웨이는 예약 주소로 등록
  subnets.forEach((s) => addIp(s.id, s.gateway, { type: 'gateway', status: 'reserved', notes: '기본 게이트웨이' }));
  // 강남 관리망 DHCP 풀
  for (let i = 200; i <= 209; i++) addIp('sn-gn-mgmt', '10.10.0.' + i, { type: 'dhcp', status: 'dhcp', notes: 'DHCP 풀' });
  // 미래 증설용 예약
  addIp('sn-mir', '198.51.100.100', { type: 'primary', status: 'reserved', notes: '이벤트 증설 예약 (mggame07)' });
  addIp('sn-mir', '198.51.100.101', { type: 'primary', status: 'reserved', notes: '이벤트 증설 예약 (mggame08)' });

  const BLD = { 'rk-gna01': 'gn', 'rk-gna02': 'gn', 'rk-gna03': 'gn', 'rk-gnb01': 'gn', 'rk-gnb02': 'gn', 'rk-jj01': 'jj', 'rk-jj02': 'jj', 'rk-jeju01': 'jeju' };
  const SVC_BY_CUSTOMER = { 'org-next': 'sn-next', 'org-hanbit': 'sn-hanbit', 'org-sky': 'sn-sky', 'org-mir': 'sn-mir', 'org-core': 'sn-core' };
  const NET_ROLES = ['ro-switch', 'ro-fw', 'ro-lb', 'ro-power'];
  const BMC_MAKERS = ['org-dell', 'org-hpe', 'org-smc'];

  devices.forEach((d) => {
    if (d.status === 'stock') return;                       // 예비 장비는 IP 미할당
    const b = BLD[d.rackId];
    const hw = hardware.find((h) => h.id === d.hardwareId);
    if (NET_ROLES.includes(d.roleId) && d.customerId === 'org-infra') {
      addIp('sn-' + b + '-mgmt', takeIp('sn-' + b + '-mgmt'), { deviceId: d.id, iface: d.roleId === 'ro-power' ? 'nmc' : 'mgmt0', type: 'mgmt' });
      return;
    }
    const svc = SVC_BY_CUSTOMER[d.customerId] || (b === 'jeju' ? 'sn-dr' : 'sn-infra');
    if (d.name === 'skweb02') {
      // 데모: 현장에서 수기로 입력하다 생긴 IP 충돌
      addIp(svc, '203.0.113.75', { deviceId: d.id, iface: 'eth0', type: 'primary', notes: '실사 결과 skweb01과 중복 — 확인 필요' });
    } else if (d.status !== 'rma') {
      addIp(svc, takeIp(svc), { deviceId: d.id, iface: d.roleId === 'ro-lb' ? 'external' : 'eth0', type: 'primary' });
    }
    if (d.roleId === 'ro-lb') {
      addIp(svc, takeIp(svc), { deviceId: d.id, iface: 'vs-https', type: 'vip', notes: '서비스 VIP (443)' });
    }
    if (hw && BMC_MAKERS.includes(hw.manufacturerId) && d.name !== 'chweb01') {
      addIp('sn-' + b + '-oob', takeIp('sn-' + b + '-oob'), { deviceId: d.id, iface: 'bmc', type: 'ipmi' });
    }
  });

  /* --- 변경 이력 (활동 로그) -------------------------------------------- */
  const changeLog = devices
    .map((d) => ({ id: 'log-' + d.id, at: d.updatedAt, user: d.updatedBy, entity: 'device', entityId: d.id,
                   action: 'update', summary: d.name + ' 장비 정보 수정' }))
    .concat([
      { id: 'log-ip-1',  at: '2026-07-21 10:12', user: 'sypark', entity: 'ip', entityId: '', action: 'create', summary: '198.51.100.100–101 이벤트 증설용 예약' },
      { id: 'log-sn-1',  at: '2026-06-02 15:40', user: 'ryan',   entity: 'subnet', entityId: 'sn-core', action: 'create', summary: '203.0.113.96/29 코어헬스 서비스 서브넷 생성' },
      { id: 'log-dev-1', at: '2026-07-30 09:05', user: 'jhkim',  entity: 'device', entityId: byName['mon1'], action: 'update', summary: 'mon1 상태: 운영 → 점검 중' }
    ])
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  /* --- 시스템 정보 ------------------------------------------------------- */
  const system = {
    appVersion: '2.0.0',
    baseVersion: '1.2.5',
    build: 'prototype (static / localStorage)',
    dbEngine: '브라우저 localStorage (자동 저장)',
    dbSchema: '11',
    plugins: [
      { name: 'DNS', enabled: true,  notes: '장비 이름 + 도메인으로 조회 링크 제공' },
      { name: 'Excel Export', enabled: true, notes: '표 형태 화면을 CSV(UTF-8 BOM)로 내려받기' },
      { name: 'Dell Warranty', enabled: true, notes: '서비스 태그로 보증 정보 조회 링크' },
      { name: 'IPAM', enabled: true, notes: '서브넷 · VLAN · IP 주소 관리, 충돌/사용률 점검' },
      { name: 'Power', enabled: true, notes: '하드웨어 소비전력 기반 랙 전력 사용률 계산' },
      { name: 'Audit Log', enabled: true, notes: '추가·수정·삭제 변경 이력 기록' }
    ],
    licence: 'GNU General Public Licence v2 (원본 RackManager 기준)'
  };

  global.RM_DATA = {
    buildings, rooms, racks, hardware, operatingSystems, organisations,
    roles, serviceLevels, domains, devices, apps, appDevices,
    vlans, subnets, ipAddresses, changeLog, system
  };
})(window);
