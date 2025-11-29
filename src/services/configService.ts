/**
 * 配置文件服务
 * 用于读取项目中的 .gitcommit 配置文件
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Git Commit 项目配置接口
 */
export interface GitCommitProjectConfig {
    /** 项目名称 */
    projectName: string;
    /** 版本文件路径（相对于 .gitcommit 配置文件所在目录） */
    path: string;
    /** 用于从文件中提取版本号的正则表达式 */
    versionRegex: string;
    /** 项目描述 */
    description?: string;
}

/**
 * Git Commit 配置接口（支持单项目和多项目）
 */
export interface GitCommitConfigFile {
    /** 单项目配置（直接是项目配置对象）或多项目配置（config 数组） */
    projectName?: string;
    path?: string;
    versionRegex?: string;
    description?: string;
    config?: GitCommitProjectConfig[];
}

/**
 * 配置文件服务类
 */
export class ConfigService {
    /** 配置文件名 */
    private static readonly CONFIG_FILE_NAME = '.gitcommit';

    /**
     * 查找项目根目录（通过 .gitcommit 配置文件）
     * 从当前路径向上查找包含 .gitcommit 的目录
     * @param startPath 起始路径（文件路径或目录路径）
     * @returns 项目根目录路径，如果未找到则返回 null
     */
    public static findProjectRoot(startPath: string): string | null {
        let currentPath = startPath;

        // 如果是文件，获取其所在目录
        if (fs.existsSync(currentPath) && fs.statSync(currentPath).isFile()) {
            currentPath = path.dirname(currentPath);
        }

        // 向上查找直到找到 .gitcommit 配置文件或到达根目录
        while (currentPath !== path.dirname(currentPath)) {
            const configPath = path.join(currentPath, this.CONFIG_FILE_NAME);
            
            if (fs.existsSync(configPath)) {
                console.log(`[Git Commit] 找到配置文件: ${configPath}`);
                return currentPath;
            }
            
            currentPath = path.dirname(currentPath);
        }

        return null;
    }

    /**
     * 读取配置文件
     * @param projectRoot 项目根目录
     * @returns 配置对象，如果读取失败则返回 null
     */
    public static readConfig(projectRoot: string): GitCommitConfigFile | null {
        const configPath = path.join(projectRoot, this.CONFIG_FILE_NAME);
        
        if (!fs.existsSync(configPath)) {
            return null;
        }

        try {
            let configContent = fs.readFileSync(configPath, 'utf-8').trim();
            
            // 移除注释行（以 // 开头的行）
            configContent = configContent.split('\n')
                .filter(line => !line.trim().startsWith('//'))
                .join('\n');
            
            // 尝试解析为 JSON
            try {
                const jsonConfig = JSON.parse(configContent);
                
                // 验证配置格式：单项目必须有 projectName 和 path，多项目必须有 config 数组
                if (!jsonConfig.config && (!jsonConfig.projectName || !jsonConfig.path)) {
                    console.error(`[Git Commit] 配置文件格式错误：单项目缺少 projectName 或 path`);
                    return null;
                }
                
                if (jsonConfig.config && !Array.isArray(jsonConfig.config)) {
                    console.error(`[Git Commit] 配置文件格式错误：config 必须是数组`);
                    return null;
                }
                
                return jsonConfig as GitCommitConfigFile;
            } catch (jsonError) {
                const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
                console.error(`[Git Commit] 解析配置文件 JSON 失败: ${errorMessage}`);
                return null;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Git Commit] 读取配置文件失败: ${errorMessage}`);
            return null;
        }
    }

    /**
     * 获取当前项目的配置（从配置文件中）
     * @param configFileRoot .gitcommit 配置文件所在目录
     * @param projectName 项目名称（可选，用于多项目配置中匹配）
     * @returns 项目配置，如果未找到则返回 null
     */
    public static getProjectConfig(configFileRoot: string, projectName?: string): GitCommitProjectConfig | null {
        const configFile = this.readConfig(configFileRoot);
        if (!configFile) {
            return null;
        }

        // 如果是单项目配置（直接是项目配置对象）
        if (!configFile.config) {
            if (configFile.projectName && configFile.path && configFile.versionRegex) {
                return {
                    projectName: configFile.projectName,
                    path: configFile.path,
                    versionRegex: configFile.versionRegex,
                    description: configFile.description
                };
            }
            return null;
        }

        // 如果是多项目配置（config 数组）
        if (projectName) {
            // 根据项目名称查找
            const projectConfig = configFile.config.find(p => p.projectName === projectName);
            if (projectConfig) {
                return projectConfig;
            }
        }

        // 如果没有指定项目名称，返回第一个配置
        if (configFile.config.length > 0) {
            return configFile.config[0];
        }

        return null;
    }

    /**
     * 从版本文件中读取版本号（使用正则表达式）
     * @param configFileRoot .gitcommit 配置文件所在目录
     * @param filePath 版本文件路径（相对于配置文件所在目录）
     * @param versionRegex 用于提取版本号的正则表达式
     * @returns 版本号，如果读取失败则返回 null
     */
    public static readVersionFromFile(configFileRoot: string, filePath: string, versionRegex: string): string | null {
        const fullPath = path.join(configFileRoot, filePath);
        console.log(`[配置服务] 读取版本文件 - 完整路径: ${fullPath}`);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`[配置服务] ❌ 版本文件不存在: ${fullPath}`);
            return null;
        }
        console.log(`[配置服务] ✅ 版本文件存在`);

        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            console.log(`[配置服务] 文件内容长度: ${content.length} 字符`);
            console.log(`[配置服务] 文件内容预览（前200字符）: ${content.substring(0, 200)}`);
            
            // 使用正则表达式提取版本号
            try {
                // 将字符串形式的正则表达式转换为 RegExp 对象
                // 处理转义字符，例如 "\"version\"\\s*:\\s*\"([\\d.]+)\"" 应该匹配 "version": "1.0.0"
                console.log(`[配置服务] 使用正则表达式: ${versionRegex}`);
                const regex = new RegExp(versionRegex);
                const match = content.match(regex);
                
                console.log(`[配置服务] 正则匹配结果:`, match ? {
                    fullMatch: match[0],
                    captureGroup1: match[1],
                    allGroups: match.slice(0, 10) // 只显示前10个组
                } : '未匹配');
                
                if (match && match[1]) {
                    // 返回第一个捕获组（版本号）
                    const version = match[1].trim();
                    console.log(`[配置服务] ✅ 成功提取版本号: ${version}`);
                    return version;
                } else if (match && match[0]) {
                    // 如果没有捕获组，返回整个匹配
                    const version = match[0].trim();
                    console.log(`[配置服务] ✅ 使用完整匹配作为版本号: ${version}`);
                    return version;
                }
                
                console.log(`[配置服务] ⚠️ 正则表达式未匹配到版本号`);
                console.log(`[配置服务] 尝试在文件内容中搜索 "version":`, content.includes('version'));
                return null;
            } catch (regexError) {
                const errorMessage = regexError instanceof Error ? regexError.message : String(regexError);
                console.error(`[配置服务] ❌ 正则表达式错误: ${errorMessage}`);
                console.error(`[配置服务] 正则表达式字符串: ${versionRegex}`);
                return null;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[配置服务] ❌ 读取版本文件失败: ${errorMessage}`);
            return null;
        }
    }

    /**
     * 获取项目版本号（优先从配置文件读取）
     * @param startPath 起始路径（文件路径或目录路径）
     * @param projectName 项目名称（可选，用于多项目配置中匹配）
     * @returns 版本号，如果未找到则返回 null
     */
    public static async getProjectVersion(startPath: string, projectName?: string): Promise<string | null> {
        console.log(`[配置服务] 开始获取项目版本号 - 起始路径: ${startPath}, 项目名称: ${projectName || '未指定'}`);
        
        // 1. 查找 .gitcommit 配置文件所在目录
        const configFileRoot = this.findProjectRoot(startPath);
        if (!configFileRoot) {
            console.log(`[配置服务] ⚠️ 未找到 .gitcommit 配置文件（从 ${startPath} 向上查找）`);
            return null;
        }
        console.log(`[配置服务] ✅ 找到配置文件所在目录: ${configFileRoot}`);

        // 2. 获取项目配置
        const config = this.getProjectConfig(configFileRoot, projectName);
        if (!config) {
            console.log(`[配置服务] ⚠️ 未找到项目配置`);
            return null;
        }
        console.log(`[配置服务] ✅ 找到项目配置:`, {
            projectName: config.projectName,
            path: config.path,
            versionRegex: config.versionRegex,
            description: config.description
        });

        // 3. 从配置的路径文件中读取版本号（使用正则表达式）
        if (config.path && config.versionRegex) {
            console.log(`[配置服务] 尝试从文件读取版本号 - 文件路径: ${config.path}, 正则: ${config.versionRegex}`);
            const version = this.readVersionFromFile(configFileRoot, config.path, config.versionRegex);
            if (version) {
                console.log(`[配置服务] ✅ 成功读取版本号: ${version} (项目: ${config.projectName})`);
                return version;
            } else {
                console.log(`[配置服务] ⚠️ 无法从文件读取版本号`);
            }
        } else {
            console.log(`[配置服务] ⚠️ 配置缺少 path 或 versionRegex`);
        }

        return null;
    }
}

