/**
 * Git Flow 服务
 * 实现 Git Flow 工作流程的完整功能
 */
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Git Flow 配置接口
 */
export interface GitFlowConfig {
    /** 主分支名称（默认：master） */
    masterBranch: string;
    /** 开发分支名称（默认：develop） */
    developBranch: string;
    /** Feature 分支前缀（默认：feature/） */
    featurePrefix: string;
    /** Release 分支前缀（默认：release/） */
    releasePrefix: string;
    /** Hotfix 分支前缀（默认：hotfix/） */
    hotfixPrefix: string;
    /** Support 分支前缀（默认：support/） */
    supportPrefix: string;
    /** 版本标签前缀（默认：空） */
    versionTagPrefix: string;
}

/**
 * Git Flow 分支类型
 */
export type GitFlowBranchType = 'feature' | 'release' | 'hotfix' | 'support';

/**
 * Git Flow 服务类
 */
export class GitFlowService {
    /**
     * 默认 Git Flow 配置
     */
    private static readonly DEFAULT_CONFIG: GitFlowConfig = {
        masterBranch: 'master',
        developBranch: 'develop',
        featurePrefix: 'feature/',
        releasePrefix: 'release/',
        hotfixPrefix: 'hotfix/',
        supportPrefix: 'support/',
        versionTagPrefix: ''
    };

    /**
     * 获取 Git 仓库根目录
     * 优先使用 VSCode Git API，如果失败则使用 git 命令
     */
    private static async getRepositoryRoot(): Promise<string | null> {
        // 1. 优先使用 VSCode Git API
        try {
            const vscodeGit = vscode.extensions.getExtension('vscode.git');
            if (vscodeGit && vscodeGit.exports) {
                const gitExtension = vscodeGit.exports;
                if (gitExtension.enabled) {
                    const gitApi = gitExtension.getAPI(1);
                    if (gitApi && gitApi.repositories && gitApi.repositories.length > 0) {
                        const repoRoot = gitApi.repositories[0].rootUri.fsPath;
                        console.log(`[Git Flow] 通过 VSCode Git API 获取仓库根目录: ${repoRoot}`);
                        return repoRoot;
                    }
                }
            }
        } catch (error) {
            console.log('[Git Flow] 通过 VSCode Git API 获取仓库根目录失败，尝试使用 git 命令:', error);
        }

        // 2. 如果 VSCode Git API 不可用，尝试使用 git 命令
        try {
            const { execFile } = await import('child_process');
            const util = await import('util');
            const execFilePromise = util.promisify(execFile);
            
            // 获取当前工作目录（优先使用工作区根目录）
            let cwd = process.cwd();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                cwd = workspaceFolders[0].uri.fsPath;
            }
            
            const result = await execFilePromise('git', ['rev-parse', '--show-toplevel'], {
                cwd: cwd,
                maxBuffer: 1024 * 1024
            });
            
            const repoRoot = result.stdout.trim();
            if (repoRoot) {
                console.log(`[Git Flow] 通过 git 命令获取仓库根目录: ${repoRoot}`);
                return repoRoot;
            }
        } catch (error) {
            // 静默失败，不输出错误日志（因为可能不在 Git 仓库中）
            console.log('[Git Flow] 当前不在 Git 仓库中');
        }
        
        return null;
    }

    /**
     * 执行 Git 命令
     */
    private static async executeGitCommand(args: string[], cwd: string): Promise<string> {
        try {
            const execFilePromise = util.promisify(execFile);
            const result = await execFilePromise('git', args, {
                cwd: cwd,
                maxBuffer: 1024 * 1024
            });
            return result.stdout.trim();
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Git 命令执行失败: ${errorMessage}`);
        }
    }

    /**
     * 检查是否在 Git 仓库中
     */
    public static async isGitRepository(): Promise<boolean> {
        const repoRoot = await this.getRepositoryRoot();
        return repoRoot !== null;
    }

    /**
     * 检查 Git Flow 是否已初始化
     */
    public static async isInitialized(): Promise<boolean> {
        try {
            const repoRoot = await this.getRepositoryRoot();
            if (!repoRoot) {
                return false;
            }

            const gitConfigPath = path.join(repoRoot, '.git', 'config');
            if (!fs.existsSync(gitConfigPath)) {
                return false;
            }

            const config = await this.executeGitCommand(['config', '--get', 'gitflow.branch.master'], repoRoot);
            return config !== '';
        } catch (error) {
            return false;
        }
    }

    /**
     * 初始化 Git Flow
     */
    public static async init(config?: Partial<GitFlowConfig>): Promise<GitFlowConfig> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            throw new Error('未找到 Git 仓库，请确保当前工作区是一个 Git 仓库');
        }

        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

        try {
            // 设置 Git Flow 配置
            await this.executeGitCommand(['config', 'gitflow.branch.master', finalConfig.masterBranch], repoRoot);
            await this.executeGitCommand(['config', 'gitflow.branch.develop', finalConfig.developBranch], repoRoot);
            await this.executeGitCommand(['config', 'gitflow.prefix.feature', finalConfig.featurePrefix], repoRoot);
            await this.executeGitCommand(['config', 'gitflow.prefix.release', finalConfig.releasePrefix], repoRoot);
            await this.executeGitCommand(['config', 'gitflow.prefix.hotfix', finalConfig.hotfixPrefix], repoRoot);
            await this.executeGitCommand(['config', 'gitflow.prefix.support', finalConfig.supportPrefix], repoRoot);
            await this.executeGitCommand(['config', 'gitflow.prefix.versiontag', finalConfig.versionTagPrefix], repoRoot);

            // 确保 develop 分支存在
            const branches = await this.executeGitCommand(['branch', '--list'], repoRoot);
            if (!branches.includes(finalConfig.developBranch)) {
                // 创建 develop 分支
                await this.executeGitCommand(['checkout', '-b', finalConfig.developBranch], repoRoot);
                console.log(`[Git Flow] 已创建 ${finalConfig.developBranch} 分支`);
            }

            console.log('[Git Flow] ✅ Git Flow 初始化成功');
            return finalConfig;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Git Flow 初始化失败: ${errorMessage}`);
        }
    }

    /**
     * 开始 Feature 分支
     */
    public static async startFeature(featureName: string): Promise<void> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            throw new Error('未找到 Git 仓库');
        }

        if (!await this.isInitialized()) {
            throw new Error('Git Flow 未初始化，请先初始化 Git Flow');
        }

        const developBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.develop'], repoRoot);
        const featurePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.feature'], repoRoot);
        const branchName = `${featurePrefix}${featureName}`;

        try {
            // 切换到 develop 分支
            await this.executeGitCommand(['checkout', developBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', developBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 创建并切换到 feature 分支
            await this.executeGitCommand(['checkout', '-b', branchName], repoRoot);

            console.log(`[Git Flow] ✅ 已创建并切换到 Feature 分支: ${branchName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`创建 Feature 分支失败: ${errorMessage}`);
        }
    }

    /**
     * 完成 Feature 分支
     */
    public static async finishFeature(featureName: string, keepBranch: boolean = false): Promise<void> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            throw new Error('未找到 Git 仓库');
        }

        const developBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.develop'], repoRoot);
        const featurePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.feature'], repoRoot);
        const branchName = `${featurePrefix}${featureName}`;

        try {
            // 切换到 develop 分支
            await this.executeGitCommand(['checkout', developBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', developBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 合并 feature 分支
            await this.executeGitCommand(['merge', '--no-ff', branchName], repoRoot);

            // 删除 feature 分支（如果不需要保留）
            if (!keepBranch) {
                await this.executeGitCommand(['branch', '-d', branchName], repoRoot);
                console.log(`[Git Flow] 已删除本地分支: ${branchName}`);
            }

            console.log(`[Git Flow] ✅ 已完成 Feature 分支: ${branchName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`完成 Feature 分支失败: ${errorMessage}`);
        }
    }

    /**
     * 开始 Release 分支
     */
    public static async startRelease(version: string): Promise<void> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            throw new Error('未找到 Git 仓库');
        }

        if (!await this.isInitialized()) {
            throw new Error('Git Flow 未初始化，请先初始化 Git Flow');
        }

        const developBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.develop'], repoRoot);
        const releasePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.release'], repoRoot);
        const branchName = `${releasePrefix}${version}`;

        try {
            // 切换到 develop 分支
            await this.executeGitCommand(['checkout', developBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', developBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 创建并切换到 release 分支
            await this.executeGitCommand(['checkout', '-b', branchName], repoRoot);

            console.log(`[Git Flow] ✅ 已创建并切换到 Release 分支: ${branchName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`创建 Release 分支失败: ${errorMessage}`);
        }
    }

    /**
     * 完成 Release 分支
     */
    public static async finishRelease(version: string, keepBranch: boolean = false, tagMessage?: string): Promise<void> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            throw new Error('未找到 Git 仓库');
        }

        const masterBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.master'], repoRoot);
        const developBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.develop'], repoRoot);
        const releasePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.release'], repoRoot);
        const versionTagPrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.versiontag'], repoRoot);
        const branchName = `${releasePrefix}${version}`;
        const tagName = `${versionTagPrefix}${version}`;

        try {
            // 切换到 master 分支
            await this.executeGitCommand(['checkout', masterBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', masterBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 合并 release 分支到 master
            await this.executeGitCommand(['merge', '--no-ff', branchName], repoRoot);

            // 创建标签
            const tagMsg = tagMessage || `Release ${version}`;
            await this.executeGitCommand(['tag', '-a', tagName, '-m', tagMsg], repoRoot);

            // 切换到 develop 分支
            await this.executeGitCommand(['checkout', developBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', developBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 合并 release 分支到 develop
            await this.executeGitCommand(['merge', '--no-ff', branchName], repoRoot);

            // 删除 release 分支（如果不需要保留）
            if (!keepBranch) {
                await this.executeGitCommand(['branch', '-d', branchName], repoRoot);
                console.log(`[Git Flow] 已删除本地分支: ${branchName}`);
            }

            console.log(`[Git Flow] ✅ 已完成 Release 分支: ${branchName}，标签: ${tagName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`完成 Release 分支失败: ${errorMessage}`);
        }
    }

    /**
     * 开始 Hotfix 分支
     */
    public static async startHotfix(version: string): Promise<void> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            throw new Error('未找到 Git 仓库');
        }

        if (!await this.isInitialized()) {
            throw new Error('Git Flow 未初始化，请先初始化 Git Flow');
        }

        const masterBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.master'], repoRoot);
        const hotfixPrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.hotfix'], repoRoot);
        const branchName = `${hotfixPrefix}${version}`;

        try {
            // 切换到 master 分支
            await this.executeGitCommand(['checkout', masterBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', masterBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 创建并切换到 hotfix 分支
            await this.executeGitCommand(['checkout', '-b', branchName], repoRoot);

            console.log(`[Git Flow] ✅ 已创建并切换到 Hotfix 分支: ${branchName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`创建 Hotfix 分支失败: ${errorMessage}`);
        }
    }

    /**
     * 完成 Hotfix 分支
     */
    public static async finishHotfix(version: string, keepBranch: boolean = false, tagMessage?: string): Promise<void> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            throw new Error('未找到 Git 仓库');
        }

        const masterBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.master'], repoRoot);
        const developBranch = await this.executeGitCommand(['config', '--get', 'gitflow.branch.develop'], repoRoot);
        const hotfixPrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.hotfix'], repoRoot);
        const versionTagPrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.versiontag'], repoRoot);
        const branchName = `${hotfixPrefix}${version}`;
        const tagName = `${versionTagPrefix}${version}`;

        try {
            // 切换到 master 分支
            await this.executeGitCommand(['checkout', masterBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', masterBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 合并 hotfix 分支到 master
            await this.executeGitCommand(['merge', '--no-ff', branchName], repoRoot);

            // 创建标签
            const tagMsg = tagMessage || `Hotfix ${version}`;
            await this.executeGitCommand(['tag', '-a', tagName, '-m', tagMsg], repoRoot);

            // 切换到 develop 分支
            await this.executeGitCommand(['checkout', developBranch], repoRoot);
            
            // 拉取最新代码
            await this.executeGitCommand(['pull', 'origin', developBranch], repoRoot).catch(() => {
                console.log('[Git Flow] 拉取远程分支失败，继续使用本地分支');
            });

            // 合并 hotfix 分支到 develop
            await this.executeGitCommand(['merge', '--no-ff', branchName], repoRoot);

            // 删除 hotfix 分支（如果不需要保留）
            if (!keepBranch) {
                await this.executeGitCommand(['branch', '-d', branchName], repoRoot);
                console.log(`[Git Flow] 已删除本地分支: ${branchName}`);
            }

            console.log(`[Git Flow] ✅ 已完成 Hotfix 分支: ${branchName}，标签: ${tagName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`完成 Hotfix 分支失败: ${errorMessage}`);
        }
    }

    /**
     * 获取当前分支类型
     */
    public static async getCurrentBranchType(): Promise<GitFlowBranchType | null> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            return null;
        }

        try {
            const currentBranch = await this.executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
            
            const featurePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.feature'], repoRoot).catch(() => 'feature/');
            const releasePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.release'], repoRoot).catch(() => 'release/');
            const hotfixPrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.hotfix'], repoRoot).catch(() => 'hotfix/');
            const supportPrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.support'], repoRoot).catch(() => 'support/');

            if (currentBranch.startsWith(featurePrefix)) {
                return 'feature';
            } else if (currentBranch.startsWith(releasePrefix)) {
                return 'release';
            } else if (currentBranch.startsWith(hotfixPrefix)) {
                return 'hotfix';
            } else if (currentBranch.startsWith(supportPrefix)) {
                return 'support';
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取所有 Feature 分支
     */
    public static async getFeatureBranches(): Promise<string[]> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            return [];
        }

        try {
            const featurePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.feature'], repoRoot).catch(() => 'feature/');
            const branches = await this.executeGitCommand(['branch', '--list', `${featurePrefix}*`], repoRoot);
            
            return branches.split('\n')
                .map(b => b.trim().replace(/^\*\s*/, '').replace(/^remotes\/[^\/]+\//, ''))
                .filter(b => b.startsWith(featurePrefix) && b.length > featurePrefix.length);
        } catch (error) {
            return [];
        }
    }

    /**
     * 获取所有 Release 分支
     */
    public static async getReleaseBranches(): Promise<string[]> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            return [];
        }

        try {
            const releasePrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.release'], repoRoot).catch(() => 'release/');
            const branches = await this.executeGitCommand(['branch', '--list', `${releasePrefix}*`], repoRoot);
            
            return branches.split('\n')
                .map(b => b.trim().replace(/^\*\s*/, '').replace(/^remotes\/[^\/]+\//, ''))
                .filter(b => b.startsWith(releasePrefix) && b.length > releasePrefix.length);
        } catch (error) {
            return [];
        }
    }

    /**
     * 获取所有 Hotfix 分支
     */
    public static async getHotfixBranches(): Promise<string[]> {
        const repoRoot = await this.getRepositoryRoot();
        if (!repoRoot) {
            return [];
        }

        try {
            const hotfixPrefix = await this.executeGitCommand(['config', '--get', 'gitflow.prefix.hotfix'], repoRoot).catch(() => 'hotfix/');
            const branches = await this.executeGitCommand(['branch', '--list', `${hotfixPrefix}*`], repoRoot);
            
            return branches.split('\n')
                .map(b => b.trim().replace(/^\*\s*/, '').replace(/^remotes\/[^\/]+\//, ''))
                .filter(b => b.startsWith(hotfixPrefix) && b.length > hotfixPrefix.length);
        } catch (error) {
            return [];
        }
    }
}

