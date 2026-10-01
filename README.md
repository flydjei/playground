# Ryan's Playground

진지함은 잠깐 내려두고 여기서 이것저것 실험하는 중.

## playground/

- [ip-subnet-calculator.html](https://flydjei.github.io/playground/ip-subnet-calculator.html) — IP 서브넷 계산기
- [ip-extractor.html](https://flydjei.github.io/playground/ip-extractor.html) — IP 추출기
- [special-characters.html](https://flydjei.github.io/playground/special-characters.html) — 한글 자음 + 한자 특수문자표
- [idc-atlas/](https://flydjei.github.io/playground/idc-atlas/) — IDC Atlas: IDC 랙 · IP · 장비 통합 관리 프로토타입

### idc-atlas/ — IDC Atlas

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
- 다크 모드, 읽기 전용 모드, 인쇄용 CSS, 모바일 대응
- 샘플 데이터의 회사·고객사·도메인·주소·담당자는 모두 가상 (도메인은 RFC 2606 예약 TLD `.example`, IP는 사설/문서용 대역)

---

made for fun · [github.com](https://github.com/)
