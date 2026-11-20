/**
 * 리드마스터 AX 퍼널 · Google Workspace 자동화 스크립트 (Apps Script)
 * 출처: 리드마스터 AX 퍼널 기획서 v0.1 (2026-11-16)
 *
 * 사용법:
 * 1) script.google.com 에서 새 프로젝트 생성 후 본 파일 전체 붙여넣기
 * 2) createAxSurveyForm() 1회 실행 → 섹션 분기 구글폼 자동 생성 (로그에서 편집/응답 URL 확인)
 * 3) CRM 구글 시트에서 확장 프로그램 > Apps Script 에 붙여넣고 setupCrmFormatting() 실행
 */

const CONFIG = {
  RETENTION_MONTHS: '[미정]', // 두 분 합의 후 숫자로 교체 (예: '12')
  BUDGET_RANGES: [
    '아직 모르겠다',
    '[미정: 최소 구간 — 예: 200만원 미만]',
    '[미정: 200만 ~ 400만원]',
    '[미정: 400만 ~ 700만원]',
    '[미정: 700만원 이상]'
  ],
  QUOTE_VALID_DAYS: 14,
  SURVEY_REMIND_DAYS: 3,
  QUOTE_WARN_DAYS: 3
};

/**
 * 1. 섹션 분기 사전 설문 구글폼 자동 생성
 * 공통 12문항 (5분) + 관심='맞춤 구축'/'둘 다' 일 때만 구축 섹션 10문항 (5~10분)으로 분기
 */
function createAxSurveyForm() {
  const form = FormApp.create('리드마스터 AX 사전 설문 (초안)');
  form.setDescription(
    '학원 현황 파악 및 범위 견적 산정을 위한 사전 설문입니다.\n' +
    '공통 문항은 약 5분, 맞춤 구축을 선택하시면 구축 섹션(약 5~10분)이 이어집니다.'
  );

  // ===== 섹션 1: 공통 (모든 학원) =====
  form.addTextItem().setTitle('1. 학원 이름 / 지역 / 과목').setHelpText('예: 리드마스터 영어학원 / 경기 부천 / 중·고등 영어').setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('2. 답하시는 분의 역할')
    .setChoiceValues(['원장', '공동 원장', '실장', '강사'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('3. 구매를 결정하는 분은 누구인가요?')
    .setChoiceValues(['본인', '다른 분과 함께', '다른 분'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('4-1. 원생 규모')
    .setChoiceValues(['30명 미만', '30~70명', '70~150명', '150~300명', '300명 이상'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('4-2. 강사 수 (원장님 포함)')
    .setChoiceValues(['1명 (1인 학원)', '2~3명', '4~7명', '8명 이상'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('5. 지금 가장 시간을 잡아먹는 일 세 가지')
    .setChoiceValues([
      '학부모 피드백 작성',
      '교재·문항 제작',
      '수강료·재등록 관리',
      '학부모 문의 응대',
      '홍보 콘텐츠',
      '출결·학생 기록'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addTextItem()
    .setTitle('6. 그 일에 한 주에 몇 시간쯤 쓰시나요?')
    .setHelpText('그 일을 실제로 하시는 분이 직접 적어 주세요. (예: 주 10시간)')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('7. 지금 쓰는 도구 (복수 선택)')
    .setChoiceValues([
      '엑셀·구글 시트',
      '학원 관리 프로그램',
      '카카오톡',
      '네이버 밴드·카페',
      '자체 홈페이지',
      'AI 도구',
      '없음'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addTextItem()
    .setTitle('7-1. (선택) 사용 중인 학원 관리 프로그램 / AI 도구 이름')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('8. (선택) AI를 지금 어떻게 쓰고 계신가요?')
    .setChoiceValues(['안 씀', '가끔 질문', '매일 업무에', '자동화까지'])
    .setRequired(false);

  // 9번: 분기 문항
  const interestItem = form.addMultipleChoiceItem()
    .setTitle('9. 관심 있는 것')
    .setRequired(true);

  form.addTextItem()
    .setTitle('10. (선택) 희망 시기, 가능한 요일')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('11. (선택) 진행 방식')
    .setChoiceValues(['출장', '부천 내방', '야간', '분할'])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('12. 개인정보 수집·이용 동의')
    .setHelpText('목적: 견적 산정과 상담 연락 / 보관: 상담 종료 후 ' + CONFIG.RETENTION_MONTHS + '개월')
    .setChoiceValues(['위 내용에 동의합니다'])
    .setRequired(true);

  // ===== 섹션 2: 구축 섹션 (맞춤 구축 / 둘 다 분기) =====
  const buildSection = form.addPageBreakItem()
    .setTitle('맞춤 구축 사전 질문')
    .setHelpText('구축 범위와 예상 견적(최소~최대)을 산정하기 위한 질문입니다. (약 5~10분)');

  form.addParagraphTextItem()
    .setTitle('B1. 무엇을 만들고 싶으신가요?')
    .setHelpText('"지금은 이렇게 하는데, 이렇게 되면 좋겠다" 형태로 자유롭게 적어 주세요.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('B2. 누가 쓰나요? (원장/강사/학생/학부모) · 각각 몇 명쯤인가요?')
    .setHelpText('예: 원장 1명, 강사 4명, 학부모 80명')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('B3. 지금 그 일을 어떻게 하고 계신가요? (쓰는 파일·프로그램·순서)')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('B4. 그 자료는 지금 어디에 있나요?')
    .setChoiceValues(['엑셀 파일', '구글 시트', '특정 프로그램 안', '종이'])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('B5. (선택) 꼭 있어야 하는 기능 세 가지 / 없어도 되는 것')
    .setRequired(false);

  form.addTextItem()
    .setTitle('B6. (선택) 기존 프로그램과 연결돼야 하나요? (프로그램 이름)')
    .setRequired(false);

  form.addTextItem()
    .setTitle('B7. 언제까지 필요하신가요? (날짜가 정해져 있으면 그 이유도)')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('B8. 생각하시는 예산대')
    .setChoiceValues(CONFIG.BUDGET_RANGES)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('B9. 학생·학부모 개인정보를 다루게 되나요? (이름, 연락처, 성적 등)')
    .setRequired(true);

  form.addTextItem()
    .setTitle('B10. (선택) 참고하고 싶은 서비스나 화면이 있으면 링크')
    .setRequired(false);

  // 분기 연결: 1-Day 교육 / 아직 모르겠다 → 바로 제출, 맞춤 구축 / 둘 다 → 구축 섹션
  interestItem.setChoices([
    interestItem.createChoice('1-Day 교육', FormApp.PageNavigationType.SUBMIT),
    interestItem.createChoice('맞춤 구축', buildSection),
    interestItem.createChoice('둘 다', buildSection),
    interestItem.createChoice('아직 모르겠다', FormApp.PageNavigationType.SUBMIT)
  ]);

  Logger.log('편집 URL: ' + form.getEditUrl());
  Logger.log('응답 URL: ' + form.getPublishedUrl());
}

/**
 * 2. CRM 시트 조건부 서식 자동 적용 (06 CRM 시트 규칙)
 * - 빨강: 다음 기한(I열)이 오늘보다 지남 (단, 현재 단계 G열 != '종료')
 * - 노랑: 설문 발송일(M열) 후 3일 경과 & 설문 회신일(N열) 비어 있음
 * - 노랑: 견적 유효기한(Q열) 3일 이내 임박 & 확정서 동의일(X열) 비어 있음
 * 주의: 학원에 자동으로 메일/문자를 보내는 기능은 기획 원칙에 따라 만들지 않음.
 */
function setupCrmFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CRM');
  if (!sheet) throw new Error('CRM 시트를 찾을 수 없습니다.');

  const range = sheet.getRange('A2:AN300');
  const rules = [];

  // 빨강: 다음 기한 초과
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($I2<>"", $I2<TODAY(), $G2<>"종료")')
      .setBackground('#FEE2E2')
      .setFontColor('#991B1B')
      .setRanges([range])
      .build()
  );

  // 노랑: 설문 미회신 3일 이상
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($M2<>"", $N2="", TODAY()-$M2>=$AP$2, $G2<>"종료")')
      .setBackground('#FEF3C7')
      .setFontColor('#92400E')
      .setRanges([range])
      .build()
  );

  // 노랑: 범위 견적 유효기한 임박 (3일 이내)
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($Q2<>"", $X2="", $Q2-TODAY()<=$AP$3, $Q2>=TODAY(), $G2<>"종료")')
      .setBackground('#FEF3C7')
      .setFontColor('#92400E')
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
  SpreadsheetApp.getUi().alert('CRM 조건부 서식이 적용되었습니다.');
}
