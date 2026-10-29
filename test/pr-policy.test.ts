import { describe, expect, it } from 'vitest';
// @ts-expect-error The Actions validator is intentionally a dependency-free CommonJS module.
import policy from '../scripts/pr-policy.cjs';

const closedGate = {
  schemaVersion: 1,
  gates: { G0: false, G1: false, G2: false, G3: false },
  featureDevelopmentAllowed: false,
};

function fixture(type = 'foundation', gate = 'G0', deps = 'None') {
  return {
    body: `## 関連Issue
Closes #2
## 変更区分
${type}
## 対象ゲート
${gate}
## WBS参照
WBS-CORE-ENV
## 目的と変更内容
空の開発環境を再現するチェックを追加する。
## 依存関係・着手条件
${deps}
G0の環境整備を開始する条件を確認済み。
## DB・API・権限・状態への影響
DB変更なし。検証用の一時DBのみ使用する。
## 検証結果
npm run check が成功。
## 証跡
CI実行URLをPRのChecksから確認。
## チェックリスト
- [x] 依存関係と検証結果を確認した
`,
    issue: {
      number: 2,
      state: 'open',
      assignees: [{ login: 'owner' }],
      body: `### 変更区分
${type}
### 対象ゲート
${gate}
### WBS参照
WBS-CORE-ENV
### 目的・成果物・対象範囲
開発環境を再現するチェックを追加する。
### 仕様参照
SPEC-ENV-01
### 依存Issue・着手条件
${deps}
G0環境整備の開始条件を確認済み。
### 完了条件
- [ ] ローカル検証の成功
### DB・API・権限・状態への影響
DB変更なし。
### 検証方法・証跡
npm run check のCI結果。
### 担当・確認者
担当owner、確認reviewer。
### 登録前の確認
- [x] 依存と範囲を確認した
`,
    },
    gateConfig: structuredClone(closedGate),
    dependencyIssues: [] as Array<{
      number: number;
      state: string;
      state_reason: string;
      pull_request?: object;
    }>,
  };
}

describe('PR policy', () => {
  it('accepts an assigned G0 issue with verified metadata and no dependencies', () => {
    expect(policy.validatePolicy(fixture())).toEqual([]);
  });

  it('requires an exact local Issue reference, rejecting cross-repo or example links', () => {
    for (const reference of ['Closes other/repo#2', 'Closes #2 and #3', 'Closes #<number>', '']) {
      const input = fixture();
      input.body = input.body.replace('Closes #2', reference);
      expect(policy.validatePolicy(input).length).toBeGreaterThan(0);
    }
  });

  it('does not accept a PR in place of the related Issue', () => {
    const input = fixture();
    expect(
      policy.validatePolicy({ ...input, issue: { ...input.issue, pull_request: {} } })
    ).toContain('関連Issueが存在しないか、IssueではなくPull Requestを指定しています');
  });

  it('rejects empty metadata after removing template comments', () => {
    const input = fixture();
    input.body = input.body.replace('npm run check が成功。', '<!-- 確認結果を記入 -->');
    expect(policy.validatePolicy(input)).toContain('PRの必須項目が未記入です: 検証結果');
  });

  it('rejects template-only Issue content', () => {
    const input = fixture();
    input.issue.body = input.issue.body.replace(
      '開発環境を再現するチェックを追加する。',
      '目的:\n成果物:\n対象範囲:'
    );
    expect(policy.validatePolicy(input)).toContain(
      'Issueの必須項目が未記入です: 目的・成果物・対象範囲'
    );
  });

  it('requires an assigned owner and matching Issue classification', () => {
    const input = fixture();
    input.issue.assignees = [];
    input.issue.body = input.issue.body.replace('foundation', 'feature');
    expect(policy.validatePolicy(input)).toContain('関連Issueに担当者を割り当ててください');
    expect(policy.validatePolicy(input)).toContain('PRとIssueの変更区分が一致しません');
  });

  it('rejects incomplete, abandoned, missing or PR dependencies', () => {
    for (const dependency of [
      { number: 1, state: 'open', state_reason: 'completed' },
      { number: 1, state: 'closed', state_reason: 'not_planned' },
      { number: 1, state: 'closed', state_reason: 'completed', pull_request: {} },
    ]) {
      const input = fixture('foundation', 'G0', 'Depends on #1');
      input.dependencyIssues = [dependency];
      expect(policy.validatePolicy(input)).toContain(
        '依存Issue #1 はcompletedとして完了していません'
      );
    }
    expect(policy.validatePolicy(fixture('foundation', 'G0', 'Depends on #1'))).toContain(
      '依存Issue #1 はcompletedとして完了していません'
    );
  });

  it('accepts a completed dependency but rejects omissions from the PR list', () => {
    const input = fixture('foundation', 'G0', 'Depends on #1');
    input.dependencyIssues = [{ number: 1, state: 'closed', state_reason: 'completed' }];
    expect(policy.validatePolicy(input)).toEqual([]);
    input.body = input.body.replace('Depends on #1', 'None');
    expect(policy.validatePolicy(input)).toContain('PRとIssueの依存Issue一覧が一致しません');
  });

  it('blocks a feature PR even if its body claims that it opens the core gate', () => {
    const input = fixture('feature', 'FEATURE');
    input.body += '\nThis PR sets featureDevelopmentAllowed=true.\n';
    expect(policy.validatePolicy(input)).toContain(
      'コア完了前の機能開発は開始できません（統合先ブランチのゲートを参照）'
    );
  });

  it('blocks bug/change classification from bypassing a closed feature gate', () => {
    for (const type of ['bug', 'change']) {
      expect(policy.validatePolicy(fixture(type, 'FEATURE'))).toContain(
        'コア完了前の機能開発は開始できません（統合先ブランチのゲートを参照）'
      );
    }
  });

  it('blocks future core stages until earlier stages have completed', () => {
    expect(policy.validatePolicy(fixture('foundation', 'G2'))).toContain(
      '先に G0 を完了してください'
    );
  });

  it('requires foundation work to use the next incomplete gate', () => {
    const input = fixture();
    input.gateConfig.gates.G0 = true;
    expect(policy.validatePolicy(input)).toContain(
      'foundation変更の対象は次の未完了ゲートのみです: G1'
    );
  });

  it('fails closed when trusted gate configuration is incomplete', () => {
    const input = fixture();
    expect(policy.validatePolicy({ ...input, gateConfig: { schemaVersion: 1 } })).toContain(
      '統合先ブランチのコアゲート設定が不正です'
    );
  });

  it('allows feature work only when all trusted gates and the explicit release flag are true', () => {
    const input = fixture('feature', 'FEATURE');
    input.gateConfig = {
      schemaVersion: 1,
      gates: { G0: true, G1: true, G2: true, G3: true },
      featureDevelopmentAllowed: true,
    };
    expect(policy.validatePolicy(input)).toEqual([]);
    input.gateConfig.gates.G3 = false;
    expect(policy.validatePolicy(input).length).toBeGreaterThan(0);
  });

  it('rejects unfinished checklists', () => {
    const input = fixture();
    input.body += '- [ ] 未確認\n';
    expect(policy.validatePolicy(input)).toContain('PRチェックリストの全項目を確認してください');
  });
});

describe('API change boundaries', () => {
  const file = (filename: string) => ({ filename, status: 'modified' });
  it('rejects business features even when metadata says foundation G0', () => {
    const input = fixture();
    expect(
      policy.validateApiChanges({ ...input, files: [file('src/features/listings.ts')] }).length
    ).toBeGreaterThan(0);
  });
  it('permits G0 configuration but reserves database and shared code for their stages', () => {
    expect(policy.validateApiChanges({ ...fixture(), files: [file('README.md')] })).toEqual([]);
    expect(
      policy.validateApiChanges({ ...fixture(), files: [file('migrations/0002.sql')] }).length
    ).toBeGreaterThan(0);
    expect(
      policy.validateApiChanges({
        ...fixture('foundation', 'G1'),
        files: [file('migrations/0002.sql')],
      })
    ).toEqual([]);
  });
  it('rejects completing every gate at once or mixing a gate update with feature code', () => {
    const input = fixture();
    const proposedGateConfig = {
      schemaVersion: 1,
      gates: { G0: true, G1: true, G2: true, G3: true },
      featureDevelopmentAllowed: true,
      evidence: 'Verified in completed PR and commit record',
    };
    expect(
      policy.validateApiChanges({
        ...input,
        files: [file('.github/core-gate.json')],
        proposedGateConfig,
      }).length
    ).toBeGreaterThan(0);
    expect(
      policy.validateApiChanges({
        ...input,
        files: [file('.github/core-gate.json'), file('src/features/listings.ts')],
        proposedGateConfig,
      }).length
    ).toBeGreaterThan(0);
  });
  it('accepts only one next gate in an independent evidence-bearing PR', () => {
    const input = fixture();
    const proposedGateConfig = {
      ...closedGate,
      gates: { ...closedGate.gates, G0: true },
      evidence: 'Completed PR #5 at verified commit; reproduction log TEST-G0-01',
    };
    expect(
      policy.validateApiChanges({
        ...input,
        files: [file('.github/core-gate.json')],
        proposedGateConfig,
      })
    ).toEqual([]);
    expect(
      policy.validateApiChanges({
        ...input,
        files: [file('.github/core-gate.json')],
        proposedGateConfig: { ...proposedGateConfig, evidence: '' },
      }).length
    ).toBeGreaterThan(0);
  });
});

describe('develop to main promotion', () => {
  const promotion = {
    baseBranch: 'main',
    headBranch: 'develop',
    repository: 'IA-Bgroup/BGroup-api',
    headRepository: 'IA-Bgroup/BGroup-api',
    headSha: 'current',
    developSha: 'current',
  };
  it('accepts the latest same-repository develop and retains required metadata checks', () => {
    expect(policy.validatePromotion(promotion)).toEqual([]);
    const input = fixture();
    input.gateConfig.gates.G0 = true;
    expect(policy.validatePolicy({ ...input, enforceApiStages: false })).toEqual([]);
    expect(
      policy.validatePolicy({ ...input, body: '', enforceApiStages: false }).length
    ).toBeGreaterThan(0);
  });
  it('rejects arbitrary branches, forks and stale develop snapshots', () => {
    for (const override of [
      { headBranch: 'feature/bypass' },
      { headRepository: 'someone/fork' },
      { headSha: 'old' },
      { developSha: undefined },
    ]) {
      expect(policy.validatePromotion({ ...promotion, ...override }).length).toBeGreaterThan(0);
    }
  });
});
