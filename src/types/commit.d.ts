/**
 * Git 提交信息类型定义
 */

/**
 * Git 提交信息配置
 */
export interface GitCommitMessage {
    /** 模板名称 */
    templateName: string;
    /** 模板内容 */
    templateContent: string;
    /** 图标（Emoji） */
    icon: string;
    /** 提交类型（feat、fix等） */
    type: string;
    /** 修改范围 */
    scope: string;
    /** 概述 */
    subject: string;
    /** 详情 */
    body: string;
    /** 备注 */
    footer: string;
}

