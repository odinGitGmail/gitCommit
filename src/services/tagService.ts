/**
 * Git 标记服务
 * 封装标记创建、查询、删除和推送操作
 */
import { execFile } from 'child_process';
import * as util from 'util';

export type TagType = 'annotated' | 'lightweight';

export class TagService {
    /**
     * 执行 Git 命令
     */
    private static async executeGitCommand(args: string[], repositoryRoot: string): Promise<string> {
        try {
            const execFilePromise = util.promisify(execFile);
            const result = await execFilePromise('git', args, {
                cwd: repositoryRoot,
                maxBuffer: 1024 * 1024
            });
            return result.stdout.trim();
        } catch (error: any) {
            const message = error?.stderr?.trim()
                || (error instanceof Error ? error.message : String(error));
            throw new Error(message);
        }
    }

    /**
     * 验证标记名称是否符合 Git 引用命名规则
     */
    public static async isValidTagName(repositoryRoot: string, tagName: string): Promise<boolean> {
        if (!tagName || tagName !== tagName.trim() || tagName.startsWith('-')) {
            return false;
        }

        try {
            await this.executeGitCommand(
                ['check-ref-format', `refs/tags/${tagName}`],
                repositoryRoot
            );
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取本地分支
     */
    public static async getLocalBranches(repositoryRoot: string): Promise<string[]> {
        const output = await this.executeGitCommand(
            ['for-each-ref', '--format=%(refname:short)', 'refs/heads'],
            repositoryRoot
        );
        return this.parseLines(output);
    }

    /**
     * 获取本地标记
     */
    public static async getLocalTags(repositoryRoot: string): Promise<string[]> {
        const output = await this.executeGitCommand(
            ['for-each-ref', '--format=%(refname:short)', 'refs/tags'],
            repositoryRoot
        );
        return this.parseLines(output);
    }

    /**
     * 获取远程仓库
     */
    public static async getRemotes(repositoryRoot: string): Promise<string[]> {
        const output = await this.executeGitCommand(['remote'], repositoryRoot);
        return this.parseLines(output);
    }

    /**
     * 实时获取指定远程仓库的标记
     */
    public static async getRemoteTags(repositoryRoot: string, remote: string): Promise<string[]> {
        const output = await this.executeGitCommand(
            ['ls-remote', '--tags', '--refs', remote],
            repositoryRoot
        );

        const tags = output
            .split(/\r?\n/)
            .map(line => line.split(/\s+/)[1])
            .filter((ref): ref is string => Boolean(ref?.startsWith('refs/tags/')))
            .map(ref => ref.substring('refs/tags/'.length));

        return [...new Set(tags)].sort((left, right) => left.localeCompare(right));
    }

    /**
     * 创建标记
     */
    public static async createTag(
        repositoryRoot: string,
        tagName: string,
        tagType: TagType,
        target: string,
        message?: string
    ): Promise<void> {
        const args = tagType === 'annotated'
            ? ['tag', '-a', '-m', message || '', '--', tagName, target]
            : ['tag', '--', tagName, target];

        await this.executeGitCommand(args, repositoryRoot);
    }

    /**
     * 删除本地标记
     */
    public static async deleteLocalTags(repositoryRoot: string, tagNames: string[]): Promise<void> {
        if (tagNames.length === 0) {
            return;
        }
        await this.executeGitCommand(['tag', '-d', '--', ...tagNames], repositoryRoot);
    }

    /**
     * 删除远程标记
     */
    public static async deleteRemoteTags(
        repositoryRoot: string,
        remote: string,
        tagNames: string[]
    ): Promise<void> {
        if (tagNames.length === 0) {
            return;
        }
        const tagRefs = tagNames.map(tagName => `refs/tags/${tagName}`);
        await this.executeGitCommand(['push', remote, '--delete', ...tagRefs], repositoryRoot);
    }

    /**
     * 推送全部本地标记
     */
    public static async pushAllTags(repositoryRoot: string, remote: string): Promise<void> {
        await this.executeGitCommand(['push', remote, '--tags'], repositoryRoot);
    }

    private static parseLines(output: string): string[] {
        if (!output) {
            return [];
        }
        return output
            .split(/\r?\n/)
            .map(value => value.trim())
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right));
    }
}
