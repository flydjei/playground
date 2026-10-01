/* ==========================================================================
   IDC Atlas — IPv4 주소 계산 유틸리티 (IPAM 코어)
   --------------------------------------------------------------------------
   DOM에 의존하지 않는 순수 함수만 모아 두었습니다. data.js(샘플 데이터 생성)와
   app.js(화면)에서 함께 사용하며, Node에서도 그대로 불러 테스트할 수 있습니다.
   모든 주소는 내부적으로 부호 없는 32비트 정수로 다룹니다.
   ========================================================================== */
(function (global) {
  'use strict';

  const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  /** '10.0.0.1' → 167772161, 형식이 틀리면 null */
  function toInt(ip) {
    const s = String(ip == null ? '' : ip).trim();
    if (!IPV4_RE.test(s)) return null;
    return s.split('.').reduce((acc, o) => ((acc << 8) + Number(o)) >>> 0, 0);
  }

  /** 167772161 → '10.0.0.1' */
  function fromInt(n) {
    n = n >>> 0;
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  const isValid = (ip) => toInt(ip) !== null;

  function maskOf(prefix) {
    return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  }

  /**
   * '10.0.0.5/24' → { cidr:'10.0.0.0/24', network, broadcast, prefix, size, first, last, usable, hostBitsSet }
   * first/last는 실제로 할당 가능한 범위입니다. (/31, /32는 RFC 3021 관례에 따라 전체 사용)
   * 형식이 틀리면 null.
   */
  function parseCidr(str) {
    const m = String(str == null ? '' : str).trim().match(/^([\d.]+)\/(\d{1,2})$/);
    if (!m) return null;
    const ip = toInt(m[1]);
    const prefix = Number(m[2]);
    if (ip === null || prefix > 32) return null;
    const mask = maskOf(prefix);
    const network = (ip & mask) >>> 0;
    const size = Math.pow(2, 32 - prefix);
    const broadcast = (network + size - 1) >>> 0;
    const pointToPoint = prefix >= 31;
    return {
      cidr: fromInt(network) + '/' + prefix,
      network: network,
      broadcast: broadcast,
      prefix: prefix,
      mask: fromInt(mask),
      size: size,
      first: pointToPoint ? network : network + 1,
      last: pointToPoint ? broadcast : broadcast - 1,
      usable: pointToPoint ? size : Math.max(0, size - 2),
      hostBitsSet: network !== ip
    };
  }

  function contains(net, ipInt) {
    return ipInt !== null && ipInt >= net.network && ipInt <= net.broadcast;
  }

  function overlaps(a, b) {
    return a.network <= b.broadcast && b.network <= a.broadcast;
  }

  /** 네트워크/브로드캐스트 주소처럼 호스트에 줄 수 없는 주소인지 */
  function isReserved(net, ipInt) {
    if (net.prefix >= 31) return false;
    return ipInt === net.network || ipInt === net.broadcast;
  }

  /** used(Set<int>)를 피해 first부터 순서대로 비어 있는 첫 주소를 반환 (없으면 null) */
  function nextFree(net, used) {
    for (let n = net.first; n <= net.last; n++) {
      if (!used.has(n >>> 0)) return n >>> 0;
    }
    return null;
  }

  /** 정렬용 비교 함수 */
  function compare(a, b) {
    const x = toInt(a), y = toInt(b);
    if (x === null || y === null) return String(a).localeCompare(String(b));
    return x - y;
  }

  global.ATLAS_IP = { toInt, fromInt, isValid, parseCidr, contains, overlaps, isReserved, nextFree, compare, maskOf };
})(typeof window !== 'undefined' ? window : globalThis);
