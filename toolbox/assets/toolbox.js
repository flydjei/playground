// Toolbox — 서브넷 IP 계산기 · IP 추출기 · 특수문자표가 함께 쓰는 동작
// 숫자 표기, 클립보드 복사, 토스트 알림, 버튼 피드백, 텍스트 파일 저장,
// 입력 → 결과 도구의 공통 흐름(실행 · 지우기/되돌리기 · 결과 최신 여부 · 단축키)

// 세로 배치(모바일)로 바뀌는 기준. toolbox.css 의 미디어 쿼리와 같은 값이어야 한다.
const MOBILE_QUERY = '(max-width: 720px)';

function fmt(n) { return n.toLocaleString(); }

// "동작 줄이기" 설정이면 부드러운 스크롤 대신 바로 이동
function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

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
  temp.setSelectionRange(0, text.length); // iOS Safari 는 select() 만으로 선택되지 않음
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
let lastToast = '';
function showToast(message, isError = false) {
  // VoiceOver 는 직전과 같은 문구를 (비웠다 채워도) 다시 읽지 않으므로,
  // 같은 문구가 이어지면 읽히지 않는 줄바꿈 없는 공백을 붙여 다른 문구로 만든다.
  if (message === lastToast) message += ' ';
  lastToast = message;
  toastEl.classList.toggle('error', isError);
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

// 입력 → 결과 도구(계산기 · 추출기)의 공통 흐름
//  - 실행: 버튼, Ctrl/⌘+Enter (입력창 밖에 포커스가 있어도 동작)
//  - 실행 후 입력이 바뀌면 결과를 흐리게 + "다시 실행 필요" 표시 (원래 입력으로 되돌리면 해제)
//  - 지우기 → 되돌리기 (입력하면 되돌리기는 사라짐)
//  - 결과 복사 · .txt 저장
//
// 옵션(o)
//   input, output, status, staleHint, runBtn, clearBtn, copyBtn, downloadBtn: 화면 요소
//   compute():      결과를 계산해 화면에 반영하고, 모바일에서 스크롤할 요소(없으면 null)를 반환
//   reset():        결과 · 안내를 모두 비움
//   updateCount():  입력 개수 표시 갱신 (입력할 때마다 프레임당 한 번만 호출됨)
//   copyLabel():    복사 알림에 쓸 말 ("IP 254개")
//   filename:       .txt 저장 파일 이름
function createRunner(o) {
  let lastRunInput = null; // 마지막으로 실행한 입력값 (실행 전에는 null)
  let undoSnapshot = null; // "지우기" 직전 상태 (되돌리기용)
  const clearLabel = o.clearBtn.textContent;

  function updateStale() {
    const stale = lastRunInput !== null && o.input.value !== lastRunInput;
    o.staleHint.hidden = !stale;
    o.output.classList.toggle('stale', stale);
  }

  function setUndo(snapshot) {
    undoSnapshot = snapshot;
    o.clearBtn.textContent = snapshot ? '되돌리기' : clearLabel;
  }

  function run({ scroll = true } = {}) {
    const target = o.compute();
    lastRunInput = o.input.value;
    updateStale();
    // 모바일(세로 배치)에서는 결과 영역이 화면 아래에 있으므로 자동으로 스크롤
    if (scroll && target && window.matchMedia(MOBILE_QUERY).matches) {
      target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  }

  // 붙여넣은 내용이 크면 개수 세기도 무거우므로 한 프레임에 한 번만 센다
  let countQueued = false;
  function queueCount() {
    if (countQueued) return;
    countQueued = true;
    requestAnimationFrame(() => {
      countQueued = false;
      o.updateCount();
    });
  }

  o.runBtn.addEventListener('click', () => run());

  o.input.addEventListener('input', () => {
    queueCount();
    updateStale();
    if (undoSnapshot) setUndo(null);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault();
      run();
    }
  });

  o.clearBtn.addEventListener('click', () => {
    if (undoSnapshot) {
      const { text, hadResult } = undoSnapshot;
      setUndo(null);
      o.input.value = text;
      o.updateCount();
      if (hadResult) run({ scroll: false });
      else o.status.textContent = '';
      o.input.focus();
      return;
    }
    const snapshot = { text: o.input.value, hadResult: lastRunInput !== null };
    o.input.value = '';
    lastRunInput = null;
    o.reset();
    updateStale();
    o.updateCount();
    if (snapshot.text) {
      setUndo(snapshot);
      o.status.textContent = '입력을 지웠습니다. "되돌리기"를 누르면 복구됩니다.';
    }
    o.input.focus();
  });

  o.copyBtn.addEventListener('click', () => {
    if (o.output.value) copyWithFeedback(o.copyBtn, o.output.value, o.copyLabel());
  });

  o.downloadBtn.addEventListener('click', () => {
    if (o.output.value) downloadWithFeedback(o.downloadBtn, o.output.value, o.filename);
  });

  o.updateCount();

  return {
    // 옵션을 바꾸면 이미 표시된 결과도 새 설정으로 다시 계산 (결과와 설정이 어긋나지 않도록)
    rerun() {
      if (lastRunInput !== null) run({ scroll: false });
    },
  };
}
