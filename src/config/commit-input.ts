/**
 * Git 提交输入框配置
 */
import { InputBoxOptions } from 'vscode';

/**
 * 提交输入框配置接口
 */
export interface CommitInputType extends InputBoxOptions {}

/**
 * 默认输入框配置
 */
const CommitInputType: CommitInputType = {
    placeHolder: '请输入提交信息',
    ignoreFocusOut: true,
    prompt: '',
    value: ''
};

export default CommitInputType;

