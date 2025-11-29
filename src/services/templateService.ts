/**
 * 模板文件服务
 * 用于创建 .gitcommit 配置文件
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 模板文件服务类
 */
export class TemplateService {
    /**
     * 获取模板文件目录
     */
    private static getTemplateDir(): string {
        // 尝试获取扩展路径（生产环境和开发环境都适用）
        const extensionId = 'odinsam-gitcommit';
        const extension = vscode.extensions.getExtension(extensionId);
        if (extension) {
            // 模板文件在扩展根目录的src/template
            const templatePath = path.join(extension.extensionPath, 'src', 'template');
            console.log(`[模板服务] 尝试从扩展路径获取模板: ${templatePath}`);
            if (fs.existsSync(templatePath)) {
                console.log(`[模板服务] ✅ 找到模板目录: ${templatePath}`);
                return templatePath;
            }
            
            // 如果 src/template 不存在，尝试从扩展根目录直接查找
            const rootTemplatePath = path.join(extension.extensionPath, 'template');
            console.log(`[模板服务] 尝试从扩展根目录获取模板: ${rootTemplatePath}`);
            if (fs.existsSync(rootTemplatePath)) {
                console.log(`[模板服务] ✅ 找到模板目录: ${rootTemplatePath}`);
                return rootTemplatePath;
            }
        }
        
        // 如果无法通过扩展路径获取，尝试从__dirname推断
        // 如果__dirname在out目录下，说明是编译后的代码，需要找到src目录
        let templatePath: string;
        if (__dirname.includes(path.sep + 'out' + path.sep) || __dirname.endsWith(path.sep + 'out')) {
            // 编译后的代码：从out/services/..找到项目根目录，然后到src/template
            const projectRoot = path.resolve(__dirname, '..', '..');
            templatePath = path.join(projectRoot, 'src', 'template');
            console.log(`[模板服务] 从编译后路径推断: ${templatePath}`);
        } else {
            // 开发环境：直接从__dirname向上找到src/template
            templatePath = path.join(__dirname, '..', 'template');
            console.log(`[模板服务] 从开发环境路径推断: ${templatePath}`);
        }
        
        if (fs.existsSync(templatePath)) {
            console.log(`[模板服务] ✅ 找到模板目录: ${templatePath}`);
            return templatePath;
        }
        
        // 如果都找不到，返回路径（让错误在读取文件时抛出，提供更详细的错误信息）
        console.error(`[模板服务] ❌ 未找到模板目录: ${templatePath}`);
        return templatePath;
    }

    /**
     * 创建 .gitcommit 配置文件
     * @param targetDir 目标目录（项目根目录）
     * @param templateType 模板类型：'single' 单项目，'multi' 多项目
     * @returns 是否创建成功
     */
    public static async createGitCommitConfig(targetDir: string, templateType: 'single' | 'multi'): Promise<boolean> {
        try {
            // 确保目标目录是绝对路径
            const absoluteTargetDir = path.isAbsolute(targetDir) ? targetDir : path.resolve(targetDir);
            
            // 配置文件路径：在项目根目录下创建 .gitcommit 文件
            const configPath = path.join(absoluteTargetDir, '.gitcommit');
            
            console.log(`[模板服务] 准备在根目录创建配置文件: ${configPath}`);
            
            // 如果配置文件已存在，询问是否覆盖
            if (fs.existsSync(configPath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    `.gitcommit 配置文件已存在，是否覆盖？`,
                    { modal: true },
                    '覆盖',
                    '取消'
                );
                
                if (overwrite !== '覆盖') {
                    return false;
                }
            }

            // 根据模板类型生成配置
            let jsonContent: string;
            
            if (templateType === 'single') {
                // 单项目配置：直接是对象，包含 projectName, path, versionRegex, description
                const packageJsonPath = path.join(absoluteTargetDir, 'package.json');
                let projectName = '项目名称';
                let filePath = 'package.json';
                let versionRegex = '"version"\\s*:\\s*"([\\d.]+)"';
                let description = '项目版本号';
                
                // 检查是否有 package.json
                if (fs.existsSync(packageJsonPath)) {
                    try {
                        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                        if (packageJson.name) {
                            projectName = packageJson.name;
                        }
                    } catch (error) {
                        console.log(`[Git Commit] 读取 package.json 失败，使用默认值: ${error}`);
                    }
                } else {
                    // 检查是否有 .csproj 文件
                    try {
                        const files = fs.readdirSync(absoluteTargetDir);
                        const csprojFile = files.find(f => f.endsWith('.csproj'));
                        if (csprojFile) {
                            filePath = csprojFile;
                            versionRegex = '<Version>([\\d.]+)</Version>';
                            description = 'C# 项目版本号';
                        }
                    } catch (error) {
                        // 忽略错误
                    }
                }
                
                // 如果项目名称仍然是占位符，尝试从目录名获取
                if (projectName === '项目名称') {
                    projectName = path.basename(absoluteTargetDir);
                }
                
                // 生成单项目配置
                const config = {
                    projectName: projectName,
                    path: filePath,
                    versionRegex: versionRegex,
                    description: description
                };
                
                jsonContent = JSON.stringify(config, null, 2);
            } else {
                // 多项目配置：使用 { config: [] } 格式
                const packageJsonPath = path.join(absoluteTargetDir, 'package.json');
                let projectName = '项目名称';
                let filePath = 'package.json';
                let versionRegex = '"version"\\s*:\\s*"([\\d.]+)"';
                let description = '项目版本号';
                
                if (fs.existsSync(packageJsonPath)) {
                    try {
                        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                        if (packageJson.name) {
                            projectName = packageJson.name;
                        }
                    } catch (error) {
                        console.log(`[Git Commit] 读取 package.json 失败，使用默认值: ${error}`);
                    }
                } else {
                    // 检查是否有 .csproj 文件
                    try {
                        const files = fs.readdirSync(absoluteTargetDir);
                        const csprojFile = files.find(f => f.endsWith('.csproj'));
                        if (csprojFile) {
                            filePath = csprojFile;
                            versionRegex = '<Version>([\\d.]+)</Version>';
                            description = 'C# 项目版本号';
                        }
                    } catch (error) {
                        // 忽略错误
                    }
                }
                
                // 如果项目名称仍然是占位符，尝试从目录名获取
                if (projectName === '项目名称') {
                    projectName = path.basename(absoluteTargetDir);
                }
                
                // 生成多项目配置
                const config = {
                    config: [
                        {
                            projectName: projectName,
                            path: filePath,
                            versionRegex: versionRegex,
                            description: description
                        }
                    ]
                };
                
                jsonContent = JSON.stringify(config, null, 2);
            }

            // 写入配置文件
            fs.writeFileSync(configPath, jsonContent, 'utf-8');
            
            vscode.window.showInformationMessage(`已创建 .gitcommit 配置文件: ${configPath}`);
            console.log(`[Git Commit] 已创建配置文件: ${configPath}`);
            
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`创建 .gitcommit 配置文件失败: ${errorMessage}`);
            console.error(`[Git Commit] 创建配置文件失败: ${errorMessage}`);
            return false;
        }
    }

    /**
     * 检查指定目录是否已有 .gitcommit 配置文件
     * @param targetDir 目标目录
     * @returns 是否存在配置文件
     */
    public static hasGitCommitConfig(targetDir: string): boolean {
        const configPath = path.join(targetDir, '.gitcommit');
        return fs.existsSync(configPath);
    }
}

