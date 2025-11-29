/**
 * Git 提交模板配置
 */
import { workspace, QuickPickItem } from 'vscode';

/**
 * 提交模板接口
 */
export interface CommitTemplateType extends QuickPickItem {
    /** 模板名称 */
    templateName: string;
    /** 模板内容 */
    templateContent: string;
}

/**
 * 默认模板
 */
const defaultTemplates: Array<CommitTemplateType> = [
    {
        label: 'Angular',
        detail: '<icon> <type>(<scope>): <subject>\n\n<body>\n\n<footer>',
        templateName: 'Angular',
        templateContent: '<icon><space><type>(<scope>):<space><subject><enter><body><enter><footer>'
    }
];

/**
 * 获取提交模板列表
 */
export function getCommitTemplates(): Array<CommitTemplateType> {
    const configTemplates = workspace.getConfiguration('odinsamGitCommit').get<Array<any>>('templates') || [];

    // 如果用户配置了模板，使用配置的模板；否则使用默认模板
    if (Array.isArray(configTemplates) && configTemplates.length > 0) {
        const customTemplates: Array<CommitTemplateType> = configTemplates.map((item) => {
            return {
                label: item.templateName || 'Custom',
                detail: item.templateContent || '',
                templateName: item.templateName || 'Custom',
                templateContent: item.templateContent || ''
            };
        });

        // 去重：如果配置中有同名模板，移除默认模板中的同名项
        const templateNames = new Set(customTemplates.map(t => t.templateName));
        const filteredDefaults = defaultTemplates.filter(t => !templateNames.has(t.templateName));

        // 配置的模板放在前面，然后是不重复的默认模板
        return [...customTemplates, ...filteredDefaults];
    }

    // 如果没有配置，使用默认模板
    return [...defaultTemplates];
}

export default getCommitTemplates;

