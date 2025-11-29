/**
 * 版本号服务
 */
import { exec } from 'child_process';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from './configService';

const execPromise = util.promisify(exec);

/**
 * 版本号服务类
 */
export class VersionService {
    /**
     * 获取最新的 tag 版本号
     * @param projectRoot 项目根目录
     * @returns 最新的 tag 版本号，如果没有则返回 null
     */
    public static async getLatestTag(projectRoot: string): Promise<string | null> {
        try {
            const { stdout } = await execPromise(
                'git describe --tags --abbrev=0',
                {
                    cwd: projectRoot,
                    maxBuffer: 1024 * 1024
                }
            );
            return stdout.trim() || null;
        } catch (error) {
            // 如果没有 tag，命令会失败，返回 null
            return null;
        }
    }

    /**
     * 获取当前提交的版本号（优先级：配置文件 > tag > 提交哈希）
     * @param projectRoot 项目根目录（Git 仓库根目录）
     * @param filePath 当前文件路径（可选，用于查找项目配置文件）
     * @param projectName 项目名称（可选，用于多项目配置中匹配）
     * @returns 版本号
     */
    public static async getCurrentVersion(projectRoot: string, filePath?: string, projectName?: string): Promise<string> {
        console.log(`[版本号服务] 开始获取版本号 - 项目根目录: ${projectRoot}, 文件路径: ${filePath || '未提供'}, 项目名称: ${projectName || '未指定'}`);
        
        try {
            // 1. 优先从配置文件读取版本号（如果提供了文件路径）
            if (filePath) {
                console.log(`[版本号服务] 尝试从配置文件读取版本号，文件路径: ${filePath}, 项目名称: ${projectName || '未指定'}`);
                const configVersion = await ConfigService.getProjectVersion(filePath, projectName);
                if (configVersion) {
                    console.log(`[版本号服务] ✅ 从配置文件获取到版本号: ${configVersion}`);
                    return configVersion;
                } else {
                    console.log(`[版本号服务] ⚠️ 配置文件未找到或无法读取版本号`);
                }
            } else {
                console.log(`[版本号服务] 未提供文件路径，跳过配置文件读取`);
            }

            // 2. 尝试获取当前提交的 tag
            console.log(`[版本号服务] 尝试从 Git Tag 获取版本号`);
            let tagOutput = '';
            try {
                const result = await execPromise(
                    'git describe --tags --exact-match HEAD',
                    {
                        cwd: projectRoot,
                        maxBuffer: 1024 * 1024
                    }
                );
                tagOutput = result.stdout.trim();
                console.log(`[版本号服务] Git Tag 输出: ${tagOutput}`);
            } catch (error) {
                // 如果没有 tag，忽略错误
                tagOutput = '';
                console.log(`[版本号服务] 当前提交没有 Tag`);
            }
            
            if (tagOutput.trim()) {
                console.log(`[版本号服务] ✅ 使用 Git Tag 作为版本号: ${tagOutput}`);
                return tagOutput.trim();
            }

            // 3. 如果没有 tag，获取提交哈希（前8位）
            console.log(`[版本号服务] 尝试从提交哈希获取版本号`);
            const { stdout: hashOutput } = await execPromise(
                'git rev-parse --short=8 HEAD',
                {
                    cwd: projectRoot,
                    maxBuffer: 1024 * 1024
                }
            );
            const hash = hashOutput.trim();
            console.log(`[版本号服务] ✅ 使用提交哈希作为版本号: ${hash}`);
            return hash;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[版本号服务] ❌ 获取版本号失败: ${errorMessage}`);
            throw new Error(`获取当前版本号失败: ${errorMessage}`);
        }
    }

    /**
     * 获取当前分支名
     * @param projectRoot 项目根目录
     * @returns 分支名，如果没有则返回 null
     */
    public static async getCurrentBranch(projectRoot: string): Promise<string | null> {
        try {
            const { stdout } = await execPromise(
                'git rev-parse --abbrev-ref HEAD',
                {
                    cwd: projectRoot,
                    maxBuffer: 1024 * 1024
                }
            );
            return stdout.trim() || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 自动生成版本号信息（用于添加到提交信息）
     * @param projectRoot 项目根目录（Git 仓库根目录）
     * @param filePath 当前文件路径（可选，用于查找项目配置文件）
     * @param projectName 项目名称（可选，用于多项目配置中匹配）
     * @returns 版本号信息字符串
     */
    public static async getVersionInfo(projectRoot: string, filePath?: string, projectName?: string): Promise<string> {
        console.log(`[版本号服务] 开始生成版本信息 - 项目根目录: ${projectRoot}, 文件路径: ${filePath || '未提供'}, 项目名称: ${projectName || '未指定'}`);
        
        try {
            // 如果是多项目配置但没有指定项目名称，版本号无效
            if (filePath && projectName === undefined) {
                const configFileRoot = ConfigService.findProjectRoot(filePath);
                if (configFileRoot) {
                    const configFile = ConfigService.readConfig(configFileRoot);
                    // 如果是多项目配置（有 config 数组），但没有指定项目名称，版本号无效
                    if (configFile && configFile.config && Array.isArray(configFile.config) && configFile.config.length > 0) {
                        console.log(`[版本号服务] ⚠️ 多项目配置但未选择项目，版本号无效`);
                        return '';
                    }
                }
            }

            const currentVersion = await this.getCurrentVersion(projectRoot, filePath, projectName);
            console.log(`[版本号服务] 当前版本号: ${currentVersion}`);
            
            const latestTag = await this.getLatestTag(projectRoot);
            console.log(`[版本号服务] 最新 Tag: ${latestTag || '无'}`);
            
            const currentBranch = await this.getCurrentBranch(projectRoot);
            console.log(`[版本号服务] 当前分支: ${currentBranch || '无'}`);

            // 检查是否从配置文件读取的版本号
            const configVersion = filePath ? await ConfigService.getProjectVersion(filePath, projectName) : null;
            const isFromConfig = configVersion !== null;
            console.log(`[版本号服务] 是否从配置文件读取: ${isFromConfig}, 配置版本号: ${configVersion || '无'}`);

            let versionInfo = `版本: ${currentVersion}`;

            // 如果版本号来自配置文件，显示来源信息
            if (isFromConfig && filePath) {
                const configFileRoot = ConfigService.findProjectRoot(filePath);
                if (configFileRoot) {
                    const projectConfig = ConfigService.getProjectConfig(configFileRoot, projectName);
                    if (projectConfig?.projectName) {
                        versionInfo += ` (${projectConfig.projectName})`;
                        console.log(`[版本号服务] 添加项目名称: ${projectConfig.projectName}`);
                    } else {
                        versionInfo += ` (配置文件)`;
                        console.log(`[版本号服务] 使用通用标签: 配置文件`);
                    }
                }
            } else if (latestTag && currentVersion !== latestTag) {
                versionInfo += ` (基于 ${latestTag})`;
                console.log(`[版本号服务] 添加 Tag 信息: ${latestTag}`);
            }

            if (currentBranch && !currentBranch.includes('HEAD')) {
                versionInfo += `\n分支: ${currentBranch}`;
                console.log(`[版本号服务] 添加分支信息: ${currentBranch}`);
            }

            console.log(`[版本号服务] ✅ 生成的版本信息: ${versionInfo}`);
            return versionInfo;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[版本号服务] ❌ 生成版本信息失败: ${errorMessage}`);
            // 如果获取失败，返回空字符串
            return '';
        }
    }
}

