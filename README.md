# DeputyDev - VSCode Plugin

## Introduction

Transform your development workflow with DeputyDev, the AI-powered assistant that seamlessly integrates into your coding environment to make you faster, better, and more efficient.

DeputyDev understands your entire codebase through our proprietary RAGLoC algorithm, providing context-aware assistance that truly comprehends your project's architecture and conventions.

### Why DeputyDev?

*   **Deeply Context-Aware**: Unlike generic AI assistants, DeputyDev analyzes your codebase to provide suggestions that align with your existing patterns and standards

*   **Enterprise Customizable**: Create and modify agents to match your organization's unique workflows and requirements

*   **Complete Development Companion**: From generating production-ready code to writing comprehensive tests and documentation

Whether you're building enterprise applications or personal projects, DeputyDev adapts to your needs, helping you write better code with confidence.

Install now and experience the difference that truly intelligent, context-aware assistance makes to your development process.

## Getting Started

### System Requirements

- VSCode version 1.60.0 or higher
- Node.js 14.x or higher
- Minimum 4GB RAM
- Stable internet connection

### Installation

<p></p>

Install the plugin from VSCode marketplace

### SignIn

<p></p>

SignIn using google login

### Chat vs Act Modes

<p></p>

| Chat | Act |
| --- | --- |
| Best for chatting with DeputyDev | Best for letting DeputyDev make changes autonomously in codebase |
| Require user to apply and then approve/reject changes in codebase | Requires user to just approve/reject changes in codebase |
| Example - _Which components are configured on home page?_ | Example - _Create a new function which returns all components configured on home page_ |

### Mentioning context

<p></p>

In order to achieve greater accuracy of responses, you can guide DeputyDev on which files to focus on while executing your task.

Use `@` to mention a piece of context along with your query.
You can attach following context:

1.  Directory - Contents of the directory will be mentioned

2.  File - Contents of the file will be mentioned

3.  Class - Code block of a class will be mentioned

4.  Function - Code block of a function will be mentioned.

<p></p>

### Inline Modify

Modify code by selecting it.

Select the code block, click on bulb icon or press ⌘L. Click on modify and write your prompt to modify the code block.

### Inline Chat

Chat against a selected code block

Select the code block, click on bulb icon or press ⌘L. Click on chat. This will mention the code block in chat mode. You can then write your prompt to chat against it.

### DeputyDev Rules

Learn how to customize AI behavior in DeputyDev using project-specific rules

Using rules in DeputyDev you can control the behavior of the underlying model. You can think of it as instructions and/or a system prompt for LLMs.

Here is a template you can use - [https://gist.github.com/vishalof1mg/385e2c74d047dd50f5b48cd263f36d27](https://gist.github.com/vishalof1mg/385e2c74d047dd50f5b48cd263f36d27)
