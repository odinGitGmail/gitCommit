/**
 * Git 提交类型配置
 */
import { workspace, QuickPickItem } from 'vscode';

/**
 * 提交类型接口
 */
export interface CommitType extends QuickPickItem {
    /** 提交类型（feat、fix等） */
    title: string;
    /** 图标（Emoji） */
    icon: string;
}

/**
 * 默认提交类型列表
 */
const defaultCommitTypes: Array<CommitType> = [
    {
        label: '✨ feat',
        title: 'feat',
        detail: '添加新特性',
        icon: '✨'
    },
    {
        label: '🐞 fix',
        title: 'fix',
        detail: '修复bug',
        icon: '🐞'
    },
    {
        label: '📃 docs',
        title: 'docs',
        detail: '仅仅修改文档',
        icon: '📃'
    },
    {
        label: '🌈 style',
        title: 'style',
        detail: '仅仅修改了空格、格式缩进、逗号等等，不改变代码逻辑',
        icon: '🌈'
    },
    {
        label: '🦄 refactor',
        title: 'refactor',
        detail: '代码重构，没有加新功能或者修复bug',
        icon: '🦄'
    },
    {
        label: '🎈 perf',
        title: 'perf',
        detail: '优化相关，比如提升性能、体验',
        icon: '🎈'
    },
    {
        label: '🧪 test',
        title: 'test',
        detail: '增加测试用例',
        icon: '🧪'
    },
    {
        label: '🔧 build',
        title: 'build',
        detail: '依赖相关的内容',
        icon: '🔧'
    },
    {
        label: '🐎 ci',
        title: 'ci',
        detail: 'ci配置相关 例如对 k8s，docker的配置文件的修改',
        icon: '🐎'
    },
    {
        label: '🐳 chore',
        title: 'chore',
        detail: '改变构建流程、或者增加依赖库、工具等',
        icon: '🐳'
    },
    {
        label: '↩ revert',
        title: 'revert',
        detail: '回滚到上一个版本',
        icon: ''
    }
];

/**
 * 获取提交类型列表（包含自定义类型）
 */
export function getCommitTypes(): Array<CommitType> {
    const customCommitTypes = workspace.getConfiguration('odinsamGitCommit').get<Array<any>>('customCommitType') || [];
    const isShowEmoji = workspace.getConfiguration('odinsamGitCommit').get<boolean>('showEmoji', true);

    let commitTypes: Array<CommitType> = [...defaultCommitTypes];

    // 添加自定义类型
    if (Array.isArray(customCommitTypes) && customCommitTypes.length > 0) {
        const customTypes: Array<CommitType> = customCommitTypes.map((item) => {
            let title = '';
            let label = '';
            let detail = '';
            let icon = '';

            if (typeof item === 'string') {
                title = label = detail = item;
            } else if (typeof item === 'object') {
                title = item.title || '';
                label = item.label || title;
                detail = item.detail || '';
                icon = item.icon || '';
            }

            return {
                title,
                label,
                detail,
                icon
            };
        });

        // 自定义类型放在前面
        commitTypes = [...customTypes, ...commitTypes];
    }

    // 如果不显示 Emoji，移除图标
    if (!isShowEmoji) {
        commitTypes = commitTypes.map((type) => {
            const labelWithoutIcon = type.label.replace(/^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
            return {
                ...type,
                label: labelWithoutIcon
            };
        });
    }

    return commitTypes;
}

export default getCommitTypes;

