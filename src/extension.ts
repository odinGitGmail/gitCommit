/**
 * VSCode 扩展主入口
 */
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitExtension } from './types/git';
import { GitCommitMessage } from './types/commit';
import { getCommitTypes, CommitType } from './config/commit-type';
import { getCommitTemplates, CommitTemplateType } from './config/template-type';
import { CommitDetailType, CommitDetailQuickPickOptions, MaxSubjectWords } from './config/commit-detail';
import CommitInputType from './config/commit-input';
import { VersionService } from './services/versionService';
import { TemplateService } from './services/templateService';
import { ConfigService } from './services/configService';
import { GitFlowService } from './services/gitFlowService';
import { TagService, TagType } from './services/tagService';

/**
 * 是否显示 Emoji 图标
 */
const isShowEmoji = workspace.getConfiguration('odinsamGitCommit').get<boolean>('showEmoji', true);

/**
 * 是否自动添加版本号
 */
const autoVersion = workspace.getConfiguration('odinsamGitCommit').get<boolean>('autoVersion', false);

/**
 * 激活扩展
 * @param context 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('[规范化 Git 提交] 扩展已激活');

    /**
     * 获取 Git 扩展
     */
    function getGitExtension(): GitExtension | undefined {
        const vscodeGit = vscode.extensions.getExtension<GitExtension>('vscode.git');
        return vscodeGit?.exports;
    }

    /**
     * 提交信息配置
     */
    const messageConfig: GitCommitMessage = {
        templateName: '',
        templateContent: '',
        icon: '',
        type: '',
        scope: '',
        subject: '',
        body: '',
        footer: ''
    };

    /**
     * 当前文件路径（用于查找项目配置文件）
     */
    let currentFilePath: string | undefined;

    /**
     * 当前选中的项目名称（用于多项目配置）
     */
    let currentProjectName: string | undefined;

    /**
     * 清除填写信息
     */
    function clearMessage() {
        Object.keys(messageConfig).forEach((key) => {
            (messageConfig as any)[key] = '';
        });
        CommitDetailType.forEach((item) => {
            item.isEdit = false;
        });
    }

    /**
     * 清除提交详情，但保留当前选择的模板
     */
    function clearMessageDetails() {
        const templateName = messageConfig.templateName;
        const templateContent = messageConfig.templateContent;
        clearMessage();
        messageConfig.templateName = templateName;
        messageConfig.templateContent = templateContent;
    }

    /**
     * 组合提交信息
     * @param config 提交信息配置
     * @returns 格式化后的提交信息
     */
    async function messageCombine(config: GitCommitMessage): Promise<string> {
        console.log(`[规范化 Git 提交] 开始组合提交信息，配置:`, {
            type: config.type,
            scope: config.scope,
            subject: config.subject,
            body: config.body ? config.body.substring(0, 50) + '...' : '',
            footer: config.footer ? config.footer.substring(0, 50) + '...' : ''
        });
        
        let result = config.templateContent;

        // 替换占位符
        result = isShowEmoji ? result.replace(/<icon>/g, config.icon) : result.replace(/<icon>/g, '');
        result = config.type !== '' ? result.replace(/<type>/g, config.type) : result.replace(/<type>/g, '');
        result = config.scope !== '' ? result.replace(/<scope>/g, config.scope) : result.replace(/<scope>/g, '');
        result = config.subject !== '' ? result.replace(/<subject>/g, config.subject) : result.replace(/<subject>/g, '');
        
        // Body 和 Footer 需要保留换行符
        if (config.body !== '') {
            result = result.replace(/<body>/g, config.body);
        } else {
            result = result.replace(/<body>/g, '');
        }
        
        if (config.footer !== '') {
            result = result.replace(/<footer>/g, config.footer);
        } else {
            result = result.replace(/<footer>/g, '');
        }
        
        result = result.replace(/<enter>/g, '\n\n');
        result = result.replace(/<space>/g, ' ');
        
        console.log(`[规范化 Git 提交] 替换占位符后的结果: ${result.substring(0, 100)}...`);

        // 如果启用自动版本号，添加版本信息
        if (autoVersion) {
            console.log('[规范化 Git 提交] autoVersion 已启用，开始获取版本号...');
            try {
                const gitExtension = getGitExtension();
                console.log('[规范化 Git 提交] Git 扩展状态:', gitExtension?.enabled ? '已启用' : '未启用');
                
                if (gitExtension?.enabled) {
                    const repo = gitExtension.getAPI(1).repositories[0];
                    console.log('[规范化 Git 提交] Git 仓库:', repo ? `找到仓库: ${repo.rootUri.fsPath}` : '未找到仓库');
                    
                    if (repo) {
                        // 使用保存的文件路径或当前活动的编辑器文件路径（用于查找项目配置文件）
                        const filePath = currentFilePath || vscode.window.activeTextEditor?.document.uri.fsPath;
                        console.log('[规范化 Git 提交] 当前文件路径:', filePath || '未找到');
                        console.log('[规范化 Git 提交] Git 仓库根目录:', repo.rootUri.fsPath);
                        console.log('[规范化 Git 提交] 当前项目名称:', currentProjectName || '未指定');
                        
                        // 传递项目名称给版本号服务
                        const versionInfo = await VersionService.getVersionInfo(repo.rootUri.fsPath, filePath, currentProjectName);
                        console.log('[规范化 Git 提交] 获取到的版本信息:', versionInfo || '空');
                        
                        if (versionInfo) {
                            result += '\n\n' + versionInfo;
                            console.log('[规范化 Git 提交] 版本信息已添加到提交信息');
                        } else {
                            console.warn('[规范化 Git 提交] 未获取到版本信息');
                        }
                    }
                } else {
                    console.warn('[规范化 Git 提交] Git 扩展未启用');
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('[规范化 Git 提交] 获取版本号失败:', errorMessage);
                console.error('[规范化 Git 提交] 错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
            }
        } else {
            console.log('[规范化 Git 提交] autoVersion 未启用，跳过版本号添加');
        }

        return result.trim();
    }

    const gitExtension = getGitExtension();
    if (!gitExtension?.enabled) {
        vscode.window.showErrorMessage('Git 扩展未启用，请先启用 Git 扩展！');
        return;
    }

    // 获取当前的 git 仓库实例
    let repo: any = gitExtension.getAPI(1).repositories[0];
    if (!repo) {
        vscode.window.showErrorMessage('未找到 Git 仓库，请先打开一个 Git 仓库！');
        return;
    }


    /**
     * 输入提交详情
     * @param key 字段键名
     */
    const inputMessageDetail = async (key: string | number): Promise<void> => {
        const detailType = CommitDetailType.find((item) => item.key === key);
        while (true) {
            CommitInputType.prompt = `${detailType?.description} 👉 ${detailType?.detail}（按 Esc 返回提交详情）`;
            const currentValue = (messageConfig as any)[key] ? (messageConfig as any)[key] : '';

            // 所有字段都使用单行输入框
            CommitInputType.value = currentValue;
            const inputValue = await vscode.window.showInputBox(CommitInputType);

            // 按 Esc 返回提交详情列表
            if (inputValue === undefined) {
                return;
            }

            // 验证 Subject 长度
            if (key === 'subject' && inputValue.length > MaxSubjectWords) {
                vscode.window.showErrorMessage(
                    `提交概述不能超过 ${MaxSubjectWords} 字，当前输入 ${inputValue.length} 字`,
                    '确定'
                );
                continue;
            }

            // 保存输入的值
            (messageConfig as any)[key] = inputValue || '';
            if (detailType) {
                detailType.isEdit = true;
            }
            return;
        }
    };

    /**
     * 输入提交详情
     */
    const recursiveInputMessage = async (): Promise<'back' | 'done'> => {
        while (true) {
            CommitDetailQuickPickOptions.placeHolder = '搜索提交描述';

            const commitDetailTypes: Array<typeof CommitDetailType[0]> = JSON.parse(JSON.stringify(CommitDetailType));
            commitDetailTypes.forEach((item: any) => {
                if (item.isEdit) {
                    const value = (messageConfig as any)[item.key || ''] || '';
                    item.description = `${item.description} 👍 >> ${value}`;
                }
            });

            const select = await vscode.window.showQuickPick(commitDetailTypes, CommitDetailQuickPickOptions);
            if (!select) {
                clearMessage();
                return 'done';
            }

            const key = select.key || 'body';
            if (key === 'complete') {
                // 完成提交信息编写
                vscode.commands.executeCommand('workbench.view.scm');
                const finalMessage = await messageCombine(messageConfig);
                repo.inputBox.value = finalMessage;
                clearMessage();
                return 'done';
            }

            if (key === 'back') {
                // 返回选择类型
                clearMessageDetails();
                return 'back';
            }

            await inputMessageDetail(key);
        }
    };

    /**
     * 开始输入提交信息
     */
    const startMessageInput = async (): Promise<'back' | 'done'> => {
        while (true) {
            CommitDetailQuickPickOptions.placeHolder = '搜索 Git 提交类型';

            const commitTypes: Array<CommitType & { isBack?: boolean }> = [
                ...getCommitTypes(),
                {
                    label: '$(arrow-left) 返回上一级',
                    detail: '返回提交模板选择',
                    title: '',
                    icon: '',
                    isBack: true
                }
            ];
            const select = await vscode.window.showQuickPick(commitTypes, CommitDetailQuickPickOptions);
            if (!select) {
                clearMessage();
                return 'done';
            }
            if (select.isBack) {
                clearMessage();
                return 'back';
            }

            messageConfig.type = select.title;
            messageConfig.icon = select.icon;

            const navigation = await recursiveInputMessage();
            if (navigation === 'back') {
                continue;
            }
            return 'done';
        }
    };

    /**
     * 查找项目根目录
     * 优先级：工作区根目录 > Git 仓库根目录 > 包含 package.json 或 .csproj 的目录 > 起始目录
     */
    const findProjectRoot = (startPath: string): string => {
        // 1. 优先使用工作区根目录
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            console.log(`[查找项目根目录] 使用工作区根目录: ${workspaceRoot}`);
            return workspaceRoot;
        }

        // 2. 尝试使用 Git 仓库根目录
        const gitExtension = getGitExtension();
        if (gitExtension) {
            try {
                const gitApi = gitExtension.getAPI(1);
                if (gitApi.repositories && gitApi.repositories.length > 0) {
                    const gitRoot = gitApi.repositories[0].rootUri.fsPath;
                    console.log(`[查找项目根目录] 使用 Git 仓库根目录: ${gitRoot}`);
                    return gitRoot;
                }
            } catch (error) {
                console.log(`[查找项目根目录] 获取 Git 仓库根目录失败: ${error}`);
            }
        }

        // 3. 向上查找包含 package.json 或 .csproj 的目录
        let currentPath = startPath;
        
        // 如果是文件，获取其所在目录
        if (fs.existsSync(currentPath) && fs.statSync(currentPath).isFile()) {
            currentPath = path.dirname(currentPath);
        }

        // 向上查找直到找到项目标识文件或到达根目录
        while (currentPath !== path.dirname(currentPath)) {
            const packageJsonPath = path.join(currentPath, 'package.json');
            const hasPackageJson = fs.existsSync(packageJsonPath);
            
            // 检查是否有 .csproj 文件（在当前目录中）
            let hasCsproj = false;
            try {
                const files = fs.readdirSync(currentPath);
                hasCsproj = files.some(file => file.endsWith('.csproj'));
            } catch (error) {
                // 忽略读取目录失败的错误
            }
            
            // 如果找到 package.json 或 .csproj，返回项目根目录
            if (hasPackageJson || hasCsproj) {
                console.log(`[查找项目根目录] 找到项目标识文件，使用目录: ${currentPath}`);
                return currentPath;
            }
            
            currentPath = path.dirname(currentPath);
        }

        // 4. 如果都找不到，返回起始目录（确保是目录而不是文件）
        let finalPath = startPath;
        if (fs.existsSync(finalPath) && fs.statSync(finalPath).isFile()) {
            finalPath = path.dirname(finalPath);
        }
        console.log(`[查找项目根目录] 使用起始目录: ${finalPath}`);
        return finalPath;
    };

    /**
     * 询问并创建 .gitcommit 配置文件
     */
    const askAndCreateConfig = async (): Promise<boolean> => {
        // 获取当前工作区或文件路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const activeEditor = vscode.window.activeTextEditor;
        
        // 确定起始目录
        let startDir: string | undefined;
        if (activeEditor) {
            startDir = activeEditor.document.uri.fsPath;
        } else if (workspaceFolders && workspaceFolders.length > 0) {
            startDir = workspaceFolders[0].uri.fsPath;
        }

        if (!startDir) {
            return true; // 无法确定目录，直接继续
        }

        // 查找项目根目录
        const targetDir = findProjectRoot(startDir);

        // 检查是否已有配置文件
        const hasConfig = TemplateService.hasGitCommitConfig(targetDir);
        if (hasConfig) {
            // 如果已有配置文件，直接继续
            return true;
        }

        // 询问用户是否需要创建配置文件
        const createConfig = await vscode.window.showInformationMessage(
            `是否在 ${path.basename(targetDir)} 目录创建规范化提交配置模板？`,
            { modal: true },
            '创建单项目配置',
            '创建多项目配置',
            '跳过'
        );

        if (createConfig === '跳过' || !createConfig) {
            return true; // 跳过，继续提交流程
        }

        // 确定模板类型
        const templateType = createConfig === '创建单项目配置' ? 'single' : 'multi';
        
        // 创建配置文件
        const success = await TemplateService.createGitCommitConfig(targetDir, templateType);
        
        if (success) {
            // 询问是否打开配置文件进行编辑
            const openFile = await vscode.window.showInformationMessage(
                '配置文件已创建，是否打开进行编辑？',
                '打开',
                '稍后编辑'
            );

            if (openFile === '打开') {
                const configPath = path.join(targetDir, '.gitcommit');
                const document = await vscode.workspace.openTextDocument(configPath);
                await vscode.window.showTextDocument(document);
            }
        }

        return true; // 无论是否创建成功，都继续提交流程
    };

    /**
     * 检查配置文件并让用户选择项目（如果是多项目配置）
     */
    const checkAndSelectProject = async (): Promise<void> => {
        // 重置项目名称
        currentProjectName = undefined;

        // 获取当前工作区或文件路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const activeEditor = vscode.window.activeTextEditor;
        
        // 确定起始目录
        let startDir: string | undefined;
        if (activeEditor) {
            startDir = activeEditor.document.uri.fsPath;
        } else if (workspaceFolders && workspaceFolders.length > 0) {
            startDir = workspaceFolders[0].uri.fsPath;
        }

        if (!startDir) {
            console.log('[项目选择] 无法确定目录，跳过项目选择');
            return;
        }

        // 查找项目根目录
        const targetDir = findProjectRoot(startDir);

        // 检查是否已有配置文件
        const hasConfig = TemplateService.hasGitCommitConfig(targetDir);
        if (!hasConfig) {
            console.log('[项目选择] 未找到配置文件，跳过项目选择');
            return;
        }

        // 读取配置文件
        const configFile = ConfigService.readConfig(targetDir);
        if (!configFile) {
            console.log('[项目选择] 无法读取配置文件，跳过项目选择');
            return;
        }

        // 如果是多项目配置，让用户选择项目
        if (configFile.config && Array.isArray(configFile.config) && configFile.config.length > 0) {
            console.log(`[项目选择] 检测到多项目配置，共 ${configFile.config.length} 个项目`);
            
            // 构建项目选择列表
            const projectOptions = configFile.config.map((project, index) => {
                const label = project.projectName || `项目 ${index + 1}`;
                const description = project.description || project.path || '';
                return {
                    label: label,
                    description: description,
                    projectName: project.projectName
                };
            });

            // 让用户选择项目
            const selected = await vscode.window.showQuickPick(projectOptions, {
                placeHolder: '请选择要提交的项目',
                ignoreFocusOut: false
            });

            if (selected && selected.projectName) {
                currentProjectName = selected.projectName;
                console.log(`[项目选择] 用户选择了项目: ${currentProjectName}`);
            } else {
                // 用户取消选择，不设置项目名称（版本号将无效）
                console.log('[项目选择] 用户取消选择项目，版本号将无效');
                currentProjectName = undefined;
            }
        } else {
            // 单项目配置，不需要选择
            console.log('[项目选择] 单项目配置，无需选择项目');
            if (configFile.projectName) {
                currentProjectName = configFile.projectName;
            }
        }
    };


    /**
     * 选择提交模板（Commit 流程中使用，不添加版本信息）
     */
    const selectTemplate = async (): Promise<'back' | 'done'> => {
        while (true) {
            CommitDetailQuickPickOptions.placeHolder = '选择提交使用的模板';

            const templates: Array<CommitTemplateType & { isBack?: boolean }> = [
                ...getCommitTemplates(),
                {
                    label: '$(arrow-left) 返回上一级',
                    detail: '返回提交代码或标记管理选择',
                    templateName: '',
                    templateContent: '',
                    isBack: true
                }
            ];
            const select = await vscode.window.showQuickPick(templates, CommitDetailQuickPickOptions);
            if (!select) {
                clearMessage();
                return 'done';
            }
            if (select.isBack) {
                clearMessage();
                return 'back';
            }

            messageConfig.templateName = select.templateName;
            messageConfig.templateContent = select.templateContent;

            const navigation = await startMessageInput();
            if (navigation === 'back') {
                continue;
            }
            return 'done';
        }
    };

    /**
     * 选择远程仓库
     */
    const selectRemote = async (
        repositoryRoot: string,
        placeHolder: string
    ): Promise<{ action: 'select'; remote: string } | { action: 'back' } | undefined> => {
        const remotes = await TagService.getRemotes(repositoryRoot);
        if (remotes.length === 0) {
            vscode.window.showWarningMessage('当前仓库没有配置远程仓库');
            return { action: 'back' };
        }

        const selected = await vscode.window.showQuickPick(
            [
                ...remotes.map(remote => ({
                    label: remote,
                    action: 'select' as const,
                    remote
                })),
                {
                    label: '$(arrow-left) 返回上一级',
                    action: 'back' as const,
                    remote: ''
                }
            ],
            { placeHolder, ignoreFocusOut: false }
        );
        if (!selected) {
            return undefined;
        }
        return selected.action === 'back'
            ? { action: 'back' }
            : { action: 'select', remote: selected.remote };
    };

    /**
     * 创建 Git 标记
     */
    const createTag = async (repositoryRoot: string): Promise<'back' | 'done'> => {
        type CreateStep = 'type' | 'target' | 'name' | 'message';

        let step: CreateStep = 'type';
        let tagType: TagType | undefined;
        let target: string | undefined;
        let tagName: string | undefined;
        const branches = await TagService.getLocalBranches(repositoryRoot);

        while (true) {
            if (step === 'type') {
                const selected = await vscode.window.showQuickPick(
                    [
                        {
                            label: '$(tag) 附注标记',
                            detail: '包含创建者、创建时间和标记说明',
                            value: 'annotated' as TagType
                        },
                        {
                            label: '$(bookmark) 轻量标记',
                            detail: '仅作为指向提交的名称',
                            value: 'lightweight' as TagType
                        },
                        {
                            label: '$(arrow-left) 返回上一级',
                            detail: '返回标记管理',
                            value: 'back' as const
                        }
                    ],
                    { placeHolder: '选择标记类型', ignoreFocusOut: false }
                );
                if (!selected) {
                    return 'done';
                }
                if (selected.value === 'back') {
                    return 'back';
                }
                tagType = selected.value;
                step = 'target';
                continue;
            }

            if (step === 'target') {
                const selected = await vscode.window.showQuickPick(
                    [
                        {
                            label: '$(git-commit) 当前分支最新提交',
                            description: 'HEAD',
                            target: 'HEAD',
                            isBack: false
                        },
                        ...branches.map(branch => ({
                            label: `$(git-branch) ${branch}`,
                            description: '本地分支最新提交',
                            target: branch,
                            isBack: false
                        })),
                        {
                            label: '$(arrow-left) 返回上一级',
                            description: '重新选择标记类型',
                            target: '',
                            isBack: true
                        }
                    ],
                    { placeHolder: '选择标记指向的提交', ignoreFocusOut: false }
                );
                if (!selected) {
                    return 'done';
                }
                if (selected.isBack) {
                    step = 'type';
                    continue;
                }
                target = selected.target;
                step = 'name';
                continue;
            }

            if (step === 'name') {
                const inputName = await vscode.window.showInputBox({
                    prompt: '请输入标记名称（按 Esc 返回目标选择）',
                    placeHolder: tagName || '例如：v1.0.0',
                    value: tagName,
                    ignoreFocusOut: false,
                    validateInput: value => value.trim() ? undefined : '标记名称不能为空'
                });
                if (inputName === undefined) {
                    step = 'target';
                    continue;
                }

                if (!await TagService.isValidTagName(repositoryRoot, inputName)) {
                    vscode.window.showErrorMessage(`标记名称“${inputName}”不符合 Git 命名规则`);
                    continue;
                }

                const localTags = await TagService.getLocalTags(repositoryRoot);
                if (localTags.includes(inputName)) {
                    vscode.window.showErrorMessage(`本地标记“${inputName}”已存在`);
                    continue;
                }

                tagName = inputName;
                if (tagType === 'annotated') {
                    step = 'message';
                    continue;
                }
            }

            if (step === 'message') {
                const message = await vscode.window.showInputBox({
                    prompt: '请输入附注标记说明（按 Esc 返回标记名称输入）',
                    placeHolder: `发布 ${tagName}`,
                    ignoreFocusOut: false,
                    validateInput: value => value.trim() ? undefined : '附注标记说明不能为空'
                });
                if (message === undefined) {
                    step = 'name';
                    continue;
                }

                await TagService.createTag(
                    repositoryRoot,
                    tagName!,
                    tagType!,
                    target!,
                    message.trim()
                );
            } else {
                await TagService.createTag(repositoryRoot, tagName!, tagType!, target!);
            }

            vscode.window.showInformationMessage(`标记“${tagName}”创建成功`);
            return 'done';
        }
    };

    /**
     * 删除本地 Git 标记
     */
    const deleteLocalTags = async (repositoryRoot: string): Promise<'back' | 'done'> => {
        const tags = await TagService.getLocalTags(repositoryRoot);
        if (tags.length === 0) {
            vscode.window.showWarningMessage('当前仓库没有本地标记');
            return 'back';
        }

        const selected = await vscode.window.showQuickPick(
            [
                ...tags.map(tag => ({ label: tag, tag, isBack: false })),
                {
                    label: '$(arrow-left) 返回上一级',
                    tag: '',
                    isBack: true
                }
            ],
            {
                placeHolder: '选择要删除的本地标记（可多选）',
                canPickMany: true,
                ignoreFocusOut: false
            }
        );
        if (!selected || selected.length === 0) {
            return 'done';
        }
        if (selected.some(item => item.isBack)) {
            return 'back';
        }

        const tagNames = selected.map(item => item.tag);
        const confirmation = await vscode.window.showWarningMessage(
            `确定删除 ${tagNames.length} 个本地标记吗？\n${tagNames.join('、')}`,
            { modal: true },
            '确认删除'
        );
        if (confirmation !== '确认删除') {
            return 'done';
        }

        await TagService.deleteLocalTags(repositoryRoot, tagNames);
        vscode.window.showInformationMessage(`已删除 ${tagNames.length} 个本地标记`);
        return 'done';
    };

    /**
     * 删除远程 Git 标记
     */
    const deleteRemoteTags = async (repositoryRoot: string): Promise<'back' | 'done'> => {
        while (true) {
            const remoteSelection = await selectRemote(repositoryRoot, '选择要删除标记的远程仓库');
            if (!remoteSelection) {
                return 'done';
            }
            if (remoteSelection.action === 'back') {
                return 'back';
            }
            const remote = remoteSelection.remote;

            const tags = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `正在获取远程仓库“${remote}”的标记`,
                    cancellable: false
                },
                () => TagService.getRemoteTags(repositoryRoot, remote)
            );
            if (tags.length === 0) {
                vscode.window.showWarningMessage(`远程仓库“${remote}”没有标记`);
                continue;
            }

            const selected = await vscode.window.showQuickPick(
                [
                    ...tags.map(tag => ({ label: tag, tag, isBack: false })),
                    {
                        label: '$(arrow-left) 返回上一级',
                        tag: '',
                        isBack: true
                    }
                ],
                {
                    placeHolder: `选择要从“${remote}”删除的标记（可多选）`,
                    canPickMany: true,
                    ignoreFocusOut: false
                }
            );
            if (!selected || selected.length === 0) {
                return 'done';
            }
            if (selected.some(item => item.isBack)) {
                continue;
            }

            const tagNames = selected.map(item => item.tag);
            const confirmation = await vscode.window.showWarningMessage(
                `确定从远程仓库“${remote}”删除 ${tagNames.length} 个标记吗？\n${tagNames.join('、')}`,
                { modal: true },
                '确认删除'
            );
            if (confirmation !== '确认删除') {
                return 'done';
            }

            await TagService.deleteRemoteTags(repositoryRoot, remote, tagNames);
            vscode.window.showInformationMessage(
                `已从远程仓库“${remote}”删除 ${tagNames.length} 个标记`
            );
            return 'done';
        }
    };

    /**
     * 推送全部本地 Git 标记
     */
    const pushAllTags = async (repositoryRoot: string): Promise<'back' | 'done'> => {
        const remoteSelection = await selectRemote(repositoryRoot, '选择要推送标记的远程仓库');
        if (!remoteSelection) {
            return 'done';
        }
        if (remoteSelection.action === 'back') {
            return 'back';
        }
        const remote = remoteSelection.remote;

        const localTags = await TagService.getLocalTags(repositoryRoot);
        if (localTags.length === 0) {
            vscode.window.showWarningMessage('当前仓库没有可推送的本地标记');
            return 'back';
        }

        const remoteTags = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `正在获取远程仓库“${remote}”的标记`,
                cancellable: false
            },
            () => TagService.getRemoteTags(repositoryRoot, remote)
        );
        const remoteTagSet = new Set(remoteTags);
        const newTagCount = localTags.filter(tag => !remoteTagSet.has(tag)).length;

        const confirmation = await vscode.window.showWarningMessage(
            `确定向远程仓库“${remote}”推送全部 ${localTags.length} 个本地标记吗？`
                + ` 其中 ${newTagCount} 个标记名称尚不存在于远程仓库。`,
            { modal: true },
            '确认推送'
        );
        if (confirmation !== '确认推送') {
            return 'done';
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `正在向“${remote}”推送全部本地标记`,
                cancellable: false
            },
            () => TagService.pushAllTags(repositoryRoot, remote)
        );
        vscode.window.showInformationMessage(`本地标记已推送到远程仓库“${remote}”`);
        return 'done';
    };

    /**
     * Git 标记管理面板
     */
    const showTagManagement = async (repositoryRoot: string): Promise<'back' | 'done'> => {
        while (true) {
            const selected = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(add) 创建标记',
                        detail: '创建轻量标记或附注标记',
                        value: 'create'
                    },
                    {
                        label: '$(trash) 删除本地标记',
                        detail: '选择一个或多个本地标记进行删除',
                        value: 'delete-local'
                    },
                    {
                        label: '$(cloud) 删除远程标记',
                        detail: '实时获取并删除指定远程仓库中的标记',
                        value: 'delete-remote'
                    },
                    {
                        label: '$(cloud-upload) 推送全部标记',
                        detail: '将全部本地标记推送到指定远程仓库',
                        value: 'push-all'
                    },
                    {
                        label: '$(arrow-left) 返回上一级',
                        detail: '返回提交代码或标记管理选择',
                        value: 'back'
                    }
                ],
                { placeHolder: '选择标记操作', ignoreFocusOut: false }
            );
            if (!selected) {
                return 'done';
            }
            if (selected.value === 'back') {
                return 'back';
            }

            try {
                let result: 'back' | 'done';
                switch (selected.value) {
                    case 'create':
                        result = await createTag(repositoryRoot);
                        break;
                    case 'delete-local':
                        result = await deleteLocalTags(repositoryRoot);
                        break;
                    case 'delete-remote':
                        result = await deleteRemoteTags(repositoryRoot);
                        break;
                    case 'push-all':
                        result = await pushAllTags(repositoryRoot);
                        break;
                    default:
                        return 'done';
                }

                if (result === 'back') {
                    continue;
                }
                return 'done';
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`标记操作失败：${errorMessage}`);
            }
        }
    };

    // 注册命令
    const disposable = vscode.commands.registerCommand('odinsamGitCommit.showCommit', async (uri?: any) => {
        // 如果有多个仓库，可以根据 uri 查找对应的仓库
        if (uri) {
            const repositories = gitExtension.getAPI(1).repositories;
            const requestedRootPath = uri._rootUri?.path || uri.rootUri?.path;
            repo = repositories.find((r: any) => {
                return r.rootUri.path === requestedRootPath;
            }) || repo;
        }

        while (true) {
            const selectedOperation = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(git-commit) 提交代码',
                        detail: '使用现有规范化 Git 提交流程',
                        value: 'commit'
                    },
                    {
                        label: '$(tag) 标记管理',
                        detail: '创建、删除或推送 Git 标记',
                        value: 'tag'
                    }
                ],
                { placeHolder: '请选择要执行的操作', ignoreFocusOut: false }
            );
            if (!selectedOperation) {
                return;
            }

            if (selectedOperation.value === 'commit') {
                // 保存当前文件路径（用于后续获取版本号）
                const activeEditor = vscode.window.activeTextEditor;
                currentFilePath = activeEditor?.document.uri.fsPath || uri?.fsPath;

                // 先询问是否需要创建配置文件
                await askAndCreateConfig();

                // 检查配置文件并让用户选择项目（如果是多项目配置）
                await checkAndSelectProject();

                const navigation = await selectTemplate();
                if (navigation === 'back') {
                    continue;
                }
                return;
            }

            const navigation = await showTagManagement(repo.rootUri.fsPath);
            if (navigation === 'back') {
                continue;
            }
            return;
        }
    });

    context.subscriptions.push(disposable);

    // ==================== Git Flow 命令 ====================

    /**
     * Git Flow 快速操作面板
     */
    const gitFlowShow = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.show', async () => {
        // 首先检查是否在 Git 仓库中
        const isGitRepo = await GitFlowService.isGitRepository();
        if (!isGitRepo) {
            vscode.window.showWarningMessage('当前不在 Git 仓库中，请先打开一个 Git 仓库');
            return;
        }

        // 检测当前分支类型和分支名称
        const currentBranchType = await GitFlowService.getCurrentBranchType();
        let currentBranchName = '';
        
        try {
            const gitExtension = getGitExtension();
            if (gitExtension?.enabled) {
                const repo = gitExtension.getAPI(1).repositories[0];
                if (repo) {
                    // 使用 VSCode Git API 获取当前分支
                    const state = repo.state;
                    if (state.HEAD && state.HEAD.name) {
                        currentBranchName = state.HEAD.name;
                    } else {
                        // 如果 VSCode API 不可用，使用 git 命令
                        const repoRoot = repo.rootUri.fsPath;
                        const { execFile } = await import('child_process');
                        const util = await import('util');
                        const execFilePromise = util.promisify(execFile);
                        const result = await execFilePromise('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                            cwd: repoRoot,
                            maxBuffer: 1024 * 1024
                        });
                        currentBranchName = result.stdout.trim();
                    }
                }
            }
        } catch (error) {
            console.log('[Git Flow] 获取当前分支名称失败:', error);
        }

        const options: Array<{ label: string; detail: string; value: string }> = [];

        // 根据当前分支类型，优先显示相关操作
        if (currentBranchType === 'feature') {
            // 当前在 Feature 分支上，优先显示完成操作
            options.push({
                label: `$(check) 完成当前 Feature 分支`,
                detail: `完成当前分支 "${currentBranchName}" 并合并到 develop`,
                value: 'feature-finish-current'
            });
            options.push({
                label: '$(git-branch) Feature: 开始新的',
                detail: '从 develop 创建新的 Feature 分支',
                value: 'feature-start'
            });
            options.push({
                label: '$(check) Feature: 完成其他',
                detail: '完成其他 Feature 分支并合并到 develop',
                value: 'feature-finish'
            });
        } else if (currentBranchType === 'release') {
            // 当前在 Release 分支上，优先显示完成操作
            options.push({
                label: `$(tag) 完成当前 Release 分支`,
                detail: `完成当前分支 "${currentBranchName}"，合并到 master 和 develop，创建标签`,
                value: 'release-finish-current'
            });
            options.push({
                label: '$(rocket) Release: 开始新的',
                detail: '从 develop 创建新的 Release 分支',
                value: 'release-start'
            });
            options.push({
                label: '$(tag) Release: 完成其他',
                detail: '完成其他 Release 分支，合并到 master 和 develop，创建标签',
                value: 'release-finish'
            });
        } else if (currentBranchType === 'hotfix') {
            // 当前在 Hotfix 分支上，优先显示完成操作
            options.push({
                label: `$(tools) 完成当前 Hotfix 分支`,
                detail: `完成当前分支 "${currentBranchName}"，合并到 master 和 develop，创建标签`,
                value: 'hotfix-finish-current'
            });
            options.push({
                label: '$(warning) Hotfix: 开始新的',
                detail: '从 master 创建新的 Hotfix 分支',
                value: 'hotfix-start'
            });
            options.push({
                label: '$(tools) Hotfix: 完成其他',
                detail: '完成其他 Hotfix 分支，合并到 master 和 develop，创建标签',
                value: 'hotfix-finish'
            });
        } else {
            // 不在任何 Git Flow 分支上，显示所有操作
            const isInitialized = await GitFlowService.isInitialized();
            if (!isInitialized) {
                options.push({
                    label: '$(settings-gear) 初始化 Git Flow',
                    detail: '初始化 Git Flow 工作流程',
                    value: 'init'
                });
            }
            
            options.push({
                label: '$(git-branch) Feature: 开始',
                detail: '从 develop 创建新的 Feature 分支',
                value: 'feature-start'
            });
            options.push({
                label: '$(check) Feature: 完成',
                detail: '完成 Feature 分支并合并到 develop',
                value: 'feature-finish'
            });
            options.push({
                label: '$(rocket) Release: 开始',
                detail: '从 develop 创建新的 Release 分支',
                value: 'release-start'
            });
            options.push({
                label: '$(tag) Release: 完成',
                detail: '完成 Release 分支，合并到 master 和 develop，创建标签',
                value: 'release-finish'
            });
            options.push({
                label: '$(warning) Hotfix: 开始',
                detail: '从 master 创建新的 Hotfix 分支',
                value: 'hotfix-start'
            });
            options.push({
                label: '$(tools) Hotfix: 完成',
                detail: '完成 Hotfix 分支，合并到 master 和 develop，创建标签',
                value: 'hotfix-finish'
            });
        }

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: currentBranchType 
                ? `当前在 ${currentBranchType} 分支 "${currentBranchName}"，选择操作` 
                : '选择 Git Flow 操作',
            ignoreFocusOut: false
        });

        if (!selected) {
            return;
        }

        // 根据选择执行相应的命令
        switch (selected.value) {
            case 'init':
                await vscode.commands.executeCommand('odinsamGitCommit.gitFlow.init');
                break;
            case 'feature-start':
                await vscode.commands.executeCommand('odinsamGitCommit.gitFlow.feature.start');
                break;
            case 'feature-finish':
                await vscode.commands.executeCommand('odinsamGitCommit.gitFlow.feature.finish');
                break;
            case 'feature-finish-current':
                // 完成当前 Feature 分支
                if (currentBranchName) {
                    const featureName = currentBranchName.replace(/^feature\//, '');
                    try {
                        const keepBranch = await vscode.window.showQuickPick(
                            [
                                { label: '删除分支', value: false },
                                { label: '保留分支', value: true }
                            ],
                            {
                                placeHolder: '是否保留分支？'
                            }
                        );
                        await GitFlowService.finishFeature(featureName, keepBranch?.value || false);
                        vscode.window.showInformationMessage(`Feature 分支 "${currentBranchName}" 已完成！`);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`完成 Feature 分支失败: ${errorMessage}`);
                    }
                }
                break;
            case 'release-start':
                await vscode.commands.executeCommand('odinsamGitCommit.gitFlow.release.start');
                break;
            case 'release-finish':
                await vscode.commands.executeCommand('odinsamGitCommit.gitFlow.release.finish');
                break;
            case 'release-finish-current':
                // 完成当前 Release 分支
                if (currentBranchName) {
                    const version = currentBranchName.replace(/^release\//, '');
                    try {
                        const tagMessage = await vscode.window.showInputBox({
                            prompt: 'Tag 消息（可选）',
                            placeHolder: `Release ${version}`
                        });
                        const keepBranch = await vscode.window.showQuickPick(
                            [
                                { label: '删除分支', value: false },
                                { label: '保留分支', value: true }
                            ],
                            {
                                placeHolder: '是否保留分支？'
                            }
                        );
                        await GitFlowService.finishRelease(version, keepBranch?.value || false, tagMessage?.trim());
                        vscode.window.showInformationMessage(`Release 分支 "${currentBranchName}" 已完成！`);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`完成 Release 分支失败: ${errorMessage}`);
                    }
                }
                break;
            case 'hotfix-start':
                await vscode.commands.executeCommand('odinsamGitCommit.gitFlow.hotfix.start');
                break;
            case 'hotfix-finish':
                await vscode.commands.executeCommand('odinsamGitCommit.gitFlow.hotfix.finish');
                break;
            case 'hotfix-finish-current':
                // 完成当前 Hotfix 分支
                if (currentBranchName) {
                    const version = currentBranchName.replace(/^hotfix\//, '');
                    try {
                        const tagMessage = await vscode.window.showInputBox({
                            prompt: 'Tag 消息（可选）',
                            placeHolder: `Hotfix ${version}`
                        });
                        const keepBranch = await vscode.window.showQuickPick(
                            [
                                { label: '删除分支', value: false },
                                { label: '保留分支', value: true }
                            ],
                            {
                                placeHolder: '是否保留分支？'
                            }
                        );
                        await GitFlowService.finishHotfix(version, keepBranch?.value || false, tagMessage?.trim());
                        vscode.window.showInformationMessage(`Hotfix 分支 "${currentBranchName}" 已完成！`);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`完成 Hotfix 分支失败: ${errorMessage}`);
                    }
                }
                break;
        }
    });

    context.subscriptions.push(gitFlowShow);

    // ==================== Git Flow 命令 ====================

    /**
     * Git Flow 初始化
     */
    const gitFlowInit = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.init', async () => {
        try {
            const isInitialized = await GitFlowService.isInitialized();
            if (isInitialized) {
                const overwrite = await vscode.window.showWarningMessage(
                    'Git Flow 已初始化，是否重新初始化？',
                    { modal: true },
                    '重新初始化',
                    '取消'
                );
                if (overwrite !== '重新初始化') {
                    return;
                }
            }

            // 询问配置选项
            const masterBranch = await vscode.window.showInputBox({
                prompt: '主分支名称',
                value: 'master',
                placeHolder: '例如：master 或 main'
            });
            if (!masterBranch) return;

            const developBranch = await vscode.window.showInputBox({
                prompt: '开发分支名称',
                value: 'develop',
                placeHolder: '例如：develop'
            });
            if (!developBranch) return;

            await GitFlowService.init({
                masterBranch: masterBranch.trim(),
                developBranch: developBranch.trim()
            });

            vscode.window.showInformationMessage('Git Flow 初始化成功！');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Git Flow 初始化失败: ${errorMessage}`);
        }
    });

    /**
     * 开始 Feature 分支
     */
    const gitFlowFeatureStart = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.feature.start', async () => {
        try {
            // 检查是否在 Git 仓库中
            const isGitRepo = await GitFlowService.isGitRepository();
            if (!isGitRepo) {
                vscode.window.showWarningMessage('当前不在 Git 仓库中，请先打开一个 Git 仓库');
                return;
            }

            const featureName = await vscode.window.showInputBox({
                prompt: '请输入 Feature 名称',
                placeHolder: '例如：user-login',
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return 'Feature 名称不能为空';
                    }
                    if (!/^[a-z0-9-]+$/i.test(value)) {
                        return 'Feature 名称只能包含字母、数字和连字符';
                    }
                    return null;
                }
            });

            if (!featureName) return;

            await GitFlowService.startFeature(featureName.trim());
            vscode.window.showInformationMessage(`Feature 分支 "${featureName}" 已创建并切换！`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`创建 Feature 分支失败: ${errorMessage}`);
        }
    });

    /**
     * 完成 Feature 分支
     */
    const gitFlowFeatureFinish = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.feature.finish', async () => {
        try {
            // 检查是否在 Git 仓库中
            const isGitRepo = await GitFlowService.isGitRepository();
            if (!isGitRepo) {
                vscode.window.showWarningMessage('当前不在 Git 仓库中，请先打开一个 Git 仓库');
                return;
            }

            const branches = await GitFlowService.getFeatureBranches();
            if (branches.length === 0) {
                vscode.window.showWarningMessage('没有找到 Feature 分支');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                branches.map(b => ({
                    label: b,
                    value: b
                })),
                {
                    placeHolder: '选择要完成的 Feature 分支'
                }
            );

            if (!selected) return;

            const featureName = selected.value.replace(/^feature\//, '');
            const keepBranch = await vscode.window.showQuickPick(
                [
                    { label: '删除分支', value: false },
                    { label: '保留分支', value: true }
                ],
                {
                    placeHolder: '是否保留分支？'
                }
            );

            await GitFlowService.finishFeature(featureName, keepBranch?.value || false);
            vscode.window.showInformationMessage(`Feature 分支 "${selected.value}" 已完成！`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`完成 Feature 分支失败: ${errorMessage}`);
        }
    });

    /**
     * 开始 Release 分支
     */
    const gitFlowReleaseStart = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.release.start', async () => {
        try {
            const version = await vscode.window.showInputBox({
                prompt: '请输入版本号',
                placeHolder: '例如：1.0.0',
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return '版本号不能为空';
                    }
                    return null;
                }
            });

            if (!version) return;

            await GitFlowService.startRelease(version.trim());
            vscode.window.showInformationMessage(`Release 分支 "${version}" 已创建并切换！`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`创建 Release 分支失败: ${errorMessage}`);
        }
    });

    /**
     * 完成 Release 分支
     */
    const gitFlowReleaseFinish = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.release.finish', async () => {
        try {
            // 检查是否在 Git 仓库中
            const isGitRepo = await GitFlowService.isGitRepository();
            if (!isGitRepo) {
                vscode.window.showWarningMessage('当前不在 Git 仓库中，请先打开一个 Git 仓库');
                return;
            }

            const branches = await GitFlowService.getReleaseBranches();
            if (branches.length === 0) {
                vscode.window.showWarningMessage('没有找到 Release 分支');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                branches.map(b => ({
                    label: b,
                    value: b
                })),
                {
                    placeHolder: '选择要完成的 Release 分支'
                }
            );

            if (!selected) return;

            const version = selected.value.replace(/^release\//, '');
            const tagMessage = await vscode.window.showInputBox({
                prompt: 'Tag 消息（可选）',
                placeHolder: `Release ${version}`
            });

            const keepBranch = await vscode.window.showQuickPick(
                [
                    { label: '删除分支', value: false },
                    { label: '保留分支', value: true }
                ],
                {
                    placeHolder: '是否保留分支？'
                }
            );

            await GitFlowService.finishRelease(version, keepBranch?.value || false, tagMessage?.trim());
            vscode.window.showInformationMessage(`Release 分支 "${selected.value}" 已完成！`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`完成 Release 分支失败: ${errorMessage}`);
        }
    });

    /**
     * 开始 Hotfix 分支
     */
    const gitFlowHotfixStart = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.hotfix.start', async () => {
        try {
            // 检查是否在 Git 仓库中
            const isGitRepo = await GitFlowService.isGitRepository();
            if (!isGitRepo) {
                vscode.window.showWarningMessage('当前不在 Git 仓库中，请先打开一个 Git 仓库');
                return;
            }

            const version = await vscode.window.showInputBox({
                prompt: '请输入版本号',
                placeHolder: '例如：1.0.1',
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return '版本号不能为空';
                    }
                    return null;
                }
            });

            if (!version) return;

            await GitFlowService.startHotfix(version.trim());
            vscode.window.showInformationMessage(`Hotfix 分支 "${version}" 已创建并切换！`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`创建 Hotfix 分支失败: ${errorMessage}`);
        }
    });

    /**
     * 完成 Hotfix 分支
     */
    const gitFlowHotfixFinish = vscode.commands.registerCommand('odinsamGitCommit.gitFlow.hotfix.finish', async () => {
        try {
            // 检查是否在 Git 仓库中
            const isGitRepo = await GitFlowService.isGitRepository();
            if (!isGitRepo) {
                vscode.window.showWarningMessage('当前不在 Git 仓库中，请先打开一个 Git 仓库');
                return;
            }

            const branches = await GitFlowService.getHotfixBranches();
            if (branches.length === 0) {
                vscode.window.showWarningMessage('没有找到 Hotfix 分支');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                branches.map(b => ({
                    label: b,
                    value: b
                })),
                {
                    placeHolder: '选择要完成的 Hotfix 分支'
                }
            );

            if (!selected) return;

            const version = selected.value.replace(/^hotfix\//, '');
            const tagMessage = await vscode.window.showInputBox({
                prompt: 'Tag 消息（可选）',
                placeHolder: `Hotfix ${version}`
            });

            const keepBranch = await vscode.window.showQuickPick(
                [
                    { label: '删除分支', value: false },
                    { label: '保留分支', value: true }
                ],
                {
                    placeHolder: '是否保留分支？'
                }
            );

            await GitFlowService.finishHotfix(version, keepBranch?.value || false, tagMessage?.trim());
            vscode.window.showInformationMessage(`Hotfix 分支 "${selected.value}" 已完成！`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`完成 Hotfix 分支失败: ${errorMessage}`);
        }
    });

    // 注册所有 Git Flow 命令
    context.subscriptions.push(
        gitFlowInit,
        gitFlowFeatureStart,
        gitFlowFeatureFinish,
        gitFlowReleaseStart,
        gitFlowReleaseFinish,
        gitFlowHotfixStart,
        gitFlowHotfixFinish
    );
}

/**
 * 停用扩展
 */
export function deactivate() {
    console.log('[规范化 Git 提交] 扩展已停用');
}

