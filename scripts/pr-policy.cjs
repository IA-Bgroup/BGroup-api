'use strict';

const PR_SECTIONS = [
  '関連Issue',
  '変更区分',
  '対象ゲート',
  'WBS参照',
  '目的と変更内容',
  '依存関係・着手条件',
  'DB・API・権限・状態への影響',
  '検証結果',
  '証跡',
  'チェックリスト',
];
const ISSUE_SECTIONS = [
  '変更区分',
  '対象ゲート',
  'WBS参照',
  '目的・成果物・対象範囲',
  '仕様参照',
  '依存Issue・着手条件',
  '完了条件',
  'DB・API・権限・状態への影響',
  '検証方法・証跡',
  '担当・確認者',
  '登録前の確認',
];
const GATES = ['G0', 'G1', 'G2', 'G3'];
const TYPES = ['foundation', 'feature', 'change', 'bug'];

function sections(body = '') {
  const clean = body.replace(/<!--[\s\S]*?-->/g, '');
  const result = {};
  let heading;
  for (const line of clean.split(/\r?\n/)) {
    const match = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (match) {
      heading = match[1];
      // Duplicate headings are rejected rather than silently replacing their contents.
      if (Object.hasOwn(result, heading)) throw new Error(`見出しが重複しています: ${heading}`);
      result[heading] = '';
    } else if (heading) {
      result[heading] += `${line}\n`;
    }
  }
  for (const key of Object.keys(result)) result[key] = result[key].trim();
  return result;
}

function meaningful(value) {
  const content = (value || '')
    .split(/\r?\n/)
    .filter((line) => !/^[^:：\n]+[:：]\s*$/.test(line.trim()))
    .join('\n')
    .trim();
  return Boolean(
    content &&
    !/^(?:[-*\s]|_No response_)*$/.test(content) &&
    !/^(?:TBD|TODO|未記入|記入してください|なし|None|N\/?A|該当なし|https?:\/\/example\.(?:com|org))\.?$/i.test(
      content
    ) &&
    !/^<[^>]+>$/.test(content)
  );
}

function dependencies(value, label, errors) {
  const ids = [];
  for (const line of (value || '').split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[-*]\s+)?Depends on #([1-9]\d*)$/i);
    if (match) ids.push(Number(match[1]));
    else if (/depends on/i.test(line))
      errors.push(`${label}: Depends on #番号 の形式にしてください`);
  }
  const none = /^(?:[-*]\s+)?None\s*$/im.test(value || '');
  if ((!ids.length && !none) || (ids.length && none)) {
    errors.push(`${label}: Depends on #番号 を列挙するか、依存なしなら None を記載してください`);
  }
  if (new Set(ids).size !== ids.length) errors.push(`${label}: 同じ依存Issueが重複しています`);
  return [...new Set(ids)].sort((a, b) => a - b);
}

function relatedIssueNumber(body) {
  const section = sections(body)['関連Issue'] || '';
  const match = section.match(/^Closes #([1-9]\d*)$/i);
  if (!match)
    throw new Error('関連Issueには同一リポジトリの Closes #番号 を1件だけ記載してください');
  return Number(match[1]);
}

function validatePolicy({
  body,
  issue,
  dependencyIssues = [],
  gateConfig,
  enforceApiStages = true,
}) {
  const errors = [];
  let pr;
  let item;
  let issueNumber;
  try {
    pr = sections(body);
    issueNumber = relatedIssueNumber(body);
    item = sections(issue?.body || '');
  } catch (error) {
    return [error.message];
  }
  for (const name of PR_SECTIONS) {
    if (!meaningful(pr[name])) errors.push(`PRの必須項目が未記入です: ${name}`);
  }
  if (!issue || issue.number !== issueNumber || issue.pull_request) {
    errors.push('関連Issueが存在しないか、IssueではなくPull Requestを指定しています');
    return errors;
  }
  for (const name of ISSUE_SECTIONS) {
    if (!meaningful(item[name])) errors.push(`Issueの必須項目が未記入です: ${name}`);
  }
  if (pr['WBS参照'] !== item['WBS参照']) errors.push('PRとIssueのWBS参照が一致しません');
  if (issue.state !== 'open') errors.push('関連Issueは作業中のopen Issueである必要があります');
  if (!issue.assignees?.length) errors.push('関連Issueに担当者を割り当ててください');
  const type = pr['変更区分'];
  const gate = pr['対象ゲート'];
  if (!TYPES.includes(type))
    errors.push('変更区分は foundation / feature / change / bug のいずれか1つです');
  if (![...GATES, 'FEATURE'].includes(gate))
    errors.push('対象ゲートは G0 / G1 / G2 / G3 / FEATURE のいずれか1つです');
  if (item['変更区分'] !== type) errors.push('PRとIssueの変更区分が一致しません');
  if (item['対象ゲート'] !== gate) errors.push('PRとIssueの対象ゲートが一致しません');
  const prDeps = dependencies(pr['依存関係・着手条件'], 'PR依存関係', errors);
  const issueDeps = dependencies(item['依存Issue・着手条件'], 'Issue依存関係', errors);
  if (JSON.stringify(prDeps) !== JSON.stringify(issueDeps))
    errors.push('PRとIssueの依存Issue一覧が一致しません');
  for (const id of issueDeps) {
    const dep = dependencyIssues.find((candidate) => candidate.number === id);
    if (id === issueNumber) errors.push('Issueは自分自身に依存できません');
    else if (
      !dep ||
      dep.pull_request ||
      dep.state !== 'closed' ||
      dep.state_reason !== 'completed'
    ) {
      errors.push(`依存Issue #${id} はcompletedとして完了していません`);
    }
  }
  const validConfig =
    gateConfig?.schemaVersion === 1 &&
    typeof gateConfig.featureDevelopmentAllowed === 'boolean' &&
    GATES.every((name) => typeof gateConfig.gates?.[name] === 'boolean');
  if (!validConfig) {
    errors.push('統合先ブランチのコアゲート設定が不正です');
  } else {
    const states = GATES.map((name) => gateConfig.gates[name]);
    const next = GATES.find((name) => !gateConfig.gates[name]);
    if (states.some((complete, i) => complete && states.slice(0, i).includes(false))) {
      errors.push('統合先のコアゲートが依存順に完了していません');
    }
    if (type === 'feature' && gate !== 'FEATURE')
      errors.push('feature変更はFEATUREゲートを指定してください');
    if (enforceApiStages && type === 'foundation' && gate !== next) {
      errors.push(`foundation変更の対象は次の未完了ゲートのみです: ${next || '全ゲート完了済み'}`);
    }
    if (gate === 'FEATURE' || type === 'feature') {
      if (!gateConfig.featureDevelopmentAllowed || !states.every(Boolean)) {
        errors.push('コア完了前の機能開発は開始できません（統合先ブランチのゲートを参照）');
      }
    } else if (
      enforceApiStages &&
      GATES.includes(gate) &&
      GATES.indexOf(gate) > GATES.indexOf(next) &&
      next
    ) {
      errors.push(`先に ${next} を完了してください`);
    }
    if (type === 'foundation' && gate === 'FEATURE')
      errors.push('foundation変更でFEATUREゲートを使用できません');
  }
  if (
    !/^- \[x\] .+/im.test(pr['チェックリスト'] || '') ||
    /^- \[ \]/m.test(pr['チェックリスト'] || '')
  ) {
    errors.push('PRチェックリストの全項目を確認してください');
  }
  return errors;
}

const BASE_FILES = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  '.gitignore',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc',
  'eslint.config.js',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vitest.config.ts',
  'wrangler.jsonc',
  'src/index.ts',
  'src/config/origins.ts',
  'src/types/bindings.ts',
  'scripts/verify-database.mjs',
  'scripts/pr-policy.cjs',
  'test/app.test.ts',
  'test/pr-policy.test.ts',
]);
function complete(config) {
  return (
    config?.schemaVersion === 1 &&
    GATES.every((name) => config.gates?.[name] === true) &&
    config.featureDevelopmentAllowed === true
  );
}
function validGate(config) {
  return (
    config?.schemaVersion === 1 &&
    GATES.every((name) => typeof config.gates?.[name] === 'boolean') &&
    typeof config.featureDevelopmentAllowed === 'boolean' &&
    !GATES.some(
      (name, i) => config.gates[name] && GATES.slice(0, i).some((prior) => !config.gates[prior])
    ) &&
    (!config.featureDevelopmentAllowed || GATES.every((name) => config.gates[name]))
  );
}
function validateApiChanges({ body, files, gateConfig, proposedGateConfig }) {
  const errors = [];
  const pr = sections(body);
  if (!Array.isArray(files)) return ['変更ファイル一覧を取得できません'];
  const changesGate = files.some((f) =>
    [f.filename, f.previous_filename].includes('.github/core-gate.json')
  );
  if (changesGate) {
    if (
      files.length !== 1 ||
      files[0].filename !== '.github/core-gate.json' ||
      files[0].status === 'removed' ||
      files[0].previous_filename
    ) {
      errors.push('ゲート更新は .github/core-gate.json だけを変更する独立PRにしてください');
    }
    if (!validGate(gateConfig) || !validGate(proposedGateConfig))
      errors.push('提案されたゲート設定が不正です');
    else {
      if (
        !['foundation', 'change', 'bug'].includes(pr['変更区分']) ||
        !GATES.includes(pr['対象ゲート'])
      )
        errors.push('ゲート更新はコア段階のfoundation/change/bug Issueを使用してください');
      const added = GATES.filter(
        (name) => !gateConfig.gates[name] && proposedGateConfig.gates[name]
      );
      const removed = GATES.filter(
        (name) => gateConfig.gates[name] && !proposedGateConfig.gates[name]
      );
      const next = GATES.find((name) => !gateConfig.gates[name]);
      if (
        added.length > 1 ||
        (added.length === 1 && added[0] !== next) ||
        (added.length && removed.length)
      ) {
        errors.push('コアゲートは次の未完了段階を一つずつ完了させてください');
      }
      if (added.length && (pr['変更区分'] !== 'foundation' || pr['対象ゲート'] !== added[0])) {
        errors.push('完了させるゲートとfoundation Issueの対象段階が一致しません');
      }
      if (removed.length && !['change', 'bug'].includes(pr['変更区分']))
        errors.push('ゲート差し戻しはchangeまたはbug Issueを使用してください');
      if (
        proposedGateConfig.featureDevelopmentAllowed &&
        !gateConfig.featureDevelopmentAllowed &&
        pr['対象ゲート'] !== 'G3'
      ) {
        errors.push('機能開発の許可はG3の完了確認PRで記録してください');
      }
      if (
        typeof proposedGateConfig.evidence !== 'string' ||
        !meaningful(proposedGateConfig.evidence)
      )
        errors.push(
          'ゲート更新には完了/差し戻しのPR・commit・検証記録をevidenceへ記載してください'
        );
    }
    return errors;
  }
  if (complete(gateConfig)) return errors;
  const stage = pr['対象ゲート'];
  for (const file of files)
    for (const name of [file.filename, file.previous_filename].filter(Boolean)) {
      const basic =
        BASE_FILES.has(name) ||
        /^docs\/.*\.md$/.test(name) ||
        /^\.github\/(?:workflows|ISSUE_TEMPLATE)\/[^/]+\.ya?ml$/.test(name) ||
        name === '.github/PULL_REQUEST_TEMPLATE.md';
      const database =
        ['G1', 'G2', 'G3'].includes(stage) && /^(?:migrations|seeds)\/[^/]+\.sql$/.test(name);
      const shared =
        ['G2', 'G3'].includes(stage) &&
        /^src\/(?:core|shared|lib|middleware|types|config)\/.*\.ts$/.test(name);
      const tests =
        ['G1', 'G2', 'G3'].includes(stage) &&
        /^test\/(?:database|core|shared|integration)(?:[./-]).*\.ts$/.test(name);
      if (!basic && !database && !shared && !tests)
        errors.push(`コア完了前の${stage}で変更できないファイルです: ${name}`);
    }
  return errors;
}
function validatePromotion({
  baseBranch,
  headBranch,
  repository,
  headRepository,
  headSha,
  developSha,
}) {
  const errors = [];
  if (baseBranch !== 'main' || headBranch !== 'develop' || repository !== headRepository) {
    errors.push('mainへの昇格は同一リポジトリのdevelopブランチからだけ許可されます');
  }
  if (!developSha || !headSha || headSha !== developSha) {
    errors.push('昇格対象は最新developのcommitである必要があります');
  }
  return errors;
}
module.exports = {
  sections,
  dependencies,
  relatedIssueNumber,
  validatePolicy,
  validateApiChanges,
  validatePromotion,
};
