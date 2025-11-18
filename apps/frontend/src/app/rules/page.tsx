'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react'

export default function RulesPage() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rules`)
      const data = await res.json()
      setRules(data)
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRule = async (id: string, enabled: boolean) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      fetchRules()
    } catch (error) {
      console.error('Failed to toggle rule:', error)
    }
  }

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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Custom Rules</h1>
          <p className="text-muted-foreground">
            Create and manage organization-specific coding standards
          </p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New Rule
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading rules...</p>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  No custom rules yet. Create your first rule to enforce organization standards.
                </p>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 mx-auto hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Create First Rule
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule: any) => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{rule.name}</CardTitle>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor(rule.severity) as any}>
                      {rule.severity}
                    </Badge>
                    <Badge variant="outline">{rule.language}</Badge>
                    <button
                      onClick={() => toggleRule(rule.id, rule.enabled)}
                      className={`p-2 rounded-lg ${
                        rule.enabled
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {rule.enabled ? (
                        <Power className="h-4 w-4" />
                      ) : (
                        <PowerOff className="h-4 w-4" />
                      )}
                    </button>
                    <button className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Category:</span>{' '}
                    <span className="text-sm text-muted-foreground">{rule.category}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Pattern:</span>{' '}
                    <code className="text-sm bg-muted px-2 py-1 rounded">{rule.pattern}</code>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Message:</span>{' '}
                    <span className="text-sm text-muted-foreground">{rule.message}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
