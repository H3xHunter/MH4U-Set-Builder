import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataValidationError } from '@/data/validate'
import { displayHeading } from './Section'

export function LoadingState() {
  return (
    <p role="status" className="p-8 text-center text-muted-foreground">
      Loading armor, decorations and skills…
    </p>
  )
}

/** Plain text only: the error message, plus the validation path when there is one. */
function errorDetails(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error ? error.cause : undefined
  return cause instanceof DataValidationError ? `${message}\npath: ${cause.path}` : message
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const details = errorDetails(error)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details)
    } catch {
      // Clipboard blocked (permissions, insecure context): nothing useful to do.
    }
  }
  return (
    <div className="mx-auto max-w-md p-4 pt-12">
      <Card role="alert" className="gap-3 py-5">
        <div className="space-y-3 px-5">
          <h2 className={displayHeading}>Game data didn't load</h2>
          <p className="text-sm text-muted-foreground">
            The builder can't start without it. Your charms are safe in this browser.
          </p>
          <pre className="whitespace-pre-wrap break-words rounded-md border bg-background p-2 font-mono text-xs">
            {details}
          </pre>
          <div className="flex gap-2">
            <Button onClick={onRetry}>Try again</Button>
            <Button variant="outline" onClick={copy}>
              Copy error details
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
