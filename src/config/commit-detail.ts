/**
 * Git 提交详情配置
 */
import { workspace, QuickPickItem, QuickPickOptions } from 'vscode';

/**
 * 提交详情接口
 */
export interface CommitDetailType extends QuickPickItem {
    /** 字段键名 */
    key?: string | number;
    /** 是否已编辑 */
    isEdit?: boolean;
}

/**
 * 最大 Subject 字数限制
 */
export const MaxSubjectWords = workspace.getConfiguration('odinsamGitCommit').get<number>('maxSubjectWords', 50);

/**
 * 提交详情字段列表
 */
export const CommitDetailType: Array<CommitDetailType> = [
    {
        label: '<Scope>',
        key: 'scope',
        description: '修改范围',
        detail: '本次修改包含哪些模块（可选）',
        isEdit: false
    },
    {
        label: '<Subject>',
        key: 'subject',
        description: '概述',
        detail: `commit 概述，不超过 ${MaxSubjectWords} 字`,
        isEdit: false
    },
    {
        label: '<Body>',
        key: 'body',
        description: '详情',
        detail: 'commit 详情，可换行显示（可选）',
        isEdit: false
    },
    {
        label: '<Footer>',
        key: 'footer',
        description: '备注',
        detail: '通常是修复 bug 的链接或相关 issue（可选）',
        isEdit: false
    },
    {
        label: '✅ 完成',
        key: 'complete',
        detail: '完成 commit 的编写'
    },
    {
        label: '↩ 返回',
        key: 'back',
        detail: '返回 commit type 选择页'
    }
];

/**
 * QuickPick 选项配置
 */
export const CommitDetailQuickPickOptions: QuickPickOptions = {
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true
};

