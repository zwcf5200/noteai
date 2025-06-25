# Void 编辑器 macOS 开发与打包指南

## 目录
1. [系统要求](#系统要求)
2. [开发环境准备](#开发环境准备)
3. [项目克隆与初始化](#项目克隆与初始化)
4. [开发构建](#开发构建)
5. [运行与调试](#运行与调试)
6. [生产打包](#生产打包)
7. [常见问题与解决方案](#常见问题与解决方案)
8. [高级配置](#高级配置)

---

## 系统要求

### 必需软件
- **macOS**: 10.15 (Catalina) 或更高版本
- **Xcode**: 最新版本或 Xcode Command Line Tools
- **Node.js**: 20.18.2 (精确版本，见 `.nvmrc`)
- **Python**: 3.x (通常 macOS 已预装)
- **Git**: 2.20 或更高版本

### 推荐软件
- **nvm**: Node Version Manager，用于管理 Node.js 版本
- **Visual Studio Code**: 用于开发（可选，但推荐）

---

## 开发环境准备

### 1. 安装 Xcode Command Line Tools
```bash
xcode-select --install
```

### 2. 安装 Node Version Manager (nvm)
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载终端或运行
source ~/.bashrc
# 或
source ~/.zshrc
```

### 3. 设置 Node.js 环境
```bash
# 安装并使用指定的 Node.js 版本
nvm install 20.18.2
nvm use 20.18.2

# 验证版本
node --version  # 应该显示 v20.18.2
npm --version
```

### 4. 验证 Python 环境
```bash
python3 --version
# 确保显示 Python 3.x.x
```

---

## 项目克隆与初始化

### 1. 克隆项目
```bash
# 克隆主项目
git clone https://github.com/voideditor/void.git
cd void

# 初始化子模块
git submodule update --init --recursive
```

### 2. 安装项目依赖
```bash
# 安装所有依赖（这一步可能需要5-10分钟）
npm install
```

---

## 开发构建

### 1. 构建方式选择

#### 方式A：使用 Visual Studio Code 构建（推荐）
```bash
# 在项目根目录打开 VS Code
code .

# 在 VS Code 中按下快捷键进行构建
# macOS: Cmd+Shift+B
```

#### 方式B：使用命令行构建
```bash
# 启动监视模式构建
npm run watch

# 或者单次构建
npm run compile
```

### 2. 构建完成标志
等待构建完成，当你看到以下类似输出时表示构建成功：
```
[watch-extensions] [00:37:39] Finished compilation extensions with 0 errors after 19303 ms
[watch-client    ] [00:38:06] Finished compilation with 0 errors after 46248 ms
```

### 3. React 组件构建
如果你需要修改 React 组件：
```bash
# 构建 React 组件
npm run buildreact

# 监视模式构建 React 组件
npm run watchreact

# 使用 deemon 守护进程运行
npm run watchreactd
```

---

## 运行与调试

### 1. 启动开发版本
```bash
# 启动 Void 开发版本
./scripts/code.sh

# 或者使用带有自定义用户数据目录的版本（推荐用于测试）
./scripts/code.sh --user-data-dir ./.tmp/user-data --extensions-dir ./.tmp/extensions
```

### 2. 重新加载变更
- 在运行的 Void 窗口中按 `Cmd+R` 快速重新加载变更
- 或使用 `Cmd+Shift+P` 输入 "Reload Window"

### 3. 停止开发服务器
- 在终端中按 `Ctrl+D` 停止构建监视进程
- 避免使用 `Ctrl+C`，因为这会导致后台进程继续运行

---

## 生产打包

### 1. 确保构建完成
```bash
# 确保所有代码都已构建
npm run compile
```

### 2. 选择目标架构进行打包

#### 为 Apple Silicon (M1/M2/M3) 打包
```bash
npm run gulp vscode-darwin-arm64
```

#### 为 Intel Mac 打包
```bash
npm run gulp vscode-darwin-x64
```

### 3. 打包过程
- 打包过程可能需要 20-30 分钟，请耐心等待
- 打包完成后，会在项目父目录生成应用包

### 4. 输出目录结构
```
workspace/
├── void/                    # 你的源码目录
└── VSCode-darwin-arm64/     # 生成的应用包 (Apple Silicon)
    └── Void.app            # 可执行的应用程序
```

### 5. 运行打包后的应用
```bash
# 直接运行
open ../VSCode-darwin-arm64/Void.app

# 或通过命令行
../VSCode-darwin-arm64/Void.app/Contents/MacOS/Electron
```

---

## 常见问题与解决方案

### 1. Node.js 版本问题
**问题**: 构建失败，提示 Node.js 版本不匹配
```bash
# 解决方案：使用正确的 Node.js 版本
nvm install
nvm use
```

### 2. GNU libtool 问题
**问题**: 出现 `libtool: error: unrecognised option: '-static'` 错误
```bash
# macOS 默认使用 BSD libtool，需要安装 GNU libtool
brew install libtool

# 确保 GNU libtool 在 PATH 中优先
export PATH="/usr/local/opt/libtool/libexec/gnubin:$PATH"
```

### 3. Electron Sandbox 权限问题
**问题**: 运行时出现 `SUID sandbox helper binary` 错误
```bash
# 解决方案：修复 chrome-sandbox 权限
sudo chown root:root .build/electron/chrome-sandbox
sudo chmod 4755 .build/electron/chrome-sandbox
```

### 4. React 构建内存不足
**问题**: React 构建时出现内存溢出
```bash
# 解决方案：增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=8192" npm run buildreact
```

### 5. 路径包含空格问题
**问题**: 构建失败，路径中包含空格
```bash
# 解决方案：确保 Void 项目路径中不包含空格
# 错误示例：/Users/username/My Projects/void
# 正确示例：/Users/username/Projects/void
```

### 6. macOS Quarantine 问题
**问题**: 下载的构建包无法运行，被系统阻止
```bash
# 解决方案：移除 quarantine 属性
xattr -d com.apple.quarantine /path/to/VSCode-darwin-arm64.zip
```

---

## 高级配置

### 1. 使用自定义配置启动
```bash
# 使用自定义用户数据目录
./scripts/code.sh --user-data-dir ./custom-data

# 启用详细日志
./scripts/code.sh --verbose

# 禁用 GPU 加速（解决某些显示问题）
./scripts/code.sh --disable-gpu

# 禁用扩展
./scripts/code.sh --disable-extensions
```

### 2. 环境变量配置
```bash
# 开发模式环境变量
export NODE_ENV=development
export VSCODE_DEV=1
export VSCODE_CLI=1
export ELECTRON_ENABLE_STACK_DUMPING=1
export ELECTRON_ENABLE_LOGGING=1

# 跳过预启动检查（加快启动速度）
export VSCODE_SKIP_PRELAUNCH=1
```

### 3. CLI 工具构建
如果需要构建 CLI 工具：
```bash
# 进入 CLI 目录
cd cli

# 构建 CLI 工具
cargo build

# 发布模式构建
cargo build --release
```

### 4. 扩展开发
```bash
# 监视扩展变更
npm run watch-extensions

# 单独构建扩展
npm run compile-extensions-build
```

### 5. Web 版本开发
```bash
# 构建 Web 版本
npm run compile-web

# 监视 Web 版本变更
npm run watch-web

# 启动 Web 服务器
node scripts/code-web.js --coi
```

### 6. 性能分析
```bash
# 运行性能分析
npm run perf

# 生成覆盖率报告
./scripts/test.sh --coverage
```

---

## 调试技巧

### 1. VS Code 内部调试
- 按 `Cmd+Shift+I` 打开开发者工具
- 在控制台中可以查看详细的错误信息和日志

### 2. 扩展调试
```bash
# 运行特定扩展的测试
./scripts/test-integration.sh

# 启用扩展主机调试
./scripts/code.sh --extensionDevelopmentPath=/path/to/extension
```

### 3. 日志分析
```bash
# 查看详细的构建日志
npm run compile 2>&1 | tee build.log

# 查看运行时日志
./scripts/code.sh --verbose > runtime.log 2>&1
```

---

## 最佳实践

### 1. 开发工作流
1. 使用 `npm run watch` 保持构建监视
2. 使用 `npm run watchreactd` 监视 React 组件变更
3. 定期运行 `git submodule update --recursive` 更新子模块
4. 在提交前运行 `npm run hygiene` 检查代码质量

### 2. 性能优化
- 使用 SSD 存储项目文件
- 确保有足够的 RAM（推荐 16GB+）
- 关闭不必要的后台应用程序
- 使用 `--user-data-dir` 参数避免影响主 VS Code 配置

### 3. 版本管理
- 定期备份开发配置
- 使用分支进行功能开发
- 保持与上游同步：`git pull upstream main`

---

## 发布与分发

### 1. 构建发布版本
```bash
# 清理之前的构建
rm -rf .build/
rm -rf out/

# 重新安装依赖
npm ci

# 构建发布版本
npm run compile-build

# 打包应用
npm run gulp vscode-darwin-arm64
npm run gulp vscode-darwin-x64
```

### 2. 代码签名（可选）
```bash
# 如果有开发者证书，可以对应用进行签名
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" VSCode-darwin-arm64/Void.app
```

### 3. 创建 DMG 安装包（可选）
```bash
# 使用 hdiutil 创建 DMG
hdiutil create -volname "Void" -srcfolder VSCode-darwin-arm64 -ov -format UDZO Void-darwin-arm64.dmg
```

---

这份指南涵盖了在 macOS 平台上开发和打包 Void 编辑器的完整流程。如果在使用过程中遇到其他问题，请参考项目的 [Issue](https://github.com/voideditor/void/issues) 页面或加入 [Discord](https://discord.gg/RSNjgaugJs) 社区寻求帮助。
