# Ryan's Playground

진지함은 잠깐 내려두고 여기서 이것저것 실험하는 중.

설치나 빌드 없이 브라우저에서 바로 열리는 정적 페이지 모음이고, GitHub Pages로 배포됨.

## 구성

| 폴더 | 이름 | 설명 |
| --- | --- | --- |
| [toolbox/](https://flydjei.github.io/playground/toolbox/) | Toolbox | 서브넷 IP 계산기 · IP 추출기 · 특수문자표를 모은 작은 도구 모음 |
| [idc-atlas/](https://flydjei.github.io/playground/idc-atlas/) | IDC Atlas | IDC 랙 · IP · 장비 통합 관리 프로토타입 |

```
playground/
├─ README.md
├─ toolbox/
│  ├─ index.html                  도구 목록(홈)
│  ├─ ip-subnet-calculator.html   서브넷 IP 계산기
│  ├─ ip-extractor.html           IP 추출기
│  ├─ special-characters.html     특수문자표
│  ├─ favicon.svg
│  └─ assets/
│     ├─ toolbox.css              디자인 토큰 · 공통 컴포넌트
│     └─ toolbox.js               공통 동작
└─ idc-atlas/
   ├─ index.html
   ├─ favicon.svg
   └─ assets/
      ├─ style.css                디자인 토큰 · 컴포넌트
      ├─ app.js                   화면 · 라우팅 · 저장
      ├─ data.js                  샘플 데이터
      └─ ipam-core.js             IP 계산 로직
```

두 폴더는 서로의 파일을 참조하지 않는 별개의 유틸리티라서 각각 따로 수정·배포·이동할 수 있음. 색·글꼴 같은 디자인 값도 폴더마다 따로 정의하므로, 한쪽을 바꿔도 다른 쪽에는 영향이 없음.

## 로컬에서 열기

HTML 파일을 브라우저로 바로 열어도 동작함. 주소를 배포 환경과 같게 맞추려면 저장소 루트에서 정적 서버를 띄움.

```bash
python3 -m http.server 8000
```

이후 `http://localhost:8000/toolbox/` 또는 `http://localhost:8000/idc-atlas/` 로 접속.

## toolbox/ — Toolbox

자주 쓰는 작은 도구 모음. 모두 브라우저 안에서만 동작하며 입력한 내용은 어디에도 전송되지 않음.

- [서브넷 IP 계산기](https://flydjei.github.io/playground/toolbox/ip-subnet-calculator.html) — CIDR(`172.17.0.0/24`), 범위(`10.0.0.1-10.0.0.20`, `10.0.0.1-20`), 단일 IP를 개별 IP 목록으로 펼침. 중복 제거·정렬, 네트워크/브로드캐스트 주소 제외, 항목별 오류·보정 안내. 항목당 최대 65,536개, 전체 200,000개까지
- [IP 추출기](https://flydjei.github.io/playground/toolbox/ip-extractor.html) — 텍스트에 섞인 IPv4 주소만 골라냄. 기본은 입력과 같은 줄 번호를 유지해 스프레드시트 열에 그대로 붙여넣을 수 있고, "IP만 모아보기"에서는 한 줄의 여러 IP 추출·중복 제거·정렬 지원. CIDR 표기(`/24`) 유지 옵션
- [특수문자표](https://flydjei.github.io/playground/toolbox/special-characters.html) — Windows 한국어 입력기에서 한글 자음 + 한자 키로 입력하는 특수문자 전체 목록. 명칭·문자·코드(`U+2126`)로 검색, 클릭해서 복사, 방향키로 칸 이동

세 도구의 공통 동작

- 상단 메뉴로 도구 간 이동, 맨 앞의 "Toolbox"는 홈
- 복사·저장 결과는 화면 아래 알림(토스트)으로 표시
- 계산기·추출기: `Ctrl+Enter` 실행, 결과 복사·`.txt` 저장, 지우기 후 되돌리기, 입력이 바뀌면 "입력 변경됨" 표시
- 시스템 설정을 따르는 다크 모드, 모바일 대응

도구를 추가할 때는 `toolbox/`에 HTML을 만들어 `assets/toolbox.css`·`assets/toolbox.js`를 불러오고, `index.html`의 목록과 각 페이지 상단 메뉴(`.tool-nav`)에 링크를 추가함.

## idc-atlas/ — IDC Atlas

오픈소스 IDC 랙 관리 도구 RackManager 1.2.5의 기능을 옮긴 뒤 IP 주소 관리(IPAM)·장비 라이프사이클·전력·변경 이력까지 넓힌 프론트엔드 프로토타입.

데이터베이스 없이 브라우저에서 동작하며, 변경 내용은 localStorage에 자동 저장됨 (시스템 정보에서 JSON 백업·복원·초기화).

- **대시보드** — 장비·랙 공간·전력·IP 사용률 KPI, IP 충돌/전력 과부하/서브넷 포화/보증 만료/IPMI 누락 등 점검 항목, 최근 변경
- **IP 관리** — 서브넷(CIDR 정규화·대역 겹침 검사·게이트웨이 자동 예약), VLAN, IP 주소(할당/예약/DHCP, 유형·인터페이스), 서브넷별 IP 맵에서 빈 칸 클릭으로 할당, 다음 빈 IP 자동 계산, 중복 주소 충돌 탐지
- **장비** — 10가지 보기 형식(기본/네트워크·IP/운영·담당/자산/DNS/OS/지원/위치/앱/전체), 라이프사이클 상태(운영·구축 중·점검 중·RMA·폐기 예정·재고), 담당자, 다중 선택 일괄 작업(상태 변경·모니터링·삭제·CSV), 등록 시 IP 자동 할당, 삭제 시 IP 자동 해제
- **랙** — 공간 사용률 + 전력 사용률(하드웨어 소비전력 ÷ 랙 계약 용량), 여러 랙 선택 후 나란히 비교
- **랙 실장도** — 42U 엘리베이션 다이어그램, 빈 슬롯 클릭으로 장비 배치, U 겹침 검증, 랙별 전력 바
- **앱** — 서비스와 장비 연결/해제
- **리포트** — 랙 공간·전력, 분포 통계, 서브넷 사용률, IP 충돌, IP 등록 누락, 보증 만료, 중복 시리얼/자산번호/라이선스 키
- **활동 로그** — 모든 추가·수정·삭제를 '항목: 이전 → 이후' 형태로 기록, 장비 상세에 장비별 이력 표시
- **통합 검색** — 장비·IP·서브넷·랙·앱, 미등록 IP를 검색하면 소속 서브넷과 바로 할당 버튼 안내
- **설정** — 건물·전산실·도메인·하드웨어(크기·소비전력)·OS·조직·역할·서비스 수준 관리 (사용 중인 항목 삭제 방지)
- 다크 모드(상단 버튼으로 전환, 선택값 저장), 읽기 전용 모드, 인쇄용 CSS, 모바일 대응
- 샘플 데이터의 회사·고객사·도메인·주소·담당자는 모두 가상 (도메인은 RFC 2606 예약 TLD `.example`, IP는 사설/문서용 대역)

`style.css`·`data.js`·`app.js`·`ipam-core.js`를 수정하면 `index.html`의 `?v=` 값을 올려 브라우저 캐시를 갱신함.

---

made for fun · [github.com](https://github.com/)
