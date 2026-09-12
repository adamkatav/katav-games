import './styles/app.css';
import { createShell } from './ui/shell';
import { registerSW } from 'virtual:pwa-register';

const APP_VERSION = __APP_VERSION__;

// A new build is picked up on the next launch, never by reloading under a
// player mid-game — exactly the surprise this audience should not get.
registerSW({ immediate: false });

const root = document.getElementById('app');
if (root) createShell(root, APP_VERSION);
