'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Code, GitPullRequest, Shield, Zap } from 'lucide-react'

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState({
    totalPRs: 0,
    totalIssues: 0,
    criticalIssues: 0,
    averageIssuesPerPR: '0',
  })

  const [pullRequests, setPullRequests] = useState([])

  useEffect(() => {
    // Fetch analytics
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/pull-requests/analytics`)
      .then(res => res.json())
      .then(data => setAnalytics(data))
      .catch(console.error)

    // Fetch recent PRs
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/pull-requests`)
      .then(res => res.json())
      .then(data => setPullRequests(data))
      .catch(console.error)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Code Review Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor code quality and review analytics across your repositories
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Pull Requests"
            value={analytics.totalPRs}
            icon={<GitPullRequest className="h-6 w-6" />}
            description="Last 30 days"
          />
          <StatsCard
            title="Total Issues"
            value={analytics.totalIssues}
            icon={<Code className="h-6 w-6" />}
            description="Found in reviews"
          />
          <StatsCard
            title="Critical Issues"
            value={analytics.criticalIssues}
            icon={<AlertCircle className="h-6 w-6" />}
            description="Require immediate attention"
            variant="destructive"
          />
          <StatsCard
            title="Avg Issues per PR"
            value={analytics.averageIssuesPerPR}
            icon={<Zap className="h-6 w-6" />}
            description="Quality metric"
          />
        </div>

        {/* Main Content */}
        <Tabs defaultValue="recent" className="space-y-6">
          <TabsList>
            <TabsTrigger value="recent">Recent Pull Requests</TabsTrigger>
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="rules">Custom Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Pull Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pullRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No pull requests analyzed yet
                    </p>
                  ) : (
                    pullRequests.map((pr: any) => (
                      <PullRequestItem key={pr.id} pr={pr} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repositories">
            <Card>
              <CardHeader>
                <CardTitle>Repositories</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Configure repository settings and integrations
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <CardTitle>Custom Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create and manage custom code review rules
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function StatsCard({
  title,
  value,
  icon,
  description,
  variant = 'default',
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  description: string
  variant?: 'default' | 'destructive'
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={variant === 'destructive' ? 'text-destructive' : 'text-primary'}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

function PullRequestItem({ pr }: { pr: any }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{pr.title}</span>
          <Badge variant="outline">{pr.repository?.name}</Badge>
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          <span>PR #{pr.prNumber}</span>
          <span>•</span>
          <span>{pr.filesChanged} files changed</span>
          <span>•</span>
          <span>
            +{pr.linesAdded} -{pr.linesDeleted}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {pr.issueCount > 0 ? (
          <Badge variant={pr.issueCount > 10 ? 'destructive' : 'secondary'}>
            {pr.issueCount} issues
          </Badge>
        ) : (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Clean
          </Badge>
        )}
      </div>
    </div>
  )
}
