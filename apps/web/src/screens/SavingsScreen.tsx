import { useT } from '@/i18n/useT'
import { SavingsPanel } from '@/components/panels/SavingsPanel'

export function SavingsScreen() {
  const t = useT()

  return (
    <div className="screen-page savings-screen">
      <header className="screen-heading">
        <div>
          <h1>{t.savings.title}</h1>
          <p>Protected money. Locked savings cannot be withdrawn until the unlock date.</p>
        </div>
      </header>
      <SavingsPanel />
    </div>
  )
}