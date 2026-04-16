import Control from './windows/Control';
import Display from './windows/Display';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') ?? 'control';

  return view === 'display' ? <Display /> : <Control />;
}
