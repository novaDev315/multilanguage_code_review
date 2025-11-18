import Link from 'next/link'
import { ArrowRight, Code2, Shield, Zap, GitBranch } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Code2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">AI Code Review</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-sm hover:text-primary">
              Dashboard
            </Link>
            <Link href="/docs" className="text-sm hover:text-primary">
              Documentation
            </Link>
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            AI-Powered Code Review for{' '}
            <span className="text-primary">Every Language</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Catch bugs, security vulnerabilities, and performance issues before they reach production.
            Support for 10+ programming languages with intelligent, context-aware analysis.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/signup"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 flex items-center"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/demo"
              className="px-6 py-3 border border-border rounded-lg font-semibold hover:bg-accent"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Comprehensive Code Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Code2 className="h-10 w-10 text-primary" />}
              title="Multi-Language Support"
              description="JavaScript, TypeScript, Python, Java, Go, Ruby, PHP, C#, Rust, Swift, Kotlin and more"
            />
            <FeatureCard
              icon={<Shield className="h-10 w-10 text-primary" />}
              title="Security Scanning"
              description="Detect OWASP Top 10, SQL injection, XSS, and authentication vulnerabilities"
            />
            <FeatureCard
              icon={<Zap className="h-10 w-10 text-primary" />}
              title="Performance Optimization"
              description="Algorithm complexity analysis, memory optimization, and N+1 query detection"
            />
            <FeatureCard
              icon={<GitBranch className="h-10 w-10 text-primary" />}
              title="Git Integration"
              description="Seamless GitHub, GitLab, and Bitbucket integration with PR comments"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-primary mb-2">10+</div>
            <div className="text-muted-foreground">Programming Languages</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">&lt;30s</div>
            <div className="text-muted-foreground">Average Analysis Time</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">80%+</div>
            <div className="text-muted-foreground">Bug Detection Rate</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 AI Code Review. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 bg-card rounded-lg border">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
