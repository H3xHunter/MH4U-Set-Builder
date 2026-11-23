import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function App() {
  return (
    <div className="fade-in mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">MH4U Set Builder</h1>
        <p className="text-muted-foreground">
          A free, client-side set builder for Monster Hunter 4 Ultimate. Work in progress.
        </p>
      </header>
      <main>
        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
            <CardDescription>The builder itself is not implemented yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button>Start a set</Button>
          </CardContent>
        </Card>
      </main>
      <footer className="mt-auto text-sm text-muted-foreground">
        Unofficial fan project, not affiliated with or endorsed by Capcom.
      </footer>
    </div>
  )
}
