/**
 * 리드마스터 AX 퍼널 통합 상태 저장소 (localStorage 기반 · 백엔드 불필요)
 * - 1단계 랜딩 신청 (readmaster-ax-apply)
 * - 2단계 사전 설문 (readmaster-ax-surveys-v1)
 * - 3~7단계 CRM 40열 파이프라인 (readmaster-ax-crm-v1)
 * - 정산 탭 10:45:45 (readmaster-ax-settlement-v1)
 * - 미정 항목 10건 체크리스트 (readmaster-ax-decisions-v1)
 */
(function (global) {
  const KEYS = {
    APPLY: 'readmaster-ax-apply',
    SURVEYS: 'readmaster-ax-surveys-v1',
    CRM: 'readmaster-ax-crm-v1',
    SETTLEMENT: 'readmaster-ax-settlement-v1',
    DECISIONS: 'readmaster-ax-decisions-v1',
    CONFIG: 'readmaster-ax-config-v1'
  };

  const DEFAULT_CONFIG = {
    nextSeatPrice: 625000,
    listPrice: 1200000,
    nextSeatLabel: '현재 다음 자리',
    kakaoOpenChatUrl: 'https://open.kakao.com/o/REPLACE_WITH_YOUR_OPENCHAT',
    quoteValidDays: 14,
    surveyRemindDays: 3,
    quoteWarnDays: 3,
    fundRate: 0.10,
    partnerRate: 0.45,
    issuerName: '[미정: 계약 주체]',
    contactPhone: '[연락처 입력]',
    vatPolicy: '[미정: 포함·별도 여부]',
    retentionMonths: '[미정]',
    warrantyDays: '[미정]',
    handoverFreeHours: '[미정]',
    finalQuoteValidDays: '[미정]',
    depositRatio: '[미정]',
    balanceRatio: '[미정]'
  };

  const STAGES = [
    '신청',
    '설문',
    '범위 견적',
    '상담',
    '확정·계약',
    '실행',
    '유지',
    '종료'
  ];

  const INTERESTS = [
    '1-Day 교육',
    '맞춤 구축',
    '둘 다',
    '아직 모르겠다'
  ];

  const DEFAULT_CRM = [
    {
      id: 'EX-001',
      receivedDate: '2026-11-10',
      academyName: '(가상) 예시학원 — 지우고 쓰세요',
      regionSubject: '경기·영어',
      contactPerson: '원장',
      contactChannel: '카카오',
      stage: '범위 견적',
      nextAction: '상담 일정 잡기',
      nextDue: '2026-11-14',
      owner: '세훈',
      interest: '둘 다',
      buildSummary: '(가상) 강사용 피드백 리포트 앱',
      surveySentDate: '2026-11-11',
      surveyReplyDate: '2026-11-12',
      reminded: '안 보냄',
      rangeQuoteSentDate: '2026-11-13',
      buildMin: 2500000,
      buildMax: 3500000,
      maintMin: 150000,
      maintMax: 250000,
      consultDate: '',
      consultType: '',
      specAgreedDate: '',
      finalQuoteDate: '',
      buildFinalPrice: '',
      maintFinalPrice: '',
      eduCohort: '',
      paidDate: '',
      oneDayDate: '',
      buildStartDate: '',
      milestone: '',
      qaPassDate: '',
      handoverDate: '',
      consentName: '미확인',
      consentAcademy: '미확인',
      consentScreen: '미확인',
      consentNumber: '미확인',
      reviewReceived: '미수신',
      closeReason: ''
    }
  ];

  const DEFAULT_SETTLEMENTS = [
    {
      id: 'SET-001',
      academyId: '예시(가상)',
      category: '구축비',
      paidDate: '2026-11-16',
      amount: 3000000,
      directCost: 200000,
      memo: '기획서의 가상 예시. 지우고 쓰세요'
    }
  ];

  const DEFAULT_DECISIONS = [
    { no: 1, title: '1-Day를 구축의 필수 선행으로 둘지', reason: '§3 6단계 순서, 랜딩 FAQ', status: '미정', note: '권장(가정): 1-Day를 먼저 진행해 요구사항 조사를 겸함' },
    { no: 2, title: '독립 원칙을 구축에도 유지', reason: '§7 계약, 랜딩 원칙 문구', status: '확정', note: '확정(2026-11-17): 계정·코드·데이터 학원 명의, 해지 시 인계' },
    { no: 3, title: '계약 주체(누구 사업자 명의), 부가세·원천징수', reason: '견적서·세금계산서, §2 정산', status: '미정', note: '' },
    { no: 4, title: '기금의 보관·용도·사용 합의 방식', reason: '§2 수익 배분', status: '미정', note: '' },
    { no: 5, title: '구축 견적의 최소 금액, 설문 예산대 문항의 구간', reason: '§4 설문, §5 견적', status: '미정', note: '최소 견적이 예산대 가장 낮은 구간의 바닥' },
    { no: 6, title: '방문 상담의 기준 금액과 유료 여부, 출장비', reason: '§3 4단계 상담', status: '미정', note: '' },
    { no: 7, title: '지급 일정(계약금·잔금 비율), 하자 보수 기간, 유지 포함 시간, 확정 견적서 유효기간', reason: '§5-3, §7 계약', status: '미정', note: '' },
    { no: 8, title: '설문 응답의 보관 기간', reason: '§4 12번 개인정보 동의', status: '미정', note: '' },
    { no: 9, title: '수료자 네트워크 플레이스홀더 처리, 이원주샘 소개 노출', reason: '§8 랜딩 수정안', status: '미정', note: '본인 동의 필요' },
    { no: 10, title: '45:45 예외(영업·구축 기여가 한쪽에 쏠린 건)', reason: '§2 수익 배분', status: '미정', note: '' }
  ];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return JSON.parse(JSON.stringify(fallback));
      return JSON.parse(raw);
    } catch (_) {
      return JSON.parse(JSON.stringify(fallback));
    }
  }

  function writeJson(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDaysIso(isoDate, days) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Number(days || 0));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function diffDaysFromToday(isoDate) {
    if (!isoDate) return null;
    const t = new Date(todayIso() + 'T00:00:00');
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((d - t) / 86400000);
  }

  function formatKRW(num) {
    if (num === '' || num === null || num === undefined || isNaN(Number(num))) return '-';
    return '₩' + Math.round(Number(num)).toLocaleString('ko-KR');
  }

  function discountPct(price, listPrice) {
    if (!listPrice || !price) return 0;
    return Math.round((1 - price / listPrice) * 100);
  }

  function getConfig() {
    return Object.assign({}, DEFAULT_CONFIG, readJson(KEYS.CONFIG, {}));
  }
  function saveConfig(patch) {
    const next = Object.assign(getConfig(), patch);
    writeJson(KEYS.CONFIG, next);
    return next;
  }

  function getCrm() { return readJson(KEYS.CRM, DEFAULT_CRM); }
  function saveCrm(rows) { writeJson(KEYS.CRM, rows); }

  function nextAcademyId(rows) {
    const nums = rows
      .map(r => (r.id || '').match(/^AX-(\d+)$/))
      .filter(Boolean)
      .map(m => parseInt(m[1], 10));
    const max = nums.length ? Math.max(...nums) : 0;
    return 'AX-' + String(max + 1).padStart(3, '0');
  }

  function upsertCrmFromApply(payload) {
    const rows = getCrm();
    const id = nextAcademyId(rows);
    const today = todayIso();
    const nextDue = addDaysIso(today, 1);
    const row = {
      id,
      receivedDate: today,
      academyName: payload.academy || '(미입력)',
      regionSubject: payload.regionSubject || '',
      contactPerson: `${payload.name || ''} (${payload.role || ''})`.trim(),
      contactChannel: [payload.phone, payload.email].filter(Boolean).join(' / ') || '카카오',
      stage: '신청',
      nextAction: '24시간 내 첫 응답 · 설문 발송',
      nextDue,
      owner: '세훈',
      interest: payload.interest || '아직 모르겠다',
      buildSummary: (payload.pains || []).join(', '),
      surveySentDate: '',
      surveyReplyDate: '',
      reminded: '안 보냄',
      rangeQuoteSentDate: '',
      buildMin: '',
      buildMax: '',
      maintMin: '',
      maintMax: '',
      consultDate: '',
      consultType: '',
      specAgreedDate: '',
      finalQuoteDate: '',
      buildFinalPrice: '',
      maintFinalPrice: '',
      eduCohort: '',
      paidDate: '',
      oneDayDate: '',
      buildStartDate: '',
      milestone: '',
      qaPassDate: '',
      handoverDate: '',
      consentName: '미확인',
      consentAcademy: '미확인',
      consentScreen: '미확인',
      consentNumber: '미확인',
      reviewReceived: '미수신',
      closeReason: ''
    };
    rows.unshift(row);
    saveCrm(rows);
    return row;
  }

  function upsertCrmFromSurvey(survey) {
    const surveys = readJson(KEYS.SURVEYS, []);
    surveys.unshift(survey);
    writeJson(KEYS.SURVEYS, surveys);

    const rows = getCrm();
    const today = todayIso();
    const existing = rows.find(r =>
      r.academyName && survey.academyName &&
      r.academyName.trim() === survey.academyName.trim()
    );

    if (existing) {
      existing.stage = '설문';
      existing.interest = survey.interest || existing.interest;
      existing.regionSubject = `${survey.region || ''}·${survey.subject || ''}`.replace(/^·|·$/g, '') || existing.regionSubject;
      existing.surveyReplyDate = today;
      existing.nextAction = (survey.interest === '맞춤 구축' || survey.interest === '둘 다')
        ? '이원주 구축 검토 → 범위 견적서 발송 (3영업일)'
        : '범위 견적서(교육) 발송 (3영업일)';
      existing.nextDue = addDaysIso(today, 3);
      existing.owner = (survey.interest === '맞춤 구축' || survey.interest === '둘 다') ? '원주' : '세훈';
      if (survey.buildGoal) existing.buildSummary = survey.buildGoal.slice(0, 60);
      saveCrm(rows);
      return existing;
    }

    const id = nextAcademyId(rows);
    const row = {
      id,
      receivedDate: today,
      academyName: survey.academyName || '(미입력)',
      regionSubject: `${survey.region || ''}·${survey.subject || ''}`.replace(/^·|·$/g, ''),
      contactPerson: survey.role || '',
      contactChannel: '설문 직접 제출',
      stage: '설문',
      nextAction: (survey.interest === '맞춤 구축' || survey.interest === '둘 다')
        ? '이원주 구축 검토 → 범위 견적서 발송 (3영업일)'
        : '범위 견적서(교육) 발송 (3영업일)',
      nextDue: addDaysIso(today, 3),
      owner: (survey.interest === '맞춤 구축' || survey.interest === '둘 다') ? '원주' : '세훈',
      interest: survey.interest || '아직 모르겠다',
      buildSummary: (survey.buildGoal || (survey.topPains || []).join(', ')).slice(0, 60),
      surveySentDate: today,
      surveyReplyDate: today,
      reminded: '안 보냄',
      rangeQuoteSentDate: '',
      buildMin: '',
      buildMax: '',
      maintMin: '',
      maintMax: '',
      consultDate: '',
      consultType: '',
      specAgreedDate: '',
      finalQuoteDate: '',
      buildFinalPrice: '',
      maintFinalPrice: '',
      eduCohort: '',
      paidDate: '',
      oneDayDate: '',
      buildStartDate: '',
      milestone: '',
      qaPassDate: '',
      handoverDate: '',
      consentName: '미확인',
      consentAcademy: '미확인',
      consentScreen: '미확인',
      consentNumber: '미확인',
      reviewReceived: '미수신',
      closeReason: ''
    };
    rows.unshift(row);
    saveCrm(rows);
    return row;
  }

  function getRowAlerts(row, cfg) {
    const alerts = [];
    if (row.stage === '종료') return alerts;
    const dueDiff = diffDaysFromToday(row.nextDue);
    if (dueDiff !== null && dueDiff < 0) {
      alerts.push({ level: 'red', text: `기한 초과 (${Math.abs(dueDiff)}일)` });
    }
    if (row.surveySentDate && !row.surveyReplyDate) {
      const sentDiff = diffDaysFromToday(row.surveySentDate);
      if (sentDiff !== null && -sentDiff >= cfg.surveyRemindDays) {
        alerts.push({ level: 'amber', text: `설문 미회신 (${-sentDiff}일)` });
      }
    }
    if (row.rangeQuoteSentDate && !row.specAgreedDate && !row.finalQuoteDate) {
      const expireDate = addDaysIso(row.rangeQuoteSentDate, cfg.quoteValidDays);
      const expDiff = diffDaysFromToday(expireDate);
      if (expDiff !== null && expDiff <= cfg.quoteWarnDays && expDiff >= 0) {
        alerts.push({ level: 'amber', text: `견적 만료 임박 (D-${expDiff})` });
      } else if (expDiff !== null && expDiff < 0) {
        alerts.push({ level: 'red', text: `견적 유효기간 만료` });
      }
    }
    return alerts;
  }

  function getSettlements() { return readJson(KEYS.SETTLEMENT, DEFAULT_SETTLEMENTS); }
  function saveSettlements(rows) { writeJson(KEYS.SETTLEMENT, rows); }

  function calcSplit(amount, directCost, cfg) {
    const a = Number(amount) || 0;
    const c = Number(directCost) || 0;
    const net = Math.max(0, a - c);
    return {
      net,
      fund: Math.round(net * cfg.fundRate),
      sehoon: Math.round(net * cfg.partnerRate),
      wonju: Math.round(net * cfg.partnerRate)
    };
  }

  function getDecisions() { return readJson(KEYS.DECISIONS, DEFAULT_DECISIONS); }
  function saveDecisions(rows) { writeJson(KEYS.DECISIONS, rows); }

  function getSurveys() { return readJson(KEYS.SURVEYS, []); }

  function downloadCsv(filename, headers, rows) {
    const esc = v => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  global.AXStore = {
    KEYS,
    STAGES,
    INTERESTS,
    todayIso,
    addDaysIso,
    diffDaysFromToday,
    formatKRW,
    discountPct,
    getConfig,
    saveConfig,
    getCrm,
    saveCrm,
    upsertCrmFromApply,
    upsertCrmFromSurvey,
    getRowAlerts,
    getSettlements,
    saveSettlements,
    calcSplit,
    getDecisions,
    saveDecisions,
    getSurveys,
    downloadCsv
  };
})(window);
