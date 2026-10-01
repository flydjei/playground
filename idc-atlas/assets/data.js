/* ==========================================================================
   IDC Atlas prototype — in-memory sample dataset
   --------------------------------------------------------------------------
   회사·고객사·도메인·주소·담당자 이름은 모두 가상입니다. 도메인은 실제로 등록될 수
   없는 RFC 2606 예약 TLD(.example)를, IP 대역은 사설/문서용 대역만 사용합니다.
   (하드웨어·OS 제조사와 모델명은 관리 대상 제품 카탈로그이므로 실제 이름을 사용)
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
    { id: 'org-umb',      name: '파란우산상점',           customer: true,  hardware: false, software: false, notes: '이커머스 플랫폼 · 계약 2023-03 ~' },
    { id: 'org-milky',    name: '은하수금융',               customer: true,  hardware: false, software: false, notes: '금융권 · 망분리 요건 적용' },
    { id: 'org-paper',       name: '종이배물류',           customer: true,  hardware: false, software: false, notes: '물류 트래킹 서비스' },
    { id: 'org-cloud',       name: '구름다리게임즈',             customer: true,  hardware: false, software: false, notes: '게임 서비스 · 트래픽 변동 큼' },
    { id: 'org-dande',      name: '민들레헬스',               customer: true,  hardware: false, software: false, notes: '헬스케어 SaaS' },
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
    { id: 'b-al',   name: 'IDC 알파 센터', notes: '가상시 알파구 예시로 101 (가상 주소)' },
    { id: 'b-be',   name: 'IDC 베타 센터', notes: '가상시 베타구 샘플길 202 (가상 주소)' },
    { id: 'b-ga', name: 'IDC 감마 센터', notes: '가상시 감마구 테스트로 303 (가상 주소)' }
  ];

  const rooms = [
    { id: 'rm-al-a',   buildingId: 'b-al',   name: '1F 서버룸 A',   notes: '항온항습 2계통 · UPS 이중화' },
    { id: 'rm-al-b',   buildingId: 'b-al',   name: '1F 서버룸 B',   notes: '고밀도 존 (랙당 12kW)' },
    { id: 'rm-be-2f',  buildingId: 'b-be',   name: '2F 코로케이션', notes: '' },
    { id: 'rm-ga-1f',buildingId: 'b-ga', name: '1F 클라우드존', notes: '재해복구(DR) 용도' }
  ];

  const racks = [
    { id: 'rk-ala01', roomId: 'rm-al-a',    name: 'AL-A-01', row: 'A열', sizeU: 42, notes: '파란우산상점 전용' },
    { id: 'rk-ala02', roomId: 'rm-al-a',    name: 'AL-A-02', row: 'A열', sizeU: 42, notes: '은하수금융 전용 · 잠금 랙' },
    { id: 'rk-ala03', roomId: 'rm-al-a',    name: 'AL-A-03', row: 'B열', sizeU: 42, notes: '' },
    { id: 'rk-alb01', roomId: 'rm-al-b',    name: 'AL-B-01', row: 'A열', sizeU: 42, notes: '고밀도 · 후면 냉각 도어' },
    { id: 'rk-alb02', roomId: 'rm-al-b',    name: 'AL-B-02', row: 'A열', sizeU: 42, notes: '증설 여유 많음' },
    { id: 'rk-be01',  roomId: 'rm-be-2f',   name: 'BE-2F-01',row: 'C열', sizeU: 42, notes: '사내 공용 인프라' },
    { id: 'rk-be02',  roomId: 'rm-be-2f',   name: 'BE-2F-02',row: 'C열', sizeU: 42, notes: '예비 랙' },
    { id: 'rk-ga01',roomId: 'rm-ga-1f', name: 'GA-C-01',row: 'A열',sizeU: 42, notes: 'DR 사이트' }
  ];

  // 랙별 전력 계약 용량(kW) — 고밀도 존(AL-B)은 12kW
  const RACK_POWER = { 'rk-ala01': 8, 'rk-ala02': 8, 'rk-ala03': 6, 'rk-alb01': 12, 'rk-alb02': 12, 'rk-be01': 6, 'rk-be02': 4, 'rk-ga01': 6 };
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
    { id: 'dm-infra',  name: 'infra.example',    notes: '사내 인프라 기본 도메인' },
    { id: 'dm-umb',   name: 'blueumbrella.example',notes: '' },
    { id: 'dm-milky', name: 'milkyway-fin.example', notes: '' },
    { id: 'dm-paper',    name: 'paperboat.example',   notes: '' },
    { id: 'dm-cloud',    name: 'cloudbridge.example',    notes: '' },
    { id: 'dm-dande',   name: 'dandelion.example',  notes: '' }
  ];

  /* --- 장비 ------------------------------------------------------------- */
  // [name, domainId, rackId, rackPos, hardwareId, osId, customerId, roleId, serviceLevelId, extra]
  const DEV = [
    // ---- AL-A-01 : 파란우산상점
    ['sw-ala-01',  'dm-infra', 'rk-ala01', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['sw-ala-02',  'dm-infra', 'rk-ala01', 41, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['lb-ala-01',  'dm-infra', 'rk-ala01', 39, 'hw-bigip',   'os-tmos',   'org-infra', 'ro-lb',     'sl-gold'],
    ['web01',      'dm-umb',  'rk-ala01', 37, 'hw-r740',    'os-u2204',  'org-umb',  'ro-web',    'sl-gold'],
    ['web02',      'dm-umb',  'rk-ala01', 35, 'hw-r740',    'os-u2204',  'org-umb',  'ro-web',    'sl-gold'],
    ['web03',      'dm-umb',  'rk-ala01', 33, 'hw-r740',    'os-u2204',  'org-umb',  'ro-web',    'sl-gold'],
    ['pudb01',     'dm-umb',  'rk-ala01', 31, 'hw-r750',    'os-rocky9', 'org-umb',  'ro-db',     'sl-gold',   { serial: 'SN-DUP-4471', notes: '마스터 · 동기 복제' }],
    ['pudb02',     'dm-umb',  'rk-ala01', 29, 'hw-r750',    'os-rocky9', 'org-umb',  'ro-db',     'sl-gold',   { serial: 'SN-DUP-4471', notes: '스탠바이 — 시리얼 중복 입력 의심' }],
    ['pubatch01',  'dm-umb',  'rk-ala01', 25, 'hw-r940',    'os-u2204',  'org-umb',  'ro-batch',  'sl-silver'],
    ['punas01',    'dm-umb',  'rk-ala01', 23, 'hw-fas2750', 'os-ontap',  'org-umb',  'ro-storage','sl-gold'],
    ['ups-ala-01', 'dm-infra', 'rk-ala01',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver', { monitored: true }],

    // ---- AL-A-02 : 은하수금융
    ['sw-ala-03',  'dm-infra', 'rk-ala02', 42, 'hw-n9336',   'os-nxos',   'org-infra', 'ro-switch', 'sl-gold'],
    ['fw-ala-01',  'dm-infra', 'rk-ala02', 40, 'hw-fg600f',  'os-fortios','org-infra', 'ro-fw',     'sl-gold'],
    ['msvh01',     'dm-milky','rk-ala02', 37, 'hw-dl380',   'os-esxi8',  'org-milky','ro-vhost',  'sl-gold'],
    ['msvh02',     'dm-milky','rk-ala02', 35, 'hw-dl380',   'os-esxi8',  'org-milky','ro-vhost',  'sl-gold'],
    ['msvh03',     'dm-milky','rk-ala02', 33, 'hw-dl380',   'os-esxi8',  'org-milky','ro-vhost',  'sl-gold'],
    ['msvh04',     'dm-milky','rk-ala02', 31, 'hw-dl380',   'os-esxi8',  'org-milky','ro-vhost',  'sl-gold'],
    ['msdb01',     'dm-milky','rk-ala02', 28, 'hw-r750',    'os-ws2022', 'org-milky','ro-db',     'sl-gold',   { licence: 'WS22-4KX9-QM71-BB30' }],
    ['msdb02',     'dm-milky','rk-ala02', 26, 'hw-r750',    'os-ws2022', 'org-milky','ro-db',     'sl-gold',   { licence: 'WS22-4KX9-QM71-BB30', notes: '라이선스 키 중복 — 확인 필요' }],
    ['msbkp01',    'dm-milky','rk-ala02', 24, 'hw-rs3621',  'os-dsm',    'org-milky','ro-backup', 'sl-silver'],
    ['ups-ala-02', 'dm-infra', 'rk-ala02',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- AL-A-03 : 종이배물류
    ['sw-ala-04',  'dm-infra', 'rk-ala03', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['pbweb01',    'dm-paper',   'rk-ala03', 40, 'hw-r640',    'os-u2004',  'org-paper',   'ro-web',    'sl-silver', { asset: 'AST-2024-0311' }],
    ['pbweb02',    'dm-paper',   'rk-ala03', 39, 'hw-r640',    'os-u2004',  'org-paper',   'ro-web',    'sl-silver', { asset: 'AST-2024-0311', notes: '자산번호 중복 — 실사 필요' }],
    ['pbapp01',    'dm-paper',   'rk-ala03', 37, 'hw-dl380',   'os-u2204',  'org-paper',   'ro-was',    'sl-silver'],
    ['pbdb01',     'dm-paper',   'rk-ala03', 35, 'hw-r750',    'os-rocky9', 'org-paper',   'ro-db',     'sl-gold'],
    ['pbtrk01',    'dm-paper',   'rk-ala03', 33, 'hw-r640',    'os-c7',     'org-paper',   'ro-batch',  'sl-bronze', { notes: 'CentOS 7 EOL — 교체 계획 수립 중' }],
    ['pbtrk02',    'dm-paper',   'rk-ala03', 32, 'hw-r640',    'os-c7',     'org-paper',   'ro-batch',  'sl-bronze', { status: 'rma', monitored: false, notes: 'RMA 진행 중 (메인보드 교체)' }],
    ['ups-ala-03', 'dm-infra', 'rk-ala03',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- AL-B-01 : 구름다리게임즈
    ['sw-alb-01',  'dm-infra', 'rk-alb01', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-gold'],
    ['cblb01',     'dm-cloud',   'rk-alb01', 40, 'hw-bigip',   'os-tmos',   'org-cloud',   'ro-lb',     'sl-gold'],
    ['cbgame01',   'dm-cloud',   'rk-alb01', 38, 'hw-r640',    'os-u2204',  'org-cloud',   'ro-was',    'sl-gold'],
    ['cbgame02',   'dm-cloud',   'rk-alb01', 37, 'hw-r640',    'os-u2204',  'org-cloud',   'ro-was',    'sl-gold'],
    ['cbgame03',   'dm-cloud',   'rk-alb01', 36, 'hw-r640',    'os-u2204',  'org-cloud',   'ro-was',    'sl-gold'],
    ['cbgame04',   'dm-cloud',   'rk-alb01', 35, 'hw-r640',    'os-u2204',  'org-cloud',   'ro-was',    'sl-gold'],
    ['cbgame05',   'dm-cloud',   'rk-alb01', 34, 'hw-r640',    'os-u2204',  'org-cloud',   'ro-was',    'sl-gold'],
    ['cbgame06',   'dm-cloud',   'rk-alb01', 33, 'hw-r640',    'os-u2204',  'org-cloud',   'ro-was',    'sl-gold'],
    ['cbdb01',     'dm-cloud',   'rk-alb01', 30, 'hw-r750',    'os-rocky9', 'org-cloud',   'ro-db',     'sl-gold'],
    ['cbdb02',     'dm-cloud',   'rk-alb01', 28, 'hw-r750',    'os-rocky9', 'org-cloud',   'ro-db',     'sl-gold'],
    ['cbcache01',  'dm-cloud',   'rk-alb01', 26, 'hw-r640',    'os-u2204',  'org-cloud',   'ro-cache',  'sl-silver'],
    ['ups-alb-01', 'dm-infra', 'rk-alb01',  1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- AL-B-02 : 민들레헬스 (여유 많음)
    ['sw-alb-02',  'dm-infra', 'rk-alb02', 42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-silver'],
    ['ddweb01',    'dm-dande',  'rk-alb02', 40, 'hw-r640',    'os-ws2019', 'org-dande',  'ro-web',    'sl-silver'],
    ['dddb01',     'dm-dande',  'rk-alb02', 38, 'hw-r750',    'os-ws2022', 'org-dande',  'ro-db',     'sl-gold'],
    ['ddnas01',    'dm-dande',  'rk-alb02', 36, 'hw-rs3621',  'os-dsm',    'org-dande',  'ro-storage','sl-silver', { status: 'staging', notes: '증설 구축 중 — 2026-10 오픈 예정' }],

    // ---- BE-2F-01 : 사내 인프라
    ['sw-be-01',   'dm-infra', 'rk-be01',  42, 'hw-n9336',   'os-nxos',   'org-infra', 'ro-switch', 'sl-gold'],
    ['sw-be-02',   'dm-infra', 'rk-be01',  41, 'hw-ex4300',  'os-junos',  'org-infra', 'ro-switch', 'sl-gold'],
    ['mon1',       'dm-infra', 'rk-be01',  39, 'hw-r640',    'os-u2204',  'org-infra', 'ro-mon',    'sl-silver', { status: 'maintenance', notes: '2026-07-30 하드웨어 점검을 위해 서비스 중지' }],
    ['logcol01',   'dm-infra', 'rk-be01',  37, 'hw-dl380',   'os-u2204',  'org-infra', 'ro-log',    'sl-gold'],
    ['dns01',      'dm-infra', 'rk-be01',  36, 'hw-r640',    'os-u2204',  'org-infra', 'ro-dns',    'sl-gold'],
    ['dns02',      'dm-infra', 'rk-be01',  35, 'hw-r640',    'os-u2204',  'org-infra', 'ro-dns',    'sl-gold'],
    ['mail01',     'dm-infra', 'rk-be01',  33, 'hw-dl380',   'os-u2204',  'org-infra', 'ro-mail',   'sl-silver'],
    ['gw-be-01',   'dm-infra', 'rk-be01',  31, 'hw-fg600f',  'os-fortios','org-infra', 'ro-fw',     'sl-gold'],
    ['ups-be-01',  'dm-infra', 'rk-be01',   1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver'],

    // ---- BE-2F-02 : 예비
    ['sw-be-03',   'dm-infra', 'rk-be02',  42, 'hw-c9300',   'os-iosxe',  'org-infra', 'ro-switch', 'sl-bronze'],
    ['spare-01',   'dm-none',  'rk-be02',  40, 'hw-r740',    'os-none',   'org-infra', 'ro-spare',  'sl-dev',    { status: 'stock', monitored: false, notes: '미배정 예비 장비' }],

    // ---- GA-C-01 : DR
    ['sw-ga-01', 'dm-infra', 'rk-ga01',42, 'hw-n9336',   'os-nxos',   'org-infra', 'ro-switch', 'sl-gold'],
    ['esx-ga01', 'dm-infra', 'rk-ga01',39, 'hw-dl380',   'os-esxi8',  'org-infra', 'ro-vhost',  'sl-gold'],
    ['esx-ga02', 'dm-infra', 'rk-ga01',37, 'hw-dl380',   'os-esxi8',  'org-infra', 'ro-vhost',  'sl-gold'],
    ['stor-ga01','dm-infra', 'rk-ga01',34, 'hw-fas2750', 'os-ontap',  'org-infra', 'ro-storage','sl-gold'],
    ['ups-ga-01','dm-infra', 'rk-ga01', 1, 'hw-srt5k',   'os-none',   'org-infra', 'ro-power',  'sl-silver']
  ];

  const EDITORS = ['atlas-admin', 'oper01', 'oper02', 'neteng01', 'asset01'];
  // 고객사별 기본 담당 엔지니어
  const OWNERS = { 'org-umb': '커머스운영팀', 'org-milky': '금융·헬스운영팀', 'org-paper': '물류운영팀', 'org-cloud': '게임운영팀', 'org-dande': '금융·헬스운영팀', 'org-infra': '인프라운영팀' };
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
      createdBy: 'atlas-admin'
    };
  });

  /* --- 앱 및 장비-앱 연결 ------------------------------------------------ */
  const apps = [
    { id: 'app-member',  name: '통합회원 API',    notes: 'OAuth2 인증 · 전사 공통' },
    { id: 'app-shop',    name: '쇼핑몰 프론트',   notes: '파란우산상점 메인 서비스' },
    { id: 'app-pay',     name: '결제 게이트웨이', notes: 'PG 연동 · PCI-DSS 범위' },
    { id: 'app-track',   name: '배송 추적',       notes: '' },
    { id: 'app-group',   name: '사내 그룹웨어',   notes: '' },
    { id: 'app-log',     name: '중앙 로그 수집',  notes: 'OpenSearch 기반' },
    { id: 'app-back',    name: '백오피스',        notes: '' },
    { id: 'app-match',   name: '게임 매치메이킹', notes: '구름다리게임즈 전용' }
  ];

  const byName = {};
  devices.forEach((d) => { byName[d.name] = d.id; });
  const link = (appId, names) => names.map((n) => ({ appId: appId, deviceId: byName[n] }));

  const appDevices = [].concat(
    link('app-shop',   ['web01', 'web02', 'web03']),
    link('app-member', ['web01', 'web02', 'pbapp01', 'ddweb01']),
    link('app-pay',    ['web03', 'pudb01', 'msdb01']),
    link('app-track',  ['pbapp01', 'pbtrk01', 'pbtrk02', 'pbdb01']),
    link('app-group',  ['mail01', 'logcol01']),
    link('app-log',    ['logcol01', 'mon1']),
    link('app-back',   ['ddweb01', 'dddb01', 'msvh01']),
    link('app-match',  ['cbgame01', 'cbgame02', 'cbgame03', 'cbgame04', 'cbgame05', 'cbgame06', 'cbcache01'])
  ).filter((l) => l.deviceId);


  /* --- IPAM: VLAN / 서브넷 / IP 주소 ------------------------------------- */
  const IP = global.ATLAS_IP;

  const vlans = [
    { id: 'vl-al-10',   vid: 10,  name: 'AL-MGMT',        buildingId: 'b-al',   notes: '알파 장비 관리망' },
    { id: 'vl-al-11',   vid: 11,  name: 'AL-OOB',         buildingId: 'b-al',   notes: '알파 IPMI/iDRAC/iLO 대역' },
    { id: 'vl-al-101',  vid: 101, name: 'UMB-SVC',       buildingId: 'b-al',   notes: '파란우산상점 서비스망' },
    { id: 'vl-al-201',  vid: 201, name: 'MILKY-PRIV',    buildingId: 'b-al',   notes: '은하수금융 내부망 (망분리)' },
    { id: 'vl-al-301',  vid: 301, name: 'PAPER-SVC',        buildingId: 'b-al',   notes: '' },
    { id: 'vl-al-401',  vid: 401, name: 'CLOUD-SVC',        buildingId: 'b-al',   notes: '' },
    { id: 'vl-al-501',  vid: 501, name: 'DANDE-SVC',       buildingId: 'b-al',   notes: '' },
    { id: 'vl-be-10',   vid: 10,  name: 'BE-MGMT',        buildingId: 'b-be',   notes: '' },
    { id: 'vl-be-11',   vid: 11,  name: 'BE-OOB',         buildingId: 'b-be',   notes: '' },
    { id: 'vl-be-100',  vid: 100, name: 'INFRA-SVC',      buildingId: 'b-be',   notes: '사내 공용 서비스' },
    { id: 'vl-ga-10', vid: 10,  name: 'GA-MGMT',      buildingId: 'b-ga', notes: '' },
    { id: 'vl-ga-11', vid: 11,  name: 'GA-OOB',       buildingId: 'b-ga', notes: '' },
    { id: 'vl-ga-900',vid: 900, name: 'DR-REPL',        buildingId: 'b-ga', notes: 'DR 복제 전용' }
  ];

  // purpose: svc(서비스) · mgmt(관리) · oob(IPMI/OOB) · dr(DR/복제)
  const subnets = [
    { id: 'sn-al-mgmt',  cidr: '10.10.0.0/24',     name: '알파 관리망',        vlanId: 'vl-al-10',   buildingId: 'b-al',   customerId: 'org-infra',  purpose: 'mgmt', gateway: '10.10.0.1',     notes: '.200–.209 DHCP 풀 (작업용 노트북)' },
    { id: 'sn-al-oob',   cidr: '10.11.0.0/24',     name: '알파 OOB',           vlanId: 'vl-al-11',   buildingId: 'b-al',   customerId: 'org-infra',  purpose: 'oob',  gateway: '10.11.0.1',     notes: '' },
    { id: 'sn-umb',     cidr: '203.0.113.0/26',   name: '파란우산상점 서비스', vlanId: 'vl-al-101',  buildingId: 'b-al',   customerId: 'org-umb',   purpose: 'svc',  gateway: '203.0.113.1',   notes: '공인 /26 · VIP 포함' },
    { id: 'sn-milky',   cidr: '172.16.10.0/24',   name: '은하수금융 내부망',     vlanId: 'vl-al-201',  buildingId: 'b-al',   customerId: 'org-milky', purpose: 'svc',  gateway: '172.16.10.1',   notes: '외부 라우팅 없음' },
    { id: 'sn-paper',      cidr: '203.0.113.64/27',  name: '종이배물류 서비스', vlanId: 'vl-al-301',  buildingId: 'b-al',   customerId: 'org-paper',    purpose: 'svc',  gateway: '203.0.113.65',  notes: '' },
    { id: 'sn-cloud',      cidr: '198.51.100.0/25',  name: '구름다리게임즈 서비스',   vlanId: 'vl-al-401',  buildingId: 'b-al',   customerId: 'org-cloud',    purpose: 'svc',  gateway: '198.51.100.1',  notes: '이벤트 기간 증설 대비 여유 확보' },
    { id: 'sn-dande',     cidr: '203.0.113.96/29',  name: '민들레헬스 서비스',     vlanId: 'vl-al-501',  buildingId: 'b-al',   customerId: 'org-dande',   purpose: 'svc',  gateway: '203.0.113.97',  notes: '/29 — 증설 시 재할당 필요' },
    { id: 'sn-be-mgmt',  cidr: '10.20.0.0/24',     name: '베타 관리망',        vlanId: 'vl-be-10',   buildingId: 'b-be',   customerId: 'org-infra',  purpose: 'mgmt', gateway: '10.20.0.1',     notes: '' },
    { id: 'sn-be-oob',   cidr: '10.21.0.0/24',     name: '베타 OOB',           vlanId: 'vl-be-11',   buildingId: 'b-be',   customerId: 'org-infra',  purpose: 'oob',  gateway: '10.21.0.1',     notes: '' },
    { id: 'sn-infra',    cidr: '192.0.2.0/26',     name: '사내 공용 서비스',    vlanId: 'vl-be-100',  buildingId: 'b-be',   customerId: 'org-infra',  purpose: 'svc',  gateway: '192.0.2.1',     notes: 'DNS · 메일 · 로그' },
    { id: 'sn-ga-mgmt',cidr: '10.30.0.0/24',     name: '감마 관리망',        vlanId: 'vl-ga-10', buildingId: 'b-ga', customerId: 'org-infra',  purpose: 'mgmt', gateway: '10.30.0.1',     notes: '' },
    { id: 'sn-ga-oob', cidr: '10.31.0.0/24',     name: '감마 OOB',           vlanId: 'vl-ga-11', buildingId: 'b-ga', customerId: 'org-infra',  purpose: 'oob',  gateway: '10.31.0.1',     notes: '' },
    { id: 'sn-dr',       cidr: '10.40.0.0/24',     name: 'DR 복제망',          vlanId: 'vl-ga-900',buildingId: 'b-ga', customerId: 'org-infra',  purpose: 'dr',   gateway: '10.40.0.1',     notes: '알파 ↔ 감마 스토리지 복제' }
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
  // 알파 관리망 DHCP 풀
  for (let i = 200; i <= 209; i++) addIp('sn-al-mgmt', '10.10.0.' + i, { type: 'dhcp', status: 'dhcp', notes: 'DHCP 풀' });
  // 미래 증설용 예약
  addIp('sn-cloud', '198.51.100.100', { type: 'primary', status: 'reserved', notes: '이벤트 증설 예약 (cbgame07)' });
  addIp('sn-cloud', '198.51.100.101', { type: 'primary', status: 'reserved', notes: '이벤트 증설 예약 (cbgame08)' });

  const BLD = { 'rk-ala01': 'al', 'rk-ala02': 'al', 'rk-ala03': 'al', 'rk-alb01': 'al', 'rk-alb02': 'al', 'rk-be01': 'be', 'rk-be02': 'be', 'rk-ga01': 'ga' };
  const SVC_BY_CUSTOMER = { 'org-umb': 'sn-umb', 'org-milky': 'sn-milky', 'org-paper': 'sn-paper', 'org-cloud': 'sn-cloud', 'org-dande': 'sn-dande' };
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
    const svc = SVC_BY_CUSTOMER[d.customerId] || (b === 'ga' ? 'sn-dr' : 'sn-infra');
    if (d.name === 'pbweb02') {
      // 데모: 현장에서 수기로 입력하다 생긴 IP 충돌
      addIp(svc, '203.0.113.75', { deviceId: d.id, iface: 'eth0', type: 'primary', notes: '실사 결과 pbweb01과 중복 — 확인 필요' });
    } else if (d.status !== 'rma') {
      addIp(svc, takeIp(svc), { deviceId: d.id, iface: d.roleId === 'ro-lb' ? 'external' : 'eth0', type: 'primary' });
    }
    if (d.roleId === 'ro-lb') {
      addIp(svc, takeIp(svc), { deviceId: d.id, iface: 'vs-https', type: 'vip', notes: '서비스 VIP (443)' });
    }
    if (hw && BMC_MAKERS.includes(hw.manufacturerId) && d.name !== 'ddweb01') {
      addIp('sn-' + b + '-oob', takeIp('sn-' + b + '-oob'), { deviceId: d.id, iface: 'bmc', type: 'ipmi' });
    }
  });

  /* --- 변경 이력 (활동 로그) -------------------------------------------- */
  const changeLog = devices
    .map((d) => ({ id: 'log-' + d.id, at: d.updatedAt, user: d.updatedBy, entity: 'device', entityId: d.id,
                   action: 'update', summary: d.name + ' 장비 정보 수정' }))
    .concat([
      { id: 'log-seed-2',  at: '2026-07-21 10:12', user: 'oper01', entity: 'ip', entityId: '', action: 'create', summary: '198.51.100.100–101 이벤트 증설용 예약' },
      { id: 'log-seed-3',  at: '2026-06-02 15:40', user: 'neteng01', entity: 'subnet', entityId: 'sn-dande', action: 'create', summary: '203.0.113.96/29 민들레헬스 서비스 서브넷 생성' },
      { id: 'log-seed-1', at: '2026-07-30 09:05', user: 'oper02',  entity: 'device', entityId: byName['mon1'], action: 'update', summary: 'mon1 상태: 운영 → 점검 중' }
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

  global.ATLAS_DATA = {
    buildings, rooms, racks, hardware, operatingSystems, organisations,
    roles, serviceLevels, domains, devices, apps, appDevices,
    vlans, subnets, ipAddresses, changeLog, system
  };
})(window);
