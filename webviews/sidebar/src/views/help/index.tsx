import React, { useState } from 'react';

export default function DeputyDevHelpPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setOpenSection(openSection === sectionId ? null : sectionId);
  };

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'var(--vscode-font-family)',
        color: 'var(--vscode-foreground)',
        backgroundColor: 'var(--vscode-sideBar-background)',
        minHeight: '100vh',
      }}
    >
      <style>
        {`a {
        color: #4ea1f3;
        }`}
      </style>
      <header
        style={{
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--vscode-editorWidget-border)',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🛠️ DeputyDev Help Center
        </h1>
        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--vscode-descriptionForeground)',
            marginTop: '0.5rem',
          }}
        >
          Your AI-powered assistant for real-world development workflows
        </p>
      </header>
      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Main Content */}
        <div style={{ flex: 1 }}>
          <section
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              borderRadius: 6,
              border: '1px solid var(--vscode-editorWidget-border)',
              backgroundColor: 'var(--vscode-editorWidget-background)',
            }}
          >
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                margin: '0 0 1rem 0',
                color: 'var(--vscode-editor-foreground)',
              }}
            >
              🚀 Getting Started
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Install the VSCode Plugin:
                </strong>
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=Tata1mg.deputydev"
                  rel="nofollow noreferrer"
                  target="_blank"
                >
                  Download here
                </a>{' '}
                and sign in using a whitelisted email.
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Login Options:
                </strong>
                Google Workspace or email/password (for approved domains)
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Project Setup:
                </strong>
                Select a root folder or repository. DeputyDev will automatically index and
                understand it.
              </div>
            </div>
          </section>
          <section
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              borderRadius: 6,
              border: '1px solid var(--vscode-editorWidget-border)',
              backgroundColor: 'var(--vscode-editorWidget-background)',
            }}
          >
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                margin: '0 0 1rem 0',
                color: 'var(--vscode-editor-foreground)',
              }}
            >
              ⚙️ Core Capabilities
            </h2>
            <div
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              }}
            >
              {[
                {
                  title: 'Code Generation',
                  content: 'Write code following your project patterns',
                },
                {
                  title: 'PR Reviews',
                  content: 'Automated code review assistance',
                },
                {
                  title: 'Contextual Chat',
                  content: 'Understand logic and debug issues',
                },
                {
                  title: 'Model Switching',
                  content: 'Choose between Gemini 2.5 Pro and GPT-4',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  style={{
                    padding: '1rem',
                    borderRadius: 4,
                    backgroundColor: 'var(--vscode-editor-background)',
                    border: '1px solid var(--vscode-editorWidget-border)',
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{feature.content}</p>
                </div>
              ))}
            </div>
          </section>
          <section
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              borderRadius: 6,
              border: '1px solid var(--vscode-editorWidget-border)',
              backgroundColor: 'var(--vscode-editorWidget-background)',
            }}
          >
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                margin: '0 0 1rem 0',
                color: 'var(--vscode-editor-foreground)',
              }}
            >
              🔐 Security & Privacy
            </h2>
            <div
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              }}
            >
              {[
                {
                  title: 'Enterprise-Grade Security',
                  content: 'Your code stays secure with enterprise-grade controls.',
                },
                {
                  title: 'Flexible Deployment Options',
                  content: 'Full support for on-premise or VPC deployment.',
                },
                {
                  title: 'Granular Access Controls',
                  content: 'Customizable access controls per repo or directory.',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  style={{
                    padding: '1rem',
                    borderRadius: 4,
                    backgroundColor: 'var(--vscode-editor-background)',
                    border: '1px solid var(--vscode-editorWidget-border)',
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{feature.content}</p>
                </div>
              ))}
            </div>
          </section>
          <section
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              borderRadius: 6,
              border: '1px solid var(--vscode-editorWidget-border)',
              backgroundColor: 'var(--vscode-editorWidget-background)',
            }}
          >
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                margin: '0 0 1rem 0',
                color: 'var(--vscode-editor-foreground)',
              }}
            >
              🧑‍💼 Need Help or a Demo?
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                Reach us at{' '}
                <a href="mailto:mail:deputydev@1mg.com" rel="nofollow noreferrer" target="_blank">
                  deputydev@1mg.com
                </a>
              </div>
              <div>
                Or Visit{' '}
                <a href="https://deputydev.ai" rel="nofollow noreferrer" target="_blank">
                  https://deputydev.ai
                </a>{' '}
                for more resources.
              </div>
            </div>
          </section>
          <footer
            style={{
              marginTop: '3rem',
              paddingTop: '2rem',
              borderTop: '1px solid var(--vscode-editorWidget-border)',
              textAlign: 'center',
              fontSize: '0.85rem',
              color: 'var(--vscode-descriptionForeground)',
            }}
          >
            © 2025 DeputyDev – Built for engineers, by engineers.
          </footer>
        </div>
      </div>
    </div>
  );
}
