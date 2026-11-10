// 도구 페이지(서브넷 IP 계산기 · IP 추출기 · 특수문자표)가 함께 쓰는 동작
// 숫자 표기, 클립보드 복사, 토스트 알림, 버튼 피드백, 텍스트 파일 저장

// 세로 배치(모바일)로 바뀌는 기준. tools.css 의 미디어 쿼리와 같은 값이어야 한다.
const MOBILE_QUERY = '(max-width: 720px)';

function fmt(n) { return n.toLocaleString(); }

// 복사에 성공하면 true
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // 권한 거부 등으로 실패하면 아래 방식으로 다시 시도
    }
  }
  const active = document.activeElement;
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.readOnly = true;
  temp.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(temp);
  temp.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  }
  temp.remove();
  if (active && active.focus) active.focus({ preventScroll: true });
  return ok;
}

// 방금 한 동작(복사 · 저장)의 결과를 화면 아래에 잠깐 띄움
// 스크린 리더가 읽을 수 있도록 알림 영역은 내용이 들어오기 전에 미리 만들어 둔다.
const toastEl = document.createElement('div');
toastEl.id = 'toast';
toastEl.setAttribute('role', 'status');
toastEl.setAttribute('aria-live', 'polite');
document.body.appendChild(toastEl);

let toastTimer;
function showToast(message, isError = false) {
  toastEl.classList.toggle('error', isError);
  // 같은 문구가 이어져도 스크린 리더가 다시 읽도록 비웠다가 채움
  toastEl.textContent = '';
  requestAnimationFrame(() => {
    toastEl.textContent = message;
    toastEl.classList.add('show');
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), isError ? 4000 : 1500);
}

// 버튼 글자와 색을 잠깐 바꿔 결과를 표시 (className: 'copied' 성공, 'failed' 실패)
function flash(btn, text, className = 'copied') {
  const original = btn.dataset.label || btn.textContent;
  btn.dataset.label = original;
  btn.textContent = text;
  btn.classList.remove('copied', 'failed');
  btn.classList.add(className);
  clearTimeout(btn._timer);
  btn._timer = setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove(className);
  }, 1200);
}

// 결과 복사 버튼 공통 처리: 버튼 피드백 + 토스트. label 은 "IP 254개" 처럼 복사한 내용을 가리키는 말
async function copyWithFeedback(btn, text, label) {
  if (await copyText(text)) {
    flash(btn, '복사됨!');
    showToast(`복사됨: ${label}`);
  } else {
    flash(btn, '복사 실패', 'failed');
    showToast('클립보드에 복사하지 못했습니다. 결과를 직접 선택해 복사하거나 ".txt 저장"을 이용하세요.', true);
  }
}

// 결과 저장 버튼 공통 처리
function downloadWithFeedback(btn, text, filename) {
  const blob = new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash(btn, '저장됨!');
  showToast(`저장됨: ${filename}`);
}
