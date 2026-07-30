import './styles.css';
import { bootApp } from './app.ts';
import { registerPwa } from './pwa/register.ts';

bootApp();

if (import.meta.env.PROD) {
  registerPwa();
}
