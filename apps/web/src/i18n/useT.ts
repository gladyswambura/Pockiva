import { useStore } from '@/store'
import { translations, type Strings } from './strings'

export function useT(): Strings {
  const locale = useStore(s => s.locale)
  return translations[locale] ?? translations['en']
}
