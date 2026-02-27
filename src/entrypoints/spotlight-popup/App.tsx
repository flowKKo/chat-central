import { App as SpotlightApp } from '../spotlight.content/App'

export function App() {
  return <SpotlightApp isVisible onClose={() => window.close()} />
}
