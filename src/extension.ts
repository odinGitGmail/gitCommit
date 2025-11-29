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
    const inputMessageDetail = async (key: string | number) => {
        const detailType = CommitDetailType.find((item) => item.key === key);
        CommitInputType.prompt = `${detailType?.description} 👉 ${detailType?.detail}`;
        const currentValue = (messageConfig as any)[key] ? (messageConfig as any)[key] : '';

        // 所有字段都使用单行输入框
        CommitInputType.value = currentValue;
        const inputValue = await vscode.window.showInputBox(CommitInputType);

        // 如果用户取消，返回上一级
        if (inputValue === undefined) {
            await recursiveInputMessage(startMessageInput);
            return;
        }

        // 保存输入的值
        (messageConfig as any)[key] = inputValue || '';

        if (detailType) {
            detailType.isEdit = true;
        }

        // 验证 Subject 长度
        if (key === 'subject') {
            const inputValueLength = inputValue.length;
            if (inputValueLength > MaxSubjectWords) {
                vscode.window.showErrorMessage(
                    `提交概述不能超过 ${MaxSubjectWords} 字，当前输入 ${inputValueLength} 字`,
                    '确定'
                );
                await inputMessageDetail(key);
                return;
            }
        }

        await recursiveInputMessage(startMessageInput);
    };

    /**
     * 递归输入信息
     * @param startMessageInput 开始输入函数
     */
    const recursiveInputMessage = async (startMessageInput?: () => void) => {
        CommitDetailQuickPickOptions.placeHolder = '搜索提交描述';

        const commitDetailTypes: Array<typeof CommitDetailType[0]> = JSON.parse(JSON.stringify(CommitDetailType));
        commitDetailTypes.forEach((item: any) => {
            if (item.isEdit) {
                const value = (messageConfig as any)[item.key || ''] || '';
                item.description = `${item.description} 👍 >> ${value}`;
            }
        });

        const select = await vscode.window.showQuickPick(commitDetailTypes, CommitDetailQuickPickOptions);
        const label = (select && select.label) || '';

        if (label !== '') {
            const key = select?.key || 'body';

            if (key === 'complete') {
                // 完成提交信息编写
                vscode.commands.executeCommand('workbench.view.scm');
                const finalMessage = await messageCombine(messageConfig);
                repo.inputBox.value = finalMessage;
                clearMessage();
                return;
            }

            if (key === 'back') {
                // 返回选择类型
                if (startMessageInput) {
                    startMessageInput();
                }
                clearMessage();
                return;
            }

            await inputMessageDetail(key);
        } else {
            clearMessage();
        }
    };

    /**
     * 开始输入提交信息
     */
    const startMessageInput = async () => {
        CommitDetailQuickPickOptions.placeHolder = '搜索 Git 提交类型';

        const commitTypes = getCommitTypes();
        const select = await vscode.window.showQuickPick(commitTypes, CommitDetailQuickPickOptions);

        const title = (select && select.title) || '';
        const label = (select && select.label) || '';
        const icon = (select && select.icon) || '';

        messageConfig.type = title;
        messageConfig.icon = icon;

        if (label !== '') {
            await recursiveInputMessage(startMessageInput);
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
     * 选择提交模板
     */
    const selectTemplate = async () => {
        CommitDetailQuickPickOptions.placeHolder = '选择提交使用的模板';

        const templates = getCommitTemplates();
        const select = await vscode.window.showQuickPick(templates, CommitDetailQuickPickOptions);

        const templateName = (select && select.templateName) || '';
        const templateContent = (select && select.templateContent) || '';

        messageConfig.templateName = templateName;
        messageConfig.templateContent = templateContent;

        if (templateName !== '') {
            await startMessageInput();
        }
    };

    // 注册命令
    const disposable = vscode.commands.registerCommand('odinsamGitCommit.showCommit', async (uri?: any) => {
        // 如果有多个仓库，可以根据 uri 查找对应的仓库
        if (uri) {
            const repositories = gitExtension.getAPI(1).repositories;
            repo = repositories.find((r: any) => {
                return r.rootUri.path === uri._rootUri?.path;
            }) || repo;
        }

        // 保存当前文件路径（用于后续获取版本号）
        const activeEditor = vscode.window.activeTextEditor;
        currentFilePath = activeEditor?.document.uri.fsPath || uri?.fsPath;

        // 先询问是否需要创建配置文件
        await askAndCreateConfig();

        // 检查配置文件并让用户选择项目（如果是多项目配置）
        await checkAndSelectProject();

        // 然后继续提交流程
        await selectTemplate();
    });

    context.subscriptions.push(disposable);
}

/**
 * 停用扩展
 */
export function deactivate() {
    console.log('[规范化 Git 提交] 扩展已停用');
}

