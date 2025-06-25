# Cursor 规则索引

> **维护职责**: 本文件由探索者(ex)角色负责维护和更新。探索者负责确保规则索引的完整性、准确性和及时性，包括添加新规则、更新现有规则描述和保持分类结构的清晰。

此文件用于索引所有可用的规则文件，Cursor会自动读取这些规则并应用。

## 核心规则

- **知识库命令处理**: [kb_command.mdc](.cursor/rules/kb_command.mdc)
  - 触发条件: 用户输入 `/kb`、`/KB`、`/知识库`、`/knowledge` 等命令
  - 功能: 将对话内容整理成结构化的知识库文档
  - 使用方法: 在对话中输入 `/kb [参数]` 即可触发

- **代码实施前确认**: [code_confirmation.mdc](.cursor/rules/code_confirmation.mdc)
  - 触发条件: 提出代码修改或创建方案时
  - 功能: 确保在实施代码修改前获得用户确认
  - 使用方法: 自动应用，提出方案并等待确认

- **大规模修改确认**: [large_scale_confirmation.mdc](.cursor/rules/large_scale_confirmation.mdc)
  - 触发条件: 需要删除超过10行代码或修改超过文件30%内容
  - 功能: 防止意外的大规模代码删除或修改
  - 使用方法: 自动应用，显示警告并等待明确确认

## 角色规则

- **产品经理角色**: [pm.mdc](.cursor/rules/pm.mdc)
  - 角色定义: 产品经理，负责需求分析、功能规划和用户体验设计
  - 触发命令: `/pm`

- **架构师角色**: [ar.mdc](.cursor/rules/ar.mdc)
  - 角色定义: 架构师，负责技术架构设计和关键技术决策
  - 触发命令: `/ar`

- **开发工程师角色**: [dv.mdc](.cursor/rules/dv.mdc)
  - 角色定义: 开发工程师，负责代码实现和技术方案设计
  - 触发命令: `/dv`

- **测试工程师角色**: [qa.mdc](.cursor/rules/qa.mdc)
  - 角色定义: 测试工程师，负责测试用例设计和质量保证
  - 触发命令: `/qa`

- **项目教练角色**: [co.mdc](.cursor/rules/co.mdc)
  - 角色定义: 项目教练，负责项目规划、进度把控和团队协调
  - 触发命令: `/co`

- **探索者角色**: [ex.mdc](.cursor/rules/ex.mdc)
  - 角色定义: 探索者，负责探索、设计和完善多角色协作机制
  - 触发命令: `/ex`

- **系统运维专家角色**: [sre.mdc](.cursor/rules/sre.mdc)
  - 角色定义: 系统运维专家，专注于系统工具、终端命令和软件安装与故障排除
  - 触发命令: `/sre`

## 会话管理规则

- **角色状态管理**: [role_state_manager.mdc](.cursor/rules/role_state_manager.mdc)
  - 功能: 负责角色状态的保存、恢复和管理
  - 触发条件: 角色切换或状态管理命令

- **角色管理器**: [role_manager.mdc](.cursor/rules/role_manager.mdc)
  - 功能: 统一管理角色切换和互斥机制
  - 触发条件: 角色切换命令或状态查询

- **会话初始化**: [session_init.mdc](.cursor/rules/session_init.mdc)
  - 功能: 新会话开始时自动查找最新资料和上次会话总结
  - 触发条件: 会话开始

- **会话总结**: [session_summary.mdc](.cursor/rules/session_summary.mdc)
  - 功能: 会话结束时总结并记录会话内容和错误防范
  - 触发条件: 会话结束或用户请求

- **总结命令**: [summary_command.mdc](.cursor/rules/summary_command.mdc)
  - 功能: 处理用户输入的总结相关命令
  - 触发命令: `/summarize`、`/summary`、`/总结`等

- **规则评估**: [rules_evaluation.mdc](.cursor/rules/rules_evaluation.mdc)
  - 功能: 会话结束时评估规则执行情况并提出改进建议
  - 触发条件: 会话结束或用户请求规则评估

## Cursor功能规则

- **Cursor文档处理能力**: [cursor_document_processing.mdc](.cursor/rules/cursor_document_processing.mdc)
  - 功能: 定义Cursor处理文档的能力和最佳实践
  - 使用方法: 处理文档时自动应用

- **Cursor工作流程设计**: [cursor_workflow_design.mdc](.cursor/rules/cursor_workflow_design.mdc)
  - 功能: Cursor工作流程设计的最佳实践
  - 使用方法: 设计工作流时参考

- **Cursor工具库使用**: [cursor_tools_usage.mdc](.cursor/rules/cursor_tools_usage.mdc)
  - 功能: 关于Cursor工具库的使用规范
  - 使用方法: 使用工具库时参考

- **Cursor最新信息**: [cursor_latest_info.mdc](.cursor/rules/cursor_latest_info.mdc)
  - 功能: 自动搜索Cursor的最新文档和特性
  - 触发条件: 会话开始或用户询问最新信息

- **Cursor智能体角色**: [cursor_agent_roles.mdc](.cursor/rules/cursor_agent_roles.mdc)
  - 功能: 定义智能体角色的要求和最佳实践
  - 使用方法: 创建新智能体时参考

## 辅助工具规则

- **规则冲突检测器**: [rule_conflict_detector.mdc](.cursor/rules/rule_conflict_detector.mdc)
  - 功能: 检测规则间的冲突、重叠或不确定行为
  - 触发命令: `/check-rules`、`/检查规则`等

- **知识库命令处理器**: [knowledge_base_command.mdc](.cursor/rules/knowledge_base_command.mdc)
  - 功能: 详细定义知识库命令处理的机制和流程
  - 触发命令: `/kb`、`/知识库`等

- **角色切换示例**: [role_switch_example.mdc](.cursor/rules/role_switch_example.mdc)
  - 功能: 提供角色切换的示例和最佳实践
  - 使用方法: 学习角色切换机制时参考

- **团队协作指南**: [team_collaboration.mdc](.cursor/rules/team_collaboration.mdc)
  - 功能: 定义角色间的协作机制和文档规范
  - 使用方法: 多角色协作时参考 