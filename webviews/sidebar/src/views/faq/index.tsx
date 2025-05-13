import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const faqs = [
  {
    category: 'General',
    icon: '🚀',
    items: [
      {
        q: 'What is DeputyDev?',
        a: `DeputyDev is an AI-powered developer assistant designed to accelerate software development workflows. It helps engineers write, and understand code within their existing IDEs, It can also review code by integrating with your VCS (Github, Gitlab or Bitbucket) with deep context of your codebase, architecture, and team conventions.`,
      },
      {
        q: 'Who is DeputyDev for?',
        a: `DeputyDev is built for engineering teams working on large, complex codebases. From startups scaling fast to enterprises with thousands of repositories, it supports backend, frontend, and full-stack developers alike.`,
      },
      {
        q: 'How is DeputyDev different from other AI code assistants?',
        a: `DeputyDev goes beyond just code generation or reviews — it's a comprehensive developer assistant built to enhance efficiency across the entire software development lifecycle. From intelligent code suggestions to a developer productivity dashboard, DeputyDev helps teams track key metrics, monitor velocity, and improve engineering health at every touchpoint.`,
      },
    ],
  },
  {
    category: 'Features & Capabilities',
    icon: '🔧',
    items: [
      {
        q: 'What can DeputyDev do?',
        a: `DeputyDev offers:\n\n- Context-aware code generation\n- AI-assisted code reviews\n- Chat interface to ask questions about your codebase\n- Smart prompt polishing\n- Model selection (e.g., Gemini 2.5 Pro, GPT-4)\n- Optional web search for broader knowledge`,
      },
      {
        q: 'What languages does it support?',
        a: `DeputyDev supports 10+ popular languages including JavaScript, Python, Java, TypeScript, Go, Ruby, Rust, Kotlin, and more.`,
      },
      {
        q: 'Can DeputyDev work across monorepos or multi-repo architectures?',
        a: `Yes. It’s built for scale — it indexes and reasons across large monorepos and interconnected microservice repositories.`,
      },
      {
        q: 'Can DeputyDev adhere to repo specific rules?',
        a: `Yes, each repo can have a .deputydevrules file where users can articulate repo specific rules which will be adhered to by DeputyDev`,
      },
    ],
  },
  {
    category: 'Privacy & Security',
    icon: '🔒',
    items: [
      {
        q: 'Is my code safe with DeputyDev?',
        a: `Absolutely. DeputyDev is enterprise-grade. All data is processed securely, Your code remains on your local system and we don't store anything.`,
      },
      {
        q: 'Can I control what DeputyDev sees in my codebase?',
        a: `Yes. You can configure scopes, visibility rules, and access levels so DeputyDev sees only the parts of your codebase you want it to. Use .deputydevignore file.`,
      },
    ],
  },
  {
    category: 'Setup & Access',
    icon: '⚙️',
    items: [
      {
        q: 'How do I start using DeputyDev?',
        a: `You can start by installing the <a href='https://marketplace.visualstudio.com/items?itemName=Tata1mg.deputydev'>DeputyDev VSCode extension</a> and signing in with your whitelisted email domain. Full setup instructions are available in our <a href='https://onedoc.ekdosis.com/docs/deputydev/content/DeputyDev%20-%20VSCode%20plugin/'>documentation</a>.`,
      },
      {
        q: 'Do I need Google Workspace to use DeputyDev?',
        a: `Not anymore. You can now sign up using any whitelisted email address with an email-password login option.`,
      },
      {
        q: 'Does it require training on our codebase?',
        a: `No training is required upfront. DeputyDev uses smart indexing and retrieval techniques (like our custom RAGLOC engine) to provide context-aware responses in real time.`,
      },
    ],
  },
  {
    category: 'Enterprise & Support',
    icon: '💼',
    items: [
      {
        q: 'Can DeputyDev be customized for our organization?',
        a: `Yes. DeputyDev is fully customizable — you can define prompt templates, response tone, repository-specific behavior, and model routing logic.`,
      },
      {
        q: 'Do you offer enterprise support or SLAs?',
        a: `Yes. We offer SLAs, dedicated support, onboarding assistance, and custom integrations for enterprise clients.`,
      },
      {
        q: 'Who do I contact for enterprise onboarding or demos?',
        a: `Reach out to us at <a href="mailto:mail:deputydev@1mg.com" rel="nofollow" target="_blank">deputydev@1mg.com</a> or via <a href="https://deputydev.ai" rel="nofollow" target="_blank">our website</a> to schedule a personalized demo.`,
      },
    ],
  },
  {
    category: 'Feedback & Improvement',
    icon: '🧠',
    items: [
      {
        q: 'Can I give feedback on responses?',
        a: `Yes! You can like or dislike responses in real time. This helps us improve DeputyDev’s accuracy and relevance based on actual usage. You can also <a href="https://docs.google.com/forms/d/e/1FAIpQLSesBtbKFMan7PvEjhjs_Ic5VRBLhlrw33CY-y78qP7C-x57tQ/viewform" rel="nofollow" target="_blank">provide detailed feedback</a> or <a href="https://docs.google.com/forms/d/e/1FAIpQLSfdYBxKHYmYORt3tD5A6p_STMJ-ku_DDESIE1fK0-vyH59nFw/viewform" rel="nofollow" target="_blank">request for a feature</a>. You can also view and add discussions on our subreddit <a href="https://www.reddit.com/r/DeputyDev/" rel="nofollow" target="_blank">r/DeputyDev</a>`,
      },
      {
        q: 'Will DeputyDev get better over time?',
        a: `Yes. We’re constantly refining DeputyDev based on user feedback, new model integrations, and better retrieval strategies.`,
      },
    ],
  },
];

const FaqPage = () => {
  const [openIndex, setOpenIndex] = useState<null | string>(null);

  const toggle = (categoryIdx: number, itemIdx: number) => {
    const idx = `${categoryIdx}-${itemIdx}`;
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div
      className="faq-container"
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'var(--vscode-font-family)',
        color: 'var(--vscode-foreground)',
        backgroundColor: 'var(--vscode-sideBar-background)',
      }}
    >
      <style>
        {`@keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        `}
      </style>
      <header
        style={{
          textAlign: 'center',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--vscode-editorWidget-border)',
        }}
      >
        <h1
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: 'var(--vscode-editor-foreground)',
            marginBottom: '0.25rem',
          }}
        >
          ❓DD - FAQ Page
        </h1>
      </header>

      {faqs.map((section, categoryIdx) => (
        <section
          key={section.category}
          style={{
            marginBottom: '1.5rem',
            borderRadius: 6,
            border: '1px solid var(--vscode-editorWidget-border)',
            backgroundColor: 'var(--vscode-editorWidget-background)',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--vscode-editorWidget-border)',
              backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--vscode-editor-foreground)',
              }}
            >
              <span style={{ fontSize: '1.2em' }}>{section.icon}</span>
              {section.category}
            </h2>
          </div>

          <div>
            {section.items.map((item, itemIdx) => {
              const idx = `${categoryIdx}-${itemIdx}`;
              const isOpen = openIndex === idx;

              return (
                <div key={item.q}>
                  <button
                    onClick={() => toggle(categoryIdx, itemIdx)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      cursor: 'pointer',
                      backgroundColor: isOpen
                        ? 'var(--vscode-list-activeSelectionBackground)'
                        : 'transparent',
                      color: 'var(--vscode-editor-foreground)',
                      fontWeight: 500,
                      fontSize: '0.9rem',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isOpen)
                        e.currentTarget.style.backgroundColor =
                          'var(--vscode-list-hoverBackground)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ flexShrink: 0 }}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.q}</span>
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.87rem',
                        lineHeight: 1.6,
                        color: 'var(--vscode-descriptionForeground)',
                        backgroundColor: 'var(--vscode-editor-background)',
                        borderTop: '1px solid var(--vscode-editorWidget-border)',
                        animation: 'fadeIn 0.2s ease-in-out',
                      }}
                    >
                      <style>
                        {`a {
                          color: #4ea1f3;
                        }`}
                      </style>
                      <div
                        dangerouslySetInnerHTML={{ __html: item.a.replace(/\n/g, '<br />') }}
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.6,
                          fontSize: '0.87rem',
                          color: 'var(--vscode-descriptionForeground)',
                          backgroundColor: 'var(--vscode-editor-background)',
                          borderTop: '1px solid var(--vscode-editorWidget-border)',
                          animation: 'fadeIn 0.2s ease-in-out',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default FaqPage;
